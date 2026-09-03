/**
 * 单局生命周期：创建、选址、每日推进、阶段切换。
 */

import { AP, BANK, COLD, DIRECTOR, INTEL, POWER, START_RES, START_STATS, TIME, WEAR, threatOfDay } from '../balance';
import { t } from '../copy/t';
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
import { ledger, type LedgerNote } from './ledger';
import { settleBattery, tonightHeat } from './power';
import { checkRequirement, deriveFacts, effectiveModule } from './tags';
import {
  applyOnset,
  createWorld,
  tickClimate,
  tickPrepEconomy,
  tickSurvivalPressures,
} from './world';

export type { LedgerNote, LedgerTone } from './ledger';
export { ledger } from './ledger';

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
  // 「取出来的钱」：开局把银行存款提现一半，剩一半留在银行
  const cashout = abilities.includes('perk_cashout');
  if (cashout) res.cash += BANK.SAVINGS / 2;

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
    conditionAge: {},
    modules,
    projects: [],
    wear: { filterLife: WEAR.FILTER_LIFE, generatorOil: WEAR.GENERATOR_OIL, batteryCharge: 0 },
    streaks: { lowRation: 0, noThreatDays: 0, goodRation: 0, belowSurvival: 0 },
    ration: 'normal',
    waterUse: 'normal',
    heatMode: 'off',
    heatTarget: COLD.COMFORT,
    indoorTemp: COLD.PREP_INDOOR,
    powerPriority: [...POWER.DEFAULT_PRIORITY],
    powerEnabled: {},
    directorBoost: {},
    thresholdFired: {},
    survivors: [],
    locations: LOCATIONS.map((l) => ({ id: l.id, stock: l.stock })),
    visitedToday: [],
    boughtToday: {},
    savings: cashout ? BANK.SAVINGS / 2 : BANK.SAVINGS,
    atmUsed: 0,
    hasVehicle: cls.perk === 'trucker_vehicle',
    world,
    intel: [],
    flags: [...(cls.tags ?? [])],
    eventHistory: {},
    recentBeats: [],
    pending: [],
    pendingUnlocks: [],
    seenVariants: [],
    queue: [],
    log: [],
    stats_meta: { daysSurvived: 0, scavengeRuns: 0, raidsRepelled: 0, peopleHelped: 0, peopleRefused: 0 },
  };

  if (run.hasVehicle) run.flags.push('flag:hasVehicle');
  clampResources(run);
  generateIntel(run, rng);
  addLog(run, t('ledger.run.intro'), 'neutral');
  run.rngCursor = rng.cursor();
  return run;
}

/** 站点选择：付出成本，继承站点的初始模块 */
export function chooseSite(run: RunState, siteId: SiteId): { ok: boolean; reason?: string } {
  const site = SITE_BY_ID[siteId];
  if (!site) return { ok: false, reason: t('ledger.run.noSite') };
  if (site.wip) return { ok: false, reason: t('ledger.run.siteWip') };

  if (site.cost.cash && run.res.cash < site.cost.cash) {
    return { ok: false, reason: t('ledger.run.needCash', { cash: site.cost.cash }) };
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
    return { ok: false, reason: site.cost.requires.reason ?? t('ledger.run.needCar') };
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

  addLog(run, t('ledger.run.choseSite', { name: site.name, desc: site.desc.split('。')[0] }), 'neutral');
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

  const seenToday = new Set<string>();
  const allTruthful = INTEL_POOL.filter((i) => i.points === actual && (i.minDay ?? 1) <= run.day);
  const allMisleading = INTEL_POOL.filter((i) => i.points !== actual && i.points !== 'none' && (i.minDay ?? 1) <= run.day);
  const allNoise = INTEL_POOL.filter((i) => i.points === 'none' && (i.minDay ?? 1) <= run.day);

  const unused = (pool: typeof INTEL_POOL) => pool.filter((i) => !seen.has(i.id) && !seenToday.has(i.id));

  const out: IntelReading[] = [];
  for (let i = 0; i < INTEL.PER_DAY; i++) {
    const roll = rng.next();
    const want: 'truth' | 'mislead' | 'noise' = roll < truthRatio ? 'truth' : roll < truthRatio + 0.32 ? 'mislead' : 'noise';
    const pickFrom = (fresh: typeof INTEL_POOL, fallback: typeof INTEL_POOL) => {
      const a = unused(fresh);
      if (a.length > 0) return rng.pick(a);
      const b = fallback.filter((x) => !seenToday.has(x.id));
      if (b.length > 0) return rng.pick(b);
      return null;
    };
    let item =
      want === 'truth'
        ? pickFrom(avail.filter((x) => x.points === actual), allTruthful)
        : want === 'mislead'
          ? pickFrom(avail.filter((x) => x.points !== actual && x.points !== 'none'), allMisleading)
          : pickFrom(avail.filter((x) => x.points === 'none'), allNoise);
    if (!item) item = pickFrom(avail, INTEL_POOL);
    if (!item) break;
    seenToday.add(item.id);
    out.push({ ...item, day: run.day, truthful: item.points === actual });
  }
  run.intel.push(...out);
}

/** 玩家花 1 AP 核实一条情报 */
export function verifyIntel(run: RunState, intelId: string): { ok: boolean; reason?: string } {
  if (run.ap < 1) return { ok: false, reason: t('ledger.run.noAp') };
  const item = run.intel.find((i) => i.id === intelId && i.day === run.day);
  if (!item) return { ok: false, reason: t('ledger.run.intelStale') };
  if (item.verified) return { ok: false, reason: t('ledger.run.intelDone') };
  run.ap -= 1;
  item.verified = true;
  return { ok: true };
}

// ============================================================
// 每日推进
// ============================================================

export interface NightReport {
  day: number;
  notes: LedgerNote[];
  healthNotes: LedgerNote[];
  hpDelta?: number;
  hpParts?: Array<{ label: string; value: number }>;
  hpAfter?: number;
  indoor?: number;
  outdoor?: number;
  previewIndoor?: number;
  fuelBudget?: number;
  fuelSpent?: number;
  kwhBudget?: number;
  kwhSpent?: number;
  exposureAdded: number;
  exposureDecay?: number;
  exposureAfter?: number;
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
    run.indoorTemp = COLD.PREP_INDOOR;
    // 准备期自来水和超市还在，不做配给结算，生鲜也不按冰箱没电腐
    report.notes.push(...advanceProjects(run, rng).map((t) => ledger(t)));
    tickPrepEconomy(run, rng);
    report.notes.push(ledger(t('ledger.run.price', { idx: run.world.priceIndex.toFixed(2) })));
  } else {
    report.notes.push(...applyProduction(run));
    report.notes.push(...spoilFood(run));
    for (const secret of revealSecrets(run)) {
      addLog(run, secret, 'grim');
      report.notes.push(ledger(t('ledger.run.secret')));
    }
    const budget = tonightHeat(run).plan;
    const nightWeather = run.world.weather;
    tickClimate(run, rng, run.day + 1);
    const consume = consumeDaily(run, rng, run.difficulty, budget, nightWeather);
    report.notes.push(...consume.notes);
    report.indoor = consume.indoor;
    report.outdoor = run.world.temperature;
    report.previewIndoor = consume.previewIndoor;
    report.fuelBudget = consume.fuelBudget;
    report.fuelSpent = consume.fuelSpent;
    report.kwhBudget = consume.kwhBudget;
    report.kwhSpent = consume.kwhSpent;
    const health = resolveHealth(run, consume, rng);
    report.healthNotes = health.notes;
    report.hpDelta = health.hpDelta;
    report.hpParts = health.hpParts.filter((p) => p.value !== 0);
    report.hpAfter = Math.round(run.stats.hp);
    settleBattery(run);
    report.notes.push(...advanceProjects(run, rng).map((t) => ledger(t)));

    const exposure = applyDailyExposure(run);
    report.exposureAdded = exposure.total;
    report.exposureAfter = Math.round(run.world.exposure * 10) / 10;

    tickSurvivalPressures(run, rng);

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
    report.notes.push(ledger(t('ledger.run.storyLive')));
  }

  // ---------- 进入下一天 ----------
  run.day += 1;
  if (run.flags.includes('flag:iodine') && run.iodineUntil !== undefined && run.day >= run.iodineUntil) {
    run.flags = run.flags.filter((f) => f !== 'flag:iodine');
    addLog(run, t('ledger.run.iodineEnd'), 'bad');
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
  run.atmUsed = 0;

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
    tickClimate(run, rng);
  } else {
    const forced: string[] = [];
    const pressure = pickPressureFamily(run, rng);
    if (pressure) forced.push(pressure);
    forced.push(...collectThresholdForced(run));
    const count = rng.int(DIRECTOR.EVENTS_PER_DAY[0], DIRECTOR.EVENTS_PER_DAY[1]);
    const { picks } = selectEvents(run, rng, Math.max(count, forced.length + 1), forced);
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
    out.notes.push(req.reason ?? t('ledger.run.cannot'));
    return out;
  }

  const factsBefore = deriveFacts(run);
  if (!run.seenVariants) run.seenVariants = [];
  const seenKey = `${familyId}/${variantId}`;
  if (!run.seenVariants.includes(seenKey)) run.seenVariants.push(seenKey);
  let applied = choice.effect;
  if (choice.check) {
    const roll = rng.d20();
    const skillVal = run.skills[choice.check.skill];
    const total = roll + skillVal;
    const success = total >= choice.check.dc;
    out.checkRoll = { roll, total, dc: choice.check.dc, success, skill: choice.check.skill };
    applied = success ? choice.check.ok : choice.check.bad;
    out.notes.push(...applyEffect(run, applied, rng));
  } else if (choice.effect) {
    out.notes.push(...applyEffect(run, choice.effect, rng));
  }

  applyDirectorBoost(run, factsBefore);

  // 车辆与宠物这类由标签驱动的状态需要同步到结构化字段
  if (run.flags.includes('flag:hasVehicle')) run.hasVehicle = true;

  const firedTonight =
    !!applied?.setFlags?.includes('flag:firedWarning') || (applied?.res?.ammo ?? 0) < 0;

  // 选项只表达"你怎么应对"，实际的攻防结算在这里发生
  const defending = run.flags.includes('flag:raidDefend');
  const hiding = run.flags.includes('flag:raidHide');
  if (defending || hiding) {
    run.flags = run.flags.filter((f) => f !== 'flag:raidDefend' && f !== 'flag:raidHide');
    // 躲起来保命但守不住东西；土制警报能争取到反应时间
    const strength = hiding ? 1.35 : 1;
    const raid = resolveRaid(run, rng, strength, firedTonight);
    out.raid = raid;
    addLog(run, raid.narrative, raid.repelled ? 'good' : 'bad');
    if (!raid.repelled) {
      const stolen = Object.entries(raid.lost)
        .map(([k, v]) => `${k} -${v}`)
        .length;
      if (stolen > 0) out.notes.push(t('ledger.run.stolen'));
    }
    if (raid.usedAmmo > 0) out.notes.push(t('ledger.run.ammo', { n: raid.usedAmmo }));
    if (raid.moduleDamaged) out.notes.push(t('ledger.run.moduleBroke', { name: raid.moduleDamaged }));
    emitHook(run, raid.repelled ? 'raidRepelled' : 'raidFailed', rng);
    if (run.stats.hp <= 0) {
      if (run.difficulty === 'story') {
        run.stats.hp = 20;
        out.notes.push(t('ledger.run.storyRaid'));
      } else {
        const ending = resolveEnding(run, t('ledger.cause.raid'));
        run.endingId = ending.id;
        run.phase = 'ended';
        run.stats_meta.daysSurvived = run.day;
        out.died = true;
      }
    }
  }

  if (run.stats.hp <= 0 && run.phase !== 'ended') {
    const coDrown = familyId === 'env_co_drowning';
    if (run.difficulty === 'story' && !coDrown) {
      run.stats.hp = 20;
      out.notes.push(t('ledger.run.storyLive'));
    } else {
      const ending = resolveEnding(run, coDrown ? t('ledger.cause.co') : '死亡');
      run.endingId = ending.id;
      run.phase = 'ended';
      run.stats_meta.daysSurvived = run.day;
      out.died = true;
    }
  }
  // 任何 raid_attempt 结算都算遭遇袭击（谈成成功也要能触发 waitFor 链）
  if (familyId === 'raid_attempt') {
    emitHook(run, 'raid', rng);
  }
  // 救助-袭击联动：门口确实打了一架且已击退，'修门框'收尾照常出现（waitFor 含 raidRepelled）
  if (familyId === 'raid_aided_repel') {
    emitHook(run, 'raidRepelled', rng);
  }

  recordBeat(run, familyId);
  run.queue = run.queue.filter((q) => !(q.familyId === familyId && q.variantId === variantId));
  emitHook(run, 'choice', rng);
  clampResources(run);
  run.rngCursor = rng.cursor();
  return out;
}
