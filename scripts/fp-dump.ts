/**
 * 导出指定优先级的家族原文（供改造用）。
 * 跑法：npx tsx scripts/fp-dump.ts P1
 */
import { ALL_FAMILIES } from '../src/game/content/events';

const HIGH = new Set(['threat', 'opportunity', 'weather']);
const MID = new Set(['medical', 'social', 'moral']);

const want = (process.argv[2] ?? 'P1').toUpperCase();

function priOf(f: any): string {
  const bodies = (f.variants ?? []).map((v: any) => v.body ?? '');
  const noPerson = bodies.length > 0 && bodies.every((b: string) => !b.includes('你'));
  if (noPerson) return 'P3U';
  if (HIGH.has(f.kind)) return 'P1';
  if (MID.has(f.kind)) return 'P2';
  return 'P3';
}

const out: any[] = [];
for (const f of ALL_FAMILIES as any[]) {
  const p = priOf(f);
  if (want === 'P1' && p !== 'P1') continue;
  if (want === 'P2' && p !== 'P2') continue;
  if (want === 'P3' && p !== 'P3') continue;
  if (want === 'P3U' && p !== 'P3U') continue;
  out.push(f);
}
out.sort((a, b) => b.baseWeight - a.baseWeight || a.id.localeCompare(b.id));

for (const f of out) {
  console.log('');
  console.log('########## ' + f.id + '  kind=' + f.kind + ' i=' + f.intensity + ' w=' + f.baseWeight);
  for (const v of f.variants ?? []) {
    console.log('-- [' + f.id + '/' + v.id + ']');
    console.log('T| ' + (v.title ?? ''));
    console.log('B| ' + (v.body ?? '').replace(/\n/g, '\n   '));
    for (const c of v.choices ?? []) {
      const lg = c.effect?.log ?? (c.check ? 'OK:' + (c.check.ok?.log ?? '') + ' | BAD:' + (c.check.bad?.log ?? '') : '');
      console.log('C| [' + c.id + '] ' + (c.label ?? '') + (c.note ? '  («' + c.note + '»)' : ''));
      if (lg) console.log('L| ' + lg);
    }
  }
}
console.log('');
console.log('总数 ' + out.length + ' 家族');
