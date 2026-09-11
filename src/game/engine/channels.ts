/**
 * 频道调度：把守护频段的故事节拍投进每个频道自己的信箱。
 *
 * 两条铁律，动了这里就会静默出事：
 *
 * 1. **不走 run.queue**。队列有 4 层限流，且非空就挡住「结束这一天」。
 *    一条横跨 40 天的主线塞进去会挤掉常规事件。信箱独立配额、不挡睡觉。
 * 2. **不消耗共享 RNG**。endDay 用 makeRng(run.seed, run.rngCursor) 重建序列，
 *    任何额外抽签都会推后其后所有抽签，720 局 sim 基线整体漂移且存档不可复盘。
 *    需要概率的地方一律用 derivedRng(run)：按 (seed, day) 派生，不读写 rngCursor。
 */

import { CHANNEL, TIME } from '../balance';
import { t } from '../copy/t';
import { CHANNEL_BY_ID, CHANNEL_DEFS, CHANNEL_POOL } from '../content/channels';
import { makeRng, type Rng } from '../rng';
import type {
  BondLevel,
  ChannelBeat,
  ChannelDef,
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

/** 旧存档补齐。放这里而不是 power.ts：power → channels → tags → power 会成环 */
export function ensureChannelDefaults(run: RunState): void {
  if (!Array.isArray(run.channels)) run.channels = [];
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

export function channelUnread(st: ChannelState): number {
  return st.inbox.length;
}

function makeState(def: ChannelDef): ChannelState {
  return {
    id: def.id,
    status: 'active',
    affinity: def.kind === 'org' ? CHANNEL.AFF_INIT_ORG : CHANNEL.AFF_INIT_PERSON,
    doneBeats: [],
    inbox: [],
    log: [],
    missed: 0,
    repliedCount: 0,
    lastContactDay: 0,
  };
}

function pushSys(st: ChannelState, run: RunState, key: string): void {
  st.inbox.push({ from: 'peer', sys: 'silent', text: key, day: run.day });
}

/**
 * 时间锚判定。
 *
 * **只有数组第一拍可以是「无锚开场拍」**——剩下的无锚拍是分支专用
 * （靠选项的 reply 指定，如「去了之后」那种），
 * 如果也按"无锚即到点"处理，它们会在任意一天被兜底逻辑捞出来直接播，
 * 于是一条本该等三天的支线会当场兑现（还会顺手把频道静默掉）。
 */
function timeDue(beat: ChannelBeat, isOpening: boolean, st: ChannelState, run: RunState): boolean {
  if (beat.at !== undefined) return run.day >= beat.at;
  if (beat.afterDays !== undefined) return run.day - st.lastContactDay >= beat.afterDays;
  return isOpening;
}

/** pendingBeat 的分支拍：自带 afterDays 时从设定日起算，否则立刻上 */
function pendingDue(beat: ChannelBeat, st: ChannelState, run: RunState): boolean {
  if (beat.afterDays === undefined) return true;
  return run.day - (st.pendingSinceDay ?? run.day) >= beat.afterDays;
}

function gatesFail(beat: ChannelBeat, st: ChannelState, facts: Facts): boolean {
  if (beat.need && !beat.need.every((n) => st.doneBeats.includes(n))) return true;
  if (beat.minAffinity !== undefined && st.affinity < beat.minAffinity) return true;
  if (beat.require && !matchQuery(beat.require, facts)) return true;
  return false;
}

function beatById(def: ChannelDef, id: string): ChannelBeat | null {
  return def.beats.find((b) => b.id === id) ?? null;
}

/**
 * 沿着 elseBeat 链一路走到第一个条件成立的替代拍。
 *
 * 只走一跳是不够的：三岔结局（合作者 / 可疑分子 / 无人应答）要靠
 * `elseBeat: 下一个分支` 串起来，链尾必须是那个没有任何前置的兜底拍。
 * guard 防成环（lint 也会拦，这里是第二道）。
 */
function resolveElse(
  def: ChannelDef,
  from: ChannelBeat,
  st: ChannelState,
  facts: Facts,
): ChannelBeat | null {
  let cur = from.elseBeat ? beatById(def, from.elseBeat) : null;
  let guard = 0;
  while (cur && guard++ < 16) {
    if (!gatesFail(cur, st, facts)) return cur;
    cur = cur.elseBeat ? beatById(def, cur.elseBeat) : null;
  }
  return null;
}

function deliver(run: RunState, st: ChannelState, def: ChannelDef, beat: ChannelBeat): void {
  st.inbox.push(...beat.out.map((l) => ({ ...l, day: run.day })));
  st.doneBeats.push(beat.id);
  st.lastContactDay = run.day;
  st.offlineSinceDay = undefined;
  if (beat.choices?.length) {
    st.awaitingBeat = beat.id;
    st.awaitSinceDay = run.day;
  }
  if (beat.silence) {
    st.status = 'lost';
    addLog(run, t('channels.log.lost', { name: t(def.name) }), 'grim');
  } else if (beat.choices?.length) {
    addLog(run, t('channels.log.arrived', { name: t(def.name) }), 'neutral');
  }
}

/**
 * 刚被搜到的频道立刻把开场拍投出来。
 *
 * 不这么做的话，玩家花 1 AP 搜出一个新频段，打开只看到一片空白，
 * 得等到第二天夜间结算才有第一条消息——发现新频道的那一下就没有了。
 */
function deliverOpening(run: RunState, st: ChannelState, def: ChannelDef): void {
  const first = def.beats[0];
  if (!first || st.doneBeats.includes(first.id)) return;
  if (first.at !== undefined && run.day < first.at) return;
  if (gatesFail(first, st, deriveFacts(run))) return;
  deliver(run, st, def, first);
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

    // ---- 超期未回 ----
    if (
      st.awaitingBeat &&
      st.awaitSinceDay !== undefined &&
      run.day - st.awaitSinceDay > def.replyWindowDays
    ) {
      st.missed += 1;
      st.affinity = clamp(st.affinity + CHANNEL.AFF_MISSED, 0, 100);
      st.awaitingBeat = undefined;
      st.awaitSinceDay = undefined;
      st.pendingBeat = undefined;
      st.pendingSinceDay = undefined;
      // 「晾太久会失去联系」只对个人成立。
      // 组织是广播性质：你不理它，它照播不误——所以忽略官方频道不会把它弄没，
      // 只会让你在它的账本上留不下名字（好感度低 → 走「无人应答」结局）。
      if (
        def.kind === 'person' &&
        st.missed >= CHANNEL.MISSED_LIMIT &&
        st.affinity < CHANNEL.LOST_AFFINITY
      ) {
        st.status = 'lost';
        pushSys(st, run, 'channels.sys.timeout');
        addLog(run, t('channels.log.lost', { name: t(def.name) }), 'grim');
      }
      continue;
    }

    // ---- 取一拍 ----
    let beat: ChannelBeat | null = null;
    // 分支在等时间（如「三天后信号消失」）时不做兜底：
    // 否则兜底会把别的带时间锚的拍捞出来，分支就串了。
    let branchWaiting = false;

    if (st.pendingBeat) {
      const nb = beatById(def, st.pendingBeat);
      if (nb && pendingDue(nb, st, run)) {
        st.pendingBeat = undefined;
        st.pendingSinceDay = undefined;
        // 分支拍同样过前置门：这是「同一拍按条件分成两个结局」的唯一手段
        // （选项只能指向一个 beat id，条件分叉靠 require + elseBeat 完成）
        if (gatesFail(nb, st, facts)) {
          beat = resolveElse(def, nb, st, facts);
          if (!beat) branchWaiting = true;
        } else {
          beat = nb;
        }
      } else if (!nb) {
        st.pendingBeat = undefined;
        st.pendingSinceDay = undefined;
      } else {
        branchWaiting = true;
      }
    }

    if (!beat && !branchWaiting) {
      // 扫描到点且未完成的第一拍。前置不满足时：
      //   有 elseBeat → 走替代拍（这一拍就算处理过了）
      //   没有 elseBeat → **跳过它继续往后看**，不做"整线停滞"。
      // 曾经的"停滞"语义是个陷阱：一条 `at: 26` 的条件拍（只在玩家全程没回时才该出现）
      // 会把后面所有拍永久堵死，而且不报任何错——小桃的求救就是这样被吃掉的。
      // 代价是顺序不再由数组位置保证，所以**该保序的地方必须靠 need 显式声明**。
      for (let i = 0; i < def.beats.length; i++) {
        const b = def.beats[i]!;
        if (st.doneBeats.includes(b.id)) continue;
        if (!timeDue(b, i === 0, st, run)) continue;
        if (gatesFail(b, st, facts)) {
          beat = resolveElse(def, b, st, facts);
          if (beat) break;
          continue;
        }
        beat = b;
        break;
      }
    }

    if (!beat) continue;
    deliver(run, st, def, beat);
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

/** 回一条消息。发送要有电，且电台至少 2 级（1 级「能听，不能说」） */
export function replyChannel(run: RunState, id: string, choiceId: string): ReplyResult {
  ensureChannelDefaults(run);
  const st = run.channels.find((c) => c.id === id);
  if (!st) return { ok: false, reason: t('channels.err.noChannel') };
  const def = CHANNEL_BY_ID[id];
  if (!def) return { ok: false, reason: t('channels.err.noChannel') };
  if (st.status === 'lost') return { ok: false, reason: t('channels.err.lost') };

  const beat = st.awaitingBeat ? beatById(def, st.awaitingBeat) : null;
  const choice: ChatChoice | undefined = beat?.choices?.find((c) => c.id === choiceId);
  if (!beat || !choice) return { ok: false, reason: t('channels.err.noChoice') };

  const facts = deriveFacts(run);
  const req = checkRequirement(choice.requires, run, facts);
  // 频道内容没有走事件层的 hydrate，所以 requires.reason 存的是文案键，
  // 这里必须过一次 t()——否则玩家会看到 channels.xxx.yyy 这样的原始键名。
  if (!req.ok) return { ok: false, reason: t(req.reason ?? 'channels.err.noChoice') };

  const sends = !!choice.say;
  // 1 级电台只能收：想说话得先升到收发机
  if (sends && effectiveModule(run, 'radio') < 2) {
    return { ok: false, reason: t('channels.err.needRadio2') };
  }
  const cost = sends ? CHANNEL.SEND_KWH : 0;
  if (cost > 0 && (run.wear.batteryCharge ?? 0) < cost) {
    return { ok: false, reason: t('channels.err.noPower') };
  }
  const apCost = choice.effect?.ap ?? 0;
  if (apCost < 0 && run.ap < -apCost) {
    return { ok: false, reason: t('channels.err.noAp') };
  }

  const rng = derivedRng(run);
  if (cost > 0) run.wear.batteryCharge = Math.max(0, run.wear.batteryCharge - cost);
  if (sends) {
    st.log.push({ from: 'you', text: choice.say!, day: run.day });
    if (st.log.length > CHANNEL.LOG_CAP) st.log = st.log.slice(-CHANNEL.LOG_CAP);
  }
  if (choice.effect) applyEffect(run, choice.effect, rng);
  if (sends && effectiveModule(run, 'radio') >= 2) {
    // 发射会被人测向：暴露度代价
    const [lo, hi] = CHANNEL.TX_EXPOSURE;
    run.world.exposure = Math.min(100, run.world.exposure + rng.float(lo, hi));
  }

  // 自己刚说的话当然算看过，否则关掉再打开会把自己那句再念一遍
  st.seenLines = st.log.length;
  st.affinity = clamp(st.affinity + (choice.affinity ?? 0), 0, 100);
  st.repliedCount += 1;
  st.awaitingBeat = undefined;
  st.awaitSinceDay = undefined;

  if (choice.silence) {
    st.status = 'lost';
    st.pendingBeat = undefined;
    st.pendingSinceDay = undefined;
  } else if (choice.reply) {
    st.pendingBeat = choice.reply;
    st.pendingSinceDay = run.day;
  }

  return { ok: true, said: choice.say };
}
