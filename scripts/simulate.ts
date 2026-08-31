/**
 * 无头模拟：用一个"及格水平的玩家"策略跑很多局，用来验证平衡并抓运行时错误。
 *
 * 它不追求打得好，只追求打得像人：先保水和粮，然后加固和净水，缺物资就出门。
 * 如果这个策略的通关率过高，说明游戏太软；过低说明太硬。
 *
 * 用法：npm run sim -- 200
 */

import { TIME } from '../src/game/balance';
import { DISASTERS, DISASTER_BY_ID } from '../src/game/content/disasters';
import { ENDING_BY_ID } from '../src/game/content/endings';
import { FAMILY_BY_ID } from '../src/game/content/events';
import { LOCATIONS } from '../src/game/content/locations';
import { MODULE_IDS } from '../src/game/content/modules';
import { SITES } from '../src/game/content/sites';
import {
  buildOptions,
  doMaintenance,
  investLabor,
  maintenanceOptions,
  nextLevel,
  startProject,
} from '../src/game/engine/construction';
import { commitHaul, dailyNeeds, drainLocation, purchase, rollHaul, travelCost } from '../src/game/engine/economy';
import { treatCondition } from '../src/game/engine/health';
import {
  acknowledgeCollapse,
  chooseSite,
  createRun,
  endDay,
  resolveChoice,
} from '../src/game/engine/run';
import { checkRequirement } from '../src/game/engine/tags';
import { makeRng } from '../src/game/rng';
import type { Difficulty, ModuleId, ResourceId, RunState, SiteId } from '../src/game/types';

const N = Number(process.argv[2] ?? 120);
const DIFFICULTY: Difficulty = (process.argv[3] as Difficulty) ?? 'normal';

interface Outcome {
  seed: number;
  site: SiteId;
  disaster: string;
  days: number;
  threat: number;
  endingId: string;
  cause?: string;
  finalModules: number;
  crew: number;
}

const outcomes: Outcome[] = [];
const errors: Array<{ seed: number; day: number; message: string }> = [];

// ============================================================
// 策略
// ============================================================

/**
 * 处理今天的事件。策略上只有一条纪律：口粮紧张时不再收人。
 * 其余情况挑第一个满足条件的选项——这大致等于"一个心软但不算傻的人"。
 */
function clearQueue(run: RunState): void {
  let guard = 0;
  while (run.queue.length > 0 && guard++ < 12) {
    const item = run.queue[0]!;
    const family = FAMILY_BY_ID[item.familyId];
    const variant = family?.variants.find((v) => v.id === item.variantId);
    if (!family || !variant) {
      run.queue.shift();
      continue;
    }
    const tight = daysOfFood(run) < 14;
    const usable = variant.choices.filter((c) => {
      if (!checkRequirement(c.requires, run).ok) return false;
      if (tight) {
        const recruits =
          c.effect?.survivor?.recruit ?? c.check?.ok.survivor?.recruit ?? c.check?.bad.survivor?.recruit;
        if (recruits) return false;
      }
      return true;
    });
    const fallback = variant.choices.filter((c) => checkRequirement(c.requires, run).ok);
    const pick = usable[0] ?? fallback[0] ?? variant.choices[variant.choices.length - 1]!;
    resolveChoice(run, item.familyId, item.variantId, pick.id);
    if (run.phase === 'ended') return;
  }
}

const BASE_ORDER: ModuleId[] = [
  'cistern',
  'filter',
  'garden',
  'insulate',
  'fortify',
  'conceal',
  'power',
  'airFilter',
  'medbay',
  'radio',
];

/** 需要电才转得起来的模块 */
const ELECTRIC: ModuleId[] = ['airFilter', 'filter', 'medbay', 'garden', 'radio'];

/**
 * 灾难揭晓后按它的关键模块重排建造顺序。
 * 这条策略本身就是对"猜灾难"机制的验证：如果适配之后通关率没有明显提升，
 * 说明灾难差异只是换了皮，没有真的改变最优解。
 */
function buildOrder(run: RunState): ModuleId[] {
  if (!run.world.revealed) return BASE_ORDER;
  const key = DISASTER_BY_ID[run.world.disaster].keyModules;
  // 水永远排第一，其余按灾难需要提前
  const head: ModuleId[] = ['cistern', 'filter'];
  const rest = [
    ...key.filter((m) => !head.includes(m)),
    ...BASE_ORDER.filter((m) => !head.includes(m) && !key.includes(m)),
  ];
  // 发电要排在耗电模块前面。火山冬天的 keyModules 是 insulate/airFilter/garden/power，
  // 按原顺序会先把 airFilter 建起来，可它没电就转不动——等于白建。
  if (rest.includes('power') && rest.some((m) => ELECTRIC.includes(m))) {
    return [...head, 'power', ...rest.filter((m) => m !== 'power')];
  }
  return [...head, ...rest];
}

function daysOfWater(run: RunState): number {
  const n = dailyNeeds(run, run.difficulty);
  return n.water > 0 ? run.res.water / n.water : 99;
}
function daysOfFood(run: RunState): number {
  const n = dailyNeeds(run, run.difficulty);
  return n.food > 0 ? (run.res.foodStaple + run.res.foodFresh) / n.food : 99;
}

function goScavenge(run: RunState, prefer: ResourceId[]): boolean {
  const candidates = LOCATIONS.filter((l) => {
    if (l.needsVehicle && !run.hasVehicle) return false;
    const st = run.locations.find((x) => x.id === l.id);
    if ((st?.stock ?? 100) < 25) return false;
    return l.loot.some((e) => prefer.includes(e.res));
  }).sort((a, b) => a.danger - b.danger);
  const loc = candidates[0];
  if (!loc) return false;

  run.ap -= 1;
  // 与 store.scavenge 共用同一份成本：原来这里连燃料都没扣，模拟出来的平衡偏乐观
  const cost = travelCost(run, loc);
  run.stats.stamina = Math.max(0, run.stats.stamina - cost.stamina);
  run.res.fuel = Math.max(0, run.res.fuel - cost.fuel);
  const rng = makeRng(run.seed, run.rngCursor);
  const haul = rollHaul(run, loc.id, false, rng, run.difficulty);
  run.rngCursor = rng.cursor();
  drainLocation(run, loc.id);
  // 按负重上限贪心装
  let cap = run.hasVehicle ? 90 : 22 + run.skills.fitness * 3;
  const picked = [];
  for (const it of [...haul.items].sort((a, b) => a.weight / a.amount - b.weight / b.amount)) {
    const unitW = it.weight / it.amount;
    const take = unitW > 0 ? Math.min(it.amount, cap / unitW) : it.amount;
    if (take <= 0) continue;
    picked.push({ res: it.res, amount: take, weight: take * unitW });
    cap -= take * unitW;
  }
  commitHaul(run, picked);
  return true;
}

function tryBuild(run: RunState): boolean {
  const order = buildOrder(run);
  for (const id of order) {
    if (run.projects.some((p) => p.moduleId === id)) {
      const r = investLabor(run, id, makeRng(run.seed, run.rngCursor));
      if (r.ok) return true;
    }
  }
  for (const id of order) {
    if (nextLevel(run, id) === null) continue;
    if (run.projects.some((p) => p.moduleId === id)) continue;
    if (run.projects.length >= 2) break;
    const opts = buildOptions(run, id);
    const diy = opts.find((o) => o.path === 'diy' && o.available);
    if (diy) {
      const r = startProject(run, id, 'diy');
      if (r.ok) {
        const w = investLabor(run, id, makeRng(run.seed, run.rngCursor));
        return w.ok;
      }
    }
  }
  return false;
}

/**
 * 准备期策略：像一个知道自己要囤 42 天的人那样买。
 * 食物是唯一不会坏、不占容量、也无法后期生产的东西，所以优先级最高；
 * 水受储量上限限制，先建储水再囤水；剩下的钱买建材。
 */
function prepDay(run: RunState): void {
  const daysLeft = TIME.PREP_DAYS - run.day;

  // 建材：够把储水和净水各推一级就行，别把钱全砸在这里
  if (run.ap > 0 && (run.res.materials < 26 || run.res.parts < 18) && run.res.cash > 2500) {
    run.ap -= 1;
    purchase(run, 'hardware', 'materials', 20, false);
    purchase(run, 'hardware', 'parts', 15, false);
  }
  if (run.ap > 0 && run.res.meds < 8 && run.res.cash > 1200) {
    run.ap -= 1;
    purchase(run, 'pharmacy', 'meds', 8, false);
  }
  // 食物与水：每天顶着限购买满，越晚越贵
  if (run.ap > 0) {
    run.ap -= 1;
    purchase(run, 'supermarket', 'foodStaple', 20, false);
    if (daysOfWater(run) < 30) purchase(run, 'supermarket', 'water', 40, false);
  }
  /**
   * 燃料：过冬要用，而物价一天比一天贵，所以每天都补一点，别拖到最后两天。
   *
   * 原来只在最后两天买一次 25 L，结果火山冬天那种长期低温局必然断燃料——
   * 取暖每日都要烧油，25 L 撑不过严冬期。这不是游戏不平衡，是机器人不会过冬。
   */
  if (run.ap > 0 && run.res.fuel < 80 && run.res.cash > 1200) {
    run.ap -= 1;
    purchase(run, 'gasstation', 'fuel', 25, false);
  }
  while (run.ap > 0) {
    if (!tryBuild(run)) break;
  }
  while (run.ap > 0) {
    if (!goScavenge(run, ['materials', 'parts', 'water', 'foodStaple'])) break;
  }
  run.ap = 0;
}

function survivalDay(run: RunState): void {
  // 配给策略：储备越少越省
  const dw = daysOfWater(run);
  const df = daysOfFood(run);
  run.ration = df > 12 ? 'normal' : df > 6 ? 'half' : 'half';
  run.waterUse = dw > 12 ? 'normal' : 'limited';
  // 暴露度高就熄灯
  run.powerMode = run.world.exposure > 45 ? 'blackout' : 'thrifty';

  // 有药就治病
  for (const c of [...run.conditions]) {
    if (run.res.meds >= 4) treatCondition(run, c);
  }

  // 滤芯快没了就换，这比多搜一趟重要
  if (run.ap > 0 && run.wear.filterLife <= 6) {
    const opt = maintenanceOptions(run).find((o) => o.kind === 'filter');
    if (opt?.available) doMaintenance(run, 'filter');
  }

  while (run.ap > 0) {
    if (dw < 4 || df < 4) {
      if (goScavenge(run, ['water', 'foodStaple', 'meds'])) continue;
    }
    if (tryBuild(run)) continue;
    // 燃料也要捡：取暖、发电都要烧它，低温局断油就是失温
    if (goScavenge(run, ['materials', 'parts', 'water', 'foodStaple', 'meds', 'fuel'])) continue;
    // 没事干就休息
    run.ap -= 1;
    run.stats.stamina = Math.min(100, run.stats.stamina + 18);
  }
}

// ============================================================
// 主循环
// ============================================================

/**
 * 全因子采样：6 站点 × 6 灾难，每格跑同样多的局、用同样的一组种子。
 *
 * 原来用同一个 i 决定站点和种子（seed = 1000 + i * 7919，site = SITES[i % 6]），
 * 灾难由 seed 决定、站点由 i%6 决定，两者相关。实测 240 局下 36 个组合每格 1~17 次
 * （期望 6.7），于是「按站点」的通关率里混着灾难难度，两张表无法独立归因。
 * 现在每组都对齐，站点间与灾难间的差异才是真的差异。
 */
const SEEDS_PER_CELL = Math.max(1, Math.round(N / (SITES.length * DISASTERS.length)));

for (let si = 0; si < SITES.length; si++) {
  for (let di = 0; di < DISASTERS.length; di++) {
    for (let k = 0; k < SEEDS_PER_CELL; k++) {
      const site = SITES[si]!;
      const disaster = DISASTERS[di]!;
      // 每格用不同的种子序列，避免各格跑出同一条世界线
      const seed = 1000 + (si * DISASTERS.length + di) * 7919 + k * 104729;
      let run: RunState;
      try {
        run = createRun({
          seed,
          classId: 'clerk',
          packId: 'none',
          difficulty: DIFFICULTY,
          metaPerks: [],
          forceDisaster: disaster.id,
        });
        // 测试台：补足迁入门槛，让六个站点都能被公平地测到
        if (site.cost.cash) run.res.cash += site.cost.cash;
        if (site.cost.requires?.res?.parts) run.res.parts += site.cost.requires.res.parts;
        if (site.cost.requires?.skills?.negotiation) run.skills.negotiation = site.cost.requires.skills.negotiation;
        if (site.cost.requires?.tags?.all?.includes('hasVehicle')) run.hasVehicle = true;
        const r = chooseSite(run, site.id);
        if (!r.ok) chooseSite(run, 'apartment');
      } catch (e) {
        errors.push({ seed, day: 0, message: `创建失败：${(e as Error).message}` });
        continue;
      }

      let cause: string | undefined;
      let guard = 0;
      while (run.phase !== 'ended' && guard++ < 80) {
        try {
          clearQueue(run);
          if (run.phase === 'ended') break;
          if (run.phase === 'collapse') {
            acknowledgeCollapse(run);
            continue;
          }
          if (run.day < TIME.COLLAPSE_DAY) prepDay(run);
          else survivalDay(run);
          const report = endDay(run);
          if (report.cause) cause = report.cause;
        } catch (e) {
          errors.push({ seed, day: run.day, message: (e as Error).message });
          break;
        }
      }

      outcomes.push({
        seed,
        site: run.siteId ?? 'apartment',
        disaster: run.world.disaster,
        days: Math.max(0, run.day - 1),
        threat: run.threat,
        endingId: run.endingId ?? 'unfinished',
        cause,
        finalModules: MODULE_IDS.reduce((s, m) => s + run.modules[m], 0),
        crew: run.survivors.length,
      });
    }
  }
}

// ============================================================
// 报告
// ============================================================

const finished = outcomes.filter((o) => o.endingId !== 'unfinished');
const wins = finished.filter((o) => ENDING_BY_ID[o.endingId]?.kind === 'win');
const avgDays = outcomes.reduce((s, o) => s + o.days, 0) / Math.max(1, outcomes.length);
const avgModules = outcomes.reduce((s, o) => s + o.finalModules, 0) / Math.max(1, outcomes.length);

const pct = (n: number, total: number) => `${((n / Math.max(1, total)) * 100).toFixed(1)}%`;

console.log('');
console.log(`  模拟 ${outcomes.length} 局 · 难度 ${DIFFICULTY} · 策略：及格水平`);
console.log(
  `  全因子采样：${SITES.length} 站点 × ${DISASTERS.length} 灾难 × ${SEEDS_PER_CELL} 组种子（每格 ${SEEDS_PER_CELL} 局）`,
);
if (SEEDS_PER_CELL < 20) {
  console.log(
    `  注：每格 ${SEEDS_PER_CELL} 局，看边际（每站点/每灾难 ${SEEDS_PER_CELL * DISASTERS.length} 局）够了；` +
      `要比较单个组合请加大 N（例如 720 → 每格 20 局）`,
  );
}
console.log('');
console.log(`  通关率        ${pct(wins.length, outcomes.length)}  (${wins.length}/${outcomes.length})`);
console.log(`  平均存活      ${avgDays.toFixed(1)} 天 / ${TIME.FINAL_DAY}`);
console.log(`  平均模块总级  ${avgModules.toFixed(1)} / 30`);
console.log('');

const byDisaster = new Map<string, { n: number; days: number; wins: number }>();
for (const o of outcomes) {
  const cur = byDisaster.get(o.disaster) ?? { n: 0, days: 0, wins: 0 };
  cur.n += 1;
  cur.days += o.days;
  if (ENDING_BY_ID[o.endingId]?.kind === 'win') cur.wins += 1;
  byDisaster.set(o.disaster, cur);
}
console.log('  按灾难（通关率升序）');
for (const [k, v] of [...byDisaster.entries()].sort((a, b) => a[1].wins / a[1].n - b[1].wins / b[1].n)) {
  console.log(`    ${k.padEnd(16)} 平均 ${(v.days / v.n).toFixed(1).padStart(5)} 天   通关 ${pct(v.wins, v.n).padStart(6)}   n=${v.n}`);
}
// 极差用百分点而非倍率：通关率可以是 0，倍率会变成无穷大，没法比较
const dRates = [...byDisaster.values()].map((v) => (v.wins / v.n) * 100);
console.log(
  `    通关率极差 ${(Math.max(...dRates) - Math.min(...dRates)).toFixed(1)} 个百分点` +
    `  (${Math.min(...dRates).toFixed(1)}% ~ ${Math.max(...dRates).toFixed(1)}%)`,
);
console.log('');

const bySite = new Map<string, { n: number; days: number; wins: number }>();
for (const o of outcomes) {
  const cur = bySite.get(o.site) ?? { n: 0, days: 0, wins: 0 };
  cur.n += 1;
  cur.days += o.days;
  if (ENDING_BY_ID[o.endingId]?.kind === 'win') cur.wins += 1;
  bySite.set(o.site, cur);
}
console.log('  按站点（通关率升序）');
for (const [k, v] of [...bySite.entries()].sort((a, b) => a[1].wins / a[1].n - b[1].wins / b[1].n)) {
  console.log(`    ${k.padEnd(16)} 平均 ${(v.days / v.n).toFixed(1).padStart(5)} 天   通关 ${pct(v.wins, v.n).padStart(6)}   n=${v.n}`);
}
const sRates = [...bySite.values()].map((v) => (v.wins / v.n) * 100);
console.log(
  `    通关率极差 ${(Math.max(...sRates) - Math.min(...sRates)).toFixed(1)} 个百分点` +
    `  (${Math.min(...sRates).toFixed(1)}% ~ ${Math.max(...sRates).toFixed(1)}%)`,
);
console.log('');

console.log('  最难的两种灾难，死因构成');
const hardest = [...byDisaster.entries()].sort((a, b) => a[1].days / a[1].n - b[1].days / b[1].n).slice(0, 2);
for (const [disaster] of hardest) {
  const causes = new Map<string, number>();
  for (const o of outcomes.filter((x) => x.disaster === disaster)) {
    const def = ENDING_BY_ID[o.endingId];
    if (!def || def.kind === 'win') continue;
    causes.set(def.subtitle, (causes.get(def.subtitle) ?? 0) + 1);
  }
  const parts = [...causes.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`);
  console.log(`    ${disaster.padEnd(16)} ${parts.join(' · ')}`);
}
console.log('');

const byEnding = new Map<string, number>();
for (const o of outcomes) byEnding.set(o.endingId, (byEnding.get(o.endingId) ?? 0) + 1);
console.log('  结局分布');
for (const [k, v] of [...byEnding.entries()].sort((a, b) => b[1] - a[1])) {
  const def = ENDING_BY_ID[k];
  console.log(`    ${(def ? `${def.name}（${def.subtitle}）` : k).padEnd(24)} ${String(v).padStart(4)}   ${pct(v, outcomes.length)}`);
}
console.log('');

if (errors.length > 0) {
  console.log(`  运行时错误 ${errors.length} 条`);
  const seen = new Set<string>();
  for (const e of errors) {
    if (seen.has(e.message)) continue;
    seen.add(e.message);
    console.log(`    x 第 ${e.day} 天 seed=${e.seed}：${e.message}`);
  }
  console.log('');
  process.exit(1);
}

console.log('  模拟未出现运行时错误。');
console.log('');
