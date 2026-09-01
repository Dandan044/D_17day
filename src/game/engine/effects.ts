/**
 * Effect 解释器：所有内容对状态的改动都必须经过这里。
 * 事件、建造、结算都复用它，所以数值边界只需要在一个地方守住。
 */

import { EXPOSURE, HEALTH } from '../balance';
import { CONDITION_BY_ID } from '../content/conditions';
import { LOCATION_BY_ID } from '../content/locations';
import { MODULE_BY_ID } from '../content/modules';
import { SITE_BY_ID } from '../content/sites';
import { SURVIVORS, SURVIVOR_BY_ID } from '../content/survivors';
import type { Rng } from '../rng';
import type { ActionHook, ConditionId, Effect, ModuleId, ResourceId, RunState, StatId, Survivor } from '../types';
import { grantIodine, waterCapacity } from './tags';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const RES_LABEL: Record<string, string> = {
  water: '水',
  foodStaple: '罐头',
  foodFresh: '生鲜',
  meds: '药品',
  fuel: '燃料',
  materials: '建材',
  parts: '零件',
  ammo: '弹药',
  cash: '现金',
};

const STAT_LABEL: Record<string, string> = {
  hp: '生命',
  stamina: '体力',
  sanity: '理智',
  humanity: '人性',
  reputation: '名声',
};

export function clampResources(run: RunState): void {
  const waterCap = waterCapacity(run);
  run.res.water = clamp(run.res.water, 0, waterCap);
  for (const k of Object.keys(run.res) as ResourceId[]) {
    if (k === 'water') continue;
    run.res[k] = Math.max(0, run.res[k]);
  }
  run.res.cash = Math.round(run.res.cash);
}

const HOOK_NAME: Record<string, string> = {
  endDay: '过完这一天',
  scavenge: '外出搜刮',
  scavengeNight: '夜间搜刮',
  buy: '采购',
  visitShop: '进店',
  rest: '休息',
  build: '施工',
  work: '动手干活',
  maintain: '保养',
  treat: '治疗',
  verifyIntel: '核实情报',
  setRation: '改口粮',
  setWaterUse: '改用水',
  setPowerMode: '改供电',
  setPowerPriority: '改供电优先级',
  setHeatMode: '改取暖',
  raid: '遭遇袭击',
};

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
      notes.push(`${RES_LABEL[k] ?? k} ${shown > 0 ? '+' : ''}${shown}`);
    }
    clampResources(run);
  }

  // 行动点不像资源那样有储量上限，只需保证不为负
  if (eff.ap) {
    run.ap = Math.max(0, run.ap + eff.ap);
    notes.push(`行动点 ${eff.ap > 0 ? '+' : ''}${eff.ap}`);
  }

  if (eff.stats) {
    for (const [k, delta] of Object.entries(eff.stats)) {
      if (!delta) continue;
      const key = k as StatId;
      const hi = key === 'humanity' || key === 'reputation' ? 100 : HEALTH.MAX;
      run.stats[key] = clamp(run.stats[key] + delta, 0, hi);
      notes.push(`${STAT_LABEL[key] ?? key} ${delta > 0 ? '+' : ''}${delta}`);
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
      if (addCondition(run, c)) notes.push(`获得状态：${CONDITION_BY_ID[c].name}`);
    }
  }
  if (eff.removeCond) {
    for (const c of eff.removeCond) {
      if (removeCondition(run, c)) notes.push(`解除状态：${CONDITION_BY_ID[c].name}`);
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
        notes.push(delta > 0 ? `${name} → ${run.modules[id]} 级` : `${name}受损 → ${run.modules[id]} 级`);
      }
    }
  }

  if (eff.wear) {
    if (eff.wear.filterLife) run.wear.filterLife = Math.max(0, run.wear.filterLife + eff.wear.filterLife);
    if (eff.wear.generatorOil) run.wear.generatorOil = Math.max(0, run.wear.generatorOil + eff.wear.generatorOil);
    if (eff.wear.batteryCharge)
      run.wear.batteryCharge = Math.max(0, run.wear.batteryCharge + eff.wear.batteryCharge);
  }

  if (eff.world) {
    const w = run.world;
    if (eff.world.lawOrder) w.lawOrder = clamp(w.lawOrder + eff.world.lawOrder, 0, 100);
    if (eff.world.scarcity) w.scarcity = clamp(w.scarcity + eff.world.scarcity, 0, 100);
    if (eff.world.neighborhood) w.neighborhood = clamp(w.neighborhood + eff.world.neighborhood, -100, 100);
    if (eff.world.exposure) {
      w.exposure = clamp(w.exposure + eff.world.exposure, 0, EXPOSURE.MAX);
      notes.push(`暴露度 ${eff.world.exposure > 0 ? '+' : ''}${eff.world.exposure}`);
    }
    if (eff.world.airPollution) w.airPollution = clamp(w.airPollution + eff.world.airPollution, 0, 100);
    if (eff.world.radiation) w.radiation = clamp(w.radiation + eff.world.radiation, 0, 100);
    if (eff.world.contagion) w.contagion = clamp(w.contagion + eff.world.contagion, 0, 100);
    if (eff.world.temperature) w.temperature += eff.world.temperature;
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
      if (s) notes.push(`${s.name} 加入了你`);
      else notes.push('已经住不下更多人了');
    }
    if (eff.survivor.lose) {
      for (let i = 0; i < eff.survivor.lose && run.survivors.length > 0; i++) {
        const idx = rng.int(0, run.survivors.length - 1);
        const gone = run.survivors.splice(idx, 1)[0]!;
        notes.push(`${gone.name} 离开了`);
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
    if (eff.setFlags.includes('flag:knowsNorthRoute')) notes.push('北上路线已知');
    else if (eff.setFlags.length) notes.push('已记入日记');
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
        notes.push(`${LOCATION_BY_ID[loc.id]?.name ?? loc.id} 存量变为 ${Math.round(st.stock)}%`);
      }
      if (loc.blocked === null) {
        delete st.blocked;
      } else if (loc.blocked) {
        st.blocked = loc.blocked;
        notes.push(`地图：${LOCATION_BY_ID[loc.id]?.name ?? loc.id} 设卡（${loc.blocked}）`);
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
    if (waitHints.length) notes.push(`续篇将在你【${waitHints.join('、')}】之后出现`);
    else notes.push('这件事还没有结束');
  }

  if (eff.log) addLog(run, eff.log, eff.tone ?? 'neutral');

  return notes;
}
