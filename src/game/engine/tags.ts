/**
 * 标签求值器：把 RunState 压成一张事实表，事件只对这张表提问。
 *
 * 这是整个事件生态的关键中间层。事件内容不直接读 state，
 * 于是"什么情况下这件事合理"这个判断就集中在了标签定义里，可以被 lint 检查。
 */

import { AIR, CAPS, EXPOSURE, HEALTH, RAD, THREAT_NAMES } from '../balance';
import { MODULE_BY_ID, MODULE_IDS } from '../content/modules';
import { SITE_BY_ID } from '../content/sites';
import { parseTag } from '../tags';
import type { Facts, ModuleId, Requirement, RunState, TagQuery, WeatherId } from '../types';
import { isPrecipWeather } from './climate';
import { computePower, loadOnline, type PowerReport } from './power';

export { computePower, loadOnline, type PowerReport } from './power';

/** 能掩盖行踪的天气 */
const COVER_WEATHER: WeatherId[] = ['snow', 'blizzard', 'fog', 'storm', 'ashfall'];
/** 让外出变危险的天气 */
const HOSTILE_WEATHER: WeatherId[] = ['storm', 'blizzard', 'flooding', 'blackRain', 'ashfall', 'heatwave'];

function band(value: number, cuts: number[], names: string[]): string {
  for (let i = 0; i < cuts.length; i++) {
    if (value < cuts[i]!) return names[i]!;
  }
  return names[names.length - 1]!;
}

// ============================================================
// 电力（实现见 power.ts）
// ============================================================

/** 模块的有效等级：施工中或缺电停摆时按 0 计 */
export function effectiveModule(run: RunState, id: ModuleId, power?: PowerReport): number {
  const level = run.modules[id];
  if (level <= 0) return 0;
  if (run.projects.some((p) => p.moduleId === id)) return 0;
  const p = power ?? computePower(run);
  if (p.offline.includes(id)) return 0;
  if (id === 'filter' && run.wear.filterLife <= 0) return 0;
  if (id === 'airFilter' && run.wear.filterLife <= 0) return 0;
  return level;
}

/** 辐射屏蔽等级：地下 + 保温 + 空气过滤。1 级过滤在高楼也能至少挡到下一档。 */
export function radiationShield(run: RunState): number {
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  const air = effectiveModule(run, 'airFilter');
  const insulate = effectiveModule(run, 'insulate');
  let shield = 0;
  if (site.tags.includes('site:underground')) shield += 2;
  if (site.tags.includes('site:highFloor') && air <= 0) shield -= 1;
  shield += Math.ceil(insulate / 2);
  shield += air;
  if (air >= 1) shield = Math.max(shield, 1);
  return Math.max(0, Math.min(3, shield));
}

export function iodineActive(run: RunState): boolean {
  if (!run.flags.includes('flag:iodine')) return false;
  if (run.iodineUntil !== undefined && run.day >= run.iodineUntil) return false;
  return true;
}

export function grantIodine(run: RunState, days = RAD.IODINE_DAYS): void {
  if (!run.flags.includes('flag:iodine')) run.flags.push('flag:iodine');
  if (!run.flags.includes('flag:sawIodineOffer')) run.flags.push('flag:sawIodineOffer');
  run.iodineUntil = Math.max(run.iodineUntil ?? 0, run.day + days);
}

export function waterCapacity(run: RunState): number {
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  return Math.round((CAPS.WATER[run.modules.cistern] ?? 40) * site.waterCapMult);
}

/** 每日总需求（含同伴） */
export function headcount(run: RunState): number {
  return 1 + run.survivors.length;
}

// ============================================================
// 事实表推导
// ============================================================

export function deriveFacts(run: RunState): Facts {
  const flags = new Set<string>();
  const nums: Record<string, number> = {};
  const w = run.world;
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  const power = computePower(run);

  const add = (t: string) => flags.add(t);

  // --- 阶段与等级 ---
  add(run.phase === 'prep' ? 'phase:prep' : 'phase:survival');
  add(`threat:${Math.min(6, Math.max(0, run.threat))}`);
  nums['day'] = run.day;
  nums['threat'] = run.threat;

  // --- 灾难 ---
  add(`disaster:${w.disaster}`);
  add(w.revealed ? 'disaster:revealed' : 'disaster:hidden');

  // --- 天气与季节 ---
  add(`weather:${w.weather}`);
  if (COVER_WEATHER.includes(w.weather)) add('weather:cover');
  if (HOSTILE_WEATHER.includes(w.weather)) add('weather:hostile');
  if (isPrecipWeather(w.weather)) add('weather:precip');
  add(`season:${w.season}`);
  add(band(w.temperature, [-15, -5, 5, 15], ['temp:extreme', 'temp:freezing', 'temp:cold', 'temp:cool', 'temp:mild']));

  // --- 环境（均为越高越糟） ---
  add(band(w.airPollution, [25, 50, 75], ['air:good', 'air:poor', 'air:bad', 'air:lethal']));
  add(band(w.radiation, [10, 40, 70], ['rad:none', 'rad:low', 'rad:high', 'rad:lethal']));
  add(band(w.contagion, [10, 45], ['contagion:none', 'contagion:low', 'contagion:high']));
  add(`water:${w.waterTable}`);
  add(`grid:${w.powerGrid}`);

  // --- 秩序与稀缺（lawOrder 越高越好） ---
  add(band(w.lawOrder, [15, 40, 70], ['order:collapsed', 'order:failing', 'order:strained', 'order:normal']));
  add(band(w.scarcity, [40, 75], ['scarcity:low', 'scarcity:high', 'scarcity:extreme']));

  // --- 暴露度分档：决定"谁来找你" ---
  const [t0, t1, t2, t3] = EXPOSURE.TIERS;
  add(band(w.exposure, [t0!, t1!, t2!, t3!], ['exposure:calm', 'exposure:noticed', 'exposure:watched', 'exposure:marked', 'exposure:hunted']));

  // --- 站点 ---
  for (const t of site.tags) add(t);

  // --- 避难所 ---
  for (const id of MODULE_IDS) {
    nums[`mod:${id}`] = effectiveModule(run, id, power);
  }
  for (const p of run.projects) {
    // 施工期的劣化标签由模块自己声明。power 除了 building:power 还会打上
    // power:blackout（线路改接中，全屋断电）——以前这里是硬编码拼 building:${id}，
    // 那第二个标签永远不会被注入，于是"施工期间全屋断电"这句承诺落了空。
    add(`building:${p.moduleId}`);
    for (const tag of MODULE_BY_ID[p.moduleId].buildPenaltyTags) add(tag);
    if (p.path === 'buy' && !p.laborDone) add(`delivery:${p.moduleId}`);
  }
  if (effectiveModule(run, 'insulate', power) >= 2) add('sealed');
  if (flags.has('sealed') && w.temperature < 5 && !run.flags.includes('flag:coAlarm')) {
    if (AIR.CO_RISK > 0) add('co:risk');
  }
  if (run.flags.includes('flag:coAlarm')) add('co:alarm');
  if (run.wear.filterLife <= 0 && (run.modules.filter > 0 || run.modules.airFilter > 0)) add('filter:expired');
  if (power.deficit > 0) add('power:deficit');
  if (power.generator > 0) add('power:generator');
  if (!loadOnline(run, 'lights', power)) add('light:off');

  const heads = headcount(run);
  if (run.res.water < heads * 3) add('water:stored:low');
  if (run.res.foodStaple + run.res.foodFresh < heads * 2) add('food:low');

  // 旱天回用：净水在线、非降水、无井
  {
    const filterOn = effectiveModule(run, 'filter', power) > 0;
    const hasWell = site.tags.includes('site:hasWell');
    if (filterOn && !isPrecipWeather(w.weather) && !hasWell) add('water:recycling');
  }

  // --- 玩家 ---
  add(run.res.ammo > 0 ? 'armed' : 'unarmed');
  if (run.stats.hp < 55) add('injured');
  if (run.stats.hp < HEALTH.HP_CRIT) add('hp:critical');
  if (run.stats.stamina < HEALTH.STAMINA_LOW) add('stamina:low');
  if (run.conditions.length > 0) add('sick');
  if (run.stats.sanity < HEALTH.SANITY_UNRELIABLE) add('sanity:low');
  if (run.stats.sanity < HEALTH.SANITY_BREAK) add('sanity:broken');
  if (run.stats.humanity < 35) add('humanity:low');
  if (run.stats.humanity > 70) add('humanity:high');
  if (run.stats.reputation < 35) add('rep:low');
  if (run.stats.reputation > 70) add('rep:high');
  if (run.hasVehicle) add('hasVehicle');
  // 几件"便宜但关键"的小物：内容里既可以查 flag:xxx，也可以查语义化标签
  if (run.flags.includes('flag:hasPet')) add('hasPet');
  if (iodineActive(run)) add('hasIodine');
  if (run.flags.includes('flag:geiger')) add('hasGeiger');
  if (run.flags.includes('flag:mask')) add('hasMask');

  for (const c of run.conditions) add(`cond:${c}`);
  nums['cond:count'] = run.conditions.length;

  // --- 社会 ---
  add(band(w.neighborhood, [-25, 25], ['neighbors:hostile', 'neighbors:neutral', 'neighbors:friendly']));

  const crew = run.survivors.length;
  nums['crew:count'] = crew;
  if (crew === 0) add('crew:none');
  else if (crew >= site.companionCap) add('crew:full');
  else add('crew:some');
  for (const s of run.survivors) {
    for (const [skill, val] of Object.entries(s.skills)) {
      if ((val ?? 0) >= 3) add(`crew:has:${skill}`);
    }
    for (const t of s.traits) add(`crew:has:${t}`);
  }

  // --- 势力 ---
  for (const [id, activity] of Object.entries(w.factions)) {
    nums[`faction:${id}`] = activity;
    add(`faction:${id}:${activity >= 30 ? 'active' : 'dormant'}`);
    const stance = w.factionStance[id as keyof typeof w.factionStance] ?? 0;
    nums[`stance:${id}`] = stance;
    add(`faction:${id}:${stance > 25 ? 'friendly' : stance < -25 ? 'hostile' : 'neutral'}`);
  }

  // --- 叙事标签 ---
  for (const f of run.flags) add(f);

  // --- 数值事实 ---
  nums['world:temperature'] = w.temperature;
  nums['world:airPollution'] = w.airPollution;
  nums['world:radiation'] = w.radiation;
  nums['world:contagion'] = w.contagion;
  nums['world:lawOrder'] = w.lawOrder;
  nums['world:scarcity'] = w.scarcity;
  nums['world:neighborhood'] = w.neighborhood;
  nums['world:exposure'] = w.exposure;
  nums['world:priceIndex'] = w.priceIndex;
  nums['wear:filterLife'] = run.wear.filterLife;
  nums['wear:generatorOil'] = run.wear.generatorOil;
  nums['wear:batteryCharge'] = run.wear.batteryCharge;

  for (const [k, v] of Object.entries(run.res)) nums[`res:${k}`] = v;
  for (const [k, v] of Object.entries(run.stats)) nums[`stat:${k}`] = v;
  for (const [k, v] of Object.entries(run.skills)) nums[`skill:${k}`] = v;

  return { flags, nums };
}

// ============================================================
// 查询
// ============================================================

export function matchTag(tag: string, facts: Facts): boolean {
  const p = parseTag(tag);
  if (p.kind === 'flag') return facts.flags.has(p.tag);
  const actual = facts.nums[p.key];
  if (actual === undefined) return false;
  switch (p.op) {
    case '>=':
      return actual >= p.value;
    case '<=':
      return actual <= p.value;
    case '>':
      return actual > p.value;
    case '<':
      return actual < p.value;
    case '=':
      return actual === p.value;
    case '!=':
      return actual !== p.value;
  }
}

export function matchQuery(query: TagQuery | undefined, facts: Facts): boolean {
  if (!query) return true;
  if (query.all && !query.all.every((t) => matchTag(t, facts))) return false;
  if (query.any && query.any.length > 0 && !query.any.some((t) => matchTag(t, facts))) return false;
  if (query.none && query.none.some((t) => matchTag(t, facts))) return false;
  return true;
}

// ============================================================
// 需求检查
// ============================================================

export interface RequirementResult {
  ok: boolean;
  /** 给玩家看的原因，例如"缺 12 建材" */
  reason?: string;
}

const RES_NAMES: Record<string, string> = {
  water: '水',
  foodStaple: '罐头',
  foodFresh: '生鲜',
  meds: '药品',
  fuel: '燃料',
  materials: '建材',
  parts: '零件',
  ammo: '弹药',
  cash: '现金',
};

const SKILL_NAMES: Record<string, string> = {
  medicine: '医疗',
  mechanics: '机械',
  negotiation: '谈判',
  fitness: '体能',
  stealth: '隐蔽',
};

export function checkRequirement(req: Requirement | undefined, run: RunState, facts?: Facts): RequirementResult {
  if (!req) return { ok: true };
  const f = facts ?? deriveFacts(run);

  if (req.res) {
    for (const [k, need] of Object.entries(req.res)) {
      const have = run.res[k as keyof typeof run.res] ?? 0;
      if (have < (need ?? 0)) {
        const short = Math.ceil((need ?? 0) - have);
        return { ok: false, reason: `缺 ${short} ${RES_NAMES[k] ?? k}` };
      }
    }
  }
  if (req.stats) {
    for (const [k, need] of Object.entries(req.stats)) {
      if ((run.stats[k as keyof typeof run.stats] ?? 0) < (need ?? 0)) {
        return { ok: false, reason: req.reason ?? '状态不足' };
      }
    }
  }
  if (req.skills) {
    for (const [k, need] of Object.entries(req.skills)) {
      if ((run.skills[k as keyof typeof run.skills] ?? 0) < (need ?? 0)) {
        return { ok: false, reason: `需要${SKILL_NAMES[k] ?? k} ${need} 级` };
      }
    }
  }
  if (req.modules) {
    for (const [k, need] of Object.entries(req.modules)) {
      if (run.modules[k as keyof typeof run.modules] < (need ?? 0)) {
        return { ok: false, reason: req.reason ?? '避难所设施不足' };
      }
    }
  }
  if (req.ap !== undefined && run.ap < req.ap) {
    return { ok: false, reason: `需要 ${req.ap} 行动点` };
  }
  if (req.tags && !matchQuery(req.tags, f)) {
    return { ok: false, reason: req.reason ?? '条件不满足' };
  }
  return { ok: true };
}

export function threatName(threat: number): string {
  return THREAT_NAMES[Math.max(0, Math.min(THREAT_NAMES.length - 1, threat))]!;
}
