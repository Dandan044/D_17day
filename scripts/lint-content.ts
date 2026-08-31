/**
 * 内容一致性校验。
 *
 * "洪水时不能有人踹门"这类约束靠人记是不可持续的。这个脚本把它变成能报错的东西：
 *   - 标签拼错会静默失效，所以每个标签都必须在注册表里
 *   - schedule 指向不存在的事件家族会让因果链断掉
 *   - 某些（灾难 × 等级 × 天气）组合下事件池可能枯竭
 *   - 互斥标签被同时 require 的事件永远不会触发
 *   - baseWeight 为 0 又没人 schedule 的家族是死内容
 *
 * 用法：npm run lint:content
 */

import { TIME } from '../src/game/balance';
import { CLASSES, SUPPLY_PACKS } from '../src/game/content/classes';
import { DISASTERS } from '../src/game/content/disasters';
import { ENDINGS } from '../src/game/content/endings';
import { ALL_FAMILIES, FAMILY_BY_ID } from '../src/game/content/events';
import { UNLOCK_COST, UNLOCK_NAMES } from '../src/game/content/perks';
import { SITES, SITE_BY_ID } from '../src/game/content/sites';
import { isEligible } from '../src/game/engine/director';
import { deriveFacts } from '../src/game/engine/tags';
import { chooseSite, createRun } from '../src/game/engine/run';
import { applyOnset } from '../src/game/engine/world';
import { makeRng } from '../src/game/rng';
import { isKnownTag, MUTUALLY_EXCLUSIVE, parseTag } from '../src/game/tags';
import type { DisasterId, EventFamily, SiteId, TagQuery, WeatherId } from '../src/game/types';

const errors: string[] = [];
const warnings: string[] = [];
const tagUsage = new Map<string, number>();
const writtenFlags = new Set<string>();
const readFlags = new Set<string>();

const err = (m: string) => errors.push(m);
const warn = (m: string) => warnings.push(m);

// ============================================================
// 1. 标签合法性
// ============================================================

function checkQuery(where: string, q: TagQuery | undefined): void {
  if (!q) return;
  for (const group of [q.all, q.any, q.none]) {
    for (const tag of group ?? []) {
      tagUsage.set(tag, (tagUsage.get(tag) ?? 0) + 1);
      if (!isKnownTag(tag)) {
        err(`${where}：标签 "${tag}" 不在注册表中（拼写错误会让过滤器静默失效）`);
      }
      if (tag.startsWith('flag:')) readFlags.add(tag);
    }
  }
  // 互斥检查
  if (q.all && q.all.length > 1) {
    for (const pair of MUTUALLY_EXCLUSIVE) {
      const hits = pair.filter((p) => q.all!.includes(p));
      if (hits.length > 1) {
        err(`${where}：同时 require 了互斥标签 ${hits.join(' 与 ')}，这个条件永远不会成立`);
      }
    }
  }
}

function checkFlagList(where: string, flags: string[] | undefined): void {
  for (const f of flags ?? []) {
    tagUsage.set(f, (tagUsage.get(f) ?? 0) + 1);
    if (!isKnownTag(f)) err(`${where}：叙事标签 "${f}" 不合法（应形如 flag:xxx）`);
    else if (parseTag(f).kind === 'flag' && !f.startsWith('flag:') && !f.includes(':')) {
      warn(`${where}：标签 "${f}" 没有命名空间前缀，建议用 flag:`);
    }
  }
}

/** log 承诺了世界事实，effect 必须改对应机械字段 */
function checkEmptyPromise(
  where: string,
  log: string,
  e: {
    res?: { water?: number };
    locations?: Array<{ stock?: number; blocked?: string | null }>;
    setFlags?: string[];
    schedule?: unknown[];
  },
): void {
  if (!log) return;
  if (/(哪个仓库|仓库还没被清)/.test(log) && !e.locations?.some((l) => l.stock !== undefined) && !e.schedule?.length) {
    err(`${where}：log 承诺仓库还在，effect 没有 locations.stock 或 schedule`);
  }
  if (/设卡/.test(log) && !e.locations?.some((l) => l.blocked)) {
    err(`${where}：log 承诺设卡，effect 没有 locations.blocked`);
  }
  if (/(给你|给了你).{0,8}水|两瓶水/.test(log) && (e.res?.water ?? 0) <= 0) {
    err(`${where}：log 承诺给水，effect 没有加水`);
  }
  if (/(北边.{0,8}收人|北上路线)/.test(log) && !e.setFlags?.includes('flag:knowsNorthRoute')) {
    err(`${where}：log 承诺北上，effect 没有 flag:knowsNorthRoute`);
  }
  if (/(把坐标抄|抄三遍|把坐标记下来)/.test(log) && !e.setFlags?.includes('flag:knowsNorthRoute') && !e.setFlags?.includes('flag:hasEvacMap')) {
    err(`${where}：log 承诺坐标，effect 没有已知路线 flag`);
  }
  if (/(借.{0,6}钥匙|钥匙.{0,4}借)/.test(log) && (e.res?.water ?? 0) <= 0) {
    err(`${where}：log 承诺借钥匙取水，effect 没有加水`);
  }
}

const scheduledFamilies = new Set<string>();
const PRESSURE_FAMILIES = ['pressure_passerby', 'pressure_scout', 'pressure_tribute', 'raid_attempt'];

for (const f of ALL_FAMILIES) {
  const base = `事件家族 ${f.id}`;
  checkQuery(`${base}.require`, f.require);
  checkQuery(`${base}.forbid`, f.forbid);

  if (f.variants.length === 0) err(`${base}：没有任何变体`);
  const variantIds = new Set<string>();

  for (const v of f.variants) {
    const vw = `${base} / 变体 ${v.id}`;
    if (variantIds.has(v.id)) err(`${vw}：变体 id 重复`);
    variantIds.add(v.id);
    checkQuery(`${vw}.require`, v.require);
    checkQuery(`${vw}.forbid`, v.forbid);
    if (!v.title.trim()) err(`${vw}：标题为空`);
    if (!v.body.trim()) err(`${vw}：正文为空`);
    if (v.choices.length === 0) err(`${vw}：没有任何选项`);

    /**
     * 软锁保护：事件必须处理完才能结束当天，所以每个变体都需要一个
     * 完全无条件的选项。否则玩家可能在没钱没物资没行动点时被卡死。
     */
    if (!v.choices.some((c) => !c.requires)) {
      err(`${vw}：所有选项都有前置条件，玩家可能被卡死（至少需要一个无条件选项）`);
    }

    const choiceIds = new Set<string>();
    for (const c of v.choices) {
      const cw = `${vw} / 选项 ${c.id}`;
      if (choiceIds.has(c.id)) err(`${cw}：选项 id 重复`);
      choiceIds.add(c.id);
      checkQuery(`${cw}.requires.tags`, c.requires?.tags);

      const effects = c.check ? [c.check.ok, c.check.bad] : c.effect ? [c.effect] : [];
      if (effects.length === 0) err(`${cw}：既没有 effect 也没有 check，点了不会发生任何事`);

      /**
       * AP 对账：requires.ap 只是门槛，成本得在 effect 里兑现——跟 res 一个约定。
       * 两边对不上时，玩家会看到「需要 1 行动点」的提示，选完却一分不扣。
       * check 型要求 ok/bad 都扣：决定动手的那一刻时间就花出去了，与检定成败无关。
       */
      if (c.requires?.ap !== undefined && !effects.every((e) => e.ap !== undefined)) {
        err(
          `${cw}：requires 声明了 ${c.requires.ap} 行动点，但 effect 没有对应的 ap 扣除——玩家会看到收费提示却不会被扣`,
        );
      }
      if (c.requires?.ap === undefined && effects.some((e) => (e.ap ?? 0) < 0)) {
        warn(`${cw}：effect 扣了行动点，但 requires 没声明门槛，AP 为 0 时照样能选`);
      }

        for (const e of effects) {
          if (!e.log?.trim()) err(`${cw}：effect 缺少 log 文本`);
          checkFlagList(`${cw}.setFlags`, e.setFlags);
          checkFlagList(`${cw}.clearFlags`, e.clearFlags);
          for (const f of e.setFlags ?? []) writtenFlags.add(f);
          checkEmptyPromise(cw, e.log ?? '', e);
          for (const s of e.schedule ?? []) {
          scheduledFamilies.add(s.familyId);
          if (!FAMILY_BY_ID[s.familyId]) {
            err(`${cw}：schedule 指向不存在的事件家族 "${s.familyId}"，因果链会断在这里`);
          }
          if (s.inDays === undefined && !s.waitFor) {
            err(`${cw}：schedule 必须指定 inDays 或 waitFor`);
          }
          if (s.inDays !== undefined && s.inDays <= 0) err(`${cw}：schedule 的 inDays 必须大于 0`);
          checkQuery(`${cw}.schedule.unless`, s.unless);
          checkQuery(`${cw}.schedule.require`, s.require);
        }
        for (const u of e.unlock ?? []) {
          if (!UNLOCK_NAMES[u]) warn(`${cw}：unlock "${u}" 没有展示名`);
        }
      }
    }
  }
}

// ============================================================
// 2. 死内容检查
// ============================================================

for (const f of ALL_FAMILIES) {
  if (f.baseWeight > 0) continue;
  if (scheduledFamilies.has(f.id)) continue;
  if (PRESSURE_FAMILIES.includes(f.id)) continue;
  if (f.id === 'daily_recruit' || f.id === 'daily_crew_friction') continue;
  if (f.id.startsWith('stat_arc_')) continue;
  err(`事件家族 ${f.id}：baseWeight 为 0，又没有任何 schedule 指向它，也不在暴露度阶梯里——这是死内容`);
}

// ============================================================
// 3. 解锁与结局
// ============================================================

for (const c of CLASSES) {
  if (c.unlock && UNLOCK_COST[c.unlock] === undefined) err(`职业 ${c.id}：解锁项 ${c.unlock} 没有定价`);
}
for (const s of SITES) {
  if (s.unlock && UNLOCK_COST[s.unlock] === undefined) err(`站点 ${s.id}：解锁项 ${s.unlock} 没有定价`);
}
for (const p of SUPPLY_PACKS) {
  if (p.unlock && UNLOCK_COST[p.unlock] === undefined) err(`物资包 ${p.id}：解锁项 ${p.unlock} 没有定价`);
}
for (const e of ENDINGS) {
  checkQuery(`结局 ${e.id}.require.tags`, e.require?.tags);
  if (!e.text.trim()) err(`结局 ${e.id}：文本为空`);
  for (const u of e.unlock ?? []) {
    if (!UNLOCK_NAMES[u]) warn(`结局 ${e.id}：unlock "${u}" 没有展示名`);
  }
}
const deathCauses = new Set<string>();
for (const e of ENDINGS) for (const c of e.cause ?? []) deathCauses.add(c);
for (const need of ['饥饿', '脱水', '失温', '袭击', '精神崩溃', '辐射', '一氧化碳中毒']) {
  if (!deathCauses.has(need)) warn(`死因 "${need}" 没有对应的结局，会掉进 death_generic`);
}

// ============================================================
// 4. 事件池容量：每个（灾难 × 等级 × 天气）组合下有多少事件可用
// ============================================================

const MIN_POOL = 4;
const coverage: Array<{ combo: string; count: number; kinds: Set<string> }> = [];

for (const disaster of DISASTERS) {
  const weathers = Object.keys(disaster.weather) as WeatherId[];
  for (const threat of [1, 3, 6]) {
    for (const weather of weathers.slice(0, 3)) {
      const run = buildProbe(disaster.id, 'apartment', threat, weather);
      const facts = deriveFacts(run);
      const usable = ALL_FAMILIES.filter((f) => f.baseWeight > 0 && isEligible(f, run, facts) === null);
      const kinds = new Set(usable.map((f) => f.kind));
      coverage.push({ combo: `${disaster.name} / 等级${threat} / ${weather}`, count: usable.length, kinds });
      if (usable.length < MIN_POOL) {
        warn(
          `事件池偏薄：${disaster.name} · 末世等级 ${threat} · ${weather} 下只有 ${usable.length} 个可用事件（建议至少 ${MIN_POOL} 个）`,
        );
      }
    }
  }
}

// 站点覆盖：每个站点下是否都有足够的事件
for (const site of SITES) {
  const run = buildProbe('gridDown', site.id, 3, 'clear');
  const facts = deriveFacts(run);
  const usable = ALL_FAMILIES.filter((f) => f.baseWeight > 0 && isEligible(f, run, facts) === null);
  if (usable.length < MIN_POOL) {
    warn(`站点「${site.name}」在标准情形下只有 ${usable.length} 个可用事件`);
  }
}

/**
 * 暴露度阶梯必须在每一个（灾难 × 站点 × 天气）组合下都有可用变体。
 * 这一档压力是引擎强制插入的：如果没有变体，它会静默消失，
 * 玩家就会遇到"暴露度爆表却什么也没发生"的隐性 bug。
 */
for (const familyId of PRESSURE_FAMILIES) {
  const family = FAMILY_BY_ID[familyId];
  if (!family) {
    err(`暴露度阶梯引用了不存在的家族 ${familyId}`);
    continue;
  }
  const gaps: string[] = [];
  for (const disaster of DISASTERS) {
    const weathers = Object.keys(disaster.weather) as WeatherId[];
    for (const site of SITES) {
      if (site.wip) continue;
      for (const weather of weathers) {
        const run = buildProbe(disaster.id, site.id, 4, weather);
        run.world.exposure = 90;
        run.world.lawOrder = 12;
        run.res.ammo = 5;
        const facts = deriveFacts(run);
        if (!hasUsableVariant(family, facts)) {
          gaps.push(`${disaster.name}/${site.name}/${weather}`);
        }
      }
    }
  }
  if (gaps.length > 0) {
    err(
      `${familyId} 在 ${gaps.length} 个组合下没有可用变体，这一档压力会静默消失。例如：${gaps.slice(0, 4).join('、')}`,
    );
  }
}

// ============================================================
// 5. 叙事标签必须被读到
// ============================================================

const ENGINE_FLAGS = new Set([
  'flag:coAlarm',
  'flag:hasVehicle',
  'flag:intelBonus',
  'flag:raidDefend',
  'flag:raidHide',
  'flag:iodine',
  'flag:geiger',
  'flag:mask',
  'flag:hasPet',
  'flag:hasCart',
  'flag:rainCatcher',
  'flag:gunshotRecent',
  'flag:alarmRig',
  'flag:floodWall',
  'flag:antenna',
  'flag:warehousePickup',
  'flag:lootedNeighbor',
  'flag:scoutInside',
  'flag:knowsNorthRoute',
  'flag:petDog',
]);

for (const f of writtenFlags) {
  if (ENGINE_FLAGS.has(f)) continue;
  if (f.startsWith('flag:class')) continue;
  if (!readFlags.has(f)) {
    err(`叙事标签 ${f} 只被写入，从未被事件 require/unless/forbid 读取——玩家会感觉「选了就没了」`);
  }
}

// ============================================================
// 6. 公寓 × 核交火：本切片 schedule 必须有可用变体
// ============================================================

{
  const nuclear = DISASTERS.find((d) => d.id === 'nuclear')!;
  const weathers = Object.keys(nuclear.weather) as WeatherId[];
  const sliceFacts: Array<ReturnType<typeof deriveFacts>> = [];
  for (const weather of weathers) {
    sliceFacts.push(deriveFacts(buildProbe('nuclear', 'apartment', 3, weather)));
    const prep = createRun({
      seed: 12345,
      classId: 'clerk',
      packId: 'none',
      difficulty: 'normal',
      metaPerks: [],
      forceDisaster: 'nuclear',
    });
    chooseSite(prep, 'apartment');
    prep.world.weather = weather;
    sliceFacts.push(deriveFacts(prep));
  }

  const usableInSlice = (family: EventFamily, extraFlags: string[] = []) =>
    sliceFacts.some((facts) => hasUsableVariant(family, withFlags(facts, extraFlags)));

  for (const f of ALL_FAMILIES) {
    for (const v of f.variants) {
      const variantLive = sliceFacts.some((facts) => {
        if (v.require?.all && !v.require.all.every((t) => matches(t, facts))) return false;
        if (v.require?.any && v.require.any.length > 0 && !v.require.any.some((t) => matches(t, facts))) return false;
        if (v.require?.none && v.require.none.some((t) => matches(t, facts))) return false;
        if (v.forbid?.any && v.forbid.any.some((t) => matches(t, facts))) return false;
        if (v.forbid?.all && v.forbid.all.length > 0 && v.forbid.all.every((t) => matches(t, facts))) return false;
        return true;
      });
      if (!variantLive) continue;
      for (const c of v.choices) {
        const effects = c.check ? [c.check.ok, c.check.bad] : c.effect ? [c.effect] : [];
        for (const e of effects) {
          for (const s of e.schedule ?? []) {
            const target = FAMILY_BY_ID[s.familyId];
            if (!target) continue;
            const extra = [...(e.setFlags ?? []), ...(s.tags ?? [])];
            if (!usableInSlice(target, extra)) {
              err(
                `公寓×核交火下，${f.id}/${v.id} 预约了 ${s.familyId}，但该家族没有可用变体`,
              );
            }
          }
        }
      }
    }
  }

  const aptNuclear = buildProbe('nuclear', 'apartment', 3, 'blackRain');
  const aptFacts = deriveFacts(aptNuclear);
  const slicePool = ALL_FAMILIES.filter((f) => f.baseWeight > 0 && isEligible(f, aptNuclear, aptFacts) === null);
  if (slicePool.length < 40) {
    warn(`公寓 × 核交火生存池只有 ${slicePool.length} 个加权家族（目标约百条本局可玩）`);
  }
}

// ============================================================
// 输出
// ============================================================

function buildProbe(disaster: DisasterId, siteId: SiteId, threat: number, weather: WeatherId) {
  const run = createRun({ seed: 12345, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [], forceDisaster: disaster });
  const site = SITE_BY_ID[siteId];
  if (site?.wip) {
    run.siteId = siteId;
    for (const [k, v] of Object.entries(site.baseModules)) {
      const id = k as keyof typeof run.modules;
      run.modules[id] = Math.max(run.modules[id], v ?? 0);
    }
  } else {
    chooseSite(run, siteId);
  }
  run.day = TIME.COLLAPSE_DAY + (threat - 1) * TIME.WEEK;
  run.threat = threat;
  run.phase = 'survival';
  applyOnset(run, makeRng(1));
  run.world.weather = weather;
  return run;
}

function withFlags(facts: ReturnType<typeof deriveFacts>, extra: string[]): ReturnType<typeof deriveFacts> {
  if (extra.length === 0) return facts;
  const flags = new Set(facts.flags);
  for (const f of extra) flags.add(f);
  return { flags, nums: facts.nums };
}

function hasUsableVariant(family: EventFamily, facts: ReturnType<typeof deriveFacts>): boolean {
  return family.variants.some((v) => {
    if (v.require?.all && !v.require.all.every((t) => matches(t, facts))) return false;
    if (v.require?.any && v.require.any.length > 0 && !v.require.any.some((t) => matches(t, facts))) return false;
    if (v.require?.none && v.require.none.some((t) => matches(t, facts))) return false;
    if (v.forbid?.any && v.forbid.any.some((t) => matches(t, facts))) return false;
    if (v.forbid?.all && v.forbid.all.length > 0 && v.forbid.all.every((t) => matches(t, facts))) return false;
    return true;
  });
}

function matches(tag: string, facts: ReturnType<typeof deriveFacts>): boolean {
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
    default:
      return actual !== p.value;
  }
}

const variantCount = ALL_FAMILIES.reduce((s, f) => s + f.variants.length, 0);
const choiceCount = ALL_FAMILIES.reduce((s, f) => s + f.variants.reduce((t, v) => t + v.choices.length, 0), 0);

console.log('');
console.log('  内容规模');
console.log(`    事件家族 ${ALL_FAMILIES.length} · 变体 ${variantCount} · 选项 ${choiceCount}`);
console.log(`    灾难 ${DISASTERS.length} · 站点 ${SITES.length} · 结局 ${ENDINGS.length}`);
console.log('');

const thin = coverage.filter((c) => c.count < MIN_POOL).length;
console.log('  事件池覆盖');
console.log(`    检查了 ${coverage.length} 个（灾难 × 等级 × 天气）组合，其中 ${thin} 个偏薄`);
const avg = coverage.reduce((s, c) => s + c.count, 0) / Math.max(1, coverage.length);
console.log(`    平均可用事件 ${avg.toFixed(1)} 个`);
console.log('');

const unused = [...tagUsage.entries()].sort((a, b) => b[1] - a[1]);
console.log('  标签使用热力（前 12）');
for (const [tag, n] of unused.slice(0, 12)) {
  console.log(`    ${String(n).padStart(3)}  ${tag}`);
}
console.log('');

if (warnings.length > 0) {
  console.log(`  警告 ${warnings.length} 条`);
  for (const w of warnings) console.log(`    ! ${w}`);
  console.log('');
}

if (errors.length > 0) {
  console.log(`  错误 ${errors.length} 条`);
  for (const e of errors) console.log(`    x ${e}`);
  console.log('');
  process.exit(1);
}

console.log('  内容校验通过。');
console.log('');
