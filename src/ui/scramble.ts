import { HEALTH } from '../game/balance';
import type { RunState } from '../game/types';

const SWAPS: Array<[string, string]> = [
  ['的', '地'],
  ['了', '着'],
  ['你', '我'],
  ['门', '窗'],
  ['水', '灰'],
  ['灯', '火'],
  ['今天', '那天'],
  ['还', '不'],
];

function hash(seed: number, i: number): number {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** 低理智时扰动标题/正文/选项名。资源 Chip 不要走这里。 */
export function scrambleText(text: string, run: RunState, salt: string): string {
  const broken = run.stats.sanity < HEALTH.SANITY_BREAK;
  const low = run.stats.sanity < HEALTH.SANITY_UNRELIABLE;
  if (!low) return text;
  const seed = run.seed + run.day * 17 + salt.length;
  let out = text;
  const rounds = broken ? 4 : 2;
  for (let i = 0; i < rounds; i++) {
    const pair = SWAPS[Math.floor(hash(seed, i) * SWAPS.length)]!;
    if (hash(seed, i + 9) > 0.45) out = out.replace(pair[0], pair[1]);
  }
  if (broken && out.includes('。')) {
    const parts = out.split('。').filter(Boolean);
    if (parts.length > 1 && hash(seed, 3) > 0.4) {
      const a = parts[0]!;
      parts[0] = parts[1]!;
      parts[1] = a;
      out = parts.join('。') + '。';
    }
  }
  return out;
}
