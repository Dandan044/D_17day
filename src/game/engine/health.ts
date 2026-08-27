/**
 * 每日健康结算。
 *
 * 顺序刻意如此：先算吃喝，再算既有病情，最后才是环境判定。
 * 这样"因为饿所以扛不住冷"这种因果链在数值上是成立的。
 */

import { AIR, COLD, HEALTH, RAD, RATION_EFFECT, WATER_EFFECT } from '../balance';
import { CONDITION_BY_ID } from '../content/conditions';
import { SITE_BY_ID } from '../content/sites';
import type { Rng } from '../rng';
import type { ConditionId, RunState } from '../types';
import type { ConsumeResult } from './economy';
import { addCondition, addLog, removeCondition } from './effects';
import { effectiveModule, radiationShield } from './tags';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface HealthReport {
  notes: string[];
  hpDelta: number;
  dead: boolean;
  cause?: string;
}

function has(run: RunState, ability: string): boolean {
  return run.abilities.includes(ability);
}

/**
 * 体感温度：站点、保温、燃料共同决定。
 *
 * 烧炉子必须真的算进来——否则"囤燃料过冬"这件事在数值上是无意义的。
 * 保温等级会放大取暖效果，因为热量留不住的房子烧多少都白烧。
 */
export function feltTemperature(run: RunState): number {
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  let t = run.world.temperature;
  if (site.tags.includes('site:underground')) t = t * 0.35 + 15 * 0.65; // 地下恒温
  if (site.tags.includes('site:elevated')) t -= 3; // 铁皮塔挨风
  if (site.tags.includes('site:cramped')) t += 1;

  if (run.res.fuel >= COLD.HEAT_FUEL && t < 16) {
    const insulate = effectiveModule(run, 'insulate');
    t += COLD.HEAT_BASE + insulate * COLD.HEAT_PER_INSULATE;
  }
  return Math.round(t * 10) / 10;
}

export function resolveHealth(run: RunState, consume: ConsumeResult, rng: Rng): HealthReport {
  const notes: string[] = [];
  const hpBefore = run.stats.hp;
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  let cause: string | undefined;

  const hit = (amount: number, why: string) => {
    if (amount === 0) return;
    run.stats.hp = clamp(run.stats.hp + amount, 0, HEALTH.MAX);
    if (amount < 0 && run.stats.hp <= 0 && !cause) cause = why;
  };

  // ---------- 1. 吃喝 ----------
  const rationEff = RATION_EFFECT[run.ration];
  const waterEff = WATER_EFFECT[run.waterUse];
  hit(rationEff.hp, '饥饿');
  hit(waterEff.hp, '脱水');
  run.stats.sanity = clamp(run.stats.sanity + rationEff.sanity + waterEff.sanity, 0, 100);
  for (const s of run.survivors) s.morale = clamp(s.morale + rationEff.morale, 0, 100);

  if (consume.foodRatio < 0.35) {
    if (addCondition(run, 'starving')) notes.push('你开始挨饿');
    hit(HEALTH.STARVE_HP * (1 - consume.foodRatio), '饥饿');
  } else {
    removeCondition(run, 'starving');
  }
  if (consume.waterRatio < 0.4) {
    if (addCondition(run, 'dehydrated')) notes.push('你开始脱水');
    hit(HEALTH.THIRST_HP * (1 - consume.waterRatio), '脱水');
  } else if (consume.waterRatio > 0.85) {
    removeCondition(run, 'dehydrated');
  }

  // 连续半配给 → 营养不良
  if (run.ration === 'half' || run.ration === 'none') {
    run.streaks.lowRation += 1;
    if (run.streaks.lowRation >= HEALTH.MALNOURISH_DAYS && addCondition(run, 'malnourished')) {
      notes.push('长期节食开始留下痕迹：营养不良');
    }
  } else {
    run.streaks.lowRation = 0;
  }

  // ---------- 2. 既有病情 ----------
  for (const id of [...run.conditions]) {
    const def = CONDITION_BY_ID[id];
    let mult = 1;
    if (has(run, 'nurse_care')) mult *= 0.75;
    mult *= 1 / (1 + effectiveModule(run, 'medbay') * 0.2);

    hit((def.daily.hp ?? 0) * mult, def.name);
    run.stats.stamina = clamp(run.stats.stamina + (def.daily.stamina ?? 0) * mult, 0, 100);
    run.stats.sanity = clamp(run.stats.sanity + (def.daily.sanity ?? 0) * mult, 0, 100);

    if (def.selfHeal && rng.chance(def.selfHeal * (1 + effectiveModule(run, 'medbay') * 0.3))) {
      removeCondition(run, id);
      notes.push(`${def.name}好转了`);
      continue;
    }
    if (def.worsen && rng.chance(def.worsen.chance * 0.5)) {
      if (addCondition(run, def.worsen.into)) {
        notes.push(`${def.name}恶化为${CONDITION_BY_ID[def.worsen.into].name}`);
      }
    }
  }

  // ---------- 3. 低温 ----------
  const insulate = effectiveModule(run, 'insulate');
  const felt = feltTemperature(run);
  const floor = COLD.INSULATE_FLOOR[insulate] ?? COLD.INSULATE_FLOOR[0]!;
  if (felt < floor) {
    const gap = floor - felt;
    hit(-gap * COLD.HP_PER_DEGREE, '失温');
    notes.push(`保温不足：体感 ${felt}°C，当前配置只能扛到 ${floor}°C`);
    if (gap >= COLD.HYPOTHERMIA_GAP && addCondition(run, 'hypothermia')) {
      notes.push('你出现了失温症状');
    }
  } else if (felt > floor + 4) {
    removeCondition(run, 'hypothermia');
  }

  // ---------- 4. 空气 ----------
  const airFilter = effectiveModule(run, 'airFilter');
  let airTol = AIR.FILTER_TOLERANCE[airFilter] ?? AIR.FILTER_TOLERANCE[0]!;
  // 密封本身就挡颗粒物；口罩虽然简陋但确实有用
  airTol += insulate * AIR.SEAL_BONUS;
  if (run.flags.includes('flag:mask')) airTol += AIR.MASK_BONUS;
  if (run.world.airPollution > airTol) {
    const over = run.world.airPollution - airTol;
    hit(-over * AIR.HP_PER_POINT, '吸入污染物');
    notes.push(`空气污染 ${Math.round(run.world.airPollution)}，超出防护能力 ${Math.round(over)}`);
  }

  // 密封 + 燃烧取暖 = 一氧化碳；报警器可完全避免
  const sealed = insulate >= 2;
  if (sealed && felt < 6 && run.res.fuel > 0 && !run.flags.includes('flag:coAlarm')) {
    if (rng.chance(AIR.CO_RISK)) {
      if (addCondition(run, 'coPoisoning')) {
        notes.push('屋里密不透风，炉子烧了一夜——你在头痛中醒来');
        addLog(run, '密封做得太好了。你忘了燃烧要消耗氧气，也会产生别的东西。', 'bad');
      }
    }
  }

  // ---------- 5. 辐射 ----------
  if (run.world.radiation > 5) {
    const shield = radiationShield(run);
    const tol = RAD.SHIELD_TOLERANCE[shield] ?? RAD.SHIELD_TOLERANCE[0]!;
    const iodine = run.flags.includes('flag:iodine');
    if (run.world.radiation > tol) {
      const over = (run.world.radiation - tol) * (iodine ? 0.45 : 1);
      hit(-over * RAD.HP_PER_POINT, '辐射');
      if (over > 12 && addCondition(run, 'radiationSickness')) {
        notes.push('你开始呕吐，牙龈在渗血');
      } else if (over > 0) {
        notes.push(`屏蔽不足：辐射 ${Math.round(run.world.radiation)}，当前只能挡到 ${tol}`);
      }
    }
  }

  // ---------- 6. 水源与疾病 ----------
  if (consume.drankRaw) {
    let p = HEALTH.RAW_WATER_SICK;
    if (has(run, 'chemist_consumables')) p *= 0.5;
    if (run.world.waterTable !== 'normal') p *= 1.35;
    if (rng.chance(p) && addCondition(run, 'dysentery')) {
      notes.push('那口水的代价来得很快');
    }
  }

  // 疫病流行度
  if (run.world.contagion > 25) {
    let p = (run.world.contagion / 100) * 0.14;
    if (airFilter >= 2) p *= 0.4;
    if (has(run, 'nurse_care')) p *= 0.75;
    if (run.survivors.length > 0) p *= 1 + run.survivors.length * 0.2;
    if (rng.chance(p) && addCondition(run, 'flu')) notes.push('你开始发烧');
  }

  // 潮湿站点
  if (site.tags.includes('site:damp') && rng.chance(0.05)) {
    if (addCondition(run, 'moldLung')) notes.push('潮湿终于收了它的租：你开始咳嗽');
  }

  // 卫生不足
  if (effectiveModule(run, 'filter') === 0 && rng.chance(HEALTH.POOR_HYGIENE_SICK)) {
    const pick: ConditionId = rng.chance(0.5) ? 'dysentery' : 'flu';
    if (addCondition(run, pick)) notes.push(`卫生条件太差：${CONDITION_BY_ID[pick].name}`);
  }

  // ---------- 7. 理智 ----------
  if (run.stats.sanity < HEALTH.SANITY_BREAK) {
    hit(HEALTH.SANITY_BREAK_HP, '精神崩溃');
    if (addCondition(run, 'despair')) notes.push('你已经不太确定明天为什么要起床');
  } else if (run.stats.sanity > 45) {
    removeCondition(run, 'despair');
  }

  // ---------- 8. 睡眠恢复 ----------
  let recover = 34;
  if (run.conditions.length > 0) recover -= run.conditions.length * 5;
  if (felt < floor) recover -= 8;
  if (run.stats.sanity < 30) recover -= 6;
  run.stats.stamina = clamp(run.stats.stamina + Math.max(6, recover), 0, 100);

  // ---------- 9. 同伴 ----------
  for (const s of run.survivors) {
    if (consume.foodRatio < 0.6) s.morale = clamp(s.morale - 5, 0, 100);
    if (run.world.exposure > 70) s.morale = clamp(s.morale - 2, 0, 100);
    if (run.powerMode === 'blackout') s.morale = clamp(s.morale - 2, 0, 100);
    s.trust = clamp(s.trust + (s.morale > 65 ? 1.5 : s.morale < 30 ? -2 : 0), 0, 100);
  }

  const dead = run.stats.hp <= 0;
  return { notes, hpDelta: Math.round(run.stats.hp - hpBefore), dead, cause };
}

/** 主动治疗：消耗药品处理一个状态 */
export function treatCondition(run: RunState, id: ConditionId): { ok: boolean; reason?: string } {
  const def = CONDITION_BY_ID[id];
  if (!def.medsCure) return { ok: false, reason: '这个状态没法用药解决' };
  if (def.needsMedbay && run.modules.medbay < def.needsMedbay) {
    return { ok: false, reason: `需要 ${def.needsMedbay} 级医疗站` };
  }
  let cost = def.medsCure;
  if (has(run, 'nurse_care')) cost = Math.max(1, Math.round(cost * 0.6));
  if (run.res.meds < cost) return { ok: false, reason: `需要 ${cost} 组药品` };
  run.res.meds -= cost;
  removeCondition(run, id);
  return { ok: true };
}
