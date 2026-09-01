/**
 * 中文文案表：点分 key → 字符串，`{name}` 插值。
 * 不上 i18n，只做按 id 检索、改稿、检重。
 */

export type CopyVars = Record<string, string | number>;

const table = new Map<string, string>();

export function flatten(prefix: string, obj: unknown, out: Record<string, string> = {}): Record<string, string> {
  if (typeof obj === 'string') {
    out[prefix] = obj;
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => flatten(prefix ? `${prefix}.${i}` : String(i), item, out));
    return out;
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      flatten(prefix ? `${prefix}.${k}` : k, v, out);
    }
  }
  return out;
}

export function register(entries: Record<string, string>): void {
  for (const [k, v] of Object.entries(entries)) {
    table.set(k, v);
  }
}

export function registerTree(prefix: string, obj: unknown): void {
  register(flatten(prefix, obj));
}

function interpolate(s: string, vars: CopyVars): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function t(key: string, vars?: CopyVars): string {
  const raw = table.get(key);
  if (raw === undefined) {
    return vars ? interpolate(key, vars) : key;
  }
  return vars ? interpolate(raw, vars) : raw;
}

export function tList(key: string): string[] {
  const items: string[] = [];
  for (let i = 0; ; i++) {
    const k = `${key}.${i}`;
    if (!table.has(k)) break;
    items.push(table.get(k)!);
  }
  return items;
}

export function hasCopy(key: string): boolean {
  return table.has(key);
}

export function allCopy(): Array<[string, string]> {
  return [...table.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en'));
}

/** hydrate 用：有表则取表，否则回退到内容对象上残留的字 */
export function pickCopy(key: string, fallback?: string, vars?: CopyVars): string {
  if (hasCopy(key)) return t(key, vars);
  if (fallback) return vars ? interpolate(fallback, vars) : fallback;
  return key;
}
