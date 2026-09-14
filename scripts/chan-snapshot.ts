/**
 * 频道事件表的「行为回归基线」。
 *
 *   tsx scripts/chan-snapshot.ts dump   把当前所有频道的事件表写入快照
 *   tsx scripts/chan-snapshot.ts check  拿当前 events 与快照逐字段比对
 *
 * 两边一致就说明「没有人无意间改动了频道的行为」——事件顺序、轮接线、
 * 延迟天数、静默、门槛、代价，全都在比对范围内。
 *
 * 来历：13 个频道原本是旧的平铺 `beats[]`，迁移到 `events[]` 时，先用适配层
 * `legacyBeatsToEvents()` 折出的结果 dump 成快照当**对照答案**，逐个证明
 * 「手写的新格式与适配层折出来的旧行为逐字段等价」。迁移完成后适配层与
 * `ChannelDef.beats` 已删除，这个快照转为常规的回归基线。
 *
 * 比对前做归一化，只消掉书写差异、不消掉语义：
 *   - 事件按 id 排序、轮按 id 排序（数组顺序在引擎里无意义，轮靠 id 寻址）
 *   - `undefined` 与空数组都视为「没有这个字段」
 *   - `kind` 是纯注解（`ChannelEvent.kind` 的注释写明只供 UI / 统计 / lint 分类），
 *     全仓库没有任何一处读它，所以不计入等价性
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { CHANNEL_DEFS } from '../src/game/content/channels';
import { channelEvents } from '../src/game/engine/channels';
import type { ChannelEvent } from '../src/game/types';

const FILE = resolve('.preview/chan-snapshot.json');

const EMPTY_OK = new Set(['opening', 'out', 'choices', 'need', 'openChoices', 'rounds']);

/** `kind` 是纯注解，不参与等价比对 */
const ANNOTATION_ONLY = new Set(['kind']);

function canon(v: unknown): unknown {
  if (Array.isArray(v)) {
    return v.map(canon).filter((x) => x !== undefined);
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) {
      if (ANNOTATION_ONLY.has(k)) continue;
      const val = o[k];
      if (val === undefined) continue;
      if (EMPTY_OK.has(k) && Array.isArray(val) && val.length === 0) continue;
      out[k] = canon(val);
    }
    return out;
  }
  return v;
}

/** 事件按 id、轮按 id 排序后再序列化 */
function canonEvents(evs: readonly ChannelEvent[]): string {
  const sorted = [...evs]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((e) => ({ ...e, rounds: [...e.rounds].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) }));
  return JSON.stringify(canon(sorted), null, 1);
}

const mode = process.argv[2] ?? 'dump';

if (mode === 'dump') {
  const snap: Record<string, { events: string }> = {};
  for (const d of CHANNEL_DEFS) {
    snap[d.id] = { events: canonEvents(channelEvents(d)) };
  }
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(snap, null, 1), 'utf8');
  console.log(`已写入 ${FILE}`);
  for (const d of CHANNEL_DEFS) {
    const evs = channelEvents(d);
    const rounds = evs.reduce((n, e) => n + e.rounds.length, 0);
    console.log(`  ${d.id.padEnd(14)} 事件 ${String(evs.length).padStart(2)} / 轮 ${rounds}`);
  }
} else if (mode === 'check') {
  const snap = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, { events: string }>;
  let bad = 0;
  for (const d of CHANNEL_DEFS) {
    const want = snap[d.id];
    if (!want) {
      console.log(`  新增频道 ${d.id}（快照里没有，跳过）`);
      continue;
    }
    const got = canonEvents(channelEvents(d));
    if (got === want.events) {
      const n = JSON.parse(want.events).length;
      console.log(`  ✓ ${d.id.padEnd(14)} ${n} 个事件，与快照一致`);
    } else {
      bad++;
      console.log(`  ✗ ${d.id.padEnd(14)} 与快照不一致`);
      // 逐事件定位
      const a = JSON.parse(want.events) as ChannelEvent[];
      const b = JSON.parse(got) as ChannelEvent[];
      const ids = new Set([...a.map((e) => e.id), ...b.map((e) => e.id)]);
      for (const id of ids) {
        const ea = a.find((e) => e.id === id);
        const eb = b.find((e) => e.id === id);
        if (JSON.stringify(canon(ea)) === JSON.stringify(canon(eb))) continue;
        if (!ea) console.log(`      + 事件 ${id}：迁移后多出来的`);
        else if (!eb) console.log(`      - 事件 ${id}：迁移后不见了`);
        else {
          console.log(`      ~ 事件 ${id} 不同：`);
          const keys = new Set([...Object.keys(canon(ea) as object), ...Object.keys(canon(eb) as object)]);
          for (const k of keys) {
            const va = JSON.stringify((canon(ea) as Record<string, unknown>)[k]);
            const vb = JSON.stringify((canon(eb) as Record<string, unknown>)[k]);
            if (va !== vb) console.log(`          快照 ${k}: ${va}\n          当前 ${k}: ${vb}`);
          }
        }
      }
    }
  }
  console.log(bad === 0 ? '\n频道迁移：行为等价 ✓' : `\n频道迁移：${bad} 个频道行为发生了变化 ✗`);
  if (bad > 0) process.exitCode = 1;
} else {
  console.error('用法：tsx scripts/chan-snapshot.ts [dump|check]');
  process.exitCode = 2;
}
