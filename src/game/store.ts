import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';

import './copy';
import { t } from './copy/t';

import { TIME } from './balance';
import { CLASS_BY_ID } from './content/classes';
import { ENDING_BY_ID } from './content/endings';
import { FAMILY_BY_ID } from './content/events';
import { PERK_BY_ID, UNLOCK_COST } from './content/perks';
import { addLog } from './engine/effects';
import { carryCapacity, type Haul, type HaulItem } from './engine/economy';
import { settle, resolveEnding, type Settlement } from './engine/endings';
import { ensureRunDefaults } from './engine/power';
import { createRun, type NightReport, type ResolveChoiceResult } from './engine/run';
import { randomSeed } from './rng';
import {
  acknowledgeCollapse as sessionAckCollapse,
  build as sessionBuild,
  buy as sessionBuy,
  buyCartridge as sessionBuyCartridge,
  buyCoAlarm as sessionBuyCoAlarm,
  buyIodine as sessionBuyIodine,
  cancelProject as sessionCancelProject,
  chooseSite as sessionChooseSite,
  closeShop as sessionCloseShop,
  createSession,
  discardHaul as sessionDiscardHaul,
  endDay as sessionEndDay,
  maintain as sessionMaintain,
  rest as sessionRest,
  resolveChoice as sessionResolveChoice,
  salvage as sessionSalvage,
  scavenge as sessionScavenge,
  setHeatMix as sessionSetHeatMix,
  setHeatMode as sessionSetHeatMode,
  setHeatTarget as sessionSetHeatTarget,
  setPowerMode as sessionSetPowerMode,
  setPowerPriority as sessionSetPowerPriority,
  setRation as sessionSetRation,
  setWaterUse as sessionSetWaterUse,
  takeHaul as sessionTakeHaul,
  togglePowerLoad as sessionTogglePowerLoad,
  medicate as sessionMedicate,
  useItem as sessionUseItem,
  verifyIntel as sessionVerifyIntel,
  visitShop as sessionVisitShop,
  withdraw as sessionWithdraw,
  work as sessionWork,
  type MaintenanceKind,
} from './session';
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

export type Overlay =
  | null
  | 'shelter'
  | 'crew'
  | 'log'
  | 'intel'
  | 'map'
  | 'power'
  | 'items'
  | 'codex'
  | 'meta'
  | 'help'
  | 'plan'
  | 'body'
  | 'supplies';
export type Screen = 'menu' | 'setup' | 'game' | 'summary';
export type GameUi = 'art' | 'classic';

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

// ============================================================
// 存档节流：把「每次 set 都同步 JSON.stringify 整个 run 写 localStorage」
// 合并为 400ms 窗口最多一次（首写起算），页面隐藏/关闭时同步 flush 不丢档。
// 高频 set（toast 进出、取暖滑块拖动）不再每次都阻塞主线程序列化大 JSON。
// ============================================================

const SAVE_KEY = 'seven-days-save-v1';
const FLUSH_DELAY = 400;

interface PersistedSlice {
  run: RunState | null;
  meta: MetaState;
  screen: Screen;
}

function createThrottledStorage(): PersistStorage<PersistedSlice> {
  let pending: StorageValue<PersistedSlice> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pending) return;
    const data = pending;
    pending = null;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // 配额满 / 隐私模式：与 zustand 默认行为一致，静默失败
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  return {
    // 读路径保持同步：模块加载时 rehydrate 的时序不变
    getItem: (name) => {
      const raw = localStorage.getItem(name);
      return raw ? (JSON.parse(raw) as StorageValue<PersistedSlice>) : null;
    },
    setItem: (_name, value) => {
      pending = value;
      if (!timer) timer = setTimeout(flush, FLUSH_DELAY); // 首写起算，不重置：最迟 400ms 必落盘
    },
    removeItem: (name) => {
      flush();
      localStorage.removeItem(name);
    },
  };
}

interface GameState {
  run: RunState | null;
  meta: MetaState;
  screen: Screen;
  overlay: Overlay;
  gameUi: GameUi;
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
  buyCoAlarm: (locationId: string) => void;
  buyCartridge: (locationId: string) => void;
  /** 使用物品：filter=更换滤芯，iodine=服用碘片开启保护窗 */
  useItem: (id: 'filter' | 'iodine') => void;
  withdraw: (locationId: string, amount: number) => void;
  rest: () => void;
  build: (moduleId: ModuleId, path: BuildPath) => void;
  work: (moduleId: ModuleId) => void;
  cancelProject: (moduleId: ModuleId) => void;
  salvage: (targetId: string) => void;
  maintain: (kind: MaintenanceKind) => void;
  medicate: (conditionId: ConditionId) => void;
  verifyIntel: (intelId: string) => void;

  // --- 设置 ---
  setRation: (r: RationLevel) => void;
  setWaterUse: (w: WaterLevel) => void;
  setHeatMode: (h: HeatMode) => void;
  setHeatTarget: (n: number) => void;
  setHeatMix: (elecKwh: number, fuelL: number) => void;
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
  setGameUi: (ui: GameUi) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  dropToast: (id: number) => void;
}

let toastSeq = 1;

export const useGame = create<GameState>()(
  persist(
    (set, get) => {
      const pushToast = (text: string, tone: Toast['tone'] = 'neutral') => {
        const t: Toast = { id: toastSeq++, text, tone };
        set({ toasts: [...get().toasts, t] });
        setTimeout(() => get().dropToast(t.id), 3600);
      };

      const withSession = <T,>(fn: (s: ReturnType<typeof createSession>) => { ok: boolean; reason?: string; notes: Array<{ text: string; tone: Toast['tone'] }>; value?: T }) => {
        const run = get().run;
        if (!run) return undefined;
        const next = structuredClone(run) as RunState;
        const s = createSession(next, get().haul, get().openShop);
        const r = fn(s);
        if (!r.ok) {
          if (r.reason) pushToast(r.reason, 'bad');
          return r;
        }
        set({ run: s.run, haul: s.haul, openShop: s.openShop });
        for (const n of r.notes) pushToast(n.text, n.tone);
        return r;
      };

      return {
        run: null,
        meta: EMPTY_META,
        screen: 'menu',
        overlay: null,
        gameUi: 'art',
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
          withSession((s) => sessionChooseSite(s, siteId));
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
          const next = structuredClone(run) as RunState;
          const s = createSession(next, get().haul, get().openShop);
          const r = sessionEndDay(s);
          if (!r.ok) {
            if (r.reason) pushToast(r.reason, 'bad');
            return;
          }
          const report = r.value!;
          if (s.run.phase === 'ended') {
            const ending = resolveEnding(s.run, report.cause);
            s.run.endingId = ending.id;
            set({ run: s.run, nightReport: report, settlement: settle(s.run, ending, get().meta) });
          } else {
            set({ run: s.run, nightReport: report });
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
          withSession((s) => sessionAckCollapse(s));
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
          const s = createSession(next, get().haul, get().openShop);
          const r = sessionResolveChoice(s, familyId, variantId, choiceId);
          if (!r.ok || !r.value) return;
          const result = r.value;
          const last = s.run.log[s.run.log.length - 1];
          const meta = get().meta;
          const seenKey = `${familyId}/${variantId}`;
          const patch: Partial<GameState> = {
            run: s.run,
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
          if (s.run.phase === 'ended') {
            const ending = s.run.endingId ? ENDING_BY_ID[s.run.endingId] : undefined;
            if (ending) patch.settlement = settle(s.run, ending, get().meta);
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
          withSession((s) => sessionScavenge(s, locationId, night));
        },

        takeHaul: (picked) => {
          withSession((s) => sessionTakeHaul(s, picked));
        },

        discardHaul: () => {
          withSession((s) => sessionDiscardHaul(s));
        },

        visitShop: (locationId) => {
          withSession((s) => sessionVisitShop(s, locationId));
        },

        closeShop: () => {
          withSession((s) => sessionCloseShop(s));
        },

        buy: (locationId, res, qty) => {
          withSession((s) => sessionBuy(s, locationId, res, qty));
        },

        buyIodine: (locationId) => {
          withSession((s) => sessionBuyIodine(s, locationId));
        },

        withdraw: (locationId, amount) => {
          withSession((s) => sessionWithdraw(s, locationId, amount));
        },

        buyCoAlarm: (locationId) => {
          withSession((s) => sessionBuyCoAlarm(s, locationId));
        },

        buyCartridge: (locationId) => {
          withSession((s) => sessionBuyCartridge(s, locationId));
        },

        useItem: (id) => {
          withSession((s) => sessionUseItem(s, id));
        },

        rest: () => {
          withSession((s) => sessionRest(s));
        },

        build: (moduleId, path) => {
          withSession((s) => sessionBuild(s, moduleId, path));
        },

        work: (moduleId) => {
          withSession((s) => sessionWork(s, moduleId));
        },

        cancelProject: (moduleId) => {
          withSession((s) => sessionCancelProject(s, moduleId));
        },

        salvage: (targetId) => {
          withSession((s) => sessionSalvage(s, targetId));
        },

        maintain: (kind) => {
          withSession((s) => sessionMaintain(s, kind));
        },

        medicate: (conditionId) => {
          withSession((s) => sessionMedicate(s, conditionId));
        },

        verifyIntel: (intelId) => {
          withSession((s) => sessionVerifyIntel(s, intelId));
        },

        // ============================================================
        setRation: (ration) => {
          withSession((s) => sessionSetRation(s, ration));
        },
        setWaterUse: (waterUse) => {
          withSession((s) => sessionSetWaterUse(s, waterUse));
        },
        setPowerMode: (powerMode) => {
          withSession((s) => sessionSetPowerMode(s, powerMode));
        },
        setHeatMode: (heatMode) => {
          withSession((s) => sessionSetHeatMode(s, heatMode));
        },
        setHeatTarget: (heatTarget) => {
          withSession((s) => sessionSetHeatTarget(s, heatTarget));
        },
        setHeatMix: (elecKwh, fuelL) => {
          withSession((s) => sessionSetHeatMix(s, elecKwh, fuelL));
        },
        setPowerPriority: (order) => {
          withSession((s) => sessionSetPowerPriority(s, order));
        },
        togglePowerLoad: (id, on) => {
          withSession((s) => sessionTogglePowerLoad(s, id, on));
        },
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
        setGameUi: (gameUi) => set({ gameUi }),
        toast: (text, tone = 'neutral') => pushToast(text, tone),
        dropToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
      };
    },
    {
      name: 'seven-days-save-v1',
      version: 4,
      storage: createThrottledStorage(),
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<GameState>;
        if (p.run) {
          // v3：新增特殊物品容器；滤芯总耐久 32→30，旧档超出截断
          p.run.items = p.run.items ?? { filter: 0 };
          if (p.run.wear && p.run.wear.filterLife > 30) p.run.wear.filterLife = 30;
          // v4：疾病系统重做——旧「脱水」→轻度脱水；新增用药标记与免疫记录
          p.run.medicated = p.run.medicated ?? [];
          p.run.immunity = p.run.immunity ?? {};
          ensureRunDefaults(p.run);
        }
        if (p.meta) {
          p.meta.seenVariants = p.meta.seenVariants ?? [];
          p.meta.seenFamilies = p.meta.seenFamilies ?? [];
          p.meta.seenEndings = p.meta.seenEndings ?? [];
          p.meta.seenDisasters = p.meta.seenDisasters ?? [];
        }
        return p as GameState;
      },
      partialize: (s) => ({ run: s.run, meta: s.meta, screen: s.screen, gameUi: s.gameUi }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GameState>;
        if (p.run) ensureRunDefaults(p.run);
        const gameUi: GameUi = p.gameUi === 'classic' ? 'classic' : 'art';
        return { ...current, ...p, gameUi };
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
