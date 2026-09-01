/**
 * 标签注册表：唯一合法标签来源。
 *
 * 事件内容里写的每一个标签都必须能在这里被识别，否则 lint:content 会报错。
 * 这是"洪水时不能有人踹门"这类逻辑约束能被机器检查的前提——
 * 拼错一个标签会静默失效，而静默失效的过滤器就是 bug 的温床。
 */

import type { ConditionId, FactionId, ModuleId, ResourceId, SkillId, StatId } from './types';

// ============================================================
// 静态布尔标签
// ============================================================

export const FLAG_TAGS = [
  // --- 阶段 ---
  'phase:prep',
  'phase:survival',

  // --- 灾难 ---
  'disaster:nuclear',
  'disaster:pandemic',
  'disaster:gridDown',
  'disaster:volcanicWinter',
  'disaster:flood',
  'disaster:chemSpill',
  'disaster:revealed',
  'disaster:hidden',

  // --- 天气 ---
  'weather:clear',
  'weather:overcast',
  'weather:rain',
  'weather:storm',
  'weather:flooding',
  'weather:snow',
  'weather:blizzard',
  'weather:ashfall',
  'weather:blackRain',
  'weather:fog',
  'weather:heatwave',
  /** 任何能掩盖行踪的天气 */
  'weather:cover',
  /** 任何让外出变危险的天气 */
  'weather:hostile',
  /** 雨雪或黑雨：净水可接水 */
  'weather:precip',

  // --- 季节与气温分档 ---
  'season:autumn',
  'season:winter',
  'temp:mild',
  'temp:cool',
  'temp:cold',
  'temp:freezing',
  'temp:extreme',

  // --- 环境分档 ---
  'air:good',
  'air:poor',
  'air:bad',
  'air:lethal',
  'rad:none',
  'rad:low',
  'rad:high',
  'rad:lethal',
  'contagion:none',
  'contagion:low',
  'contagion:high',
  'water:normal',
  'water:polluted',
  'water:flooded',
  'grid:on',
  'grid:rolling',
  'grid:off',

  // --- 秩序 ---
  'order:normal',
  'order:strained',
  'order:failing',
  'order:collapsed',
  'scarcity:low',
  'scarcity:high',
  'scarcity:extreme',

  // --- 暴露度分档：决定"谁来找你" ---
  'exposure:calm',
  'exposure:noticed',
  'exposure:watched',
  'exposure:marked',
  'exposure:hunted',

  // --- 站点特性 ---
  'site:urban',
  'site:highFloor',
  'site:groundLevel',
  'site:underground',
  'site:isolated',
  'site:hasYard',
  'site:hasWell',
  'site:noSunlight',
  'site:noSignal',
  'site:floodRisk',
  'site:damp',
  'site:elevated',
  'site:cramped',

  // --- 避难所状态 ---
  'sealed',
  'co:risk',
  'co:alarm',
  'filter:expired',
  'power:deficit',
  'power:blackout',
  'power:generator',
  'water:stored:low',
  'food:low',
  /** 旱天且净水在线：走回用降耗 */
  'water:recycling',

  // --- 玩家 ---
  'armed',
  'unarmed',
  'injured',
  'sick',
  'sanity:low',
  'sanity:broken',
  'hp:critical',
  'stamina:low',
  'light:off',
  'humanity:low',
  'humanity:high',
  'rep:low',
  'rep:high',
  'hasVehicle',
  'hasPet',
  'hasIodine',
  'hasGeiger',
  'hasMask',

  // --- 社会 ---
  'neighbors:friendly',
  'neighbors:neutral',
  'neighbors:hostile',
  'crew:none',
  'crew:some',
  'crew:full',
] as const;

/**
 * 动态布尔标签：按命名空间校验。
 * 括号里的 group 用于 lint 反查是否指向合法的 id。
 */
export const FLAG_PATTERNS: Array<{ re: RegExp; doc: string }> = [
  { re: /^threat:[0-6]$/, doc: '末世等级精确匹配' },
  { re: /^cond:[A-Za-z]+$/, doc: '玩家身上的负面状态' },
  { re: /^building:[A-Za-z]+$/, doc: '某模块正在施工（半成品劣化）' },
  { re: /^faction:[A-Za-z]+:(active|dormant|friendly|neutral|hostile)$/, doc: '势力活跃度或对你的态度' },
  { re: /^crew:has:[A-Za-z]+$/, doc: '同伴中有人具备某技能或某性格标签' },
  { re: /^flag:[A-Za-z0-9_]+$/, doc: '叙事标签：承诺、债务、见过的人、做过的事' },
  { re: /^delivery:[A-Za-z]+$/, doc: '某模块的成品在途' },
];

// ============================================================
// 数值事实（可比较）
// ============================================================

const RESOURCES: ResourceId[] = [
  'water',
  'foodStaple',
  'foodFresh',
  'meds',
  'fuel',
  'materials',
  'parts',
  'ammo',
  'cash',
];
const STATS: StatId[] = ['hp', 'stamina', 'sanity', 'humanity', 'reputation'];
const SKILLS: SkillId[] = ['medicine', 'mechanics', 'negotiation', 'fitness', 'stealth'];
const MODULES: ModuleId[] = [
  'fortify',
  'conceal',
  'cistern',
  'filter',
  'power',
  'insulate',
  'airFilter',
  'medbay',
  'garden',
  'radio',
];
const FACTIONS: FactionId[] = [
  'gov',
  'militia',
  'gang',
  'looter',
  'quarantine',
  'cult',
  'refugee',
  'rescue',
  'neighbors',
  'trader',
];
const CONDITIONS: ConditionId[] = [
  'dehydrated',
  'starving',
  'malnourished',
  'dysentery',
  'giardia',
  'jaundice',
  'flu',
  'pneumonia',
  'woundInfection',
  'sepsis',
  'fracture',
  'hypothermia',
  'radiationSickness',
  'coPoisoning',
  'moldLung',
  'kidneyStrain',
  'despair',
];

export const NUM_FACT_KEYS: string[] = [
  'day',
  'threat',
  'crew:count',
  'cond:count',
  'world:temperature',
  'world:airPollution',
  'world:radiation',
  'world:contagion',
  'world:lawOrder',
  'world:scarcity',
  'world:neighborhood',
  'world:exposure',
  'world:priceIndex',
  'wear:filterLife',
  'wear:generatorOil',
  'wear:batteryCharge',
  ...RESOURCES.map((r) => `res:${r}`),
  ...STATS.map((s) => `stat:${s}`),
  ...SKILLS.map((s) => `skill:${s}`),
  ...MODULES.map((m) => `mod:${m}`),
  ...FACTIONS.map((f) => `faction:${f}`),
  ...FACTIONS.map((f) => `stance:${f}`),
];

export const ALL_CONDITION_TAGS = CONDITIONS.map((c) => `cond:${c}`);
export const ALL_MODULE_BUILD_TAGS = MODULES.map((m) => `building:${m}`);

// ============================================================
// 解析与校验
// ============================================================

export type CmpOp = '>=' | '<=' | '>' | '<' | '=' | '!=';

export type ParsedTag =
  | { kind: 'flag'; tag: string }
  | { kind: 'cmp'; key: string; op: CmpOp; value: number };

const CMP_RE = /^([A-Za-z0-9_:.]+)(>=|<=|!=|>|<|=)(-?\d+(?:\.\d+)?)$/;

export function parseTag(tag: string): ParsedTag {
  const m = CMP_RE.exec(tag);
  if (m) {
    return { kind: 'cmp', key: m[1]!, op: m[2]! as CmpOp, value: Number(m[3]) };
  }
  return { kind: 'flag', tag };
}

const FLAG_SET = new Set<string>(FLAG_TAGS);
const NUM_SET = new Set<string>(NUM_FACT_KEYS);

/** lint:content 用：判断一个标签是否合法 */
export function isKnownTag(tag: string): boolean {
  const p = parseTag(tag);
  if (p.kind === 'cmp') return NUM_SET.has(p.key);
  if (FLAG_SET.has(p.tag)) return true;
  return FLAG_PATTERNS.some((x) => x.re.test(p.tag));
}

/** 一组互斥标签，同时 require 必然永不触发 */
export const MUTUALLY_EXCLUSIVE: string[][] = [
  ['phase:prep', 'phase:survival'],
  ['site:underground', 'site:highFloor'],
  ['site:underground', 'site:hasYard'],
  ['site:urban', 'site:isolated'],
  ['grid:on', 'grid:off'],
  ['crew:none', 'crew:full'],
  ['armed', 'unarmed'],
  ['disaster:revealed', 'disaster:hidden'],
  ['temp:mild', 'temp:freezing'],
  ['temp:mild', 'temp:extreme'],
  ['air:good', 'air:lethal'],
  ['weather:clear', 'weather:blizzard'],
  ['weather:clear', 'weather:storm'],
  ['weather:flooding', 'weather:blizzard'],
  ['humanity:low', 'humanity:high'],
];
