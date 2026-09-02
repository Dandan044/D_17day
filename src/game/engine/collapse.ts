/**
 * 崩溃日清算。
 *
 * 七天的押注在这一刻兑现：押对方向的人只是难过，押错方向的人要付利息。
 * 这里既算分，也真的施加损失——否则"猜灾难"就只是一个装饰性机制。
 */

import { DISASTER_BY_ID } from '../content/disasters';
import { MODULE_BY_ID } from '../content/modules';
import { SITE_BY_ID } from '../content/sites';
import { t } from '../copy/t';
import type { Rng } from '../rng';
import type { RunState } from '../types';
import { addCondition, addLog } from './effects';
import { hasIodinePrep } from './tags';

export interface CollapseReport {
  score: number;
  /** 做对的地方 */
  hits: string[];
  /** 代价 */
  misses: string[];
  /** 实际发生的损失 */
  losses: string[];
}

export function assessCollapse(run: RunState, rng: Rng): CollapseReport {
  const def = DISASTER_BY_ID[run.world.disaster];
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  const hits: string[] = [];
  const misses: string[] = [];
  const losses: string[] = [];

  // ---------- 关键模块 ----------
  let moduleScore = 0;
  const perModule = 100 / (def.keyModules.length * 3);
  for (const id of def.keyModules) {
    const lvl = run.modules[id];
    moduleScore += lvl * perModule;
    const name = MODULE_BY_ID[id].name;
    if (lvl >= 2) hits.push(t('ledger.collapse.moduleHit', { name, lvl }));
    else if (lvl === 0) misses.push(t('ledger.collapse.moduleMiss', { name }));
  }

  // ---------- 关键小物 ----------
  if (run.world.disaster === 'nuclear') {
    if (hasIodinePrep(run)) {
      moduleScore += 12;
      hits.push(t('ledger.collapse.iodineHit'));
    } else if (run.flags.includes('flag:sawIodineOffer')) {
      misses.push(t('ledger.collapse.iodineSaw'));
    } else {
      misses.push(t('ledger.collapse.iodineMiss'));
    }
    if (site.tags.includes('site:underground')) {
      moduleScore += 15;
      hits.push(t('ledger.collapse.underground'));
    } else if (site.tags.includes('site:highFloor')) {
      moduleScore -= 10;
      misses.push(t('ledger.collapse.highFloor'));
    }
  }
  if (run.world.disaster === 'flood') {
    if (site.tags.includes('site:floodRisk')) {
      moduleScore -= 25;
      misses.push(t('ledger.collapse.floodRisk'));
    }
    if (site.tags.includes('site:elevated') || site.tags.includes('site:highFloor')) {
      moduleScore += 18;
      hits.push(t('ledger.collapse.elevated'));
    }
  }
  if (run.world.disaster === 'volcanicWinter' || run.world.disaster === 'chemSpill') {
    if (run.modules.airFilter === 0) misses.push(t('ledger.collapse.noFilter'));
    if (run.modules.insulate >= 2) {
      moduleScore += 8;
      hits.push(t('ledger.collapse.sealed'));
    }
    if (run.flags.includes('flag:coAlarm')) hits.push(t('ledger.collapse.coAlarm'));
  }
  if (run.world.disaster === 'pandemic') {
    if (run.survivors.length > 0) {
      moduleScore -= 8;
      misses.push(t('ledger.collapse.crew'));
    }
    if (run.modules.medbay >= 1) {
      moduleScore += 10;
      hits.push(t('ledger.collapse.medbay'));
    }
  }
  if (run.world.disaster === 'gridDown') {
    if (run.modules.power >= 2) {
      moduleScore += 15;
      hits.push(t('ledger.collapse.powerHit'));
    } else if (run.modules.power === 0) {
      misses.push(t('ledger.collapse.powerMiss'));
    }
    if (run.res.fuel >= 25) hits.push(t('ledger.collapse.fuel', { n: Math.round(run.res.fuel) }));
  }

  // ---------- 基础储备 ----------
  const heads = 1 + run.survivors.length;
  const waterDays = run.res.water / (3 * heads);
  const foodDays = (run.res.foodStaple + run.res.foodFresh) / (2 * heads);
  let stockScore = 0;
  stockScore += Math.min(30, waterDays * 3);
  stockScore += Math.min(30, foodDays * 2);
  if (waterDays >= 7) hits.push(t('ledger.collapse.waterHit', { n: waterDays.toFixed(1) }));
  else misses.push(t('ledger.collapse.waterMiss', { n: waterDays.toFixed(1) }));
  if (foodDays < 7) misses.push(t('ledger.collapse.foodMiss', { n: foodDays.toFixed(1) }));

  const score = Math.max(0, Math.min(100, Math.round(moduleScore * 0.55 + stockScore * 0.45)));

  // ---------- 施加损失 ----------
  const severity = (100 - score) / 100;

  if (severity > 0.35) {
    const hp = Math.round(rng.float(4, 22) * severity);
    run.stats.hp = Math.max(5, run.stats.hp - hp);
    losses.push(t('ledger.collapse.hurt', { n: hp }));
  }
  const sanity = Math.round(rng.float(6, 20) * (0.4 + severity));
  run.stats.sanity = Math.max(5, run.stats.sanity - sanity);
  losses.push(t('ledger.collapse.sanity', { n: sanity }));

  if (severity > 0.5 && rng.chance(0.6)) {
    const lost = Math.round(run.res.water * rng.float(0.1, 0.3));
    if (lost > 0) {
      run.res.water -= lost;
      losses.push(t('ledger.collapse.waterLost', { n: lost }));
    }
  }

  // 灾难专属的即刻伤害
  if (run.world.disaster === 'nuclear' && run.modules.airFilter === 0 && run.modules.insulate < 2) {
    if (addCondition(run, 'radiationSickness')) losses.push(t('ledger.collapse.radSick'));
  }
  if (run.world.disaster === 'flood' && site.tags.includes('site:floodRisk')) {
    const lost = Math.round(run.res.materials * 0.5);
    run.res.materials -= lost;
    run.res.foodStaple = Math.max(0, run.res.foodStaple - 3);
    losses.push(t('ledger.collapse.floodLoot', { mat: lost }));
  }
  if (run.world.disaster === 'chemSpill' && run.modules.airFilter === 0) {
    run.stats.hp = Math.max(5, run.stats.hp - 10);
    losses.push(t('ledger.collapse.chem'));
  }

  const verdict =
    score >= 75
      ? t('ledger.collapse.verdict75')
      : score >= 50
        ? t('ledger.collapse.verdict50')
        : score >= 25
          ? t('ledger.collapse.verdict25')
          : t('ledger.collapse.verdict0');

  addLog(run, t('ledger.collapse.log', { title: def.revealTitle, verdict }), score >= 50 ? 'neutral' : 'bad');

  return { score, hits, misses, losses };
}
