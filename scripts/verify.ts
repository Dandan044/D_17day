/**
 * 回归测试：存档自愈与 AP 扣费。
 *
 * lint 和 tsc 都管不到「运行时行为」，而这三条 bug 恰恰是行为问题——
 * 类型全对，跑起来照样把玩家的遗物弄丢。所以这里直接打在真实导出的函数上。
 *
 * 用法：npm run verify
 */

import { FAMILY_BY_ID } from '../src/game/content/events';
import { LOCATION_BY_ID } from '../src/game/content/locations';
import { SITE_BY_ID } from '../src/game/content/sites';
import { applyProduction, travelCost } from '../src/game/engine/economy';
import { applyEffect } from '../src/game/engine/effects';
import { startProject } from '../src/game/engine/construction';
import { chooseSite, createRun, endDay, resolveChoice } from '../src/game/engine/run';
import { computePower, deriveFacts } from '../src/game/engine/tags';
import { pruneOrphanQueue, rebuildSettlement } from '../src/game/store';
import { makeRng } from '../src/game/rng';
import type { MetaState, ModuleId, RunState, SiteId } from '../src/game/types';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

const EMPTY_META: MetaState = {
  relics: 0, unlocked: [], perks: [], seenFamilies: [], seenVariants: [],
  seenEndings: [], seenDisasters: [], runsPlayed: 0, bestDays: 0,
  lastClassId: 'clerk', difficulty: 'normal',
};

// ============================================================
console.log('\n  P0-1  结算自愈：ended 存档没有 settlement 时能按 endingId 重建');
// ============================================================
{
  const run = createRun({ seed: 4242, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
  chooseSite(run, 'apartment');
  // 跑到死为止，模拟一局真实结束的存档
  let guard = 0;
  while (run.phase !== 'ended' && guard++ < 80) {
    while (run.queue.length > 0) {
      const q = run.queue[0]!;
      const fam = FAMILY_BY_ID[q.familyId];
      const v = fam?.variants.find((x) => x.id === q.variantId);
      if (!v) { run.queue.shift(); continue; }
      const last = v.choices[v.choices.length - 1]!;
      resolveChoice(run, q.familyId, q.variantId, last.id);
      if (run.phase === 'ended') break;
    }
    if (run.phase === 'ended') break;
    run.ap = 0;
    endDay(run);
  }

  check('跑出了一个已结束的存档', run.phase === 'ended', `phase=${run.phase} day=${run.day}`);
  check('endingId 已写入', !!run.endingId, `endingId=${run.endingId}`);

  // 走真实的自愈函数，不是复刻一份逻辑
  const rebuilt = rebuildSettlement(run, EMPTY_META);
  check('能重建出 settlement', !!rebuilt, rebuilt ? `遗物 ${rebuilt.relics}` : '重建失败');
  check('重建结果非空遗物', !!rebuilt && rebuilt.relics > 0, rebuilt ? `${rebuilt.relics} 遗物` : '');
  check('结局与 endingId 一致', rebuilt?.ending.id === run.endingId, `${rebuilt?.ending.id} vs ${run.endingId}`);
}

// ============================================================
console.log('\n  P0-2  队列清理：无效条目会被剔除，玩家不会卡死');
// ============================================================
{
  const run: RunState = createRun({ seed: 777, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
  chooseSite(run, 'apartment');
  run.queue = [
    { familyId: 'nonexistent_family', variantId: 'whatever' },
    { familyId: 'daily_maintenance', variantId: 'no_such_variant' },
  ];

  const before = run.queue.length;
  const dropped = pruneOrphanQueue(run);

  check('两条无效条目都被剔除', before === 2 && dropped === 2 && run.queue.length === 0,
    `剔除 ${dropped}/${before}`);
  check('清理后队列为空，可以结束当天', run.queue.length === 0);

  // 反向：有效条目必须保留
  const fam = Object.values(FAMILY_BY_ID)[0]!;
  const v = fam.variants[0]!;
  const run2: RunState = createRun({ seed: 778, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
  chooseSite(run2, 'apartment');
  run2.queue = [{ familyId: fam.id, variantId: v.id }];
  const dropped2 = pruneOrphanQueue(run2);
  check('有效条目不会被误删', dropped2 === 0 && run2.queue.length === 1, `剔除 ${dropped2}，保留 ${run2.queue.length}/1`);
}

// ============================================================
console.log('\n  P0-3  AP 假收费：选项声明的成本现在会真扣');
// ============================================================
{
  const run: RunState = createRun({ seed: 999, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
  chooseSite(run, 'apartment');
  const rng = makeRng(1);
  const apBefore = run.ap;
  applyEffect(run, { ap: -1, log: '测试', tone: 'neutral' }, rng);
  check('effect.ap 会扣除行动点', run.ap === apBefore - 1, `${apBefore} -> ${run.ap}`);

  const low: RunState = createRun({ seed: 1000, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
  chooseSite(low, 'apartment');
  low.ap = 0;
  applyEffect(low, { ap: -1, log: '测试', tone: 'neutral' }, rng);
  check('AP 不会被扣成负数', low.ap === 0, `ap=${low.ap}`);

  applyEffect(low, { ap: 2, log: '测试', tone: 'neutral' }, rng);
  check('正 ap 能返还行动点', low.ap === 2, `ap=${low.ap}`);

  // 内容层抽查：那 23 处现在都带着 ap
  const { ALL_FAMILIES } = await import('../src/game/content/events');
  let declared = 0;
  let honored = 0;
  for (const f of ALL_FAMILIES) {
    for (const v of f.variants) {
      for (const c of v.choices) {
        if (c.requires?.ap === undefined) continue;
        declared++;
        const effs = c.check ? [c.check.ok, c.check.bad] : c.effect ? [c.effect] : [];
        if (effs.length > 0 && effs.every((e) => e.ap !== undefined)) honored++;
      }
    }
  }
  check('内容层所有 requires.ap 都有对应扣除', declared === honored && declared > 0,
    `${honored}/${declared} 处已兑现`);
}

// ============================================================
console.log('\n  P1-1  施工期劣化：buildPenaltyTags 真的被读取并生效');
// ============================================================
{
  // 工装：给足资源，好让任何模块都能开工
  const mk = (mod: ModuleId) => {
    const r = createRun({ seed: 31337, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
    chooseSite(r, 'apartment');
    r.res.materials = 500;
    r.res.parts = 500;
    r.res.cash = 999999;
    r.day = 12;
    startProject(r, mod, 'diy');
    return r;
  };

  // 判据：power 模块配了 ["building:power","power:blackout"]。
  // 以前引擎是硬编码拼 building:${id}，第二个标签永远注入不进来。
  const powerRun = mk('power');
  const pf = deriveFacts(powerRun);
  check('power 施工会打上 power:blackout', pf.flags.has('power:blackout'),
    `flags=${[...pf.flags].filter((x) => x.startsWith('building') || x === 'power:blackout').join(',')}`);

  // 且这个标签要真的断电，不只是个好看的名字
  if (powerRun.projects.some((p) => p.moduleId === 'power')) {
    const rep = computePower(powerRun);
    check('power:blackout 让全屋断电（output 归零）', rep.output === 0, `output=${rep.output}`);
  }

  // 对照：别的模块施工不该顺带断电
  const filterRun = mk('filter');
  check('filter 施工不会误伤电力', !deriveFacts(filterRun).flags.has('power:blackout'));

  // cistern：施工期间净水暂停（原本承诺的「容量归零」会让存量被悄悄倒掉，不采用）
  // 要给 filter 一个等级，否则净水本来就不产出，测不出"暂停"
  const cisternRun = mk('cistern');
  cisternRun.modules.filter = 1;
  cisternRun.wear.filterLife = 30;
  const before = cisternRun.res.water;
  const notes = applyProduction(cisternRun);
  const paused = notes.some((n) => n.includes('净水停了一天'));
  check('cistern 施工时净水暂停', paused, notes.filter((n) => n.includes('水')).join(' / ') || '无相关提示');
  check('cistern 施工不会倒掉已有存水', cisternRun.res.water >= before - 0.01,
    `${before} -> ${cisternRun.res.water}`);

  // 对照组：cistern 没在施工时，净水照常
  const normalRun = mk('filter');
  normalRun.projects = [];
  normalRun.modules.filter = 1;
  normalRun.wear.filterLife = 30;
  const w0 = normalRun.res.water;
  const notes2 = applyProduction(normalRun);
  check('cistern 未施工时净水正常产出', normalRun.res.water > w0 && !notes2.some((n) => n.includes('净水停了一天')),
    `${w0} -> ${normalRun.res.water}`);
}

// ============================================================
console.log('\n  P1-2  站点出行成本：travelFuel / travelStamina 生效');
// ============================================================
{
  const costOf = (siteId: SiteId) => {
    const r = createRun({ seed: 5150, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
    const site = SITE_BY_ID[siteId];
    // 补足迁入门槛，否则 chooseSite 失败后会退回 apartment，测出来全是公寓的成本
    if (site.cost.cash) r.res.cash += site.cost.cash;
    if (site.cost.requires?.res?.parts) r.res.parts += site.cost.requires.res.parts;
    if (site.cost.requires?.tags?.all?.includes('hasVehicle')) r.hasVehicle = true;
    const ok = chooseSite(r, siteId);
    if (!ok.ok) throw new Error(`测试台无法迁入 ${siteId}：${ok.reason}`);
    return travelCost(r, LOCATION_BY_ID['supermarket']!);
  };
  const apt = costOf('apartment');
  const farm = costOf('farmhouse');
  check('公寓近处不耗燃料（文案承诺「外出不耗燃料」）', apt.fuel === 0, `fuel=${apt.fuel}`);
  check('农舍每趟要烧油（文案承诺「每趟烧 2.5 L」）', farm.fuel >= 2.5, `fuel=${farm.fuel}`);
  check('农舍出行体力高于公寓', farm.stamina > apt.stamina, `${apt.stamina} vs ${farm.stamina}`);
  check('站点间出行成本确有差异', farm.fuel !== apt.fuel && farm.stamina !== apt.stamina);
}

console.log(`\n  结果：${pass} 通过 · ${fail} 失败\n`);
process.exit(fail > 0 ? 1 : 0);
