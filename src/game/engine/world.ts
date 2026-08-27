/**
 * 世界状态：初始化、每日演化、天气与气温。
 *
 * 世界不是"第几天难度乘几"，而是一组会互相影响的连续量。
 * 事件只读标签，标签只读这里，所以气温曲线一改，整个事件池的语气会跟着变。
 */

import { EXPOSURE, TIME, threatOfDay } from '../balance';
import { DISASTER_BY_ID } from '../content/disasters';
import type { Rng } from '../rng';
import type { DisasterId, FactionId, RunState, WeatherId, WorldState } from '../types';

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

export const WEATHER_NAME: Record<WeatherId, string> = {
  clear: '晴',
  overcast: '阴',
  rain: '雨',
  storm: '暴风雨',
  flooding: '内涝',
  snow: '雪',
  blizzard: '暴风雪',
  ashfall: '落灰',
  blackRain: '黑雨',
  fog: '浓雾',
  heatwave: '高温',
};

export const WEATHER_DESC: Record<WeatherId, string> = {
  clear: '天很干净。太阳能板今天能吃饱。',
  overcast: '低云压着，光线是均匀的灰。',
  rain: '雨不大但不停，屋檐在滴水。',
  storm: '风把东西刮得到处响，出门要冒险。',
  flooding: '水在往上走。低处的一切都不再安全。',
  snow: '雪落下来，盖住了所有脚印——包括你的。',
  blizzard: '风雪贴着地面横着走，能见度不到十米。',
  ashfall: '灰像脏雪一样落，吸进去会留在肺里。',
  blackRain: '雨是灰黑色的，落在皮肤上有细微的颗粒感。',
  fog: '雾很浓。你听得见远处的声音，但看不见来源。',
  heatwave: '闷热得反常，储水消耗得比预计快。',
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
  return {
    disaster,
    revealed: false,
    weather,
    forecast: [rng.pick(PREP_WEATHER), rng.pick(PREP_WEATHER)],
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

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 准备期的每日演化：恐慌在升温，物价在飞 */
export function advanceWorldPrep(run: RunState, rng: Rng): void {
  const w = run.world;
  const daysLeft = TIME.PREP_DAYS - run.day + 1;

  w.priceIndex *= 1 + rng.float(0.16, 0.4) * (daysLeft <= 3 ? 1.35 : 1);
  w.lawOrder = clamp(w.lawOrder - rng.float(2.5, 6), 0, 100);
  w.scarcity = clamp(w.scarcity + rng.float(6, 13), 0, 100);

  w.weather = pickWeather(run, rng);
  w.forecast = [rng.pick(PREP_WEATHER), rng.pick(PREP_WEATHER)];
  w.temperature = Math.round(baseTemperature(run.day) + WEATHER_TEMP[w.weather] + rng.float(-1.5, 1.5));

  // 恐慌让掠夺者提前活跃
  if (w.lawOrder < 70) w.factions.looter = clamp(w.factions.looter + rng.float(3, 8), 0, 100);
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

  w.weather = pickWeather(run, rng);
  w.temperature = Math.round(baseTemperature(run.day) + WEATHER_TEMP[w.weather] + def.tempBias * 0.4);
}

/** 生存期的每日演化 */
export function advanceWorldSurvival(run: RunState, rng: Rng): void {
  const w = run.world;
  const def = DISASTER_BY_ID[w.disaster];
  const threat = threatOfDay(run.day);
  const d = def.daily(run.day, threat);

  w.airPollution = clamp(w.airPollution + (d.airPollution ?? 0) + rng.float(-1.5, 1.5), 0, 100);
  w.radiation = clamp(w.radiation + (d.radiation ?? 0), 0, 100);
  w.contagion = clamp(w.contagion + (d.contagion ?? 0), 0, 100);
  w.lawOrder = clamp(w.lawOrder + (d.lawOrder ?? 0) + rng.float(-0.8, 0.8), 0, 100);
  w.scarcity = clamp(w.scarcity + (d.scarcity ?? 0), 0, 100);

  // 势力活跃度随秩序崩解而上升
  const disorder = (100 - w.lawOrder) / 100;
  for (const f of def.factions) {
    w.factions[f] = clamp(w.factions[f] + disorder * rng.float(0.6, 2.2), 0, 100);
  }
  w.factions.neighbors = clamp(w.factions.neighbors - rng.float(0.3, 1.4), 0, 100);
  w.factionStance.neighbors = clamp(w.factionStance.neighbors + (w.neighborhood > 0 ? 0.6 : -0.9), -100, 100);

  // 暴露度自然衰减；掩盖性天气额外降热
  let decay = EXPOSURE.DECAY;
  if (w.weather === 'snow' || w.weather === 'blizzard' || w.weather === 'fog') decay += EXPOSURE.WEATHER_COVER;
  w.exposure = clamp(w.exposure - decay, 0, EXPOSURE.MAX);

  w.weather = pickWeather(run, rng);
  w.forecast = [pickWeather(run, rng), pickWeather(run, rng)];

  const bias = def.tempBias * Math.min(1, threat / 3);
  w.temperature = Math.round(baseTemperature(run.day) + bias + WEATHER_TEMP[w.weather] + rng.float(-2, 2));
  w.season = baseTemperature(run.day) + bias < 9 ? 'winter' : 'autumn';

  // 洪水会退，毒云会飘走
  if (w.disaster === 'flood' && threat >= 4 && w.waterTable === 'flooded') w.waterTable = 'polluted';
}

/**
 * 天气预报：准确度随文明崩坏而下降。
 * 让寒潮和尘暴从"随机砸脸"变成"可以提前囤燃料"。
 */
export function forecastAccuracy(run: RunState): number {
  const radio = run.modules.radio;
  const base = run.world.powerGrid === 'on' ? 0.9 : 0.45;
  return Math.min(0.95, base + radio * 0.13 - run.threat * 0.04);
}
