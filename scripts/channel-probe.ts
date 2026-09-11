/**
 * 频道探针：跑 N 局，看每个频段到底有没有被玩家碰上、什么时候静默、以及核心线的三态分布。
 *
 * 存在理由与 event-trigger-probe 一样：新内容写成"条件写漏"时不会报错，
 * 只会在真局里悄无声息地永不触发。纸面检查不出来，必须实测。
 *
 * 用法：npm run probe:channels -- 200
 */

import { TIME } from '../src/game/balance';
import '../src/game/copy';
import { CHANNEL_DEFS } from '../src/game/content/channels';
import { tickChannels } from '../src/game/engine/channels';
import { chooseSite, createRun, endDay } from '../src/game/engine/run';
import { checkRequirement, deriveFacts } from '../src/game/engine/tags';
import {
  acknowledgeCollapse as ackCollapse,
  createSession,
  openChannel,
  replyChannel,
  searchChannel,
} from '../src/game/session';
import type { ChatChoice, RunState } from '../src/game/types';

const TOTAL = Number(process.argv[2] ?? 200);
const SITE = 'apartment';

/** best 尽量说好话；worst 回话但总挑最伤人的；none 从不回 */
type Persona = 'best' | 'worst' | 'none';
const PERSONAS: Persona[] = ['best', 'worst', 'none'];

interface Stat {
  found: number;
  lines: number;
  lost: number;
  lostDaySum: number;
  lostDayN: number;
  choices: number;
}

const newStat = (): Stat => ({ found: 0, lines: 0, lost: 0, lostDaySum: 0, lostDayN: 0, choices: 0 });

/** 挑一个选项：优先能过门槛的、说出去话的，再按好感度取向排 */
function pickChoice(run: RunState, choices: ChatChoice[], persona: Persona): ChatChoice | null {
  const sendable = choices.filter((c) => !!c.say);
  const facts = deriveFacts(run);
  const usable = (sendable.length > 0 ? sendable : choices).filter(
    (c) => checkRequirement(c.requires, run, facts).ok,
  );
  if (usable.length === 0) return null;
  const sorted = [...usable].sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0));
  return persona === 'worst' ? sorted[sorted.length - 1]! : sorted[0]!;
}

interface Outcome {
  stats: Record<string, Stat>;
  poolLeft: number;
  /** 小桃三态 */
  xt: 'alive' | 'dead' | 'silent' | 'open' | 'unmet';
  /** 官方台三条结局 */
  og: 'coop' | 'suspect' | 'ignored' | 'open';
}

function runOne(seed: number, persona: Persona): Outcome {
  const run: RunState = createRun({
    seed,
    classId: 'clerk',
    packId: 'none',
    // 叙事模式：探针只关心频道内容有没有被推到，不希望被渴死/冻死打断
    difficulty: 'story',
    metaPerks: [],
    forceDisaster: 'nuclear',
  });
  chooseSite(run, SITE);

  const stats: Record<string, Stat> = {};
  for (const d of CHANNEL_DEFS) stats[d.id] = newStat();
  const everFound = new Set<string>();
  const lostLogged = new Set<string>();
  let xtOutcome: Outcome['xt'] = 'unmet';
  let ogOutcome: Outcome['og'] = 'open';

  // 探针需要电台与电，别让"没电"这个变量盖住内容本身
  run.modules.radio = 2;
  run.modules.power = 3;
  run.res.foodStaple = Math.max(run.res.foodStaple, 40);

  let guard = 0;
  while (run.day <= TIME.FINAL_DAY && run.phase !== 'ended' && guard++ < 200) {
    if (run.phase === 'collapse') {
      const s0 = createSession(run);
      ackCollapse(s0);
    }
    run.wear.batteryCharge = Math.max(run.wear.batteryCharge, 6);
    run.ap = Math.max(run.ap, 4);
    run.res.water = Math.max(run.res.water, 60);
    run.res.foodStaple = Math.max(run.res.foodStaple, 40);

    const s = createSession(run);
    searchChannel(s);
    tickChannels(run);

    for (const st of run.channels) {
      if (!everFound.has(st.id)) {
        everFound.add(st.id);
        stats[st.id]!.found += 1;
      }
      stats[st.id]!.lines += st.inbox.length;
      openChannel(s, st.id);

      if (persona !== 'none' && st.awaitingBeat) {
        const def = CHANNEL_DEFS.find((d) => d.id === st.id)!;
        const beat = def.beats.find((b) => b.id === st.awaitingBeat);
        const pick = beat ? pickChoice(run, beat.choices ?? [], persona) : null;
        if (pick) {
          const r = replyChannel(s, st.id, pick.id);
          if (r.ok) stats[st.id]!.choices += 1;
        }
      }
    }

    for (const st of run.channels) {
      if (st.status === 'lost' && !lostLogged.has(st.id)) {
        lostLogged.add(st.id);
        stats[st.id]!.lost += 1;
        stats[st.id]!.lostDaySum += run.day;
        stats[st.id]!.lostDayN += 1;
      }
      if (st.id === 'xt' && xtOutcome === 'unmet') {
        if (run.flags.includes('flag:xtAlive')) xtOutcome = 'alive';
        else if (st.doneBeats.includes('xt_dead')) xtOutcome = 'dead';
        else if (st.doneBeats.includes('xt_silent')) xtOutcome = 'silent';
        else if (st.status === 'lost') xtOutcome = 'silent';
      }
    }

    // 事件队列不挡探针：直接清掉，避免频道推进被日常事件卡住
    if (run.queue.length > 0) run.queue = [];
    endDay(run);
  }

  if (xtOutcome === 'unmet' && run.channels.some((c) => c.id === 'xt' && c.status === 'active')) {
    xtOutcome = 'open';
  }
  const ogSt = run.channels.find((c) => c.id === 'og');
  if (ogSt) {
    if (ogSt.doneBeats.includes('og_endgame')) ogOutcome = 'coop';
    else if (ogSt.doneBeats.includes('og_suspect')) ogOutcome = 'suspect';
    else if (ogSt.doneBeats.includes('og_ignored')) ogOutcome = 'ignored';
  }
  return { stats, poolLeft: run.channelPool.length, xt: xtOutcome, og: ogOutcome };
}

const searchable = CHANNEL_DEFS.filter((d) => d.discover === 'search').length;

for (const persona of PERSONAS) {
  const acc: Record<string, Stat> = {};
  for (const d of CHANNEL_DEFS) acc[d.id] = newStat();
  const xtTally: Record<string, number> = { alive: 0, dead: 0, silent: 0, open: 0, unmet: 0 };
  const ogTally: Record<string, number> = { coop: 0, suspect: 0, ignored: 0, open: 0 };
  let poolLeftSum = 0;

  for (let i = 0; i < TOTAL; i++) {
    const { stats, poolLeft, xt, og } = runOne(10000 + i * 37, persona);
    ogTally[og] = (ogTally[og] ?? 0) + 1;
    poolLeftSum += poolLeft;
    xtTally[xt] = (xtTally[xt] ?? 0) + 1;
    for (const id of Object.keys(acc)) {
      const a = acc[id]!;
      for (const k of Object.keys(a) as Array<keyof Stat>) a[k] += stats[id]![k];
    }
  }

  const label = persona === 'best' ? '尽量回好话' : persona === 'worst' ? '专挑最伤人的回' : '从不回';
  console.log(`\n  ── ${label} · ${TOTAL} 局 ──`);
  for (const d of CHANNEL_DEFS) {
    const a = acc[d.id]!;
    const foundPct = ((a.found / TOTAL) * 100).toFixed(1);
    const lostPct = a.found > 0 ? ((a.lost / a.found) * 100).toFixed(1) : '—';
    const avgDay = a.lostDayN > 0 ? (a.lostDaySum / a.lostDayN).toFixed(0) : '—';
    console.log(
      `    ${d.id.padEnd(12)} 遇到 ${foundPct}%  收到 ${(a.lines / TOTAL).toFixed(2)} 条/局  ` +
        `静默 ${lostPct}%（平均第 ${avgDay} 天）  回话 ${(a.choices / TOTAL).toFixed(2)} 次/局`,
    );
  }
  console.log(`    搜索池剩余 ${(poolLeftSum / TOTAL).toFixed(2)} / ${searchable}`);
  console.log(
    `    小桃三态：活着 ${((xtTally.alive! / TOTAL) * 100).toFixed(1)}%  ` +
      `死了 ${((xtTally.dead! / TOTAL) * 100).toFixed(1)}%  ` +
      `静默 ${((xtTally.silent! / TOTAL) * 100).toFixed(1)}%  ` +
      `未收尾 ${(((xtTally.open ?? 0) + (xtTally.unmet ?? 0)) / TOTAL * 100).toFixed(1)}%`,
  );
  console.log(
    `    官方台结局：合作者 ${((ogTally.coop! / TOTAL) * 100).toFixed(1)}%  ` +
      `可疑分子 ${((ogTally.suspect! / TOTAL) * 100).toFixed(1)}%  ` +
      `无人应答 ${((ogTally.ignored! / TOTAL) * 100).toFixed(1)}%  ` +
      `未收尾 ${((ogTally.open! / TOTAL) * 100).toFixed(1)}%`,
  );
}

console.log('');
