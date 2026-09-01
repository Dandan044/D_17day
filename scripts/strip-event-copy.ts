/**
 * 从事件源文件抽走玩家可见中文：title/body/label/log/note 与 skip/ch 的字面量。
 * 文案已在 copy/zh/events，运行时由 hydrateFamily 填回。
 * 用法：npx tsx scripts/strip-event-copy.ts
 *
 * TypeScript 7 不再导出编译器 API，这里用字符串扫描处理已知写法。
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../src/game/content/events');
const COPY_KEYS = new Set(['title', 'body', 'label', 'log', 'note']);

type Range = { start: number; end: number };

function skipString(src: string, i: number): number {
  const q = src[i]!;
  i += 1;
  while (i < src.length) {
    const c = src[i]!;
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (q === '`' && c === '$' && src[i + 1] === '{') {
      i += 2;
      let depth = 1;
      while (i < src.length && depth > 0) {
        if (src[i] === '{') depth += 1;
        else if (src[i] === '}') depth -= 1;
        else if (src[i] === '"' || src[i] === "'" || src[i] === '`') i = skipString(src, i) - 1;
        i += 1;
      }
      continue;
    }
    if (c === q) return i + 1;
    i += 1;
  }
  return i;
}

function skipWs(src: string, i: number): number {
  while (i < src.length && /[\s]/.test(src[i]!)) i += 1;
  return i;
}

function identAt(src: string, i: number): string | null {
  if (!/[A-Za-z_]/.test(src[i] ?? '')) return null;
  let j = i + 1;
  while (j < src.length && /[A-Za-z0-9_]/.test(src[j]!)) j += 1;
  return src.slice(i, j);
}

function isStringStart(c: string | undefined): boolean {
  return c === "'" || c === '"' || c === '`';
}

function collect(src: string): Range[] {
  const edits: Range[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === '/' && src[i + 1] === '/') {
      i = src.indexOf('\n', i);
      if (i < 0) break;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? src.length : end + 2;
      continue;
    }
    if (isStringStart(c)) {
      i = skipString(src, i);
      continue;
    }

    const id = identAt(src, i);
    if (id === 'skip') {
      let j = skipWs(src, i + 4);
      if (src[j] === '(') {
        j = skipWs(src, j + 1);
        if (isStringStart(src[j])) {
          const strEnd = skipString(src, j);
          const after = skipWs(src, strEnd);
          if (src[after] === ',') {
            const next = skipWs(src, after + 1);
            edits.push({ start: j, end: next });
            i = next;
            continue;
          }
          if (src[after] === ')') {
            edits.push({ start: j, end: strEnd });
            i = strEnd;
            continue;
          }
        }
      }
    }

    if (id === 'ch') {
      let j = skipWs(src, i + 2);
      if (src[j] === '(') {
        j = skipWs(src, j + 1);
        // first arg: string or ident
        if (isStringStart(src[j])) j = skipString(src, j);
        else {
          const a = identAt(src, j);
          if (!a) {
            i += 1;
            continue;
          }
          j += a.length;
        }
        j = skipWs(src, j);
        if (src[j] === ',') {
          j = skipWs(src, j + 1);
          if (isStringStart(src[j])) {
            const strEnd = skipString(src, j);
            const after = skipWs(src, strEnd);
            if (src[after] === ',') {
              const next = skipWs(src, after + 1);
              edits.push({ start: j, end: next });
              i = next;
              continue;
            }
          }
        }
      }
    }

    if (id && COPY_KEYS.has(id)) {
      let j = skipWs(src, i + id.length);
      if (src[j] === ':') {
        j = skipWs(src, j + 1);
        if (isStringStart(src[j])) {
          const strEnd = skipString(src, j);
          let end = strEnd;
          const after = skipWs(src, strEnd);
          if (src[after] === ',') {
            end = after + 1;
            edits.push({ start: i, end });
            i = end;
            continue;
          }
          const before = src.slice(0, i);
          const prev = before.match(/,(\s*)$/);
          if (prev) edits.push({ start: i - prev[0].length, end: strEnd });
          else edits.push({ start: i, end: strEnd });
          i = strEnd;
          continue;
        }
      }
    }

    i += 1;
  }
  return edits;
}

function apply(src: string, edits: Range[]): string {
  const uniq = [...edits].sort((a, b) => b.start - a.start);
  let out = src;
  const seen = new Set<string>();
  for (const e of uniq) {
    const k = `${e.start}:${e.end}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out = out.slice(0, e.start) + out.slice(e.end);
  }
  return out.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
}

let n = 0;
for (const file of readdirSync(dir)) {
  if (!file.endsWith('.ts') || file === 'factory.ts' || file === 'index.ts' || file === 'queries.ts') continue;
  const path = join(dir, file);
  const before = readFileSync(path, 'utf8');
  const after = apply(before, collect(before));
  if (after !== before) {
    writeFileSync(path, after, 'utf8');
    n += 1;
    console.log('stripped', file);
  }
}
console.log(`done, ${n} files`);
