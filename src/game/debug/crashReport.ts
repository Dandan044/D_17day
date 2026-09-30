/**
 * 崩溃快照：把「出了什么错 + 当时进度 + 最近做了什么」拼成一段可复制的文本。
 *
 * 刻意不依赖 React：面板只是它的消费者，verify 里可以直接断言。
 * 这里**不做任何兜底修复**——只负责记录与呈现，缺字段该修的地方去修，
 * 免得把真 bug 藏起来。
 */

import { CHANNEL_BY_ID } from '../content/channels';

const ACTION_CAP = 20;
const actions: string[] = [];

/** 记一笔玩家动作（在 store 的 withSession 里调） */
export function noteAction(text: string): void {
  const t = new Date();
  const hhmmss = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(
    t.getSeconds(),
  ).padStart(2, '0')}`;
  actions.push(`${hhmmss}  ${text}`);
  if (actions.length > ACTION_CAP) actions.splice(0, actions.length - ACTION_CAP);
}

export function recentActions(n = 10): string[] {
  return actions.slice(-n);
}

export function clearActions(): void {
  actions.length = 0;
}

// ============================================================
// 进度快照：由 store 注册提供者，避免 debug → store → debug 成环
// ============================================================

let snapshotProvider: (() => string) | null = null;

export function setSnapshotProvider(fn: () => string): void {
  snapshotProvider = fn;
}

function progressLine(): string {
  try {
    return snapshotProvider ? snapshotProvider() : '（没有注册进度快照提供者）';
  } catch (e) {
    return `（连进度快照都取不到：${errText(e)}）`;
  }
}

// ============================================================
// 字段体检
// ============================================================

/**
 * 体检哪些字段。挑的是**ensureRunDefaults / ensureChannelDefaults 不负责补**的那些——
 * 已经被自愈补上的容器列在这里只会永远显示"完整"，反而看不出真问题。
 */
const RUN_FIELDS = [
  'seed',
  'day',
  'phase',
  'classId',
  'siteId',
  'threat',
  'ap',
  'apMax',
  'rngCursor',
  'res',
  'stats',
  'wear',
  'items',
  'modules',
  'skills',
  'abilities',
  'conditions',
  'flags',
  'log',
  'eventHistory',
  'queue',
  'pending',
  'projects',
  'survivors',
  'channels',
  'world',
] as const;

const CHANNEL_FIELDS = [
  'id',
  'status',
  'affinity',
  'doneEvents',
  'inbox',
  'log',
  'missed',
  'lastContactDay',
  'awaiting',
] as const;

/**
 * 体检当前存档：哪些字段缺了、哪些频道 id 已经不在表里。
 * 这两类正是「白屏」的常见前因，列出来比只报一行 TypeError 有用得多。
 */
export function healthCheck(run: unknown): string[] {
  const out: string[] = [];
  if (!run || typeof run !== 'object') return ['run 不存在（存档为空或没开局）'];
  const r = run as Record<string, unknown>;

  for (const k of RUN_FIELDS) {
    if (r[k] === undefined || r[k] === null) out.push(`run.${k} 缺失`);
  }

  const wear = r.wear as Record<string, unknown> | undefined;
  if (wear && typeof wear === 'object') {
    for (const k of ['filterLife', 'generatorOil', 'batteryCharge']) {
      if (wear[k] === undefined) out.push(`run.wear.${k} 缺失`);
    }
  }

  const items = r.items as Record<string, unknown> | undefined;
  if (items && typeof items === 'object') {
    if (items.filter === undefined) out.push('run.items.filter 缺失');
  }

  const channels = r.channels;
  if (Array.isArray(channels)) {
    channels.forEach((c, i) => {
      const st = c as Record<string, unknown> | null | undefined;
      const label = (st?.id as string) ?? `#${i}`;
      const miss = CHANNEL_FIELDS.filter((k) => st?.[k] === undefined);
      if (miss.length) out.push(`频道 ${label} 缺字段：${miss.join(', ')}`);
      if (typeof st?.id === 'string' && !CHANNEL_BY_ID[st.id]) {
        out.push(`频道 ${label} 不在 CHANNEL_BY_ID 里（内容侧删改遗留）`);
      }
    });
  }

  return out;
}

// ============================================================
// 错误文本
// ============================================================

export function errText(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function stackOf(e: unknown): string {
  if (e instanceof Error && e.stack) return e.stack;
  return '（没有栈信息）';
}

/** 把报告拼成一段纯文本，玩家复制回来就能直接定位 */
export function buildReport(e: unknown, source: string, run?: unknown): string {
  const stamp = new Date().toLocaleString('zh-CN');
  const health = healthCheck(run);
  const lines = [
    '【七日之前 · 崩溃报告】',
    `时间：${stamp}`,
    `来源：${source}`,
    `错误：${errText(e)}`,
    '',
    '进度：',
    `  ${progressLine()}`,
    '',
    '存档体检：',
    ...(health.length ? health.map((h) => `  ! ${h}`) : ['  （字段完整）']),
    '',
    '最近操作：',
    ...(recentActions().length ? recentActions().map((a) => `  ${a}`) : ['  （无记录）']),
    '',
    '栈：',
    stackOf(e),
    '',
    `UA：${typeof navigator === 'undefined' ? '-' : navigator.userAgent}`,
  ];
  return lines.join('\n');
}

// ============================================================
// 崩溃广播：全局钩子 → 面板。面板没挂载时先存着，挂载时取走。
// ============================================================

export interface CrashEvent {
  error: unknown;
  source: string;
}

type Listener = (c: CrashEvent) => void;

const listeners = new Set<Listener>();
let pending: CrashEvent | null = null;

export function reportCrash(error: unknown, source: string): void {
  const event: CrashEvent = { error, source };
  if (listeners.size === 0) {
    pending = event;
    return;
  }
  for (const fn of listeners) fn(event);
}

export function subscribeCrash(fn: Listener): () => void {
  listeners.add(fn);
  if (pending) {
    const first = pending;
    pending = null;
    fn(first);
  }
  return () => listeners.delete(fn);
}
