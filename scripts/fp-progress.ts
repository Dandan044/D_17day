/**
 * 第一人称改造 · 进度追踪器。
 * 跑法：npx tsx scripts/fp-progress.ts
 *
 * 输出：每个家族的「你」剩余数 + 文件归属 + 是否已改造完成。
 * 结果写 .preview/fp-progress.md，供人工查漏。
 */
import { ALL_FAMILIES } from '../src/game/content/events';
import { writeFileSync } from 'node:fs';

const YOU = /\u4f60/g;
const y = (s: string) => (s?.match(YOU) ?? []).length;
const keep = 0; // 允许保留的「你」上限（=0 表示全清）

type Row = { id: string; file: string; n: number; chars: number; lab: number };

/** 家族 id 前缀 → 所属文件（人工映射，覆盖全部） */
function fileOf(id: string): string {
  if (id.startsWith('filter_beats')) return 'filter_beats';
  if (id.startsWith('filter_')) return 'filter_cartridge+others';
  if (id.startsWith('prep_slice')) return 'prep_slice';
  if (id.startsWith('prep_')) return 'prep';
  if (id.startsWith('daily_')) return 'daily';
  if (id.startsWith('surv_beat')) return 'surv_beats';
  if (id.startsWith('survival')) return 'survival';
  if (id.startsWith('hook_')) return 'hook_arcs';
  if (id.startsWith('nuke_arc')) return 'nuke_arcs';
  if (id.startsWith('nuke_chain') || id.startsWith('nuke_build')) return 'nuke_apt_chains+build_checks';
  if (id.startsWith('nuke_')) return 'nuke_*';
  if (id.startsWith('env_')) return 'cold+others';
  if (id.startsWith('stat_arc')) return 'stat_arcs';
  if (id.startsWith('radio')) return 'radio';
  if (id.startsWith('med_')) return 'med_progress';
  if (id.startsWith('nuclear_winter') || id.startsWith('nw_')) return 'nuclear_winter';
  if (id.startsWith('late_')) return 'late_nuclear+late_stage';
  if (id.startsWith('echo_')) return 'echo_flags';
  if (id.startsWith('dark_')) return 'dark_witness';
  if (id.startsWith('pressure_')) return 'survival';
  if (id.startsWith('raid_')) return 'survival';
  if (id.startsWith('story_') || id.startsWith('dream_') || id.startsWith('sl_') || id.startsWith('ws_')
    || id.startsWith('wn_') || id.startsWith('pl_') || id.startsWith('opp_')) return 'survival+dark_witness';
  return '?';
}

const rows: Row[] = [];
for (const f of ALL_FAMILIES as any[]) {
  let n = 0, chars = 0, lab = 0;
  for (const v of f.variants ?? []) {
    n += y(v.title) + y(v.body);
    chars += (v.title ?? '').length + (v.body ?? '').length;
    for (const c of v.choices ?? []) {
      n += y(c.effect?.log) + y(c.check?.ok?.log) + y(c.check?.bad?.log);
      lab += y(c.label) + y(c.note);
    }
  }
  rows.push({ id: f.id, file: fileOf(f.id), n, chars, lab });
}

// 文件汇总
const byFile = new Map<string, { n: number; fam: number; famDone: number; chars: number }>();
for (const r of rows) {
  const e = byFile.get(r.file) ?? { n: 0, fam: 0, famDone: 0, chars: 0 };
  e.n += r.n; e.chars += r.chars;
  if (r.n > 0) e.fam++;
  else e.famDone++;
  byFile.set(r.file, e);
}

const done = rows.filter(r => r.n === 0).length;
const total = rows.length;
const tot = rows.reduce((a, r) => a + r.n, 0);

const lines: string[] = [];
lines.push('# 第一人称改造 · 进度');
lines.push('');
lines.push(`家族总数 ${total} · 已清「你」${done} 个 · 待改 ${total - done} 个 · 剩余「你」${tot} 处`);
lines.push('');
lines.push('## 按文件');
lines.push('');
lines.push('| 文件 | 剩余「你」 | 待改家族 | 已清家族 | 正文字数 |');
lines.push('|---|---|---|---|---|');
for (const [f, e] of [...byFile.entries()].sort((a, b) => b[1].n - a[1].n)) {
  lines.push(`| ${f} | ${e.n} | ${e.fam} | ${e.famDone} | ${e.chars} |`);
}
lines.push('');
lines.push('## 待改家族明细（按剩余量降序，只列正文「你」）');
lines.push('');
lines.push('| 家族 | 文件 | 剩余 | 正文 | label内 |');
lines.push('|---|---|---|---|---|');
for (const r of rows.filter(x => x.n > 0).sort((a, b) => b.n - a.n)) {
  lines.push(`| ${r.id} | ${r.file} | ${r.n} | ${r.chars} | ${r.lab} |`);
}

writeFileSync('.preview/fp-progress.md', lines.join('\n'));
console.log(`家族 ${total} · 已清 ${done} · 待改 ${total - done} · 剩余「你」${tot}`);
console.log('');
for (const [f, e] of [...byFile.entries()].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`${String(e.n).padStart(5)}  ${String(e.fam).padStart(3)}家族  ${f}`);
}
