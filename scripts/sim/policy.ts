/**
 * 模拟人格与日计划。黑盒不读检定期望；白盒只在选事件时读 preview。
 * 配给降档是最后手段：还能找到物资就维持正常。
 */

import { COLD, TIME } from '../../src/game/balance';
import { CONDITION_BY_ID } from '../../src/game/content/conditions';
import { FAMILY_BY_ID } from '../../src/game/content/events';
import { LOCATIONS } from '../../src/game/content/locations';
import { canElectricHeat, canFuelHeat, comfortTemp, survivalTemp } from '../../src/game/engine/climate';
import { buildOptions, maintenanceOptions, nextLevel } from '../../src/game/engine/construction';
import { dailyNeeds, travelCost } from '../../src/game/engine/economy';
import { tonightHeat } from '../../src/game/engine/power';
import { checkRequirement } from '../../src/game/engine/tags';
import {
  acknowledgeCollapse,
  build,
  buy,
  buyCartridge,
  buyIodine,
  createSession,
  endDay,
  maintain,
  medicate,
  pickGreedyHaul,
  rest,
  resolveChoice,
  scavenge,
  setHeatMode,
  setHeatTarget,
  setRation,
  setWaterUse,
  takeHaul,
  visitShop,
  withdraw,
  work,
  type Session,
} from '../../src/game/session';
import type { BuildPath, Choice, ModuleId, ResourceId, RunState } from '../../src/game/types';
import { pickOracle, pickSaferBlind, pickSighted } from './preview';

export type PersonaId = 'passable' | 'cautious' | 'aggressive' | 'contractor' | 'oracle' | 'sighted';

export const PERSONA_IDS: PersonaId[] = [
  'passable',
  'cautious',
  'aggressive',
  'contractor',
  'oracle',
  'sighted',
];

export const PERSONA_LABEL: Record<PersonaId, string> = {
  passable: '及格水平',
  cautious: '谨慎',
  aggressive: '激进',
  contractor: '雇工党',
  oracle: '贪婪读表',
  sighted: '读表不贪',
};

export interface Persona {
  id: PersonaId;
  nightScavenge: boolean;
  maxDanger: number;
  scavengeFoodBelow: number;
  nightStaminaMin: number;
  buildPaths: BuildPath[];
  eventMode: 'first' | 'oracle' | 'sighted';
  /** 准备期按核战囤：碘片、空气过滤、发电 */
  nukeHedge: boolean;
}

const BASE: Omit<Persona, 'id'> = {
  nightScavenge: false,
  maxDanger: 99,
  scavengeFoodBelow: 5,
  nightStaminaMin: 48,
  buildPaths: ['diy'],
  eventMode: 'first',
  nukeHedge: false,
};

export const PERSONA_BY_ID: Record<PersonaId, Persona> = {
  passable: { ...BASE, id: 'passable' },
  cautious: {
    ...BASE,
    id: 'cautious',
    maxDanger: 28,
    scavengeFoodBelow: 6,
    nukeHedge: true,
  },
  aggressive: {
    ...BASE,
    id: 'aggressive',
    nightScavenge: true,
    scavengeFoodBelow: 7,
    nightStaminaMin: 32,
  },
  contractor: { ...BASE, id: 'contractor', buildPaths: ['hire', 'buy', 'diy'], nukeHedge: true },
  oracle: { ...BASE, id: 'oracle', eventMode: 'oracle' },
  sighted: { ...BASE, id: 'sighted', eventMode: 'sighted' },
};

export function parsePersona(raw: string | undefined): PersonaId | 'all' {
  if (!raw || raw === 'passable') return 'passable';
  if (raw === 'all') return 'all';
  if ((PERSONA_IDS as string[]).includes(raw)) return raw as PersonaId;
  throw new Error(`未知人格：${raw}（可用 ${PERSONA_IDS.join(' / ')} / all）`);
}

export interface PlayCounters {
  dayScavenges: number;
  nightScavenges: number;
  hires: number;
  eventScoreSum: number;
  eventPicks: number;
}

export function emptyCounters(): PlayCounters {
  return { dayScavenges: 0, nightScavenges: 0, hires: 0, eventScoreSum: 0, eventPicks: 0 };
}

/** 机器人会升的模块。无线电不进计划。 */
const BUILD_POOL: ModuleId[] = [
  'cistern',
  'filter',
  'insulate',
  'fortify',
  'conceal',
  'garden',
  'power',
  'airFilter',
  'medbay',
];

const PREP_L1_MIN = 3;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const arr = [...items];
  const rand = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function moduleLevel(run: RunState, id: ModuleId): number {
  return run.modules[id] ?? 0;
}

function uncuredNeedsMedbay(run: RunState): boolean {
  return run.conditions.some((id) => {
    const def = CONDITION_BY_ID[id];
    if (!def?.medsCure) return false;
    return (def.needsMedbay ?? 0) > moduleLevel(run, 'medbay');
  });
}

function lifeIsEasy(run: RunState, persona: Persona): boolean {
  const floor = Math.max(6, persona.scavengeFoodBelow);
  return (
    run.world.exposure < 25 &&
    daysOfWater(run) >= floor &&
    daysOfFood(run) >= floor &&
    run.res.fuel >= 12
  );
}

/** 准备期随机铺 1 级；生存压力小时先铺满 1 级，再按同一随机序逐个升 2 级。 */
export function planBuildOrder(run: RunState): ModuleId[] {
  const order = seededShuffle(BUILD_POOL, run.seed);
  const l1Count = BUILD_POOL.filter((id) => moduleLevel(run, id) >= 1).length;
  const needL1 = order.filter((id) => moduleLevel(run, id) < 1 && nextLevel(run, id) !== null);
  const toL2 = order.filter((id) => moduleLevel(run, id) === 1 && nextLevel(run, id) !== null);
  const prep = run.day < TIME.COLLAPSE_DAY;
  const result: ModuleId[] = [];

  if (uncuredNeedsMedbay(run)) result.push('medbay');

  if (prep && l1Count < PREP_L1_MIN) {
    result.push(...needL1);
    return uniqueModules(result);
  }

  result.push(...needL1);
  if (toL2.length > 0) result.push(toL2[0]!);
  return uniqueModules(result);
}

function uniqueModules(ids: ModuleId[]): ModuleId[] {
  const seen = new Set<ModuleId>();
  const out: ModuleId[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function daysOfWater(run: RunState): number {
  const saved = run.waterUse;
  run.waterUse = 'normal';
  const n = dailyNeeds(run, run.difficulty);
  run.waterUse = saved;
  return n.water > 0 ? run.res.water / n.water : 99;
}

export function daysOfFood(run: RunState): number {
  const saved = run.ration;
  run.ration = 'normal';
  const n = dailyNeeds(run, run.difficulty);
  run.ration = saved;
  return n.food > 0 ? (run.res.foodStaple + run.res.foodFresh) / n.food : 99;
}

function exposureCap(run: RunState, persona: Persona, urgent = false): number {
  const exp = run.world.exposure;
  let cap = persona.maxDanger;
  if (urgent) {
    // 缺粮缺水时至少还能去小学食堂水箱；医院太险，不作为「还能找到」的理由。
    return Math.max(cap, 22);
  }
  if (exp >= 55) cap = Math.min(cap, 18);
  else if (exp >= 40) cap = Math.min(cap, 26);
  else if (exp >= 25) cap = Math.min(cap, 36);
  return cap;
}

function legalChoices(run: RunState, choices: Choice[]): Choice[] {
  return choices.filter((c) => checkRequirement(c.requires, run).ok);
}

export function clearQueue(s: Session, persona: Persona, counters: PlayCounters): void {
  let guard = 0;
  while (s.run.queue.length > 0 && guard++ < 12) {
    const item = s.run.queue[0]!;
    const family = FAMILY_BY_ID[item.familyId];
    const variant = family?.variants.find((v) => v.id === item.variantId);
    if (!family || !variant) {
      s.run.queue.shift();
      continue;
    }
    const usable = legalChoices(s.run, variant.choices);
    if (usable.length === 0) {
      s.run.queue.shift();
      continue;
    }
    let pick = pickSaferBlind(usable);
    if (persona.eventMode === 'oracle') {
      const r = pickOracle(s.run, usable);
      pick = r.choice;
      counters.eventScoreSum += r.score;
      counters.eventPicks += 1;
    } else if (persona.eventMode === 'sighted') {
      pick = pickSighted(s.run, usable, daysOfFood(s.run), daysOfWater(s.run));
      counters.eventPicks += 1;
    }
    resolveChoice(s, item.familyId, item.variantId, pick.id);
    if (s.run.phase === 'ended') return;
  }
}

function medicateAll(s: Session): void {
  for (const c of [...s.run.conditions]) medicate(s, c);
}

function shopBuy(s: Session, loc: string, res: ResourceId, qty: number): boolean {
  if (!s.run.visitedToday.includes(loc)) {
    if (s.run.ap < 1) return false;
    if (!visitShop(s, loc).ok) return false;
  }
  return buy(s, loc, res, qty).ok;
}

function tryWithdraw(s: Session): void {
  if (s.run.res.cash >= 1800 || s.run.savings <= 0) return;
  if (!s.run.visitedToday.includes('bank')) {
    if (s.run.ap < 1) return;
    if (!visitShop(s, 'bank').ok) return;
  }
  withdraw(s, 'bank', 4000);
}

function tryBuild(s: Session, persona: Persona, counters: PlayCounters): boolean {
  const order = planBuildOrder(s.run);
  for (const p of s.run.projects) {
    if (work(s, p.moduleId).ok) return true;
  }
  for (const path of persona.buildPaths) {
    for (const id of order) {
      if (nextLevel(s.run, id) === null) continue;
      if (s.run.projects.some((p) => p.moduleId === id)) continue;
      if (s.run.projects.length >= 2) break;
      const opts = buildOptions(s.run, id);
      const opt = opts.find((o) => o.path === path && o.available);
      if (!opt) continue;
      if (!build(s, id, path).ok) continue;
      if (path === 'hire' || path === 'buy') counters.hires += 1;
      if (path === 'diy') work(s, id);
      return true;
    }
  }
  return false;
}

function pickScavengeLoc(s: Session, persona: Persona, prefer: ResourceId[], urgent = false) {
  const cap = exposureCap(s.run, persona, urgent);
  const candidates = LOCATIONS.filter((l) => {
    if (l.needsVehicle && !s.run.hasVehicle) return false;
    if (l.danger > cap) return false;
    const st = s.run.locations.find((x) => x.id === l.id);
    if ((st?.stock ?? 100) < 25) return false;
    return l.loot.some((e) => prefer.includes(e.res));
  }).sort((a, b) => a.danger - b.danger);
  return candidates[0] ?? null;
}

function canForageTomorrow(s: Session, persona: Persona, prefer: ResourceId[]): boolean {
  const loc = pickScavengeLoc(s, persona, prefer, true);
  if (!loc) return false;
  const cost = travelCost(s.run, loc);
  if (cost.fuel > 0 && s.run.res.fuel < cost.fuel) return false;
  return true;
}

function goScavenge(
  s: Session,
  persona: Persona,
  prefer: ResourceId[],
  counters: PlayCounters,
  urgent: boolean,
): boolean {
  if (!urgent && s.run.world.exposure >= 50) return false;
  const mustGo = daysOfWater(s.run) < 1.2 || daysOfFood(s.run) < 1.2;
  const loc = pickScavengeLoc(s, persona, prefer, urgent && mustGo);
  if (!loc) return false;
  const night =
    persona.nightScavenge &&
    s.run.stats.stamina >= persona.nightStaminaMin &&
    s.run.world.exposure < 35;
  const r = scavenge(s, loc.id, night);
  if (!r.ok || !s.haul) return false;
  if (night) counters.nightScavenges += 1;
  else counters.dayScavenges += 1;
  takeHaul(s, pickGreedyHaul(s.run, s.haul));
  return true;
}

/** 有油就先把室内拉到舒适以上。0.12 L/°C，不再用 18/36 L 这种假门槛把炉子关掉。 */
export function planHeat(s: Session): void {
  if (canFuelHeat(s.run)) setHeatMode(s, 'fuel');
  else if (canElectricHeat(s.run)) setHeatMode(s, 'electric');
  s.run.heatElecWant = undefined;
  s.run.heatFuelWant = undefined;

  const leaked = tonightHeat(s.run).plan.leaked;
  const surv = survivalTemp(s.run);
  const comf = comfortTemp(s.run);
  const cozy = Math.min(COLD.MAX_INDOOR, comf + COLD.BUFFER);
  const fuel = s.run.res.fuel;
  const costTo = (temp: number) => Math.max(0, temp - leaked) * COLD.FUEL_PER_DEGREE;

  let target = leaked;
  if (canFuelHeat(s.run) || canElectricHeat(s.run)) {
    if (canElectricHeat(s.run) || fuel >= costTo(cozy)) target = cozy;
    else if (fuel >= costTo(comf)) target = comf;
    else if (fuel >= costTo(surv + 1)) target = surv + 1;
    else if (fuel > 0 && leaked < comf) target = Math.min(comf, leaked + fuel / COLD.FUEL_PER_DEGREE);
  }
  setHeatTarget(s, target);
}

function manageExposure(s: Session): void {
  if (!s.run.powerEnabled) s.run.powerEnabled = {};
  s.run.powerEnabled.lights = s.run.world.exposure < 22 && s.run.stats.sanity < 40;
}

/** 一天行动完再决定：还能找到物资就不降配给。 */
function applyRationLastResort(s: Session, persona: Persona): void {
  const food = daysOfFood(s.run);
  const water = daysOfWater(s.run);
  const canFood = canForageTomorrow(s, persona, ['foodStaple', 'foodFresh']);
  const canWater = canForageTomorrow(s, persona, ['water']);

  if (food > 18) setRation(s, 'full');
  else if (food >= 1.5 || canFood) setRation(s, 'normal');
  else if (food >= 0.6) setRation(s, 'half');
  else setRation(s, 'none');

  if (water > 14) setWaterUse(s, 'full');
  else if (water >= 1.5 || canWater) setWaterUse(s, 'normal');
  else setWaterUse(s, 'limited');
}

function prepL1Count(run: RunState): number {
  return BUILD_POOL.filter((id) => moduleLevel(run, id) >= 1).length;
}

function prepDay(s: Session, persona: Persona, counters: PlayCounters): void {
  medicateAll(s);
  while (s.run.ap > 0 && s.run.stats.stamina < 30) {
    if (!rest(s).ok) break;
  }
  tryWithdraw(s);
  if (s.run.ap > 0 && (s.run.res.materials < 26 || s.run.res.parts < 18) && s.run.res.cash > 800) {
    shopBuy(s, 'hardware', 'materials', 20);
    shopBuy(s, 'hardware', 'parts', 15);
  }
  // 备用滤芯：整局限一只，越早越便宜（物价指数每日 ×1.35）；现金宽裕就专门跑一趟
  if (
    s.run.res.cash > 1500 &&
    !s.run.flags.includes('flag:filterBought') &&
    s.run.items.filter === 0 &&
    (s.run.modules.filter > 0 || s.run.modules.airFilter > 0)
  ) {
    if (s.run.visitedToday.includes('hardware')) {
      buyCartridge(s, 'hardware');
    } else if (s.run.ap > 0 && visitShop(s, 'hardware').ok) {
      buyCartridge(s, 'hardware');
    }
  }
  if (persona.nukeHedge && s.run.ap > 0 && !s.run.flags.includes('flag:iodineStock2')) {
    if (!s.run.visitedToday.includes('pharmacy')) visitShop(s, 'pharmacy');
    if (s.run.visitedToday.includes('pharmacy')) buyIodine(s, 'pharmacy');
  }
  const laid = prepL1Count(s.run);
  if (laid >= PREP_L1_MIN) {
    if (s.run.ap > 0 && (s.run.res.meds < 10 || s.run.conditions.length > 0) && s.run.res.cash > 800) {
      shopBuy(s, 'pharmacy', 'meds', 8);
    }
    if (s.run.ap > 0) {
      shopBuy(s, 'supermarket', 'foodStaple', 20);
      if (daysOfWater(s.run) < (persona.nukeHedge ? 40 : 30)) shopBuy(s, 'supermarket', 'water', 40);
    }
    if (s.run.ap > 0 && s.run.res.fuel < 80 && s.run.res.cash > 1200) {
      shopBuy(s, 'gasstation', 'fuel', 25);
    }
  } else if (s.run.ap > 0 && s.run.conditions.length > 0 && s.run.res.meds < 4 && s.run.res.cash > 400) {
    shopBuy(s, 'pharmacy', 'meds', 4);
  }
  while (s.run.ap > 0) {
    if (!tryBuild(s, persona, counters)) break;
  }
  while (s.run.ap > 0) {
    if (!rest(s).ok) break;
  }
  applyRationLastResort(s, persona);
}

function survivalDay(s: Session, persona: Persona, counters: PlayCounters): void {
  medicateAll(s);
  manageExposure(s);
  planHeat(s);

  if (s.run.ap > 0 && s.run.wear.filterLife <= 6) {
    const opt = maintenanceOptions(s.run).find((o) => o.kind === 'filter');
    if (opt?.available) maintain(s, 'filter');
  }

  while (s.run.ap > 0) {
    medicateAll(s);
    if (s.run.stats.stamina < 36) {
      if (!rest(s).ok) break;
      continue;
    }
    const needWater = daysOfWater(s.run) < persona.scavengeFoodBelow;
    const needFood = daysOfFood(s.run) < persona.scavengeFoodBelow;
    const needMeds = s.run.conditions.length > 0 && s.run.res.meds < 4;
    if ((needWater || needFood || needMeds) && goScavenge(s, persona, ['water', 'foodStaple', 'meds'], counters, true)) {
      continue;
    }
    if (uncuredNeedsMedbay(s.run) && tryBuild(s, persona, counters)) continue;
    const easy = lifeIsEasy(s.run, persona);
    if (easy && tryBuild(s, persona, counters)) continue;
    if (s.run.world.exposure >= 30 && tryBuild(s, persona, counters)) continue;
    if (s.run.res.fuel < 16 && goScavenge(s, persona, ['fuel', 'materials'], counters, false)) continue;
    if (tryBuild(s, persona, counters)) continue;
    if (!easy && goScavenge(s, persona, ['materials', 'parts', 'water', 'foodStaple', 'meds', 'fuel'], counters, false)) {
      continue;
    }
    if (!rest(s).ok) break;
  }
  applyRationLastResort(s, persona);
  planHeat(s);
}

export function playDay(s: Session, persona: Persona, counters: PlayCounters): string | undefined {
  clearQueue(s, persona, counters);
  if (s.run.phase === 'ended') return undefined;
  if (s.run.phase === 'collapse') {
    acknowledgeCollapse(s);
    return undefined;
  }
  medicateAll(s);
  if (s.run.day < TIME.COLLAPSE_DAY) prepDay(s, persona, counters);
  else survivalDay(s, persona, counters);
  clearQueue(s, persona, counters);
  if (s.run.phase === 'ended') return undefined;
  medicateAll(s);
  const report = endDay(s);
  if (!report.ok) {
    s.run.queue = [];
    const retry = endDay(s);
    return retry.value?.cause;
  }
  return report.value?.cause;
}

export function attach(run: RunState): Session {
  return createSession(run);
}
