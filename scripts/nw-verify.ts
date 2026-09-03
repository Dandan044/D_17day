/**
 * 核冬天机制端到端验证（临时脚本，验证后可删）。
 *
 * 场景：核战局，不同保温等级 / 站点 / 取暖目标，玩家每天把取暖拉满。
 * 验证点（动态 X）：
 *   1. 威胁 4 首日（day 29）室外温度恰好 = 前一日 − X（X 由漏热率/目标室温/舒适线动态算出）
 *   2. 保温 ≤1 级：昨夜室内 < 舒适线，nw_winter_arrives 入队
 *   3. 保温 ≥2 级（且取暖目标拉满）：昨夜室内 ≥ 舒适线，nw_winter_reward 入队
 *   4. env_woke_cold 在 day 29 被抑制
 *   5. day 49 室外温度 = −35 下限
 */

import { COLD, NUCLEAR_WINTER, TIME } from '../src/game/balance';
import { applyHeatWants, comfortTemp, heatSliderMax } from '../src/game/engine/climate';
import { FAMILY_BY_ID } from '../src/game/content/events';
import { acknowledgeCollapse, chooseSite, createRun, endDay, resolveChoice } from '../src/game/engine/run';
import { makeRng } from '../src/game/rng';
import type { RunState, SiteId } from '../src/game/types';

function forceHeat(run: RunState, target: number): void {
  run.res.fuel = 999;
  run.res.parts = 999;
  run.heatTarget = target;
  const max = heatSliderMax(run);
  applyHeatWants(run, max.elecKwh, max.fuelL);
  run.res.fuel = Math.max(run.res.fuel, 999);
}

function runCase(label: string, site: SiteId, insulate: number, power: number, heatTarget: number, thickblood = false): void {
  const run = createRun({ seed: 31337, classId: 'clerk', packId: 'none', difficulty: 'story', metaPerks: [] });
  chooseSite(run, site);
  run.modules.insulate = insulate;
  run.modules.power = power;
  if (thickblood) run.abilities.push('perk_thickblood');
  acknowledgeCollapse(run);
  run.phase = 'survival';

  let report = endDay(run);
  let lastSeenOut: number | undefined;
  let result = '';

  while (run.day <= TIME.FINAL_DAY) {
    const day = run.day;
    const prevOut = lastSeenOut;
    const dropDay = run.day === TIME.COLLAPSE_DAY + (NUCLEAR_WINTER.THREAT_PHASE - 1) * TIME.WEEK;
    if (dropDay) {
      const queue = run.queue.map((q) => q.familyId);
      const x = prevOut !== undefined ? prevOut - run.world.nwStartTemp! : NaN;
      const nwArr = queue.includes('nw_winter_arrives');
      const nwRew = queue.includes('nw_winter_reward');
      const woke = queue.includes('env_woke_cold');
      const comfort = comfortTemp(run);
      const okBranch = (nwArr && run.indoorTemp < comfort) || (nwRew && run.indoorTemp >= comfort);
      result =
        `day ${day}: 昨日室外 ${prevOut} → 今日 ${run.world.temperature}（X=${x}）| 昨夜室内 ${run.indoorTemp.toFixed(1)} ` +
        `| 舒适线 ${comfort} | heatMissed=${run.heatMissed} | ` +
        `${nwArr ? '寒冬来临' : ''}${nwRew ? '奖励分支' : ''}${woke ? ' env_woke_cold(未抑制!)' : ''} | 判定=${okBranch ? '✓' : '✗'}`;
    }
    forceHeat(run, heatTarget);
    run.res.water = 50;
    run.res.foodStaple = 50;
    run.res.foodFresh = 10;
    lastSeenOut = run.world.temperature;
    for (const q of [...run.queue]) {
      const fam = FAMILY_BY_ID[q.familyId];
      const variant = fam?.variants.find((v) => v.id === q.variantId) ?? fam?.variants[0];
      if (variant) {
        const c = variant.choices[0];
        if (c) resolveChoice(run, q.familyId, q.variantId, c.id);
      }
    }
    report = endDay(run);
    if (run.phase === 'ended') break;
  }
  console.log(`[${label}] ${result} | 末局 day ${run.day}: 室外 ${run.world.temperature} 室内 ${run.indoorTemp.toFixed(1)}`);
  void report;
}

console.log('=== 核冬天动态骤降验证 ===');
runCase('公寓 保温0 拉满25', 'apartment', 0, 0, COLD.MAX_INDOOR);
runCase('公寓 保温1 拉满25', 'apartment', 1, 0, COLD.MAX_INDOOR);
runCase('公寓 保温2 拉满25', 'apartment', 2, 0, COLD.MAX_INDOOR);
runCase('公寓 保温3 拉满25', 'apartment', 3, 1, COLD.MAX_INDOOR);
runCase('农舍 保温2 拉满25', 'bungalow', 2, 0, COLD.MAX_INDOOR);
runCase('农舍 保温1 拉满25', 'bungalow', 1, 0, COLD.MAX_INDOOR);
runCase('车库 保温2 拉满25', 'garage', 2, 1, COLD.MAX_INDOOR);
runCase('公寓 保温2 目标20', 'apartment', 2, 0, 20);
runCase('公寓 保温1 目标18(默认)', 'apartment', 1, 0, 18);
runCase('公寓 保温2 拉满25 抗寒', 'apartment', 2, 0, COLD.MAX_INDOOR, true);
