/**
 * 供电：光伏随天气，柴油机只补缺口，家电走优先级表。
 */

import { COLD, POWER, TIME, WEAR } from '../balance';
import { LOAD_NAME } from '../copy/names';
import { MODULE_BY_ID, MODULE_IDS, moduleSpec } from '../content/modules';
import { SITE_BY_ID } from '../content/sites';
import type { ApplianceId, ModuleId, PowerLoadId, RunState } from '../types';
import { canElectricHeat, heatPlan, heatWantKwh, type HeatPlan } from './climate';

export { LOAD_NAME };

export const APPLIANCE_IDS: ApplianceId[] = ['lights', 'fridge', 'heater'];

export interface PowerDraw {
  id: PowerLoadId;
  kwh: number;
}

export interface PowerReport {
  solarBase: number;
  weatherMult: number;
  disasterMult: number;
  solar: number;
  grid: number;
  generator: number;
  /** 今晚从蓄电池抽出的电量 */
  battery: number;
  /** 结算前的蓄电存量 */
  batteryStored: number;
  batteryCap: number;
  /** 光伏/市电富余将回充的量（预览，不改状态） */
  batteryGain: number;
  output: number;
  demand: number;
  deficit: number;
  offline: PowerLoadId[];
  fuelBurn: number;
  draws: PowerDraw[];
  /** 温控实际拿到的电。可小于申请值（余电不够时部分供电） */
  heaterGranted: number;
}

export function batteryCapacity(run: RunState): number {
  const lvl = Math.max(0, Math.min(3, run.modules.power ?? 0));
  return POWER.BATTERY_CAP[lvl] ?? POWER.BATTERY_CAP[0] ?? 8;
}

export function clampBattery(run: RunState): void {
  if (!run.wear) run.wear = { filterLife: WEAR.FILTER_LIFE, generatorOil: WEAR.GENERATOR_OIL, batteryCharge: 0 };
  run.wear.batteryCharge = Math.max(0, Math.min(batteryCapacity(run), run.wear.batteryCharge ?? 0));
}

/** 按今晚的预览放电并回充。须在健康结算之后调用，避免灯在同一夜里途中熄灭。 */
export function settleBattery(run: RunState, power?: PowerReport): void {
  const p = power ?? computePower(run);
  clampBattery(run);
  run.wear.batteryCharge = Math.max(0, run.wear.batteryCharge - p.battery + p.batteryGain);
  clampBattery(run);
}

export function loadWanted(run: RunState, id: PowerLoadId): boolean {
  if (id === 'heater') {
    if (!canElectricHeat(run)) return false;
  }
  return run.powerEnabled?.[id] !== false;
}

export function mergedPriority(run: RunState): PowerLoadId[] {
  const def = [...POWER.DEFAULT_PRIORITY];
  const cur = (run.powerPriority ?? []) as PowerLoadId[];
  const seen = new Set<PowerLoadId>();
  const out: PowerLoadId[] = [];
  for (const id of cur) {
    if (!def.includes(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of def) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

function collectDraws(run: RunState, heaterKwh?: number): PowerDraw[] {
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  const draws: PowerDraw[] = [];

  for (const id of MODULE_IDS) {
    if (!loadWanted(run, id)) continue;
    const level = run.modules[id];
    if (level <= 0) continue;
    const spec = moduleSpec(id, level);
    let kwh = spec?.power ?? 0;
    if (id === 'garden' && level >= 2 && site.tags.includes('site:noSunlight')) kwh += 1.5;
    if (id === 'filter' && site.tags.includes('site:elevated')) kwh *= 0.3;
    if (kwh > 0) draws.push({ id, kwh });
  }

  if (loadWanted(run, 'lights')) draws.push({ id: 'lights', kwh: POWER.LIGHTS_KWH });
  if (loadWanted(run, 'fridge')) draws.push({ id: 'fridge', kwh: POWER.FRIDGE_KWH });
  if (loadWanted(run, 'heater')) {
    const kwh = heaterKwh ?? heaterDrawKwh(run);
    if (kwh > 0) draws.push({ id: 'heater', kwh });
  }
  return draws;
}

/** 旧存档补齐供电/取暖/导演字段 */
export function ensureRunDefaults(run: RunState): void {
  if (!run.heatMode) run.heatMode = 'off';
  if (run.indoorTemp === undefined || Number.isNaN(run.indoorTemp)) run.indoorTemp = COLD.PREP_INDOOR;
  if (run.heatTarget === undefined || Number.isNaN(run.heatTarget)) run.heatTarget = COLD.COMFORT;
  if (!run.powerEnabled) run.powerEnabled = {};
  if (!run.directorBoost) run.directorBoost = {};
  if (!run.thresholdFired) run.thresholdFired = {};
  if (!run.streaks) run.streaks = { lowRation: 0, noThreatDays: 0, goodRation: 0, belowSurvival: 0 };
  if (run.streaks.goodRation === undefined) run.streaks.goodRation = 0;
  if (run.streaks.belowSurvival === undefined) run.streaks.belowSurvival = 0;
  if (!run.powerPriority?.length || !(run.powerPriority as string[]).includes('lights')) {
    run.powerPriority = mergedPriority(run);
  }
  // 准备期买的碘片故意不写截止日；崩溃后再计时。旧档若已在生存期且缺截止日才补。
  if (
    run.flags.includes('flag:iodine') &&
    run.iodineUntil === undefined &&
    run.day >= TIME.COLLAPSE_DAY
  ) {
    run.iodineUntil = run.day + 3;
  }
  if (!run.conditionAge) run.conditionAge = {};
  const oldHypo = (run.conditions as string[]).indexOf('hypothermia');
  if (oldHypo >= 0) {
    run.conditions.splice(oldHypo, 1);
    if (!run.conditions.includes('hypothermiaMild')) run.conditions.push('hypothermiaMild');
  }
  if (!run.wear) {
    run.wear = { filterLife: WEAR.FILTER_LIFE, generatorOil: WEAR.GENERATOR_OIL, batteryCharge: 0 };
  } else {
    if (run.wear.filterLife === undefined) run.wear.filterLife = WEAR.FILTER_LIFE;
    if (run.wear.generatorOil === undefined) run.wear.generatorOil = WEAR.GENERATOR_OIL;
    if (run.wear.batteryCharge === undefined) run.wear.batteryCharge = 0;
  }
  if (!run.pendingUnlocks) run.pendingUnlocks = [];
  if (!run.seenVariants) run.seenVariants = [];
  if (run.world && !run.world.forecast) run.world.forecast = [];
  clampBattery(run);
}

export function computePower(run: RunState, heaterKwh?: number): PowerReport {
  const lvl = run.modules.power;
  const solarBase = POWER.BASE_OUTPUT[lvl] ?? 0;
  const weatherMult = POWER.SOLAR_WEATHER[run.world.weather] ?? 1;
  const disasterMult = run.day >= TIME.COLLAPSE_DAY ? (POWER.SOLAR_DISASTER[run.world.disaster] ?? 1) : 1;

  const solar = solarBase * weatherMult * disasterMult;
  const grid =
    run.world.powerGrid === 'on' ? POWER.GRID_ON : run.world.powerGrid === 'rolling' ? POWER.GRID_ROLLING : 0;
  const batteryStored = Math.max(0, run.wear?.batteryCharge ?? 0);
  const batteryCap = batteryCapacity(run);

  let available = solar + grid;
  let generator = 0;
  let fuelBurn = 0;
  let battery = 0;

  const rewiring = run.projects.some((p) =>
    MODULE_BY_ID[p.moduleId].buildPenaltyTags.includes('power:blackout'),
  );
  if (rewiring) available = 0;

  const draws = collectDraws(run, heaterKwh);
  const demand = draws.reduce((s, d) => s + d.kwh, 0);
  const heaterRequest = draws.find((d) => d.id === 'heater')?.kwh ?? 0;
  const prepGrid = run.day < TIME.COLLAPSE_DAY;

  if (!rewiring && batteryStored > 0 && demand > available) {
    battery = Math.min(batteryStored, demand - available);
    available += battery;
  }

  const offline: PowerLoadId[] = [];
  let heaterGranted = 0;
  if (rewiring) {
    heaterGranted = 0;
    for (const d of draws) offline.push(d.id);
  } else if (prepGrid) {
    heaterGranted = heaterRequest;
  } else {
    const priority = mergedPriority(run);
    const ordered = draws.slice().sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id));
    // 先分光伏/市电/蓄电池。温控只吃这池余电，柴油机稍后只给其它负荷补缺口。
    let pool = available;
    const pending: PowerDraw[] = [];
    for (const d of ordered) {
      if (d.id === 'heater') {
        const g = Math.min(d.kwh, Math.max(0, pool));
        heaterGranted = Math.round(g * 10) / 10;
        pool -= g;
        if (g <= 1e-9) offline.push('heater');
      } else if (pool + 1e-9 >= d.kwh) {
        pool -= d.kwh;
      } else {
        pending.push(d);
      }
    }
    if (lvl >= 3 && run.res.fuel > 0 && pending.length > 0) {
      const gap = pending.reduce((s, d) => s + d.kwh, 0);
      const kwhCap = Math.min(POWER.GENERATOR_MAX, gap);
      const fuelNeed = kwhCap * POWER.GENERATOR_L_PER_KWH;
      fuelBurn = Math.min(run.res.fuel, fuelNeed);
      generator = fuelNeed > 0 ? kwhCap * (fuelBurn / fuelNeed) : 0;
      let dpool = generator;
      for (const d of pending) {
        if (dpool + 1e-9 >= d.kwh) dpool -= d.kwh;
        else offline.push(d.id);
      }
    } else {
      for (const d of pending) offline.push(d.id);
    }
    available += generator;
  }

  let batteryGain = 0;
  if (!rewiring) {
    const surplus = Math.max(0, solar + grid - demand);
    const afterDraw = batteryStored - battery;
    batteryGain = Math.min(surplus, Math.max(0, batteryCap - afterDraw));
  }

  return {
    solarBase,
    weatherMult,
    disasterMult,
    solar,
    grid,
    generator,
    battery,
    batteryStored,
    batteryCap,
    batteryGain,
    output: available,
    demand,
    deficit: Math.max(0, demand - available),
    offline,
    fuelBurn,
    draws,
    heaterGranted,
  };
}

export function loadOnline(run: RunState, id: PowerLoadId, power?: PowerReport): boolean {
  if (!loadWanted(run, id)) return false;
  const p = power ?? computePower(run);
  return !p.offline.includes(id);
}

/** 温控在当前优先级下最多能拿到多少电（探测用，不按今夜目标截断） */
export function heaterHeadroomKwh(run: RunState): number {
  if (!canElectricHeat(run)) return 0;
  const probe: RunState = {
    ...run,
    powerEnabled: { ...(run.powerEnabled ?? {}), heater: true },
  };
  return computePower(probe, 80).heaterGranted;
}

/** 今晚温控实际会去供电表里申请的电：申请量和余电取小 */
export function heaterDrawKwh(run: RunState, outdoor?: number): number {
  if (!canElectricHeat(run) || !loadWanted(run, 'heater')) return 0;
  if (run.heatElecWant !== undefined) {
    return Math.round(Math.min(Math.max(0, run.heatElecWant), heaterHeadroomKwh(run)) * 10) / 10;
  }
  const need = heatWantKwh(run, outdoor);
  if (need <= 0) return 0;
  return Math.round(Math.min(need, heaterHeadroomKwh(run)) * 10) / 10;
}

/** 按今日室外估明晚室内：未拖滑块时电优先，拖过则按申请量 */
export function tonightHeat(run: RunState, outdoor?: number): { plan: HeatPlan; power: PowerReport } {
  const out = outdoor ?? run.world.temperature;
  const power = computePower(run, heaterDrawKwh(run, out));
  const plan = heatPlan(run, out, power.heaterGranted);
  return { plan, power };
}

/** 某负荷若打开时会拉多少电（关掉的模块也要能显示） */
export function potentialDrawKwh(run: RunState, id: PowerLoadId): number {
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  if (id === 'lights') return POWER.LIGHTS_KWH;
  if (id === 'fridge') return POWER.FRIDGE_KWH;
  if (id === 'heater') return heaterDrawKwh(run);
  const mid = id as ModuleId;
  const level = run.modules[mid] ?? 0;
  if (level <= 0) return 0;
  const spec = moduleSpec(mid, level);
  let kwh = spec?.power ?? 0;
  if (mid === 'garden' && level >= 2 && site.tags.includes('site:noSunlight')) kwh += 1.5;
  if (mid === 'filter' && site.tags.includes('site:elevated')) kwh *= 0.3;
  return kwh;
}
