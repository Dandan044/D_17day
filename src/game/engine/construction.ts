/**
 * 工程系统：DIY / 雇工 / 买成品 / 拆解回收。
 *
 * 三条路径构成"时间 vs 金钱 vs 风险"的三角，
 * 而工程队列里的半成品处于劣化状态——所以"什么时候动工"本身是一个抉择。
 */

import { AP, EXPOSURE, PRICE, STAMINA, TIME, WEAR } from '../balance';
import { t } from '../copy/t';
import { MODULE_BY_ID, moduleSpec } from '../content/modules';
import { SITE_BY_ID } from '../content/sites';
import type { Rng } from '../rng';
import type { BuildPath, ModuleId, ModuleLevelSpec, Project, RunState } from '../types';
import { addCondition, addLog } from './effects';

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

/** 累计四舍五入差：做到 done 工时时已应付的建材/零件总量 */
export function materialShare(total: number, done: number, laborTotal: number): number {
  if (laborTotal <= 0 || total <= 0) return 0;
  const clamped = Math.max(0, Math.min(done, laborTotal));
  return Math.round((total * clamped) / laborTotal);
}

/** 本次从 fromDone 推进到 toDone 应扣的建材/零件 */
export function portionForGain(
  spec: Pick<ModuleLevelSpec, 'materials' | 'parts'>,
  laborTotal: number,
  fromDone: number,
  gain: number,
): { materials: number; parts: number } {
  const toDone = Math.min(laborTotal, fromDone + Math.max(0, gain));
  return {
    materials: materialShare(spec.materials, toDone, laborTotal) - materialShare(spec.materials, fromDone, laborTotal),
    parts: materialShare(spec.parts, toDone, laborTotal) - materialShare(spec.parts, fromDone, laborTotal),
  };
}

/** 预估下一次投工会扣多少（按钮提示用） */
export function nextWorkPortion(run: RunState, id: ModuleId): { materials: number; parts: number } | null {
  const p = run.projects.find((x) => x.moduleId === id);
  if (!p || p.path !== 'diy' || !p.payAsYouGo) return null;
  if (p.laborDone >= p.laborTotal) return null;
  const spec = moduleSpec(id, p.toLevel);
  if (!spec) return null;
  const gain = Math.min(diyLaborGain(run), p.laborTotal - p.laborDone);
  return portionForGain(spec, p.laborTotal, p.laborDone, gain);
}

function diyLaborGain(run: RunState): number {
  return 4 + Math.floor(run.skills.mechanics * 0.8) + Math.floor(run.skills.fitness * 0.5);
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
  if (run.modules[id] >= cap) return t('ledger.build.capSite', { site: site.name, module: MODULE_BY_ID[id].name, cap });
  if (run.projects.some((p) => p.moduleId === id)) return t('ledger.build.queued');

  const target = nextLevel(run, id);
  if (target === null) return t('ledger.build.atCap');
  const spec = moduleSpec(id, target);
  if (!spec) return t('ledger.build.cannot');

  if (spec.requiresModules) {
    for (const [dep, lvl] of Object.entries(spec.requiresModules)) {
      if (run.modules[dep as ModuleId] < (lvl ?? 0)) {
        return t('ledger.build.needModule', { module: MODULE_BY_ID[dep as ModuleId].name, lvl: lvl ?? 0 });
      }
    }
  }
  // 无自然光的站点，2 级以上农圃必须有电
  if (id === 'garden' && target >= 2 && site.tags.includes('site:noSunlight') && run.modules.power < 2) {
    return t('ledger.build.gardenLight');
  }
  // 地下与无信号站点的无线电需要外置天线
  if (id === 'radio' && site.tags.includes('site:noSignal') && !run.flags.includes('flag:antenna')) {
    return t('ledger.build.radioSignal');
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
        ? t('ledger.build.lackMat', { n: Math.ceil(spec.materials - run.res.materials) })
        : run.res.parts < spec.parts
          ? t('ledger.build.lackParts', { n: Math.ceil(spec.parts - run.res.parts) })
          : undefined),
    cost: t('ledger.build.diyCost', { mat: spec.materials, parts: spec.parts, labor }),
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
      ? t('ledger.build.noHire')
      : (blocked ?? (run.res.cash < hireCash ? t('ledger.build.lackCash', { n: hireCash - run.res.cash }) : undefined)),
    cost: t('ledger.build.hireCost', { cash: hireCash }),
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
      ? t('ledger.build.noBuy')
      : (blocked ?? (run.res.cash < buyCash ? t('ledger.build.lackCash', { n: buyCash - run.res.cash }) : undefined)),
    cost: t('ledger.build.buyCost', { cash: buyCash, days: buyDays, pct: Math.round(failChance * 100) }),
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
  if (target === null) return { ok: false, reason: t('ledger.build.atCap') };
  const opt = buildOptions(run, id).find((o) => o.path === path);
  if (!opt || !opt.available) return { ok: false, reason: opt?.reason ?? t('ledger.build.cannotStart') };

  const project: Project = {
    moduleId: id,
    toLevel: target,
    path,
    laborTotal: opt.labor ?? 0,
    laborDone: 0,
    startedDay: run.day,
  };

  if (path === 'diy') {
    // 开工不预扣：材料按次施工消耗。payAsYouGo 标记新规则。
    project.payAsYouGo = true;
    addLog(run, t('ledger.build.startDiy', { name: MODULE_BY_ID[id].name, target, penalty: MODULE_BY_ID[id].buildPenaltyDesc }), 'neutral');
  } else if (path === 'hire') {
    if (run.ap < 1) return { ok: false, reason: t('ledger.build.needAp') };
    run.ap -= 1;
    run.res.cash -= opt.cash ?? 0;
    project.laborTotal = 0;
    project.etaDay = run.day + (opt.days ?? 2);
    project.paid = true;
    addLog(run, t('ledger.build.startHire', { name: MODULE_BY_ID[id].name }), 'neutral');
  } else if (path === 'buy') {
    run.res.cash -= opt.cash ?? 0;
    project.laborTotal = 0;
    project.etaDay = run.day + (opt.days ?? 1);
    project.paid = true;
    addLog(run, t('ledger.build.startBuy', { name: MODULE_BY_ID[id].name, days: opt.days ?? 1 }), 'neutral');
  }

  run.projects.push(project);
  return { ok: true };
}

/** 投入 1 行动点的工时 */
export function investLabor(run: RunState, id: ModuleId, rng: Rng): { ok: boolean; reason?: string; note?: string } {
  const p = run.projects.find((x) => x.moduleId === id);
  if (!p) return { ok: false, reason: t('ledger.build.noProject') };
  if (p.path !== 'diy') return { ok: false, reason: t('ledger.build.notDiy') };
  if (run.ap < 1) return { ok: false, reason: t('ledger.build.noAp') };
  if (p.laborDone >= p.laborTotal) return { ok: false, reason: t('ledger.build.queued') };

  const gain = diyLaborGain(run);
  const remaining = p.laborTotal - p.laborDone;
  const appliedGain = Math.min(gain, remaining);
  const spec = moduleSpec(id, p.toLevel);
  const payg = !!p.payAsYouGo;
  let portion = { materials: 0, parts: 0 };
  if (payg && spec) {
    portion = portionForGain(spec, p.laborTotal, p.laborDone, appliedGain);
    if (portion.materials <= 0 && portion.parts <= 0 && remaining > 0) {
      // 四舍五入尾差已分光时，至少扣 1 建材（仍有工时要做）
      portion.materials = Math.min(1, Math.max(0, spec.materials - materialShare(spec.materials, p.laborDone, p.laborTotal)));
      if (portion.materials <= 0 && spec.parts > 0) {
        portion.parts = Math.min(1, Math.max(0, spec.parts - materialShare(spec.parts, p.laborDone, p.laborTotal)));
      }
    }
    if (run.res.materials < portion.materials) {
      return { ok: false, reason: t('ledger.build.lackWorkMat', { n: Math.ceil(portion.materials - run.res.materials) }) };
    }
    if (run.res.parts < portion.parts) {
      return { ok: false, reason: t('ledger.build.lackWorkParts', { n: Math.ceil(portion.parts - run.res.parts) }) };
    }
  }

  run.ap -= 1;
  run.stats.stamina = Math.max(0, run.stats.stamina - STAMINA.BUILD);

  if (spec?.skill) {
    const have = run.skills[spec.skill.id];
    if (have < spec.skill.level && !has(run, 'engineer_efficiency')) {
      const risk = Math.min(0.5, (spec.skill.level - have) * 0.16);
      if (rng.chance(risk)) {
        if (payg) {
          run.res.materials -= portion.materials;
          run.res.parts -= portion.parts;
        }
        // 旧存档：已预扣全额，失败不再从库存「浪费」
        if (rng.chance(0.25)) {
          const alreadyHurt =
            run.conditions.includes('wound') ||
            run.conditions.includes('woundInfection') ||
            run.conditions.includes('sepsis');
          if (!alreadyHurt) addCondition(run, 'wound');
          addLog(run, t('ledger.build.failHurt'), 'bad');
          return { ok: true, note: t('ledger.build.failHurt') };
        }
        const note = t('ledger.build.failWaste', { mat: portion.materials, parts: portion.parts });
        addLog(run, note, 'bad');
        return { ok: true, note };
      }
    }
  }

  if (payg) {
    run.res.materials -= portion.materials;
    run.res.parts -= portion.parts;
  }
  p.laborDone += appliedGain;
  return {
    ok: true,
    note: t('ledger.build.labor', {
      gain: appliedGain,
      done: p.laborDone,
      total: p.laborTotal,
      mat: portion.materials,
      parts: portion.parts,
    }),
  };
}

/** 每日结算：同伴自动投工、雇工与成品到货、完工判定 */
export function grantCompanionLabor(run: RunState): string[] {
  const notes: string[] = [];
  const helpers = run.survivors.filter((s) => s.conditions.length === 0 && s.morale > 25);
  const diyProjects = run.projects.filter((p) => p.path === 'diy');
  if (helpers.length > 0 && diyProjects.length > 0) {
    const perProject = Math.floor((helpers.length * AP.COMPANION_LABOR) / diyProjects.length);
    if (perProject > 0) {
      let applied = 0;
      let skipped = false;
      for (const p of diyProjects) {
        const spec = moduleSpec(p.moduleId, p.toLevel);
        if (p.payAsYouGo && spec) {
          const portion = portionForGain(spec, p.laborTotal, p.laborDone, perProject);
          if (run.res.materials < portion.materials || run.res.parts < portion.parts) {
            skipped = true;
            continue;
          }
          run.res.materials -= portion.materials;
          run.res.parts -= portion.parts;
        }
        p.laborDone += perProject;
        applied += perProject;
      }
      if (applied > 0) notes.push(t('ledger.build.companion', { n: applied }));
      if (skipped) notes.push(t('ledger.build.companionSkip'));
    }
  }
  return notes;
}

/** 立刻检查完工（玩家投工后调用；不含同伴工时） */
export function completeReadyProjects(run: RunState, rng: Rng): string[] {
  const notes: string[] = [];

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
          notes.push(t('ledger.build.noDelivery', { name: MODULE_BY_ID[p.moduleId].name }));
          addLog(
            run,
            t('ledger.build.noDeliveryLog', { name: MODULE_BY_ID[p.moduleId].name }),
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
    notes.push(t('ledger.build.done', { name, lvl: p.toLevel }));
    addLog(run, t('ledger.build.doneLog', { name, desc: spec?.desc ?? '' }), 'good');
    if (p.moduleId === 'filter' || p.moduleId === 'airFilter') {
      run.wear.filterLife = Math.max(run.wear.filterLife, WEAR.FILTER_RESTORE);
    }
    if (p.moduleId === 'power' && p.toLevel >= 3) {
      run.wear.generatorOil = Math.max(run.wear.generatorOil, WEAR.GENERATOR_OIL);
    }
  }

  return notes;
}

export function advanceProjects(run: RunState, rng: Rng): string[] {
  return [...grantCompanionLabor(run), ...completeReadyProjects(run, rng)];
}

export function cancelProject(run: RunState, id: ModuleId): void {
  const p = run.projects.find((x) => x.moduleId === id);
  if (!p) return;
  run.projects = run.projects.filter((x) => x !== p);
  if (p.path === 'diy') {
    const spec = moduleSpec(p.moduleId, p.toLevel);
    if (spec) {
      if (p.payAsYouGo) {
        // 只退已成功投入部分的一半
        const spentMat = materialShare(spec.materials, p.laborDone, p.laborTotal);
        const spentParts = materialShare(spec.parts, p.laborDone, p.laborTotal);
        run.res.materials += Math.floor(spentMat * 0.5);
        run.res.parts += Math.floor(spentParts * 0.5);
      } else {
        // 旧存档：开工已预扣全额，按原规则退一半
        run.res.materials += Math.floor(spec.materials * 0.5);
        run.res.parts += Math.floor(spec.parts * 0.5);
      }
    }
    addLog(run, t('ledger.build.cancel', { name: MODULE_BY_ID[id].name }), 'bad');
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
    name: t('ledger.salvage.furniture.name'),
    desc: t('ledger.salvage.furniture.desc'),
    materials: [3, 7],
    parts: [0, 2],
    exposure: 1,
    humanity: 0,
  },
  {
    id: 'car',
    name: t('ledger.salvage.car.name'),
    desc: t('ledger.salvage.car.desc'),
    materials: [1, 3],
    parts: [4, 9],
    exposure: EXPOSURE.SRC_SALVAGE,
    humanity: 0,
  },
  {
    id: 'empty_flat',
    name: t('ledger.salvage.empty_flat.name'),
    desc: t('ledger.salvage.empty_flat.desc'),
    materials: [5, 12],
    parts: [2, 6],
    exposure: 8,
    humanity: -8,
  },
  {
    id: 'public',
    name: t('ledger.salvage.public.name'),
    desc: t('ledger.salvage.public.desc'),
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
    name: t('ledger.build.maintFilter'),
    desc: t('ledger.build.maintFilterDesc'),
    parts: filterParts,
    available: hasFilters && run.res.parts >= filterParts && run.ap >= 1,
    reason: !hasFilters
      ? t('ledger.build.maintNoFilter')
      : run.res.parts < filterParts
        ? t('ledger.build.lackParts', { n: Math.ceil(filterParts - run.res.parts) })
        : run.ap < 1
          ? t('ledger.build.needAp')
          : undefined,
    remaining: Math.max(0, Math.round(run.wear.filterLife)),
  });

  const hasGen = run.modules.power >= 3;
  out.push({
    kind: 'oil',
    name: t('ledger.build.maintOil'),
    desc: t('ledger.build.maintOilDesc'),
    parts: WEAR.OIL_PARTS,
    available: hasGen && run.res.parts >= WEAR.OIL_PARTS && run.ap >= 1,
    reason: !hasGen
      ? t('ledger.build.maintNoGen')
      : run.res.parts < WEAR.OIL_PARTS
        ? t('ledger.build.lackParts', { n: Math.ceil(WEAR.OIL_PARTS - run.res.parts) })
        : run.ap < 1
          ? t('ledger.build.needAp')
          : undefined,
    remaining: Math.max(0, Math.round(run.wear.generatorOil)),
  });

  return out;
}

export function doMaintenance(run: RunState, kind: MaintenanceKind): { ok: boolean; reason?: string; note?: string } {
  const opt = maintenanceOptions(run).find((o) => o.kind === kind);
  if (!opt || !opt.available) return { ok: false, reason: opt?.reason ?? t('ledger.toast.noMaint') };

  run.ap -= 1;
  run.res.parts -= opt.parts;
  run.stats.stamina = Math.max(0, run.stats.stamina - STAMINA.CHORE);

  if (kind === 'filter') {
    let restore: number = WEAR.FILTER_RESTORE;
    if (run.abilities.includes('perk_maintainer')) restore = Math.round(restore * 1.5);
    run.wear.filterLife += restore;
    return { ok: true, note: t('ledger.build.filterDone', { days: Math.round(run.wear.filterLife) }) };
  }
  run.wear.generatorOil += WEAR.GENERATOR_OIL;
  return { ok: true, note: t('ledger.build.oilDone') };
}

export function doSalvage(run: RunState, targetId: string, rng: Rng): { ok: boolean; reason?: string; note?: string } {
  if (run.day < TIME.COLLAPSE_DAY) return { ok: false, reason: t('ledger.build.salvagePrep') };
  const target = SALVAGE_TARGETS.find((x) => x.id === targetId);
  if (!target) return { ok: false, reason: t('ledger.build.noTarget') };
  if (run.ap < 1) return { ok: false, reason: t('ledger.build.noAp') };

  run.ap -= 1;
  run.stats.stamina = Math.max(0, run.stats.stamina - STAMINA.BUILD);

  const mats = rng.int(target.materials[0], target.materials[1]);
  const parts = rng.int(target.parts[0], target.parts[1]);
  run.res.materials += mats;
  run.res.parts += parts;
  run.world.exposure = Math.min(EXPOSURE.MAX, run.world.exposure + target.exposure);
  if (target.humanity) run.stats.humanity = Math.max(0, run.stats.humanity + target.humanity);
  if (target.id === 'empty_flat') {
    run.world.neighborhood = Math.max(-100, run.world.neighborhood - 12);
    if (!run.flags.includes('flag:lootedNeighbor')) run.flags.push('flag:lootedNeighbor');
  }

  return { ok: true, note: t('ledger.build.salvageOut', { mat: mats, parts, exp: target.exposure }) };
}
