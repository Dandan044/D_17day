/**
 * 种子随机：mulberry32。
 * 游标存在 RunState 里，因此同一 seed + 同一操作序列可完整复盘，
 * 也让"每日挑战"这种固定 seed 的玩法成立。
 */

export interface Rng {
  next(): number;
  int(minInclusive: number, maxInclusive: number): number;
  float(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
  /** 按权重取一个，权重非正的项会被忽略 */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T | null;
  shuffle<T>(arr: readonly T[]): T[];
  /** d20 掷骰 */
  d20(): number;
  cursor(): number;
}

export function makeRng(seed: number, cursor = 0): Rng {
  let state = (seed >>> 0) + cursor * 0x9e3779b9;
  let used = cursor;

  const next = (): number => {
    used++;
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (a, b) => Math.floor(next() * (b - a + 1)) + a,
    float: (a, b) => next() * (b - a) + a,
    chance: (p) => next() < p,
    pick: (arr) => {
      if (arr.length === 0) throw new Error('rng.pick: empty array');
      return arr[Math.floor(next() * arr.length)]!;
    },
    weighted: (items, weightOf) => {
      let total = 0;
      const weights: number[] = [];
      for (const it of items) {
        const w = Math.max(0, weightOf(it));
        weights.push(w);
        total += w;
      }
      if (total <= 0) return null;
      let roll = next() * total;
      for (let i = 0; i < items.length; i++) {
        roll -= weights[i]!;
        if (roll <= 0) return items[i]!;
      }
      return items[items.length - 1]!;
    },
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i]!;
        out[i] = out[j]!;
        out[j] = tmp;
      }
      return out;
    },
    d20: () => Math.floor(next() * 20) + 1,
    cursor: () => used,
  };
}

/** 把任意字符串转成 seed，方便"每日挑战"用日期字符串做种 */
export function hashSeed(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

export function formatSeed(seed: number): string {
  return seed.toString(36).toUpperCase().padStart(7, '0');
}

export function parseSeed(text: string): number | null {
  const cleaned = text.trim().toUpperCase();
  if (!cleaned) return null;
  const n = parseInt(cleaned, 36);
  return Number.isFinite(n) ? n >>> 0 : null;
}
