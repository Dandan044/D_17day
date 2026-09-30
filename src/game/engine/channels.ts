/**
 * 频道调度：**事件驱动**的通讯网络。
 *
 * ## 三层单位：频道 → 事件 → 轮
 *
 * - 一个**事件**＝开场 + 若干轮 + 明确结局。`at` / `afterDays` **只管事件什么时候开始**。
 * - 事件一旦开始，**轮与轮之间即时推进**，日历不再插手；想表达"他几天没回"，
 *   在该轮写 `delayDays`。
 * - 一轮 ＝ 对方说一段 + 给你若干选项；**没有 `choices` 的轮 ＝ 本事件的最后一轮**。
 *
 * 旧模型把"日历拍"和"轮"混在同一个 `beats[]` 里，只靠有没有 `at` 区分，于是：
 * 日历会在对话中途插进来、没有"这件事一共几轮"这个概念、节奏规则只能靠频道 kind 兜。
 * 分层之后那些补丁（pendingBeat / awaitingBeat / immediate / expectReply）全都不需要了。
 *
 * ## 两条铁律，动了会静默出事
 *
 * 1. **不走 `run.queue`**：队列有 4 层限流、非空就挡住「结束这一天」，
 *    一条横跨 40 天的主线塞进去会挤掉常规事件。信箱独立配额、不挡睡觉。
 * 2. **不消耗共享 RNG**：`endDay` 用 `makeRng(run.seed, run.rngCursor)` 重建序列，
 *    任何额外抽签都会推后其后所有抽签（720 局 sim 基线整体漂移、存档不可复盘）。
 *    需要概率一律用 `derivedRng(run)`。
 */

import { CHANNEL, TIME } from '../balance';
import { t } from '../copy/t';
import { CHANNEL_BY_ID, CHANNEL_DEFS, CHANNEL_POOL } from '../content/channels';
import { derivedRng, type Rng } from '../rng';
import type {
  BondLevel,
  ChannelDef,
  ChannelEvent,
  ChannelRound,
  ChannelState,
  ChatChoice,
  ChatLine,
  Facts,
  RunState,
} from '../types';
import { addLog, applyEffect } from './effects';
import { checkRequirement, deriveFacts, effectiveModule, matchQuery } from './tags';

export { derivedRng };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ============================================================
// 事件表
// ============================================================

const NORMALIZED = new Map<string, ChannelEvent[]>();

/**
 * 频道的事件表。
 *
 * 13 个频道已全部改成 `events[]`，旧的平铺 `beats[]` 与那层适配层已经删除，
 * 所以这里只做一次「按频道缓存」——事件表是静态内容，没必要每次重算。
 * 内容没写 `events` 就是内容写错了：`lint:content` 会以「没有任何事件」报出来。
 */
export function channelEvents(def: ChannelDef): ChannelEvent[] {
  let evs = NORMALIZED.get(def.id);
  if (!evs) {
    evs = def.events ?? [];
    NORMALIZED.set(def.id, evs);
  }
  return evs;
}

export function eventById(def: ChannelDef, id: string): ChannelEvent | undefined {
  return channelEvents(def).find((e) => e.id === id);
}

export function roundById(ev: ChannelEvent, id: string): ChannelRound | undefined {
  return ev.rounds.find((r) => r.id === id);
}

/** 当前正在进行的事件（UI 用） */
export function activeEvent(def: ChannelDef, st: ChannelState): ChannelEvent | undefined {
  return st.active ? eventById(def, st.active.eventId) : undefined;
}

/** 当前这一轮（UI 用） */
export function activeRound(def: ChannelDef, st: ChannelState): ChannelRound | undefined {
  const ev = activeEvent(def, st);
  return ev && st.active ? roundById(ev, st.active.roundId) : undefined;
}

// ============================================================
// 状态
// ============================================================

/** 旧存档补齐。放这里而不是 power.ts：power → channels → tags → power 会成环 */
export function ensureChannelDefaults(run: RunState): void {
  if (!Array.isArray(run.channels)) run.channels = [];

  // 内容侧删掉一个频道后，旧档里会留下一条 CHANNEL_BY_ID 查不到的记录。
  // 留着它 = 每一处 `CHANNEL_BY_ID[st.id]` 都是 undefined.name，必炸，
  // 所以在入口就丢掉（并留一行日志，别让它无声消失）。
  const known = run.channels.filter((c) => c && CHANNEL_BY_ID[c.id]);
  if (known.length !== run.channels.length) {
    const gone = run.channels.length - known.length;
    run.channels = known;
    addLog(run, t('ledger.run.channelOrphan', { n: gone }), 'neutral');
  }

  for (const st of run.channels) {
    // 事件制之前的老档：doneBeats 与拍 id 对应，新模型按事件记，直接从头开始（频道是第 8 天后的内容）
    if (!Array.isArray(st.doneEvents)) st.doneEvents = [];
    if (!Array.isArray(st.inbox)) st.inbox = [];
    if (!Array.isArray(st.log)) st.log = [];
    if (st.awaiting === undefined) st.awaiting = null;
    // 这几个是随版本逐个加进来的，旧档一定缺；缺了会变成 NaN 参与比较
    if (!st.status) st.status = 'active';
    if (st.affinity === undefined) {
      const def = CHANNEL_BY_ID[st.id];
      st.affinity = def.kind === 'org' ? CHANNEL.AFF_INIT_ORG : CHANNEL.AFF_INIT_PERSON;
    }
    if (st.missed === undefined) st.missed = 0;
    if (st.lastContactDay === undefined) st.lastContactDay = 0;
    if (st.active && (st.active.eventId === undefined || st.active.roundId === undefined)) st.active = undefined;
  }

  if (!Array.isArray(run.channelPool)) {
    const owned = new Set(run.channels.map((c) => c.id));
    run.channelPool = CHANNEL_POOL.filter((id) => !owned.has(id));
  }
}

export function bondOf(affinity: number): BondLevel {
  const [a, b, c] = CHANNEL.BOND_CUTS;
  if (affinity >= c) return 'reliant';
  if (affinity >= b) return 'close';
  if (affinity >= a) return 'familiar';
  return 'stranger';
}

/** 好感度的数值档位：1=陌生 2=熟悉 3=交心 4=依赖。事件 `minBond` 用它比较 */
export function bondRankOf(affinity: number): 1 | 2 | 3 | 4 {
  const [a, b, c] = CHANNEL.BOND_CUTS;
  if (affinity >= c) return 4;
  if (affinity >= b) return 3;
  if (affinity >= a) return 2;
  return 1;
}

/** 未读数。用 ?. 兜一下：UI 在渲染期逐条调它，旧档里缺 inbox 不该炸掉频段列表 */
export function channelUnread(st: ChannelState): number {
  return st.inbox?.length ?? 0;
}

function makeState(def: ChannelDef): ChannelState {
  return {
    id: def.id,
    status: 'active',
    affinity: def.kind === 'org' ? CHANNEL.AFF_INIT_ORG : CHANNEL.AFF_INIT_PERSON,
    doneEvents: [],
    inbox: [],
    log: [],
    missed: 0,
    lastContactDay: 0,
    awaiting: null,
  };
}

function pushSys(st: ChannelState, run: RunState, key: string): void {
  st.inbox.push({ from: 'peer', sys: 'silent', text: key, day: run.day });
}

function deliverLines(run: RunState, st: ChannelState, lines: ChatLine[] | undefined): void {
  if (!lines || lines.length === 0) return;
  st.inbox.push(...lines.map((l) => ({ ...l, day: run.day })));
  st.lastContactDay = run.day;
}

// ============================================================
// 事件推进
// ============================================================

function eventGatesFail(ev: ChannelEvent, st: ChannelState, facts: Facts): boolean {
  if (ev.need && !ev.need.every((n) => st.doneEvents.includes(n))) return true;
  if (ev.minBond !== undefined && bondRankOf(st.affinity) < ev.minBond) return true;
  if (ev.minAffinity !== undefined && st.affinity < ev.minAffinity) return true;
  if (ev.require && !matchQuery(ev.require, facts)) return true;
  return false;
}

function roundGatesFail(round: ChannelRound, st: ChannelState, facts: Facts): boolean {
  if (round.minAffinity !== undefined && st.affinity < round.minAffinity) return true;
  if (round.require && !matchQuery(round.require, facts)) return true;
  return false;
}

/**
 * 事件池抽签（2026-09-15 重构：旧的 at/afterDays 固定日锚已废除）。
 *
 * 事件属于「末日阶段 × 好感度」的池子，每天频道空闲时按三优先级抽**至多一个**：
 *
 * 1. **关联关键**（`key` 且 `need` 满足且 stage 覆盖当前阶段）：前置达成、人也到了
 *    该出现的阶段——下一事件必触发它。这是「达成了某件事，紧接着必然有下文」的钩子。
 * 2. **关键**（`key`，未完成的）：取 stage 最早的那个（**过期 key 保留优先级**——
 *    错过自己阶段的关键事件不会凭空消失，只是不再受 stage 窗口限制；好感不够时
 *    它继续等，不触发也不作废）。
 * 3. **随机池**：stage 覆盖当前阶段 && minBond 达标 && need 满足 的普通事件，
 *    用 `derivedRng` 抽 1。池空 = 今天没有消息（沉默也是内容）。
 *
 * 抽签只用 `derivedRng`（不触碰 run.rngCursor），sim 基线不漂移。
 */
function pickEvent(def: ChannelDef, st: ChannelState, facts: Facts, run: RunState): ChannelEvent | undefined {
  const undone = channelEvents(def).filter((e) => !st.doneEvents.includes(e.id));
  const inStage = (e: ChannelEvent) => {
    if (!e.stage) return true; // 没有 stage 的事件任何阶段都可能在池里（lint 会劝住 key 这么写）
    const s = run.threat;
    return s >= e.stage[0] && s <= e.stage[1];
  };
  const gated = undone.filter((e) => !eventGatesFail(e, st, facts));

  // 1. 关联关键：prereq（need）已满足 + 阶段覆盖 → 必触发
  const linkedKey = gated.find((e) => e.key && !!e.need?.length && inStage(e));
  if (linkedKey) return linkedKey;

  // 2. 关键：**阶段已到**的未完成 key（过期保留——错过自己阶段的关键事件不会凭空消失，
  //    只是不再受 stage 上界限制，靠 `minBond`/`need` 继续等）。
  //    ⚠️ 必须挡掉「阶段还没到」的 key：否则匮乏期的关键事件会在恐慌期第一天就抢先触发，
  //    把开场的试音（xt_hello）顶掉。这是加第一个后期 key 事件时才暴露出来的 bug——
  //    在此之前线上没有任何 key 事件，这条路径从来没被走过。
  const key = gated
    .filter((e) => e.key && run.threat >= (e.stage?.[0] ?? 0))
    .sort((a, b) => (a.stage?.[0] ?? 99) - (b.stage?.[0] ?? 99))[0];
  if (key) return key;

  // 3. 普通池随机
  const pool = gated.filter((e) => !e.key && inStage(e));
  if (pool.length === 0) return undefined;
  return derivedRng(run).pick(pool);
}

/** 事件收场。`silence` / `lost` 会让频道永久静默 */
function endEvent(
  run: RunState,
  st: ChannelState,
  def: ChannelDef,
  ev: ChannelEvent,
  outcome: NonNullable<ChatChoice['outcome']> = 'resolved',
  opts: { sysKey?: string } = {},
): void {
  if (!st.doneEvents.includes(ev.id)) st.doneEvents.push(ev.id);
  st.active = undefined;
  st.awaiting = null;
  st.waitUntilDay = undefined;
  st.lastContactDay = run.day;
  if (opts.sysKey) pushSys(st, run, opts.sysKey);
  if (outcome === 'silent' || outcome === 'lost' || ev.silence) {
    st.status = 'lost';
    addLog(run, t('channels.log.lost', { name: t(def.name) }), 'grim');
  }
}

/** 投一轮：说话 → 有选项就等玩家选；没选项就收场 */
function deliverRound(
  run: RunState,
  st: ChannelState,
  def: ChannelDef,
  ev: ChannelEvent,
  round: ChannelRound,
  facts: Facts,
): void {
  if (roundGatesFail(round, st, facts)) {
    if (round.elseRound) {
      enterRound(run, st, def, ev, round.elseRound, facts);
      return;
    }
    endEvent(run, st, def, ev, 'resolved');
    return;
  }

  deliverLines(run, st, round.out);
  const active = st.active ?? {
    eventId: ev.id,
    roundId: round.id,
    round: 0,
    startedDay: run.day,
    lastActionDay: run.day,
  };
  st.active = { ...active, roundId: round.id, round: active.round + 1 };
  st.waitUntilDay = undefined;

  if (round.choices?.length) {
    st.awaiting = 'choice';
    addLog(run, t('channels.log.arrived', { name: t(def.name) }), 'neutral');
    return;
  }
  // 没有选项的这一轮 = 本事件的最后一轮
  endEvent(run, st, def, ev, round.silence ? 'silent' : 'resolved');
}

/** 进入某一轮。带 `delayDays` 就挂起，到点由 tick 投 */
function enterRound(
  run: RunState,
  st: ChannelState,
  def: ChannelDef,
  ev: ChannelEvent,
  roundId: string,
  facts: Facts,
): void {
  const round = roundById(ev, roundId);
  if (!round) {
    endEvent(run, st, def, ev, 'resolved');
    return;
  }
  const active = st.active ?? {
    eventId: ev.id,
    roundId,
    round: 0,
    startedDay: run.day,
    lastActionDay: run.day,
  };
  st.active = { ...active, roundId };
  if ((round.delayDays ?? 0) > 0) {
    st.waitUntilDay = run.day + round.delayDays!;
    st.awaiting = null;
    return;
  }
  deliverRound(run, st, def, ev, round, facts);
}

/** 开一个新事件：投开场白 → 等玩家先开口，或直接进第一轮 */
function startEvent(run: RunState, st: ChannelState, def: ChannelDef, ev: ChannelEvent, facts: Facts): void {
  st.active = { eventId: ev.id, roundId: ev.first, round: 0, startedDay: run.day, lastActionDay: run.day };
  st.waitUntilDay = undefined;
  deliverLines(run, st, ev.opening);
  if (ev.awaitPlayerOpen) {
    st.awaiting = 'open';
    return;
  }
  st.awaiting = null;
  enterRound(run, st, def, ev, ev.first, facts);
}

/** 说出来 + 结算 effect + 累积暴露度（发射会被人测向） */
function registerSend(run: RunState, st: ChannelState, choice: ChatChoice, rng: Rng): void {
  if (choice.say) {
    st.log.push({ from: 'you', text: choice.say, day: run.day });
    if (st.log.length > CHANNEL.LOG_CAP) st.log = st.log.slice(-CHANNEL.LOG_CAP);
  }
  // 选项声明的耗电在这里兑现（门槛在 replyChannel/hailChannel 已挡），扣到 0 为止
  if (choice.kwh && choice.kwh > 0) {
    run.wear.batteryCharge = Math.max(0, (run.wear.batteryCharge ?? 0) - choice.kwh);
  }
  if (choice.effect) applyEffect(run, choice.effect, rng);
  if (choice.say) {
    const [lo, hi] = CHANNEL.TX_EXPOSURE;
    run.world.exposure = Math.min(100, run.world.exposure + rng.float(lo, hi));
  }
}

/**
 * 每日推进。**不接收 rng 参数**——这是 sim 基线不漂移的唯一保证。
 * 准备期直接返回，day 1-7 的行为与改造前字节级一致。
 */
export function tickChannels(run: RunState): void {
  if (run.day < TIME.COLLAPSE_DAY) return;
  ensureChannelDefaults(run);

  // ---- 到场：auto 类频道按固定日上线 ----
  for (const def of CHANNEL_DEFS) {
    if (def.discover !== 'auto') continue;
    if (run.channels.some((c) => c.id === def.id)) continue;
    if (run.day < (def.discoverDay ?? TIME.COLLAPSE_DAY)) continue;
    run.channels.push(makeState(def));
    run.channelPool = run.channelPool.filter((id) => id !== def.id);
    addLog(run, t('channels.log.onAir', { name: t(def.name) }), 'neutral');
  }

  const facts: Facts = deriveFacts(run);

  for (const st of run.channels) {
    const def = CHANNEL_BY_ID[st.id];
    if (!def) continue;

    // 静默可以回归：够久没联系就再把频道推回在播态
    if (st.status === 'silent' && run.day - st.lastContactDay >= CHANNEL.OFFLINE_RECONNECT) {
      st.status = 'active';
    }
    if (st.status !== 'active') continue;

    // ---------- 事件进行中：日历不插手，只有"超时"和"delayDays 到点"能动它 ----------
    if (st.active) {
      const ev = eventById(def, st.active.eventId);
      if (!ev || st.doneEvents.includes(ev.id)) {
        st.active = undefined;
        st.awaiting = null;
        st.waitUntilDay = undefined;
        continue;
      }

      // 在等你回应，等太久 → 这个事件以超时收场
      if (st.awaiting && run.day - st.active.lastActionDay > def.replyWindowDays) {
        st.missed += 1;
        st.affinity = clamp(st.affinity + CHANNEL.AFF_MISSED, 0, 100);
        const active = st.active;
        endEvent(run, st, def, ev, 'timedout', { sysKey: 'channels.sys.timeout' });
        // 「晾太久会失去联系」只对个人成立。组织是广播性质：你不理它，它照播不误
        if (
          def.kind === 'person' &&
          st.missed >= CHANNEL.MISSED_LIMIT &&
          st.affinity < CHANNEL.LOST_AFFINITY
        ) {
          st.status = 'lost';
          addLog(run, t('channels.log.lost', { name: t(def.name) }), 'grim');
        }
        void active;
        continue;
      }

      // delayDays 压着的那一轮到点了
      if (st.waitUntilDay !== undefined && run.day >= st.waitUntilDay) {
        const round = roundById(ev, st.active.roundId);
        st.waitUntilDay = undefined;
        if (round) deliverRound(run, st, def, ev, round, facts);
        else endEvent(run, st, def, ev, 'resolved');
      }
      continue;
    }

    // ---------- 空闲：从事件池抽一个开始 ----------
    // 2026-09-15 重构：固定日锚（at/afterDays）已废除。事件按「末日阶段 × 好感度」
    // 分池，每天空闲时按三优先级抽至多一个（关联关键 → 关键 → 普通池随机）。
    // 详见 pickEvent 的注释。抽不到（池空/门槛都不过）= 今天这一头没有消息，
    // 不做"整线停滞"兜底——沉默是池子的一部分，不是 bug。
    const ev = pickEvent(def, st, facts, run);
    if (ev) startEvent(run, st, def, ev, facts);
  }
}

// ============================================================
// 玩家操作
// ============================================================

export interface SearchResult {
  ok: boolean;
  reason?: string;
  /** 搜到的频道 id；null = 只有静电 */
  found?: string | null;
}

/** 搜索频道：1 AP + 蓄电，每次抽一个还没被发现的临时频道 */
export function searchChannel(run: RunState): SearchResult {
  ensureChannelDefaults(run);
  if (run.channelSearchDay === run.day) return { ok: false, reason: t('channels.err.searchOnce') };
  if (run.ap < CHANNEL.SEARCH_AP) return { ok: false, reason: t('channels.err.noAp') };
  const level = effectiveModule(run, 'radio');
  if (level <= 0) return { ok: false, reason: t('channels.err.offline') };
  if ((run.wear.batteryCharge ?? 0) < CHANNEL.SEARCH_KWH) {
    return { ok: false, reason: t('channels.err.noPower') };
  }

  run.channelSearchDay = run.day;
  run.wear.batteryCharge = Math.max(0, run.wear.batteryCharge - CHANNEL.SEARCH_KWH);

  const pool = run.channelPool.filter(
    (id) => CHANNEL_BY_ID[id] && !run.channels.some((c) => c.id === id),
  );
  if (pool.length === 0) return { ok: true, found: null };

  run.ap -= CHANNEL.SEARCH_AP;
  const rng = derivedRng(run);
  const hit = CHANNEL.SEARCH_HIT[Math.min(level, CHANNEL.SEARCH_HIT.length) - 1] ?? 0.6;
  if (!rng.chance(hit)) return { ok: true, found: null };

  const id = rng.pick(pool);
  const def = CHANNEL_BY_ID[id]!;
  const st = makeState(def);
  run.channels.push(st);
  run.channelPool = run.channelPool.filter((x) => x !== id);
  deliverOpening(run, st, def);
  return { ok: true, found: id };
}

/**
 * 刚被搜到的频道立刻把第一条事件投出来。
 *
 * 不这么做的话，玩家花 1 AP 搜出一个新频段，打开只看到一片空白，
 * 得等到第二天夜间结算才有第一条消息——发现新频道的那一下就没有了。
 * （抽签制下没有"固定首事件"，取事件表第一条过得了门槛的。）
 */
function deliverOpening(run: RunState, st: ChannelState, def: ChannelDef): void {
  const facts = deriveFacts(run);
  for (const first of channelEvents(def)) {
    if (st.doneEvents.includes(first.id)) continue;
    if (eventGatesFail(first, st, facts)) continue;
    startEvent(run, st, def, first, facts);
    return;
  }
}

export interface OpenResult {
  /** 本次新读到的行 */
  lines: ChatLine[];
  /** 会话里从第几条开始需要流式播放；之前的直接显示 */
  from: number;
}

/**
 * 打开频道：把未读搬进会话记录，并结算 onRead（读不需要电）。
 *
 * 返回的 `from` 决定 UI 从哪里开始播：只有「没看过的」才逐字流出。
 * 没有 `from` 的话，每次关掉再打开都会把整段历史从头念一遍——
 * 那不是一个聊天窗口该有的行为。
 */
export function openChannel(run: RunState, id: string): OpenResult {
  ensureChannelDefaults(run);
  const st = run.channels.find((c) => c.id === id);
  if (!st) return { lines: [], from: 0 };

  const from = Math.min(st.seenLines ?? 0, st.log.length);
  const arrived = st.inbox;
  if (arrived.length > 0) {
    st.inbox = [];
    const rng = derivedRng(run);
    for (const line of arrived) {
      st.log.push(line);
      if (line.onRead) applyEffect(run, line.onRead, rng);
    }
    if (st.log.length > CHANNEL.LOG_CAP) st.log = st.log.slice(-CHANNEL.LOG_CAP);
  }
  // 打开即视为看过：中途关掉也不会再念一遍，玩家可以自己往上翻
  st.seenLines = st.log.length;
  return { lines: arrived, from };
}

export interface ReplyResult {
  ok: boolean;
  reason?: string;
  /** 玩家说出去的那句文案键 */
  said?: string;
}

/**
 * 回一条消息（在"等你选"的那一轮里选一个）。
 *
 * 1 级电台即可收发——改频段靠的是耐心，不是设备等级。
 * 发送不耗蓄电，但每一句都会被测向：所有发射都累积暴露度。
 *
 * 选项带 `next` → 在同一事件里进下一轮（**即时**，不等天）；
 * 不带 → 这个事件到此结束。
 */
export function replyChannel(run: RunState, id: string, choiceId: string): ReplyResult {
  ensureChannelDefaults(run);
  const st = run.channels.find((c) => c.id === id);
  if (!st) return { ok: false, reason: t('channels.err.noChannel') };
  const def = CHANNEL_BY_ID[id];
  if (!def) return { ok: false, reason: t('channels.err.noChannel') };
  if (st.status === 'lost') return { ok: false, reason: t('channels.err.lost') };
  if (!st.active || st.awaiting !== 'choice') return { ok: false, reason: t('channels.err.noChoice') };

  const ev = eventById(def, st.active.eventId);
  const round = ev ? roundById(ev, st.active.roundId) : undefined;
  const choice: ChatChoice | undefined = round?.choices?.find((c) => c.id === choiceId);
  if (!ev || !round || !choice) return { ok: false, reason: t('channels.err.noChoice') };

  const facts = deriveFacts(run);
  const req = checkRequirement(choice.requires, run, facts);
  // 频道内容没有走事件层的 hydrate，所以 requires.reason 存的是文案键，
  // 这里必须过一次 t()——否则玩家会看到 channels.xxx.yyy 这样的原始键名。
  if (!req.ok) return { ok: false, reason: t(req.reason ?? 'channels.err.noChoice') };

  const apCost = choice.effect?.ap ?? 0;
  if (apCost < 0 && run.ap < -apCost) return { ok: false, reason: t('channels.err.noAp') };
  // 电量门槛：选择前由 note 明示（{kwh} 占位），不足则这一条发不出去
  if (choice.kwh && choice.kwh > 0 && (run.wear.batteryCharge ?? 0) < choice.kwh) {
    return { ok: false, reason: t('channels.err.noPower') };
  }

  const rng = derivedRng(run);
  registerSend(run, st, choice, rng);
  st.seenLines = st.log.length;
  st.affinity = clamp(st.affinity + (choice.affinity ?? 0), 0, 100);
  st.active = { ...st.active, lastActionDay: run.day };
  st.awaiting = null;

  if (choice.silence) {
    endEvent(run, st, def, ev, 'silent');
  } else if (choice.next) {
    enterRound(run, st, def, ev, choice.next, deriveFacts(run));
  } else {
    endEvent(run, st, def, ev, choice.outcome ?? 'resolved');
  }
  return { ok: true, said: choice.say };
}

/**
 * 主动先开口。
 *
 * 有些事件的开场是**等玩家先说话**的（`awaitPlayerOpen`）：对方在那一头听着，
 * 你不开口，这件事就不开始。这几句话的选项来自 `ChannelEvent.openChoices`。
 */
export function hailChannel(run: RunState, id: string, choiceId: string): ReplyResult {
  ensureChannelDefaults(run);
  const st = run.channels.find((c) => c.id === id);
  if (!st) return { ok: false, reason: t('channels.err.noChannel') };
  const def = CHANNEL_BY_ID[id];
  if (!def) return { ok: false, reason: t('channels.err.noChannel') };
  if (st.status === 'lost') return { ok: false, reason: t('channels.err.lost') };
  if (!st.active || st.awaiting !== 'open') return { ok: false, reason: t('channels.err.noChoice') };

  const ev = eventById(def, st.active.eventId);
  const choice: ChatChoice | undefined = ev?.openChoices?.find((c) => c.id === choiceId);
  if (!ev || !choice) return { ok: false, reason: t('channels.err.noChoice') };

  const facts = deriveFacts(run);
  const req = checkRequirement(choice.requires, run, facts);
  if (!req.ok) return { ok: false, reason: t(req.reason ?? 'channels.err.noChoice') };
  const apCost = choice.effect?.ap ?? 0;
  if (apCost < 0 && run.ap < -apCost) return { ok: false, reason: t('channels.err.noAp') };
  if (choice.kwh && choice.kwh > 0 && (run.wear.batteryCharge ?? 0) < choice.kwh) {
    return { ok: false, reason: t('channels.err.noPower') };
  }

  const rng = derivedRng(run);
  registerSend(run, st, choice, rng);
  st.seenLines = st.log.length;
  st.affinity = clamp(st.affinity + (choice.affinity ?? 0), 0, 100);
  st.active = { ...st.active, lastActionDay: run.day };
  st.awaiting = null;

  if (choice.silence) {
    endEvent(run, st, def, ev, 'silent');
  } else {
    enterRound(run, st, def, ev, choice.next ?? ev.first, deriveFacts(run));
  }
  return { ok: true, said: choice.say };
}
