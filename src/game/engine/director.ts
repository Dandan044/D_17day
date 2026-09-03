/**
 * 事件导演。
 *
 * 不是抽卡，是一个有节奏感的选择器：
 *   1. 到期的因果链事件优先插入，保证故事连贯
 *   2. 硬过滤（标签 require/forbid、冷却、once、末世等级）
 *   3. 软权重（世界状态、势力活跃度、最近几天的强度与类别分布）
 *   4. 选定家族后，再按标签选出唯一合理的变体
 *
 * 第 4 步是关键：raid_attempt 只有一个，但洪灾局绝不会出现"有人踹门"，
 * 因为那个变体 forbid 了 water:flooded。
 */

import { DIRECTOR } from '../balance';
import { KIND_NAME } from '../copy/names';
import { t } from '../copy/t';
import { FAMILY_BY_ID, ALL_FAMILIES } from '../content/events';
import { AID_HOOK_FLAGS } from '../content/events/queries';
import type { Rng } from '../rng';
import type { EventFamily, EventKind, EventVariant, Facts, RunState } from '../types';
import { addLog } from './effects';
import { deriveFacts, matchQuery } from './tags';

export interface Pick {
  familyId: string;
  variantId: string;
  tags?: string[];
}

// ============================================================
// 变体选择
// ============================================================

export function pickVariant(family: EventFamily, facts: Facts, rng: Rng): EventVariant | null {
  const eligible = family.variants.filter((v) => matchQuery(v.require, facts) && !matchesForbid(v.forbid, facts));
  if (eligible.length === 0) return null;
  // 条件更具体的变体优先：require 项越多越"贴合当下"
  const maxSpecificity = Math.max(...eligible.map(specificity));
  const best = eligible.filter((v) => specificity(v) === maxSpecificity);
  return rng.pick(best);
}

function specificity(v: EventVariant): number {
  const r = v.require;
  if (!r) return 0;
  return (r.all?.length ?? 0) * 2 + (r.any?.length ?? 0);
}

function matchesForbid(forbid: EventFamily['forbid'], facts: Facts): boolean {
  if (!forbid) return false;
  // forbid 命中任意一项就排除
  if (forbid.all && forbid.all.length > 0 && forbid.all.every((t) => matchQueryTag(t, facts))) return true;
  if (forbid.any && forbid.any.some((t) => matchQueryTag(t, facts))) return true;
  return false;
}

function matchQueryTag(tag: string, facts: Facts): boolean {
  return matchQuery({ all: [tag] }, facts);
}

// ============================================================
// 硬过滤
// ============================================================

export interface RejectReason {
  familyId: string;
  reason: string;
}

export function isEligible(f: EventFamily, run: RunState, facts: Facts): string | null {
  const phase = run.phase === 'prep' ? 'prep' : 'survival';
  if (!f.phase.includes(phase)) return '阶段不符';
  if (f.minThreat !== undefined && run.threat < f.minThreat) return '末世等级过低';
  if (f.maxThreat !== undefined && run.threat > f.maxThreat) return '末世等级过高';

  const last = run.eventHistory[f.id];
  if (last !== undefined) {
    if (f.once) return '本局已触发';
    const cd = f.cooldown ?? DIRECTOR.DEFAULT_COOLDOWN;
    if (run.day - last < cd) return `冷却中（还需 ${cd - (run.day - last)} 天）`;
  }

  if (!matchQuery(f.require, facts)) return '前提标签不满足';
  if (matchesForbid(f.forbid, facts)) return '被禁止标签命中';
  if (!f.variants.some((v) => matchQuery(v.require, facts) && !matchesForbid(v.forbid, facts))) {
    return '没有合适的变体';
  }
  return null;
}

// ============================================================
// 软权重
// ============================================================

function pacingMultiplier(f: EventFamily, run: RunState): number {
  const window = run.recentBeats.filter((b) => run.day - b.day <= DIRECTOR.BEAT_WINDOW);
  let mult = DIRECTOR.KIND_BASE[f.kind] ?? 1;

  const sameKind = window.filter((b) => b.kind === f.kind).length;
  if (sameKind >= DIRECTOR.SAME_KIND_LIMIT) mult *= DIRECTOR.SAME_KIND_PENALTY;

  const intensitySum = window.reduce((s, b) => s + b.intensity, 0);
  if (intensitySum > DIRECTOR.INTENSITY_BUDGET) {
    if (f.intensity >= 3) mult *= DIRECTOR.HIGH_INTENSITY_PENALTY;
    if (f.kind === 'opportunity' || f.kind === 'social') mult *= DIRECTOR.RELIEF_BOOST;
  }

  // 秩序越差，威胁类越常见
  if (f.kind === 'threat') {
    mult *= 1 + ((100 - run.world.lawOrder) / 10) * DIRECTOR.ORDER_THREAT_SCALE;
  }
  // 理智低时梦境更常来
  if (f.kind === 'dream') {
    mult *= 1 + (40 - Math.min(40, run.stats.sanity)) / 15;
  }

  const boost = run.directorBoost?.[f.id];
  if (boost && boost > 1) mult *= boost;

  return mult;
}

/** 选项刚满足某家族 require 时，给概率链加权 */
export function applyDirectorBoost(run: RunState, factsBefore: Facts): void {
  if (!run.directorBoost) run.directorBoost = {};
  const factsAfter = deriveFacts(run);
  for (const f of ALL_FAMILIES) {
    if (f.baseWeight <= 0) continue;
    if (f.require && !matchQuery(f.require, factsBefore) && matchQuery(f.require, factsAfter)) {
      const next = Math.min(6, (run.directorBoost[f.id] ?? 1) * 3);
      run.directorBoost[f.id] = next;
    }
    for (const v of f.variants) {
      if (!v.require) continue;
      if (!matchQuery(v.require, factsBefore) && matchQuery(v.require, factsAfter)) {
        const next = Math.min(6, (run.directorBoost[f.id] ?? 1) * 3);
        run.directorBoost[f.id] = next;
      }
    }
  }
}

// ============================================================
// 主流程
// ============================================================

export interface SelectResult {
  picks: Pick[];
  /** 调试用：被拒绝的家族与原因 */
  rejected: RejectReason[];
}

export function selectEvents(run: RunState, rng: Rng, count: number, forcedFamilies: string[] = []): SelectResult {
  const facts = deriveFacts(run);
  const picks: Pick[] = [];
  const rejected: RejectReason[] = [];
  const used = new Set<string>();

  const tryPush = (familyId: string, tags?: string[]): boolean => {
    // 袭击-援助联动：破门袭击入队前查援助钩子 flag，命中则替换为联动剧情。
    // 联动家族没有 eligible 变体（钩子已被消耗）时回退原袭击，不占用 pending 重试计数。
    let pushId = familyId;
    if (familyId === 'raid_attempt' && matchQuery({ any: AID_HOOK_FLAGS }, facts)) {
      pushId = 'raid_aided_repel';
    }
    if (used.has(pushId)) return false;
    const f = FAMILY_BY_ID[pushId];
    if (!f) {
      rejected.push({ familyId: pushId, reason: '家族不存在' });
      return false;
    }
    const variant = pickVariant(f, facts, rng);
    if (!variant) {
      rejected.push({ familyId: pushId, reason: '没有合适的变体' });
      if (pushId !== familyId) return tryPush(familyId, tags);
      return false;
    }
    picks.push({ familyId: pushId, variantId: variant.id, tags });
    used.add(pushId);
    return true;
  };

  // ---------- 1. 到期的因果链 ----------
  const stillPending: typeof run.pending = [];
  for (const p of run.pending) {
    const hasWait = p.waitFor !== undefined;
    if (p.dueDay === undefined) {
      stillPending.push(p);
      continue;
    }
    if (p.dueDay > run.day) {
      stillPending.push(p);
      continue;
    }
    if (p.unless && matchQuery(p.unless, facts)) continue;
    if (p.require && !matchQuery(p.require, facts)) {
      const retries = (p.retries ?? 0) + 1;
      if (retries < 5) stillPending.push({ ...p, dueDay: run.day + 1, retries });
      else if (hasWait) stillPending.push({ ...p, dueDay: undefined, retries });
      else addLog(run, t('ledger.run.missed'), 'neutral');
      continue;
    }
    if (!tryPush(p.familyId, p.tags)) {
      const retries = (p.retries ?? 0) + 1;
      if (retries < 5) stillPending.push({ ...p, dueDay: run.day + 1, retries });
      else if (hasWait) stillPending.push({ ...p, dueDay: undefined, retries });
      else addLog(run, t('ledger.run.missed'), 'neutral');
    }
  }
  run.pending = stillPending;

  // ---------- 2. 强制插入（暴露度阶梯）——同样认冷却 / once ----------
  for (const id of forcedFamilies) {
    const f = FAMILY_BY_ID[id];
    if (!f) {
      rejected.push({ familyId: id, reason: '家族不存在' });
      continue;
    }
    const why = isEligible(f, run, facts);
    if (why) {
      rejected.push({ familyId: id, reason: why });
      continue;
    }
    tryPush(id);
  }

  // ---------- 3. 按权重补足 ----------
  const pool = ALL_FAMILIES.filter((f) => {
    if (used.has(f.id)) return false;
    if (f.baseWeight <= 0) return false; // 只由链条或强制触发
    const why = isEligible(f, run, facts);
    if (why) {
      rejected.push({ familyId: f.id, reason: why });
      return false;
    }
    return true;
  });

  while (picks.length < count && pool.length > 0) {
    const chosen = rng.weighted(pool, (f) => f.baseWeight * pacingMultiplier(f, run));
    if (!chosen) break;
    pool.splice(pool.indexOf(chosen), 1);
    tryPush(chosen.id);
  }

  return { picks, rejected };
}

/** 记录事件已触发，供冷却与节奏控制使用 */
export function recordBeat(run: RunState, familyId: string): void {
  const f = FAMILY_BY_ID[familyId];
  run.eventHistory[familyId] = run.day;
  if (run.directorBoost) delete run.directorBoost[familyId];
  if (familyId.includes('iodine') && !run.flags.includes('flag:sawIodineOffer')) {
    run.flags.push('flag:sawIodineOffer');
  }
  if (f) {
    run.recentBeats.push({ day: run.day, kind: f.kind, intensity: f.intensity });
    if (run.recentBeats.length > 30) run.recentBeats.splice(0, run.recentBeats.length - 30);
  }
}

export function kindName(kind: EventKind): string {
  return KIND_NAME[kind];
}
