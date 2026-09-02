import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import './copy';
import { t } from './copy/t';

import { HEALTH, STAMINA, TIME } from './balance';
import { CLASS_BY_ID } from './content/classes';
import { ENDING_BY_ID } from './content/endings';
import { FAMILY_BY_ID } from './content/events';
import { LOCATION_BY_ID } from './content/locations';
import { PERK_BY_ID, UNLOCK_COST } from './content/perks';
import {
  completeReadyProjects,
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
  buyIodine as engineBuyIodine,
  type Haul,
  type HaulItem,
} from './engine/economy';
import { settle, resolveEnding, type Settlement } from './engine/endings';
import { applyScavengeDanger } from './engine/exposure';
import { treatCondition } from './engine/health';
import { emitHook } from './engine/hooks';
import { ensureRunDefaults } from './engine/power';
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
  HeatMode,
  MetaState,
  ModuleId,
  PowerLoadId,
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
  buyIodine: (locationId: string) => void;
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
  setHeatMode: (h: HeatMode) => void;
  setHeatTarget: (n: number) => void;
  setPowerMode: (p: PowerMode) => void;
  setPowerPriority: (order: PowerLoadId[]) => void;
  togglePowerLoad: (id: PowerLoadId, on: boolean) => void;
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
          ensureRunDefaults(run);
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
            pushToast(r.reason ?? t('ledger.toast.noSite'), 'bad');
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
          const ending = resolveEnding(next, t('ledger.cause.abandon'));
          next.endingId = ending.id;
          next.phase = 'ended';
          set({ run: next, settlement: settle(next, ending, get().meta), screen: 'summary' });
        },

        endDay: () => {
          const run = get().run;
          if (!run) return;
          if (run.queue.length > 0) {
            pushToast(t('ledger.toast.queue'), 'bad');
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
          const run = get().run;
          if (!run) return;
          const next = structuredClone(run) as RunState;
          const dropped = pruneOrphanQueue(next);
          // 没丢掉任何条目就不要 set：App 里有个依赖 `run` 的 effect 会再调这里，
          // 每次 set 新引用就会死循环，点「结束这一天」后整页空白。
          if (dropped > 0) set({ run: next });
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
            seenVariants: [...new Set([...meta.seenVariants, ...(run.seenVariants ?? [])])],
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
          const meta = get().meta;
          const seenKey = `${familyId}/${variantId}`;
          const patch: Partial<GameState> = {
            run: next,
            lastChoice: { ...result, title: last?.text ?? '' },
            meta: {
              ...meta,
              seenFamilies: meta.seenFamilies.includes(familyId)
                ? meta.seenFamilies
                : [...meta.seenFamilies, familyId],
              seenVariants: meta.seenVariants.includes(seenKey)
                ? meta.seenVariants
                : [...meta.seenVariants, seenKey],
            },
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
          if (run.day < TIME.COLLAPSE_DAY) {
            pushToast(t('ledger.toast.shopOpen'), 'bad');
            return;
          }
          const loc = LOCATION_BY_ID[locationId];
          if (!loc) return;
          if (run.ap < 1) {
            pushToast(t('ledger.toast.noAp'), 'bad');
            return;
          }
          if (loc.needsVehicle && !run.hasVehicle) {
            pushToast(t('ledger.toast.needCar'), 'bad');
            return;
          }
          const shelf = run.locations.find((l) => l.id === locationId)?.stock ?? loc.stock;
          if (shelf <= 0) {
            pushToast(t('ledger.toast.empty'), 'bad');
            return;
          }
          const cost = travelCost(run, loc);
          if (cost.fuel > 0 && run.res.fuel < cost.fuel) {
            pushToast(t('ledger.toast.needFuel', { fuel: cost.fuel }), 'bad');
            return;
          }
          if (run.stats.stamina < Math.min(12, cost.stamina * 0.5)) {
            pushToast(t('ledger.toast.tired'), 'bad');
            return;
          }
          const next = structuredClone(run) as RunState;
          const rng = makeRng(next.seed, next.rngCursor);
          next.ap -= 1;
          next.stats.stamina = Math.max(0, next.stats.stamina - cost.stamina);
          next.res.fuel = Math.max(0, next.res.fuel - cost.fuel);
          const haul = rollHaul(next, locationId, night, rng, next.difficulty);
          const risk = applyScavengeDanger(next, haul, rng);
          drainLocation(next, locationId);
          next.stats_meta.scavengeRuns += 1;
          if (!next.visitedToday.includes(locationId)) next.visitedToday.push(locationId);
          emitHook(next, 'scavenge', rng);
          emitHook(next, night ? 'scavengeNight' : 'scavengeDay', rng);
          next.rngCursor = rng.cursor();
          set({ run: next, haul });
          if (risk.exposure > 0) pushToast(t('ledger.toast.exposure', { n: risk.exposure }), risk.exposure >= 6 ? 'bad' : 'neutral');
          if (risk.hpLost > 0) pushToast(t('ledger.toast.hurt', { n: risk.hpLost }), 'bad');
          if (risk.lostRes && risk.lostAmt) pushToast(t('ledger.toast.droppedLoot'), 'bad');
          if (risk.scheduledRaid) pushToast(t('ledger.toast.followed'), 'bad');
        },

        takeHaul: (picked) => {
          const run = get().run;
          const haul = get().haul;
          if (!run || !haul) return;
          const next = structuredClone(run) as RunState;
          const haulNotes = commitHaul(next, picked);
          clampResources(next);
          const rng = makeRng(next.seed, next.rngCursor);
          emitHook(next, 'takeHaul', rng);
          next.rngCursor = rng.cursor();
          const total = picked.reduce((s, p) => s + p.amount, 0);
          if (total > 0) {
            addLog(
              next,
              t('ledger.toast.haul', { name: LOCATION_BY_ID[haul.locationId]?.name ?? t('ledger.toast.haulOutside') }),
              'good',
            );
          }
          set({ run: next, haul: null });
          for (const n of haulNotes.notes) pushToast(n, 'bad');
        },

        discardHaul: () => set({ haul: null }),

        visitShop: (locationId) => {
          const run = get().run;
          if (!run) return;
          if (run.visitedToday.includes(locationId)) {
            if (locationId === 'pharmacy' && !run.flags.includes('flag:sawIodineOffer')) {
              mutate((r) => {
                if (!r.flags.includes('flag:sawIodineOffer')) r.flags.push('flag:sawIodineOffer');
              });
            }
            set({ openShop: locationId });
            return;
          }
          if (run.ap < 1) {
            pushToast(t('ledger.toast.noAp'), 'bad');
            return;
          }
          const next = structuredClone(run) as RunState;
          next.ap -= 1;
          next.stats.stamina = Math.max(0, next.stats.stamina - STAMINA.CHORE);
          next.visitedToday.push(locationId);
          if (locationId === 'pharmacy' && !next.flags.includes('flag:sawIodineOffer')) {
            next.flags.push('flag:sawIodineOffer');
          }
          const rng = makeRng(next.seed, next.rngCursor);
          emitHook(next, 'visitShop', rng);
          next.rngCursor = rng.cursor();
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
            pushToast(r.reason ?? t('ledger.toast.buyFail'), 'bad');
            return;
          }
          clampResources(next);
          const rng = makeRng(next.seed, next.rngCursor);
          emitHook(next, 'buy', rng);
          next.rngCursor = rng.cursor();
          set({ run: next });
          if (r.capped && res === 'water') {
            pushToast(t('ledger.toast.buyPartial', { got: r.got, spent: r.spent }), 'neutral');
          } else {
            pushToast(t('ledger.toast.buyOk', { got: r.got, spent: r.spent }), 'good');
          }
        },

        buyIodine: (locationId) => {
          const run = get().run;
          if (!run) return;
          const next = structuredClone(run) as RunState;
          const r = engineBuyIodine(next, locationId);
          if (!r.ok) {
            pushToast(r.reason ?? t('ledger.toast.iodineFail'), 'bad');
            return;
          }
          clampResources(next);
          const rng = makeRng(next.seed, next.rngCursor);
          emitHook(next, 'buy', rng);
          next.rngCursor = rng.cursor();
          set({ run: next });
          pushToast(t('ledger.toast.iodineOk', { spent: r.spent }), 'good');
        },

        rest: () => {
          const run = get().run;
          if (!run || run.ap < 1) {
            pushToast(t('ledger.toast.noAp'), 'bad');
            return;
          }
          mutate((r) => {
            r.ap -= 1;
            const medbay = r.modules.medbay ?? 0;
            const stamBonus = HEALTH.MEDBAY_REST_STAMINA[medbay] ?? 0;
            const sanBonus = HEALTH.MEDBAY_REST_SANITY[medbay] ?? 0;
            const hpBonus = HEALTH.MEDBAY_REST_HP[medbay] ?? 0;
            r.stats.stamina = Math.min(100, r.stats.stamina + STAMINA.REST_ACTION + stamBonus);
            r.stats.sanity = Math.min(100, r.stats.sanity + 4 + sanBonus);
            if (hpBonus > 0) r.stats.hp = Math.min(100, r.stats.hp + hpBonus);
            const rng = makeRng(r.seed, r.rngCursor);
            emitHook(r, 'rest', rng);
            r.rngCursor = rng.cursor();
          });
          const medbay = run.modules.medbay ?? 0;
          const hpBonus = HEALTH.MEDBAY_REST_HP[medbay] ?? 0;
          pushToast(
            hpBonus > 0 ? t('ledger.toast.restHeal') : t('ledger.toast.rest'),
            'good',
          );
        },

        build: (moduleId, path) => {
          const run = get().run;
          if (!run) return;
          const next = structuredClone(run) as RunState;
          const r = startProject(next, moduleId, path);
          if (!r.ok) {
            pushToast(r.reason ?? t('ledger.toast.noBuild'), 'bad');
            return;
          }
          const rng = makeRng(next.seed, next.rngCursor);
          emitHook(next, 'build', rng);
          next.rngCursor = rng.cursor();
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
            pushToast(r.reason ?? t('ledger.toast.noWork'), 'bad');
            return;
          }
          // 立刻检查是否完工
          const done = completeReadyProjects(next, rng);
          emitHook(next, 'work', rng);
          next.rngCursor = rng.cursor();
          set({ run: next });
          if (r.note) pushToast(r.note, r.note.includes('浪费') ? 'bad' : 'neutral');
          for (const d of done) pushToast(d, 'good');
        },

        cancelProject: (moduleId) => {
          mutate((r) => {
            engineCancelProject(r, moduleId);
            const rng = makeRng(r.seed, r.rngCursor);
            emitHook(r, 'cancelProject', rng);
            r.rngCursor = rng.cursor();
          });
        },

        salvage: (targetId) => {
          const run = get().run;
          if (!run) return;
          const next = structuredClone(run) as RunState;
          const rng = makeRng(next.seed, next.rngCursor);
          const r = doSalvage(next, targetId, rng);
          next.rngCursor = rng.cursor();
          if (!r.ok) {
            pushToast(r.reason ?? t('ledger.toast.noSalvage'), 'bad');
            return;
          }
          emitHook(next, 'salvage', rng);
          next.rngCursor = rng.cursor();
          set({ run: next });
          if (r.note) pushToast(r.note, 'neutral');
        },

        maintain: (kind) => {
          const run = get().run;
          if (!run) return;
          const next = structuredClone(run) as RunState;
          const r = doMaintenance(next, kind);
          if (!r.ok) {
            pushToast(r.reason ?? t('ledger.toast.noMaint'), 'bad');
            return;
          }
          const rng = makeRng(next.seed, next.rngCursor);
          emitHook(next, 'maintain', rng);
          next.rngCursor = rng.cursor();
          set({ run: next });
          if (r.note) pushToast(r.note, 'good');
        },

        treat: (conditionId) => {
          const run = get().run;
          if (!run) return;
          const next = structuredClone(run) as RunState;
          const r = treatCondition(next, conditionId);
          if (!r.ok) {
            pushToast(r.reason ?? t('ledger.toast.noTreat'), 'bad');
            return;
          }
          const rng = makeRng(next.seed, next.rngCursor);
          emitHook(next, 'treat', rng);
          next.rngCursor = rng.cursor();
          set({ run: next });
          pushToast(t('ledger.toast.treated'), 'good');
        },

        verifyIntel: (intelId) => {
          const run = get().run;
          if (!run) return;
          const next = structuredClone(run) as RunState;
          const r = engineVerifyIntel(next, intelId);
          if (!r.ok) {
            pushToast(r.reason ?? t('ledger.toast.noIntel'), 'bad');
            return;
          }
          const rng = makeRng(next.seed, next.rngCursor);
          emitHook(next, 'verifyIntel', rng);
          next.rngCursor = rng.cursor();
          set({ run: next });
        },

        // ============================================================
        setRation: (ration) =>
          mutate((r) => {
            r.ration = ration;
            const rng = makeRng(r.seed, r.rngCursor);
            emitHook(r, 'setRation', rng);
            r.rngCursor = rng.cursor();
          }),
        setWaterUse: (waterUse) =>
          mutate((r) => {
            r.waterUse = waterUse;
            const rng = makeRng(r.seed, r.rngCursor);
            emitHook(r, 'setWaterUse', rng);
            r.rngCursor = rng.cursor();
          }),
        setPowerMode: (powerMode) =>
          mutate((r) => {
            r.powerMode = powerMode;
            const rng = makeRng(r.seed, r.rngCursor);
            emitHook(r, 'setPowerMode', rng);
            emitHook(r, 'setPowerPriority', rng);
            r.rngCursor = rng.cursor();
          }),
        setHeatMode: (heatMode) =>
          mutate((r) => {
            r.heatMode = heatMode;
            const rng = makeRng(r.seed, r.rngCursor);
            emitHook(r, 'setHeatMode', rng);
            r.rngCursor = rng.cursor();
          }),
        setHeatTarget: (heatTarget) =>
          mutate((r) => {
            r.heatTarget = heatTarget;
          }),
        setPowerPriority: (order) =>
          mutate((r) => {
            r.powerPriority = order;
            const rng = makeRng(r.seed, r.rngCursor);
            emitHook(r, 'setPowerPriority', rng);
            emitHook(r, 'setPowerMode', rng);
            r.rngCursor = rng.cursor();
          }),
        togglePowerLoad: (id, on) =>
          mutate((r) => {
            if (!r.powerEnabled) r.powerEnabled = {};
            r.powerEnabled[id] = on;
            const rng = makeRng(r.seed, r.rngCursor);
            emitHook(r, 'setPowerPriority', rng);
            emitHook(r, 'setPowerMode', rng);
            r.rngCursor = rng.cursor();
          }),
        setDifficulty: (difficulty) => set({ meta: { ...get().meta, difficulty } }),

        // ============================================================
        buyUnlock: (id) => {
          const meta = get().meta;
          const cost = UNLOCK_COST[id] ?? 999999;
          if (meta.unlocked.includes(id)) return;
          if (meta.relics < cost) {
            pushToast(t('ledger.toast.noRelic'), 'bad');
            return;
          }
          set({ meta: { ...meta, relics: meta.relics - cost, unlocked: [...meta.unlocked, id] } });
          pushToast(t('ledger.toast.unlocked'), 'good');
        },

        buyPerk: (id) => {
          const meta = get().meta;
          const perk = PERK_BY_ID[id];
          if (!perk || perk.wip || meta.perks.includes(id)) return;
          if (perk.requires && !perk.requires.every((r) => meta.perks.includes(r))) {
            pushToast(t('ledger.toast.perkReq'), 'bad');
            return;
          }
          if (meta.relics < perk.cost) {
            pushToast(t('ledger.toast.noRelic'), 'bad');
            return;
          }
          set({ meta: { ...meta, relics: meta.relics - perk.cost, perks: [...meta.perks, id] } });
          pushToast(t('ledger.toast.perkGot', { name: perk.name }), 'good');
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
      version: 2,
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<GameState>;
        if (p.run) ensureRunDefaults(p.run);
        if (p.meta) {
          p.meta.seenVariants = p.meta.seenVariants ?? [];
          p.meta.seenFamilies = p.meta.seenFamilies ?? [];
          p.meta.seenEndings = p.meta.seenEndings ?? [];
          p.meta.seenDisasters = p.meta.seenDisasters ?? [];
        }
        return p as GameState;
      },
      partialize: (s) => ({ run: s.run, meta: s.meta, screen: s.screen }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GameState>;
        if (p.run) ensureRunDefaults(p.run);
        return { ...current, ...p };
      },
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
  addLog(run, t('ledger.run.orphan', { n: dropped }), 'neutral');
  return dropped;
}
