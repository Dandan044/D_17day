/**
 * 工程系统：DIY / 雇工 / 买成品 / 拆解回收。
 *
 * 三条路径构成"时间 vs 金钱 vs 风险"的三角，
 * 而工程队列里的半成品处于劣化状态——所以"什么时候动工"本身是一个抉择。
 */

import { AP, EXPOSURE, PRICE, STAMINA, TIME, WEAR } from '../balance';
import { MODULE_BY_ID, moduleSpec } from '../content/modules';
import { SITE_BY_ID } from '../content/sites';
import type { Rng } from '../rng';
import type { BuildPath, ModuleId, Project, RunState } from '../types';
import { addLog } from './effects';

export interface BuildOption {
  path: BuildPath;
  available: boolean;
  reason?: string;
  /** 给玩家看的成本描述 */
  cost: string;
  cash?: number;
  materials?: number;
  parts?: number;
  labor?: number;
  days?: number;
  /** DIY 技能不足时的失败率 */
  failRisk?: number;
}

function has(run: RunState, ability: string): boolean {
  return run.abilities.includes(ability);
}

/** 目标等级：当前等级 + 1 */
export function nextLevel(run: RunState, id: ModuleId): number | null {
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  const cap = site.caps[id] ?? 3;
  const target = run.modules[id] + 1;
  if (target > cap) return null;
  if (target > 3) return null;
  return target;
}

export function blockingReason(run: RunState, id: ModuleId): string | null {
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  const cap = site.caps[id] ?? 3;
  if (run.modules[id] >= cap) return `${site.name}的条件限制，${MODULE_BY_ID[id].name}最高只能到 ${cap} 级`;
  if (run.projects.some((p) => p.moduleId === id)) return '已在施工队列中';

  const target = nextLevel(run, id);
  if (target === null) return '已达上限';
  const spec = moduleSpec(id, target);
  if (!spec) return '无法升级';

  if (spec.requiresModules) {
    for (const [dep, lvl] of Object.entries(spec.requiresModules)) {
      if (run.modules[dep as ModuleId] < (lvl ?? 0)) {
        return `需要先把${MODULE_BY_ID[dep as ModuleId].name}升到 ${lvl} 级`;
      }
    }
  }
  // 无自然光的站点，2 级以上农圃必须有电
  if (id === 'garden' && target >= 2 && site.tags.includes('site:noSunlight') && run.modules.power < 2) {
    return '这里没有自然光，2 级以上农圃需要 2 级发电供补光灯';
  }
  // 地下与无信号站点的无线电需要外置天线
  if (id === 'radio' && site.tags.includes('site:noSignal') && !run.flags.includes('flag:antenna')) {
    return '此处无信号，需要先架设外置天线（额外 6 零件）';
  }
  return null;
}

export function buildOptions(run: RunState, id: ModuleId): BuildOption[] {
  const target = nextLevel(run, id);
  const opts: BuildOption[] = [];
  if (target === null) return opts;
  const spec = moduleSpec(id, target);
  if (!spec) return opts;

  const blocked = blockingReason(run, id);

  // ---------- DIY ----------
  let labor = spec.labor;
  if (has(run, 'engineer_efficiency')) labor = Math.round(labor * 0.75);
  if (has(run, 'perk_builder_hands')) labor = Math.round(labor * 0.85);

  let failRisk = 0;
  if (spec.skill) {
    const have = run.skills[spec.skill.id];
    if (have < spec.skill.level && !has(run, 'engineer_efficiency')) {
      failRisk = Math.min(0.5, (spec.skill.level - have) * 0.16);
    }
  }
  const diyOk =
    !blocked && run.res.materials >= spec.materials && run.res.parts >= spec.parts;
  opts.push({
    path: 'diy',
    available: diyOk,
    reason:
      blocked ??
      (run.res.materials < spec.materials
        ? `缺 ${Math.ceil(spec.materials - run.res.materials)} 建材`
        : run.res.parts < spec.parts
          ? `缺 ${Math.ceil(spec.parts - run.res.parts)} 零件`
          : undefined),
    cost: `${spec.materials} 建材 · ${spec.parts} 零件 · ${labor} 工时`,
    materials: spec.materials,
    parts: spec.parts,
    labor,
    failRisk,
  });

  // ---------- 雇工：崩溃日后没人来了 ----------
  const isPrep = run.day < TIME.COLLAPSE_DAY;
  let hireCash = Math.round(spec.hireCash * run.world.priceIndex * PRICE.HIRE_MULT);
  if (has(run, 'perk_contacts')) hireCash = Math.round(hireCash * 0.8);
  opts.push({
    path: 'hire',
    available: isPrep && !blocked && run.res.cash >= hireCash,
    reason: !isPrep
      ? '已经没有人接活了'
      : (blocked ?? (run.res.cash < hireCash ? `缺 ${hireCash - run.res.cash} 元` : undefined)),
    cost: `${hireCash} 元 · 1 行动点 · 2 天完工`,
    cash: hireCash,
    days: 2,
  });

  // ---------- 买成品：有到货延迟与被拦截风险 ----------
  let buyCash = Math.round(spec.buyCash * run.world.priceIndex * PRICE.BUY_MULT);
  if (has(run, 'perk_contacts')) buyCash = Math.round(buyCash * 0.88);
  let buyDays = spec.buyDays;
  if (has(run, 'perk_logistics')) buyDays = Math.max(1, buyDays - 1);
  const failChance = Math.min(0.75, buyDays * PRICE.DELIVERY_FAIL_PER_DAY * (1 + (100 - run.world.lawOrder) / 90));
  opts.push({
    path: 'buy',
    available: isPrep && !blocked && run.res.cash >= buyCash,
    reason: !isPrep
      ? '物流已经停了'
      : (blocked ?? (run.res.cash < buyCash ? `缺 ${buyCash - run.res.cash} 元` : undefined)),
    cost: `${buyCash} 元 · ${buyDays} 天到货 · 约 ${Math.round(failChance * 100)}% 概率收不到`,
    cash: buyCash,
    days: buyDays,
    failRisk: failChance,
  });

  return opts;
}

export interface StartResult {
  ok: boolean;
  reason?: string;
}

export function startProject(run: RunState, id: ModuleId, path: BuildPath): StartResult {
  const target = nextLevel(run, id);
  if (target === null) return { ok: false, reason: '已达上限' };
  const opt = buildOptions(run, id).find((o) => o.path === path);
  if (!opt || !opt.available) return { ok: false, reason: opt?.reason ?? '无法开工' };

  const project: Project = {
    moduleId: id,
    toLevel: target,
    path,
    laborTotal: opt.labor ?? 0,
    laborDone: 0,
    startedDay: run.day,
  };

  if (path === 'diy') {
    run.res.materials -= opt.materials ?? 0;
    run.res.parts -= opt.parts ?? 0;
    addLog(run, `开始动工：${MODULE_BY_ID[id].name} → ${target} 级。${MODULE_BY_ID[id].buildPenaltyDesc}`, 'neutral');
  } else if (path === 'hire') {
    if (run.ap < 1) return { ok: false, reason: '需要 1 行动点' };
    run.ap -= 1;
    run.res.cash -= opt.cash ?? 0;
    project.laborTotal = 0;
    project.etaDay = run.day + (opt.days ?? 2);
    project.paid = true;
    addLog(run, `雇了施工队做${MODULE_BY_ID[id].name}，说是两天完工。钱已经付了。`, 'neutral');
  } else if (path === 'buy') {
    run.res.cash -= opt.cash ?? 0;
    project.laborTotal = 0;
    project.etaDay = run.day + (opt.days ?? 1);
    project.paid = true;
    addLog(run, `下单了${MODULE_BY_ID[id].name}的成品设备，${opt.days} 天后到货。`, 'neutral');
  }

  run.projects.push(project);
  return { ok: true };
}

/** 投入 1 行动点的工时 */
export function investLabor(run: RunState, id: ModuleId, rng: Rng): { ok: boolean; reason?: string; note?: string } {
  const p = run.projects.find((x) => x.moduleId === id);
  if (!p) return { ok: false, reason: '没有这个工程' };
  if (p.path !== 'diy') return { ok: false, reason: '这个工程不需要你动手' };
  if (run.ap < 1) return { ok: false, reason: '行动点不足' };

  run.ap -= 1;
  run.stats.stamina = Math.max(0, run.stats.stamina - STAMINA.BUILD);

  let gain = 4 + Math.floor(run.skills.mechanics * 0.8) + Math.floor(run.skills.fitness * 0.5);

  const spec = moduleSpec(id, p.toLevel);
  if (spec?.skill) {
    const have = run.skills[spec.skill.id];
    if (have < spec.skill.level && !has(run, 'engineer_efficiency')) {
      const risk = Math.min(0.5, (spec.skill.level - have) * 0.16);
      if (rng.chance(risk)) {
        const wasted = Math.max(1, Math.round((spec.materials ?? 4) * 0.2));
        run.res.materials = Math.max(0, run.res.materials - wasted);
        gain = Math.max(1, Math.floor(gain * 0.3));
        if (rng.chance(0.25)) {
          run.stats.hp = Math.max(1, run.stats.hp - rng.int(4, 12));
          return { ok: true, note: `做坏了，浪费 ${wasted} 建材，还划伤了手。` };
        }
        return { ok: true, note: `尺寸没对上，浪费了 ${wasted} 建材。` };
      }
    }
  }

  p.laborDone += gain;
  return { ok: true, note: `投入 ${gain} 工时（${p.laborDone}/${p.laborTotal}）` };
}

/** 每日结算：同伴自动投工、雇工与成品到货、完工判定 */
export function advanceProjects(run: RunState, rng: Rng): string[] {
  const notes: string[] = [];

  // 同伴的劳力
  const helpers = run.survivors.filter((s) => s.conditions.length === 0 && s.morale > 25);
  const diyProjects = run.projects.filter((p) => p.path === 'diy');
  if (helpers.length > 0 && diyProjects.length > 0) {
    const perProject = Math.floor((helpers.length * AP.COMPANION_LABOR) / diyProjects.length);
    if (perProject > 0) {
      for (const p of diyProjects) p.laborDone += perProject;
      notes.push(`同伴投入了 ${perProject * diyProjects.length} 工时`);
    }
  }

  const done: Project[] = [];
  for (const p of run.projects) {
    if (p.path === 'diy') {
      if (p.laborDone >= p.laborTotal) done.push(p);
      continue;
    }
    if (p.etaDay !== undefined && run.day >= p.etaDay) {
      // 成品有可能收不到
      if (p.path === 'buy') {
        const spec = moduleSpec(p.moduleId, p.toLevel);
        let days = spec?.buyDays ?? 1;
        if (has(run, 'perk_logistics')) days = Math.max(1, days - 1);
        const failChance = Math.min(0.75, days * PRICE.DELIVERY_FAIL_PER_DAY * (1 + (100 - run.world.lawOrder) / 90));
        if (rng.chance(failChance)) {
          notes.push(`${MODULE_BY_ID[p.moduleId].name}的货没到`);
          addLog(
            run,
            `你订的${MODULE_BY_ID[p.moduleId].name}没有到。客服电话是空号，物流单号查不到。钱是真的付了。`,
            'bad',
          );
          run.projects = run.projects.filter((x) => x !== p);
          // 留一个高风险支线：去仓库自提
          if (!run.flags.includes('flag:warehousePickup')) run.flags.push('flag:warehousePickup');
          continue;
        }
      }
      done.push(p);
    }
  }

  for (const p of done) {
    run.modules[p.moduleId] = Math.max(run.modules[p.moduleId], p.toLevel);
    run.projects = run.projects.filter((x) => x !== p);
    const name = MODULE_BY_ID[p.moduleId].name;
    const spec = moduleSpec(p.moduleId, p.toLevel);
    notes.push(`${name}完工，达到 ${p.toLevel} 级`);
    addLog(run, `${name}完工了。${spec?.desc ?? ''}`, 'good');
    if (p.moduleId === 'filter' || p.moduleId === 'airFilter') {
      run.wear.filterLife = Math.max(run.wear.filterLife, 20);
    }
    if (p.moduleId === 'power' && p.toLevel >= 3) {
      run.wear.generatorOil = Math.max(run.wear.generatorOil, 24);
    }
  }

  return notes;
}

export function cancelProject(run: RunState, id: ModuleId): void {
  const p = run.projects.find((x) => x.moduleId === id);
  if (!p) return;
  run.projects = run.projects.filter((x) => x !== p);
  if (p.path === 'diy') {
    // 退回一部分材料
    const spec = moduleSpec(p.moduleId, p.toLevel);
    if (spec) {
      run.res.materials += Math.floor(spec.materials * 0.5);
      run.res.parts += Math.floor(spec.parts * 0.5);
    }
    addLog(run, `${MODULE_BY_ID[id].name}的工程停了。拆下来的材料只回收了一半。`, 'bad');
  }
}

// ============================================================
// 拆解回收：崩溃日后的第四条路径
// ============================================================

export interface SalvageTarget {
  id: string;
  name: string;
  desc: string;
  materials: [number, number];
  parts: [number, number];
  exposure: number;
  humanity: number;
  requires?: string;
}

export const SALVAGE_TARGETS: SalvageTarget[] = [
  {
    id: 'furniture',
    name: '拆自己的家具',
    desc: '衣柜、书架、床板。你亲手装的，现在亲手拆掉。',
    materials: [3, 7],
    parts: [0, 2],
    exposure: 1,
    humanity: 0,
  },
  {
    id: 'car',
    name: '拆一辆废弃汽车',
    desc: '电瓶、线束、皮带、后备箱的千斤顶。要用到电动工具，很响。',
    materials: [1, 3],
    parts: [4, 9],
    exposure: 6,
    humanity: 0,
  },
  {
    id: 'empty_flat',
    name: '撬开邻居的空房',
    desc: '对门那家早就走了。门是锁着的，但门框是木头的。你知道楼里还有人在看着。',
    materials: [5, 12],
    parts: [2, 6],
    exposure: 8,
    humanity: -8,
  },
  {
    id: 'public',
    name: '拆公共设施',
    desc: '楼道扶手、消防箱、配电间的铜线。理论上这些属于所有人。',
    materials: [4, 9],
    parts: [3, 7],
    exposure: 5,
    humanity: -3,
  },
];

// ============================================================
// 维护：让"建完就躺"不成立
// ============================================================

export type MaintenanceKind = 'filter' | 'oil';

export interface MaintenanceInfo {
  kind: MaintenanceKind;
  name: string;
  desc: string;
  parts: number;
  available: boolean;
  reason?: string;
  /** 当前剩余寿命 */
  remaining: number;
}

export function maintenanceOptions(run: RunState): MaintenanceInfo[] {
  const out: MaintenanceInfo[] = [];

  const hasFilters = run.modules.filter > 0 || run.modules.airFilter > 0;
  let filterParts: number = WEAR.FILTER_PARTS;
  if (run.abilities.includes('chemist_consumables')) filterParts = Math.max(2, filterParts - 1);
  out.push({
    kind: 'filter',
    name: '更换滤芯',
    desc: '净水与空气过滤共用同一套耗材。用尽之后两个模块会同时失效。',
    parts: filterParts,
    available: hasFilters && run.res.parts >= filterParts && run.ap >= 1,
    reason: !hasFilters
      ? '还没有需要滤芯的设备'
      : run.res.parts < filterParts
        ? `缺 ${Math.ceil(filterParts - run.res.parts)} 零件`
        : run.ap < 1
          ? '需要 1 行动点'
          : undefined,
    remaining: Math.max(0, Math.round(run.wear.filterLife)),
  });

  const hasGen = run.modules.power >= 3;
  out.push({
    kind: 'oil',
    name: '给发电机换机油',
    desc: '柴油机组不保养会先掉功率，再彻底抱瓦。',
    parts: WEAR.OIL_PARTS,
    available: hasGen && run.res.parts >= WEAR.OIL_PARTS && run.ap >= 1,
    reason: !hasGen
      ? '还没有柴油发电机组'
      : run.res.parts < WEAR.OIL_PARTS
        ? `缺 ${Math.ceil(WEAR.OIL_PARTS - run.res.parts)} 零件`
        : run.ap < 1
          ? '需要 1 行动点'
          : undefined,
    remaining: Math.max(0, Math.round(run.wear.generatorOil)),
  });

  return out;
}

export function doMaintenance(run: RunState, kind: MaintenanceKind): { ok: boolean; reason?: string; note?: string } {
  const opt = maintenanceOptions(run).find((o) => o.kind === kind);
  if (!opt || !opt.available) return { ok: false, reason: opt?.reason ?? '现在不能做' };

  run.ap -= 1;
  run.res.parts -= opt.parts;
  run.stats.stamina = Math.max(0, run.stats.stamina - STAMINA.CHORE);

  if (kind === 'filter') {
    let restore: number = WEAR.FILTER_RESTORE;
    if (run.abilities.includes('perk_maintainer')) restore = Math.round(restore * 1.5);
    run.wear.filterLife += restore;
    return { ok: true, note: `滤芯寿命恢复到 ${Math.round(run.wear.filterLife)} 天` };
  }
  run.wear.generatorOil += WEAR.GENERATOR_OIL;
  return { ok: true, note: '发电机组安静了下来' };
}

export function doSalvage(run: RunState, targetId: string, rng: Rng): { ok: boolean; reason?: string; note?: string } {
  if (run.day < TIME.COLLAPSE_DAY) return { ok: false, reason: '现在还买得到东西，没必要拆房子' };
  const t = SALVAGE_TARGETS.find((x) => x.id === targetId);
  if (!t) return { ok: false, reason: '没有这个目标' };
  if (run.ap < 1) return { ok: false, reason: '行动点不足' };

  run.ap -= 1;
  run.stats.stamina = Math.max(0, run.stats.stamina - STAMINA.BUILD);

  const mats = rng.int(t.materials[0], t.materials[1]);
  const parts = rng.int(t.parts[0], t.parts[1]);
  run.res.materials += mats;
  run.res.parts += parts;
  run.world.exposure = Math.min(EXPOSURE.MAX, run.world.exposure + t.exposure);
  if (t.humanity) run.stats.humanity = Math.max(0, run.stats.humanity + t.humanity);
  if (t.id === 'empty_flat') {
    run.world.neighborhood = Math.max(-100, run.world.neighborhood - 12);
    if (!run.flags.includes('flag:lootedNeighbor')) run.flags.push('flag:lootedNeighbor');
  }

  return { ok: true, note: `拆出 ${mats} 建材、${parts} 零件。暴露度 +${t.exposure}。` };
}
