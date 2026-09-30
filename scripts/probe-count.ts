import { ALL_FAMILIES } from '../src/game/content/events';
import { writeFileSync } from 'node:fs';
const y = (s: string) => (s.match(/\u4f60/g) ?? []).length;
let tot = 0;
const rows: Array<[string, number, number]> = [];
for (const f of ALL_FAMILIES as any[]) {
  let n = 0, ch = 0;
  for (const v of f.variants ?? []) {
    n += y(v.title ?? '') + y(v.body ?? '');
    ch += (v.title ?? '').length + (v.body ?? '').length;
    for (const c of v.choices ?? []) {
      n += y(c.label ?? '') + y(c.note ?? '') + y(c.effect?.log ?? '')
        + y(c.check?.ok?.log ?? '') + y(c.check?.bad?.log ?? '');
    }
  }
  if (n > 0) rows.push([f.id, n, ch]);
  tot += n;
}
rows.sort((a, b) => b[1] - a[1]);
writeFileSync('.preview/_you-count.txt', rows.map(r => `${r[1]}\t${r[2]}\t${r[0]}`).join('\n'));
console.log('家族数带「你」：' + rows.length + ' / 总「你」' + tot);
