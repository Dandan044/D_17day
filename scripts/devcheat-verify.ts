/**
 * 开发者指令（dandan 彩蛋）的行为验证。
 *
 * 三项效果都必须真的落地，而不是"看起来像是跳过去了"：
 *   1. day === COLLAPSE_DAY 且 phase === 'collapse'（跳天走的必须是 endDay 正规路径，
 *      否则世界气候/暴露度/崩溃报告都还停在 Day 7）
 *   2. 物资满仓：水 = waterCapacity（不是硬编码数字），无上限资源一个大数
 *   3. 建筑满级：每个模块 = site.caps[id]，且"上限制本身"也被抬满了
 *
 * 直接用 tsx 跑：node_modules/tsx/dist/cli.mjs scripts/devcheat-verify.ts
 */

import '../src/game/copy';
import { TIME } from '../src/game/balance';
import { MODULE_IDS } from '../src/game/content/modules';
import { SITE_BY_ID } from '../src/game/content/sites';
import { waterCapacity } from '../src/game/engine/tags';
import { batteryCapacity } from '../src/game/engine/power';
import { createRun } from '../src/game/engine/run';
import { createSession, devCheat, chooseSite } from '../src/game/session';
import type { ModuleId, ResourceId } from '../src/game/types';

let failures = 0;
function check(label: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`  ok   ${label}${detail ? `  (${detail})` : ''}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${detail ? `  (${detail})` : ''}`);
  }
}

const run = createRun({
  seed: 12345,
  classId: 'clerk',
  packId: 'none',
  difficulty: 'normal',
  metaPerks: [],
});
const s = createSession(run);
const siteRes = chooseSite(s, 'apartment');
if (!siteRes.ok) throw new Error('选址失败: ' + siteRes.reason);

console.log('--- 初始状态 ---');
console.log(`  day=${run.day} phase=${run.phase} water=${run.res.water} cash=${run.res.cash}`);

const r = devCheat(s);
console.log('--- devCheat 结果 ---');
check('返回 ok', r.ok, r.reason ?? '');

// ---- 1. 跳天 ----
check('day === COLLAPSE_DAY', run.day === TIME.COLLAPSE_DAY, `day=${run.day}`);
// endDay 走到 day 8 会把 phase 置为 collapse，并算出崩溃报告
check('phase === collapse', run.phase === 'collapse', `phase=${run.phase}`);
check('崩溃报告已生成', !!run.collapseReport);
check('threat 已按 day 8 重算', run.threat === 1, `threat=${run.threat}`);

// ---- 2. 物资满仓 ----
const site = SITE_BY_ID[run.siteId!];
const expectWater = waterCapacity(run);
check(
  'water 等于满容量',
  Math.abs(run.res.water - expectWater) < 0.05,
  `water=${run.res.water} cap=${expectWater}`,
);
check(
  '水箱容量 > 0（上限本身被抬满）',
  expectWater > 0,
  `cap=${expectWater} cistern=${run.modules.cistern}`,
);
for (const k of ['foodStaple', 'foodFresh', 'meds', 'fuel', 'materials', 'parts', 'ammo'] as ResourceId[]) {
  check(`${k} 已拉满`, run.res[k] >= 9999, `${k}=${run.res[k]}`);
}
check('cash 已拉满', run.res.cash >= 999999, `cash=${run.res.cash}`);
check('滤芯耐久回满', run.wear.filterLife === 30, `${run.wear.filterLife}`);
check('发电机油回满', run.wear.generatorOil === 24, `${run.wear.generatorOil}`);
const batteryCap = SITE_BY_ID[run.siteId!] ? batteryCapacity(run) : 0;
check('蓄电池充满（容量上限本身）', run.wear.batteryCharge === batteryCap, `${run.wear.batteryCharge}/${batteryCap}`);
check('HP 回满', run.stats.hp === 100, `${run.stats.hp}`);

// ---- 3. 建筑满级 ----
// 水箱是特例：为了"上限也拉满"，它忽略站点 caps 直接修到硬上限 3。
// 其余模块尊重站点 caps。
for (const id of MODULE_IDS as ModuleId[]) {
  const cap = id === 'cistern' ? 3 : site.caps[id] ?? 3;
  check(`模块 ${id} 达到上限`, run.modules[id] === cap, `${run.modules[id]}/${cap}`);
}
check(
  '公寓水箱突破站点上限（1 → 3）',
  run.modules.cistern === 3 && (site.caps.cistern ?? 3) === 1,
  `cistern=${run.modules.cistern} siteCap=${site.caps.cistern}`,
);
check('工程队列已清空', run.projects.length === 0, `${run.projects.length}`);

console.log(`\n${failures === 0 ? '全部通过' : `${failures} 项失败`}`);
process.exit(failures === 0 ? 0 : 1);
