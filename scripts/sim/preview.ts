/**
 * 只读事件选项数值预览：摊 Effect / SkillCheck，不 clone、不 applyEffect。
 */

import type { Choice, ConditionId, Effect, ModuleId, ResourceId, RunState, SkillId, StatId } from '../../src/game/types';

export interface EffectDelta {
  res: Partial<Record<ResourceId, number>>;
  stats: Partial<Record<StatId, number>>;
  ap: number;
  indoor: number;
  shelter: Partial<Record<ModuleId, number>>;
  wear: { filterLife?: number; generatorOil?: number; batteryCharge?: number };
  skills: Partial<Record<SkillId, number>>;
  world: {
    exposure?: number;
    radiation?: number;
    contagion?: number;
    temperature?: number;
    lawOrder?: number;
    scarcity?: number;
  };
  addCond: ConditionId[];
  removeCond: ConditionId[];
}

const emptyDelta = (): EffectDelta => ({
  res: {},
  stats: {},
  ap: 0,
  indoor: 0,
  shelter: {},
  wear: {},
  skills: {},
  world: {},
  addCond: [],
  removeCond: [],
});

function addNum<K extends string>(bag: Partial<Record<K, number>>, key: K, n: number): void {
  if (!n) return;
  bag[key] = (bag[key] ?? 0) + n;
}

export function flattenEffect(eff: Effect | undefined): EffectDelta {
  const d = emptyDelta();
  if (!eff) return d;
  if (eff.res) {
    for (const [k, v] of Object.entries(eff.res)) addNum(d.res, k as ResourceId, v ?? 0);
  }
  if (eff.stats) {
    for (const [k, v] of Object.entries(eff.stats)) addNum(d.stats, k as StatId, v ?? 0);
  }
  d.ap = eff.ap ?? 0;
  d.indoor = eff.indoor ?? 0;
  if (eff.shelter) {
    for (const [k, v] of Object.entries(eff.shelter)) addNum(d.shelter, k as ModuleId, v ?? 0);
  }
  if (eff.wear) {
    if (eff.wear.filterLife) d.wear.filterLife = (d.wear.filterLife ?? 0) + eff.wear.filterLife;
    if (eff.wear.generatorOil) d.wear.generatorOil = (d.wear.generatorOil ?? 0) + eff.wear.generatorOil;
    if (eff.wear.batteryCharge) d.wear.batteryCharge = (d.wear.batteryCharge ?? 0) + eff.wear.batteryCharge;
  }
  if (eff.skills) {
    for (const [k, v] of Object.entries(eff.skills)) addNum(d.skills, k as SkillId, v ?? 0);
  }
  if (eff.world) {
    const w = eff.world;
    if (w.exposure) d.world.exposure = (d.world.exposure ?? 0) + w.exposure;
    if (w.radiation) d.world.radiation = (d.world.radiation ?? 0) + w.radiation;
    if (w.contagion) d.world.contagion = (d.world.contagion ?? 0) + w.contagion;
    if (w.temperature) d.world.temperature = (d.world.temperature ?? 0) + w.temperature;
    if (w.lawOrder) d.world.lawOrder = (d.world.lawOrder ?? 0) + w.lawOrder;
    if (w.scarcity) d.world.scarcity = (d.world.scarcity ?? 0) + w.scarcity;
  }
  d.addCond = [...(eff.addCond ?? [])];
  d.removeCond = [...(eff.removeCond ?? [])];
  return d;
}

function scaleDelta(d: EffectDelta, w: number): EffectDelta {
  const out = emptyDelta();
  for (const [k, v] of Object.entries(d.res)) addNum(out.res, k as ResourceId, (v ?? 0) * w);
  for (const [k, v] of Object.entries(d.stats)) addNum(out.stats, k as StatId, (v ?? 0) * w);
  out.ap = d.ap * w;
  out.indoor = d.indoor * w;
  for (const [k, v] of Object.entries(d.shelter)) addNum(out.shelter, k as ModuleId, (v ?? 0) * w);
  if (d.wear.filterLife) out.wear.filterLife = d.wear.filterLife * w;
  if (d.wear.generatorOil) out.wear.generatorOil = d.wear.generatorOil * w;
  if (d.wear.batteryCharge) out.wear.batteryCharge = d.wear.batteryCharge * w;
  for (const [k, v] of Object.entries(d.skills)) addNum(out.skills, k as SkillId, (v ?? 0) * w);
  for (const [k, v] of Object.entries(d.world)) {
    (out.world as Record<string, number>)[k] = ((out.world as Record<string, number>)[k] ?? 0) + (v ?? 0) * w;
  }
  if (w >= 0.5) {
    out.addCond = [...d.addCond];
    out.removeCond = [...d.removeCond];
  }
  return out;
}

function mergeDelta(a: EffectDelta, b: EffectDelta): EffectDelta {
  const out = emptyDelta();
  for (const src of [a, b]) {
    for (const [k, v] of Object.entries(src.res)) addNum(out.res, k as ResourceId, v ?? 0);
    for (const [k, v] of Object.entries(src.stats)) addNum(out.stats, k as StatId, v ?? 0);
    out.ap += src.ap;
    out.indoor += src.indoor;
    for (const [k, v] of Object.entries(src.shelter)) addNum(out.shelter, k as ModuleId, v ?? 0);
    if (src.wear.filterLife) out.wear.filterLife = (out.wear.filterLife ?? 0) + src.wear.filterLife;
    if (src.wear.generatorOil) out.wear.generatorOil = (out.wear.generatorOil ?? 0) + src.wear.generatorOil;
    if (src.wear.batteryCharge) out.wear.batteryCharge = (out.wear.batteryCharge ?? 0) + src.wear.batteryCharge;
    for (const [k, v] of Object.entries(src.skills)) addNum(out.skills, k as SkillId, v ?? 0);
    for (const [k, v] of Object.entries(src.world)) {
      (out.world as Record<string, number>)[k] = ((out.world as Record<string, number>)[k] ?? 0) + (v ?? 0);
    }
    out.addCond.push(...src.addCond);
    out.removeCond.push(...src.removeCond);
  }
  return out;
}

/** d20 期望 10.5；粗估成功率夹在 0.05~0.95 */
export function checkSuccessChance(run: RunState, skill: SkillId, dc: number): number {
  const mean = (run.skills[skill] ?? 0) + 10.5;
  const z = (mean - dc) / 5.7;
  const p = 1 / (1 + Math.exp(-z));
  return Math.max(0.05, Math.min(0.95, p));
}

export function guaranteedDelta(choice: Choice): EffectDelta {
  return flattenEffect(choice.effect);
}

export function expectedDelta(run: RunState, choice: Choice): EffectDelta {
  const base = flattenEffect(choice.effect);
  if (!choice.check) return base;
  const p = checkSuccessChance(run, choice.check.skill, choice.check.dc);
  const ev = mergeDelta(scaleDelta(flattenEffect(choice.check.ok), p), scaleDelta(flattenEffect(choice.check.bad), 1 - p));
  return mergeDelta(base, ev);
}

const COND_PENALTY: Partial<Record<ConditionId, number>> = {
  fracture: 25,
  sepsis: 30,
  hypothermiaSevere: 22,
  hypothermiaMod: 14,
  radiationSickness: 20,
  pneumonia: 16,
  woundInfection: 14,
  dysentery: 12,
  coPoisoning: 16,
  moldLung: 12,
  starving: 10,
  thirst: 4,
  dehydrationMild: 10,
  dehydrationMod: 16,
  dehydrationSevere: 26,
};

const RES_WEIGHT: Partial<Record<ResourceId, number>> = {
  foodStaple: 2.6,
  foodFresh: 2.2,
  water: 2.6,
  meds: 3.2,
  fuel: 2.1,
  materials: 1.0,
  parts: 1.2,
  ammo: 1.1,
  cash: 0.002,
};

export function scoreDelta(d: EffectDelta): number {
  let s = 0;
  for (const [k, v] of Object.entries(d.res)) s += (RES_WEIGHT[k as ResourceId] ?? 0.4) * (v ?? 0);
  s += (d.stats.hp ?? 0) * 8;
  s += (d.stats.stamina ?? 0) * 1.2;
  s += (d.stats.sanity ?? 0) * 3;
  s += (d.stats.humanity ?? 0) * 0.8;
  s += (d.stats.reputation ?? 0) * 0.3;
  s += d.ap * 4;
  s += d.indoor * 1.5;
  for (const v of Object.values(d.shelter)) s += (v ?? 0) * 8;
  s += (d.wear.filterLife ?? 0) * 2;
  s += (d.wear.generatorOil ?? 0) * 1.4;
  s += (d.wear.batteryCharge ?? 0) * 0.8;
  for (const v of Object.values(d.skills)) s += (v ?? 0) * 3;
  s += (d.world.exposure ?? 0) * -6;
  s += (d.world.radiation ?? 0) * -5;
  s += (d.world.contagion ?? 0) * -4;
  s += (d.world.lawOrder ?? 0) * 0.5;
  s += (d.world.scarcity ?? 0) * -0.3;
  s += (d.world.temperature ?? 0) * 0.4;
  for (const c of d.addCond) s -= COND_PENALTY[c] ?? 8;
  for (const c of d.removeCond) s += COND_PENALTY[c] ?? 8;
  return s;
}

export function pickOracle(run: RunState, choices: Choice[]): { choice: Choice; score: number } {
  let best = choices[0]!;
  let bestScore = -Infinity;
  for (const c of choices) {
    const sc = scoreDelta(expectedDelta(run, c));
    if (sc > bestScore) {
      best = c;
      bestScore = sc;
    }
  }
  return { choice: best, score: bestScore };
}

/** 黑盒也管暴露：不读检定期望，只避开「明显加暴露 / 掉血」的选项。 */
export function pickSaferBlind(choices: Choice[]): Choice {
  const cheap = choices.filter((c) => !c.requires?.ap);
  const pool = cheap.length ? cheap : choices;
  const scored = pool.map((c) => ({ c, d: guaranteedDelta(c) }));
  const safe = scored.filter(({ d }) => (d.stats.hp ?? 0) >= 0 && (d.world.exposure ?? 0) <= 0);
  return (safe[0] ?? scored[0]!).c;
}

export function pickSighted(run: RunState, choices: Choice[], foodDays: number, waterDays: number): Choice {
  const guaranteed = choices.map((c) => ({ c, d: guaranteedDelta(c) }));
  const noHurt = guaranteed.filter(({ d }) => (d.stats.hp ?? 0) >= 0 && (d.world.exposure ?? 0) <= 0);
  let pool = (noHurt.length > 0 ? noHurt : guaranteed).map((x) => x);

  if (foodDays < 4) {
    const food = pool.filter(({ d }) => (d.res.foodStaple ?? 0) + (d.res.foodFresh ?? 0) > 0);
    if (food.length) pool = food;
  }
  if (waterDays < 4) {
    const water = pool.filter(({ d }) => (d.res.water ?? 0) > 0);
    if (water.length) pool = water;
  }

  const certain = pool.filter(({ c }) => !c.check || !!c.effect);
  if (certain.length) pool = certain;

  const clean = pool.filter(({ d }) => d.addCond.length === 0);
  if (clean.length) pool = clean;

  return pool[0]!.c;
}

/** 给 verify 用的构造题：忽略 recruit，只比较可见数值 */
export function scoreIgnoresRecruit(eff: Effect): number {
  return scoreDelta(flattenEffect(eff));
}
