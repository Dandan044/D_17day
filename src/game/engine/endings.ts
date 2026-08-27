/**
 * 结局判定与遗物结算。
 */

import { DIFFICULTY, META, TIME } from '../balance';
import { ENDINGS, ENDING_BY_ID } from '../content/endings';
import type { EndingDef, MetaState, RunState } from '../types';
import { checkRequirement, deriveFacts } from './tags';

export function resolveEnding(run: RunState, cause?: string): EndingDef {
  const facts = deriveFacts(run);

  if (cause) {
    const byCause = ENDINGS.filter((e) => e.cause?.some((c) => cause.includes(c))).sort(
      (a, b) => b.priority - a.priority,
    );
    if (byCause[0]) return byCause[0];
    return ENDING_BY_ID['death_generic']!;
  }

  const wins = ENDINGS.filter((e) => e.kind === 'win' && !e.cause)
    .sort((a, b) => b.priority - a.priority)
    .filter((e) => checkRequirement(e.require, run, facts).ok);

  return wins[0] ?? ENDING_BY_ID['survived']!;
}

export interface Settlement {
  ending: EndingDef;
  daysSurvived: number;
  relics: number;
  breakdown: Array<{ label: string; value: number }>;
  newUnlocks: string[];
  newFamilies: string[];
  isNewEnding: boolean;
}

export function settle(run: RunState, ending: EndingDef, meta: MetaState): Settlement {
  const breakdown: Array<{ label: string; value: number }> = [];
  const daysSurvived = Math.max(0, run.day - 1);

  const dayRelics = daysSurvived * META.RELIC_PER_DAY;
  breakdown.push({ label: `存活 ${daysSurvived} 天`, value: dayRelics });

  let total = dayRelics;

  if (run.day >= TIME.COLLAPSE_DAY) {
    total += META.RELIC_SURVIVE_COLLAPSE;
    breakdown.push({ label: '撑过了崩溃日', value: META.RELIC_SURVIVE_COLLAPSE });
  }

  const threatBonus = Math.max(0, run.threat) * META.RELIC_PER_THREAT;
  if (threatBonus > 0) {
    total += threatBonus;
    breakdown.push({ label: `末世等级 ${run.threat}`, value: threatBonus });
  }

  const newFamilies = Object.keys(run.eventHistory).filter((id) => !meta.seenFamilies.includes(id));
  if (newFamilies.length > 0) {
    const v = newFamilies.length * META.RELIC_NEW_FAMILY;
    total += v;
    breakdown.push({ label: `首次遭遇 ${newFamilies.length} 类事件`, value: v });
  }

  if (ending.relics > 0) {
    total += ending.relics;
    breakdown.push({ label: `结局：${ending.name}`, value: ending.relics });
  }

  const isNewEnding = !meta.seenEndings.includes(ending.id);
  if (isNewEnding) {
    total += META.RELIC_NEW_ENDING;
    breakdown.push({ label: '发现新结局', value: META.RELIC_NEW_ENDING });
  }

  const mult = DIFFICULTY[run.difficulty].relicMult;
  if (mult !== 1) {
    const before = total;
    total = Math.round(total * mult);
    breakdown.push({ label: `难度修正 ×${mult}`, value: total - before });
  }

  const newUnlocks = (ending.unlock ?? []).filter((u) => !meta.unlocked.includes(u));

  return { ending, daysSurvived, relics: total, breakdown, newUnlocks, newFamilies, isNewEnding };
}
