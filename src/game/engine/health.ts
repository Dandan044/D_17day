/**
 * 每日健康结算。
 *
 * 顺序刻意如此：先算吃喝，再算既有病情，最后才是环境判定。
 * 这样"因为饿所以扛不住冷"这种因果链在数值上是成立的。
 */

import { AIR, COLD, FILTER, HEALTH, RAD, RATION_EFFECT, WATER_EFFECT } from '../balance';
import { t } from '../copy/t';
import { CONDITION_BY_ID } from '../content/conditions';
import { SITE_BY_ID } from '../content/sites';
import type { Rng } from '../rng';
import type { ConditionId, RunState } from '../types';
import { canElectricHeat, canFuelHeat, electricHeatKwh, fuelHeatCost, unheatedFelt } from './climate';
import type { ConsumeResult } from './economy';
import { addCondition, addLog, removeCondition } from './effects';
import { ledger, type LedgerNote } from './ledger';
import { loadOnline } from './power';
import { effectiveModule, iodineActive, radiationShield } from './tags';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface HpPart {
  label: string;
  value: number;
}

export interface HealthReport {
  notes: LedgerNote[];
  hpDelta: number;
  hpParts: HpPart[];
  dead: boolean;
  cause?: string;
}

function has(run: RunState, ability: string): boolean {
  return run.abilities.includes(ability);
}

export { unheatedFelt };

/** 预览今晚室内温度（不扣资源） */
export function previewIndoor(run: RunState): { unheated: number; indoor: number; fuelCost: number; kwh: number } {
  const unheated = unheatedFelt(run);
  const mode = run.heatMode ?? 'off';
  const fuelCost = mode === 'fuel' && canFuelHeat(run) ? fuelHeatCost(run) : 0;
  const kwh = mode === 'electric' && canElectricHeat(run) ? electricHeatKwh(run) : 0;
  let indoor = unheated;
  if (mode === 'fuel' && fuelCost > 0) {
    const spent = Math.min(run.res.fuel, fuelCost);
    indoor = unheated + (COLD.TARGET - unheated) * (fuelCost > 0 ? spent / fuelCost : 0);
  } else if (mode === 'electric' && kwh > 0 && loadOnline(run, 'heater')) {
    indoor = COLD.TARGET;
  }
  indoor = Math.round(Math.min(COLD.TARGET, indoor) * 10) / 10;
  return { unheated, indoor, fuelCost, kwh };
}

/**
 * 体感温度：未加热站点修正，或传入夜间结算后的室内温度。
 */
export function feltTemperature(run: RunState, heated?: boolean): number {
  const preview = previewIndoor(run);
  if (heated === false) return preview.unheated;
  return preview.indoor;
}

export function resolveHealth(run: RunState, consume: ConsumeResult, rng: Rng): HealthReport {
  const notes: LedgerNote[] = [];
  const hpParts: HpPart[] = [];
  const hpBefore = run.stats.hp;
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  let cause: string | undefined;
  const addedTonight = new Set<ConditionId>();

  const hit = (amount: number, why: string) => {
    if (amount === 0) return;
    run.stats.hp = clamp(run.stats.hp + amount, 0, HEALTH.MAX);
    hpParts.push({ label: why, value: Math.round(amount * 10) / 10 });
    if (amount < 0 && run.stats.hp <= 0 && !cause) cause = why;
  };

  const gainCond = (id: ConditionId, note: string) => {
    if (addCondition(run, id)) {
      addedTonight.add(id);
      notes.push(ledger(note, 'bad'));
      return true;
    }
    return false;
  };

  // ---------- 1. 吃喝 ----------
  const rationEff = RATION_EFFECT[run.ration];
  const waterEff = WATER_EFFECT[run.waterUse];
  const actuallyFed = consume.foodRatio >= 0.35;
  const actuallyHydrated = consume.waterRatio >= 0.4;

  if (actuallyFed || rationEff.hp < 0) {
    if (!(rationEff.hp > 0 && !actuallyFed)) {
      hit(rationEff.hp, rationEff.hp > 0 ? t('ledger.cause.rationFull') : rationEff.hp < 0 ? t('ledger.cause.rationLow') : t('ledger.cause.ration'));
    }
  }
  if (actuallyHydrated || waterEff.hp < 0) {
    if (!(waterEff.hp > 0 && !actuallyHydrated)) {
      hit(waterEff.hp, waterEff.hp > 0 ? t('ledger.cause.waterFull') : waterEff.hp < 0 ? t('ledger.cause.waterLow') : t('ledger.cause.water'));
    }
  }
  if (actuallyFed) {
    run.stats.sanity = clamp(run.stats.sanity + rationEff.sanity, 0, 100);
    for (const s of run.survivors) s.morale = clamp(s.morale + rationEff.morale, 0, 100);
  } else if (rationEff.sanity < 0) {
    run.stats.sanity = clamp(run.stats.sanity + rationEff.sanity, 0, 100);
    for (const s of run.survivors) s.morale = clamp(s.morale + rationEff.morale, 0, 100);
  }
  if (actuallyHydrated) {
    run.stats.sanity = clamp(run.stats.sanity + waterEff.sanity, 0, 100);
  } else if (waterEff.sanity < 0) {
    run.stats.sanity = clamp(run.stats.sanity + waterEff.sanity, 0, 100);
  }

  if (consume.foodRatio < 0.35) {
    gainCond('starving', t('ledger.health.starveStart'));
    hit(HEALTH.STARVE_HP * (1 - consume.foodRatio), t('ledger.cause.hunger'));
  } else {
    removeCondition(run, 'starving');
  }
  if (consume.waterRatio < 0.4) {
    gainCond('dehydrated', t('ledger.health.thirstStart'));
    hit(HEALTH.THIRST_HP * (1 - consume.waterRatio), t('ledger.cause.thirst'));
  } else if (consume.waterRatio > 0.85) {
    removeCondition(run, 'dehydrated');
  }

  if (run.ration === 'half' || run.ration === 'none') {
    run.streaks.lowRation += 1;
    run.streaks.goodRation = 0;
    if (run.streaks.lowRation >= HEALTH.MALNOURISH_DAYS && gainCond('malnourished', t('ledger.health.malnourish'))) {
      // already noted
    }
  } else {
    run.streaks.lowRation = 0;
    run.streaks.goodRation = (run.streaks.goodRation ?? 0) + 1;
  }

  // ---------- 2. 既有病情 ----------
  if (!run.conditionAge) run.conditionAge = {};
  for (const id of [...run.conditions]) {
    const def = CONDITION_BY_ID[id];
    if (!def) continue;
    let mult = 1;
    if (has(run, 'nurse_care')) mult *= 0.75;
    mult *= 1 / (1 + effectiveModule(run, 'medbay') * 0.2);

    if (addedTonight.has(id)) continue;

    hit((def.daily.hp ?? 0) * mult, def.name);
    run.stats.stamina = clamp(run.stats.stamina + (def.daily.stamina ?? 0) * mult, 0, 100);
    run.stats.sanity = clamp(run.stats.sanity + (def.daily.sanity ?? 0) * mult, 0, 100);

    if (def.autoCure === 'food' && run.streaks.goodRation >= HEALTH.MALN_CURE_DAYS) {
      removeCondition(run, id);
      notes.push(ledger(t('ledger.health.foodHeal', { name: def.name }), 'good'));
      continue;
    }
    if (def.autoCure === 'water' && consume.waterRatio > 0.85) {
      removeCondition(run, id);
      notes.push(ledger(t('ledger.health.waterHeal', { name: def.name }), 'good'));
      continue;
    }

    // 病程天数：今晚结算时 +1（今日新得的不加）
    run.conditionAge[id] = (run.conditionAge[id] ?? 0) + 1;
    const age = run.conditionAge[id] ?? 0;

    if (def.selfHeal && rng.chance(def.selfHeal * (1 + effectiveModule(run, 'medbay') * 0.3))) {
      removeCondition(run, id);
      notes.push(ledger(t('ledger.health.healed', { name: def.name }), 'good'));
      continue;
    }
    if (def.worsen) {
      const needDays = def.worsen.afterDays ?? 0;
      if (age >= needDays) {
        let chance = def.worsen.chance;
        // 无 afterDays 的旧恶化保留半速；有门槛的用全概率
        if (!def.worsen.afterDays) chance *= 0.5;
        // 肾伤：脱水拖坏且当天走了回用
        if (def.worsen.into === 'kidneyStrain' && !consume.recycling) chance = 0;
        if (chance > 0 && rng.chance(chance)) {
          if (gainCond(def.worsen.into, t('ledger.health.worsen', { from: def.name, to: CONDITION_BY_ID[def.worsen.into].name }))) {
            // noted
          }
        }
      }
    }
    // 痢疾拖久了也会黄疸（与脱水恶化并存）
    if (id === 'dysentery' && age >= 5 && rng.chance(0.12)) {
      gainCond('jaundice', t('ledger.health.dysenteryJaundice'));
    }
  }

  // ---------- 3. 低温 ----------
  const insulate = effectiveModule(run, 'insulate');
  const felt = consume.indoor ?? unheatedFelt(run);
  const floor = COLD.INSULATE_FLOOR[insulate] ?? COLD.INSULATE_FLOOR[0]!;
  if (felt < floor) {
    const gap = floor - felt;
    hit(-gap * COLD.HP_PER_DEGREE, t('ledger.cause.cold'));
    notes.push(ledger(t('ledger.health.cold', { felt, floor }), 'bad'));
    if (gap >= COLD.HYPOTHERMIA_GAP) gainCond('hypothermia', t('ledger.health.hypo'));
  } else if (felt > floor + 4) {
    removeCondition(run, 'hypothermia');
  }

  // ---------- 4. 空气 ----------
  const airFilter = effectiveModule(run, 'airFilter');
  let airTol = AIR.FILTER_TOLERANCE[airFilter] ?? AIR.FILTER_TOLERANCE[0]!;
  airTol += insulate * AIR.SEAL_BONUS;
  if (run.flags.includes('flag:mask')) airTol += AIR.MASK_BONUS;
  if (run.world.airPollution > airTol) {
    const over = run.world.airPollution - airTol;
    hit(-over * AIR.HP_PER_POINT, t('ledger.cause.air'));
    notes.push(ledger(t('ledger.health.air', { pollution: Math.round(run.world.airPollution), over: Math.round(over) }), 'bad'));
  }

  const sealed = insulate >= 2;
  if (sealed && consume.heated && consume.heatKind === 'fuel' && !run.flags.includes('flag:coAlarm')) {
    if (rng.chance(AIR.CO_RISK)) {
      if (gainCond('coPoisoning', t('ledger.health.co'))) {
        addLog(run, t('ledger.health.coLog'), 'bad');
      }
    }
  }

  // ---------- 5. 辐射 ----------
  if (run.world.radiation > 5) {
    const shield = radiationShield(run);
    const tol = RAD.SHIELD_TOLERANCE[shield] ?? RAD.SHIELD_TOLERANCE[0]!;
    const iodine = iodineActive(run);
    if (airFilter > 0 && !loadOnline(run, 'airFilter')) {
      notes.push(ledger(t('ledger.health.filterOff'), 'bad'));
    }
    if (run.world.radiation > tol) {
      const over = (run.world.radiation - tol) * (iodine ? 0.45 : 1);
      const dmg = -over * RAD.HP_PER_POINT;
      hit(dmg, t('ledger.cause.radiation'));
      if (over > 12 && gainCond('radiationSickness', t('ledger.health.radSickness'))) {
        // noted
      } else if (over > 0) {
        notes.push(
          ledger(
            t('ledger.health.rad', { rad: Math.round(run.world.radiation), tol, dmg: dmg.toFixed(1) }),
            'bad',
          ),
        );
      }
    }
  }

  if (run.flags.includes('flag:iodine') && run.iodineUntil !== undefined && run.day + 1 >= run.iodineUntil) {
    notes.push(ledger(t('ledger.health.iodineEnd'), 'bad'));
  }

  // ---------- 6. 灯光 ----------
  if (loadOnline(run, 'lights')) {
    run.stats.sanity = clamp(run.stats.sanity + HEALTH.LIGHTS_SANITY_ON, 0, 100);
    notes.push(ledger(t('ledger.health.lightsOn', { amt: HEALTH.LIGHTS_SANITY_ON }), 'good'));
  } else {
    run.stats.sanity = clamp(run.stats.sanity + HEALTH.LIGHTS_SANITY_OFF, 0, 100);
    notes.push(ledger(t('ledger.health.lightsOff', { amt: HEALTH.LIGHTS_SANITY_OFF }), 'bad'));
  }

  // ---------- 7. 水源与疾病 ----------
  if (consume.drankRaw) {
    let p = HEALTH.RAW_WATER_SICK;
    if (has(run, 'chemist_consumables')) p *= 0.5;
    if (run.world.waterTable !== 'normal') p *= 1.35;
    if (rng.chance(p) && gainCond('dysentery', t('ledger.health.dirtyWater'))) {
      // noted
    }
  } else if (consume.drankFiltered) {
    const filterLv = effectiveModule(run, 'filter');
    let p = consume.recycling
      ? (FILTER.SICK_RECYCLE[filterLv] ?? 0)
      : (FILTER.SICK_RAIN[filterLv] ?? 0);
    if (run.world.weather === 'blackRain' || run.world.waterTable === 'polluted') {
      p *= FILTER.SICK_DIRTY_MULT;
    }
    if (has(run, 'chemist_consumables')) p *= 0.5;
    if (p > 0 && rng.chance(p)) {
      const useGiardia = filterLv >= 2 && rng.chance(FILTER.GIARDIA_SHARE);
      if (useGiardia) {
        gainCond('giardia', t('ledger.health.giardia'));
      } else {
        gainCond('dysentery', t('ledger.health.filterDysentery'));
      }
    }
  }

  if (run.world.contagion > 25) {
    let p = (run.world.contagion / 100) * 0.14;
    if (airFilter >= 2) p *= 0.4;
    if (has(run, 'nurse_care')) p *= 0.75;
    if (run.survivors.length > 0) p *= 1 + run.survivors.length * 0.2;
    if (rng.chance(p) && gainCond('flu', t('ledger.health.flu'))) {
      // noted
    }
  }

  if (site.tags.includes('site:damp') && rng.chance(0.05)) {
    gainCond('moldLung', t('ledger.health.mold'));
  }

  if (effectiveModule(run, 'filter') === 0 && rng.chance(HEALTH.POOR_HYGIENE_SICK)) {
    const pick: ConditionId = rng.chance(0.5) ? 'dysentery' : 'flu';
    gainCond(pick, t('ledger.health.hygiene', { name: CONDITION_BY_ID[pick].name }));
  }

  // ---------- 8. 理智 ----------
  if (run.stats.sanity < HEALTH.SANITY_BREAK) {
    hit(HEALTH.SANITY_BREAK_HP, t('ledger.cause.sanity'));
    gainCond('despair', t('ledger.health.despair'));
  } else if (run.stats.sanity > 45) {
    removeCondition(run, 'despair');
  }

  // ---------- 9. 睡眠恢复 ----------
  let recover = 34;
  if (run.conditions.length > 0) recover -= run.conditions.length * 5;
  if (felt < floor) recover -= 8;
  if (run.stats.sanity < 30) recover -= 6;
  const medbay = effectiveModule(run, 'medbay');
  recover += HEALTH.MEDBAY_SLEEP_STAMINA[medbay] ?? 0;
  run.stats.stamina = clamp(run.stats.stamina + Math.max(6, recover), 0, 100);
  const sleepSan = HEALTH.MEDBAY_SLEEP_SANITY[medbay] ?? 0;
  const sleepSta = HEALTH.MEDBAY_SLEEP_STAMINA[medbay] ?? 0;
  if (sleepSan > 0) run.stats.sanity = clamp(run.stats.sanity + sleepSan, 0, 100);
  if (sleepSan > 0 || sleepSta > 0) {
    if (felt < floor) {
      notes.push(ledger(t('ledger.health.medbayCold'), 'neutral'));
    } else if (sleepSan > 0) {
      notes.push(ledger(t('ledger.health.medbayFull', { sta: sleepSta, san: sleepSan }), 'good'));
    } else {
      notes.push(ledger(t('ledger.health.medbaySta', { sta: sleepSta }), 'good'));
    }
  }

  // ---------- 10. 同伴 ----------
  for (const s of run.survivors) {
    if (consume.foodRatio < 0.6) s.morale = clamp(s.morale - 5, 0, 100);
    if (run.world.exposure > 70) s.morale = clamp(s.morale - 2, 0, 100);
    if (!loadOnline(run, 'lights')) s.morale = clamp(s.morale - 2, 0, 100);
    s.trust = clamp(s.trust + (s.morale > 65 ? 1.5 : s.morale < 30 ? -2 : 0), 0, 100);
  }

  const dead = run.stats.hp <= 0;
  return { notes, hpDelta: Math.round(run.stats.hp - hpBefore), hpParts, dead, cause };
}

/** 主动治疗：消耗药品处理一个状态，不额外回血 */
export function treatCondition(run: RunState, id: ConditionId): { ok: boolean; reason?: string } {
  const def = CONDITION_BY_ID[id];
  if (!def.medsCure) return { ok: false, reason: t('ledger.health.treatNo') };
  if (def.needsMedbay && run.modules.medbay < def.needsMedbay) {
    return { ok: false, reason: t('ledger.health.treatMedbay', { lvl: def.needsMedbay }) };
  }
  let cost = def.medsCure;
  if (has(run, 'nurse_care')) cost = Math.max(1, Math.round(cost * 0.6));
  if (run.res.meds < cost) return { ok: false, reason: t('ledger.health.treatMeds', { cost }) };
  run.res.meds -= cost;
  removeCondition(run, id);
  return { ok: true };
}
