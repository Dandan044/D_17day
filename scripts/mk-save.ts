/**
 * 造存档：给 `scripts/cdp-shot.mjs` 用，好在真实页面里直接落在某个浮层上。
 *
 * 为什么不靠点击走进去：进一局要点「开始 → 选出身 → 选物资 → 选据点」四屏，
 * 每屏的选择器都会随 UI 改版变，脚本脆得没法维护。造一份存档写进 localStorage
 * 再 reload，路径短且与 UI 解耦。
 *
 * 用法（一次生成全部场景）：
 *   npx tsx scripts/mk-save.ts
 * 产物目录：`.preview/saves/*.json`，每个文件都是 `{ run, meta }`。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ensureRunDefaults } from '../src/game/engine/power';
import { createRun } from '../src/game/engine/run';
import type { ConditionId, LogEntry, RunState } from '../src/game/types';

const OUT = join(process.cwd(), '.preview', 'saves');

interface Save {
  run: RunState;
  meta: Record<string, unknown>;
}

/** 起一局干净的，再把要验的那些字段按场景覆盖掉。 */
function base(over: Partial<RunState>): RunState {
  const r = createRun({
    seed: 20260921,
    classId: 'clerk',
    packId: 'none',
    difficulty: 'normal',
    metaPerks: [],
    forceDisaster: 'nuclear',
  });
  Object.assign(r, over);
  ensureRunDefaults(r);
  return r;
}

const EMPTY_META = {
  seenVariants: [],
  seenFamilies: [],
  seenEndings: [],
  seenDisasters: [],
  perks: [],
  unlocked: [],
};

/** 疾病 + 病程。病程写真实数字，图上「同强度时病程久的排前面」这条排序才验得到。 */
const SICK: Array<[ConditionId, number]> = [
  ['dehydrationSevere', 3],
  ['hypothermiaSevere', 2],
  ['pneumonia', 4],
  ['woundInfection', 2],
  ['fracture', 5],
  ['wound', 1],
  ['thirst', 1],
  ['despair', 6],
];

/**
 * 日志场景的条目。
 *
 * 四种 tone 都要出现：格子右下那排点的颜色、右侧条目的左邻线、图例三者
 * 共用同一份色表，缺一种就有一格查不到色（会回落到灰，静默看不出错）。
 * 第 1–7 天与第 8 天之后各写几条——标题上的「D-n 角标」只画在灾前。
 */
const LOG: LogEntry[] = [
  { day: 1, tone: 'neutral', text: '搬进来了。屋里比外面安静，也比外面冷。' },
  { day: 1, tone: 'good', text: '楼下五金店还没关，买下两卷胶带。' },
  { day: 2, tone: 'neutral', text: '把窗框四周的缝都堵了一遍。' },
  { day: 3, tone: 'bad', text: '水管冻住了，一整天没水。' },
  { day: 4, tone: 'neutral', text: '收音机里说北边的路封了。' },
  { day: 4, tone: 'grim', text: '巷口那一家，整天没动静。' },
  { day: 5, tone: 'good', text: '淘到一整箱罐头。' },
  { day: 6, tone: 'bad', text: '发起烧来。扛了一天。' },
  { day: 7, tone: 'grim', text: '天上一道亮线之后，什么都没再响。' },
  { day: 8, tone: 'grim', text: '灰落下来了，落在窗台上，扫不掉。' },
  { day: 9, tone: 'neutral', text: '把新的滤芯换上去。' },
  { day: 10, tone: 'bad', text: '有人在门口站了很久。' },
  { day: 11, tone: 'good', text: '电池组撑住了夜里的供暖。' },
  { day: 12, tone: 'neutral', text: '一整天没出门。' },
];

const CASES: Array<{ file: string; run: RunState }> = [  {
    file: 'body-clean.json',
    // 灾后、无病：验证空态（人体只有线、颅环墨色、暴露度面板在）
    run: base({
      phase: 'survival',
      day: 11,
      threat: 2,
      stats: { hp: 88, stamina: 61, sanity: 74, humanity: 63, reputation: 41 } as RunState['stats'],
      world: { ...base({}).world, exposure: 34 },
    }),
  },
  {
    file: 'body-sick.json',
    // 多病 + 低理智 + 高暴露：一次压满人体图、颅环转红、眼睛睁到 4 档
    run: base({
      phase: 'survival',
      day: 14,
      threat: 3,
      stats: { hp: 41, stamina: 23, sanity: 9, humanity: 12, reputation: 58 } as RunState['stats'],
      conditions: SICK.map(([id]) => id),
      conditionAge: Object.fromEntries(SICK) as RunState['conditionAge'],
      modules: { ...base({}).modules, medbay: 2 },
      res: { ...base({}).res, meds: 4 },
      world: { ...base({}).world, exposure: 79 },
    }),
  },
  {
    file: 'body-prep.json',
    // 灾前：暴露度分区整块不出现，人体图应只有线（准备期不该有病）
    run: base({
      phase: 'prep',
      day: 3,
      threat: 0,
      stats: { hp: 96, stamina: 84, sanity: 88, humanity: 70, reputation: 50 } as RunState['stats'],
      conditions: ['thirst'],
      conditionAge: { thirst: 1 },
    }),
  },
  {
    file: 'body-dangling.json',
    // 旧档悬空 id：必须有「N 项状态无法识别」，且不能白屏
    run: base({
      phase: 'survival',
      day: 10,
      threat: 2,
      stats: { hp: 70, stamina: 55, sanity: 46, humanity: 50, reputation: 45 } as RunState['stats'],
      conditions: ['zzz_removed_condition', 'pneumonia'] as unknown as ConditionId[],
      conditionAge: { pneumonia: 2 },
      world: { ...base({}).world, exposure: 51 },
    }),
  },
  {
    file: 'log-rich.json',
    // 灾后第 13 天：13 格 = 两整行；12 天全划掉、今天双圈、点阵四色齐全
    run: base({
      phase: 'survival',
      day: 13,
      threat: 3,
      stats: { hp: 62, stamina: 48, sanity: 55, humanity: 47, reputation: 52 } as RunState['stats'],
      log: LOG.slice(0, 13),
      world: { ...base({}).world, exposure: 44 },
    }),
  },
  {
    file: 'log-prep.json',
    // 灾前第 4 天：格子上要出 D-7…D-4 角标，且没有跨过崩溃日的灰字条目
    run: base({
      phase: 'prep',
      day: 4,
      threat: 0,
      stats: { hp: 94, stamina: 80, sanity: 86, humanity: 68, reputation: 50 } as RunState['stats'],
      log: LOG.slice(0, 5),
    }),
  },
  {
    file: 'map-prep.json',
    // 灾前：只列 prepShop 那 7 处；危险度整列不出（钉子统一「可采购」色）
    run: base({
      phase: 'prep',
      day: 3,
      threat: 0,
      stats: { hp: 95, stamina: 82, sanity: 88, humanity: 70, reputation: 50 } as RunState['stats'],
      ap: 3,
    }),
  },
  {
    file: 'map-out.json',
    // 灾后第 12 天：钉子按危险度上色，一处设卡、两处今日已去过、一处存量见底
    run: base({
      phase: 'survival',
      day: 12,
      threat: 3,
      ap: 2,
      stats: { hp: 71, stamina: 52, sanity: 58, humanity: 49, reputation: 47 } as RunState['stats'],
      locations: [
        { id: 'supermarket', stock: 0, searchedDay: 12 },
        { id: 'hardware', stock: 64 },
        { id: 'pharmacy', stock: 41 },
        { id: 'gasstation', stock: 88, blocked: '路障' },
        { id: 'outdoor', stock: 22 },
        { id: 'blackmarket', stock: 73, searchedDay: 12 },
        { id: 'bank', stock: 12 },
        { id: 'school', stock: 55 },
        { id: 'hospital', stock: 90 },
        { id: 'warehouse', stock: 97 },
        { id: 'servicearea', stock: 35 },
      ] as RunState['locations'],
      visitedToday: ['supermarket', 'blackmarket'],
      hasVehicle: true,
      world: { ...base({}).world, exposure: 38 },
    }),
  },
  {
    file: 'items-full.json',
    // 三槽都有东西：滤芯 4 支（超上限 → 出 +1 角标）、报警器在装、碘片 2 盒且正在生效
    run: base({
      phase: 'survival',
      day: 12,
      threat: 3,
      stats: { hp: 68, stamina: 51, sanity: 57, humanity: 46, reputation: 49 } as RunState['stats'],
      items: { filter: 4 },
      wear: { filterLife: 18 },
      flags: ['flag:coAlarm', 'flag:iodine', 'flag:iodineStock2'],
      iodineUntil: 15,
      world: { ...base({}).world, exposure: 42 },
    }),
  },
  {
    file: 'items-empty.json',
    // 三槽全空：凹槽走虚线空态，两个按钮都该是禁用的
    run: base({
      phase: 'survival',
      day: 10,
      threat: 2,
      stats: { hp: 77, stamina: 60, sanity: 63, humanity: 52, reputation: 50 } as RunState['stats'],
      items: { filter: 0 },
      wear: { filterLife: 0 },
    }),
  },
  {
    file: 'items-prep.json',
    // 灾前第 4 天：碘片 1 盒但还没到吃的时机 → 出「现在还用不上」，服用键禁用；滤芯键仍可用
    run: base({
      phase: 'prep',
      day: 4,
      threat: 0,
      stats: { hp: 94, stamina: 81, sanity: 87, humanity: 69, reputation: 50 } as RunState['stats'],
      items: { filter: 2 },
      wear: { filterLife: 30 },
      flags: ['flag:iodineStock1'],
    }),
  },
  {
    file: 'shelf-full.json',
    // 三格水位表都满得像样：水约 8 成、口粮成堆、蓄电过半；另存物资六项都有数
    run: base({
      phase: 'survival',
      day: 12,
      threat: 2,
      ap: 2,
      siteId: 'apartment', // 水箱倍率 0.75 → 3 级水箱容量 84×0.75 = 63
      modules: { ...base({}).modules, cistern: 3, power: 3, filter: 2, radio: 1 },
      wear: { filterLife: 22, generatorOil: 40, batteryCharge: 14.2 },
      res: {
        ...base({}).res,
        water: 48.5,
        foodStaple: 42,
        foodFresh: 8.4,
        meds: 6,
        fuel: 18.5,
        materials: 24,
        parts: 7,
        ammo: 12,
        cash: 340,
      },
      stats: { hp: 73, stamina: 55, sanity: 61, humanity: 50, reputation: 48 } as RunState['stats'],
      world: { ...base({}).world, exposure: 36 },
    }),
  },
  {
    file: 'shelf-thin.json',
    // 见底：三格填色都该明显更低，水与口粮的两天以内 → 读数转告警色
    run: base({
      phase: 'survival',
      day: 12,
      threat: 3,
      ap: 1,
      siteId: 'apartment',
      modules: { ...base({}).modules, cistern: 3, power: 3 },
      wear: { filterLife: 3, generatorOil: 2, batteryCharge: 1.1 },
      res: { ...base({}).res, water: 3.2, foodStaple: 2, foodFresh: 0.5, meds: 0, fuel: 0, cash: 5 },
      stats: { hp: 44, stamina: 30, sanity: 38, humanity: 40, reputation: 44 } as RunState['stats'],
      world: { ...base({}).world, exposure: 62 },
    }),
  },
  {
    file: 'shelf-prep.json',
    // 灾前：水箱只 1 级、发电机 1 级；告警色整块不亮（自来水还在供、超市还开着）
    // ⚠️ 据点只能用 apartment —— 其余五个都带 `wip`，App.tsx 加载时会把它们踢回选址屏。
    run: base({
      phase: 'prep',
      day: 3,
      threat: 0,
      ap: 3,
      siteId: 'apartment', // 水箱倍率 0.75 → 1 级水箱容量 36×0.75 = 27
      modules: { ...base({}).modules, cistern: 1, power: 1 },
      wear: { filterLife: 30, batteryCharge: 0 },
      res: { ...base({}).res, water: 18.4, foodStaple: 6, foodFresh: 3, cash: 210 },
      stats: { hp: 95, stamina: 83, sanity: 88, humanity: 70, reputation: 50 } as RunState['stats'],
    }),
  },
];

mkdirSync(OUT, { recursive: true });
for (const c of CASES) {
  const save: Save = { run: c.run, meta: EMPTY_META };
  writeFileSync(join(OUT, c.file), JSON.stringify(save, null, 2), 'utf8');
  console.log(
    `${c.file.padEnd(22)} day=${c.run.day} phase=${c.run.phase} 病 ${c.run.conditions.length} 项 · 暴露 ${Math.round(c.run.world.exposure)} · 理智 ${c.run.stats.sanity}`,
  );
}
console.log(`\n→ ${OUT}`);
