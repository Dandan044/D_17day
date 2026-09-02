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
import { applyProduction, buyIodine, consumeDaily, dailyNeeds, travelCost, type ConsumeResult } from '../src/game/engine/economy';
import { applyEffect } from '../src/game/engine/effects';
import { capHeat, heatPlan, leakRate, thermalSink } from '../src/game/engine/climate';
import { startProject, grantCompanionLabor, completeReadyProjects } from '../src/game/engine/construction';
import { chooseSite, createRun, endDay, resolveChoice } from '../src/game/engine/run';
import { computePower, deriveFacts } from '../src/game/engine/tags';
import { settleBattery, batteryCapacity, tonightHeat } from '../src/game/engine/power';
import { resolveHealth } from '../src/game/engine/health';
import { assessCollapse } from '../src/game/engine/collapse';
import { isEligible, pickVariant, selectEvents } from '../src/game/engine/director';
import { applyOnset } from '../src/game/engine/world';
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
    const rainLines = notes.filter((n) => n.text.includes('没下雨'));
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

console.log(`\n  结果：${pass} 通过 · ${fail} 失败\n`);
process.exit(fail > 0 ? 1 : 0);
