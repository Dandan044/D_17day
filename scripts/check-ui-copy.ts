/**
 * 文案键检查：UI 里写下的每一个 `t('…')`，都必须在文案表里查得到。
 *
 * ## 为什么需要它
 *
 * `t()` 查不到 key 时**不抛错**，它把 key 原文返回给你（`copy/t.ts:41-47`）。
 * 于是「键名写错」的后果不是崩溃，而是**界面上裸奔一串 `ui.sheet.record`**——
 * 这有三个要命的地方：
 *
 * 1. `tsc` 抓不到：`t` 收的是 `string`，任何字符串都合法；
 * 2. `lint:content` 抓不到：它查的是内容层的键，不查 UI 源码里的字面量；
 * 3. 单元测试抓不到：`verify` 只跑引擎，不渲染 React。
 *
 * 只有真开浏览器逐屏看才会发现。而这类错误最集中的地方恰好是**拼前缀**：
 * `registerTree('ui', data)` 让所有 UI 键都必须以 `ui.` 开头，
 * 写 `t('sheet.record')` 而不是 `t('ui.sheet.record')` 就是这么来的。
 *
 * 这个脚本把那一次「真开浏览器」提前到命令行。
 *
 * ## 边界
 *
 * - 只查**静态字面量**。键里带 `${}` 的（按 id 拼出来的）跳过并计数——
 *   它们没法静态解析，只能靠运行时。这类写法在本仓库里都是按内容 id 拼的，可接受。
 * - `pickCopy(key, fallback)` 不查：它**设计上**就允许查不到（回落到内容里的字）。
 * - `tList(prefix)` 查 `prefix.0`：它读的是数组，表里存的是 `prefix.0/.1/…`。
 *
 * 用法：npm run check:copy
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { hasCopy } from '../src/game/copy/t';
import '../src/game/copy';

const ROOT = process.cwd();
const SCAN_DIR = join(ROOT, 'src', 'ui');

interface Finding {
  file: string;
  line: number;
  key: string;
  kind: 't' | 'tList';
}

/** 递归收集 .ts / .tsx。 */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * 去掉注释，避免把注释里举例的键当成真调用。
 * 行注释只在 `//` 前面不是 `:` 时才算注释——否则会把 `https://` 截断。
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function collect(file: string): { findings: Finding[]; dynamic: number } {
  const src = stripComments(readFileSync(file, 'utf8'));
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const findings: Finding[] = [];
  let dynamic = 0;

  // t('...') / t("...") —— \b 保证不会误伤 split('x') 这类以 t 结尾的标识符
  for (const m of src.matchAll(/\bt\(\s*(['"])((?:\\.|(?!\1).)*)\1/g)) {
    const key = m[2]!;
    if (key.includes('${')) {
      dynamic++;
      continue;
    }
    const line = src.slice(0, m.index).split('\n').length;
    findings.push({ file: rel, line, key, kind: 't' });
  }

  // tList('...')：表里存的是 prefix.0 / prefix.1 …，所以查 prefix.0
  for (const m of src.matchAll(/\btList\(\s*(['"])((?:\\.|(?!\1).)*)\1/g)) {
    const key = m[2]!;
    if (key.includes('${')) {
      dynamic++;
      continue;
    }
    const line = src.slice(0, m.index).split('\n').length;
    findings.push({ file: rel, line, key, kind: 'tList' });
  }

  return { findings, dynamic };
}

function main(): void {
  const files = walk(SCAN_DIR).sort();
  const bad: Finding[] = [];
  const seen = new Set<string>();
  let checked = 0;
  let dynamic = 0;

  for (const file of files) {
    const { findings, dynamic: dyn } = collect(file);
    dynamic += dyn;
    for (const f of findings) {
      // 同一个键重复出现只报一次，但每处行号都列出来
      const probe = f.kind === 'tList' ? `${f.key}.0` : f.key;
      const ok = f.kind === 'tList' ? hasCopy(probe) || hasCopy(f.key) : hasCopy(f.key);
      checked++;
      if (ok) continue;
      const sig = `${f.file}:${f.key}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      bad.push(f);
    }
  }

  console.log(`扫描 ${files.length} 个文件 · 检查 ${checked} 处静态键 · 跳过 ${dynamic} 处动态键`);

  if (bad.length === 0) {
    console.log('\n  结果：全部键都能在文案表里查到。');
    return;
  }

  console.log('');
  for (const f of bad) {
    const hint = f.key.startsWith('ui.') ? '' : '  ← 缺 `ui.` 前缀？UI 键一律带前缀';
    console.log(`  FAIL  ${f.file}:${f.line}  ${f.kind === 'tList' ? 'tList' : 't' }('${f.key}')${hint}`);
  }
  console.log(`\n  结果：${bad.length} 处查不到 · 其余 ${checked - bad.length} 处正常`);
  process.exitCode = 1;
}

main();
