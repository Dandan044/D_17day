import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { STAMINA, TIME } from './balance';
import { CLASS_BY_ID } from './content/classes';
import { ENDING_BY_ID } from './content/endings';
import { FAMILY_BY_ID } from './content/events';
import { LOCATION_BY_ID } from './content/locations';
import { PERK_BY_ID, UNLOCK_COST } from './content/perks';
import {
  advanceProjects,
  cancelProject as engineCancelProject,
  doMaintenance,
  doSalvage,
  investLabor as engineInvestLabor,
  startProject,
  type MaintenanceKind,
} from './engine/construction';
import { addLog, clampResources } from './engine/effects';
import {
  carryCapacity,
  commitHaul,
  drainLocation,
  purchase as enginePurchase,
  rollHaul,
  travelCost,
  type Haul,
  type HaulItem,
} from './engine/economy';
import { settle, resolveEnding, type Settlement } from './engine/endings';
import { treatCondition } from './engine/health';
import {
  acknowledgeCollapse as engineAckCollapse,
  chooseSite as engineChooseSite,
  createRun,
  endDay as engineEndDay,
  resolveChoice as engineResolveChoice,
  verifyIntel as engineVerifyIntel,
  type NightReport,
  type ResolveChoiceResult,
} from './engine/run';
import { makeRng, randomSeed } from './rng';
import type {
  BuildPath,
  ConditionId,
  Difficulty,
  MetaState,
  ModuleId,
  PowerMode,
  RationLevel,
  ResourceId,
  RunState,
  SiteId,
  WaterLevel,
} from './types';

export type Overlay = null | 'shelter' | 'crew' | 'log' | 'intel' | 'map' | 'power' | 'codex' | 'meta' | 'help';
export type Screen = 'menu' | 'setup' | 'game' | 'summary';

export interface Toast {
  id: number;
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

const EMPTY_META: MetaState = {
  relics: 0,
  unlocked: [],
  perks: [],
  seenFamilies: [],
  seenVariants: [],
  seenEndings: [],
  seenDisasters: [],
  runsPlayed: 0,
  bestDays: 0,
  lastClassId: 'clerk',
  difficulty: 'normal',
};

interface GameState {
  run: RunState | null;
  meta: MetaState;
  screen: Screen;
  overlay: Overlay;
  nightReport: NightReport | null;
  lastChoice: (ResolveChoiceResult & { title: string }) | null;
  haul: Haul | null;
  openShop: string | null;
  settlement: Settlement | null;
  toasts: Toast[];

  // --- 流程 ---
  goMenu: () => void;
  goSetup: () => void;
  startRun: (classId: string, packId: string, difficulty: Difficulty, seed?: number) => void;
  chooseSite: (siteId: SiteId) => void;
  abandonRun: () => void;
  endDay: () => void;
  /** 清掉指向已不存在家族/变体的队列项：否则玩家既看不到选项，也结束不了这一天 */
  pruneQueue: () => void;
  dismissNight: () => void;
  acknowledgeCollapse: () => void;
  claimSettlement: () => void;

  // --- 事件 ---
  resolveChoice: (familyId: string, variantId: string, choiceId: string) => void;
  dismissChoice: () => void;

  // --- 行动 ---
  scavenge: (locationId: string, night: boolean) => void;
  takeHaul: (picked: HaulItem[]) => void;
  discardHaul: () => void;
  visitShop: (locationId: string) => void;
  closeShop: () => void;
  buy: (locationId: string, res: ResourceId, qty: number) => void;
  rest: () => void;
  build: (moduleId: ModuleId, path: BuildPath) => void;
  work: (moduleId: ModuleId) => void;
  cancelProject: (moduleId: ModuleId) => void;
  salvage: (targetId: string) => void;
  maintain: (kind: MaintenanceKind) => void;
  treat: (conditionId: ConditionId) => void;
  verifyIntel: (intelId: string) => void;

  // --- 设置 ---
  setRation: (r: RationLevel) => void;
  setWaterUse: (w: WaterLevel) => void;
  setPowerMode: (p: PowerMode) => void;
  setPowerPriority: (order: ModuleId[]) => void;
  setDifficulty: (d: Difficulty) => void;

  // --- 局外 ---
  buyUnlock: (id: string) => void;
  buyPerk: (id: string) => void;
  resetMeta: () => void;

  // --- UI ---
  setOverlay: (o: Overlay) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  dropToast: (id: number) => void;
}

let toastSeq = 1;

export const useGame = create<GameState>()(
  persist(
    (set, get) => {
      /** 就地修改 run 后触发一次渲染 */
      const mutate = (fn: (run: RunState) => void) => {
        const run = get().run;
        if (!run) return;
        const next = structuredClone(run) as RunState;
        fn(next);
        set({ run: next });
      };

      const pushToast = (text: string, tone: Toast['tone'] = 'neutral') => {
        const t: Toast = { id: toastSeq++, text, tone };
        set({ toasts: [...get().toasts, t] });
        setTimeout(() => get().dropToast(t.id), 3600);
      };

      return {
        run: null,
        meta: EMPTY_META,
        screen: 'menu',
        overlay: null,
        nightReport: null,
        lastChoice: null,
        haul: null,
        openShop: null,
        settlement: null,
        toasts: [],

        // ============================================================
        goMenu: () => set({ screen: 'menu', overlay: null }),
        goSetup: () => set({ screen: 'setup', overlay: null }),

        startRun: (classId, packId, difficulty, seed) => {
          const meta = get().meta;
          const run = createRun({
            seed: seed ?? randomSeed(),
            classId,
            packId,
            difficulty,
            metaPerks: meta.perks,
          });
          set({
            run,
            screen: 'game',
            overlay: null,
            nightReport: null,
            lastChoice: null,
            haul: null,
            settlement: null,
            meta: { ...meta, lastClassId: classId, difficulty, runsPlayed: meta.runsPlayed + 1 },
          });
        },

        chooseSite: (siteId) => {
          const run = get().run;
          if (!run) return;
          const next = structuredClone(run) as RunState;
          const r = engineChooseSite(next, siteId);
          if (!r.ok) {
            pushToast(r.reason ?? '无法选择这个站点', 'bad');
            return;
          }
          set({ run: next });
        },

        abandonRun: () => {
          const run = get().run;
          if (!run) {
            set({ screen: 'menu' });
            return;
          }
          const next = structuredClone(run) as RunState;
          const ending = resolveEnding(next, '放弃');
          next.endingId = ending.id;
          next.phase = 'ended';
          set({ run: next, settlement: settle(next, ending, get().meta), screen: 'summary' });
        },

        endDay: () => {
          const run = get().run;
          if (!run) return;
          if (run.queue.length > 0) {
            pushToast('还有事情等着你处理', 'bad');
            return;
          }
          const next = structuredClone(run) as RunState;
          const report = engineEndDay(next);
          if (next.phase === 'ended') {
            const ending = resolveEnding(next, report.cause);
            next.endingId = ending.id;
            set({ run: next, nightReport: report, settlement: settle(next, ending, get().meta) });
          } else {
            set({ run: next, nightReport: report });
          }
        },

        /**
         * 队列里若留有指向已删除家族/变体的条目，EventCard 会渲染成 null，
         * 而「结束这一天」又被队列长度拦住——玩家两头堵死，只能清 localStorage。
         * 改过内容再载入旧存档就会撞上，所以每次进入游戏前先扫一遍。
         */
        pruneQueue: () => {
          mutate((r) => void pruneOrphanQueue(r));
        },

        dismissNight: () => {
          const { run } = get();
          set({ nightReport: null });
          if (run?.phase === 'ended') set({ screen: 'summary' });
        },

        acknowledgeCollapse: () => {
          mutate((r) => engineAckCollapse(r));
        },

        claimSettlement: () => {
          const { settlement, meta, run } = get();
          if (!settlement || !run) {
            set({ screen: 'menu', run: null, settlement: null });
            return;
          }
          const nextMeta: MetaState = {
            ...meta,
            relics: meta.relics + settlement.relics,
            unlocked: [...new Set([...meta.unlocked, ...settlement.newUnlocks])],
            seenFamilies: [...new Set([...meta.seenFamilies, ...Object.keys(run.eventHistory)])],
            seenEndings: [...new Set([...meta.seenEndings, settlement.ending.id])],
            seenDisasters: [...new Set([...meta.seenDisasters, run.world.disaster])],
            bestDays: Math.max(meta.bestDays, settlement.daysSurvived),
          };
          set({ meta: nextMeta, run: null, settlement: null, screen: 'menu' });
        },

        // ============================================================
        resolveChoice: (familyId, variantId, choiceId) => {
          const run = get().run;
          if (!run) return;
          const next = structuredClone(run) as RunState;
          const result = engineResolveChoice(next, familyId, variantId, choiceId);
          const last = next.log[next.log.length - 1];
          const patch: Partial<GameState> = {
            run: next,
            lastChoice: { ...result, title: last?.text ?? '' },
          };
          // 破门是唯一能当场致死的事件，所以这里也要能收尾
          if (next.phase === 'ended') {
            const ending = next.endingId ? ENDING_BY_ID[next.endingId] : undefined;
            if (ending) patch.settlement = settle(next, ending, get().meta);
          }
          set(patch);
        },

        dismissChoice: () => {
          const run = get().run;
          set({ lastChoice: null });
          if (run?.phase === 'ended') set({ screen: 'summary' });
        },

        // ============================================================
        scavenge: (locationId, night) => {
          const run = get().run;
          if (!run) return;
          const loc = LOCATION_BY_ID[locationId];
          if (!loc) return;
          if (run.ap < 1) {
            pushToast('行动点不足', 'bad');
            return;
          }
          if (loc.needsVehicle && !run.hasVehicle) {
            pushToast('太远了，没有车去不了', 'bad');
            return;
          }
          const next = structuredClone(run) as RunState;
          const rng = makeRng(next.seed, next.rngCursor);
          const cost = travelCost(next, loc);
          next.ap -= 1;
          next.stats.stamina = Math.max(0, next.stats.stamina - cost.stamina);
          next.res.fuel = Math.max(0, next.res.fuel - cost.fuel);
          const haul = rollHaul(next, locationId, night, rng, next.difficulty);
          drainLocation(next, locationId);
          next.stats_meta.scavengeRuns += 1;
          if (!next.visitedToday.includes(locationId)) next.visitedToday.push(locationId);
          next.rngCursor = rng.cursor();
          set({ run: next, haul });
        },

        takeHaul: (picked) => {
          const run = get().run;
          const haul = get().haul;
          if (!run || !haul) return;
          const next = structuredClone(run) as RunState;
          commitHaul(next, picked);
          clampResources(next);
          const total = picked.reduce((s, p) => s + p.amount, 0);
          if (total > 0) {
            addLog(
              next,
              `你从${LOCATION_BY_ID[haul.locationId]?.name ?? '外面'}带回了一些东西。`,
              'good',
            );
          }
          set({ run: next, haul: null });
        },

        discardHaul: () => set({ haul: null }),

        visitShop: (locationId) => {
          const run = get().run;
          if (!run) return;
          if (run.visitedToday.includes(locationId)) {
            set({ openShop: locationId });
            return;
          }
          if (run.ap < 1) {
            pushToast('行动点不足', 'bad');
            return;
          }
          const next = structuredClone(run) as RunState;
          next.ap -= 1;
          next.stats.stamina = Math.max(0, next.stats.stamina - STAMINA.CHORE);
          next.visitedToday.push(locationId);
          set({ run: next, openShop: locationId });
        },

        closeShop: () => set({ openShop: null }),

        buy: (locationId, res, qty) => {
          const run = get().run;
          if (!run) return;
          const next = structuredClone(run) as RunState;
          const hasClerk = next.abilities.includes('clerk_network');
          const r = enginePurchase(next, locationId, res, qty, hasClerk);
          if (!r.ok) {
            pushToast(r.reason ?? '买不到', 'bad');
            return;
          }
          const st = next.locations.find((l) => l.id === locationId);
          if (st) st.stock = Math.max(0, st.stock - 6);
          clampResources(next);
          set({ run: next });
          pushToast(`买到 ${r.got}，花了 ${r.spent} 元`, 'good');
        },

        rest: () => {
          const run = get().run;
          if (!run || run.ap < 1) {
            pushToast('行动点不足', 'bad');
            return;
          }
          mutate((r) => {
            r.ap -= 1;
            r.stats.stamina = Math.min(100, r.stats.stamina + STAMINA.REST_ACTION);
            r.stats.sanity = Math.min(100, r.stats.sanity + 4);
          });
          pushToast('你歇了一会儿', 'good');
        },

        build: (moduleId, path) => {
          const run = get().run;
          if (!run) return;
          const next = structuredClone(run) as RunState;
          const r = startProject(next, moduleId, path);
          if (!r.ok) {
            pushToast(r.reason ?? '无法开工', 'bad');
            return;
          }
          set({ run: next });
        },

        work: (moduleId) => {
          const run = get().run;
          if (!run) return;
          const next = structuredClone(run) as RunState;
          const rng = makeRng(next.seed, next.rngCursor);
          const r = engineInvestLabor(next, moduleId, rng);
          next.rngCursor = rng.cursor();
          if (!r.ok) {
            pushToast(r.reason ?? '无法施工', 'bad');
            return;
          }
          // 立刻检查是否完工
          const done = advanceProjects(next, rng);
          next.rngCursor = rng.cursor();
          set({ run: next });
          if (r.note) pushToast(r.note, r.note.includes('浪费') ? 'bad' : 'neutral');
          for (const d of done) pushToast(d, 'good');
        },

        cancelProject: (moduleId) => {
          mutate((r) => engineCancelProject(r, moduleId));
        },

        salvage: (targetId) => {
          const run = get().run;
          if (!run) return;
          const next = structuredClone(run) as RunState;
          const rng = makeRng(next.seed, next.rngCursor);
          const r = doSalvage(next, targetId, rng);
          next.rngCursor = rng.cursor();
          if (!r.ok) {
            pushToast(r.reason ?? '不能这么做', 'bad');
            return;
          }
          set({ run: next });
          if (r.note) pushToast(r.note, 'neutral');
        },

        maintain: (kind) => {
          const run = get().run;
          if (!run) return;
          const next = structuredClone(run) as RunState;
          const r = doMaintenance(next, kind);
          if (!r.ok) {
            pushToast(r.reason ?? '现在不能做', 'bad');
            return;
          }
          set({ run: next });
          if (r.note) pushToast(r.note, 'good');
        },

        treat: (conditionId) => {
          const run = get().run;
          if (!run) return;
          const next = structuredClone(run) as RunState;
          const r = treatCondition(next, conditionId);
          if (!r.ok) {
            pushToast(r.reason ?? '治不了', 'bad');
            return;
          }
          set({ run: next });
          pushToast('处理完了', 'good');
        },

        verifyIntel: (intelId) => {
          const run = get().run;
          if (!run) return;
          const next = structuredClone(run) as RunState;
          const r = engineVerifyIntel(next, intelId);
          if (!r.ok) {
            pushToast(r.reason ?? '无法核实', 'bad');
            return;
          }
          set({ run: next });
        },

        // ============================================================
        setRation: (ration) => mutate((r) => void (r.ration = ration)),
        setWaterUse: (waterUse) => mutate((r) => void (r.waterUse = waterUse)),
        setPowerMode: (powerMode) => mutate((r) => void (r.powerMode = powerMode)),
        setPowerPriority: (order) => mutate((r) => void (r.powerPriority = order)),
        setDifficulty: (difficulty) => set({ meta: { ...get().meta, difficulty } }),

        // ============================================================
        buyUnlock: (id) => {
          const meta = get().meta;
          const cost = UNLOCK_COST[id] ?? 999999;
          if (meta.unlocked.includes(id)) return;
          if (meta.relics < cost) {
            pushToast('遗物不够', 'bad');
            return;
          }
          set({ meta: { ...meta, relics: meta.relics - cost, unlocked: [...meta.unlocked, id] } });
          pushToast('已解锁', 'good');
        },

        buyPerk: (id) => {
          const meta = get().meta;
          const perk = PERK_BY_ID[id];
          if (!perk || meta.perks.includes(id)) return;
          if (perk.requires && !perk.requires.every((r) => meta.perks.includes(r))) {
            pushToast('需要先点前置天赋', 'bad');
            return;
          }
          if (meta.relics < perk.cost) {
            pushToast('遗物不够', 'bad');
            return;
          }
          set({ meta: { ...meta, relics: meta.relics - perk.cost, perks: [...meta.perks, id] } });
          pushToast(`已获得：${perk.name}`, 'good');
        },

        resetMeta: () => set({ meta: EMPTY_META }),

        // ============================================================
        setOverlay: (overlay) => set({ overlay }),
        toast: (text, tone = 'neutral') => pushToast(text, tone),
        dropToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
      };
    },
    {
      name: 'seven-days-save-v1',
      partialize: (s) => ({ run: s.run, meta: s.meta, screen: s.screen }),
    },
  ),
);

// ============================================================
// 派生选择器
// ============================================================

export function currentClassName(run: RunState | null): string {
  if (!run) return '';
  return CLASS_BY_ID[run.classId]?.name ?? run.classId;
}

export function isPrep(run: RunState | null): boolean {
  return !!run && run.day < TIME.COLLAPSE_DAY;
}

export function carryCap(run: RunState): number {
  return carryCapacity(run, run.abilities.includes('trucker_vehicle'));
}

// ============================================================
// 存档自愈
//
// settlement 不进持久化，但路由依赖它存在；队列里也可能留着指向已删除
// 内容的条目。这两件事都只有在「刷新后」或「改过内容后」才出现，
// 手工测一次就忘，所以抽成纯函数，让 scripts/verify-p0.ts 能打在真实代码上。
// ============================================================

/**
 * 按 run.endingId 重算一份结算数据。
 * claimSettlement 会清空 run，所以不存在「已领过又被重建」导致遗物算两遍的情况。
 */
export function rebuildSettlement(run: RunState | null, meta: MetaState): Settlement | null {
  if (!run || run.phase !== 'ended') return null;
  const ending = (run.endingId ? ENDING_BY_ID[run.endingId] : undefined) ?? ENDING_BY_ID['death_generic'];
  return ending ? settle(run, ending, meta) : null;
}

/**
 * 清掉指向已不存在家族/变体的队列项，返回剔除条数。
 * 不清的话 EventCard 渲染成 null，而「结束这一天」又被队列长度拦住——玩家两头堵死。
 */
export function pruneOrphanQueue(run: RunState): number {
  if (run.queue.length === 0) return 0;
  const kept = run.queue.filter((q) => {
    const f = FAMILY_BY_ID[q.familyId];
    return !!f && f.variants.some((v) => v.id === q.variantId);
  });
  const dropped = run.queue.length - kept.length;
  if (dropped === 0) return 0;
  run.queue = kept;
  addLog(run, `${dropped} 件事没有下文，像是被谁忘了。`, 'neutral');
  return dropped;
}
