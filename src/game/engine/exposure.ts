/**
 * 暴露度：一条累积的热度条，决定"谁来找你"。
 *
 * 它不是单日噪音判定。连开三晚发电机会先招来"有人在楼下盯着你家窗户"，
 * 你不处理，两天后才是武装突袭。袭击因此有铺垫，而不是随机砸脸。
 */

import { DIFFICULTY, EXPOSURE, RAID } from '../balance';
import { SITE_BY_ID } from '../content/sites';
import type { Rng } from '../rng';
import type { ResourceId, RunState } from '../types';
import { effectiveModule } from './tags';

export const TIER_NAMES = ['无人注意', '被人看见', '被盯上了', '被标记了', '被猎捕'] as const;
export const TIER_DESC = [
  '外面没人知道这里住着人。',
  '有人注意到这栋楼还有活人。',
  '有人在观察你的作息。你出门的时间被记下来了。',
  '有组织的人已经把你列进了名单。他们会来要东西。',
  '他们不再要东西了，他们要这个地方。',
] as const;

export function exposureTier(exposure: number): number {
  const t = EXPOSURE.TIERS;
  if (exposure < t[0]!) return 0;
  if (exposure < t[1]!) return 1;
  if (exposure < t[2]!) return 2;
  if (exposure < t[3]!) return 3;
  return 4;
}

export interface ExposureBreakdown {
  total: number;
  parts: Array<{ label: string; value: number }>;
}

/** 今日会累积多少暴露度，以及各来源的明细（直接显示给玩家） */
export function dailyExposure(run: RunState): ExposureBreakdown {
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  const parts: Array<{ label: string; value: number }> = [];

  parts.push({ label: `${site.name}基础`, value: site.exposureBase * 0.25 });

  if (run.modules.power > 0) {
    const v =
      run.powerMode === 'full'
        ? EXPOSURE.SRC_POWER_FULL
        : run.powerMode === 'thrifty'
          ? EXPOSURE.SRC_POWER_THRIFTY
          : EXPOSURE.SRC_POWER_BLACKOUT;
    // 柴油机比太阳能吵得多
    const noisy = run.modules.power >= 3 ? 1.6 : 1;
    if (v > 0) parts.push({ label: run.modules.power >= 3 ? '发电机噪音' : '灯光与用电', value: v * noisy });
  }

  if (run.survivors.length > 0) {
    parts.push({ label: `${run.survivors.length} 名同伴的动静`, value: run.survivors.length * EXPOSURE.SRC_PER_COMPANION });
  }

  const conceal = effectiveModule(run, 'conceal');
  if (conceal > 0) parts.push({ label: `${conceal} 级隐蔽`, value: -conceal * EXPOSURE.CONCEAL_REDUCE });

  if (run.projects.some((p) => p.moduleId === 'conceal')) {
    parts.push({ label: '隐蔽施工中，材料堆在门口', value: 5 });
  }

  const w = run.world.weather;
  if (w === 'snow' || w === 'blizzard' || w === 'fog') {
    parts.push({ label: '天气掩盖了行踪', value: -EXPOSURE.WEATHER_COVER });
  }

  if (run.flags.includes('flag:gunshotRecent')) {
    parts.push({ label: '前几天的枪声', value: EXPOSURE.SRC_GUNSHOT * 0.5 });
  }

  const total = parts.reduce((s, p) => s + p.value, 0);
  return { total: Math.round(total * 10) / 10, parts };
}

export function applyDailyExposure(run: RunState): ExposureBreakdown {
  const b = dailyExposure(run);
  run.world.exposure = Math.max(0, Math.min(EXPOSURE.MAX, run.world.exposure + b.total));
  return b;
}

/**
 * 按暴露度档位决定今天该由谁来找你。
 * 返回事件家族 id，由导演系统去选合适的变体（洪水局是划艇来的，核战局是巡逻队）。
 */
export function pickPressureFamily(run: RunState, rng: Rng): string | null {
  const tier = exposureTier(run.world.exposure);
  if (tier === 0) return null;
  if (run.threat <= 0) return null;

  const chance = [0, 0.35, 0.5, 0.62, 0.78][tier]! * DIFFICULTY[run.difficulty].raidMult;
  if (!rng.chance(chance)) return null;

  switch (tier) {
    case 1:
      return 'pressure_passerby';
    case 2:
      return 'pressure_scout';
    case 3:
      return 'pressure_tribute';
    default:
      return 'raid_attempt';
  }
}

// ============================================================
// 袭击结算
// ============================================================

export interface RaidResult {
  repelled: boolean;
  /** 被抢走的资源 */
  lost: Partial<Record<ResourceId, number>>;
  hpLost: number;
  moduleDamaged?: string;
  usedAmmo: number;
  narrative: string;
}

export function resolveRaid(run: RunState, rng: Rng, strengthMult = 1): RaidResult {
  const fortify = effectiveModule(run, 'fortify');
  const underConstruction = run.projects.some((p) => p.moduleId === 'fortify');
  const healthyCrew = run.survivors.filter((s) => s.conditions.length === 0).length;

  let defense = fortify * RAID.FORTIFY_DEFENSE + healthyCrew * RAID.COMPANION_DEFENSE;
  let usedAmmo = 0;
  if (run.res.ammo > 0) {
    defense += RAID.ARMED_DEFENSE;
    usedAmmo = run.abilities.includes('veteran_defense') ? rng.int(1, 3) : rng.int(2, 6);
    usedAmmo = Math.min(usedAmmo, run.res.ammo);
    run.res.ammo -= usedAmmo;
    if (usedAmmo > 0 && !run.flags.includes('flag:gunshotRecent')) run.flags.push('flag:gunshotRecent');
  }
  if (run.abilities.includes('veteran_defense')) defense += 0.15;
  // 土制警报换来的三十秒，足够把顶杆架上
  if (run.flags.includes('flag:alarmRig')) defense += 0.1;
  if (run.flags.includes('flag:floodWall')) defense += 0.05;
  if (underConstruction) defense -= RAID.UNDER_CONSTRUCTION_PENALTY;
  if (run.conditions.includes('fracture') || run.conditions.includes('hypothermia')) defense -= 0.1;

  const attack = RAID.BASE * (RAID.THREAT_MULT[Math.min(6, run.threat)] ?? 1) * strengthMult;
  const successChance = Math.max(0.05, Math.min(0.95, attack - defense));
  const repelled = !rng.chance(successChance);

  const lost: Partial<Record<ResourceId, number>> = {};
  let hpLost = 0;
  let moduleDamaged: string | undefined;

  if (repelled) {
    hpLost = rng.int(0, 8);
    run.stats.hp = Math.max(1, run.stats.hp - hpLost);
    run.stats_meta.raidsRepelled += 1;
    return {
      repelled,
      lost,
      hpLost,
      usedAmmo,
      narrative:
        underConstruction
          ? '门框还没装好，但你用能搬得动的一切把入口堵住了。他们试了很久，最后走了。'
          : '门挡住了。你听着外面的动静，一直到脚步声散开。',
    };
  }

  const ratio = RAID.LOOT_RATIO[Math.min(6, run.threat)] ?? 0.2;
  const targets: ResourceId[] = ['foodStaple', 'water', 'meds', 'fuel', 'ammo', 'cash', 'parts'];
  for (const t of targets) {
    if (run.res[t] <= 0) continue;
    const take = run.res[t] * ratio * rng.float(0.7, 1.3);
    if (take < 0.1) continue;
    run.res[t] = Math.max(0, run.res[t] - take);
    lost[t] = Math.round(take * 10) / 10;
  }

  // 破门是本作唯一能当场致死的事件：被抓到并且已经很虚弱时会死人
  hpLost = rng.int(6, 22) + Math.round(run.threat * 1.5);
  run.stats.hp = Math.max(0, run.stats.hp - hpLost);
  run.stats.sanity = Math.max(0, run.stats.sanity - rng.int(4, 12));
  if (run.stats.hp > 0 && rng.chance(0.3)) {
    if (!run.conditions.includes('woundInfection')) run.conditions.push('woundInfection');
  }

  // 破门会实际损坏加固
  if (fortify > 0 && rng.chance(0.5)) {
    run.modules.fortify = Math.max(0, run.modules.fortify - 1);
    moduleDamaged = '加固';
  }

  run.world.exposure = Math.min(EXPOSURE.MAX, run.world.exposure + 6);

  return {
    repelled,
    lost,
    hpLost,
    moduleDamaged,
    usedAmmo,
    narrative: underConstruction
      ? '半拆的门框一脚就开了。你藏在里屋，听着他们把能拿的都拿走。'
      : '门开了。你没能拦住他们，只能记住这一晚。',
  };
}
