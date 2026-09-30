/**
 * id 审计：内容里写下的每一个 id，都必须在对应的表里查得到。
 *
 * ## 为什么需要它
 *
 * `lint:content` 查的是**文案与结构**（事件能不能结束、copy 键在不在、
 * next 图有没有成环），它**不查 id 是否存在于表里**。而这里漏一个 id 的后果
 * 分两种，都很糟：
 *
 * - 引擎侧根本不在乎：`run.conditions` 就是一串字符串，写错了照样跑；
 * - UI 侧当场白屏：顶栏那行 `CONDITION_BY_ID[c].needsMedbay` 在渲染期取 undefined，
 *   整棵树被 React 卸掉，玩家手里只剩一个白页面。
 *
 * 也就是说「引擎不报错」与「游戏能玩」之间隔着一次查表，而查表只发生在 UI。
 * 这个脚本把那次查表提前到命令行里。
 *
 * 用法：npm run audit:ids
 */

import { MODULE_BY_ID, MODULE_IDS } from '../src/game/content/modules';
import { CHANNEL_DEFS } from '../src/game/content/channels';
import { CONDITION_BY_ID } from '../src/game/content/conditions';
import { ALL_FAMILIES, FAMILY_BY_ID } from '../src/game/content/events';
import { INTEL_BY_ID } from '../src/game/content/intel';
import { LOCATION_BY_ID } from '../src/game/content/locations';
import { UNLOCK_NAMES } from '../src/game/content/perks';
import { SITE_BY_ID } from '../src/game/content/sites';
import { SURVIVOR_BY_ID } from '../src/game/content/survivors';
import { createRun } from '../src/game/engine/run';
import type { ChatChoice, ChatLine, Effect, Requirement } from '../src/game/types';

// 资源/属性/技能/势力的合法键集直接从一份真实 run 里取——
// 它们只有 union 类型、没有运行时常量，而 run 是唯一的真源，也不会随版本漂。
const probe = createRun({
  seed: 1,
  classId: 'clerk',
  packId: 'none',
  difficulty: 'normal',
  metaPerks: [],
});
const RES_KEYS = new Set(Object.keys(probe.res));
const STAT_KEYS = new Set(Object.keys(probe.stats));
const SKILL_KEYS = new Set(Object.keys(probe.skills));
const FACTION_KEYS = new Set(Object.keys(probe.factionStance ?? {}));

const problems: string[] = [];
const seen = new Set<string>();

function bad(where: string, msg: string): void {
  const line = `${where}：${msg}`;
  if (seen.has(line)) return;
  seen.add(line);
  problems.push(line);
}

function keysOf(v: object | undefined): string[] {
  return v ? Object.keys(v) : [];
}

function checkEffect(where: string, eff: Effect | undefined): void {
  if (!eff) return;
  for (const c of eff.addCond ?? []) {
    if (!CONDITION_BY_ID[c]) bad(where, `addCond 里的 ${c} 不在 CONDITION_BY_ID`);
  }
  for (const c of eff.removeCond ?? []) {
    if (!CONDITION_BY_ID[c]) bad(where, `removeCond 里的 ${c} 不在 CONDITION_BY_ID`);
  }
  for (const m of keysOf(eff.shelter)) {
    if (!MODULE_BY_ID[m]) bad(where, `shelter 里的 ${m} 不在 MODULE_BY_ID`);
  }
  for (const r of keysOf(eff.res)) {
    if (!RES_KEYS.has(r)) bad(where, `res 里的 ${r} 不是合法资源`);
  }
  for (const s of keysOf(eff.stats)) {
    if (!STAT_KEYS.has(s)) bad(where, `stats 里的 ${s} 不是合法属性`);
  }
  for (const s of keysOf(eff.skills)) {
    if (!SKILL_KEYS.has(s)) bad(where, `skills 里的 ${s} 不是合法技能`);
  }
  for (const f of [...keysOf(eff.faction), ...keysOf(eff.stance)]) {
    if (FACTION_KEYS.size && !FACTION_KEYS.has(f)) bad(where, `faction/stance 里的 ${f} 不是合法势力`);
  }
  if (eff.survivor?.recruit && eff.survivor.recruit !== 'random') {
    if (!SURVIVOR_BY_ID[eff.survivor.recruit]) {
      bad(where, `survivor.recruit 里的 ${eff.survivor.recruit} 不在 SURVIVOR_BY_ID`);
    }
  }
  for (const l of eff.locations ?? []) {
    if (!LOCATION_BY_ID[l.id]) bad(where, `locations 里的 ${l.id} 不在 LOCATION_BY_ID`);
  }
  for (const s of eff.schedule ?? []) {
    if (!FAMILY_BY_ID[s.familyId]) bad(where, `schedule 里的 ${s.familyId} 不在 FAMILY_BY_ID`);
  }
  for (const u of eff.unlock ?? []) {
    if (!(u in UNLOCK_NAMES)) bad(where, `unlock 里的 ${u} 不在 UNLOCK_NAMES`);
  }
  // 智能物品目前只有备用滤芯一种（见 Effect.items 的类型）
  for (const i of keysOf(eff.items)) {
    if (i !== 'filter') bad(where, `items 里的 ${i} 不是已知特殊物品`);
  }
}

function checkRequirement(where: string, req: Requirement | undefined): void {
  if (!req) return;
  for (const r of keysOf(req.res)) {
    if (!RES_KEYS.has(r)) bad(where, `requires.res 里的 ${r} 不是合法资源`);
  }
  for (const m of keysOf(req.modules)) {
    if (!MODULE_BY_ID[m]) bad(where, `requires.modules 里的 ${m} 不在 MODULE_BY_ID`);
  }
  for (const s of [...keysOf(req.skills), ...keysOf(req.stats)]) {
    if (!SKILL_KEYS.has(s) && !STAT_KEYS.has(s)) bad(where, `requires 里的 ${s} 既不是技能也不是属性`);
  }
}

function checkChoice(where: string, c: ChatChoice): void {
  checkEffect(`${where}.${c.id}.effect`, c.effect);
  checkRequirement(`${where}.${c.id}.requires`, c.requires);
}

function checkLines(where: string, lines: ChatLine[] | undefined): void {
  lines?.forEach((l, i) => checkEffect(`${where}.line${i}.onRead`, l.onRead));
}

// ---- 常规事件 ----
for (const fam of ALL_FAMILIES) {
  for (const v of fam.variants) {
    v.choices.forEach((c) => checkChoice(`${fam.id}/${v.id}`, c));
  }
}

// ---- 频道（事件制）：结构引用 + onRead + 选项 ----
for (const def of CHANNEL_DEFS) {
  for (const ev of def.events) {
    const w = `channels.${def.id}.${ev.id}`;
    const roundIds = new Set(ev.rounds.map((r) => r.id));
    if (!roundIds.has(ev.first)) bad(w, `first 指向的轮 ${ev.first} 不存在`);
    if (ev.elseEvent && !def.events.some((e) => e.id === ev.elseEvent)) {
      bad(w, `elseEvent 指向的事件 ${ev.elseEvent} 不存在`);
    }
    for (const n of ev.need ?? []) {
      if (!def.events.some((e) => e.id === n)) bad(w, `need 里的事件 ${n} 不存在`);
    }
    if (ev.awaitPlayerOpen && !(ev.openChoices?.length ?? 0)) {
      bad(w, 'awaitPlayerOpen 但没有 openChoices');
    }

    // 2026-09-15 锚点机制（at/afterDays/elseEvent）已废除，事件按「阶段 × 好感」池抽取。
    // 新规则：事件必须声明 stage（决定它在哪个阶段的池里）；key 事件尤其必须有——
    // 没有的话"最早未完成 key"的排序拿不到它的阶段，永远等不到触发。
    // 占位豁免：stage 上限 >6 的事件（如过渡期的 xt_silent [9,9]）视为有意不可达。
    if (ev.stage === undefined) {
      bad(w, '没有声明 stage → 不属于任何阶段池，永远抽不出来');
    } else if (ev.key && (ev.stage[0] === undefined || ev.stage[0] > 6)) {
      bad(w, `key 事件的 stage 起点 ${ev.stage[0]} 超出 threat 上限（1-6）`);
    }
    if (ev.minBond !== undefined && (ev.minBond < 1 || ev.minBond > 4)) {
      bad(w, `minBond ${ev.minBond} 超出 1-4 档位范围`);
    }

    checkLines(`${w}.opening`, ev.opening);
    ev.openChoices?.forEach((c) => {
      checkChoice(`${w}.openChoice`, c);
      if (c.next && !roundIds.has(c.next)) bad(w, `openChoice ${c.id} 的 next ${c.next} 不是本事件的轮`);
    });

    for (const round of ev.rounds) {
      const rw = `${w}.${round.id}`;
      checkLines(rw, round.out);
      if (round.elseRound && !roundIds.has(round.elseRound)) {
        bad(rw, `elseRound 指向的轮 ${round.elseRound} 不存在`);
      }
      const hasChoices = (round.choices?.length ?? 0) > 0;
      if (!hasChoices) continue;
      for (const c of round.choices!) {
        checkChoice(rw, c);
        if (c.next && !roundIds.has(c.next)) bad(rw, `选项 ${c.id} 的 next ${c.next} 不是本事件的轮`);
        if (c.reply) bad(rw, `选项 ${c.id} 还留着已废弃的 reply 字段（应写 next）`);
      }
    }
  }
}

// ---- 模块前置：dep 也要查得到 ----
for (const m of MODULE_IDS) {
  const def = MODULE_BY_ID[m];
  for (const dep of (def as { deps?: Array<{ id: string }> }).deps ?? []) {
    if (!MODULE_BY_ID[dep.id]) bad(`modules.${m}`, `deps 里的 ${dep.id} 不在 MODULE_BY_ID`);
  }
}

// ---- 据点 ----
for (const site of Object.values(SITE_BY_ID)) {
  for (const m of keysOf(site.modCaps)) {
    if (!MODULE_BY_ID[m]) bad(`sites.${site.id}`, `modCaps 里的 ${m} 不在 MODULE_BY_ID`);
  }
}

// ---- 情报池 ----
for (const intel of Object.values(INTEL_BY_ID)) {
  const e = (intel as { effect?: Effect }).effect;
  checkEffect(`intel.${intel.id}`, e);
}

// ============================================================
// 输出
// ============================================================

if (problems.length === 0) {
  console.log('id 审计通过：内容里引用的条件／模块／资源／技能／势力／地点／事件 id 全部查得到。');
  console.log('（这个脚本只查 id 存不存在；文案与结构规则见 `npm run lint:content`，行为回归见 `npm run verify`。）');
  process.exit(0);
}

console.log(`id 审计发现 ${problems.length} 处悬空引用：\n`);
for (const p of problems) console.log(`  · ${p}`);
console.log('\n这些 id 在 UI 查表时会变成 undefined，轻则显示不出名字，重则渲染期抛错整页白屏。');
process.exit(1);
