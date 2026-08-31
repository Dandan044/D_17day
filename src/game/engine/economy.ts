/**
 * 资源经济：配给消耗、腐败、产出、物价、采购与搜刮。
 */

import { CAPS, COLD, DIFFICULTY, FOOD_NEED, LOOT, PRICE, STAMINA, WATER_NEED, WEAR } from '../balance';
import { BASE_PRICE, LOCATION_BY_ID, RES_WEIGHT } from '../content/locations';
import { SITE_BY_ID } from '../content/sites';
import type { Rng } from '../rng';
import type { Difficulty, Location, ResourceId, RunState, WeatherId } from '../types';
import { canElectricHeat, canFuelHeat, fuelHeatCost, unheatedFelt } from './climate';
import { computePower, LOAD_NAME, loadOnline } from './power';
import { effectiveModule, grantIodine, headcount } from './tags';

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

const RAIN_WEATHER: WeatherId[] = ['rain', 'storm', 'flooding', 'snow', 'blizzard', 'blackRain'];

// ============================================================
// 需求与消耗
// ============================================================

export interface DailyNeeds {
  water: number;
  food: number;
  heads: number;
}

export function dailyNeeds(run: RunState, difficulty: Difficulty = 'normal'): DailyNeeds {
  const heads = headcount(run);
  const mult = DIFFICULTY[difficulty].needMult;
  let upkeep = 1;
  for (const s of run.survivors) upkeep += s.upkeep - 1;

  let water = WATER_NEED[run.waterUse] * heads * mult * upkeep;
  const food = FOOD_NEED[run.ration] * heads * mult * upkeep;

  // 高温天多喝水
  if (run.world.weather === 'heatwave') water *= 1.3;

  return { water: Math.round(water * 10) / 10, food: Math.round(food * 10) / 10, heads };
}

export interface ConsumeResult {
  waterRatio: number;
  foodRatio: number;
  drankRaw: boolean;
  heated: boolean;
  heatKind?: 'fuel' | 'electric';
  indoor: number;
  notes: string[];
}

/**
 * 原水供应系数。
 *
 * 城市里从来不是"没有水"，而是"没有能喝的水"——消防水箱、景观水池、
 * 楼顶储罐里都有，只是脏。所以净水器永远有活干，只是干得多还是干得少。
 */
export function rawWaterFactor(run: RunState): number {
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  if (site.tags.includes('site:hasWell')) return 1.2;
  if (run.world.waterTable === 'flooded') return 1.1;
  if (RAIN_WEATHER.includes(run.world.weather)) return 1;
  if (run.flags.includes('flag:rainCatcher')) return 0.8;
  if (site.tags.includes('site:isolated')) return CAPS.RAW_WATER_DRY_MULT * 0.7;
  return CAPS.RAW_WATER_DRY_MULT;
}

export function hasRawWater(run: RunState): boolean {
  return rawWaterFactor(run) > 0;
}

/** 每日产出：农圃产生鲜、净水产饮用水 */
export function applyProduction(run: RunState): string[] {
  const notes: string[] = [];

  const garden = effectiveModule(run, 'garden');
  if (garden > 0) {
    let yieldAmt = CAPS.GARDEN_YIELD[garden] ?? 0;
    // 落灰与严寒会压产量
    if (run.world.airPollution > 60) yieldAmt *= 0.5;
    if (run.world.temperature < 0) yieldAmt *= 0.6;
    if (yieldAmt > 0) {
      run.res.foodFresh += yieldAmt;
      notes.push(`农圃收获 ${yieldAmt.toFixed(1)} 份生鲜`);
    }
  }

  const filter = effectiveModule(run, 'filter');
  // 水箱在清洗时，净化出来的水没处存——净水只能停掉。
  // 这是 cistern 施工的惩罚。原本按 buildPenaltyDesc 的承诺是「储水容量暂时归零」，
  // 但那样会让 clampResources 把已经存下的水悄悄倒掉，是对玩家的暗中惩罚，不采用。
  const cisternBusy = run.projects.some((p) => p.moduleId === 'cistern');
  if (filter > 0 && cisternBusy) {
    notes.push('水箱还在清洗，净化出来的水没处存，净水停了一天');
  } else if (filter > 0) {
    const factor = rawWaterFactor(run);
    const amt = Math.round((CAPS.FILTER_OUTPUT[filter] ?? 0) * factor * 10) / 10;
    if (amt > 0) {
      run.res.water += amt;
      notes.push(
        factor >= 1
          ? `净水系统产出 ${amt} L`
          : `净水系统产出 ${amt} L（今天只能找到有限的原水）`,
      );
    }
  }

  // 滤芯寿命：净水与空气过滤共用同一套耗材
  const airFilter = effectiveModule(run, 'airFilter');
  if (filter > 0 || airFilter > 0) {
    let drain = (filter > 0 ? 1 : 0) + (airFilter > 0 ? 1 : 0);
    if (run.world.weather === 'ashfall' || run.world.airPollution > 65) drain += WEAR.FILTER_EXTRA_DUST;
    if (run.abilities.includes('chemist_consumables')) drain *= 0.6;
    if (run.abilities.includes('perk_maintainer')) drain *= 0.65;
    run.wear.filterLife -= drain;
    if (run.wear.filterLife <= 0) {
      notes.push('滤芯已经彻底堵死，净水与空气过滤全部失效');
    } else if (run.wear.filterLife <= 4) {
      notes.push(`滤芯只剩 ${Math.ceil(run.wear.filterLife)} 天`);
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
export function spoilFood(run: RunState): string[] {
  if (run.res.foodFresh <= 0) return [];
  const cold = run.world.temperature < 4;
  let rate = cold ? 0.15 : 0.34;
  if (loadOnline(run, 'fridge')) rate *= 0.4;
  else rate *= 1.45;
  const lost = run.res.foodFresh * rate;
  if (lost < 0.1) return [];
  run.res.foodFresh = Math.max(0, run.res.foodFresh - lost);
  const fridge = loadOnline(run, 'fridge') ? '（冰箱还在转）' : '（冰箱没电）';
  return [`${lost.toFixed(1)} 份生鲜食物变质${fridge}`];
}

export function consumeDaily(run: RunState, rng: Rng, difficulty: Difficulty = 'normal'): ConsumeResult {
  const need = dailyNeeds(run, difficulty);
  const notes: string[] = [];

  // --- 水 ---
  const waterAvail = run.res.water;
  const waterUsed = Math.min(need.water, waterAvail);
  run.res.water = Math.max(0, waterAvail - waterUsed);
  const waterRatio = need.water > 0 ? waterUsed / need.water : 1;

  // 存水不够时，会不会去喝没处理过的水
  let drankRaw = false;
  if (waterRatio < 0.6 && hasRawWater(run) && effectiveModule(run, 'filter') === 0) {
    drankRaw = true;
    notes.push('饮水不足，只能喝没有处理过的水');
  }

  // --- 食物：先吃会坏的 ---
  let foodNeed = need.food;
  const freshUsed = Math.min(run.res.foodFresh, foodNeed);
  run.res.foodFresh -= freshUsed;
  foodNeed -= freshUsed;
  const stapleUsed = Math.min(run.res.foodStaple, foodNeed);
  run.res.foodStaple -= stapleUsed;
  foodNeed -= stapleUsed;
  const foodRatio = need.food > 0 ? (need.food - foodNeed) / need.food : 1;

  if (waterRatio < 0.99) notes.push(`饮水缺口 ${((1 - waterRatio) * 100).toFixed(0)}%`);
  if (foodRatio < 0.99) notes.push(`食物缺口 ${((1 - foodRatio) * 100).toFixed(0)}%`);

  const power = computePower(run);
  notes.push(
    `光伏 ${power.solar.toFixed(1)} kWh（天气 ×${power.weatherMult.toFixed(2)}）` +
      (power.grid > 0 ? ` · 市电 ${power.grid.toFixed(1)}` : '') +
      (power.generator > 0 ? ` · 柴油机补 ${power.generator.toFixed(1)}` : ''),
  );
  if (power.offline.length > 0) {
    notes.push(`缺电停摆：${power.offline.map((id) => LOAD_NAME[id] ?? id).join('、')}`);
  }

  if (power.fuelBurn > 0) {
    run.res.fuel = Math.max(0, run.res.fuel - power.fuelBurn);
    run.wear.generatorOil -= 1;
    notes.push(`柴油机烧了 ${power.fuelBurn.toFixed(1)} L 补电`);
    if (run.wear.generatorOil <= 0 && rng.chance(0.3)) {
      notes.push('发电机开始异响：需要保养');
    }
  }

  const unheated = unheatedFelt(run);
  let heated = false;
  let heatKind: ConsumeResult['heatKind'];
  let indoor = unheated;
  const mode = run.heatMode ?? 'off';

  if (mode === 'fuel' && canFuelHeat(run)) {
    const needFuel = fuelHeatCost(run);
    if (needFuel > 0 && run.res.fuel > 0) {
      const spent = Math.min(run.res.fuel, needFuel);
      run.res.fuel -= spent;
      const rise = (COLD.TARGET - unheated) * (spent / needFuel);
      indoor = Math.round(Math.min(COLD.TARGET, unheated + rise) * 10) / 10;
      heated = spent > 0;
      heatKind = 'fuel';
      notes.push(`烧了 ${spent.toFixed(1)} L 燃料取暖（目标 ${COLD.TARGET}°C，室内 ${indoor}°C）`);
    } else {
      notes.push(`想烧燃料取暖，但${needFuel <= 0 ? '保温还不够装炉子' : '没有油了'}。室内 ${indoor}°C`);
    }
  } else if (mode === 'electric' && canElectricHeat(run)) {
    if (loadOnline(run, 'heater', power)) {
      indoor = COLD.TARGET;
      heated = true;
      heatKind = 'electric';
      notes.push(`电热开了一夜。室内 ${indoor}°C`);
    } else {
      notes.push(`电热排在供电表后面或没电，室内仍是 ${indoor}°C`);
    }
  } else if (mode === 'off') {
    notes.push(`不取暖。室外体感 ${unheated}°C，室内相同`);
  }

  return { waterRatio, foodRatio, drankRaw, heated, heatKind, indoor, notes };
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
  if (!loc || !loc.prepShop) return { ok: false, reason: '这里不能采购', spent: 0, got: 0 };

  const remaining = remainingBuyLimit(run, res, hasClerkPerk);
  const want = Math.min(qty, remaining);
  if (want <= 0) return { ok: false, reason: '已达今日限购', spent: 0, got: 0 };

  const st = run.locations.find((l) => l.id === locationId);
  const shelf = st?.stock ?? loc.stock;
  const stockFactor = Math.max(0, shelf / 100);
  const available = Math.floor(want * Math.max(0.15, stockFactor));
  if (available <= 0) return { ok: false, reason: '货架已经空了', spent: 0, got: 0 };

  let price = unitPrice(run, res, locationId);
  if (hasClerkPerk) price = Math.round(price * 0.9);
  const cost = price * available;
  if (run.res.cash < cost) {
    const afford = Math.floor(run.res.cash / price);
    if (afford <= 0) return { ok: false, reason: '现金不够', spent: 0, got: 0 };
    run.res.cash -= price * afford;
    run.res[res] += afford;
    recordPurchase(run, res, afford, locationId);
    return { ok: true, spent: price * afford, got: afford };
  }

  run.res.cash -= cost;
  run.res[res] += available;
  recordPurchase(run, res, available, locationId);
  return { ok: true, spent: cost, got: available };
}

export const IODINE_BOX_PRICE = 220;
export const IODINE_BOX_LIMIT = 2;

export function iodineBoughtCount(run: RunState): number {
  if (run.flags.includes('flag:iodineStock2')) return 2;
  if (run.flags.includes('flag:iodineStock1')) return 1;
  return 0;
}

export function buyIodine(run: RunState, locationId: string): { ok: boolean; reason?: string; spent: number } {
  if (locationId !== 'pharmacy') return { ok: false, reason: '只有药店卖碘片', spent: 0 };
  const bought = iodineBoughtCount(run);
  if (bought >= IODINE_BOX_LIMIT) return { ok: false, reason: '柜台只剩这两盒，你已经买过了', spent: 0 };
  const price = Math.max(1, Math.round(IODINE_BOX_PRICE * run.world.priceIndex));
  if (run.res.cash < price) return { ok: false, reason: '现金不够', spent: 0 };
  run.res.cash -= price;
  if (bought === 0) run.flags.push('flag:iodineStock1');
  else {
    run.flags = run.flags.filter((f) => f !== 'flag:iodineStock1');
    run.flags.push('flag:iodineStock2');
  }
  grantIodine(run);
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

/** 玩家在负重上限内挑选后提交 */
export function commitHaul(run: RunState, picked: HaulItem[]): void {
  for (const it of picked) {
    run.res[it.res] += it.amount;
  }
}

export function drainLocation(run: RunState, locationId: string): void {
  const st = run.locations.find((l) => l.id === locationId);
  if (st) {
    st.stock = Math.max(0, st.stock - LOOT.STOCK_DRAIN);
    st.searchedDay = run.day;
  }
}
