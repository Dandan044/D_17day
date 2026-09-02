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
  const gap = Math.max(0, (run.heatTarget ?? comfortTemp(run)) - leaked);
  if (gap <= 0) return 0;
  return round1(gap * COLD.ELECTRIC_PER_DEGREE);
}

/**
 * 电优先、油补缺口。`elecGrantedKwh` 是供电表按优先级实际分给温控的电。
 */
export function heatPlan(run: RunState, outdoor: number, elecGrantedKwh = 0): HeatPlan {
  const sink = thermalSink(run, outdoor);
  const leaked = leakIndoor(currentIndoor(run), sink, leakRate(run), occupancyHeat(run));
  const target = run.heatTarget ?? comfortTemp(run);
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
    indoor: round1(leaked + heatDegrees),
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
    indoor: round1(actual.leaked + heatDegrees),
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
