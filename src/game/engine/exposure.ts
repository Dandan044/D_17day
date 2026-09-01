/**
 * 暴露度：一条累积的热度条，决定"谁来找你"。
 *
 * 它不是单日噪音判定。连开三晚发电机会先招来"有人在楼下盯着你家窗户"，
 * 你不处理，两天后才是武装突袭。袭击因此有铺垫，而不是随机砸脸。
 */

import { DIFFICULTY, EXPOSURE, RAID } from '../balance';
import { MODULE_NAME, TIER_DESC, TIER_NAMES } from '../copy/names';
import { t } from '../copy/t';
import { SITE_BY_ID } from '../content/sites';
import type { Rng } from '../rng';
import type { ResourceId, RunState } from '../types';
import { effectiveModule } from './tags';
import { computePower, loadOnline } from './power';

export { TIER_NAMES, TIER_DESC };

export function exposureTier(exposure: number): number {
  const tiers = EXPOSURE.TIERS;
  if (exposure < tiers[0]!) return 0;
  if (exposure < tiers[1]!) return 1;
  if (exposure < tiers[2]!) return 2;
  if (exposure < tiers[3]!) return 3;
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

  parts.push({ label: t('ledger.exposure.siteBase', { site: site.name }), value: site.exposureBase * 0.25 });

  const power = computePower(run);
  if (loadOnline(run, 'lights', power)) {
    parts.push({ label: t('ledger.exposure.lights'), value: EXPOSURE.SRC_LIGHTS });
  }
  if (power.generator > 0) {
    parts.push({ label: t('ledger.exposure.generator'), value: EXPOSURE.SRC_GENERATOR });
  }

  if (run.survivors.length > 0) {
    parts.push({
      label: t('ledger.exposure.crew', { n: run.survivors.length }),
      value: run.survivors.length * EXPOSURE.SRC_PER_COMPANION,
    });
  }

  const conceal = effectiveModule(run, 'conceal');
  if (conceal > 0) parts.push({ label: t('ledger.exposure.conceal', { lvl: conceal }), value: -conceal * EXPOSURE.CONCEAL_REDUCE });

  if (run.projects.some((p) => p.moduleId === 'conceal')) {
    parts.push({ label: t('ledger.exposure.concealBuild'), value: 5 });
  }

  const w = run.world.weather;
  if (w === 'snow' || w === 'blizzard' || w === 'fog') {
    parts.push({ label: t('ledger.exposure.weather'), value: -EXPOSURE.WEATHER_COVER });
  }

  if (run.flags.includes('flag:gunshotRecent')) {
    parts.push({ label: t('ledger.exposure.gunshot'), value: EXPOSURE.SRC_GUNSHOT * 0.5 });
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
      narrative: underConstruction ? t('ledger.exposure.raidHoldBuild') : t('ledger.exposure.raidHold'),
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
    moduleDamaged = MODULE_NAME.fortify;
  }

  run.world.exposure = Math.min(EXPOSURE.MAX, run.world.exposure + 6);

  return {
    repelled,
    lost,
    hpLost,
    moduleDamaged,
    usedAmmo,
    narrative: underConstruction ? t('ledger.exposure.raidFailBuild') : t('ledger.exposure.raidFail'),
  };
}

/** 搜刮途中的真实风险：暴露、受伤、可能丢掉战利品、被人盯上 */
export function applyScavengeDanger(
  run: RunState,
  haul: { items: Array<{ res: ResourceId; amount: number; weight: number }>; danger: number },
  rng: Rng,
): { exposure: number; hpLost: number; scheduledRaid: boolean; lostRes?: ResourceId; lostAmt?: number } {
  const danger = haul.danger;
  const stealthCut = run.skills.stealth * 0.4 + effectiveModule(run, 'conceal') * 0.3;
  const expose = Math.max(0, Math.round((danger * 0.12 - stealthCut) * 10) / 10);
  run.world.exposure = Math.max(0, Math.min(EXPOSURE.MAX, run.world.exposure + expose));

  let hpLost = 0;
  if (danger >= 40 && rng.chance(0.12 + danger / 500)) {
    hpLost = rng.int(3, 10);
    run.stats.hp = Math.max(1, run.stats.hp - hpLost);
  }

  let lostRes: ResourceId | undefined;
  let lostAmt: number | undefined;
  if (danger >= 40 && haul.items.length > 0 && rng.chance(0.1 + danger / 600)) {
    const idx = rng.int(0, haul.items.length - 1);
    const it = haul.items[idx]!;
    lostRes = it.res;
    lostAmt = Math.min(it.amount, Math.round(rng.float(0.5, Math.max(0.5, it.amount * 0.4)) * 10) / 10);
    it.amount -= lostAmt;
    it.weight = it.amount <= 0 ? 0 : it.weight * (it.amount / (it.amount + lostAmt));
    if (it.amount <= 0) haul.items.splice(idx, 1);
  }

  let scheduledRaid = false;
  if (danger >= 55 && rng.chance(0.22 + (danger - 55) / 200)) {
    run.pending.push({
      familyId: run.world.exposure >= EXPOSURE.TIERS[2]! ? 'raid_attempt' : 'pressure_scout',
      dueDay: run.day + rng.int(1, 2),
      retries: 0,
      unless: { all: ['exposure:calm'] },
    });
    scheduledRaid = true;
  }

  return { exposure: expose, hpLost, scheduledRaid, lostRes, lostAmt };
}

