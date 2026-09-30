/**
 * 频道压力回放：把「收音机那一路」也塞进无人值守的循环里。
 *
 * ## 为什么要单写这一个
 *
 * `scripts/simulate.ts` 的人格策略**完全不碰 channels**，而玩家报的两次闪退
 * 一次在收音机（小桃袭击事件）、一次在特殊物品栏——恰好是 sim 覆盖不到的两块，
 * 所以「sim 720 局全绿」并不能说明那两块是好的。
 *
 * 这里每天结算后都去把频道推一遍，用的就是玩家会走的路径：
 * 有未读就打开、等选项就逐个试、等开口就 hail、偶尔扫新频道。
 * 任何一步抛错都会中止并打印当天的存档切片。
 *
 * 用法：npm run stress:channels -- 60
 * 退出码非 0 = 抓到异常。
 */

import { TIME } from '../src/game/balance';
import { CHANNEL_BY_ID } from '../src/game/content/channels';
import { CONDITION_BY_ID } from '../src/game/content/conditions';
import { DISASTER_BY_ID, DISASTERS } from '../src/game/content/disasters';
import { FAMILY_BY_ID } from '../src/game/content/events';
import { MODULE_IDS } from '../src/game/content/modules';
import { SITES, SITE_BY_ID } from '../src/game/content/sites';
import {
  activeEvent,
  activeRound,
  hailChannel,
  openChannel,
  replyChannel,
  searchChannel,
} from '../src/game/engine/channels';
import { chooseSite as engineChooseSite, createRun } from '../src/game/engine/run';
import type { ChannelState, RunState } from '../src/game/types';
import { attach, emptyCounters, PERSONA_BY_ID, PERSONA_IDS, playDay } from './sim/policy';

const n = Number(process.argv[2] ?? 40);
const MAX_DAYS = 90;

interface Crash {
  seed: number;
  day: number;
  where: string;
  message: string;
  stack?: string;
  slice: string;
}

const crashes: Crash[] = [];
const tally = { answered: 0, rejected: 0, arrived: 0, searched: 0 };

/** 把当时的频道状态压成几行：崩溃时能看出「崩在哪一步、手里握着什么」 */
function slice(run: RunState): string {
  const chs = (run.channels ?? []).map((c) => {
    const at = c.active ? ` @${c.active.eventId}/${c.active.roundId}` : '';
    return `      ${c.id} ${c.status} aff=${c.affinity} done=${c.doneEvents.length} inbox=${c.inbox.length} log=${c.log.length} ${c.awaiting ?? '-'}${at}`;
  });
  return [
    `    day=${run.day} phase=${run.phase} site=${run.siteId} threat=${run.threat} ap=${run.ap}`,
    `    电台=${run.modules?.radio} 蓄电=${run.wear?.batteryCharge} 滤芯=${run.wear?.filterLife} 备用芯=${run.items?.filter}`,
    `    状态=${run.conditions?.join(',') || '无'}`,
    '    channels:',
    ...(chs.length ? chs : ['      （空）']),
  ].join('\n');
}

/**
 * 存档里的 id 全都能查到吗。
 *
 * 这一条比「不抛异常」更要紧：引擎侧**不查表**（conditions 就是一串字符串），
 * 写错了照样跑得欢；真正崩的是 UI——顶栏那行 `CONDITION_BY_ID[c].needsMedbay`
 * 会在渲染期抛错，于是整页白屏、连错误面板都拦不住（面板能拦，但玩家看到的是白屏）。
 * 所以每走一步都回头验一遍表，等于把「渲染期会不会炸」提前到无头环境里问一次。
 */
function auditIds(run: RunState): string[] {
  const bad: string[] = [];
  for (const c of run.conditions ?? []) {
    if (!CONDITION_BY_ID[c]) bad.push(`conditions 里的 ${c} 不在 CONDITION_BY_ID`);
  }
  for (const m of Object.keys(run.modules ?? {})) {
    if (!(MODULE_IDS as string[]).includes(m)) bad.push(`modules 里的 ${m} 不在 MODULE_IDS`);
  }
  for (const c of run.channels ?? []) {
    if (!CHANNEL_BY_ID[c.id]) bad.push(`channels 里的 ${c.id} 不在 CHANNEL_BY_ID`);
  }
  if (run.siteId && !SITE_BY_ID[run.siteId]) bad.push(`siteId ${run.siteId} 不在 SITE_BY_ID`);
  if (run.world?.disaster && !DISASTER_BY_ID[run.world.disaster]) {
    bad.push(`disaster ${run.world.disaster} 不在 DISASTER_BY_ID`);
  }
  for (const q of run.queue ?? []) {
    const f = FAMILY_BY_ID[q.familyId];
    if (!f) bad.push(`queue 里的 ${q.familyId} 不在 FAMILY_BY_ID`);
    else if (!f.variants.some((v) => v.id === q.variantId)) {
      bad.push(`queue 里的 ${q.familyId}/${q.variantId} 不存在`);
    }
  }
  return bad;
}

/** 玩家打开收音机后会做的事，按同样的顺序走一遍 */
function driveChannels(run: RunState): void {
  // 1. 打开有未读的频道（会结算 onRead 效果）
  for (const st of run.channels) {
    if (st.inbox.length === 0) continue;
    tally.arrived += openChannel(run, st.id).lines.length;
  }

  // 2. 正在等你的，逐个选项试——包括被门槛挡下的那些（被拒路径也要走一遍）
  for (const st of run.channels) {
    if (st.status !== 'active' || !st.awaiting) continue;
    const ids = pendingChoiceIds(st, st.awaiting);
    for (const id of ids) {
      const r = st.awaiting === 'open' ? hailChannel(run, st.id, id) : replyChannel(run, st.id, id);
      if (r.ok) {
        tally.answered++;
        break;
      }
      tally.rejected++;
    }
  }

  // 3. 偶尔扫一个新频道
  if (run.day >= TIME.COLLAPSE_DAY && run.ap > 0 && Math.random() < 0.25) {
    const r = searchChannel(run);
    if (r.ok && r.found) tally.searched++;
  }
}

function pendingChoiceIds(st: ChannelState, awaiting: 'choice' | 'open'): string[] {
  const def = CHANNEL_BY_ID[st.id];
  if (!def) return [];
  if (awaiting === 'open') return activeEvent(def, st)?.openChoices?.map((c) => c.id) ?? [];
  return activeRound(def, st)?.choices?.map((c) => c.id) ?? [];
}

for (let i = 0; i < n; i++) {
  const seed = 9000 + i;
  const site = SITES[i % SITES.length]!.id;
  const disaster = DISASTERS[i % DISASTERS.length]!.id;
  const persona = PERSONA_BY_ID[PERSONA_IDS[i % PERSONA_IDS.length]!];
  const counters = emptyCounters();

  let run: RunState;
  try {
    run = createRun({
      seed,
      classId: 'clerk',
      packId: 'none',
      difficulty: 'normal',
      metaPerks: [],
      forceDisaster: disaster,
    });
    if (!engineChooseSite(run, site).ok) engineChooseSite(run, 'apartment');
    // 人格策略不建电台也不蓄电，而搜索频道要两者都够；
    // 不手动塞一台，10 个临时频道就永远扫不到（实测 0 次命中）。
    run.modules.radio = Math.max(run.modules.radio, 1);
    run.wear.batteryCharge = Math.max(run.wear.batteryCharge, 6);
  } catch (e) {
    crashes.push({ seed, day: 0, where: '创建对局', message: msg(e), stack: stack(e), slice: '（无）' });
    continue;
  }

  const s = attach(run);
  let guard = 0;
  while (s.run.phase !== 'ended' && guard++ < MAX_DAYS) {
    try {
      playDay(s, persona, counters);
    } catch (e) {
      crashes.push({ seed, day: s.run.day, where: '推进一天', message: msg(e), stack: stack(e), slice: slice(s.run) });
      break;
    }
    try {
      driveChannels(s.run);
    } catch (e) {
      crashes.push({ seed, day: s.run.day, where: '收音机', message: msg(e), stack: stack(e), slice: slice(s.run) });
      break;
    }
    const bad = auditIds(s.run);
    if (bad.length) {
      crashes.push({
        seed,
        day: s.run.day,
        where: '查表',
        message: bad.join('；'),
        slice: slice(s.run),
      });
      break;
    }
  }
}

console.log(`跑完 ${n} 局（每局最多 ${MAX_DAYS} 天）`);
console.log(
  `  收发成功 ${tally.answered} 次 · 被门槛拒 ${tally.rejected} 次 · 拆开未读 ${tally.arrived} 行 · 扫到新频道 ${tally.searched} 个`,
);

if (crashes.length === 0) {
  console.log('没有异常。');
  process.exit(0);
}

console.log(`\n抓到 ${crashes.length} 处异常：\n`);
for (const c of crashes) {
  console.log(`· seed ${c.seed} · 第 ${c.day} 天 · ${c.where}`);
  console.log(`  ${c.message}`);
  console.log(c.slice);
  if (c.stack) console.log(`  ${c.stack.split('\n').slice(1, 4).join('\n  ')}`);
  console.log('');
}
process.exit(1);

function msg(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}
function stack(e: unknown): string | undefined {
  return e instanceof Error ? e.stack : undefined;
}
