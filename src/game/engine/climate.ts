/**
 * 惯性温度：室内有热容，每晚向热汇漏一截。
 * 不读电力系统，避免和 computePower 循环依赖。
 */

import { COLD } from '../balance';
import { SITE_BY_ID } from '../content/sites';
import type { HeatMode, IndoorBand, RunState, WeatherId } from '../types';

/** 产水天气：雨雪与黑雨。落灰不算。 */
export const PRECIP_WEATHER: WeatherId[] = ['rain', 'storm', 'flooding', 'snow', 'blizzard', 'blackRain'];

export function isPrecipWeather(weather: WeatherId): boolean {
  return PRECIP_WEATHER.includes(weather);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 电优先，油补缺口，总升温不超过 MAX_INDOOR */
function fitHeat(leaked: number, elecDeg: number, fuelDeg: number) {
  const maxDeg = Math.max(0, COLD.MAX_INDOOR - leaked);
  const e = Math.min(Math.max(0, elecDeg), maxDeg);
  const f = Math.min(Math.max(0, fuelDeg), Math.max(0, maxDeg - e));
  return {
    elecDeg: e,
    fuelDeg: f,
    heatDegrees: e + f,
    indoor: round1(leaked + e + f),
    kwh: round1(e * COLD.ELECTRIC_PER_DEGREE),
    fuelCost: round1(f * COLD.FUEL_PER_DEGREE),
  };
}

/** 从今夜漏热升到上限所需的电/油（尚未和库存取小） */
export function heatSliderMax(run: RunState, outdoor?: number): { elecKwh: number; fuelL: number } {
  const { leaked } = leakedTonight(run, outdoor ?? run.world.temperature);
  const gap = Math.max(0, COLD.MAX_INDOOR - leaked);
  return {
    elecKwh: canElectricHeat(run) ? round1(gap * COLD.ELECTRIC_PER_DEGREE) : 0,
    fuelL: canFuelHeat(run) ? round1(gap * COLD.FUEL_PER_DEGREE) : 0,
  };
}

export function insulateLevel(run: RunState): number {
  if (run.projects.some((p) => p.moduleId === 'insulate')) return 0;
  return Math.max(0, Math.min(3, run.modules.insulate ?? 0));
}

export function leakRate(run: RunState): number {
  let k = COLD.LEAK[insulateLevel(run)] ?? COLD.LEAK[0]!;
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  if (site.tags.includes('site:drafty')) k += COLD.DRAFTY_LEAK;
  if (site.tags.includes('site:elevated')) k += COLD.ELEVATED_LEAK;
  return Math.min(0.95, k);
}

export function thermalSink(run: RunState, outdoor: number): number {
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  if (site.tags.includes('site:underground')) return COLD.GROUND_TEMP;
  return outdoor;
}

export function occupancyHeat(run: RunState): number {
  return (1 + run.survivors.length) * COLD.BODY_HEAT_PER_HEAD;
}

export function hasThickblood(run: RunState): boolean {
  return run.abilities.includes('perk_thickblood');
}

export function comfortTemp(run: RunState): number {
  return COLD.COMFORT - (hasThickblood(run) ? COLD.PERK_SHIFT : 0);
}

export function survivalTemp(run: RunState): number {
  return COLD.SURVIVAL - (hasThickblood(run) ? COLD.PERK_SHIFT : 0);
}

export function leakIndoor(indoor: number, sink: number, k: number, bodyHeat: number): number {
  const start = indoor + bodyHeat;
  return round1(start + k * (sink - start));
}

export type { IndoorBand };

export function indoorBandOf(run: RunState, indoor: number): IndoorBand {
  if (indoor < survivalTemp(run)) return 'freeze';
  if (indoor < comfortTemp(run)) return 'chill';
  return 'warm';
}

export function currentIndoor(run: RunState): number {
  return run.indoorTemp ?? COLD.PREP_INDOOR;
}

export interface HeatPlan {
  sink: number;
  leaked: number;
  target: number;
  heatDegrees: number;
  indoor: number;
  fuelCost: number;
  kwh: number;
  mode: HeatMode;
}

/** 把室内从 leaked 推到 target，需要向供电系统申请的电热 kWh（未考虑余电） */
export function heatWantKwh(run: RunState, outdoor?: number): number {
  if (!canElectricHeat(run)) return 0;
  const out = outdoor ?? run.world.temperature;
  const leaked = leakIndoor(currentIndoor(run), thermalSink(run, out), leakRate(run), occupancyHeat(run));
  const gap = Math.max(0, Math.min(COLD.MAX_INDOOR, run.heatTarget ?? comfortTemp(run)) - leaked);
  if (gap <= 0) return 0;
  return round1(gap * COLD.ELECTRIC_PER_DEGREE);
}

function leakedTonight(run: RunState, outdoor: number): { sink: number; leaked: number } {
  const sink = thermalSink(run, outdoor);
  const leaked = leakIndoor(currentIndoor(run), sink, leakRate(run), occupancyHeat(run));
  return { sink, leaked };
}

/** 玩家拖过油电滑块后写入；目标室内温度随之变成漏热 + 两路升温。 */
export function applyHeatWants(run: RunState, elecKwh: number, fuelL: number, maxElecKwh?: number): void {
  let elec = canElectricHeat(run) ? Math.max(0, elecKwh) : 0;
  if (maxElecKwh !== undefined) elec = Math.min(elec, Math.max(0, maxElecKwh));
  const fuel = canFuelHeat(run) ? Math.max(0, Math.min(fuelL, run.res.fuel)) : 0;
  run.heatElecWant = round1(elec);
  run.heatFuelWant = round1(fuel);
  const { leaked } = leakedTonight(run, run.world.temperature);
  const elecDeg = COLD.ELECTRIC_PER_DEGREE > 0 ? run.heatElecWant / COLD.ELECTRIC_PER_DEGREE : 0;
  const fuelDeg = COLD.FUEL_PER_DEGREE > 0 ? run.heatFuelWant / COLD.FUEL_PER_DEGREE : 0;
  const fitted = fitHeat(leaked, elecDeg, fuelDeg);
  run.heatTarget = fitted.indoor;
}

function planFromWants(run: RunState, outdoor: number, elecGrantedKwh: number): HeatPlan {
  const { sink, leaked } = leakedTonight(run, outdoor);
  let heatDegrees = 0;
  let fuelCost = 0;
  let kwh = 0;

  if (canElectricHeat(run) && elecGrantedKwh > 0 && COLD.ELECTRIC_PER_DEGREE > 0) {
    const want = Math.max(0, run.heatElecWant ?? 0);
    const elecKwh = Math.min(want, elecGrantedKwh);
    const elecDeg = elecKwh / COLD.ELECTRIC_PER_DEGREE;
    heatDegrees += elecDeg;
    kwh = round1(elecKwh);
  }

  if (canFuelHeat(run) && COLD.FUEL_PER_DEGREE > 0) {
    const want = Math.max(0, run.heatFuelWant ?? 0);
    const fuel = Math.min(want, run.res.fuel);
    const fuelDeg = fuel / COLD.FUEL_PER_DEGREE;
    heatDegrees += fuelDeg;
    fuelCost = round1(fuel);
  }

  const fitted = fitHeat(leaked, kwh > 0 && COLD.ELECTRIC_PER_DEGREE > 0 ? kwh / COLD.ELECTRIC_PER_DEGREE : 0, fuelCost > 0 && COLD.FUEL_PER_DEGREE > 0 ? fuelCost / COLD.FUEL_PER_DEGREE : 0);
  const mode: HeatMode = fitted.kwh > 0 ? 'electric' : fitted.fuelCost > 0 ? 'fuel' : 'off';
  return {
    sink,
    leaked,
    target: Math.min(COLD.MAX_INDOOR, run.heatTarget ?? fitted.indoor),
    heatDegrees: fitted.heatDegrees,
    indoor: fitted.indoor,
    fuelCost: fitted.fuelCost,
    kwh: fitted.kwh,
    mode,
  };
}

/**
 * 未拖过滑块：电优先、油补缺口。拖过之后两路按玩家申请走，互不顶替。
 * `elecGrantedKwh` 是供电表按优先级实际分给温控的电。
 */
export function heatPlan(run: RunState, outdoor: number, elecGrantedKwh = 0): HeatPlan {
  if (run.heatElecWant !== undefined || run.heatFuelWant !== undefined) {
    return planFromWants(run, outdoor, elecGrantedKwh);
  }

  const { sink, leaked } = leakedTonight(run, outdoor);
  const target = Math.min(COLD.MAX_INDOOR, run.heatTarget ?? comfortTemp(run));
  const gap = Math.max(0, target - leaked);
  let heatDegrees = 0;
  let fuelCost = 0;
  let kwh = 0;

  if (canElectricHeat(run) && elecGrantedKwh > 0 && gap > 0 && COLD.ELECTRIC_PER_DEGREE > 0) {
    const elecDeg = Math.min(gap, elecGrantedKwh / COLD.ELECTRIC_PER_DEGREE);
    heatDegrees += elecDeg;
    kwh = round1(elecDeg * COLD.ELECTRIC_PER_DEGREE);
  }

  const remain = Math.max(0, gap - heatDegrees);
  if (canFuelHeat(run) && remain > 0 && COLD.FUEL_PER_DEGREE > 0) {
    const maxDeg = run.res.fuel / COLD.FUEL_PER_DEGREE;
    const fuelDeg = Math.min(remain, maxDeg);
    heatDegrees += fuelDeg;
    fuelCost = round1(fuelDeg * COLD.FUEL_PER_DEGREE);
  }

  const mode: HeatMode = kwh > 0 ? 'electric' : fuelCost > 0 ? 'fuel' : 'off';
  return {
    sink,
    leaked,
    target,
    heatDegrees,
    indoor: round1(Math.min(COLD.MAX_INDOOR, leaked + heatDegrees)),
    fuelCost,
    kwh,
    mode,
  };
}

/** 白天温度计：按今日室外估明早室内与油电预算。电量需由调用方传入实得分。 */
export function previewNight(run: RunState, elecGrantedKwh = 0): HeatPlan {
  return heatPlan(run, run.world.temperature, elecGrantedKwh);
}

/** 结算：电优先花预算，再花油；升温不超过预算能买到的度数 */
export function capHeat(budget: HeatPlan, actual: HeatPlan): HeatPlan {
  const gap = Math.max(0, actual.target - actual.leaked);
  const elecDegCap = COLD.ELECTRIC_PER_DEGREE > 0 ? budget.kwh / COLD.ELECTRIC_PER_DEGREE : 0;
  const fuelDegCap = COLD.FUEL_PER_DEGREE > 0 ? budget.fuelCost / COLD.FUEL_PER_DEGREE : 0;
  const elecDeg = Math.min(gap, elecDegCap);
  const fuelDeg = Math.min(Math.max(0, gap - elecDeg), fuelDegCap);
  const heatDegrees = elecDeg + fuelDeg;
  const kwh = round1(elecDeg * COLD.ELECTRIC_PER_DEGREE);
  const fuelCost = round1(fuelDeg * COLD.FUEL_PER_DEGREE);
  const mode: HeatMode = kwh > 0 ? 'electric' : fuelCost > 0 ? 'fuel' : 'off';
  return {
    ...actual,
    mode,
    heatDegrees,
    indoor: round1(Math.min(COLD.MAX_INDOOR, actual.leaked + heatDegrees)),
    fuelCost,
    kwh,
  };
}

export function heatMissed(previewIndoor: number, actualIndoor: number): boolean {
  return previewIndoor - actualIndoor >= COLD.SURPRISE_GAP;
}

/** @deprecated 兼容旧调用：未加热 = 按今日室外漏一晚 */
export function unheatedFelt(run: RunState): number {
  return previewNight(run).leaked;
}

export function heatGap(run: RunState): number {
  const p = previewNight(run);
  return Math.max(0, p.target - p.leaked);
}

export function fuelHeatCost(run: RunState): number {
  return previewNight(run).fuelCost;
}

export function electricHeatKwh(run: RunState): number {
  return heatWantKwh(run);
}

export function canFuelHeat(run: RunState): boolean {
  return insulateLevel(run) >= 1;
}

export function canElectricHeat(run: RunState): boolean {
  return insulateLevel(run) >= 2 && run.modules.power >= 1;
}

export const HYPO_IDS = ['hypothermiaMild', 'hypothermiaMod', 'hypothermiaSevere'] as const;

export function hypoStageOf(run: RunState): 0 | 1 | 2 | 3 {
  if (run.conditions.includes('hypothermiaSevere')) return 3;
  if (run.conditions.includes('hypothermiaMod')) return 2;
  if (run.conditions.includes('hypothermiaMild')) return 1;
  return 0;
}
