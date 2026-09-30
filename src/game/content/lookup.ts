/**
 * 查表容错：把「存档里的 id → 定义」这一步收成一处，查不到也绝不抛。
 *
 * ## 为什么需要这一层
 *
 * `CONDITION_BY_ID` / `SITE_BY_ID` / `MODULE_BY_ID` 的类型都是
 * `Record<Id, Def>`（**全量**），所以 `BY_ID[k].name` 在 TS 眼里永远安全，
 * 写的时候没有任何提示。但键有两类来源：
 *
 * - 内容里写死的 id —— 这类由 `npm run audit:ids` 静态查，写错当场报出来；
 * - **存档里躺着的字符串** —— 这类没人管：内容侧改动之后，旧档里会留下
 *   查不到的 id。引擎不在乎（`run.conditions` 就是一串字符串，照跑），
 *   于是错要一直等到 UI 渲染期取 `.name` 才炸，而那时 React 会卸掉整棵树 ——
 *   玩家手里只剩一个白页面。
 *
 * 所以这一层只做一件事：查不到就**回落**（回落到 id 原文、或该表的默认项），
 * 并打一条只出现一次的警告。它不是"降级"，是把错误从"白屏"降级成
 * "看得见的错名字 + 控制台一行"——该修的数据仍然要修。
 */

import { CHANNEL_BY_ID } from './channels';
import { CONDITION_BY_ID, type ConditionDef } from './conditions';
import { DISASTER_BY_ID, DISASTERS, type DisasterDef } from './disasters';
import { MODULE_BY_ID } from './modules';
import { SITE_BY_ID } from './sites';
import type { ChannelDef, ModuleDef, Site, SiteId } from '../types';

const warned = new Set<string>();

/** 同一个 key 只吵一次：每帧渲染都打日志会把控制台冲成一片 */
function warnOnce(key: string, msg: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[七日之前] ${msg}`);
}

/** 只给测试用：让「吵过一次」不跨用例累积 */
export function resetLookupWarnings(): void {
  warned.clear();
}

// ============================================================
// 条件
// ============================================================

export function conditionDef(id: string | null | undefined): ConditionDef | undefined {
  if (!id) return undefined;
  const def = CONDITION_BY_ID[id as keyof typeof CONDITION_BY_ID] as ConditionDef | undefined;
  if (!def) warnOnce(`cond:${id}`, `未知状态 id「${id}」——存档来自旧内容？已按跳过处理。`);
  return def;
}

/** 状态名。查不到回落到 id 原文，绝不留 undefined 参与渲染 */
export function conditionName(id: string): string {
  return conditionDef(id)?.name ?? id;
}

// ============================================================
// 模块
// ============================================================

export function moduleDef(id: string | null | undefined): ModuleDef | undefined {
  if (!id) return undefined;
  const def = MODULE_BY_ID[id as keyof typeof MODULE_BY_ID] as ModuleDef | undefined;
  if (!def) warnOnce(`mod:${id}`, `未知模块 id「${id}」——内容侧删改遗留。`);
  return def;
}

export function moduleName(id: string): string {
  return moduleDef(id)?.name ?? id;
}

// ============================================================
// 据点与灾难
// ============================================================

/**
 * 据点。存档里的 `siteId` 可能指向已删掉的据点（内容侧改过 id 就会），
 * 回落顺序：查得到就用 → 否则 `apartment` → 否则表里的第一个。
 * 返回类型是 `Site`（不是 `Site | undefined`）：据点表空掉的局面不存在，
 * 而调用方有 20 多处都在紧接着取 `.name` / `.caps`，签名里带 undefined 只会
 * 逼着每一处再写一次 `??`。
 */
export function siteOf(id: SiteId | string | null | undefined): Site {
  if (id) {
    const hit = SITE_BY_ID[id as SiteId] as Site | undefined;
    if (hit) return hit;
    warnOnce(`site:${id}`, `未知据点 id「${id}」——已回落到默认据点。`);
  }
  return (SITE_BY_ID['apartment'] ?? Object.values(SITE_BY_ID)[0]) as Site;
}

/** 灾难同理：查不到回落到表里的第一个，绝不返回 undefined 给 `.name` */
export function disasterOf(id: string | null | undefined): DisasterDef {
  if (id) {
    const hit = DISASTER_BY_ID[id as keyof typeof DISASTER_BY_ID] as DisasterDef | undefined;
    if (hit) return hit;
    warnOnce(`dis:${id}`, `未知灾难 id「${id}」——存档来自旧内容？已回落到默认灾难。`);
  }
  return DISASTERS[0]!;
}

// ============================================================
// 频道
// ============================================================

/** 频道的定义只在 UI 渲染期被大量用于取名字，所以单独给一个不抛的入口 */
export function channelDefOf(id: string | null | undefined): ChannelDef | undefined {
  if (!id) return undefined;
  const def = CHANNEL_BY_ID[id] as ChannelDef | undefined;
  if (!def) warnOnce(`ch:${id}`, `未知频道 id「${id}」——存档里的旧频道，UI 会跳过它。`);
  return def;
}
