/**
 * 资源经济：配给消耗、腐败、产出、物价、采购与搜刮。
 */

import { BANK, CAPS, DIFFICULTY, FILTER, FOOD_NEED, LOOT, PRICE, STAMINA, TIME, WATER_NEED, WEAR } from '../balance';
import { t } from '../copy/t';
import { BASE_PRICE, LOCATION_BY_ID, RES_WEIGHT } from '../content/locations';
import { SITE_BY_ID } from '../content/sites';
import type { Rng } from '../rng';
import type { Difficulty, Location, ResourceId, RunState, WeatherId } from '../types';
import { canElectricHeat, canFuelHeat, capHeat, comfortTemp, heatMissed, indoorBandOf, isPrecipWeather, survivalTemp, type HeatPlan } from './climate';
import { computePower, LOAD_NAME, loadOnline, tonightHeat } from './power';
import { ledger, type LedgerNote } from './ledger';
import { effectiveModule, grantIodine, headcount, iodineStockCount, waterCapacity } from './tags';

/** 每日采购上限，防止第一天把全城搬空 */
const DAILY_BUY_CAP: Record<ResourceId, number> = {
  water: 40,
  foodStaple: 20,
  foodFresh: 12,
  meds: 8,
  fuel: 25,
  materials: 20,
  parts: 15,
  ammo: 20,
  cash: 3000,
};

export { isPrecipWeather, PRECIP_WEATHER } from './climate';

// ============================================================
// 需求与消耗
// ============================================================

export interface DailyNeeds {
  water: number;
  food: number;
  heads: number;
  /** 今日是否走了旱天回用 */
  recycling: boolean;
}

export function dailyNeeds(run: RunState, difficulty: Difficulty = 'normal', weather: WeatherId = run.world.weather): DailyNeeds {
  const heads = headcount(run);
  const mult = DIFFICULTY[difficulty].needMult;
  let upkeep = 1;
  for (const s of run.survivors) upkeep += s.upkeep - 1;

  let water = WATER_NEED[run.waterUse] * heads * mult * upkeep;
  const food = FOOD_NEED[run.ration] * heads * mult * upkeep;

  // 高温天多喝水
  if (weather === 'heatwave') water *= 1.3;

  // 旱天回用：有在线净水时降低耗水（不是往桶里加水）
  let recycling = false;
  const filter = effectiveModule(run, 'filter');
  const precip = isPrecipWeather(weather);
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  const hasWell = site.tags.includes('site:hasWell');
  const cisternBusy = run.projects.some((p) => p.moduleId === 'cistern');
  if (filter > 0 && !precip && !hasWell && !cisternBusy) {
    water *= FILTER.RECYCLE_NEED[filter] ?? 1;
    recycling = true;
  } else if (filter > 0 && !precip && hasWell) {
    // 有井：旱天滤井水，不走回用降耗
    recycling = false;
  }

  return {
    water: Math.round(water * 10) / 10,
    food: Math.round(food * 10) / 10,
    heads,
    recycling,
  };
}

export interface ConsumeResult {
  waterRatio: number;
  foodRatio: number;
  drankRaw: boolean;
  /** 今天喝了新滤的雨水或回用水 */
  drankFiltered: boolean;
  recycling: boolean;
  heated: boolean;
  heatKind?: 'fuel' | 'electric';
  indoor: number;
  previewIndoor: number;
  fuelBudget: number;
  fuelSpent: number;
  kwhBudget: number;
  kwhSpent: number;
  notes: LedgerNote[];
}

/**
 * 原水供应：现在主要用于井水与「有没有可喝的脏水」判定。
 * 雨日产水不再乘这个系数。
 */
export function rawWaterFactor(run: RunState): number {
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  if (site.tags.includes('site:hasWell')) return 1.2;
  if (run.world.waterTable === 'flooded') return 1.1;
  if (isPrecipWeather(run.world.weather)) return 1;
  if (run.flags.includes('flag:rainCatcher')) return 0.8;
  if (site.tags.includes('site:isolated')) return CAPS.RAW_WATER_DRY_MULT * 0.7;
  return CAPS.RAW_WATER_DRY_MULT;
}

export function hasRawWater(run: RunState): boolean {
  return rawWaterFactor(run) > 0;
}

/** 今日净水是否产了水（雨日或井水） */
export function didFilterHarvest(run: RunState): boolean {
  return (run as RunState & { _filterHarvested?: boolean })._filterHarvested === true;
}

/** 储水桶还能装多少升 */
export function waterRoom(run: RunState): number {
  return Math.max(0, Math.round((waterCapacity(run) - run.res.water) * 10) / 10);
}

/** 每日产出：农圃产生鲜、净水（仅雨雪/井）产饮用水 */
export function applyProduction(run: RunState): LedgerNote[] {
  const notes: LedgerNote[] = [];
  (run as RunState & { _filterHarvested?: boolean })._filterHarvested = false;
  // 清掉「当天回用」标记，由 consumeDaily / deriveFacts 再设
  run.flags = run.flags.filter((f) => f !== 'flag:waterRecyclingToday');

  const garden = effectiveModule(run, 'garden');
  if (garden > 0) {
    let yieldAmt = CAPS.GARDEN_YIELD[garden] ?? 0;
    if (run.world.airPollution > 60) yieldAmt *= 0.5;
    if (run.world.temperature < 0) yieldAmt *= 0.6;
    if (yieldAmt > 0) {
      run.res.foodFresh += yieldAmt;
      notes.push(ledger(t('ledger.garden.yield', { amt: yieldAmt.toFixed(1) })));
    }
  }

  const filter = effectiveModule(run, 'filter');
  const cisternBusy = run.projects.some((p) => p.moduleId === 'cistern');
  const precip = isPrecipWeather(run.world.weather);
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  const hasWell = site.tags.includes('site:hasWell');

  if (filter > 0 && cisternBusy) {
    notes.push(ledger(t('ledger.filter.tankCleaning'), 'bad'));
  } else if (filter > 0 && (precip || hasWell)) {
    let amt = FILTER.RAIN_OUTPUT[filter] ?? 0;
    if (precip) {
      amt *= FILTER.WEATHER_YIELD[run.world.weather] ?? 1;
    } else {
      // 旱天井水
      amt *= FILTER.WELL_DRY_MULT;
    }
    amt = Math.round(amt * 10) / 10;
    if (amt > 0) {
      const room = waterRoom(run);
      const stored = Math.min(amt, room);
      const wasted = Math.round((amt - stored) * 10) / 10;
      run.res.water += stored;
      if (stored > 0) {
        (run as RunState & { _filterHarvested?: boolean })._filterHarvested = true;
        const overflow = wasted > 0 ? t('ledger.filter.overflowBit', { wasted }) : '';
        notes.push(
          ledger(
            (precip ? t('ledger.filter.rainStored', { stored, overflow }) : t('ledger.filter.wellStored', { stored, overflow })),
            'good',
          ),
        );
      } else {
        notes.push(ledger(t('ledger.filter.allOverflow', { amt }), 'bad'));
      }
    }
  } else if (filter <= 0 && precip) {
    if (run.modules.filter > 0) {
      if (run.projects.some((p) => p.moduleId === 'filter')) {
        notes.push(ledger(t('ledger.filter.building')));
      } else if (run.wear.filterLife <= 0) {
        notes.push(ledger(t('ledger.filter.clogged'), 'bad'));
      } else {
        notes.push(ledger(t('ledger.filter.noPower'), 'bad'));
      }
    } else {
      notes.push(ledger(t('ledger.filter.noModule')));
    }
  }

  // 滤芯寿命：净水侧按天气/污染；空气过滤另计
  const airFilter = effectiveModule(run, 'airFilter');
  if (filter > 0 || airFilter > 0) {
    let drain = 0;
    if (filter > 0) {
      if (precip) {
        if (run.world.weather === 'blackRain') drain += FILTER.WEAR_BLACK_RAIN;
        else if (run.world.weather === 'flooding') drain += FILTER.WEAR_FLOODING;
        else if (run.world.weather === 'storm' || run.world.weather === 'blizzard') drain += FILTER.WEAR_STORM;
        else drain += FILTER.WEAR_RAIN;
      } else if (!hasWell) {
        drain += FILTER.WEAR_RECYCLE;
      } else {
        drain += FILTER.WEAR_RAIN * FILTER.WELL_DRY_MULT;
      }
      drain *= FILTER.WEAR_LEVEL_MULT[filter] ?? 1;
    }
    if (airFilter > 0) drain += FILTER.WEAR_AIR;
    if (run.world.weather === 'ashfall') drain += FILTER.WEAR_ASH + WEAR.FILTER_EXTRA_DUST;
    drain += (run.world.airPollution / 40) * FILTER.WEAR_POLLUTION_PER_40;
    drain += (run.world.radiation / 40) * FILTER.WEAR_RAD_PER_40;
    if (run.abilities.includes('chemist_consumables')) drain *= 0.6;
    if (run.abilities.includes('perk_maintainer')) drain *= 0.65;
    run.wear.filterLife -= drain;
    if (run.wear.filterLife <= 0) {
      notes.push(ledger(t('ledger.filter.dead'), 'bad'));
    } else if (run.wear.filterLife <= 4) {
      notes.push(ledger(t('ledger.filter.daysLeft', { days: Math.ceil(run.wear.filterLife) }), 'bad'));
    }
  }

  return notes;
}

/** 同伴的秘密在条件满足时揭露——这是他们真正的分量所在 */
export function revealSecrets(run: RunState): string[] {
  const notes: string[] = [];
  for (const s of run.survivors) {
    if (s.secretRevealed || !s.secret) continue;
    const byTrust = s.secret.revealAtTrust !== undefined && s.trust >= s.secret.revealAtTrust;
    const byTime =
      s.secret.revealAfterDays !== undefined && run.day - s.joinedDay >= s.secret.revealAfterDays;
    if (byTrust || byTime) {
      s.secretRevealed = true;
      notes.push(s.secret.text);
      // 藏了枪的人会把它交出来；潜伏的感染者会把病带进屋
      if (s.secret.id === 'chen_gun') run.res.ammo += 8;
      if (s.secret.id === 'zhao_exposed') run.world.contagion = Math.min(100, run.world.contagion + 8);
      if (s.secret.id === 'stranger_scout') {
        run.world.exposure = Math.min(100, run.world.exposure + 22);
        if (!run.flags.includes('flag:scoutInside')) run.flags.push('flag:scoutInside');
      }
    }
  }
  return notes;
}

/** 生鲜腐败：冰箱有电则慢，没电则快 */
export function spoilFood(run: RunState): LedgerNote[] {
  if (run.res.foodFresh <= 0) return [];
  const cold = run.world.temperature < 4;
  let rate = cold ? 0.15 : 0.34;
  const fridgeOn = loadOnline(run, 'fridge');
  if (fridgeOn) rate *= 0.4;
  else rate *= 1.45;
  const lost = run.res.foodFresh * rate;
  if (lost < 0.1) return [];
  run.res.foodFresh = Math.max(0, run.res.foodFresh - lost);
  return [
    ledger(
      fridgeOn
        ? t('ledger.fridge.on', { amt: lost.toFixed(1) })
        : t('ledger.fridge.off', { amt: lost.toFixed(1) }),
      fridgeOn ? 'neutral' : 'bad',
    ),
  ];
}

export function consumeDaily(
  run: RunState,
  rng: Rng,
  difficulty: Difficulty = 'normal',
  budget?: HeatPlan,
  nightWeather?: WeatherId,
): ConsumeResult {
  const need = dailyNeeds(run, difficulty, nightWeather ?? run.world.weather);
  const notes: LedgerNote[] = [];
  const filterLv = effectiveModule(run, 'filter');
  const harvested = !!(run as RunState & { _filterHarvested?: boolean })._filterHarvested;
  if (harvested) need.recycling = false;

  // --- 水 ---
  const waterAvail = run.res.water;
  const waterUsed = Math.min(need.water, waterAvail);
  run.res.water = Math.max(0, waterAvail - waterUsed);
  const waterRatio = need.water > 0 ? waterUsed / need.water : 1;
  const waterLeft = Math.round(run.res.water * 10) / 10;

  if (need.recycling) {
    if (!run.flags.includes('flag:waterRecyclingToday')) run.flags.push('flag:waterRecyclingToday');
    const mult = FILTER.RECYCLE_NEED[filterLv] ?? 1;
    notes.push(ledger(t('ledger.ration.recycle', { mult: mult.toFixed(2) })));
    notes.push(
      ledger(
        t('ledger.ration.recycleUse', {
          used: waterUsed.toFixed(1),
          need: need.water.toFixed(1),
          left: waterLeft,
        }),
      ),
    );
  } else {
    notes.push(
      ledger(
        t('ledger.ration.water', {
          used: waterUsed.toFixed(1),
          need: need.water.toFixed(1),
          left: waterLeft,
        }),
      ),
    );
  }

  // 存水不够时，会不会去喝没处理过的水
  let drankRaw = false;
  if (waterRatio < 0.6 && hasRawWater(run) && filterLv === 0) {
    drankRaw = true;
    notes.push(ledger(t('ledger.ration.dirty'), 'bad'));
  }

  // 今天喝了新滤的水或回用水（用于致病掷骰）
  const drankFiltered =
    filterLv > 0 && waterUsed > 0 && (harvested || need.recycling) && !drankRaw;

  // --- 食物：先吃会坏的 ---
  let foodNeed = need.food;
  const freshUsed = Math.min(run.res.foodFresh, foodNeed);
  run.res.foodFresh -= freshUsed;
  foodNeed -= freshUsed;
  const stapleUsed = Math.min(run.res.foodStaple, foodNeed);
  run.res.foodStaple -= stapleUsed;
  foodNeed -= stapleUsed;
  const foodRatio = need.food > 0 ? (need.food - foodNeed) / need.food : 1;
  const foodTotal = Math.round((freshUsed + stapleUsed) * 10) / 10;
  const foodBits: string[] = [];
  if (freshUsed > 0.01) foodBits.push(t('ledger.ration.foodBits', { kind: t('ledger.ration.fresh'), amt: freshUsed.toFixed(1) }));
  if (stapleUsed > 0.01) foodBits.push(t('ledger.ration.foodBits', { kind: t('ledger.ration.staple'), amt: stapleUsed.toFixed(1) }));
  notes.push(
    ledger(
      foodBits.length > 0
        ? t('ledger.ration.food', { amt: foodTotal.toFixed(1), bits: foodBits.join(' + ') })
        : t('ledger.ration.foodZero', { need: need.food.toFixed(1) }),
      foodRatio < 0.99 ? 'bad' : 'neutral',
    ),
  );

  if (waterRatio < 0.99) {
    notes.push(ledger(t('ledger.ration.waterGap', { pct: ((1 - waterRatio) * 100).toFixed(0) }), 'bad'));
  }
  if (foodRatio < 0.99) {
    notes.push(ledger(t('ledger.ration.foodGap', { pct: ((1 - foodRatio) * 100).toFixed(0) }), 'bad'));
  }

  const est = budget ?? tonightHeat(run).plan;
  const actual = tonightHeat(run).plan;
  let resolved = capHeat(est, actual);

  const power = computePower(run, resolved.kwh);
  if (resolved.kwh > 0 && !(canElectricHeat(run) && power.heaterGranted > 1e-9)) {
    resolved = capHeat({ ...est, kwh: 0 }, actual);
  }
  const weatherBit = power.weatherMult !== 1 ? t('ledger.power.weatherBit', { mult: power.weatherMult.toFixed(2) }) : '';
  notes.push(
    ledger(
      t('ledger.power.solar', { solar: power.solar.toFixed(1), weather: weatherBit }) +
        (power.grid > 0 ? t('ledger.power.gridBit', { amt: power.grid.toFixed(1) }) : '') +
        (power.generator > 0 ? t('ledger.power.genBit', { amt: power.generator.toFixed(1) }) : ''),
    ),
  );
  if (power.offline.length > 0) {
    notes.push(ledger(t('ledger.power.offline', { list: power.offline.map((id) => LOAD_NAME[id] ?? id).join('、') }), 'bad'));
  }

  if (power.fuelBurn > 0) {
    run.res.fuel = Math.max(0, run.res.fuel - power.fuelBurn);
    run.wear.generatorOil -= 1;
    notes.push(ledger(t('ledger.power.fuel', { amt: power.fuelBurn.toFixed(1) })));
    if (run.wear.generatorOil <= 0 && rng.chance(0.3)) {
      notes.push(ledger(t('ledger.power.oilWarn'), 'bad'));
    }
  }
  if (resolved.fuelCost > run.res.fuel + 1e-9) {
    resolved = capHeat({ ...est, kwh: resolved.kwh, fuelCost: Math.max(0, run.res.fuel) }, actual);
  }

  if (power.battery > 0) {
    notes.push(
      ledger(
        t('ledger.power.battDischarge', {
          amt: power.battery.toFixed(1),
          left: (power.batteryStored - power.battery + power.batteryGain).toFixed(1),
          cap: power.batteryCap,
        }),
      ),
    );
  } else if (power.batteryGain > 0) {
    notes.push(
      ledger(
        t('ledger.power.battCharge', {
          amt: power.batteryGain.toFixed(1),
          left: (power.batteryStored + power.batteryGain).toFixed(1),
          cap: power.batteryCap,
        }),
        'good',
      ),
    );
  } else if (power.batteryStored > 0) {
    notes.push(ledger(t('ledger.power.battIdle', { stored: power.batteryStored.toFixed(1), cap: power.batteryCap })));
  }

  const unheated = actual.leaked;
  let heated = false;
  let heatKind: ConsumeResult['heatKind'];
  let indoor = resolved.indoor;
  const elecDropped = est.kwh > 0 && resolved.kwh <= 0;

  if (resolved.kwh <= 0 && resolved.fuelCost <= 0) {
    notes.push(
      ledger(
        elecDropped
          ? t(canElectricHeat(run) ? 'ledger.heat.elecFail' : 'ledger.heat.elecLocked', { indoor: unheated })
          : t('ledger.heat.off', { indoor }),
        elecDropped ? 'bad' : 'neutral',
      ),
    );
  } else {
    if (elecDropped) {
      notes.push(
        ledger(
          t(canElectricHeat(run) ? 'ledger.heat.elecFail' : 'ledger.heat.elecLocked', { indoor: unheated }),
          'bad',
        ),
      );
    }
    if (resolved.kwh > 0) {
      heated = true;
      heatKind = 'electric';
      notes.push(ledger(t('ledger.heat.elecOn', { indoor })));
    }
    if (resolved.fuelCost > 0) {
      if (!canFuelHeat(run)) {
        notes.push(ledger(t('ledger.heat.fuelNoInsulate', { indoor }), 'bad'));
      } else if (run.res.fuel <= 0) {
        notes.push(ledger(t('ledger.heat.fuelEmpty', { indoor }), 'bad'));
      } else {
        const spent = Math.min(resolved.fuelCost, run.res.fuel);
        run.res.fuel = Math.max(0, run.res.fuel - spent);
        heated = true;
        heatKind = 'fuel';
        notes.push(ledger(t('ledger.heat.fuelBurn', { spent: spent.toFixed(1), indoor })));
      }
    }
  }

  const comfort = comfortTemp(run);
  const survival = survivalTemp(run);
  const droppedBand =
    (est.indoor >= comfort && indoor < comfort) || (est.indoor >= survival && indoor < survival);
  if (droppedBand && indoor < est.indoor) {
    notes.push(ledger(t('ledger.heat.colderThanEst', { est: est.indoor, actual: indoor }), 'bad'));
  } else if (indoor > est.indoor) {
    notes.push(ledger(t('ledger.heat.warmerThanEst', { est: est.indoor, actual: indoor })));
  }
  const outdoorEased = actual.leaked > est.leaked;
  if (!droppedBand && outdoorEased && resolved.fuelCost < est.fuelCost && est.fuelCost > 0) {
    notes.push(ledger(t('ledger.heat.savedFuel', { est: est.fuelCost.toFixed(1), spent: resolved.fuelCost.toFixed(1) })));
  }
  if (!droppedBand && outdoorEased && resolved.kwh < est.kwh && est.kwh > 0) {
    notes.push(ledger(t('ledger.heat.savedKwh', { est: est.kwh.toFixed(1), spent: resolved.kwh.toFixed(1) })));
  }

  run.indoorTemp = indoor;
  run.heatMissed = heatMissed(est.indoor, indoor);
  const band = indoorBandOf(run, indoor);
  run.indoorBand = band;
  if (!run.streaks) run.streaks = { lowRation: 0, noThreatDays: 0, goodRation: 0, belowSurvival: 0 };
  if (run.streaks.belowSurvival === undefined) run.streaks.belowSurvival = 0;
  if (band === 'freeze') run.streaks.belowSurvival += 1;
  else run.streaks.belowSurvival = 0;
  if (band === 'chill' || band === 'freeze') {
    if (!run.flags.includes('flag:wasCold')) run.flags.push('flag:wasCold');
  }

  return {
    waterRatio,
    foodRatio,
    drankRaw,
    drankFiltered,
    recycling: need.recycling,
    heated,
    heatKind,
    indoor,
    previewIndoor: est.indoor,
    fuelBudget: est.fuelCost,
    fuelSpent: resolved.fuelCost,
    kwhBudget: est.kwh,
    kwhSpent: resolved.kwh,
    notes,
  };
}

// ============================================================
// 物价与采购
// ============================================================

export function unitPrice(run: RunState, res: ResourceId, locationId?: string): number {
  const loc = locationId ? LOCATION_BY_ID[locationId] : undefined;
  const locMult = loc?.prices?.[res] ?? 1;
  return Math.max(1, Math.round(BASE_PRICE[res] * run.world.priceIndex * locMult));
}

export function buyLimit(run: RunState, res: ResourceId, hasClerkPerk: boolean): number {
  const base = DAILY_BUY_CAP[res];
  const cap = hasClerkPerk ? base : run.day >= PRICE.RATION_FROM_DAY ? Math.ceil(base * PRICE.RATION_CAP) : base;
  return cap;
}

/** 今日还能买多少：累计限购，不是单次上限 */
export function remainingBuyLimit(run: RunState, res: ResourceId, hasClerkPerk: boolean): number {
  const already = run.boughtToday?.[res] ?? 0;
  return Math.max(0, buyLimit(run, res, hasClerkPerk) - already);
}

export interface PurchaseResult {
  ok: boolean;
  reason?: string;
  spent: number;
  got: number;
  /** 因储水满而少买了一部分 */
  capped?: boolean;
}

function recordPurchase(run: RunState, res: ResourceId, got: number, locationId: string): void {
  if (!run.boughtToday) run.boughtToday = {};
  run.boughtToday[res] = (run.boughtToday[res] ?? 0) + got;
  const st = run.locations.find((l) => l.id === locationId);
  if (st) st.stock = Math.max(0, st.stock - Math.ceil(got * 0.8));
}

export function purchase(
  run: RunState,
  locationId: string,
  res: ResourceId,
  qty: number,
  hasClerkPerk: boolean,
): PurchaseResult {
  const loc = LOCATION_BY_ID[locationId];
  if (!loc || !loc.prepShop) return { ok: false, reason: t('ledger.buy.notShop'), spent: 0, got: 0 };

  const remaining = remainingBuyLimit(run, res, hasClerkPerk);
  let want = Math.min(qty, remaining);
  if (want <= 0) return { ok: false, reason: t('ledger.buy.limit'), spent: 0, got: 0 };

  let capped = false;
  if (res === 'water') {
    const room = waterRoom(run);
    const cap = waterCapacity(run);
    if (room <= 0) {
      return { ok: false, reason: t('ledger.buy.waterFull', { cap }), spent: 0, got: 0 };
    }
    if (want > room) {
      want = room;
      capped = true;
    }
  }

  const st = run.locations.find((l) => l.id === locationId);
  const shelf = st?.stock ?? loc.stock;
  const stockFactor = Math.max(0, shelf / 100);
  // 货架仍有货时就保底能买到 1 件：否则低库存时 UI 亮着 +1 按钮，
  // 引擎却算出 floor(1 × 库存系数) = 0 而报「货架空了」，三方数据不一致
  const available = shelf > 0 ? Math.max(1, Math.floor(want * Math.max(0.15, stockFactor))) : 0;
  if (available <= 0) return { ok: false, reason: t('ledger.buy.empty'), spent: 0, got: 0 };

  let price = unitPrice(run, res, locationId);
  if (hasClerkPerk) price = Math.round(price * 0.9);
  const cost = price * available;
  if (run.res.cash < cost) {
    let afford = Math.floor(run.res.cash / price);
    if (afford <= 0) return { ok: false, reason: t('ledger.buy.noCash'), spent: 0, got: 0 };
    if (res === 'water') {
      const room = waterRoom(run);
      if (room <= 0) return { ok: false, reason: t('ledger.buy.waterFull', { cap: waterCapacity(run) }), spent: 0, got: 0 };
      if (afford > room) {
        afford = Math.floor(room);
        capped = true;
      }
      if (afford <= 0) return { ok: false, reason: t('ledger.buy.waterFull', { cap: waterCapacity(run) }), spent: 0, got: 0 };
    }
    run.res.cash -= price * afford;
    run.res[res] += afford;
    recordPurchase(run, res, afford, locationId);
    return { ok: true, spent: price * afford, got: afford, capped };
  }

  run.res.cash -= cost;
  run.res[res] += available;
  recordPurchase(run, res, available, locationId);
  return { ok: true, spent: cost, got: available, capped: capped || (res === 'water' && available < qty) };
}

export const IODINE_BOX_PRICE = 220;
export const IODINE_BOX_LIMIT = 2;

/**
 * 准备期银行取款：存款 → 手持现金。
 * 只在崩溃日前可用（崩溃后 ATM 断电，只能去大厅里翻现金），每日受 ATM 限额约束。
 */
export function withdrawCash(run: RunState, amount: number): { ok: boolean; reason?: string; got: number } {
  if (run.day >= TIME.COLLAPSE_DAY) return { ok: false, reason: t('ledger.atm.down'), got: 0 };
  const left = BANK.DAILY_LIMIT - run.atmUsed;
  if (left <= 0) return { ok: false, reason: t('ledger.atm.limit'), got: 0 };
  if (run.savings <= 0) return { ok: false, reason: t('ledger.atm.noSavings'), got: 0 };
  const got = Math.max(0, Math.min(Math.floor(amount), left, Math.floor(run.savings)));
  if (got <= 0) return { ok: false, reason: t('ledger.atm.limit'), got: 0 };
  run.savings = Math.round((run.savings - got) * 10) / 10;
  run.res.cash = Math.round(run.res.cash + got);
  run.atmUsed += got;
  return { ok: true, got };
}

export { iodineStockCount as iodineBoughtCount };

export function buyIodine(run: RunState, locationId: string): { ok: boolean; reason?: string; spent: number } {
  if (locationId !== 'pharmacy') return { ok: false, reason: t('ledger.buy.iodineShop'), spent: 0 };
  const bought = iodineStockCount(run);
  if (bought >= IODINE_BOX_LIMIT) return { ok: false, reason: t('ledger.buy.iodineGone'), spent: 0 };
  const price = Math.max(1, Math.round(IODINE_BOX_PRICE * run.world.priceIndex));
  if (run.res.cash < price) return { ok: false, reason: t('ledger.buy.noCash'), spent: 0 };
  run.res.cash -= price;
  if (bought === 0) run.flags.push('flag:iodineStock1');
  else {
    run.flags = run.flags.filter((f) => f !== 'flag:iodineStock1');
    run.flags.push('flag:iodineStock2');
  }
  grantIodine(run);
  return { ok: true, spent: price };
}

/** 一氧化碳报警器：准备期五金店货架特卖，买下只写 flag，不占资源格。 */
export const CO_ALARM_PRICE = 68;

export function buyCoAlarm(run: RunState, locationId: string): { ok: boolean; reason?: string; spent: number } {
  if (locationId !== 'hardware') return { ok: false, reason: t('ledger.buy.coAlarmShop'), spent: 0 };
  if (run.flags.includes('flag:coAlarm')) return { ok: false, reason: t('ledger.buy.coAlarmGone'), spent: 0 };
  const price = Math.max(1, Math.round(CO_ALARM_PRICE * run.world.priceIndex));
  if (run.res.cash < price) return { ok: false, reason: t('ledger.buy.noCash'), spent: 0 };
  run.res.cash -= price;
  run.flags.push('flag:coAlarm');
  return { ok: true, spent: price };
}

// ============================================================
// 搜刮
// ============================================================

/**
 * 一次外出的成本。站点决定底子，距离决定附加。
 *
 * 抽成函数是因为 store 和 simulate 各写了一份搜刮逻辑，而 simulate 那份连燃料都没扣，
 * 两处不一致就会让平衡数据偏离真实游戏。现在两边共用同一份。
 */
export function travelCost(run: RunState, loc: Location): { fuel: number; stamina: number } {
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  const longHaul = !!loc.needsVehicle || loc.distance >= 3;
  return {
    // 站点的底子（公寓 0 = 近处不耗油，农舍 2.5 = 每趟都烧）
    fuel: site.travelFuel + (longHaul ? loc.distance * 1.2 : 0),
    // 基础 + 距离 + 站点的额外消耗
    stamina: STAMINA.SCAVENGE + loc.distance * 3 + site.travelStamina,
  };
}

export function carryCapacity(run: RunState, hasTruckerPerk: boolean): number {
  let cap: number = LOOT.CARRY_BASE;
  if (run.hasVehicle) cap = LOOT.CARRY_VEHICLE;
  else if (run.flags.includes('flag:hasCart')) cap = LOOT.CARRY_CART;
  if (hasTruckerPerk) cap += 40;
  cap += run.skills.fitness * 3;
  if (run.conditions.includes('fracture')) cap *= 0.5;
  return Math.round(cap);
}

export interface HaulItem {
  res: ResourceId;
  amount: number;
  weight: number;
}

export interface Haul {
  locationId: string;
  night: boolean;
  items: HaulItem[];
  /** 途中遭遇的危险等级 0-100，交给上层决定是否触发事件 */
  danger: number;
}

export function rollHaul(run: RunState, locationId: string, night: boolean, rng: Rng, difficulty: Difficulty = 'normal'): Haul {
  const loc = LOCATION_BY_ID[locationId]!;
  const st = run.locations.find((l) => l.id === locationId);
  const stock = st?.stock ?? loc.stock;
  if (stock <= 0) {
    return { locationId, night, items: [], danger: loc.danger };
  }
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];

  const stockMult = stock / 100;
  const threatMult = LOOT.THREAT_MULT[Math.min(LOOT.THREAT_MULT.length - 1, run.threat)] ?? 1;

  const nightYield = night
    ? run.abilities.includes('perk_nightowl')
      ? 1.6
      : LOOT.NIGHT_YIELD
    : 1;
  let nightDanger = night ? LOOT.NIGHT_DANGER : 1;
  if (night && run.abilities.includes('perk_nightowl')) nightDanger *= 0.75;
  const scavBonus = run.abilities.includes('perk_scavenger') ? 1.15 : 1;
  const mult =
    stockMult * threatMult * site.lootMult * DIFFICULTY[difficulty].lootMult * nightYield * scavBonus;

  const items: HaulItem[] = [];
  for (const entry of loc.loot) {
    if (!rng.chance(entry.chance)) continue;
    const raw = rng.float(entry.min, entry.max) * mult;
    const amount = entry.res === 'cash' ? Math.round(raw) : Math.round(raw * 10) / 10;
    if (amount <= 0) continue;
    items.push({ res: entry.res, amount, weight: amount * (RES_WEIGHT[entry.res] ?? 1) });
  }

  let danger = loc.danger * nightDanger;
  danger += (100 - run.world.lawOrder) * 0.35;
  danger -= run.skills.stealth * 5;
  danger -= effectiveModule(run, 'conceal') * 2;
  if (run.world.weather === 'fog' || run.world.weather === 'blizzard') danger -= 8;
  danger *= DIFFICULTY[difficulty].raidMult;

  return { locationId, night, items, danger: Math.max(0, Math.min(100, Math.round(danger))) };
}

/** 玩家在负重上限内挑选后提交。水按剩余容量截断。 */
export function commitHaul(run: RunState, picked: HaulItem[]): { notes: string[] } {
  const notes: string[] = [];
  let room = waterRoom(run);
  for (const it of picked) {
    if (it.res === 'water') {
      if (room <= 0) {
        notes.push(t('ledger.buy.haulNoWater', { cap: waterCapacity(run) }));
        continue;
      }
      const take = Math.min(it.amount, room);
      if (take < it.amount - 0.01) {
        notes.push(t('ledger.buy.haulPartial', { take: take.toFixed(1) }));
      }
      run.res.water += take;
      room = Math.max(0, room - take);
    } else {
      run.res[it.res] += it.amount;
    }
  }
  return { notes };
}

export function drainLocation(run: RunState, locationId: string): void {
  const st = run.locations.find((l) => l.id === locationId);
  if (st) {
    st.stock = Math.max(0, st.stock - LOOT.STOCK_DRAIN);
    st.searchedDay = run.day;
  }
}
