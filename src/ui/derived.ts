/**
 * 派生计算缓存：按 run 引用（WeakMap）缓存昂贵的引擎派生函数。
 *
 * 正确性前提：store 中 run 的每次变更都产生新引用
 * （mutate = structuredClone、各 action = structuredClone、App 自愈 effect = 浅展开），
 * 因此 WeakMap 以 run 顶层引用为 key 即可自动失效，无需手动清理；
 * WeakMap 弱引用不阻止旧 run 被垃圾回收。
 *
 * UI 调用点（Game/EventCard/PowerPanel）在单次渲染或连续多次渲染中
 * 对同一 run 反复调用这些函数，缓存后同一 run 只算一次。
 */
import type { Facts, RunState } from '../game/types';
import { deriveFacts } from '../game/engine/tags';
import { computePower, tonightHeat, type PowerReport } from '../game/engine/power';

export type HeatForecast = ReturnType<typeof tonightHeat>;

const factsCache = new WeakMap<RunState, Facts>();

/** deriveFacts(run) 的按引用缓存版本 */
export function cachedFacts(run: RunState): Facts {
  let f = factsCache.get(run);
  if (!f) {
    f = deriveFacts(run);
    factsCache.set(run, f);
  }
  return f;
}

const powerCache = new WeakMap<RunState, PowerReport>();

/** computePower(run) 的按引用缓存版本（仅支持无参调用，与全部 UI 调用点一致） */
export function cachedPower(run: RunState): PowerReport {
  let p = powerCache.get(run);
  if (!p) {
    p = computePower(run);
    powerCache.set(run, p);
  }
  return p;
}

const heatCache = new WeakMap<RunState, HeatForecast>();

/** tonightHeat(run) 的按引用缓存版本 */
export function cachedTonightHeat(run: RunState): HeatForecast {
  let h = heatCache.get(run);
  if (!h) {
    h = tonightHeat(run);
    heatCache.set(run, h);
  }
  return h;
}
