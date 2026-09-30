/**
 * 第一人称改造 · 分批计划。
 * 跑法：npx tsx scripts/fp-plan.ts
 *
 * 分档依据：
 *  P1 高优先：吐槽高（threat/opportunity/weather）+ body 含「你」
 *  P2 中优先：吐槽中（medical/social/moral）
 *  P3 低优先：吐槽低（story/dream）
 *  P3 无人面：body 无「你」（几乎不用动人称）
 */
import { ALL_FAMILIES } from '../src/game/content/events';

const HIGH = new Set(['threat', 'opportunity', 'weather']);
const MID = new Set(['medical', 'social', 'moral']);

type F = {
  id: string; kind: string; i: number; w: number;
  variants: number; chars: number; noPerson: boolean; pri: string;
};

const list: F[] = [];
for (const f of ALL_FAMILIES as any[]) {
  const bodies = (f.variants ?? []).map((v: any) => v.body ?? '');
  const chars = (f.variants ?? []).reduce(
    (a: number, v: any) => a + [...(v.body ?? '')].length + [...(v.title ?? '')].length, 0);
  const noPerson = bodies.length > 0 && bodies.every((b: string) => !b.includes('你'));
  let pri: string;
  if (noPerson) pri = 'P3·无人面';
  else if (HIGH.has(f.kind)) pri = 'P1·高';
  else if (MID.has(f.kind)) pri = 'P2·中';
  else pri = 'P3·低';
  list.push({
    id: f.id, kind: f.kind, i: f.intensity, w: f.baseWeight,
    variants: (f.variants ?? []).length, chars, noPerson, pri,
  });
}

const byPri = new Map<string, F[]>();
for (const f of list) {
  if (!byPri.has(f.pri)) byPri.set(f.pri, []);
  byPri.get(f.pri)!.push(f);
}

console.log('===== 分批计划 =====');
for (const k of ['P1·高', 'P2·中', 'P3·低', 'P3·无人面']) {
  const arr = byPri.get(k) ?? [];
  const ch = arr.reduce((a, f) => a + f.chars, 0);
  const vv = arr.reduce((a, f) => a + f.variants, 0);
  console.log(`${k}  ${arr.length} 家族 · ${vv} 变体 · ${ch} 字`);
}

console.log('');
console.log('===== P1·高 明细（按权重降序）=====');
const p1 = (byPri.get('P1·高') ?? []).sort((a, b) => b.w - a.w || a.id.localeCompare(b.id));
for (const f of p1) {
  console.log(`  ${f.id}  ${f.kind}  i${f.i}  w${f.w}  ${f.variants}变体  ${f.chars}字`);
}
console.log(`P1 合计 ${p1.length} 家族`);

console.log('');
console.log('===== P2·中 =====');
const p2 = byPri.get('P2·中') ?? [];
for (const f of p2) console.log(`  ${f.id}  ${f.kind}  i${f.i}`);
console.log(`P2 合计 ${p2.length} 家族`);

console.log('');
console.log('===== P3·低 =====');
const p3 = byPri.get('P3·低') ?? [];
for (const f of p3) console.log(`  ${f.id}  ${f.kind}  i${f.i}`);
console.log(`P3·低 合计 ${p3.length} 家族`);

console.log('');
console.log('===== P3·无人面（几乎不用动人称）=====');
const p4 = byPri.get('P3·无人面') ?? [];
for (const f of p4) console.log(`  ${f.id}  ${f.kind}  i${f.i}`);
console.log(`P3·无人面 合计 ${p4.length} 家族`);
