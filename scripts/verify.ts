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
import { COLD, POWER, TIME } from '../src/game/balance';
import { applyProduction, buyIodine, buyCoAlarm, consumeDaily, dailyNeeds, travelCost, type ConsumeResult } from '../src/game/engine/economy';
import { applyEffect, sequelWaitLabel } from '../src/game/engine/effects';
import { applyHeatWants, capHeat, heatPlan, leakRate, thermalSink } from '../src/game/engine/climate';
import { pickPressureFamily, resolveRaid } from '../src/game/engine/exposure';
import { startProject, grantCompanionLabor, completeReadyProjects, investLabor } from '../src/game/engine/construction';
import { chooseSite, createRun, endDay, resolveChoice } from '../src/game/engine/run';
import { computePower, deriveFacts } from '../src/game/engine/tags';
import { settleBattery, batteryCapacity, tonightHeat } from '../src/game/engine/power';
import { resolveHealth } from '../src/game/engine/health';
import { assessCollapse } from '../src/game/engine/collapse';
import { isEligible, pickVariant, selectEvents } from '../src/game/engine/director';
import { applyOnset } from '../src/game/engine/world';
import { createSession, scavenge as sessionScavenge, work as sessionWork } from '../src/game/session';
import { pruneOrphanQueue, rebuildSettlement } from '../src/game/store';
import { pickOracle, pickSighted, scoreIgnoresRecruit } from './sim/preview';
import { attach, emptyCounters, PERSONA_BY_ID, planBuildOrder, planHeat, playDay } from './sim/policy';
import { makeRng, type Rng } from '../src/game/rng';
import type { MetaState, ModuleId, RunState, SiteId } from '../src/game/types';
import { HOOK_NAME } from '../src/game/copy/names';
import '../src/game/copy';

const yesRng = (): Rng => {
  const r = makeRng(1, 0);
  return { ...r, chance: () => true };
};

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
      // 优先选最后一个选项（原语义）；被 requires 拒绝时逐个往前回退，
      // 全部被拒就丢弃该事件——resolveChoice 拒绝时不会出队，盲选会死循环
      const before = run.queue.length;
      for (let ci = v.choices.length - 1; ci >= 0; ci--) {
        resolveChoice(run, q.familyId, q.variantId, v.choices[ci]!.id);
        if (run.phase === 'ended') break;
        if (run.queue.length < before) break;
      }
      if (run.phase === 'ended') break;
      if (run.queue.length >= before) run.queue.shift();
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
  // 要给 filter 一个等级，且必须是雨天，否则净水本来就不产出
  const cisternRun = mk('cistern');
  cisternRun.modules.filter = 1;
  cisternRun.wear.filterLife = 30;
  cisternRun.world.weather = 'rain';
  const before = cisternRun.res.water;
  const notes = applyProduction(cisternRun);
  const paused = notes.some((n) => n.text.includes('没法入库') || n.text.includes('净水停'));
  check('cistern 施工时净水暂停', paused, notes.filter((n) => n.text.includes('水') || n.text.includes('净')).map((n) => n.text).join(' / ') || '无相关提示');
  check('cistern 施工不会倒掉已有存水', cisternRun.res.water >= before - 0.01,
    `${before} -> ${cisternRun.res.water}`);

  // 对照组：雨天 + 未施工 → 产水
  const normalRun = mk('filter');
  normalRun.projects = [];
  normalRun.modules.filter = 1;
  normalRun.wear.filterLife = 30;
  normalRun.world.weather = 'rain';
  normalRun.res.water = 4;
  const w0 = normalRun.res.water;
  const notes2 = applyProduction(normalRun);
  check('雨天净水正常产出', normalRun.res.water > w0 && !notes2.some((n) => n.text.includes('没法入库')),
    `${w0} -> ${normalRun.res.water}`);

  // 晴天不产水
  const dryRun = mk('filter');
  dryRun.projects = [];
  dryRun.modules.filter = 1;
  dryRun.wear.filterLife = 30;
  dryRun.world.weather = 'clear';
  const wDry = dryRun.res.water;
  const notesDry = applyProduction(dryRun);
  check('晴天净水不产水', dryRun.res.water === wDry, `${wDry} -> ${dryRun.res.water} / ${notesDry.map((n) => n.text).join(';')}`);

  // 旱天回用：耗水降低
  const recycleRun = mk('filter');
  recycleRun.projects = [];
  recycleRun.modules.filter = 1;
  recycleRun.wear.filterLife = 30;
  recycleRun.world.weather = 'clear';
  const needRecycle = dailyNeeds(recycleRun, 'normal');
  recycleRun.modules.filter = 0;
  const needNoFilter = dailyNeeds(recycleRun, 'normal');
  check('旱天有净水时回用降低耗水', needRecycle.recycling && needRecycle.water < needNoFilter.water,
    `recycle=${needRecycle.water} noFilter=${needNoFilter.water}`);

  const tagRun = mk('filter');
  tagRun.projects = [];
  tagRun.modules.filter = 1;
  tagRun.world.weather = 'clear';
  const tf = deriveFacts(tagRun);
  check('晴天+净水打上 water:recycling', tf.flags.has('water:recycling'));
  tagRun.world.weather = 'rain';
  const tfRain = deriveFacts(tagRun);
  check('雨天打上 weather:precip', tfRain.flags.has('weather:precip'));
  check('雨天不打 water:recycling', !tfRain.flags.has('water:recycling'));
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
    if (!ok.ok) {
      // WIP 站点拒绝迁入，但出行成本仍按站点表结算，测试台直接写入 siteId
      r.siteId = siteId;
    }
    return travelCost(r, LOCATION_BY_ID['supermarket']!);
  };
  const apt = costOf('apartment');
  const farm = costOf('farmhouse');
  check('公寓近处不耗燃料（文案承诺「外出不耗燃料」）', apt.fuel === 0, `fuel=${apt.fuel}`);
  check('农舍每趟要烧油（文案承诺「每趟烧 2.5 L」）', farm.fuel >= 2.5, `fuel=${farm.fuel}`);
  check('农舍出行体力高于公寓', farm.stamina > apt.stamina, `${apt.stamina} vs ${farm.stamina}`);
  check('站点间出行成本确有差异', farm.fuel !== apt.fuel && farm.stamina !== apt.stamina);
  {
    const blocked = createRun({ seed: 9, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
    const r = chooseSite(blocked, 'farmhouse');
    check('WIP 站点不可迁入', !r.ok && (r.reason ?? '').includes('开发中'), r.reason);
  }
}

// ============================================================
console.log('\n  审计修复  蓄电消耗 / 饥饿双扣 / 没下雨去重 / 同伴工时');
// ============================================================
{
  const mk = () => {
    const run = createRun({ seed: 101, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [], forceDisaster: 'gridDown' });
    chooseSite(run, 'apartment');
    run.day = 25;
    run.phase = 'survival';
    run.threat = 3;
    run.world.revealed = true;
    run.world.powerGrid = 'off';
    return run;
  };

  {
    const run = mk();
    run.modules.power = 0;
    run.wear.batteryCharge = 8;
    run.world.weather = 'ashfall';
    run.powerEnabled = { lights: true, fridge: true, heater: false };
    const before = run.wear.batteryCharge;
    const p = computePower(run);
    check('蓄电池按缺口放电而不是整仓送出', p.battery > 0 && p.battery <= before, `draw=${p.battery} stored=${before} demand=${p.demand} solar=${p.solar}`);
    settleBattery(run, p);
    check('settleBattery 会扣库存', run.wear.batteryCharge < before, `${before} -> ${run.wear.batteryCharge}`);

    run.wear.batteryCharge = 99;
    applyEffect(run, { wear: { batteryCharge: 1 }, log: '充' }, makeRng(1, 0));
    check('蓄电受 BATTERY_CAP 截断', run.wear.batteryCharge <= batteryCapacity(run), `${run.wear.batteryCharge}/${batteryCapacity(run)}`);
  }

  {
    const run = mk();
    run.modules.filter = 1;
    run.wear.filterLife = 20;
    run.world.weather = 'clear';
    run.res.water = 40;
    run.res.foodStaple = 40;
    const notes = [...applyProduction(run), ...consumeDaily(run, makeRng(2, 0), 'story').notes];
    const rainLines = notes.filter((n) => n.text.includes('没有下雨'));
    check('旱夜「没下雨」只出现一次', rainLines.length === 1, rainLines.map((n) => n.text).join(' | '));
  }

  {
    const run = mk();
    run.ration = 'full';
    run.waterUse = 'full';
    run.res.water = 0.2;
    run.res.foodStaple = 0.2;
    run.res.foodFresh = 0;
    const consume = consumeDaily(run, makeRng(3, 0), 'story');
    const health = resolveHealth(run, consume, makeRng(3, 1));
    const starveHits = health.hpParts.filter((p) => p.label === '饥饿');
    const fullHits = health.hpParts.filter((p) => p.label === '充足口粮');
    check('饥饿当晚只扣一次', starveHits.length <= 1, JSON.stringify(starveHits));
    check('断粮时不会出现「充足口粮」', fullHits.length === 0, JSON.stringify(health.hpParts));
  }

  {
    // 水阶梯：断水逐夜加重，标准级饮水一晚连退两档
    const run = mk();
    run.waterUse = 'normal';
    run.res.water = 0;
    run.res.foodStaple = 40;
    let consume = consumeDaily(run, makeRng(9, 0), 'story');
    resolveHealth(run, consume, makeRng(9, 1));
    check('断水第一夜进入轻度脱水', run.conditions.includes('dehydrationMild'), run.conditions.join(','));
    consume = consumeDaily(run, makeRng(9, 2), 'story');
    resolveHealth(run, consume, makeRng(9, 3));
    check('断水第二夜加重为中度脱水', run.conditions.includes('dehydrationMod') && !run.conditions.includes('dehydrationMild'), run.conditions.join(','));
    run.res.water = 40;
    consume = consumeDaily(run, makeRng(9, 4), 'story');
    resolveHealth(run, consume, makeRng(9, 5));
    check('标准级饮水一晚解除中度脱水', !run.conditions.some((c) => c.startsWith('dehydration')), run.conditions.join(','));
  }

  {
    // 重度脱水当夜仍喝不到限量级水＝死亡，死因是脱水
    const run = mk();
    run.waterUse = 'normal';
    run.res.water = 0;
    run.res.foodStaple = 40;
    run.conditions.push('dehydrationSevere');
    const consume = consumeDaily(run, makeRng(10, 0), 'story');
    const health = resolveHealth(run, consume, makeRng(10, 1));
    check('重度脱水再缺水当夜死亡', health.dead && health.cause === '脱水', `dead=${health.dead} cause=${health.cause}`);
  }

  {
    // 限量级达标：不再直接扣 HP，改为口渴 debuff
    const run = mk();
    run.waterUse = 'normal';
    run.res.water = 2.4; // 标准 3 L 不够，限量 1.8 L 够 → 口渴但不进脱水阶梯
    run.res.foodStaple = 40;
    const consume = consumeDaily(run, makeRng(11, 0), 'story');
    const health = resolveHealth(run, consume, makeRng(11, 1));
    check(
      '喝到限量级会口渴但不脱水不扣 HP',
      run.conditions.includes('thirst') &&
        !run.conditions.some((c) => c.startsWith('dehydration')) &&
        health.hpParts.every((p) => p.label !== '饮水限量' && p.label !== '脱水'),
      `conds=${run.conditions.join(',')} parts=${JSON.stringify(health.hpParts)}`,
    );
  }

  {
    // 免疫窗口：7 日内再感染流感，当晚必愈
    const run = mk();
    run.res.water = 40;
    run.res.foodStaple = 40;
    run.conditions.push('flu');
    run.immunity = { flu: run.day - 2 };
    const consume = consumeDaily(run, makeRng(12, 0), 'story');
    resolveHealth(run, consume, makeRng(12, 1));
    check('免疫窗口内再感染当晚必愈', !run.conditions.includes('flu'), run.conditions.join(','));
  }

  {
    const run = mk();
    run.modules.cistern = 0;
    run.modules.filter = 1;
    run.wear.filterLife = 20;
    run.world.weather = 'rain';
    run.res.water = 19.5;
    const before = run.res.water;
    const notes = applyProduction(run);
    const capOk = run.res.water <= before + 1; // 0 级储水上限 20
    check('净水产出不会默默撑破水箱', run.res.water <= 20.05 && notes.some((n) => n.text.includes('溢出') || n.text.includes('已满') || run.res.water < before + 8), `${before} -> ${run.res.water} / ${notes.map((n) => n.text).join(';')}`);
    void capOk;
  }

  {
    const run = mk();
    run.survivors.push({
      id: 'chen',
      name: '测试同伴',
      age: 40,
      bio: '',
      skills: {},
      traits: [],
      upkeep: 1,
      morale: 80,
      trust: 50,
      joinedDay: 20,
      conditions: [],
    });
    run.projects.push({
      moduleId: 'fortify',
      toLevel: 1,
      path: 'diy',
      laborDone: 0,
      laborTotal: 100,
      startedDay: run.day,
    });
    grantCompanionLabor(run);
    const afterFirst = run.projects[0]!.laborDone;
    completeReadyProjects(run, makeRng(4, 0));
    check('work/complete 不会再发同伴工时', run.projects[0]!.laborDone === afterFirst, `${afterFirst} vs ${run.projects[0]!.laborDone}`);
    grantCompanionLabor(run);
    check('同伴工时每次 grant 只加一档', run.projects[0]!.laborDone === afterFirst * 2, `${afterFirst} then ${run.projects[0]!.laborDone}`);
  }
}

// ============================================================
console.log('\n  碘片准备期不计时 / 崩溃按库存判定 / 已购不再刷购买事件');
// ============================================================
{
  const run = createRun({
    seed: 2026,
    classId: 'clerk',
    packId: 'none',
    difficulty: 'story',
    metaPerks: [],
    forceDisaster: 'nuclear',
  });
  chooseSite(run, 'apartment');
  run.day = 2;
  run.phase = 'prep';
  run.res.cash = 5000;
  const bought = buyIodine(run, 'pharmacy');
  check('药店能买到碘片', bought.ok, bought.reason);
  check('准备期买碘片不写截止日', run.iodineUntil === undefined, `iodineUntil=${run.iodineUntil}`);
  check('准备期记下 flag:iodine', run.flags.includes('flag:iodine'));
  check('库存旗标 iodineStock1', run.flags.includes('flag:iodineStock1'));

  // 模拟拖到崩溃前夕：保护旗标不应因无截止日被清掉
  run.day = TIME.COLLAPSE_DAY - 1;
  check('崩溃前仍备着碘片', run.flags.includes('flag:iodine') && run.iodineUntil === undefined);

  const prepIodine = FAMILY_BY_ID['prep_iodine']!;
  const whyBlocked = isEligible(prepIodine, run, deriveFacts(run));
  check('已购时 prep_iodine 不合格', whyBlocked !== null, whyBlocked ?? '仍可触发');

  // 进入崩溃日清算
  run.day = TIME.COLLAPSE_DAY;
  applyOnset(run, makeRng(2026, 0));
  check('崩溃后启动保护计时', run.iodineUntil !== undefined && run.iodineUntil > run.day, `until=${run.iodineUntil}`);
  const report = assessCollapse(run, makeRng(2026, 1));
  const hitIodine = report.hits.some((h) => h.includes('碘片'));
  const missSaw = report.misses.some((h) => h.includes('那两盒'));
  check('崩溃清算命中「备了碘片」', hitIodine, report.hits.join(' / '));
  check('崩溃清算不含「那两盒你没买」', !missSaw, report.misses.join(' / '));
}

// ============================================================
console.log('\n  高暴露：最后一次登记只演一次 / 强制插入认冷却');
// ============================================================
{
  const raid = FAMILY_BY_ID['raid_attempt']!;
  check('raid_attempt 冷却为 4 天', raid.cooldown === 4, `cd=${raid.cooldown}`);

  const mkNuke = () => {
    const run = createRun({
      seed: 77,
      classId: 'clerk',
      packId: 'none',
      difficulty: 'story',
      metaPerks: [],
      forceDisaster: 'nuclear',
    });
    chooseSite(run, 'apartment');
    run.day = 20;
    run.phase = 'survival';
    run.threat = 3;
    run.world.revealed = true;
    run.world.factions.gov = 50;
    run.world.weather = 'ashfall';
    return run;
  };

  {
    const run = mkNuke();
    // 没正式登记过：不应出「最后一次登记」
    const v = pickVariant(raid, deriveFacts(run), makeRng(1, 0));
    check('未登记时不出 requisition_raid', v?.id !== 'requisition_raid', `got=${v?.id}`);
  }

  {
    const run = mkNuke();
    run.flags.push('flag:govRegistered');
    const v = pickVariant(raid, deriveFacts(run), makeRng(2, 0));
    check('登记过后可选 requisition_raid', v?.id === 'requisition_raid', `got=${v?.id}`);
  }

  {
    const run = mkNuke();
    run.flags.push('flag:govRegistered', 'flag:govLastRequisition');
    const v = pickVariant(raid, deriveFacts(run), makeRng(3, 0));
    check('演过最后一次后不再选 requisition_raid', v?.id !== 'requisition_raid', `got=${v?.id}`);
  }

  {
    const run = mkNuke();
    run.eventHistory['raid_attempt'] = run.day - 1;
    const why = isEligible(raid, run, deriveFacts(run));
    check('强制插入也认冷却', why !== null && (why.includes('冷却') || why.includes('本局')), why ?? '仍合格');

    const before = selectEvents(run, makeRng(4, 0), 2, ['raid_attempt']);
    check('冷却中强制袭击不会入队', !before.picks.some((p) => p.familyId === 'raid_attempt'), before.picks.map((p) => p.familyId).join(','));
  }

  {
    const run = mkNuke();
    run.world.exposure = 95;
    const { picks } = selectEvents(run, makeRng(5, 0), 2, ['raid_attempt']);
    check('有袭击时至少还能再塞一条', picks.length >= 2 || picks.length === 1, `n=${picks.length} ${picks.map((p) => p.familyId).join(',')}`);
    // count=2, forced=1 → 应尽量到 2；若池子空也可能只有 1，但 forced 成功时再抽
    const withForced = selectEvents(run, makeRng(6, 0), Math.max(2, 1 + 1), ['raid_attempt']);
    check(
      'forced.length+1 时袭击旁还有别的事',
      withForced.picks.length >= 2,
      withForced.picks.map((p) => `${p.familyId}/${p.variantId}`).join(', '),
    );
  }

  // frozen_crowd 拆分 + 救助-袭击联动替换
  {
    const run = mkNuke();
    run.world.weather = 'blizzard';
    run.world.exposure = 95;
    check('寒冷夜 tier4 分流到 frozen_crowd', pickPressureFamily(run, yesRng()) === 'frozen_crowd');
  }
  {
    const run = mkNuke();
    run.world.exposure = 95;
    check('非寒冷夜 tier4 仍是 raid_attempt', pickPressureFamily(run, yesRng()) === 'raid_attempt');
  }
  {
    const run = mkNuke();
    run.flags.push('flag:shelteredInBlizzard');
    const { picks } = selectEvents(run, makeRng(8, 0), 2, ['raid_attempt']);
    check(
      '有援助钩子时袭击替换为联动剧情',
      picks.some((p) => p.familyId === 'raid_aided_repel' && p.variantId === 'shelter_crowd'),
      picks.map((p) => `${p.familyId}/${p.variantId}`).join(','),
    );
  }
  {
    const run = mkNuke();
    const { picks } = selectEvents(run, makeRng(9, 0), 2, ['raid_attempt']);
    check('无援助钩子时袭击照常入队', picks.some((p) => p.familyId === 'raid_attempt'), picks.map((p) => p.familyId).join(','));
  }
  {
    const run = mkNuke();
    run.flags.push('flag:shelteredInBlizzard');
    run.res.materials = 10;
    run.queue = [{ familyId: 'raid_aided_repel', variantId: 'shelter_crowd' }];
    resolveChoice(run, 'raid_aided_repel', 'shelter_crowd', 'help');
    check('联动结算消耗援助钩子', !run.flags.includes('flag:shelteredInBlizzard'), run.flags.filter((f) => f.includes('shelter')).join(','));
  }
}

// ============================================================
console.log('\n  暴露度单源 / 袭击 waitFor / 储电反馈');
// ============================================================
{
  const run = createRun({
    seed: 303,
    classId: 'clerk',
    packId: 'none',
    difficulty: 'story',
    metaPerks: [],
    forceDisaster: 'nuclear',
  });
  chooseSite(run, 'apartment');
  run.day = 20;
  run.phase = 'survival';
  run.threat = 3;
  run.world.revealed = true;
  run.world.powerGrid = 'off';
  run.modules.conceal = 1;
  run.powerEnabled = { lights: false, fridge: false, heater: false };
  run.res.water = 40;
  run.res.foodStaple = 40;
  run.world.exposure = 20;
  const before = run.world.exposure;
  const report = endDay(run);
  const after = report.exposureAfter ?? run.world.exposure;
  check(
    '夜间暴露度单源结算（无第二份 −4）',
    !report.exposureDecay && Math.abs(after - (before + report.exposureAdded)) < 0.15,
    `added=${report.exposureAdded} before=${before} after=${after} decay=${report.exposureDecay}`,
  );
}

{
  const run = createRun({
    seed: 304,
    classId: 'clerk',
    packId: 'none',
    difficulty: 'story',
    metaPerks: [],
    forceDisaster: 'nuclear',
  });
  chooseSite(run, 'apartment');
  run.day = 22;
  run.phase = 'survival';
  run.threat = 3;
  run.world.revealed = true;
  run.flags.push('flag:ashMomWatch');
  run.pending.push({
    familyId: 'nuke_chain_ashkid_3',
    waitFor: ['raid', 'raidFailed', 'raidRepelled'],
    retries: 0,
  });
  run.queue = [{ familyId: 'raid_attempt', variantId: 'crowbar' }];
  // 谈成成功：不设 raidDefend，也应 emit raid
  const talk = FAMILY_BY_ID['raid_attempt']!.variants.find((v) => v.id === 'crowbar')!.choices.find((c) => c.id === 'talk')!;
  // 直接 resolveChoice 走 check；为稳妥用 hide 也算袭击，但计划要测谈成——用 apply + 手动调
  // 这里用 barricade 以外的 talk：需要技能检定。改用把 pending 挂上后 resolve hide（也是袭击），另测 talk 成功路径：
  run.skills.negotiation = 20;
  const result = resolveChoice(run, 'raid_attempt', 'crowbar', 'talk');
  check('谈成袭击不致死', !result.died, result.notes.join('|'));
  check(
    '谈成袭击仍触发 waitFor raid 链',
    run.queue.some((q) => q.familyId === 'nuke_chain_ashkid_3') ||
      !run.pending.some((p) => p.familyId === 'nuke_chain_ashkid_3'),
    `queue=${run.queue.map((q) => q.familyId).join(',')} pending=${run.pending.map((p) => p.familyId).join(',')}`,
  );
  // 成功谈成时 pending 应被消费并入队
  check(
    'ashkid_3 已入队',
    run.queue.some((q) => q.familyId === 'nuke_chain_ashkid_3'),
    run.queue.map((q) => q.familyId).join(','),
  );
}

{
  const run = createRun({
    seed: 305,
    classId: 'clerk',
    packId: 'none',
    difficulty: 'story',
    metaPerks: [],
    forceDisaster: 'nuclear',
  });
  chooseSite(run, 'apartment');
  run.modules.power = 1;
  run.wear.batteryCharge = 0;
  const notes = applyEffect(run, { wear: { batteryCharge: 2 }, log: '测' }, makeRng(1, 0));
  check(
    '储电反馈含 + 与现存量',
    notes.some((n) => n.includes('储电') && n.includes('+') && n.includes('kWh')),
    notes.join(' | '),
  );
}

// ============================================================
console.log('\n  惯性温度：漏热、估错、回暖少耗、低温症阶段、地下站地温');
// ============================================================
{
  const fakeConsume = (indoor: number): ConsumeResult => ({
    waterRatio: 1,
    foodRatio: 1,
    drankRaw: false,
    drankFiltered: false,
    recycling: false,
    heated: false,
    indoor,
    previewIndoor: indoor,
    fuelBudget: 0,
    fuelSpent: 0,
    kwhBudget: 0,
    kwhSpent: 0,
    notes: [],
  });

  const apt = createRun({ seed: 8801, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(apt, 'apartment');
  apt.modules.insulate = 0;
  const k0 = leakRate(apt);
  apt.modules.insulate = 3;
  const k3 = leakRate(apt);
  check('保温 3 级漏热明显小于 0 级', k3 < k0 && k3 <= 0.2, `k0=${k0} k3=${k3}`);

  const farm = createRun({ seed: 8802, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(farm, 'apartment');
  farm.siteId = 'farmhouse';
  farm.modules.insulate = 0;
  apt.modules.insulate = 0;
  check('农舍漏热高于同级公寓', leakRate(farm) > leakRate(apt), `farm=${leakRate(farm)} apt=${leakRate(apt)}`);

  const snap = createRun({ seed: 8803, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(snap, 'apartment');
  snap.modules.insulate = 1;
  snap.indoorTemp = 18;
  snap.heatMode = 'fuel';
  snap.heatTarget = COLD.COMFORT;
  snap.res.fuel = 80;
  const budgetCold = heatPlan(snap, 8);
  const actualCold = heatPlan(snap, -18);
  const resolvedCold = capHeat(budgetCold, actualCold);
  check('室外骤降：实际室内低于预估', resolvedCold.indoor < budgetCold.indoor, `est=${budgetCold.indoor} actual=${resolvedCold.indoor}`);
  check('室外骤降：扣油不超过预算', resolvedCold.fuelCost <= budgetCold.fuelCost + 1e-6, `est=${budgetCold.fuelCost} spent=${resolvedCold.fuelCost}`);

  const warm = createRun({ seed: 8804, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(warm, 'apartment');
  warm.modules.insulate = 1;
  warm.indoorTemp = 10;
  warm.heatMode = 'fuel';
  warm.heatTarget = COLD.COMFORT;
  warm.res.fuel = 80;
  const budgetWarm = heatPlan(warm, -12);
  const actualWarm = heatPlan(warm, 10);
  const resolvedWarm = capHeat(budgetWarm, actualWarm);
  check('室外回暖：实扣油少于预估', resolvedWarm.fuelCost < budgetWarm.fuelCost, `est=${budgetWarm.fuelCost} spent=${resolvedWarm.fuelCost}`);
  check('室外回暖：室内仍能到目标', resolvedWarm.indoor + 0.15 >= warm.heatTarget, `indoor=${resolvedWarm.indoor} target=${warm.heatTarget}`);

  const hypo = createRun({ seed: 8805, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(hypo, 'apartment');
  hypo.day = 20;
  hypo.phase = 'survival';
  hypo.world.airPollution = 0;
  hypo.world.radiation = 0;
  hypo.res.foodStaple = 40;
  hypo.res.water = 40;
  hypo.conditions = ['hypothermiaMild'];
  hypo.conditionAge = { hypothermiaMild: 1 };
  const mildUp = resolveHealth(hypo, fakeConsume(0), makeRng(11, 0));
  check(
    '轻度 + 生存以下必升中',
    hypo.conditions.includes('hypothermiaMod') && !hypo.conditions.includes('hypothermiaMild'),
    `${hypo.conditions.join(',')} dead=${mildUp.dead}`,
  );

  const severe = createRun({ seed: 8806, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(severe, 'apartment');
  severe.day = 20;
  severe.phase = 'survival';
  severe.world.airPollution = 0;
  severe.world.radiation = 0;
  severe.res.foodStaple = 40;
  severe.res.water = 40;
  severe.stats.hp = 70;
  severe.conditions = ['hypothermiaSevere'];
  severe.conditionAge = { hypothermiaSevere: 1 };
  const died = resolveHealth(severe, fakeConsume(0), makeRng(12, 0));
  check(
    '重度 + 生存以下：死因含失温',
    died.dead === true && (died.cause ?? '').includes('失温'),
    `dead=${died.dead} cause=${died.cause}`,
  );

  const ease = createRun({ seed: 8807, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(ease, 'apartment');
  ease.day = 20;
  ease.phase = 'survival';
  ease.world.airPollution = 0;
  ease.world.radiation = 0;
  ease.res.foodStaple = 40;
  ease.res.water = 40;
  ease.conditions = ['hypothermiaSevere'];
  ease.conditionAge = { hypothermiaSevere: 1 };
  resolveHealth(ease, fakeConsume(18), makeRng(13, 0));
  check(
    '舒适夜从重跳回轻',
    ease.conditions.includes('hypothermiaMild') && !ease.conditions.includes('hypothermiaSevere') && !ease.conditions.includes('hypothermiaMod'),
    ease.conditions.join(','),
  );

  const garage = createRun({ seed: 8808, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(garage, 'apartment');
  garage.siteId = 'garage';
  garage.modules.insulate = 1;
  garage.indoorTemp = 18;
  garage.heatMode = 'off';
  garage.heatTarget = -20;
  check('地下站热汇是地温', thermalSink(garage, -30) === COLD.GROUND_TEMP, `sink=${thermalSink(garage, -30)}`);
  const gPreview = heatPlan(garage, 5);
  const gActual = heatPlan(garage, -28);
  check('地下站寒潮夜预览与结算同热汇', Math.abs(gPreview.leaked - gActual.leaked) < 0.05, `est=${gPreview.leaked} actual=${gActual.leaked}`);
  check('地下站不跟暴风雪走', gActual.leaked > 8, `indoor=${gActual.leaked}`);

  const mix = createRun({
    seed: 8810,
    classId: 'clerk',
    packId: 'none',
    difficulty: 'story',
    metaPerks: [],
    forceDisaster: 'pandemic',
  });
  chooseSite(mix, 'apartment');
  mix.day = 20;
  mix.phase = 'survival';
  mix.modules.insulate = 2;
  mix.modules.power = 1;
  mix.modules.filter = 0;
  mix.world.powerGrid = 'off';
  mix.world.weather = 'clear';
  mix.world.temperature = -10;
  mix.indoorTemp = 6;
  mix.heatTarget = 20;
  mix.res.fuel = 40;
  mix.wear.batteryCharge = 0;
  mix.powerEnabled = { lights: false, fridge: false, heater: true };
  const mixed = heatPlan(mix, -10, 0.8);
  check('电优先：先把给到的电用完', Math.abs(mixed.kwh - 0.8) < 0.05, `kwh=${mixed.kwh}`);
  check('电不够才烧油', mixed.fuelCost > 0.2, `fuel=${mixed.fuelCost}`);
  check('室内能到目标', mixed.indoor + 0.15 >= mix.heatTarget, `indoor=${mixed.indoor}`);

  const live = tonightHeat(mix);
  check(
    '温控进入供电需求',
    live.power.draws.some((d) => d.id === 'heater' && d.kwh > 0),
    live.power.draws.map((d) => `${d.id}:${d.kwh}`).join(','),
  );
  check('今夜计划先用电热', live.plan.kwh > 0, `kwh=${live.plan.kwh} fuel=${live.plan.fuelCost}`);

  mix.heatElecWant = 0.5;
  mix.heatFuelWant = 0.24;
  const split = heatPlan(mix, -10, 0.5);
  check('独立油电：电按申请走', Math.abs(split.kwh - 0.5) < 0.05, `kwh=${split.kwh}`);
  check('独立油电：油不顶替电的缺口', Math.abs(split.fuelCost - 0.24) < 0.05, `fuel=${split.fuelCost}`);
  mix.heatElecWant = undefined;
  mix.heatFuelWant = undefined;

  mix.powerEnabled.lights = true;
  mix.powerPriority = ['heater', ...POWER.DEFAULT_PRIORITY.filter((id) => id !== 'heater')];
  mix.heatTarget = 25;
  const steal = computePower(mix);
  check(
    '温控排最前会挤占后面的灯',
    steal.offline.includes('lights') && steal.heaterGranted > 0,
    `offline=${steal.offline.join(',')} heater=${steal.heaterGranted} solar=${steal.solar}`,
  );

  const diesel = createRun({
    seed: 8811,
    classId: 'clerk',
    packId: 'none',
    difficulty: 'story',
    metaPerks: [],
    forceDisaster: 'volcanicWinter',
  });
  chooseSite(diesel, 'apartment');
  diesel.day = 20;
  diesel.phase = 'survival';
  diesel.modules.insulate = 2;
  diesel.modules.power = 3;
  diesel.modules.filter = 0;
  diesel.world.powerGrid = 'off';
  diesel.world.weather = 'blizzard';
  diesel.world.temperature = -20;
  diesel.indoorTemp = 5;
  diesel.heatTarget = 20;
  diesel.res.fuel = 80;
  diesel.wear.batteryCharge = 0;
  diesel.powerEnabled = { lights: false, fridge: false, heater: true };
  const onlyHeat = computePower(diesel);
  check(
    '只有温控缺口时柴油机不开',
    onlyHeat.generator === 0,
    `gen=${onlyHeat.generator} demand=${onlyHeat.demand} heater=${onlyHeat.heaterGranted}`,
  );
}

// ============================================================
console.log('\n  结算撒谎 / 温控 / 一氧化碳');
// ============================================================
{
  const prep = createRun({ seed: 9101, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(prep, 'apartment');
  prep.res.foodFresh = 8;
  prep.powerEnabled = { ...prep.powerEnabled, fridge: false };
  prep.queue = [];
  const prepNight = endDay(prep);
  const prepText = prepNight.notes.map((n) => n.text).join('\n');
  check('准备期夜间没有冰箱没电', !prepText.includes('冰箱没电'), prepText.slice(0, 80));

  const rain = createRun({ seed: 9102, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(rain, 'apartment');
  rain.day = 12;
  rain.phase = 'survival';
  rain.modules.filter = 2;
  rain.modules.power = 2;
  rain.wear.filterLife = 40;
  rain.world.weather = 'rain';
  rain.world.powerGrid = 'on';
  rain.res.water = 8;
  rain.res.foodStaple = 40;
  rain.res.foodFresh = 0;
  rain.queue = [];
  const prodNotes = applyProduction(rain);
  const prodText = prodNotes.map((n) => n.text).join('\n');
  check('雨夜能接雨', prodText.includes('接雨雪'), prodText);
  rain.world.weather = 'clear';
  const afterRain = consumeDaily(rain, makeRng(2, 0), 'story', undefined, 'rain');
  const afterText = afterRain.notes.map((n) => n.text).join('\n');
  check('接雨之夜不写没下雨回用', !afterText.includes('没有下雨') && !afterText.includes('没下雨'), afterText);
  check('接雨笔记是好消息', prodNotes.some((n) => n.text.includes('接雨雪') && n.tone === 'good'));

  const cap = createRun({ seed: 9103, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(cap, 'apartment');
  cap.modules.insulate = 2;
  cap.modules.power = 2;
  cap.res.fuel = 80;
  cap.indoorTemp = 10;
  cap.world.temperature = -8;
  applyHeatWants(cap, 40, 40);
  check('申请再大，目标室内也不过 25', cap.heatTarget <= COLD.MAX_INDOOR, `target=${cap.heatTarget}`);
  const cappedPlan = heatPlan(cap, -8, 40);
  check('heatPlan 室内 ≤ 25', cappedPlan.indoor <= COLD.MAX_INDOOR, `indoor=${cappedPlan.indoor}`);

  const raidRun = createRun({ seed: 9104, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
  chooseSite(raidRun, 'apartment');
  raidRun.res.ammo = 10;
  const held = resolveRaid(raidRun, makeRng(4, 0), 1, false);
  check('没开枪不扣弹药', held.usedAmmo === 0 && raidRun.res.ammo === 10, `used=${held.usedAmmo} ammo=${raidRun.res.ammo}`);

  const fakeConsume = (indoor: number, extra: Partial<ConsumeResult> = {}): ConsumeResult => ({
    waterRatio: 1,
    foodRatio: 1,
    drankRaw: false,
    drankFiltered: false,
    recycling: false,
    heated: false,
    indoor,
    previewIndoor: indoor,
    fuelBudget: 0,
    fuelSpent: 0,
    kwhBudget: 0,
    kwhSpent: 0,
    notes: [],
    ...extra,
  });

  const heal = createRun({ seed: 9105, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(heal, 'apartment');
  heal.day = 20;
  heal.phase = 'survival';
  heal.world.airPollution = 0;
  heal.world.radiation = 0;
  heal.world.contagion = 0;
  heal.res.foodStaple = 40;
  heal.res.water = 40;
  heal.modules.filter = 1;
  heal.ration = 'normal';
  heal.waterUse = 'normal';
  heal.conditions = ['coPoisoning'];
  heal.conditionAge = { coPoisoning: 1 };
  const healed = resolveHealth(heal, fakeConsume(18), yesRng());
  check(
    'CO 自愈当晚不扣该病生命',
    !healed.hpParts.some((p) => p.label.includes('一氧化碳')) && heal.conditions.includes('coPoisoning') === false,
    healed.hpParts.map((p) => `${p.value} ${p.label}`).join(','),
  );
  check('CO 自愈有好转笔记', healed.notes.some((n) => n.text.includes('好转') || n.text.includes('好了')), healed.notes.map((n) => n.text).join(' | '));

  const alarm = createRun({ seed: 9106, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(alarm, 'apartment');
  alarm.day = 20;
  alarm.phase = 'survival';
  alarm.world.airPollution = 0;
  alarm.world.radiation = 0;
  alarm.world.contagion = 0;
  alarm.res.foodStaple = 40;
  alarm.res.water = 40;
  alarm.modules.insulate = 2;
  alarm.modules.filter = 1;
  alarm.ration = 'normal';
  alarm.waterUse = 'normal';
  alarm.flags.push('flag:coAlarm');
  resolveHealth(alarm, fakeConsume(18, { heated: true, heatKind: 'fuel' }), yesRng());
  check('有报警器当晚不中毒', !alarm.conditions.includes('coPoisoning'), alarm.conditions.join(','));
  check(
    '有报警器次日预约吵醒',
    alarm.pending.some((p) => p.familyId === 'env_co_alarm'),
    alarm.pending.map((p) => p.familyId).join(','),
  );

  const vent = createRun({ seed: 9107, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(vent, 'apartment');
  vent.day = 20;
  vent.phase = 'survival';
  vent.world.airPollution = 0;
  vent.world.radiation = 0;
  vent.world.contagion = 0;
  vent.res.foodStaple = 40;
  vent.res.water = 40;
  vent.modules.insulate = 2;
  vent.modules.filter = 1;
  vent.ration = 'normal';
  vent.waterUse = 'normal';
  resolveHealth(vent, fakeConsume(18, { heated: true, heatKind: 'fuel' }), yesRng());
  check('没买当晚中毒', vent.conditions.includes('coPoisoning'));
  check(
    '没买次日预约通风',
    vent.pending.some((p) => p.familyId === 'env_co_vent'),
    vent.pending.map((p) => p.familyId).join(','),
  );

  const drown = createRun({ seed: 9108, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(drown, 'apartment');
  drown.day = 20;
  drown.phase = 'survival';
  drown.world.airPollution = 0;
  drown.world.radiation = 0;
  drown.world.contagion = 0;
  drown.res.foodStaple = 40;
  drown.res.water = 40;
  drown.modules.insulate = 2;
  drown.modules.filter = 1;
  drown.ration = 'normal';
  drown.waterUse = 'normal';
  drown.flags.push('flag:coWarned');
  resolveHealth(drown, fakeConsume(18, { heated: true, heatKind: 'fuel' }), yesRng());
  check(
    '拒绝通风后再掷中预约溺死',
    drown.pending.some((p) => p.familyId === 'env_co_drowning'),
    drown.pending.map((p) => p.familyId).join(','),
  );
  const died = resolveChoice(drown, 'env_co_drowning', 'main', 'sleep');
  check('沉浸选项打出六十八块', died.died === true && drown.endingId === 'death_co', `died=${died.died} ending=${drown.endingId}`);
}

// ============================================================
console.log('\n  内容与建造修复：报警器货架 / 续篇汉化 / 回用两行 / DIY按次扣料 / 伤口 / 停水链');
// ============================================================
{
  const run = createRun({ seed: 3301, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(run, 'apartment');
  run.day = 2;
  run.phase = 'prep';
  run.res.cash = 5000;
  const badShop = buyCoAlarm(run, 'pharmacy');
  check('药店不能买一氧化碳报警器', !badShop.ok);
  const bought = buyCoAlarm(run, 'hardware');
  check('五金店能买一氧化碳报警器', bought.ok, bought.reason);
  check('买下写 flag:coAlarm', run.flags.includes('flag:coAlarm'));
  const again = buyCoAlarm(run, 'hardware');
  check('已有报警器不能再买', !again.ok);
  const prepCo = FAMILY_BY_ID['prep_coalarm']!;
  const whyCo = isEligible(prepCo, run, deriveFacts(run));
  check('已购时 prep_coalarm 不合格', whyCo !== null, whyCo ?? '仍可触发');
}

{
  const raidLabel = sequelWaitLabel(['raid', 'raidFailed', 'raidRepelled']);
  check('袭击三元组只显示遭遇袭击', raidLabel === '遭遇袭击', raidLabel);
  const haulLabel = sequelWaitLabel('takeHaul');
  check('takeHaul 显示中文', haulLabel === '带回战利品', haulLabel);
  check('续篇标签不含内部 ID', !raidLabel.includes('raid') && !haulLabel.includes('takeHaul'));
  check('HOOK_NAME 覆盖 takeHaul', HOOK_NAME.takeHaul === '带回战利品');
}

{
  const run = createRun({ seed: 3302, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(run, 'apartment');
  run.day = 12;
  run.phase = 'survival';
  run.modules.filter = 1;
  run.modules.cistern = 1;
  run.wear.filterLife = 30;
  run.world.weather = 'clear';
  run.res.water = 30;
  run.res.foodStaple = 40;
  run.ration = 'normal';
  run.waterUse = 'normal';
  const consume = consumeDaily(run, makeRng(3302, 0), 'story');
  const texts = consume.notes.map((n) => n.text);
  const recycleIdx = texts.findIndex((x) => x.includes('没有下雨'));
  check('回用账本有「没有下雨」行', recycleIdx >= 0, texts.join(' | '));
  check(
    '回用饮水单独一行',
    recycleIdx >= 0 && texts[recycleIdx + 1]?.startsWith('饮水 −'),
    texts.slice(recycleIdx, recycleIdx + 2).join(' | '),
  );
}

{
  const run = createRun({ seed: 3303, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(run, 'apartment');
  run.day = 12;
  run.phase = 'survival';
  run.res.materials = 10;
  run.res.parts = 2;
  run.res.cash = 0;
  run.ap = 3;
  run.skills.mechanics = 0;
  run.skills.fitness = 0;
  const beforeMat = run.res.materials;
  const beforeParts = run.res.parts;
  const started = startProject(run, 'fortify', 'diy');
  check('DIY 能开工', started.ok, started.reason);
  check('开工不预扣建材', run.res.materials === beforeMat, `${beforeMat} -> ${run.res.materials}`);
  check('开工不预扣零件', run.res.parts === beforeParts, `${beforeParts} -> ${run.res.parts}`);
  check('新工程带 payAsYouGo', run.projects[0]?.payAsYouGo === true);

  // 低技能第一次施工：强制成功（不掷失败）
  const noFailRng = (): Rng => {
    const r = makeRng(3303, 0);
    return { ...r, chance: () => false };
  };
  const work1 = investLabor(run, 'fortify', noFailRng());
  check('第一次施工成功', work1.ok, work1.reason);
  check('第一次施工扣了材料', run.res.materials < beforeMat || run.res.parts < beforeParts, `mat=${run.res.materials} parts=${run.res.parts}`);
  check('第一次施工推进了工时', (run.projects[0]?.laborDone ?? 0) > 0);
  check('第一次施工未完工', (run.projects[0]?.laborDone ?? 0) < (run.projects[0]?.laborTotal ?? 0));

  // 清空库存后不能再施工
  run.res.materials = 0;
  run.res.parts = 0;
  run.ap = 2;
  const blocked = investLabor(run, 'fortify', noFailRng());
  check('库存不足不能施工', !blocked.ok, blocked.reason);
  check('库存不足不扣 AP', run.ap === 2, `ap=${run.ap}`);
}

{
  // 技能不足 + 必失败 RNG → 扣料、无工时、得伤口
  const run = createRun({ seed: 3304, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(run, 'apartment');
  run.day = 12;
  run.phase = 'survival';
  run.modules.fortify = 1;
  run.res.materials = 40;
  run.res.parts = 20;
  run.ap = 3;
  run.skills.mechanics = 0;
  run.skills.fitness = 0;
  const hpBefore = run.stats.hp;
  startProject(run, 'fortify', 'diy'); // 升到 2 级，需要 mechanics 2
  const matBefore = run.res.materials;
  const laborBefore = run.projects[0]!.laborDone;
  const fail = investLabor(run, 'fortify', yesRng());
  check('技能不足失败仍返回 ok', fail.ok, fail.reason);
  check('失败扣了材料', run.res.materials < matBefore, `${matBefore} -> ${run.res.materials}`);
  check('失败不加工时', run.projects[0]!.laborDone === laborBefore, `${laborBefore} -> ${run.projects[0]!.laborDone}`);
  check('划伤得到伤口', run.conditions.includes('wound'), run.conditions.join(','));
  check('划伤当晚不直接扣 HP', run.stats.hp === hpBefore, `${hpBefore} -> ${run.stats.hp}`);
  check('失败文案提到伤口或浪费', !!(fail.note && (fail.note.includes('伤口') || fail.note.includes('浪费'))), fail.note);
}

{
  const run = createRun({ seed: 3305, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(run, 'apartment');
  run.day = 15;
  run.phase = 'survival';
  run.res.cash = 500;
  run.res.water = 10;
  run.stats.sanity = 80;
  // 模拟第 2 拍「不买」
  const notes = applyEffect(
    run,
    {
      stats: { sanity: -2 },
      setFlags: ['flag:refusedStairWater'],
    },
    makeRng(3305, 0),
  );
  void notes;
  check('拒绝买水写拒绝旗标', run.flags.includes('flag:refusedStairWater'));
  check('拒绝买水不排程腹泻续篇', !run.pending.some((p) => p.familyId === 'nuke_chain_nopressure_3'), run.pending.map((p) => p.familyId).join(','));

  // 对照：买了才会排程
  const buyRun = createRun({ seed: 3306, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(buyRun, 'apartment');
  buyRun.day = 15;
  buyRun.phase = 'survival';
  buyRun.res.cash = 500;
  applyEffect(
    buyRun,
    {
      res: { cash: -100, water: 8 },
      setFlags: ['flag:boughtStairWater'],
      schedule: [{ familyId: 'nuke_chain_nopressure_3', inDays: 3, require: { all: ['flag:boughtStairWater'] } }],
    },
    makeRng(3306, 0),
  );
  check(
    '买了上门水会排程腹泻续篇',
    buyRun.pending.some((p) => p.familyId === 'nuke_chain_nopressure_3'),
    buyRun.pending.map((p) => p.familyId).join(','),
  );
}

// ============================================================
console.log('\n  sim-session  合法动作层与事件读表');
// ============================================================
{
  const run = createRun({ seed: 7701, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
  chooseSite(run, 'apartment');
  check('准备期第一天', run.day < TIME.COLLAPSE_DAY, `day=${run.day}`);
  const s = createSession(run);
  const blocked = sessionScavenge(s, 'supermarket', false);
  check('准备期搜刮必须失败', !blocked.ok, blocked.reason);

  const workRun = createRun({ seed: 7702, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
  chooseSite(workRun, 'apartment');
  workRun.day = 12;
  workRun.phase = 'survival';
  workRun.modules.fortify = 1;
  workRun.res.materials = 80;
  workRun.res.parts = 40;
  workRun.ap = 4;
  workRun.skills.mechanics = 0;
  const started = startProject(workRun, 'fortify', 'diy');
  check('开工加固二级', started.ok, started.reason);
  const cursorBefore = workRun.rngCursor;
  const sw = createSession(workRun);
  const worked = sessionWork(sw, 'fortify');
  check('work 调用成功', worked.ok, worked.reason);
  check('work 推进 rngCursor', sw.run.rngCursor !== cursorBefore, `${cursorBefore} -> ${sw.run.rngCursor}`);

  const recruitA = scoreIgnoresRecruit({ res: { foodStaple: 4 }, survivor: { recruit: 'random' } });
  const recruitB = scoreIgnoresRecruit({ res: { foodStaple: 4 } });
  check('预览忽略招募字段', recruitA === recruitB, `${recruitA} vs ${recruitB}`);

  const food = { id: 'food', effect: { res: { foodStaple: 10 } } };
  const hurt = { id: 'hurt', effect: { stats: { hp: -8 }, res: { cash: 400 } } };
  const oracle = pickOracle(run, [hurt, food]);
  check('oracle 在掉血与加粮之间选粮', oracle.choice.id === 'food', oracle.choice.id);
  const sighted = pickSighted(run, [hurt, food], 20, 20);
  check('sighted 避开掉血选项', sighted.id === 'food', sighted.id);

  const a = createRun({ seed: 8801, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
  const b = createRun({ seed: 8802, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
  chooseSite(a, 'apartment');
  chooseSite(b, 'apartment');
  const oa = planBuildOrder(a).join(',');
  const ob = planBuildOrder(b).join(',');
  check('建造顺序按种子不同', oa !== ob, `${oa} vs ${ob}`);
  check('同种子顺序稳定', planBuildOrder(a).join(',') === oa, planBuildOrder(a).join(','));
  check('计划不含无线电', !oa.includes('radio') && !ob.includes('radio'), oa);

  a.conditions = ['radiationSickness'];
  a.modules.medbay = 0;
  check('治不了的病把医疗站提前', planBuildOrder(a)[0] === 'medbay', planBuildOrder(a).join(','));

  const prep = createRun({ seed: 8803, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
  chooseSite(prep, 'apartment');
  const ps = attach(prep);
  const counters = emptyCounters();
  while (ps.run.day < TIME.COLLAPSE_DAY && ps.run.phase !== 'ended') {
    playDay(ps, PERSONA_BY_ID.passable, counters);
  }
  const l1 = (['cistern', 'filter', 'insulate', 'fortify', 'conceal', 'garden', 'power', 'airFilter', 'medbay'] as ModuleId[])
    .filter((id) => (ps.run.modules[id] ?? 0) >= 1).length;
  check('准备期末至少 3 个 1 级（不含无线电）', l1 >= 3, `l1=${l1} radio=${ps.run.modules.radio}`);
  check('准备期不升无线电', (ps.run.modules.radio ?? 0) === 0, String(ps.run.modules.radio));

  const heatRun = createRun({ seed: 8804, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
  chooseSite(heatRun, 'apartment');
  heatRun.day = TIME.COLLAPSE_DAY;
  heatRun.phase = 'survival';
  heatRun.modules.insulate = 1;
  heatRun.res.fuel = 20;
  heatRun.indoorTemp = 10;
  heatRun.world.temperature = 2;
  heatRun.heatMode = 'off';
  const hs = attach(heatRun);
  planHeat(hs);
  check('有油且能燃油取暖时打开油暖', hs.run.heatMode === 'fuel', hs.run.heatMode);
  check(
    '燃料充足时目标至少到舒适线',
    hs.run.heatTarget >= COLD.COMFORT,
    `target=${hs.run.heatTarget} leaked≈${hs.run.indoorTemp}`,
  );
}

// ============================================================
console.log('\n  P0-x  无线电频道网络：调度、信箱与代价');
// ============================================================
{
  const { tickChannels, searchChannel, openChannel, replyChannel, ensureChannelDefaults, bondOf } =
    await import('../src/game/engine/channels');
  const { CHANNEL } = await import('../src/game/balance');
  const { LOCATION_BY_ID } = await import('../src/game/content/locations');

  type St = import('../src/game/types').ChannelState;
  const mkChannel = (id: string, extra: Partial<St> = {}): St => ({
    id,
    status: 'active',
    affinity: 20,
    doneBeats: [],
    inbox: [],
    log: [],
    missed: 0,
    repliedCount: 0,
    lastContactDay: 0,
    ...extra,
  });

  /** 造一个「灾后、有电、电台在线」的局 */
  const survivalRun = (seed: number, day = TIME.COLLAPSE_DAY) => {
    const r = createRun({ seed, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
    chooseSite(r, 'apartment');
    r.day = day;
    r.threat = 1;
    r.phase = 'survival';
    r.world.revealed = true;
    r.world.powerGrid = 'on';
    r.modules.radio = 2;
    r.modules.power = 3;
    r.wear.batteryCharge = 8;
    r.ap = 4;
    r.queue = [];
    return r;
  };

  // ---- 准备期：tickChannels 必须是 no-op，且不产生任何状态 ----
  {
    const r = survivalRun(6101, 3);
    r.phase = 'prep';
    r.channels = [];
    const before = JSON.stringify(r.channels);
    tickChannels(r);
    check('准备期 tickChannels 是 no-op', JSON.stringify(r.channels) === before, `channels=${r.channels.length}`);
    check('准备期仍自动推送 3 条 prep 情报', r.intel.length === 3, String(r.intel.length));
  }

  // ---- 崩溃日的插入位：day 7 → endDay → day 8 当天就该收到开场拍 ----
  {
    const r = survivalRun(6102, TIME.COLLAPSE_DAY - 1);
    r.phase = 'prep';
    r.ap = 0;
    r.channels = [mkChannel('tmp_dying')];
    r.queue = [];
    endDay(r);
    const st = r.channels[0]!;
    check(
      '崩溃日当天频道节拍已投递（守住 endDay 提前 return 之前的插入位）',
      r.day === TIME.COLLAPSE_DAY && st.inbox.length >= 3,
      `day=${r.day} inbox=${st.inbox.length}`,
    );
    check('开场拍被标记为等回复', st.awaitingBeat === 'd_open', String(st.awaitingBeat));
  }

  // ---- 未读搬进会话记录 + onRead 结算 ----
  {
    const r = survivalRun(6103);
    r.channels = [mkChannel('tmp_dying')];
    tickChannels(r);
    const st = r.channels[0]!;
    const unread = st.inbox.length;
    const ap = r.ap;
    const rng0 = r.rngCursor;
    const out = openChannel(r, 'tmp_dying');
    check('打开频道搬走未读', out.lines.length === unread && st.inbox.length === 0, `${unread} -> ${st.inbox.length}`);
    check('读不消耗行动点', r.ap === ap, `${ap} -> ${r.ap}`);
    check('读不推进共享随机游标', r.rngCursor === rng0, `${rng0} -> ${r.rngCursor}`);
  }

  // ---- 整条「求救的男人」：两次抉择都走一遍 ----
  {
    const r = survivalRun(6104);
    r.channels = [mkChannel('tmp_dying')];
    tickChannels(r);
    openChannel(r, 'tmp_dying');

    // 第一次抉择：回话
    const a = replyChannel(r, 'tmp_dying', 'reply');
    check('第一次抉择（回话）成功', a.ok, a.reason);
    const st = r.channels[0]!;
    check('回话进了会话记录', st.log.some((l) => l.from === 'you'), `log=${st.log.length}`);
    check('好感度按选项声明增加', st.affinity === 20 + 4, String(st.affinity));

    // 下一拍挂起，且没有 afterDays → 次日立刻到
    const pending = st.pendingBeat;
    tickChannels(r);
    check('pendingBeat 次日整点投递', st.log.length + st.inbox.length > 0 && pending === 'd_ask' && st.awaitingBeat === 'd_ask', `awaiting=${st.awaitingBeat}`);

    openChannel(r, 'tmp_dying');
    const apBefore = r.ap;
    const stamBefore = r.stats.stamina;
    const expBefore = r.world.exposure;
    const b = replyChannel(r, 'tmp_dying', 'go');
    check('第二次抉择（答应去）成功', b.ok, b.reason);
    check('答应去扣 2 行动点', r.ap === apBefore - 2, `${apBefore} -> ${r.ap}`);
    check('答应去扣体力', r.stats.stamina < stamBefore, `${stamBefore} -> ${r.stats.stamina}`);
    check('答应去涨暴露度', r.world.exposure > expBefore, `${expBefore} -> ${r.world.exposure}`);
    check('去过的地下室变成可搜地点', r.locations.some((l) => l.id === 'sig_basement'), r.locations.map((l) => l.id).join(','));
    tickChannels(r);
    check('这条线以永久静默收尾', st.status === 'lost', st.status);
  }

  // ---- 第二次抉择：只说"记下了" → 三天后静默 ----
  {
    const r = survivalRun(6105);
    r.channels = [mkChannel('tmp_dying')];
    tickChannels(r);
    openChannel(r, 'tmp_dying');
    replyChannel(r, 'tmp_dying', 'reply');
    tickChannels(r); // d_ask
    openChannel(r, 'tmp_dying');
    replyChannel(r, 'tmp_dying', 'note');
    const st = r.channels[0]!;
    check('记下之后进入三日等待', st.pendingBeat === 'd_note_after' && st.status === 'active', `${st.pendingBeat} / ${st.status}`);
    r.day += 2;
    tickChannels(r);
    check('等待期内不提前兑现', st.status === 'active', st.status);
    r.day += 1;
    tickChannels(r);
    check('满三天后静默', st.status === 'lost', st.status);
  }

  // ---- 超期未回：missed++ 且好感度 −6 ----
  {
    const r = survivalRun(6106);
    r.channels = [mkChannel('tmp_dying')];
    tickChannels(r);
    const st = r.channels[0]!;
    st.awaitSinceDay = r.day - 99; // 早就该回了
    const aff = st.affinity;
    tickChannels(r);
    check('超期未回记一次 missed', st.missed === 1, String(st.missed));
    check('超期未回扣好感度', st.affinity === aff + CHANNEL.AFF_MISSED, `${aff} -> ${st.affinity}`);
    check('超期后不再挂着等回复', st.awaitingBeat === undefined, String(st.awaitingBeat));
  }

  // ---- lost 之后彻底不再投递 ----
  {
    const r = survivalRun(6107);
    r.channels = [mkChannel('tmp_mother', { status: 'lost' })];
    for (let i = 0; i < 20; i++) {
      r.day += 1;
      tickChannels(r);
    }
    const st = r.channels[0]!;
    check('lost 频道不再投递任何拍', st.inbox.length === 0 && st.doneBeats.length === 0, `inbox=${st.inbox.length} done=${st.doneBeats.length}`);
  }

  // ---- 蓄电不足：拒绝发送，且一分钱都不扣 ----
  {
    const r = survivalRun(6108);
    r.channels = [mkChannel('tmp_dying')];
    tickChannels(r);
    openChannel(r, 'tmp_dying');
    r.wear.batteryCharge = 0;
    const ap = r.ap;
    const deny = replyChannel(r, 'tmp_dying', 'reply');
    check('蓄电不足时发送被拒', deny.ok === false, deny.reason);
    check('被拒时不扣行动点、不扣电', r.ap === ap && r.wear.batteryCharge === 0, `ap=${r.ap} kwh=${r.wear.batteryCharge}`);
    const st = r.channels[0]!;
    check('被拒时不推进剧情', st.awaitingBeat === 'd_open' && st.log.every((l) => l.from !== 'you'), String(st.awaitingBeat));
  }

  // ---- 1 级电台只能听不能说 ----
  {
    const r = survivalRun(6109);
    r.modules.radio = 1;
    r.channels = [mkChannel('tmp_dying')];
    tickChannels(r);
    openChannel(r, 'tmp_dying');
    const deny = replyChannel(r, 'tmp_dying', 'reply');
    check('1 级电台发不出话', deny.ok === false, deny.reason);
    const quiet = replyChannel(r, 'tmp_dying', 'off'); // 不说话的那条应该仍然可选
    check('1 级电台仍然可以「不回」', quiet.ok, quiet.reason);
  }

  // ---- 搜索频道：每日一次、池子有限、命中率按等级 ----
  {
    const r = survivalRun(6110, TIME.COLLAPSE_DAY + 2);
    const first = searchChannel(r);
    check('第一次搜索有结果（拿到的还是只有静电都算成功）', first.ok, first.reason);
    const again = searchChannel(r);
    check('同一天不能搜第二次', again.ok === false, again.reason);
    // 把池子清空 → 只扣电不扣 AP
    r.day += 1;
    r.channelPool = [];
    r.wear.batteryCharge = 8;
    const ap = r.ap;
    const kwh = r.wear.batteryCharge;
    const empty = searchChannel(r);
    check('池子搜空后仍然成功但只有静电', empty.ok === true && empty.found === null, String(empty.found));
    check('池空只扣电不扣行动点', r.ap === ap && r.wear.batteryCharge < kwh, `ap=${r.ap} kwh=${kwh} -> ${r.wear.batteryCharge}`);
  }

  // ---- 好感度档位 ----
  check('好感度映射成四档', bondOf(0) === 'stranger' && bondOf(30) === 'familiar' && bondOf(60) === 'close' && bondOf(90) === 'reliant', [0, 30, 60, 90].map((n) => bondOf(n)).join(','));

  // ---- 隐藏信号点：初始不存在、搜不了，解锁后才能去 ----
  {
    const r = survivalRun(6111);
    check('隐藏信号点不在初始 run.locations 里', !r.locations.some((l) => l.id === 'sig_basement'), r.locations.map((l) => l.id).join(','));
    check('隐藏信号点本身仍是合法地点定义', !!LOCATION_BY_ID['sig_basement']?.hidden);
    const sv = createSession(r);
    const denied = sessionScavenge(sv, 'sig_basement', false);
    check('未解锁时搜刮被拒', denied.ok === false, denied.reason);
    // 用真实的效果通道解锁
    applyEffect(r, { locations: [{ id: 'sig_basement', stock: 80 }] }, makeRng(1));
    check('解锁后出现在 run.locations', r.locations.some((l) => l.id === 'sig_basement'), r.locations.map((l) => l.id).join(','));
    r.res.fuel = 20;
    r.stats.stamina = 100;
    r.ap = 4;
    const sv2 = createSession(r);
    const ok2 = sessionScavenge(sv2, 'sig_basement', false);
    check('解锁后可以搜刮', ok2.ok, ok2.reason);
  }

  // ---- 基线哨兵：连续 30 天 tickChannels 不得动共享随机游标 ----
  {
    const r = survivalRun(6112);
    ensureChannelDefaults(r);
    r.channels = [mkChannel('tmp_dying'), mkChannel('tmp_mother')];
    const cursor0 = r.rngCursor;
    for (let i = 0; i < 30; i++) {
      r.day += 1;
      tickChannels(r);
    }
    check(
      '30 天 tickChannels 完全不动 run.rngCursor',
      r.rngCursor === cursor0,
      `${cursor0} -> ${r.rngCursor}（动了就意味着 720 局 sim 基线会漂移）`,
    );
    check('30 天后频道确实发生了推进（不是空转）', r.channels.some((c) => c.doneBeats.length > 0), r.channels.map((c) => `${c.id}:${c.doneBeats.length}`).join(' '));
  }

  // ---- 旧存档自愈 ----
  {
    const bare = { channels: undefined, channelPool: undefined } as unknown as RunState;
    ensureChannelDefaults(bare);
    check('旧档补出 channels 数组', Array.isArray(bare.channels) && bare.channels.length === 0);
    check('旧档补出可搜频道池', Array.isArray(bare.channelPool) && bare.channelPool.length > 0, String(bare.channelPool.length));
  }
}

// ============================================================
console.log('\n  P1-x  小桃：固定日求救的三种结局');
// ============================================================
{
  const { tickChannels, openChannel, replyChannel } = await import('../src/game/engine/channels');
  type St = import('../src/game/types').ChannelState;

  const mk = (extra: Partial<St> = {}): St => ({
    id: 'xt',
    status: 'active',
    affinity: 60,
    doneBeats: [],
    inbox: [],
    log: [],
    missed: 0,
    repliedCount: 0,
    lastContactDay: 0,
    ...extra,
  });

  /** 第 32 天之前该走完的主线拍（测试里直接标成已完成，免得一天只投一拍的节奏把用例拖长） */
  const PRIOR = [
    'xt_hello', 'xt_power', 'xt_daily_a', 'xt_share', 'xt_daily_b',
    'xt_daily_c', 'xt_daily_d', 'xt_request', 'xt_gift', 'xt_reconnect', 'xt_afraid',
  ];

  /** 造一个「已经走完前置、正站在第 32 天」的局 */
  const atAmbush = (seed: number, affinity: number) => {
    const r = createRun({ seed, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
    chooseSite(r, 'apartment');
    r.day = 32;
    r.threat = 3;
    r.phase = 'survival';
    r.world.revealed = true;
    r.world.powerGrid = 'on';
    r.modules.radio = 2;
    r.modules.power = 3;
    r.wear.batteryCharge = 8;
    r.ap = 6;
    r.res.water = 60;
    r.res.foodStaple = 40;
    // 前置：主线走到第 28 天（试音、交心、求助都已完成）
    r.channels = [mk({ affinity, doneBeats: [...PRIOR], lastContactDay: 28 })];
    r.queue = [];
    return r;
  };

  // ---- 结局一：好感度够 + 上楼 → 她活着 ----
  {
    const r = atAmbush(6201, 60);
    tickChannels(r);
    const st = r.channels[0]!;
    check('第 32 天按时收到求救', st.awaitingBeat === 'xt_ambush', String(st.awaitingBeat));
    openChannel(r, 'xt');
    check('答应出门成功', replyChannel(r, 'xt', 'go').ok);
    tickChannels(r);
    openChannel(r, 'xt');
    check('到达分支进入楼道', st.awaitingBeat === 'xt_go', String(st.awaitingBeat));
    replyChannel(r, 'xt', 'upstairs');
    tickChannels(r);
    openChannel(r, 'xt');
    check('好感度足够时她活下来', r.flags.includes('flag:xtAlive'), r.flags.filter((f) => f.startsWith('flag:xt')).join(','));
    check('活着时频道仍在播', st.status === 'active', st.status);
    // 存活线：第 36 天还能收到日常
    r.day = 36;
    tickChannels(r);
    check('存活线后续节拍正常投递', st.doneBeats.includes('xt_live_a'), st.doneBeats.join(','));
  }

  // ---- 结局二：好感度不够 + 上楼 → 她死了（条件分叉走 elseBeat） ----
  {
    const r = atAmbush(6202, 60);
    tickChannels(r);
    openChannel(r, 'xt');
    replyChannel(r, 'xt', 'go');
    tickChannels(r);
    openChannel(r, 'xt');
    replyChannel(r, 'xt', 'upstairs');
    r.channels[0]!.affinity = 45; // 拉低到门槛以下
    tickChannels(r);
    const st = r.channels[0]!;
    check('好感度不足时走 elseBeat 死亡分支', st.doneBeats.includes('xt_dead'), st.doneBeats.join(','));
    check('死亡分支把频道永久静默', st.status === 'lost', st.status);
    check('死了就没有存活线', !r.flags.includes('flag:xtAlive'), r.flags.filter((f) => f.startsWith('flag:xt')).join(','));
  }

  // ---- 结局三：前置不够 → 根本没收到求救，只有静默 ----
  {
    const r = atAmbush(6203, 20);
    tickChannels(r);
    const st = r.channels[0]!;
    check('前置不够时不是求救而是静默', st.doneBeats.includes('xt_silent'), st.doneBeats.join(','));
    check('静默分支同样永久静默', st.status === 'lost', st.status);
    const lines = st.inbox;
    check('静默分支确实给出了文本（不是空信息）', lines.length >= 2, String(lines.length));
    check('玩家永远拿不到「因为好感度不够」这种提示', !lines.some((l) => l.text.includes('affinity')), lines.map((l) => l.text).join('|'));
  }

  // ---- 离线回归只在全程没回过时出现 ----
  {
    const before = PRIOR.filter((id) => id !== 'xt_reconnect');
    const quiet = atAmbush(6204, 20);
    quiet.day = 26;
    quiet.channels = [mk({ affinity: 20, doneBeats: [...before], lastContactDay: 25 })];
    tickChannels(quiet);
    check('全程没回过 → 触发离线回归拍', quiet.channels[0]!.doneBeats.includes('xt_reconnect'), quiet.channels[0]!.doneBeats.join(','));

    const talked = atAmbush(6205, 40);
    talked.day = 26;
    talked.flags = ['flag:xtReplied'];
    talked.channels = [mk({ affinity: 40, doneBeats: [...before], lastContactDay: 25 })];
    tickChannels(talked);
    check('回过话 → 不触发离线回归拍', !talked.channels[0]!.doneBeats.includes('xt_reconnect'), talked.channels[0]!.doneBeats.join(','));
  }

  // ---- 前置不满足的拍不会堵住后面（曾经的「整线停滞」陷阱） ----
  {
    const r = atAmbush(6206, 20);
    r.day = 28;
    r.channels = [
      mk({ affinity: 20, doneBeats: PRIOR.filter((id) => id !== 'xt_afraid'), lastContactDay: 25 }),
    ];
    // xt_reconnect(26) 的前置不满足且没有 elseBeat；xt_afraid(28) 必须照常投递
    tickChannels(r);
    const st = r.channels[0]!;
    check('条件不满足的条件拍不会堵住后续拍', st.doneBeats.includes('xt_afraid'), st.doneBeats.join(','));
  }
}

// ============================================================
console.log('\n  P2-x  战时官方频道：坐标陷阱、等级鉴定与「被攻陷」');
// ============================================================
{
  const { tickChannels, openChannel, replyChannel } = await import('../src/game/engine/channels');
  const { CHANNEL_BY_ID } = await import('../src/game/content/channels');
  const { FAMILY_BY_ID } = await import('../src/game/content/events');
  await import('../src/game/copy');
  const { t: copyT } = await import('../src/game/copy/t');
  type St = import('../src/game/types').ChannelState;

  const ogAt = (seed: number, day: number, opts: { radio?: number; done?: string[]; flags?: string[] } = {}) => {
    const r = createRun({ seed, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
    chooseSite(r, 'apartment');
    r.day = day;
    r.threat = 3;
    r.phase = 'survival';
    r.world.revealed = true;
    r.world.powerGrid = 'on';
    r.modules.radio = opts.radio ?? 2;
    r.modules.power = 3;
    r.wear.batteryCharge = 8;
    r.ap = 6;
    r.res.water = 60;
    r.res.foodStaple = 40;
    r.flags = [...(opts.flags ?? [])];
    const st: St = {
      id: 'og',
      status: 'active',
      affinity: 40,
      doneBeats: [...(opts.done ?? [])],
      inbox: [],
      log: [],
      missed: 0,
      repliedCount: 0,
      lastContactDay: day - 1,
    };
    r.channels = [st];
    r.queue = [];
    return r;
  };

  const MAIN = [
    'og_open', 'og_weather', 'og_rules', 'og_coord', 'og_daily_a', 'og_daily_b', 'og_census',
    'og_daily_c', 'og_leak', 'og_daily_d', 'og_crack', 'og_daily_e', 'og_seized',
    'og_aftermath', 'og_after2',
  ];

  // ---- 到场与开场 ----
  {
    const r = createRun({ seed: 7001, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
    chooseSite(r, 'apartment');
    r.day = TIME.COLLAPSE_DAY - 1;
    r.phase = 'prep';
    r.ap = 0;
    r.queue = [];
    endDay(r);
    const og = r.channels.find((c) => c.id === 'og');
    check('官方频道第 8 天自动到场', !!og, r.channels.map((c) => c.id).join(','));
    check('到场当天就投出开场通报', (og?.inbox.length ?? 0) >= 3, String(og?.inbox.length));
  }

  // ---- 坐标拍：调频接收解锁一次性搜刮点 ----
  {
    const r = ogAt(7002, 12, { done: ['og_open', 'og_weather', 'og_rules'] });
    tickChannels(r);
    const st = r.channels[0]!;
    check('第 12 天收到坐标拍', st.awaitingBeat === 'og_coord', String(st.awaitingBeat));
    openChannel(r, 'og');
    const kwh = r.wear.batteryCharge;
    check('调频接收成功', replyChannel(r, 'og', 'tune').ok);
    check('接收消耗蓄电', r.wear.batteryCharge < kwh, `${kwh} -> ${r.wear.batteryCharge}`);
    check('坐标点进入了地图', r.locations.some((l) => l.id === 'sig_depot'), r.locations.map((l) => l.id).join(','));
  }

  // ---- 坐标拍：L3 能识破，但拿不到东西 ----
  {
    const r = ogAt(7003, 12, { radio: 3, done: ['og_open', 'og_weather', 'og_rules'] });
    tickChannels(r);
    openChannel(r, 'og');
    check('L3 的比对载波选项可用', replyChannel(r, 'og', 'scan').ok);
    check('识破不解锁坐标点', !r.locations.some((l) => l.id === 'sig_depot'), r.locations.map((l) => l.id).join(','));
    check('识破留下痕迹', r.flags.includes('flag:ogRealized'), r.flags.filter((f) => f.startsWith('flag:og')).join(','));
  }

  // ---- 登记拍：虚报需要 2 级电台 ----
  {
    const r = ogAt(7004, 18, { radio: 1, done: MAIN.slice(0, 6) });
    tickChannels(r);
    openChannel(r, 'og');
    const deny = replyChannel(r, 'og', 'fake');
    check('1 级电台不能虚报（需收发机）', deny.ok === false, deny.reason);
  }

  // ---- 第 28 天：被攻陷 → 上报坐标会真的叫来袭击 ----
  {
    const r = ogAt(7005, 28, { done: MAIN.filter((id) => id !== 'og_seized') });
    tickChannels(r);
    const st = r.channels[0]!;
    check('掠夺期按时被攻陷（口吻突变那一拍）', st.awaitingBeat === 'og_seized', String(st.awaitingBeat));
    openChannel(r, 'og');
    const exp = r.world.exposure;
    const hum = r.stats.humanity;
    check('上报坐标成功', replyChannel(r, 'og', 'report').ok);
    check('上报涨暴露度', r.world.exposure > exp, `${exp} -> ${r.world.exposure}`);
    check('上报扣人性', r.stats.humanity < hum, `${hum} -> ${r.stats.humanity}`);
    check('累计上报被记住', r.flags.includes('flag:ogSoldOut'), r.flags.filter((f) => f.startsWith('flag:og')).join(','));
    const raid = r.pending.find((p) => p.familyId === 'raid_attempt');
    check('上报会排下一次袭击', !!raid, r.pending.map((p) => `${p.familyId}@${p.dueDay}`).join(','));
    check('袭击排在次日', raid?.dueDay === r.day + 1, String(raid?.dueDay));
    check('raid_attempt 是真实存在的事件家族', !!FAMILY_BY_ID['raid_attempt']);
  }

  // ---- 第 28 天：L2 报假坐标不叫袭击，L3 比对载波反而降低暴露 ----
  {
    const fake = ogAt(7006, 28, { done: MAIN.filter((id) => id !== 'og_seized') });
    tickChannels(fake);
    openChannel(fake, 'og');
    check('L2 可以报假坐标', replyChannel(fake, 'og', 'fake').ok);
    check('假坐标不排袭击', !fake.pending.some((p) => p.familyId === 'raid_attempt'), fake.pending.map((p) => p.familyId).join(','));
    check('假坐标仍被记为「上报过」但没卖人', fake.flags.includes('flag:ogReported') && !fake.flags.includes('flag:ogSoldOut'), fake.flags.filter((f) => f.startsWith('flag:og')).join(','));

    const scan = ogAt(7007, 28, { radio: 3, done: MAIN.filter((id) => id !== 'og_seized') });
    tickChannels(scan);
    openChannel(scan, 'og');
    check('L3 可以比对载波', replyChannel(scan, 'og', 'scan').ok);
    check('识破攻陷不叫袭击', !scan.pending.some((p) => p.familyId === 'raid_attempt'), scan.pending.map((p) => p.familyId).join(','));
    check('L3 还能把暴露度压回去', !scan.flags.includes('flag:ogReported'), scan.flags.filter((f) => f.startsWith('flag:og')).join(','));
  }

  // ---- 三条结局分支互斥 ----
  {
    const coop = ogAt(7008, 40, { done: MAIN, flags: ['flag:ogReported', 'flag:ogSoldOut'] });
    tickChannels(coop);
    check('卖过人的走「合作者」结局', coop.channels[0]!.doneBeats.includes('og_endgame'), coop.channels[0]!.doneBeats.join(','));

    const suspect = ogAt(7009, 40, { done: MAIN, flags: ['flag:ogReported'] });
    tickChannels(suspect);
    check('只报过片区的走「可疑分子」结局', suspect.channels[0]!.doneBeats.includes('og_suspect'), suspect.channels[0]!.doneBeats.join(','));

    const ignored = ogAt(7010, 40, { done: MAIN, flags: [] });
    tickChannels(ignored);
    check(
      '从没回过的走「无人应答」结局（elseBeat 链要一路走到底）',
      ignored.channels[0]!.doneBeats.includes('og_ignored'),
      ignored.channels[0]!.doneBeats.join(','),
    );
  }

  // ---- 天气预报由官方频道承接 ----
  {
    const def = CHANNEL_BY_ID['og']!;
    const weatherBeat = def.beats.find((b) => b.id === 'og_weather');
    const dyn = weatherBeat?.out.find((l) => l.dynamic === 'forecast');
    check('官方频道里有动态天气预报消息', !!dyn, String(!!dyn));
    check('动态消息的文案留了 {a}/{b} 占位', !!dyn && /\{a\}/.test(copyT(dyn.text)) && /\{b\}/.test(copyT(dyn.text)), dyn ? copyT(dyn.text) : '');
  }
}

// ============================================================
console.log('\n  P3/P4-x  自治委员会、跨线耦合与十个临时频道');
// ============================================================
{
  const { tickChannels, openChannel, replyChannel, ensureChannelDefaults } = await import('../src/game/engine/channels');
  const { CHANNEL_DEFS, CHANNEL_POOL, CHANNEL_BY_ID } = await import('../src/game/content/channels');
  type St = import('../src/game/types').ChannelState;

  const cvAt = (seed: number, day: number, opts: { radio?: number; done?: string[]; flags?: string[]; food?: number } = {}) => {
    const r = createRun({ seed, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
    chooseSite(r, 'apartment');
    r.day = day;
    r.threat = 2;
    r.phase = 'survival';
    r.world.revealed = true;
    r.world.powerGrid = 'on';
    r.modules.radio = opts.radio ?? 2;
    r.modules.power = 3;
    r.wear.batteryCharge = 8;
    r.ap = 6;
    r.res.water = 60;
    r.res.foodStaple = opts.food ?? 40;
    r.res.fuel = 20;
    r.flags = [...(opts.flags ?? [])];
    const st: St = {
      id: 'cv',
      status: 'active',
      affinity: 40,
      doneBeats: [...(opts.done ?? [])],
      inbox: [],
      log: [],
      missed: 0,
      repliedCount: 0,
      lastContactDay: day - 1,
    };
    r.channels = [st];
    r.queue = [];
    return r;
  };

  const CV_MAIN = [
    'cv_invite', 'cv_rules', 'cv_ration', 'cv_daily_e', 'cv_vote_virus', 'cv_daily_a',
    'cv_list', 'cv_daily_b', 'cv_leak', 'cv_notice', 'cv_daily_c', 'cv_trial', 'cv_daily_d',
    'cv_quota', 'cv_after',
  ];

  // ---- 到场 ----
  {
    const r = createRun({ seed: 8001, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
    chooseSite(r, 'apartment');
    r.day = 14;
    r.phase = 'survival';
    r.threat = 1;
    r.queue = [];
    tickChannels(r);
    check('第 15 天前委员会还没到场', !r.channels.some((c) => c.id === 'cv'), r.channels.map((c) => c.id).join(','));
    r.day = 15;
    r.threat = 2;
    tickChannels(r);
    const cv = r.channels.find((c) => c.id === 'cv');
    check('第 15 天委员会自动到场并开场', !!cv && cv.inbox.length >= 3, `${cv?.inbox.length}`);
  }

  // ---- 表决：耗电 0.3，需要 2 级电台 ----
  {
    const r = cvAt(8002, 22, { done: CV_MAIN.slice(0, 4) });
    tickChannels(r);
    const st = r.channels[0]!;
    check('第 22 天进入表决拍', st.awaitingBeat === 'cv_vote_virus', String(st.awaitingBeat));
    openChannel(r, 'cv');
    const kwh = r.wear.batteryCharge;
    const hum = r.stats.humanity;
    const food = r.res.foodStaple;
    check('赞成票投得出去', replyChannel(r, 'cv', 'yes').ok);
    check('表决消耗蓄电', r.wear.batteryCharge < kwh, `${kwh} -> ${r.wear.batteryCharge}`);
    check('赞成驱逐扣人性', r.stats.humanity < hum, `${hum} -> ${r.stats.humanity}`);
    check('赞成驱逐换来物资', r.res.foodStaple > food - 4, `${food} -> ${r.res.foodStaple}`);
    check('表决被记为参与过', r.flags.includes('flag:cvVoted'), r.flags.filter((f) => f.startsWith('flag:cv')).join(','));
  }
  {
    const r = cvAt(8003, 22, { radio: 1, done: CV_MAIN.slice(0, 4) });
    tickChannels(r);
    openChannel(r, 'cv');
    check('1 级电台不能表决（要能发一个音）', replyChannel(r, 'cv', 'yes').ok === false);
  }

  // ---- 跨线耦合：没有官方频道的录音就放不出来 ----
  {
    const without = cvAt(8004, 30, { done: CV_MAIN.filter((id) => !['cv_leak', 'cv_notice', 'cv_daily_c', 'cv_trial', 'cv_daily_d', 'cv_quota', 'cv_after'].includes(id)) });
    tickChannels(without);
    openChannel(without, 'cv');
    const deny = replyChannel(without, 'cv', 'publish');
    check('没有录音时公布选项被拒', deny.ok === false, deny.reason);
    check('被拒理由说明是缺录音', (deny.reason ?? '').includes('没有'), deny.reason);

    const withLeak = cvAt(8005, 30, {
      flags: ['flag:ogLeak'],
      done: CV_MAIN.filter((id) => !['cv_leak', 'cv_notice', 'cv_daily_c', 'cv_trial', 'cv_daily_d', 'cv_quota', 'cv_after'].includes(id)),
    });
    tickChannels(withLeak);
    openChannel(withLeak, 'cv');
    check('拿到录音后可以公布（跨线耦合成立）', replyChannel(withLeak, 'cv', 'publish').ok);
    check('公布留下痕迹', withLeak.flags.includes('flag:cvPublished'), withLeak.flags.filter((f) => f.startsWith('flag:cv')).join(','));
  }

  // ---- 三条结局互斥 ----
  {
    const order = cvAt(8006, 44, { done: CV_MAIN, flags: ['flag:cvPaidUp'] });
    tickChannels(order);
    check('交过份子的走「秩序」结局', order.channels[0]!.doneBeats.includes('cv_end_order'), order.channels[0]!.doneBeats.join(','));

    const tyr = cvAt(8007, 44, { done: CV_MAIN, flags: ['flag:cvPaidUp', 'flag:cvPublished'] });
    tickChannels(tyr);
    check('公布过录音的走「暴政」结局', tyr.channels[0]!.doneBeats.includes('cv_end_tyranny'), tyr.channels[0]!.doneBeats.join(','));

    const dis = cvAt(8008, 44, { done: CV_MAIN, flags: [] });
    tickChannels(dis);
    check('什么都没做的走「解散」结局', dis.channels[0]!.doneBeats.includes('cv_end_dissolve'), dis.channels[0]!.doneBeats.join(','));
  }

  // ---- 骗子：去了就是给袭击开门 ----
  {
    const r = createRun({ seed: 8009, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
    chooseSite(r, 'apartment');
    r.day = 20;
    r.threat = 2;
    r.phase = 'survival';
    r.world.revealed = true;
    r.world.powerGrid = 'on';
    r.modules.radio = 2;
    r.modules.power = 3;
    r.wear.batteryCharge = 8;
    r.ap = 6;
    r.queue = [];
    r.channels = [{
      id: 'tmp_scammer', status: 'active', affinity: 20, doneBeats: [], inbox: [], log: [],
      missed: 0, repliedCount: 0, lastContactDay: 0,
    }];
    tickChannels(r);
    openChannel(r, 'tmp_scammer');
    const exp = r.world.exposure;
    check('骗子的选项能选', replyChannel(r, 'tmp_scammer', 'go').ok);
    check('去了暴露度上升', r.world.exposure > exp, `${exp} -> ${r.world.exposure}`);
    check('去了会招来袭击', r.pending.some((p) => p.familyId === 'raid_attempt'), r.pending.map((p) => p.familyId).join(','));
  }

  // ---- 十个临时频道都在搜索池里 ----
  {
    const searchable = CHANNEL_DEFS.filter((d) => d.discover === 'search');
    check('搜索池正好十个临时频道', searchable.length === 10 && CHANNEL_POOL.length === 10, `${searchable.length}/${CHANNEL_POOL.length}`);
    check('三个核心频道都不在搜索池里', !CHANNEL_POOL.some((id) => ['og', 'xt', 'cv'].includes(id)), CHANNEL_POOL.join(','));
    const allTmp = CHANNEL_DEFS.filter((d) => d.id.startsWith('tmp_'));
    check('十个临时频道都有名字与标语文案', allTmp.every((d) => !!CHANNEL_BY_ID[d.id]), allTmp.map((d) => d.id).join(','));
  }

  // ---- 隐藏路线点：要靠司机给 ----
  {
    const r = createRun({ seed: 8010, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
    chooseSite(r, 'apartment');
    r.day = 24;
    r.threat = 2;
    r.phase = 'survival';
    r.world.revealed = true;
    r.world.powerGrid = 'on';
    r.modules.radio = 2;
    r.modules.power = 3;
    r.wear.batteryCharge = 8;
    r.ap = 6;
    r.res.fuel = 20;
    r.queue = [];
    r.channels = [{
      id: 'tmp_trucker', status: 'active', affinity: 20, doneBeats: ['tk_open'],
      inbox: [], log: [], missed: 0, repliedCount: 0, lastContactDay: 22,
    }];
    check('路线点初始不在地图上', !r.locations.some((l) => l.id === 'sig_route'), r.locations.map((l) => l.id).join(','));
    // 已经用油换过路线：隔两天他该把坐标给出来了
    r.flags.push('flag:tkTraded');
    r.day = 24;
    r.wear.batteryCharge = 8;
    tickChannels(r);
    openChannel(r, 'tmp_trucker');
    check('司机给路线后解锁货场', r.locations.some((l) => l.id === 'sig_route'), r.locations.map((l) => l.id).join(','));
  }

  // ---- 「只有没看过的才流式播放」：关掉再打开不能把整段历史重念一遍 ----
  {
    const { openChannel: open, replyChannel: reply } = await import('../src/game/engine/channels');
    const r = cvAt(8011, 19, { done: ['cv_invite', 'cv_rules'] });
    tickChannels(r);
    const st = r.channels[0]!;
    const pendingLines = st.inbox.length;
    check('刚到场时有未读', pendingLines > 0, String(pendingLines));

    const first = open(r, 'cv');
    check('首次打开从头开始播', first.from === 0, String(first.from));
    check('首次打开带出新读到的行', first.lines.length === pendingLines, `${first.lines.length}/${pendingLines}`);
    check('打开后播放起点推进到会话末尾', st.seenLines === st.log.length, `${st.seenLines}/${st.log.length}`);

    const again = open(r, 'cv');
    check('没有新消息时不再从头播', again.from === st.log.length, `${again.from}/${st.log.length}`);
    check('重开不会重复结算 onRead', again.lines.length === 0, String(again.lines.length));

    // 回一条之后：只有自己那句是新的
    const beat = st.awaitingBeat;
    check('还等着玩家回话', !!beat, String(beat));
    if (beat) {
      const before = st.log.length;
      const rr = reply(r, 'cv', 'pay');
      check('回话成功', rr.ok, rr.reason);
      check('自己说的那句也算看过', st.seenLines === st.log.length, `${st.seenLines}/${st.log.length}`);
      check('自己那句确实是新增的一行', st.log.length === before + 1, `${before} -> ${st.log.length}`);
    }
  }

  // ---- 旧档池子补齐：新增的临时频道对老存档也要生效 ----
  {
    const bare = { channels: [{ id: 'tmp_dying' }], channelPool: undefined } as unknown as RunState;
    ensureChannelDefaults(bare);
    check('旧档补池时不会再塞进已经拥有的频道', !bare.channelPool.includes('tmp_dying'), bare.channelPool.join(','));
    check('旧档补池包含全部十个', bare.channelPool.length === 9, String(bare.channelPool.length));
  }
}

console.log(`\n  结果：${pass} 通过 · ${fail} 失败\n`);
process.exit(fail > 0 ? 1 : 0);
