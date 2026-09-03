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
import { comfortTemp, currentIndoor, HYPO_IDS, hypoStageOf, previewNight, survivalTemp } from './climate';
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

/** 体感温度：当前室内，或未加热估值。 */
export function feltTemperature(run: RunState, heated?: boolean): number {
  if (heated === false) return previewNight(run).leaked;
  return currentIndoor(run);
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
    if ((HYPO_IDS as readonly string[]).includes(id)) continue;

    const healP = def.selfHeal ? def.selfHeal * (1 + effectiveModule(run, 'medbay') * 0.3) : 0;
    if (id === 'coPoisoning' && healP > 0 && rng.chance(healP)) {
      removeCondition(run, id);
      notes.push(ledger(t('ledger.health.healed', { name: def.name }), 'good'));
      continue;
    }

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

    if (id !== 'coPoisoning' && healP > 0 && rng.chance(healP)) {
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
        // 伤口：医疗站显著降低感染概率
        if (id === 'wound') chance *= 1 / (1 + effectiveModule(run, 'medbay') * 0.4);
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

  // ---------- 3. 低温症 ----------
  const insulate = effectiveModule(run, 'insulate');
  const felt = consume.indoor ?? currentIndoor(run);
  const comfort = comfortTemp(run);
  const survival = survivalTemp(run);
  const layered = run.flags.includes('flag:layeredClothes');

  const setHypo = (stage: 0 | 1 | 2 | 3) => {
    for (const id of HYPO_IDS) removeCondition(run, id);
    if (stage === 1) addCondition(run, 'hypothermiaMild');
    if (stage === 2) addCondition(run, 'hypothermiaMod');
    if (stage === 3) addCondition(run, 'hypothermiaSevere');
  };

  const applyHypoDrain = (stage: 0 | 1 | 2 | 3) => {
    const hp = COLD.STAGE_HP[stage] ?? 0;
    if (hp) hit(hp, t('ledger.cause.cold'));
    const sta = [0, -6, -12, -18][stage] ?? 0;
    const san = [0, -1, -2, -4][stage] ?? 0;
    if (sta) run.stats.stamina = clamp(run.stats.stamina + sta, 0, 100);
    if (san) run.stats.sanity = clamp(run.stats.sanity + san, 0, 100);
  };

  let stage = hypoStageOf(run);
  if (felt >= comfort) {
    if (stage > 0) {
      const next = (stage <= 2 ? 0 : 1) as 0 | 1;
      setHypo(next);
      notes.push(ledger(next === 0 ? t('ledger.health.hypoGone') : t('ledger.health.hypoEase'), 'good'));
      stage = next;
    }
    applyHypoDrain(stage);
  } else if (felt < survival) {
    if (stage >= 3) {
      hit(-HEALTH.MAX, t('ledger.cause.cold'));
      notes.push(ledger(t('ledger.health.hypoDeath', { felt, survival }), 'bad'));
    } else {
      const next = (Math.min(3, Math.max(1, stage + 1))) as 1 | 2 | 3;
      setHypo(next);
      notes.push(ledger(stage === 0 ? t('ledger.health.hypo1', { felt }) : t('ledger.health.hypoUp', { n: next, felt }), 'bad'));
      stage = next;
      applyHypoDrain(stage);
    }
    if (!run.conditions.includes('flu')) {
      gainCond('flu', t('ledger.health.fluCold'));
    } else if (!run.conditions.includes('pneumonia') && rng.chance(COLD.PNEUMONIA_CHANCE)) {
      gainCond('pneumonia', t('ledger.health.fluToPneumonia'));
    }
  } else {
    const mildChance = COLD.MILD_CHANCE * (layered ? 0.5 : 1);
    const fluChance = COLD.FLU_CHANCE * (layered ? 0.5 : 1);
    if (stage === 0) {
      if (rng.chance(mildChance)) {
        setHypo(1);
        stage = 1;
        notes.push(ledger(t('ledger.health.hypo1', { felt }), 'bad'));
      }
    } else if (stage < 3 && rng.chance(COLD.PROGRESS_CHANCE)) {
      const next = (stage + 1) as 2 | 3;
      setHypo(next);
      stage = next;
      notes.push(ledger(t('ledger.health.hypoUp', { n: next, felt }), 'bad'));
    }
    applyHypoDrain(stage);
    if (!run.conditions.includes('flu') && rng.chance(fluChance)) {
      gainCond('flu', t('ledger.health.fluCold'));
    }
  }

  notes.push(ledger(t('ledger.health.indoor', { felt, comfort, survival })));
  run.flags = run.flags.filter((f) => f !== 'flag:layeredClothes');

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
  const coImmune = run.flags.includes('flag:coVenting');
  if (sealed && consume.heated && consume.heatKind === 'fuel' && !coImmune) {
    if (rng.chance(AIR.CO_RISK)) {
      const already = (id: string) => run.pending.some((p) => p.familyId === id);
      if (run.flags.includes('flag:coAlarm')) {
        if (!run.flags.includes('flag:coVenting')) run.flags.push('flag:coVenting');
        if (!already('env_co_alarm')) {
          run.pending.push({ familyId: 'env_co_alarm', dueDay: run.day + 1, retries: 0 });
        }
      } else if (run.flags.includes('flag:coWarned')) {
        if (gainCond('coPoisoning', t('ledger.health.co'))) {
          addLog(run, t('ledger.health.coLog'), 'bad');
        }
        if (!already('env_co_drowning')) {
          run.pending.push({ familyId: 'env_co_drowning', dueDay: run.day + 1, retries: 0 });
        }
      } else {
        if (gainCond('coPoisoning', t('ledger.health.co'))) {
          addLog(run, t('ledger.health.coLog'), 'bad');
        }
        if (!already('env_co_vent')) {
          run.pending.push({ familyId: 'env_co_vent', dueDay: run.day + 1, retries: 0 });
        }
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
  if (felt < comfort) recover -= 8;
  if (run.stats.sanity < 30) recover -= 6;
  const medbay = effectiveModule(run, 'medbay');
  recover += HEALTH.MEDBAY_SLEEP_STAMINA[medbay] ?? 0;
  run.stats.stamina = clamp(run.stats.stamina + Math.max(6, recover), 0, 100);
  const sleepSan = HEALTH.MEDBAY_SLEEP_SANITY[medbay] ?? 0;
  const sleepSta = HEALTH.MEDBAY_SLEEP_STAMINA[medbay] ?? 0;
  if (sleepSan > 0) run.stats.sanity = clamp(run.stats.sanity + sleepSan, 0, 100);
  if (sleepSan > 0 || sleepSta > 0) {
    if (felt < comfort) {
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
