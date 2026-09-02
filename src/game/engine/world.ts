/**
 * 世界状态：初始化、每日演化、天气与气温。
 *
 * 世界不是"第几天难度乘几"，而是一组会互相影响的连续量。
 * 事件只读标签，标签只读这里，所以气温曲线一改，整个事件池的语气会跟着变。
 */

import { EXPOSURE, TIME, threatOfDay } from '../balance';
import { WEATHER_DESC, WEATHER_NAME } from '../copy/names';
import { DISASTER_BY_ID } from '../content/disasters';
import type { Rng } from '../rng';
import type { DisasterId, FactionId, RunState, WeatherId, WorldState } from '../types';
import { activateIodineProtection, effectiveModule } from './tags';

export { WEATHER_DESC, WEATHER_NAME };

const PREP_WEATHER: WeatherId[] = ['clear', 'clear', 'overcast', 'rain', 'fog', 'overcast'];

/** 天气对体感温度的修正 */
const WEATHER_TEMP: Record<WeatherId, number> = {
  clear: 1,
  overcast: 0,
  rain: -2,
  storm: -3,
  flooding: -2,
  snow: -5,
  blizzard: -9,
  ashfall: -4,
  blackRain: -2,
  fog: -1,
  heatwave: 10,
};

/** 季节基础温度：从初秋走到深冬 */
function baseTemperature(day: number): number {
  return 19 - (Math.min(day, TIME.FINAL_DAY) / TIME.FINAL_DAY) * 17;
}

export function createWorld(disaster: DisasterId, rng: Rng): WorldState {
  const factions = {} as Record<FactionId, number>;
  const factionStance = {} as Record<FactionId, number>;
  const ALL: FactionId[] = ['gov', 'militia', 'gang', 'looter', 'quarantine', 'cult', 'refugee', 'rescue', 'neighbors', 'trader'];
  for (const f of ALL) {
    factions[f] = 0;
    factionStance[f] = 0;
  }
  factions.neighbors = 45;
  factionStance.neighbors = 15;

  const weather = rng.pick(PREP_WEATHER);
  const tomorrow = rng.pick(PREP_WEATHER);
  return {
    disaster,
    revealed: false,
    weather,
    queuedWeather: tomorrow,
    forecast: [tomorrow, rng.pick(PREP_WEATHER)],
    temperature: Math.round(baseTemperature(1) + WEATHER_TEMP[weather]),
    season: 'autumn',
    airPollution: 8,
    radiation: 2,
    contagion: 2,
    waterTable: 'normal',
    powerGrid: 'on',
    lawOrder: 93,
    scarcity: 12,
    neighborhood: 12,
    exposure: 0,
    factions,
    factionStance,
    priceIndex: 1,
  };
}

function pickWeather(run: RunState, rng: Rng): WeatherId {
  if (run.day < TIME.COLLAPSE_DAY) return rng.pick(PREP_WEATHER);
  const def = DISASTER_BY_ID[run.world.disaster];
  const entries = Object.entries(def.weather) as Array<[WeatherId, number]>;
  const picked = rng.weighted(entries, ([, w]) => w);
  return picked ? picked[0] : 'overcast';
}

function weatherPool(run: RunState): WeatherId[] {
  if (run.day < TIME.COLLAPSE_DAY) return [...new Set(PREP_WEATHER)];
  const def = DISASTER_BY_ID[run.world.disaster];
  return Object.keys(def.weather) as WeatherId[];
}

function decoyWeather(run: RunState, actual: WeatherId, rng: Rng): WeatherId {
  const others = weatherPool(run).filter((w) => w !== actual);
  return others.length > 0 ? rng.pick(others) : actual;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 掷出次日天候。预报按准确度对 queuedWeather 撒谎或说真话。 */
export function tickClimate(run: RunState, rng: Rng, forDay?: number): void {
  const w = run.world;
  const day = forDay ?? run.day;
  const acc = forecastAccuracy(run);
  const today = w.queuedWeather ?? pickWeather(run, rng);
  const tomorrow = pickWeather(run, rng);
  const dayAfter = pickWeather(run, rng);
  w.weather = today;
  w.queuedWeather = tomorrow;
  w.forecast = [
    rng.chance(acc) ? tomorrow : decoyWeather(run, tomorrow, rng),
    rng.chance(Math.max(0.12, acc * 0.65)) ? dayAfter : decoyWeather(run, dayAfter, rng),
  ];

  const def = DISASTER_BY_ID[w.disaster];
  const threat = threatOfDay(day);
  if (day < TIME.COLLAPSE_DAY) {
    w.temperature = Math.round(baseTemperature(day) + WEATHER_TEMP[w.weather] + rng.float(-1.5, 1.5));
    w.season = 'autumn';
  } else {
    const bias = def.tempBias * Math.min(1, threat / 3);
    w.temperature = Math.round(baseTemperature(day) + bias + WEATHER_TEMP[w.weather] + rng.float(-2, 2));
    w.season = baseTemperature(day) + bias < 9 ? 'winter' : 'autumn';
  }
}

export function decayExposure(run: RunState): number {
  const w = run.world;
  let decay = EXPOSURE.DECAY;
  if (w.weather === 'snow' || w.weather === 'blizzard' || w.weather === 'fog') decay += EXPOSURE.WEATHER_COVER;
  const before = w.exposure;
  w.exposure = clamp(w.exposure - decay, 0, EXPOSURE.MAX);
  return Math.round((before - w.exposure) * 10) / 10;
}

/** 准备期的物价/秩序（不含天候，天候在抽完次日事件后再掷） */
export function tickPrepEconomy(run: RunState, rng: Rng): void {
  const w = run.world;
  const daysLeft = TIME.PREP_DAYS - run.day + 1;

  w.priceIndex *= 1 + rng.float(0.16, 0.4) * (daysLeft <= 3 ? 1.35 : 1);
  w.lawOrder = clamp(w.lawOrder - rng.float(2.5, 6), 0, 100);
  w.scarcity = clamp(w.scarcity + rng.float(6, 13), 0, 100);

  if (w.lawOrder < 70) w.factions.looter = clamp(w.factions.looter + rng.float(3, 8), 0, 100);
}

/** 准备期的每日演化：恐慌在升温，物价在飞 */
export function advanceWorldPrep(run: RunState, rng: Rng): void {
  tickPrepEconomy(run, rng);
  tickClimate(run, rng);
}

/** 生存期污染/势力（不含天候与暴露衰减） */
export function tickSurvivalPressures(run: RunState, rng: Rng): void {
  const w = run.world;
  const def = DISASTER_BY_ID[w.disaster];
  const threat = threatOfDay(run.day);
  const d = def.daily(run.day, threat);

  w.airPollution = clamp(w.airPollution + (d.airPollution ?? 0) + rng.float(-1.5, 1.5), 0, 100);
  w.radiation = clamp(w.radiation + (d.radiation ?? 0), 0, 100);
  w.contagion = clamp(w.contagion + (d.contagion ?? 0), 0, 100);
  w.lawOrder = clamp(w.lawOrder + (d.lawOrder ?? 0) + rng.float(-0.8, 0.8), 0, 100);
  w.scarcity = clamp(w.scarcity + (d.scarcity ?? 0), 0, 100);

  const disorder = (100 - w.lawOrder) / 100;
  for (const f of def.factions) {
    w.factions[f] = clamp(w.factions[f] + disorder * rng.float(0.6, 2.2), 0, 100);
  }
  w.factions.neighbors = clamp(w.factions.neighbors - rng.float(0.3, 1.4), 0, 100);
  w.factionStance.neighbors = clamp(w.factionStance.neighbors + (w.neighborhood > 0 ? 0.6 : -0.9), -100, 100);

  if (w.disaster === 'flood' && threat >= 4 && w.waterTable === 'flooded') w.waterTable = 'polluted';
}

/** 崩溃日：施加灾难的初始状态并激活专属势力 */
export function applyOnset(run: RunState, rng: Rng): void {
  const def = DISASTER_BY_ID[run.world.disaster];
  const w = run.world;
  w.revealed = true;

  for (const [k, v] of Object.entries(def.onset)) {
    if (v === undefined) continue;
    if (k === 'waterTable') w.waterTable = v as WorldState['waterTable'];
    else if (k === 'powerGrid') w.powerGrid = v as WorldState['powerGrid'];
    else (w as unknown as Record<string, number>)[k] = v as number;
  }

  for (const f of def.factions) {
    w.factions[f] = clamp(w.factions[f] + rng.float(28, 45), 0, 100);
  }
  w.factions.trader = clamp(w.factions.trader + 12, 0, 100);

  w.queuedWeather = undefined;
  tickClimate(run, rng);

  // 准备期囤的碘片从今天起才开始保护甲状腺
  activateIodineProtection(run);
}

/** 生存期的每日演化 */
export function advanceWorldSurvival(run: RunState, rng: Rng): void {
  tickSurvivalPressures(run, rng);
  tickClimate(run, rng);
}

/**
 * 天气预报：准确度随文明崩坏而下降。
 * 让寒潮和尘暴从"随机砸脸"变成"可以提前囤燃料"。
 */
export function forecastAccuracy(run: RunState): number {
  const radio = effectiveModule(run, 'radio');
  const base = run.world.powerGrid === 'on' ? 0.9 : 0.45;
  return Math.min(0.95, base + radio * 0.13 - run.threat * 0.04);
}
