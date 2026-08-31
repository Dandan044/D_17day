/**
 * 崩溃日清算。
 *
 * 七天的押注在这一刻兑现：押对方向的人只是难过，押错方向的人要付利息。
 * 这里既算分，也真的施加损失——否则"猜灾难"就只是一个装饰性机制。
 */

import { DISASTER_BY_ID } from '../content/disasters';
import { MODULE_BY_ID } from '../content/modules';
import { SITE_BY_ID } from '../content/sites';
import type { Rng } from '../rng';
import type { RunState } from '../types';
import { addCondition, addLog } from './effects';

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
    if (lvl >= 2) hits.push(`${name}已到 ${lvl} 级，这正是这场灾难最需要的`);
    else if (lvl === 0) misses.push(`${name}还是 0 级，而它是这场灾难的核心防线`);
  }

  // ---------- 关键小物 ----------
  if (run.world.disaster === 'nuclear') {
    if (run.flags.includes('flag:iodine')) {
      moduleScore += 12;
      hits.push('你备了碘片。接下来几天，它会替你的甲状腺挡下大部分剂量');
    } else if (run.flags.includes('flag:sawIodineOffer')) {
      misses.push('没有碘片。药店里那两盒你没买');
    } else {
      misses.push('你没备碘片。核沉降对甲状腺不客气');
    }
    if (site.tags.includes('site:underground')) {
      moduleScore += 15;
      hits.push('你在地下。混凝土顶板是最诚实的屏蔽');
    } else if (site.tags.includes('site:highFloor')) {
      moduleScore -= 10;
      misses.push('六楼。你离沉降物比任何人都近');
    }
  }
  if (run.world.disaster === 'flood') {
    if (site.tags.includes('site:floodRisk')) {
      moduleScore -= 25;
      misses.push('你选了会内涝的地方。水正在往下走，而你在最下面');
    }
    if (site.tags.includes('site:elevated') || site.tags.includes('site:highFloor')) {
      moduleScore += 18;
      hits.push('你在高处。这一次，高度就是一切');
    }
  }
  if (run.world.disaster === 'volcanicWinter' || run.world.disaster === 'chemSpill') {
    if (run.modules.airFilter === 0) misses.push('没有空气过滤。你唯一的防线是一包一次性口罩');
    if (run.modules.insulate >= 2) {
      moduleScore += 8;
      hits.push('密封做得不错，外面的东西进不来');
    }
    if (run.flags.includes('flag:coAlarm')) hits.push('你买了一氧化碳报警器。密封屋子里烧火的时候，它会救你一次');
  }
  if (run.world.disaster === 'pandemic') {
    if (run.survivors.length > 0) {
      moduleScore -= 8;
      misses.push('屋里不止你一个人。潜伏期意味着你不知道谁已经带上了它');
    }
    if (run.modules.medbay >= 1) {
      moduleScore += 10;
      hits.push('有处置台和分类药柜，这会决定同一份药能救回多少');
    }
  }
  if (run.world.disaster === 'gridDown') {
    if (run.modules.power >= 2) {
      moduleScore += 15;
      hits.push('你有自己的电。从今天起，城里大多数人都没有');
    } else if (run.modules.power === 0) {
      misses.push('没有发电。所有插电的东西从此刻起全部作废');
    }
    if (run.res.fuel >= 25) hits.push(`储了 ${Math.round(run.res.fuel)} L 燃料，停电之后它比现金好用`);
  }

  // ---------- 基础储备 ----------
  const heads = 1 + run.survivors.length;
  const waterDays = run.res.water / (3 * heads);
  const foodDays = (run.res.foodStaple + run.res.foodFresh) / (2 * heads);
  let stockScore = 0;
  stockScore += Math.min(30, waterDays * 3);
  stockScore += Math.min(30, foodDays * 2);
  if (waterDays >= 7) hits.push(`储水够喝 ${waterDays.toFixed(1)} 天`);
  else misses.push(`储水只够 ${waterDays.toFixed(1)} 天，而自来水刚刚停了`);
  if (foodDays < 7) misses.push(`食物只够 ${foodDays.toFixed(1)} 天`);

  const score = Math.max(0, Math.min(100, Math.round(moduleScore * 0.55 + stockScore * 0.45)));

  // ---------- 施加损失 ----------
  const severity = (100 - score) / 100;

  if (severity > 0.35) {
    const hp = Math.round(rng.float(4, 22) * severity);
    run.stats.hp = Math.max(5, run.stats.hp - hp);
    losses.push(`混乱中你受了伤，生命 -${hp}`);
  }
  const sanity = Math.round(rng.float(6, 20) * (0.4 + severity));
  run.stats.sanity = Math.max(5, run.stats.sanity - sanity);
  losses.push(`理智 -${sanity}`);

  if (severity > 0.5 && rng.chance(0.6)) {
    const lost = Math.round(run.res.water * rng.float(0.1, 0.3));
    if (lost > 0) {
      run.res.water -= lost;
      losses.push(`储水在慌乱中损失了 ${lost} L`);
    }
  }

  // 灾难专属的即刻伤害
  if (run.world.disaster === 'nuclear' && run.modules.airFilter === 0 && run.modules.insulate < 2) {
    if (addCondition(run, 'radiationSickness')) losses.push('你吸入了沉降物：辐射病');
  }
  if (run.world.disaster === 'flood' && site.tags.includes('site:floodRisk')) {
    const lost = Math.round(run.res.materials * 0.5);
    run.res.materials -= lost;
    run.res.foodStaple = Math.max(0, run.res.foodStaple - 3);
    losses.push(`低处的东西全泡了：建材 -${lost}，食物 -3`);
  }
  if (run.world.disaster === 'chemSpill' && run.modules.airFilter === 0) {
    run.stats.hp = Math.max(5, run.stats.hp - 10);
    losses.push('那股味道进了屋子。你咳了一整夜，生命 -10');
  }

  const verdict =
    score >= 75
      ? '你准备得比这座城市里几乎所有人都好。'
      : score >= 50
        ? '你有一些东西是对的，也有一些账要在后面还。'
        : score >= 25
          ? '你押错了方向。接下来的每一天都会提醒你这件事。'
          : '你几乎什么都没准备对。';

  addLog(run, `${def.revealTitle}。${verdict}`, score >= 50 ? 'neutral' : 'bad');

  return { score, hits, misses, losses };
}
