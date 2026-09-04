/**
 * 行为钩子总线：玩家每次有意义的操作都 emit，
 * pending.waitFor 命中则把后续事件推进当天队列。
 */

import { DIRECTOR, HEALTH, NUCLEAR_WINTER, TIME } from '../balance';
import { FAMILY_BY_ID } from '../content/events';
import type { Rng } from '../rng';
import type { ActionHook, PendingEvent, RunState } from '../types';
import { comfortTemp, currentIndoor } from './climate';
import { pickVariant } from './director';
import { loadOnline } from './power';
import { deriveFacts, matchQuery } from './tags';

function hookList(p: PendingEvent): ActionHook[] {
  if (!p.waitFor) return [];
  return Array.isArray(p.waitFor) ? p.waitFor : [p.waitFor];
}

function tryInsert(run: RunState, p: PendingEvent, rng: Rng): boolean {
  const facts = deriveFacts(run);
  if (p.unless && matchQuery(p.unless, facts)) return true;
  if (p.require && !matchQuery(p.require, facts)) return false;
  const f = FAMILY_BY_ID[p.familyId];
  if (!f) return true;
  const variant = pickVariant(f, facts, rng);
  if (!variant) return false;
  if (run.queue.some((q) => q.familyId === p.familyId)) return true;
  run.queue.push({ familyId: p.familyId, variantId: variant.id, tags: p.tags });
  return true;
}

/** 发射一个行为钩子。命中的 pending 立刻入队。返回插入条数。 */
export function emitHook(run: RunState, hook: ActionHook, rng: Rng): number {
  const still: PendingEvent[] = [];
  let inserted = 0;
  for (const p of run.pending) {
    const hooks = hookList(p);
    if (hooks.length === 0 || !hooks.includes(hook)) {
      still.push(p);
      continue;
    }
    if (tryInsert(run, p, rng)) inserted += 1;
    else still.push(p);
  }
  run.pending = still;
  return inserted;
}

/** 夜间结算后根据状态发阈值钩子 */
export function emitThresholdHooks(run: RunState, rng: Rng): void {
  const heads = 1 + run.survivors.length;
  if (run.res.foodStaple + run.res.foodFresh < heads * 2) emitHook(run, 'foodLow', rng);
  if (run.res.water < heads * 3) emitHook(run, 'waterLow', rng);
  if (run.stats.hp < HEALTH.HP_WARN) emitHook(run, 'hpLow', rng);
  if (run.stats.sanity < HEALTH.SANITY_UNRELIABLE) emitHook(run, 'sanityLow', rng);
  if (run.stats.stamina < HEALTH.STAMINA_LOW) emitHook(run, 'staminaLow', rng);
  if (run.stats.humanity < 35) emitHook(run, 'humanityLow', rng);
  if (run.stats.reputation < 35) emitHook(run, 'repLow', rng);
  if (!loadOnline(run, 'lights')) emitHook(run, 'lightsOff', rng);
  if (run.wear.filterLife <= 0) emitHook(run, 'filterExpired', rng);
  if (run.world.exposure >= 40) emitHook(run, 'exposureUp', rng);
}

/** 刚跌破阈值时强制插入短链首拍 */
export function collectThresholdForced(run: RunState): string[] {
  if (!run.thresholdFired) run.thresholdFired = {};
  const cd = HEALTH.THRESHOLD_COOLDOWN;
  const out: string[] = [];
  // 多项状态同时崩时，阈值弧一天最多插 2 条，其余顺延到条件仍满足的日子再试
  let arcFired = 0;
  const fire = (key: string, familyId: string, cond: boolean, limited = true) => {
    if (!cond) return;
    if (run.eventHistory[familyId] !== undefined) return;
    const last = run.thresholdFired[key];
    if (last !== undefined && run.day - last < cd) return;
    if (!FAMILY_BY_ID[familyId]) return;
    if (limited && arcFired >= DIRECTOR.MAX_THRESHOLD_FORCED_PER_DAY) return;
    out.push(familyId);
    run.thresholdFired[key] = run.day;
    if (limited) arcFired += 1;
  };
  // 核冬天首日：室温跌破舒适线走「寒冬来临」，守住舒适线走奖励分支，
  // 当日不重复触发通用冷醒事件（两个分支已各自完整叙事）
  // 这两条是日定事件（错过当天即失效），不占阈值弧的每日配额
  const nwMorning =
    run.world.disaster === 'nuclear' &&
    run.day === TIME.COLLAPSE_DAY + (NUCLEAR_WINTER.THREAT_PHASE - 1) * TIME.WEEK;
  fire('nwCold', 'nw_winter_arrives', nwMorning && currentIndoor(run) < comfortTemp(run), false);
  fire('nwWarm', 'nw_winter_reward', nwMorning && currentIndoor(run) >= comfortTemp(run), false);
  fire('sanity35', 'stat_arc_sanity_1', run.stats.sanity < HEALTH.SANITY_UNRELIABLE && run.stats.sanity >= HEALTH.SANITY_BREAK);
  fire('sanity15', 'stat_arc_sanity_break', run.stats.sanity < HEALTH.SANITY_BREAK);
  fire('hp40', 'stat_arc_hp_1', run.stats.hp < HEALTH.HP_WARN && run.stats.hp >= HEALTH.HP_CRIT);
  fire('hp20', 'stat_arc_hp_crit', run.stats.hp < HEALTH.HP_CRIT);
  fire('stamina', 'stat_arc_stamina_1', run.stats.stamina < HEALTH.STAMINA_LOW);
  fire('humanity', 'stat_arc_humanity_1', run.stats.humanity < 35);
  fire('rep', 'stat_arc_rep_1', run.stats.reputation < 35);
  fire('lights', 'stat_arc_dark_1', !loadOnline(run, 'lights') && run.day >= TIME.COLLAPSE_DAY);
  fire('firstFreeze', 'env_first_freeze', run.indoorBand === 'freeze');
  fire('firstChill', 'env_first_chill', run.indoorBand === 'chill');
  fire('hypoSevere', 'env_hypo_severe', run.conditions.includes('hypothermiaSevere'));
  fire('warmthBack', 'env_warmth_return', run.indoorBand === 'warm' && run.flags.includes('flag:wasCold'));
  fire('wokeCold', 'env_woke_cold', !!run.heatMissed && !nwMorning);
  return out;
}
