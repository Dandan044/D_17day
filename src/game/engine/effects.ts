/**
 * Effect 解释器：所有内容对状态的改动都必须经过这里。
 * 事件、建造、结算都复用它，所以数值边界只需要在一个地方守住。
 */

import { EXPOSURE, HEALTH, LOG, WEAR } from '../balance';
import { HOOK_NAME, RES_NAME, STAT_NAME } from '../copy/names';
import { t } from '../copy/t';
import { FAMILY_BY_ID } from '../content/events';
import { LOCATION_BY_ID } from '../content/locations';
import { SURVIVORS, SURVIVOR_BY_ID } from '../content/survivors';
import { derivedRng, type Rng } from '../rng';
import type { ActionHook, ConditionId, Effect, EventFamily, EventVariant, ModuleId, ResourceId, RunState, StatId, Survivor, ValueIconId, ValueNote } from '../types';
import { clampBattery, batteryCapacity } from './power';
import { markGunshotRecent } from './exposure';
import { deriveFacts, grantIodine, matchQuery, waterCapacity } from './tags';
import { conditionName, moduleName, siteOf } from '../content/lookup';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 摘要行里的小数一律只留一位：0.1 精度的耐久值不该显示成 6.399999 */
const round1 = (n: number) => `${Math.round(n * 10) / 10}`;

export function clampResources(run: RunState): void {
  const waterCap = waterCapacity(run);
  // 所有资源结算后统一保留一位小数：百分比类效果（掠夺、腐坏等）的
  // 浮点误差会累积成十几位小数，这里做统一兜底
  run.res.water = Math.round(clamp(run.res.water, 0, waterCap) * 10) / 10;
  for (const k of Object.keys(run.res) as ResourceId[]) {
    if (k === 'water') continue;
    if (k === 'cash') {
      run.res[k] = Math.round(run.res[k]);
      continue;
    }
    run.res[k] = Math.max(0, Math.round(run.res[k] * 10) / 10);
  }
}

function waitForLabel(hooks: ActionHook | ActionHook[] | undefined): string {
  if (!hooks) return '';
  const list = Array.isArray(hooks) ? hooks : [hooks];
  const labels: string[] = [];
  for (const h of list) {
    const name = HOOK_NAME[h];
    if (!name) continue;
    if (!labels.includes(name)) labels.push(name);
  }
  return labels.join(' / ');
}

/** 给校验脚本用：把 waitFor 数组收成玩家可见标签 */
export function sequelWaitLabel(hooks: ActionHook | ActionHook[] | undefined): string {
  return waitForLabel(hooks);
}

export function addLog(run: RunState, text: string, tone: 'good' | 'bad' | 'neutral' | 'grim' = 'neutral'): void {
  run.log.push({ day: run.day, text, tone });
  // 保险丝：只保留最近 LOG.CAP 条，最早条目从日记面板消失，无任何逻辑依赖它们
  if (run.log.length > LOG.CAP) run.log.splice(0, run.log.length - LOG.CAP);
}

export function addCondition(run: RunState, id: ConditionId): boolean {
  if (run.conditions.includes(id)) return false;
  run.conditions.push(id);
  if (!run.conditionAge) run.conditionAge = {};
  run.conditionAge[id] = 0;
  return true;
}

export function removeCondition(run: RunState, id: ConditionId): boolean {
  const i = run.conditions.indexOf(id);
  if (i < 0) return false;
  run.conditions.splice(i, 1);
  if (run.conditionAge) delete run.conditionAge[id];
  return true;
}

export function recruit(run: RunState, templateId: string, rng: Rng): Survivor | null {
  const site = siteOf(run.siteId);
  if (site.companionCap <= 0) return null;
  if (run.survivors.length >= site.companionCap) return null;

  const taken = new Set(run.survivors.map((s) => s.id));
  let tpl = templateId === 'random' ? null : SURVIVOR_BY_ID[templateId] ?? null;
  if (!tpl) {
    const pool = SURVIVORS.filter((s) => !taken.has(s.id));
    if (pool.length === 0) return null;
    tpl = rng.pick(pool);
  }
  if (taken.has(tpl.id)) return null;

  const s: Survivor = {
    ...tpl,
    morale: 60,
    trust: 30,
    joinedDay: run.day,
    conditions: [],
  };
  run.survivors.push(s);
  return s;
}

/** 应用一个 Effect。返回给玩家看的结果摘要行（带该行代表的数值 id，用于画图标）。 */
/** enqueue 指向未知家族的一次性警告（lookup.ts 的 warnOnce 是私有的，这里就地自持） */
const enqueueWarned = new Set<string>();
function warnOnceEnqueue(familyId: string): void {
  if (enqueueWarned.has(familyId)) return;
  enqueueWarned.add(familyId);
  console.warn(`[七日之前] enqueue 指向未知的事件家族 ${familyId}，后果没有送达`);
}

/**
 * 为 enqueue 选定变体：优先用内容显式给的 variantId；缺省时在过 require 的变体里
 * 挑「require 最具体」的（与 director.pickVariant 同构），并列时用 derivedRng 挑。
 * 没有任何变体可用 → 返回 null，这次 enqueue 放弃（塞死条目会被 pruneOrphanQueue 清掉）。
 */
function pickEnqueueVariant(run: RunState, family: EventFamily, explicit: string | undefined): string | null {
  if (explicit) {
    return family.variants.some((v) => v.id === explicit) ? explicit : null;
  }
  const facts = deriveFacts(run);
  const eligible = family.variants.filter((v) => !v.require || matchQuery(v.require, facts));
  if (eligible.length === 0) return null;
  const specificity = (v: EventVariant): number => {
    const r = v.require;
    if (!r) return 0;
    const count = (q: unknown): number => {
      if (Array.isArray(q)) return q.reduce((n: number, x) => n + count(x), 0);
      if (q && typeof q === 'object') {
        return Object.entries(q as Record<string, unknown>).reduce(
          (n, [k, val]) => (val === undefined ? n : n + (k === 'all' || k === 'any' || k === 'not' ? count(val) : 1)),
          0,
        );
      }
      return 1;
    };
    return count(r);
  };
  const max = Math.max(...eligible.map(specificity));
  const best = eligible.filter((v) => specificity(v) === max);
  return derivedRng(run).pick(best).id;
}

export function applyEffect(run: RunState, eff: Effect, rng: Rng): ValueNote[] {
  const notes: ValueNote[] = [];
  /** 有对应数值的行才带图标；状态/人物/提示类只给文本 */
  const push = (text: string, icon?: ValueIconId) => notes.push(icon ? { text, icon } : { text });

  if (eff.res) {
    for (const [k, delta] of Object.entries(eff.res)) {
      if (!delta) continue;
      run.res[k as ResourceId] += delta;
      const shown = Math.round(delta * 10) / 10;
      push(`${RES_NAME[k as ResourceId] ?? k} ${shown > 0 ? '+' : ''}${shown}`, k as ValueIconId);
    }
    clampResources(run);
  }

  // 行动点不像资源那样有储量上限，只需保证不为负
  if (eff.ap) {
    run.ap = Math.max(0, run.ap + eff.ap);
    push(t('ledger.effect.ap', { delta: `${eff.ap > 0 ? '+' : ''}${eff.ap}` }), 'ap');
  }

  if (eff.stats) {
    for (const [k, delta] of Object.entries(eff.stats)) {
      if (!delta) continue;
      const key = k as StatId;
      const hi = key === 'humanity' || key === 'reputation' ? 100 : HEALTH.MAX;
      run.stats[key] = clamp(run.stats[key] + delta, 0, hi);
      push(`${STAT_NAME[key] ?? key} ${delta > 0 ? '+' : ''}${delta}`, key);
    }
  }

  if (eff.skills) {
    for (const [k, delta] of Object.entries(eff.skills)) {
      if (!delta) continue;
      const key = k as keyof typeof run.skills;
      run.skills[key] = clamp(run.skills[key] + delta, 0, 6);
    }
  }

  if (eff.addCond) {
    for (const c of eff.addCond) {
      if (addCondition(run, c)) push(t('ledger.effect.condAdd', { name: conditionName(c) }));
    }
  }
  if (eff.removeCond) {
    for (const c of eff.removeCond) {
      if (removeCondition(run, c)) push(t('ledger.effect.condRemove', { name: conditionName(c) }));
    }
  }

  if (eff.shelter) {
    const site = siteOf(run.siteId);
    for (const [k, delta] of Object.entries(eff.shelter)) {
      if (!delta) continue;
      const id = k as ModuleId;
      const cap = site.caps[id] ?? 3;
      const before = run.modules[id];
      run.modules[id] = clamp(before + delta, 0, cap);
      if (run.modules[id] !== before) {
        const name = moduleName(id);
        push(delta > 0 ? t('ledger.effect.moduleUp', { name, lvl: run.modules[id] }) : t('ledger.effect.moduleDown', { name, lvl: run.modules[id] }));
      }
    }
  }

  if (eff.wear) {
    if (eff.wear.filterLife) {
      // 单芯总耐久 30 封顶；负增量合法（额外磨损），正增量只允许补到满芯
      const before = run.wear.filterLife;
      run.wear.filterLife = Math.min(
        WEAR.FILTER_LIFE,
        Math.max(0, Math.round((run.wear.filterLife + eff.wear.filterLife) * 10) / 10),
      );
      // 只有回升才报——日常磨损天天发生，逐日报会刷屏
      if (run.wear.filterLife > before) {
        push(t('ledger.effect.filterLife', { before: round1(before), after: round1(run.wear.filterLife) }), 'cartridge');
      }
    }
    if (eff.wear.generatorOil) run.wear.generatorOil = Math.max(0, run.wear.generatorOil + eff.wear.generatorOil);
    if (eff.wear.batteryCharge) {
      run.wear.batteryCharge = Math.max(0, (run.wear.batteryCharge ?? 0) + eff.wear.batteryCharge);
      clampBattery(run);
      const shown = Math.round(eff.wear.batteryCharge * 10) / 10;
      push(t('ledger.effect.battery', { shown: `${shown > 0 ? '+' : ''}${shown}`, stored: run.wear.batteryCharge.toFixed(1), cap: batteryCapacity(run) }), 'battery');
    }
  }

  // 换上备用滤芯：显式动作，耐久置满而不是靠「补 30 恰好等于上限」的巧合
  if (eff.swapFilter && (run.items?.filter ?? 0) > 0) {
    const before = run.wear.filterLife;
    run.items.filter -= 1;
    run.wear.filterLife = WEAR.FILTER_LIFE;
    push(t('ledger.effect.filterLife', { before: round1(before), after: round1(run.wear.filterLife) }), 'cartridge');
    push(t('ledger.effect.cartridge', { delta: '-1', left: run.items.filter }), 'cartridge');
  }

  if (eff.items) {
    if (!run.items) run.items = { filter: 0 };
    const d = eff.items.filter ?? 0;
    if (d) {
      run.items.filter = Math.max(0, run.items.filter + d);
      push(t('ledger.effect.cartridge', { delta: `${d > 0 ? '+' : ''}${d}`, left: run.items.filter }), 'cartridge');
    }
  }

  if (eff.world) {
    const w = run.world;
    if (eff.world.lawOrder) w.lawOrder = clamp(w.lawOrder + eff.world.lawOrder, 0, 100);
    if (eff.world.scarcity) w.scarcity = clamp(w.scarcity + eff.world.scarcity, 0, 100);
    if (eff.world.neighborhood) w.neighborhood = clamp(w.neighborhood + eff.world.neighborhood, -100, 100);
    if (eff.world.exposure) {
      w.exposure = clamp(w.exposure + eff.world.exposure, 0, EXPOSURE.MAX);
      push(t('ledger.effect.exposure', { delta: `${eff.world.exposure > 0 ? '+' : ''}${eff.world.exposure}` }), 'exposure');
    }
    if (eff.world.radiation) w.radiation = clamp(w.radiation + eff.world.radiation, 0, 100);
    if (eff.world.contagion) w.contagion = clamp(w.contagion + eff.world.contagion, 0, 100);
    if (eff.world.temperature) w.temperature += eff.world.temperature;
  }

  if (eff.indoor) {
    run.indoorTemp = Math.round(((run.indoorTemp ?? 18) + eff.indoor) * 10) / 10;
  }

  if (eff.heatMode) {
    run.heatMode = eff.heatMode;
    if (!run.powerEnabled) run.powerEnabled = {};
    if (eff.heatMode === 'fuel') run.powerEnabled.heater = false;
    if (eff.heatMode === 'electric') run.powerEnabled.heater = true;
  }

  if (eff.faction) {
    for (const [k, delta] of Object.entries(eff.faction)) {
      if (!delta) continue;
      const key = k as keyof typeof run.world.factions;
      run.world.factions[key] = clamp(run.world.factions[key] + delta, 0, 100);
    }
  }
  if (eff.stance) {
    for (const [k, delta] of Object.entries(eff.stance)) {
      if (!delta) continue;
      const key = k as keyof typeof run.world.factionStance;
      run.world.factionStance[key] = clamp(run.world.factionStance[key] + delta, -100, 100);
    }
  }

  if (eff.survivor) {
    if (eff.survivor.recruit) {
      const s = recruit(run, eff.survivor.recruit, rng);
      if (s) push(t('ledger.effect.join', { name: s.name }));
      else push(t('ledger.effect.full'));
    }
    if (eff.survivor.lose) {
      for (let i = 0; i < eff.survivor.lose && run.survivors.length > 0; i++) {
        const idx = rng.int(0, run.survivors.length - 1);
        const gone = run.survivors.splice(idx, 1)[0]!;
        push(t('ledger.effect.leave', { name: gone.name }));
      }
    }
    if (eff.survivor.morale) {
      for (const s of run.survivors) s.morale = clamp(s.morale + eff.survivor.morale, 0, 100);
    }
    if (eff.survivor.trust) {
      for (const s of run.survivors) s.trust = clamp(s.trust + eff.survivor.trust, 0, 100);
    }
  }

  if (eff.setFlags) {
    for (const f of eff.setFlags) if (!run.flags.includes(f)) run.flags.push(f);
    if (eff.setFlags.includes('flag:iodine')) grantIodine(run);
    if (eff.setFlags.includes('flag:gunshotRecent')) markGunshotRecent(run);
    // 只报「北上路线已知」这种玩家真正需要知道的结果。
    // 其余 flag 一律不写进结算提示——"已记入日记"是一句没有信息量的噪音，已移除。
    if (eff.setFlags.includes('flag:knowsNorthRoute')) push(t('ledger.effect.north'));
  }
  if (eff.clearFlags) {
    run.flags = run.flags.filter((f) => !eff.clearFlags!.includes(f));
  }

  if (eff.locations) {
    for (const loc of eff.locations) {
      let st = run.locations.find((l) => l.id === loc.id);
      if (!st) {
        st = { id: loc.id, stock: 50 };
        run.locations.push(st);
      }
      if (loc.stock !== undefined) {
        st.stock = Math.max(0, Math.min(100, loc.stock));
        push(t('ledger.effect.stock', { name: LOCATION_BY_ID[loc.id]?.name ?? loc.id, pct: Math.round(st.stock) }));
      }
      if (loc.blocked === null) {
        delete st.blocked;
      } else if (loc.blocked) {
        st.blocked = loc.blocked;
        push(t('ledger.effect.blocked', { name: LOCATION_BY_ID[loc.id]?.name ?? loc.id, why: loc.blocked }));
      }
    }
  }

  if (eff.schedule) {
    const waitHints: string[] = [];
    for (const s of eff.schedule) {
      run.pending.push({
        familyId: s.familyId,
        dueDay: s.inDays !== undefined ? run.day + s.inDays : undefined,
        waitFor: s.waitFor,
        require: s.require,
        tags: s.tags,
        unless: s.unless,
        retries: 0,
      });
      const w = waitForLabel(s.waitFor);
      if (w) waitHints.push(w);
    }
    if (waitHints.length) push(t('ledger.effect.sequelWait', { hooks: waitHints.join('、') }));
    else push(t('ledger.effect.sequel'));
  }

  /**
   * 对话后果的「今日待办」通道：把事件家族**当场推进 run.queue**。
   *
   * 刻意绕过 pending/emitHook 那条路（MAX_PENDING_PER_DAY:2 的每日限流会把
   * 对话答应好的事吞掉或顺延）——对话里说好的事，今天就得到来。
   * 变体必须当场选定：pruneOrphanQueue 会清掉指向不存在变体的队列条目，
   * 塞一个空 variantId 等于白塞。变体选择用 derivedRng——applyEffect 收到的
   * rng 可能来自共享流（家族事件结算），用它会推后 sim 基线。
   * 同一家族去重：对话里连说两次的事，待办里只该出现一次。
   * （变体挑选逻辑与 director.pickVariant 同构，但这里不能 import director——
   * director 依赖 effects（addLog），会成环。）
   */
  if (eff.enqueue?.length) {
    for (const item of eff.enqueue) {
      const family = FAMILY_BY_ID[item.familyId];
      if (!family) {
        warnOnceEnqueue(item.familyId);
        continue;
      }
      if (run.queue.some((q) => q.familyId === item.familyId)) continue;
      const variantId = pickEnqueueVariant(run, family, item.variantId);
      if (variantId) run.queue.push({ familyId: item.familyId, variantId });
    }
  }

  if (eff.unlock?.length) {
    if (!run.pendingUnlocks) run.pendingUnlocks = [];
    for (const u of eff.unlock) {
      if (!run.pendingUnlocks.includes(u)) run.pendingUnlocks.push(u);
    }
  }

  if (eff.log) addLog(run, eff.log, eff.tone ?? 'neutral');

  return notes;
}
