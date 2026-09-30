import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';

import './copy';
import { t } from './copy/t';

import { TIME } from './balance';
import { CLASS_BY_ID } from './content/classes';
import { ENDING_BY_ID } from './content/endings';
import { FAMILY_BY_ID } from './content/events';
import { PERK_BY_ID, UNLOCK_COST } from './content/perks';
import { noteAction, reportCrash, setSnapshotProvider } from './debug/crashReport';
import { addLog } from './engine/effects';
import { carryCapacity, type Haul, type HaulItem } from './engine/economy';
import { settle, resolveEnding, type Settlement } from './engine/endings';
import { ensureChannelDefaults } from './engine/channels';
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
  devCheat as sessionDevCheat,
  discardHaul as sessionDiscardHaul,
  endDay as sessionEndDay,
  maintain as sessionMaintain,
  openChannel as sessionOpenChannel,
  replyChannel as sessionReplyChannel,
  hailChannel as sessionHailChannel,
  searchChannel as sessionSearchChannel,
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
  ChatLine,
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
  | 'supplies'
  | 'window'
  | 'todo';
export type Screen = 'menu' | 'setup' | 'game' | 'summary';
export type GameUi = 'art' | 'classic';

export interface Toast {
  id: number;
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

/** withSession 的返回形状。返回值的 action 用它给 UI 传回数据 */
export interface SessionOutcome<T = void> {
  ok: boolean;
  reason?: string;
  notes: Array<{ text: string; tone: 'good' | 'bad' | 'neutral' }>;
  value?: T;
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
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(name);
      } catch {
        return null; // 隐私模式 / 存储被禁
      }
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as StorageValue<PersistedSlice>;
        // 只做形状闸门：真是半截的 JSON（写盘被打断）在这里就该扔掉，
        // 不然它会在 store 模块初始化时抛出，React 还没挂载 → 永远白屏、连面板都没有。
        if (!parsed || typeof parsed !== 'object' || !('state' in parsed)) return null;
        return parsed;
      } catch {
        // 留一份残档再放手：万一还能人工捞回进度，也不至于被下一次存档覆盖掉。
        try {
          localStorage.setItem(`${name}.broken`, raw);
        } catch {
          /* 配额满就算了，别为了备份把启动卡住 */
        }
        console.warn('[七日之前] 存档不是合法 JSON，已忽略；残档另存为', `${name}.broken`);
        return null;
      }
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
  /** 开发者指令：跳到崩溃日 + 物资满仓 + 建筑满级（游玩界面输入 "dandan" 触发） */
  devCheat: () => void;
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

  // --- 无线电频道 ---
  searchChannel: () => SessionOutcome<{ found: string | null }> | undefined;
  /** 打开频道：搬走未读、结算 onRead，并把「新读到的行」与「从哪里开始播」交给 UI */
  openChannel: (id: string) => SessionOutcome<{ lines: ChatLine[]; from: number }> | undefined;
  replyChannel: (id: string, choiceId: string) => SessionOutcome | undefined;
  /** 主动先开口：事件的开场在等你先说第一句时用 */
  hailChannel: (id: string, choiceId: string) => SessionOutcome | undefined;

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

      /**
       * 兜底三件事，少一件就退化成白屏或静默：
       * 记一笔最近操作（崩溃报告里能看到前因）、弹 toast（点了有反应）、
       * 报给崩溃面板（有现场可复制）。**不吞错、不做降级**——
       * 该修的字段去修，别把真 bug 藏进 try/catch。
       */
      const onActionError = (label: string, e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[七日之前] 「${label}」抛错：`, e);
        noteAction(`!! 「${label}」抛错 ${msg}`);
        pushToast(t('ui.crash.actionFailed', { label }), 'bad');
        reportCrash(e, `动作：${label}`);
      };

      /**
       * 手写会话动作（endDay / resolveChoice 这类要读返回值再算结算的）也走同一套兜底。
       * `note: false` 给那些**由 effect 自动触发、不是玩家点出来的**动作用——
       * 它们会在每次 run 变化时跑一遍，全记进环形缓冲会把真正的操作挤出去。
       */
      const guarded = <T,>(label: string, fn: () => T, opts: { note?: boolean } = {}): T | undefined => {
        if (!get().run) return undefined;
        if (opts.note !== false) noteAction(label);
        try {
          return fn();
        } catch (e) {
          onActionError(label, e);
          return undefined;
        }
      };

      /**
       * 所有「会话动作」的唯一入口。
       *
       * 三件事必须一起做到，少一件就会退化成白屏或静默：
       * 1. 在**克隆出的** run 上跑，抛错时不 set，存档保持原样；
       * 2. 抛错不吞：记一笔最近操作 + 弹 toast（点了有反应）+ 报给崩溃面板（有现场）；
       * 3. 每一次调用都进最近操作环形缓冲，崩溃时报告里能看到前因。
       */
      const withSession = <T,>(
        fn: (s: ReturnType<typeof createSession>) => SessionOutcome<T>,
        label = '会话操作',
      ) => {
        const run = get().run;
        if (!run) return undefined;
        noteAction(label);
        try {
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
        } catch (e) {
          onActionError(label, e);
          return undefined;
        }
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
          withSession((s) => sessionChooseSite(s, siteId), '选择据点');
        },

        abandonRun: () => {
          const run = get().run;
          if (!run) {
            set({ screen: 'menu' });
            return;
          }
          guarded('放弃这局', () => {
            const next = structuredClone(run) as RunState;
            const ending = resolveEnding(next, t('ledger.cause.abandon'));
            next.endingId = ending.id;
            next.phase = 'ended';
            set({ run: next, settlement: settle(next, ending, get().meta), screen: 'summary' });
          });
        },

        endDay: () => {
          guarded('结束这一天', () => {
            const run = get().run!;
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
          });
        },

        /**
         * 队列里若留有指向已删除家族/变体的条目，EventCard 会渲染成 null，
         * 而「结束这一天」又被队列长度拦住——玩家两头堵死，只能清 localStorage。
         * 改过内容再载入旧存档就会撞上，所以每次进入游戏前先扫一遍。
         */
        pruneQueue: () => {
          guarded(
            '清理事件队列',
            () => {
              const next = structuredClone(get().run!) as RunState;
              const dropped = pruneOrphanQueue(next);
              // 没丢掉任何条目就不要 set：App 里有个依赖 `run` 的 effect 会再调这里，
              // 每次 set 新引用就会死循环，点「结束这一天」后整页空白。
              if (dropped > 0) {
                noteAction(`清理事件队列：剔掉 ${dropped} 条悬空条目`);
                set({ run: next });
              }
            },
            { note: false }, // 这个由 App 的 effect 自动调，不是玩家动作，别占缓冲
          );
        },

        dismissNight: () => {
          const { run } = get();
          set({ nightReport: null });
          if (run?.phase === 'ended') set({ screen: 'summary' });
        },

        /**
         * 开发者指令。彩蛋性质，所以顺手把挡路的浮层/弹窗清掉——
         * 否则跳到崩溃日后，旧的商店/搜刮浮层还挂在上面，看起来像卡住了。
         * phase 可能在 endDay 里被改成 'ended'（连跳七天里死过一次），
         * 那种情况交给 App 的结算路由，这里不做额外处理。
         */
        devCheat: () => {
          const r = withSession((s) => sessionDevCheat(s), '开发者指令');
          if (!r?.ok) return; // 失败就别清浮层，否则看起来像跳成功了其实没跳
          set({ overlay: null, openShop: null, haul: null, nightReport: null, lastChoice: null });
          useGame.setState({ screen: 'game' });
        },

        acknowledgeCollapse: () => {
          withSession((s) => sessionAckCollapse(s), '确认崩塌');
        },

        claimSettlement: () => {
          guarded('领取结算', () => {
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
          });
        },

        // ============================================================
        resolveChoice: (familyId, variantId, choiceId) => {
          guarded('处理事件选项', () => {
            const next = structuredClone(get().run!) as RunState;
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
          });
        },

        dismissChoice: () => {
          const run = get().run;
          set({ lastChoice: null });
          if (run?.phase === 'ended') set({ screen: 'summary' });
        },

        // ============================================================
        scavenge: (locationId, night) => {
          withSession((s) => sessionScavenge(s, locationId, night), '外出搜刮');
        },

        takeHaul: (picked) => {
          withSession((s) => sessionTakeHaul(s, picked), '收下战利品');
        },

        discardHaul: () => {
          withSession((s) => sessionDiscardHaul(s), '丢弃战利品');
        },

        visitShop: (locationId) => {
          withSession((s) => sessionVisitShop(s, locationId), '进店');
        },

        closeShop: () => {
          withSession((s) => sessionCloseShop(s), '离开商店');
        },

        buy: (locationId, res, qty) => {
          withSession((s) => sessionBuy(s, locationId, res, qty), '采购');
        },

        buyIodine: (locationId) => {
          withSession((s) => sessionBuyIodine(s, locationId), '买碘片');
        },

        withdraw: (locationId, amount) => {
          withSession((s) => sessionWithdraw(s, locationId, amount), '取款');
        },

        buyCoAlarm: (locationId) => {
          withSession((s) => sessionBuyCoAlarm(s, locationId), '买一氧化碳报警器');
        },

        buyCartridge: (locationId) => {
          withSession((s) => sessionBuyCartridge(s, locationId), '买备用滤芯');
        },

        useItem: (id) => {
          withSession((s) => sessionUseItem(s, id), '使用特殊物品');
        },

        rest: () => {
          withSession((s) => sessionRest(s), '休息');
        },

        build: (moduleId, path) => {
          withSession((s) => sessionBuild(s, moduleId, path), '建造');
        },

        work: (moduleId) => {
          withSession((s) => sessionWork(s, moduleId), '施工');
        },

        cancelProject: (moduleId) => {
          withSession((s) => sessionCancelProject(s, moduleId), '取消工程');
        },

        salvage: (targetId) => {
          withSession((s) => sessionSalvage(s, targetId), '拆解');
        },

        maintain: (kind) => {
          withSession((s) => sessionMaintain(s, kind), '维护');
        },

        medicate: (conditionId) => {
          withSession((s) => sessionMedicate(s, conditionId), '用药');
        },

        verifyIntel: (intelId) => {
          withSession((s) => sessionVerifyIntel(s, intelId), '核实情报');
        },

        searchChannel: () => withSession((s) => sessionSearchChannel(s), '扫描频道'),

        openChannel: (id) => withSession((s) => sessionOpenChannel(s, id), '打开频道'),

        replyChannel: (id, choiceId) => withSession((s) => sessionReplyChannel(s, id, choiceId), '回复频道'),

        hailChannel: (id, choiceId) => withSession((s) => sessionHailChannel(s, id, choiceId), '主动呼叫'),

        // ============================================================
        setRation: (ration) => {
          withSession((s) => sessionSetRation(s, ration), '调整配给');
        },
        setWaterUse: (waterUse) => {
          withSession((s) => sessionSetWaterUse(s, waterUse), '调整用水');
        },
        setPowerMode: (powerMode) => {
          withSession((s) => sessionSetPowerMode(s, powerMode), '调整供电模式');
        },
        setHeatMode: (heatMode) => {
          withSession((s) => sessionSetHeatMode(s, heatMode), '调整取暖方式');
        },
        setHeatTarget: (heatTarget) => {
          withSession((s) => sessionSetHeatTarget(s, heatTarget), '调整目标温度');
        },
        setHeatMix: (elecKwh, fuelL) => {
          withSession((s) => sessionSetHeatMix(s, elecKwh, fuelL), '调整热电配比');
        },
        setPowerPriority: (order) => {
          withSession((s) => sessionSetPowerPriority(s, order), '调整供电优先级');
        },
        togglePowerLoad: (id, on) => {
          withSession((s) => sessionTogglePowerLoad(s, id, on), '启停用电设备');
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
      // v6：`run.items` 进 ensureRunDefaults、ensureChannelDefaults 会剔除未知频道 id
      version: 6,
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
          // v5：无线电频道网络。旧档没有 channels / channelPool
          ensureChannelDefaults(p.run);
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
        if (p.run) {
          ensureRunDefaults(p.run);
          ensureChannelDefaults(p.run);
        }
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

// ============================================================
// 崩溃报告的进度快照
//
// 由 store 侧注册（而不是 debug 模块反向 import store），否则成环。
// 只读几行摘要：报告要能一眼看出「崩在哪一步」，不是把存档倒出来。
// ============================================================

setSnapshotProvider(() => {
  const s = useGame.getState();
  const run = s.run;
  const where = `屏幕 ${s.screen}｜浮层 ${s.overlay ?? '-'}｜皮肤 ${s.gameUi}`;
  if (!run) return `${where}｜没有进行中的局`;

  const live = run.channels?.filter((c) => c.status === 'active').map((c) => c.id) ?? [];
  const held = run.channels?.filter((c) => c.awaiting).map((c) => c.id) ?? [];
  const built = Object.entries(run.modules ?? {})
    .filter(([, lv]) => (lv ?? 0) > 0)
    .map(([id, lv]) => `${id}${lv}`);

  return [
    where,
    `第 ${run.day} 天 · 阶段 ${run.phase} · 据点 ${run.siteId} · 灾难 ${run.world?.disaster} · 末世等级 ${run.threat}`,
    `AP ${run.ap}｜队列 ${run.queue?.length ?? 0} 条｜待处理 ${run.pending?.length ?? 0} 条`,
    `已建 ${built.length ? built.join(' ') : '（无）'}`,
    `频道 进行中 ${live.length ? live.join(' ') : '（无）'}｜等待玩家 ${held.length ? held.join(' ') : '（无）'}`,
    `滤芯 ${run.wear?.filterLife}／备用 ${run.items?.filter ?? 0} 只`,
  ].join('\n  ');
});
