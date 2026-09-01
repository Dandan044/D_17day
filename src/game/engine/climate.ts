/**
 * 未加热体感与取暖成本。不读电力系统，避免和 computePower 循环依赖。
 */

import { COLD } from '../balance';
import { SITE_BY_ID } from '../content/sites';
import type { RunState, WeatherId } from '../types';

/** 产水天气：雨雪与黑雨。落灰不算。 */
export const PRECIP_WEATHER: WeatherId[] = ['rain', 'storm', 'flooding', 'snow', 'blizzard', 'blackRain'];

export function isPrecipWeather(weather: WeatherId): boolean {
  return PRECIP_WEATHER.includes(weather);
}

export function unheatedFelt(run: RunState): number {
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  let t = run.world.temperature;
  if (site.tags.includes('site:underground')) t = t * 0.35 + 15 * 0.65;
  if (site.tags.includes('site:elevated')) t -= 3;
  if (site.tags.includes('site:cramped')) t += 1;
  return Math.round(t * 10) / 10;
}

export function heatGap(run: RunState): number {
  return Math.max(0, COLD.TARGET - unheatedFelt(run));
}

export function insulateLevel(run: RunState): number {
  return Math.max(0, Math.min(3, run.modules.insulate));
}

export function fuelHeatCost(run: RunState): number {
  const lvl = insulateLevel(run);
  const per = COLD.FUEL_PER_DEGREE[lvl] ?? 0;
  if (per <= 0) return 0;
  return Math.round(heatGap(run) * per * 10) / 10;
}

export function electricHeatKwh(run: RunState): number {
  const lvl = insulateLevel(run);
  const per = COLD.ELECTRIC_PER_DEGREE[lvl] ?? 0;
  if (per <= 0) return 0;
  return Math.round(heatGap(run) * per * 10) / 10;
}

export function canFuelHeat(run: RunState): boolean {
  return insulateLevel(run) >= 1;
}

export function canElectricHeat(run: RunState): boolean {
  return insulateLevel(run) >= 2 && run.modules.power >= 1;
}
