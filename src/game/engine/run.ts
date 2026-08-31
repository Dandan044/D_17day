/**
 * 单局生命周期：创建、选址、每日推进、阶段切换。
 */

import { AP, DIRECTOR, INTEL, POWER, START_RES, START_STATS, TIME, threatOfDay } from '../balance';
import { CLASS_BY_ID, PACK_BY_ID } from '../content/classes';
import { DISASTER_BY_ID } from '../content/disasters';
import { FAMILY_BY_ID } from '../content/events';
import { INTEL_POOL } from '../content/intel';
import { LOCATIONS } from '../content/locations';
import { MODULE_IDS } from '../content/modules';
import { SITE_BY_ID } from '../content/sites';
import { makeRng, type Rng } from '../rng';
import type {
  Difficulty,
  DisasterId,
  IntelReading,
  ModuleId,
  ResourceId,
  RunState,
  SiteId,
  SkillId,
  StatId,
} from '../types';
import { assessCollapse } from './collapse';
import { advanceProjects } from './construction';
import { recordBeat, selectEvents, applyDirectorBoost } from './director';
import { addLog, applyEffect, clampResources } from './effects';
import { applyProduction, consumeDaily, revealSecrets, spoilFood } from './economy';
import { resolveEnding } from './endings';
import { emitHook, emitThresholdHooks, collectThresholdForced } from './hooks';
import { applyDailyExposure, pickPressureFamily, resolveRaid, type RaidResult } from './exposure';
import { resolveHealth } from './health';
import { checkRequirement, deriveFacts, effectiveModule } from './tags';
import { advanceWorldPrep, advanceWorldSurvival, applyOnset, createWorld } from './world';

export interface CreateRunOptions {
  seed: number;
  classId: string;
  packId: string;
  difficulty: Difficulty;
  metaPerks: string[];
  /** 强制指定灾难，用于调试 */
  forceDisaster?: DisasterId;
}

export function createRun(opts: CreateRunOptions): RunState {
  const rng = makeRng(opts.seed);
  const disaster = opts.forceDisaster ?? 'nuclear';
  const cls = CLASS_BY_ID[opts.classId] ?? CLASS_BY_ID['clerk']!;
  const pack = PACK_BY_ID[opts.packId] ?? PACK_BY_ID['none']!;

  const abilities = [...opts.metaPerks, cls.perk];

  const res = { ...START_RES } as Record<ResourceId, number>;
  for (const [k, v] of Object.entries(cls.res)) res[k as ResourceId] += v ?? 0;
  for (const [k, v] of Object.entries(pack.res)) res[k as ResourceId] += v ?? 0;

  const stats = { ...START_STATS } as Record<StatId, number>;
  if (cls.perk === 'hoarder_stash') stats.sanity -= 15;
  if (abilities.includes('perk_reputation')) stats.reputation += 20;

  const skills: Record<SkillId, number> = {
    medicine: 0,
    mechanics: 0,
    negotiation: 0,
    fitness: 0,
    stealth: 0,
  };
  for (const [k, v] of Object.entries(cls.skills)) skills[k as SkillId] += v ?? 0;

  const modules = {} as Record<ModuleId, number>;
  for (const id of MODULE_IDS) modules[id] = 0;
  for (const [k, v] of Object.entries(cls.modules ?? {})) modules[k as ModuleId] = v ?? 0;

  let apMax = cls.apMax;
  if (abilities.includes('perk_wellprepared')) apMax += 1;

  const world = createWorld(disaster, rng);
  if (abilities.includes('perk_reputation')) world.neighborhood += 20;

  const run: RunState = {
    seed: opts.seed,
    rngCursor: rng.cursor(),
    phase: 'siteSelect',
    day: 1,
    threat: 0,
    ap: apMax,
    apMax,
    classId: cls.id,
    packId: pack.id,
    siteId: null,
    difficulty: opts.difficulty,
    abilities,
    res,
    stats,
    skills,
    conditions: [],
    modules,
    projects: [],
    wear: { filterLife: 20, generatorOil: 24, batteryCharge: 0 },
    streaks: { lowRation: 0, noThreatDays: 0, goodRation: 0 },
    ration: 'normal',
    waterUse: 'normal',
    heatMode: 'off',
    powerPriority: [...POWER.DEFAULT_PRIORITY],
    powerEnabled: {},
    directorBoost: {},
    thresholdFired: {},
    survivors: [],
    locations: LOCATIONS.map((l) => ({ id: l.id, stock: l.stock })),
    visitedToday: [],
    boughtToday: {},
    hasVehicle: cls.perk === 'trucker_vehicle',
    world,
    intel: [],
    flags: [...(cls.tags ?? [])],
    eventHistory: {},
    recentBeats: [],
    pending: [],
    queue: [],
    log: [],
    stats_meta: { daysSurvived: 0, scavengeRuns: 0, raidsRepelled: 0, peopleHelped: 0, peopleRefused: 0 },
  };

  if (run.hasVehicle) run.flags.push('flag:hasVehicle');
  clampResources(run);
  generateIntel(run, rng);
  addLog(
    run,
    '新闻里那条消息你已经刷到第四遍了。前三遍你都当成了噪音。这一遍你放下了手机，开始算家里还有多少水。',
    'neutral',
  );
  run.rngCursor = rng.cursor();
  return run;
}

/** 站点选择：付出成本，继承站点的初始模块 */
export function chooseSite(run: RunState, siteId: SiteId): { ok: boolean; reason?: string } {
  const site = SITE_BY_ID[siteId];
  if (!site) return { ok: false, reason: '没有这个站点' };
  if (site.wip) return { ok: false, reason: '这个住所还在开发中' };

  if (site.cost.cash && run.res.cash < site.cost.cash) {
    return { ok: false, reason: `需要 ${site.cost.cash} 元` };
  }
  if (site.cost.requires?.res) {
    for (const [k, v] of Object.entries(site.cost.requires.res)) {
      if (run.res[k as ResourceId] < (v ?? 0)) return { ok: false, reason: site.cost.requires.reason };
    }
  }
  if (site.cost.requires?.skills) {
    for (const [k, v] of Object.entries(site.cost.requires.skills)) {
      if (run.skills[k as SkillId] < (v ?? 0)) return { ok: false, reason: site.cost.requires.reason };
    }
  }
  if (site.cost.requires?.tags?.all?.includes('hasVehicle') && !run.hasVehicle) {
    return { ok: false, reason: site.cost.requires.reason ?? '需要一辆车' };
  }

  if (site.cost.cash) run.res.cash -= site.cost.cash;
  if (site.cost.requires?.res?.parts) run.res.parts -= site.cost.requires.res.parts;
  if (site.cost.ap) run.ap = Math.max(0, run.ap - site.cost.ap);

  run.siteId = siteId;
  for (const [k, v] of Object.entries(site.baseModules)) {
    run.modules[k as ModuleId] = Math.max(run.modules[k as ModuleId], v ?? 0);
  }
  run.phase = 'prep';
  clampResources(run);

  addLog(run, `你决定把这里作为据点：${site.name}。${site.desc.split('。')[0]}。`, 'neutral');
  return { ok: true };
}

// ============================================================
// 情报
// ============================================================

export function generateIntel(run: RunState, rng: Rng): void {
  const actual = run.world.disaster;
  let truthRatio =
    INTEL.TRUTH_RATIO + effectiveModule(run, 'radio') * INTEL.RADIO_BONUS + run.day * INTEL.DAY_BONUS;
  if (run.abilities.includes('hacker_analysis')) truthRatio += 0.2;
  if (run.abilities.includes('perk_analyst')) truthRatio += INTEL.PERK_BONUS;
  if (run.flags.includes('flag:intelBonus')) truthRatio += 0.12;
  truthRatio = Math.min(0.9, truthRatio);

  const seen = new Set(run.intel.map((i) => i.id));
  const avail = INTEL_POOL.filter((i) => !seen.has(i.id) && (i.minDay ?? 1) <= run.day);
  const truthful = avail.filter((i) => i.points === actual);
  const misleading = avail.filter((i) => i.points !== actual && i.points !== 'none');
  const noise = avail.filter((i) => i.points === 'none');

  const out: IntelReading[] = [];
  for (let i = 0; i < INTEL.PER_DAY; i++) {
    const roll = rng.next();
    let pool = roll < truthRatio ? truthful : roll < truthRatio + 0.32 ? misleading : noise;
    if (pool.length === 0) pool = truthful.length ? truthful : misleading.length ? misleading : noise;
    if (pool.length === 0) break;
    const item = rng.pick(pool);
    pool.splice(pool.indexOf(item), 1);
    out.push({ ...item, day: run.day, truthful: item.points === actual });
  }
  run.intel.push(...out);
}

/** 玩家花 1 AP 核实一条情报 */
export function verifyIntel(run: RunState, intelId: string): { ok: boolean; reason?: string } {
  if (run.ap < 1) return { ok: false, reason: '行动点不足' };
  const item = run.intel.find((i) => i.id === intelId && i.day === run.day);
  if (!item) return { ok: false, reason: '这条情报已经过时了' };
  if (item.verified) return { ok: false, reason: '已经核实过' };
  run.ap -= 1;
  item.verified = true;
  return { ok: true };
}

// ============================================================
// 每日推进
// ============================================================

export interface NightReport {
  day: number;
  notes: string[];
  healthNotes: string[];
  hpDelta?: number;
  hpParts?: Array<{ label: string; value: number }>;
  hpAfter?: number;
  indoor?: number;
  outdoor?: number;
  exposureAdded: number;
  died: boolean;
  cause?: string;
  weekly: boolean;
  collapsed: boolean;
}

function computeAp(run: RunState): number {
  let ap = run.day < TIME.COLLAPSE_DAY ? AP.PREP_BASE : AP.SURVIVAL_BASE;
  const cls = CLASS_BY_ID[run.classId];
  if (cls) ap += cls.apMax - AP.PREP_BASE;
  if (run.abilities.includes('perk_wellprepared')) ap += 1;
  if (run.stats.stamina < AP.LOW_STAMINA) ap -= 1;
  if (run.stats.stamina < AP.CRITICAL_STAMINA) ap -= 1;
  if (run.conditions.includes('fracture')) ap -= 1;
  // 健康的同伴帮你分担杂务
  ap += Math.min(2, Math.floor(run.survivors.filter((s) => s.conditions.length === 0).length / 2));
  return Math.max(1, ap);
}

export function endDay(run: RunState): NightReport {
  const rng = makeRng(run.seed, run.rngCursor);
  const report: NightReport = {
    day: run.day,
    notes: [],
    healthNotes: [],
    exposureAdded: 0,
    died: false,
    weekly: false,
    collapsed: false,
  };

  const isPrep = run.day < TIME.COLLAPSE_DAY;

  // ---------- 夜间结算 ----------
  if (isPrep) {
    // 准备期自来水和超市还在，不做配给结算
    report.notes.push(...spoilFood(run));
    report.notes.push(...advanceProjects(run, rng));
    advanceWorldPrep(run, rng);
    report.notes.push(`物价指数升到 ${run.world.priceIndex.toFixed(2)}`);
  } else {
    report.notes.push(...applyProduction(run));
    report.notes.push(...spoilFood(run));
    for (const secret of revealSecrets(run)) {
      addLog(run, secret, 'grim');
      report.notes.push('有人终于说了实话（见日记）');
    }
    const consume = consumeDaily(run, rng, run.difficulty);
    report.notes.push(...consume.notes);
    report.indoor = consume.indoor;
    report.outdoor = run.world.temperature;
    const health = resolveHealth(run, consume, rng);
    report.healthNotes = health.notes;
    report.hpDelta = health.hpDelta;
    report.hpParts = health.hpParts.filter((p) => p.value !== 0);
    report.hpAfter = Math.round(run.stats.hp);
    report.notes.push(...advanceProjects(run, rng));

    const exposure = applyDailyExposure(run);
    report.exposureAdded = exposure.total;

    advanceWorldSurvival(run, rng);

    if (health.dead) {
      report.died = true;
      report.cause = health.cause;
    }
  }

  clampResources(run);

  // ---------- 死亡判定 ----------
  if (report.died && run.difficulty !== 'story') {
    const ending = resolveEnding(run, report.cause);
    run.endingId = ending.id;
    run.phase = 'ended';
    run.stats_meta.daysSurvived = run.day;
    run.rngCursor = rng.cursor();
    return report;
  }
  if (report.died) {
    run.stats.hp = 20;
    report.notes.push('（叙事模式）你本该死在这一天。');
  }

  // ---------- 进入下一天 ----------
  run.day += 1;
  if (run.flags.includes('flag:iodine') && run.iodineUntil !== undefined && run.day >= run.iodineUntil) {
    run.flags = run.flags.filter((f) => f !== 'flag:iodine');
    addLog(run, '碘片的保护过期了。甲状腺又暴露在外面。', 'bad');
  }
  const newThreat = threatOfDay(run.day);
  if (newThreat > run.threat && run.day > TIME.COLLAPSE_DAY) report.weekly = true;
  run.threat = newThreat;
  run.stats_meta.daysSurvived = run.day - 1;

  if (run.day > TIME.FINAL_DAY) {
    const ending = resolveEnding(run);
    run.endingId = ending.id;
    run.phase = 'ended';
    run.rngCursor = rng.cursor();
    return report;
  }

  run.apMax = computeAp(run);
  run.ap = run.apMax;
  run.queue = [];
  run.visitedToday = [];
  run.boughtToday = {};

  // ---------- 崩溃日 ----------
  if (run.day === TIME.COLLAPSE_DAY) {
    run.phase = 'collapse';
    applyOnset(run, rng);
    run.collapseReport = assessCollapse(run, rng);
    clampResources(run);
    report.collapsed = true;
    run.rngCursor = rng.cursor();
    return report;
  }

  // ---------- 生成新一天的内容 ----------
  if (run.day < TIME.COLLAPSE_DAY) {
    generateIntel(run, rng);
    const { picks } = selectEvents(run, rng, rng.int(DIRECTOR.PREP_EVENTS_PER_DAY[0], DIRECTOR.PREP_EVENTS_PER_DAY[1]));
    run.queue = picks;
  } else {
    const forced: string[] = [];
    const pressure = pickPressureFamily(run, rng);
    if (pressure) forced.push(pressure);
    forced.push(...collectThresholdForced(run));
    const count = rng.int(DIRECTOR.EVENTS_PER_DAY[0], DIRECTOR.EVENTS_PER_DAY[1]);
    const { picks } = selectEvents(run, rng, Math.max(count, forced.length), forced);
    run.queue = picks;
  }
  emitHook(run, 'endDay', rng);
  if (report.weekly) emitHook(run, 'threatUp', rng);
  if (!isPrep) emitThresholdHooks(run, rng);

  run.rngCursor = rng.cursor();
  return report;
}

/** 崩溃日的确认：从 collapse 进入 survival */
export function acknowledgeCollapse(run: RunState): void {
  const rng = makeRng(run.seed, run.rngCursor);
  run.phase = 'survival';
  const def = DISASTER_BY_ID[run.world.disaster];
  addLog(run, def.reveal.split('\n')[0] ?? def.revealTitle, 'grim');

  const forced: string[] = [];
  const pressure = pickPressureFamily(run, rng);
  if (pressure) forced.push(pressure);
  const { picks } = selectEvents(run, rng, 1, forced);
  run.queue = picks;
  emitHook(run, 'collapse', rng);
  run.rngCursor = rng.cursor();
}

/** 结算一个事件选项 */
export interface ResolveChoiceResult {
  notes: string[];
  checkRoll?: { roll: number; total: number; dc: number; success: boolean; skill: SkillId };
  raid?: RaidResult;
  died?: boolean;
}

export function resolveChoice(
  run: RunState,
  familyId: string,
  variantId: string,
  choiceId: string,
): ResolveChoiceResult {
  const rng = makeRng(run.seed, run.rngCursor);
  const out: ResolveChoiceResult = { notes: [] };

  const family = FAMILY_BY_ID[familyId];
  const variant = family?.variants.find((v) => v.id === variantId);
  const choice = variant?.choices.find((c) => c.id === choiceId);
  if (!family || !variant || !choice) return out;

  const req = checkRequirement(choice.requires, run, deriveFacts(run));
  if (!req.ok) {
    out.notes.push(req.reason ?? '现在做不到这一步');
    return out;
  }

  const factsBefore = deriveFacts(run);
  if (choice.check) {
    const roll = rng.d20();
    const skillVal = run.skills[choice.check.skill];
    const total = roll + skillVal;
    const success = total >= choice.check.dc;
    out.checkRoll = { roll, total, dc: choice.check.dc, success, skill: choice.check.skill };
    out.notes.push(...applyEffect(run, success ? choice.check.ok : choice.check.bad, rng));
  } else if (choice.effect) {
    out.notes.push(...applyEffect(run, choice.effect, rng));
  }

  applyDirectorBoost(run, factsBefore);

  // 车辆与宠物这类由标签驱动的状态需要同步到结构化字段
  if (run.flags.includes('flag:hasVehicle')) run.hasVehicle = true;

  // 选项只表达"你怎么应对"，实际的攻防结算在这里发生
  const defending = run.flags.includes('flag:raidDefend');
  const hiding = run.flags.includes('flag:raidHide');
  if (defending || hiding) {
    run.flags = run.flags.filter((f) => f !== 'flag:raidDefend' && f !== 'flag:raidHide');
    // 躲起来保命但守不住东西；土制警报能争取到反应时间
    const strength = hiding ? 1.35 : 1;
    const raid = resolveRaid(run, rng, strength);
    out.raid = raid;
    addLog(run, raid.narrative, raid.repelled ? 'good' : 'bad');
    if (!raid.repelled) {
      const stolen = Object.entries(raid.lost)
        .map(([k, v]) => `${k} -${v}`)
        .length;
      if (stolen > 0) out.notes.push('物资被抢走了一部分');
    }
    if (raid.usedAmmo > 0) out.notes.push(`消耗弹药 ${raid.usedAmmo} 发`);
    if (raid.moduleDamaged) out.notes.push(`${raid.moduleDamaged}被破坏，等级下降`);
    emitHook(run, raid.repelled ? 'raidRepelled' : 'raidFailed', rng);
    emitHook(run, 'raid', rng);
    if (run.stats.hp <= 0) {
      if (run.difficulty === 'story') {
        run.stats.hp = 20;
        out.notes.push('（叙事模式）袭击本可以要了你的命。');
      } else {
        const ending = resolveEnding(run, '袭击');
        run.endingId = ending.id;
        run.phase = 'ended';
        run.stats_meta.daysSurvived = run.day;
        out.died = true;
      }
    }
  }

  recordBeat(run, familyId);
  run.queue = run.queue.filter((q) => !(q.familyId === familyId && q.variantId === variantId));
  emitHook(run, 'choice', rng);
  clampResources(run);
  run.rngCursor = rng.cursor();
  return out;
}
