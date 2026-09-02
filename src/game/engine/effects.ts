/**
 * Effect 解释器：所有内容对状态的改动都必须经过这里。
 * 事件、建造、结算都复用它，所以数值边界只需要在一个地方守住。
 */

import { EXPOSURE, HEALTH } from '../balance';
import { HOOK_NAME, RES_NAME, STAT_NAME } from '../copy/names';
import { t } from '../copy/t';
import { CONDITION_BY_ID } from '../content/conditions';
import { LOCATION_BY_ID } from '../content/locations';
import { MODULE_BY_ID } from '../content/modules';
import { SITE_BY_ID } from '../content/sites';
import { SURVIVORS, SURVIVOR_BY_ID } from '../content/survivors';
import type { Rng } from '../rng';
import type { ActionHook, ConditionId, Effect, ModuleId, ResourceId, RunState, StatId, Survivor } from '../types';
import { clampBattery, batteryCapacity } from './power';
import { grantIodine, waterCapacity } from './tags';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function clampResources(run: RunState): void {
  const waterCap = waterCapacity(run);
  run.res.water = clamp(run.res.water, 0, waterCap);
  for (const k of Object.keys(run.res) as ResourceId[]) {
    if (k === 'water') continue;
    run.res[k] = Math.max(0, run.res[k]);
  }
  run.res.cash = Math.round(run.res.cash);
}

function waitForLabel(hooks: ActionHook | ActionHook[] | undefined): string {
  if (!hooks) return '';
  const list = Array.isArray(hooks) ? hooks : [hooks];
  return list.map((h) => HOOK_NAME[h] ?? h).join(' / ');
}

export function addLog(run: RunState, text: string, tone: 'good' | 'bad' | 'neutral' | 'grim' = 'neutral'): void {
  run.log.push({ day: run.day, text, tone });
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
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
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

/** 应用一个 Effect。返回给玩家看的结果摘要行。 */
export function applyEffect(run: RunState, eff: Effect, rng: Rng): string[] {
  const notes: string[] = [];

  if (eff.res) {
    for (const [k, delta] of Object.entries(eff.res)) {
      if (!delta) continue;
      run.res[k as ResourceId] += delta;
      const shown = Math.round(delta * 10) / 10;
      notes.push(`${RES_NAME[k as ResourceId] ?? k} ${shown > 0 ? '+' : ''}${shown}`);
    }
    clampResources(run);
  }

  // 行动点不像资源那样有储量上限，只需保证不为负
  if (eff.ap) {
    run.ap = Math.max(0, run.ap + eff.ap);
    notes.push(t('ledger.effect.ap', { delta: `${eff.ap > 0 ? '+' : ''}${eff.ap}` }));
  }

  if (eff.stats) {
    for (const [k, delta] of Object.entries(eff.stats)) {
      if (!delta) continue;
      const key = k as StatId;
      const hi = key === 'humanity' || key === 'reputation' ? 100 : HEALTH.MAX;
      run.stats[key] = clamp(run.stats[key] + delta, 0, hi);
      notes.push(`${STAT_NAME[key] ?? key} ${delta > 0 ? '+' : ''}${delta}`);
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
      if (addCondition(run, c)) notes.push(t('ledger.effect.condAdd', { name: CONDITION_BY_ID[c].name }));
    }
  }
  if (eff.removeCond) {
    for (const c of eff.removeCond) {
      if (removeCondition(run, c)) notes.push(t('ledger.effect.condRemove', { name: CONDITION_BY_ID[c].name }));
    }
  }

  if (eff.shelter) {
    const site = SITE_BY_ID[run.siteId ?? 'apartment'];
    for (const [k, delta] of Object.entries(eff.shelter)) {
      if (!delta) continue;
      const id = k as ModuleId;
      const cap = site.caps[id] ?? 3;
      const before = run.modules[id];
      run.modules[id] = clamp(before + delta, 0, cap);
      if (run.modules[id] !== before) {
        const name = MODULE_BY_ID[id].name;
        notes.push(delta > 0 ? t('ledger.effect.moduleUp', { name, lvl: run.modules[id] }) : t('ledger.effect.moduleDown', { name, lvl: run.modules[id] }));
      }
    }
  }

  if (eff.wear) {
    if (eff.wear.filterLife) run.wear.filterLife = Math.max(0, run.wear.filterLife + eff.wear.filterLife);
    if (eff.wear.generatorOil) run.wear.generatorOil = Math.max(0, run.wear.generatorOil + eff.wear.generatorOil);
    if (eff.wear.batteryCharge) {
      run.wear.batteryCharge = Math.max(0, (run.wear.batteryCharge ?? 0) + eff.wear.batteryCharge);
      clampBattery(run);
      const shown = Math.round(eff.wear.batteryCharge * 10) / 10;
      notes.push(t('ledger.effect.battery', { shown: `${shown > 0 ? '+' : ''}${shown}`, stored: run.wear.batteryCharge.toFixed(1), cap: batteryCapacity(run) }));
    }
  }

  if (eff.world) {
    const w = run.world;
    if (eff.world.lawOrder) w.lawOrder = clamp(w.lawOrder + eff.world.lawOrder, 0, 100);
    if (eff.world.scarcity) w.scarcity = clamp(w.scarcity + eff.world.scarcity, 0, 100);
    if (eff.world.neighborhood) w.neighborhood = clamp(w.neighborhood + eff.world.neighborhood, -100, 100);
    if (eff.world.exposure) {
      w.exposure = clamp(w.exposure + eff.world.exposure, 0, EXPOSURE.MAX);
      notes.push(t('ledger.effect.exposure', { delta: `${eff.world.exposure > 0 ? '+' : ''}${eff.world.exposure}` }));
    }
    if (eff.world.airPollution) w.airPollution = clamp(w.airPollution + eff.world.airPollution, 0, 100);
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
      if (s) notes.push(t('ledger.effect.join', { name: s.name }));
      else notes.push(t('ledger.effect.full'));
    }
    if (eff.survivor.lose) {
      for (let i = 0; i < eff.survivor.lose && run.survivors.length > 0; i++) {
        const idx = rng.int(0, run.survivors.length - 1);
        const gone = run.survivors.splice(idx, 1)[0]!;
        notes.push(t('ledger.effect.leave', { name: gone.name }));
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
    if (eff.setFlags.includes('flag:knowsNorthRoute')) notes.push(t('ledger.effect.north'));
    else if (eff.setFlags.length) notes.push(t('ledger.effect.flagged'));
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
        notes.push(t('ledger.effect.stock', { name: LOCATION_BY_ID[loc.id]?.name ?? loc.id, pct: Math.round(st.stock) }));
      }
      if (loc.blocked === null) {
        delete st.blocked;
      } else if (loc.blocked) {
        st.blocked = loc.blocked;
        notes.push(t('ledger.effect.blocked', { name: LOCATION_BY_ID[loc.id]?.name ?? loc.id, why: loc.blocked }));
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
    if (waitHints.length) notes.push(t('ledger.effect.sequelWait', { hooks: waitHints.join('、') }));
    else notes.push(t('ledger.effect.sequel'));
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
