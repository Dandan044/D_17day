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
import { makeRng, type Rng } from '../rng';
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

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * 派生随机序列。刻意与 run.rngCursor 完全隔离——
 * 同一个 (seed, day) 永远得到同一串数，因此不改动整局随机流。
 */
export function derivedRng(run: RunState): Rng {
  return makeRng((run.seed + run.day * 7919) >>> 0);
}

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
  if (!Array.isArray(run.channelPool)) {
    const owned = new Set(run.channels.map((c) => c.id));
    run.channelPool = CHANNEL_POOL.filter((id) => !owned.has(id));
  }
  for (const st of run.channels) {
    // 事件制之前的老档：doneBeats 与拍 id 对应，新模型按事件记，直接从头开始（频道是第 8 天后的内容）
    if (!Array.isArray(st.doneEvents)) st.doneEvents = [];
    if (st.awaiting === undefined) st.awaiting = null;
  }
}

export function bondOf(affinity: number): BondLevel {
  const [a, b, c] = CHANNEL.BOND_CUTS;
  if (affinity >= c) return 'reliant';
  if (affinity >= b) return 'close';
  if (affinity >= a) return 'familiar';
  return 'stranger';
}

export function channelUnread(st: ChannelState): number {
  return st.inbox.length;
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
    repliedCount: 0,
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
  st.offlineSinceDay = undefined;
}

// ============================================================
// 事件推进
// ============================================================

/**
 * 事件到点了没有。
 *
 * `at`（绝对日）> `afterDays`（距上次联系）。两个都没有的事件只能被 `elseEvent` 带出来。
 * `isFirst`：频道的第一条事件允许"无锚开场"——被搜到的频道应当当场说话，而不是等第二天。
 */
function eventDue(ev: ChannelEvent, st: ChannelState, run: RunState, isFirst: boolean): boolean {
  if (ev.at !== undefined) return run.day >= ev.at;
  if (ev.afterDays !== undefined) return run.day - st.lastContactDay >= ev.afterDays;
  return isFirst;
}

function eventGatesFail(ev: ChannelEvent, st: ChannelState, facts: Facts): boolean {
  if (ev.need && !ev.need.every((n) => st.doneEvents.includes(n))) return true;
  if (ev.minAffinity !== undefined && st.affinity < ev.minAffinity) return true;
  if (ev.require && !matchQuery(ev.require, facts)) return true;
  return false;
}

function roundGatesFail(round: ChannelRound, st: ChannelState, facts: Facts): boolean {
  if (round.minAffinity !== undefined && st.affinity < round.minAffinity) return true;
  if (round.require && !matchQuery(round.require, facts)) return true;
  return false;
}

/** 沿 elseEvent 一路走到第一个条件成立的替代事件（旧 resolveElse 的事件级版本） */
function resolveElseEvent(
  def: ChannelDef,
  ev: ChannelEvent,
  st: ChannelState,
  facts: Facts,
): ChannelEvent | undefined {
  let cur = ev.elseEvent ? eventById(def, ev.elseEvent) : undefined;
  let guard = 0;
  while (cur && guard++ < 16) {
    if (!eventGatesFail(cur, st, facts)) return cur;
    cur = cur.elseEvent ? eventById(def, cur.elseEvent) : undefined;
  }
  return undefined;
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
      st.offlineSinceDay = undefined;
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

    // ---------- 空闲：按日历挑一个事件开始 ----------
    // 到点但门槛不满足时：有 elseEvent 就走替代事件；没有就**跳过它继续往后看**，
    // 不做"整线停滞"（一条只在特定条件下才该出现的事件不该把后面永久堵死）。
    const evs = channelEvents(def);
    for (let i = 0; i < evs.length; i++) {
      const ev = evs[i]!;
      if (st.doneEvents.includes(ev.id)) continue;
      if (!eventDue(ev, st, run, i === 0)) continue;
      if (!eventGatesFail(ev, st, facts)) {
        startEvent(run, st, def, ev, facts);
        break;
      }
      const alt = resolveElseEvent(def, ev, st, facts);
      if (alt && !st.doneEvents.includes(alt.id)) {
        startEvent(run, st, def, alt, facts);
        break;
      }
    }
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
 */
function deliverOpening(run: RunState, st: ChannelState, def: ChannelDef): void {
  const first = channelEvents(def)[0];
  if (!first || st.doneEvents.includes(first.id)) return;
  if (!eventDue(first, st, run, true)) return;
  const facts = deriveFacts(run);
  if (eventGatesFail(first, st, facts)) return;
  startEvent(run, st, def, first, facts);
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

  const rng = derivedRng(run);
  registerSend(run, st, choice, rng);
  st.seenLines = st.log.length;
  st.affinity = clamp(st.affinity + (choice.affinity ?? 0), 0, 100);
  st.repliedCount += 1;
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

  const rng = derivedRng(run);
  registerSend(run, st, choice, rng);
  st.seenLines = st.log.length;
  st.affinity = clamp(st.affinity + (choice.affinity ?? 0), 0, 100);
  st.repliedCount += 1;
  st.active = { ...st.active, lastActionDay: run.day };
  st.awaiting = null;

  if (choice.silence) {
    endEvent(run, st, def, ev, 'silent');
  } else {
    enterRound(run, st, def, ev, choice.next ?? ev.first, deriveFacts(run));
  }
  return { ok: true, said: choice.say };
}
