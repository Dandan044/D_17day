/**
 * 温度探针（只读，不进 verify）：
 * 用真实引擎量化各灾难的室外温度曲线与供暖经济学。
 *
 * 用法：npm run tsx -- scripts/temp-probe.ts   （或 npx tsx scripts/temp-probe.ts）
 */

import { createRun, chooseSite } from '../src/game/engine/run';
import { applyOnset, tickClimate } from '../src/game/engine/world';
import {
  comfortTemp,
  leakIndoor,
  leakRate,
  occupancyHeat,
  survivalTemp,
} from '../src/game/engine/climate';
import { threatOfDay, COLD, TIME } from '../src/game/balance';
import { makeRng } from '../src/game/rng';
import { DISASTERS } from '../src/game/content/disasters';
import type { RunState } from '../src/game/types';

const SEEDS = 240;
const FIRST = TIME.COLLAPSE_DAY;
const LAST = TIME.FINAL_DAY;

function freshRun(disaster: string, seed: number, insulate: number): RunState {
  const run = createRun({
    seed,
    classId: 'clerk',
    packId: 'none',
    difficulty: 'normal',
    metaPerks: [],
    forceDisaster: disaster as never,
  });
  chooseSite(run, 'apartment');
  run.modules.insulate = insulate;
  return run;
}

interface DaySample {
  outdoor: number;
}

/** 跑一个种子，返回 day 8..49 的室外温度序列（核冬天分支按引擎真实逻辑） */
function sampleOutdoor(disaster: string, seed: number): DaySample[] {
  const run = freshRun(disaster, seed, 0);
  const rng = makeRng(seed * 31 + 7);
  run.day = FIRST;
  run.threat = threatOfDay(FIRST);
  applyOnset(run, rng);
  const out: DaySample[] = [];
  for (let day = FIRST; day <= LAST; day++) {
    run.day = day;
    run.threat = threatOfDay(day);
    tickClimate(run, rng);
    out.push({ outdoor: run.world.temperature });
  }
  return out;
}

function mean(a: number[]): number {
  return a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
}

function pct(n: number, d: number): string {
  return `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
}

console.log('=== 室外温度曲线（引擎真实 tickClimate，' + SEEDS + ' 种子均值）===\n');
console.log(
  '灾难              日均温(D29+)  <16°天数  <4°天数  <-10°天数  <4°最长连段  D8均值  D29均值  D49均值',
);
for (const d of DISASTERS) {
  const all = Array.from({ length: SEEDS }, (_, i) => sampleOutdoor(d.id, 5000 + i * 13));
  const days = LAST - FIRST + 1;
  const perDay: number[][] = Array.from({ length: days }, () => []);
  for (const s of all) s.forEach((x, i) => perDay[i]!.push(x.outdoor));

  let belowComfort = 0;
  let belowSurvival = 0;
  let below10 = 0;
  let maxColdStreak = 0;
  for (const s of all) {
    let streak = 0;
    for (const x of s) {
      if (x.outdoor < 16) belowComfort++;
      if (x.outdoor < 4) {
        belowSurvival++;
        streak++;
        maxColdStreak = Math.max(maxColdStreak, streak);
      } else streak = 0;
      if (x.outdoor < -10) below10++;
    }
  }
  const late = perDay.slice(29 - FIRST).flat();
  const d8 = perDay[0]!;
  const d29 = perDay[29 - FIRST]!;
  const d49 = perDay[days - 1]!;
  console.log(
    `${d.id.padEnd(16)} ${mean(late).toFixed(1).padStart(9)}°C ${pct(belowComfort, SEEDS * days).padStart(8)} ${pct(belowSurvival, SEEDS * days).padStart(8)} ${pct(below10, SEEDS * days).padStart(9)} ${maxColdStreak.toString().padStart(9)}天 ${mean(d8).toFixed(1).padStart(7)}°C ${mean(d29).toFixed(1).padStart(8)}°C ${mean(d49).toFixed(1).padStart(8)}°C`,
  );
}

console.log('\n=== 无供暖（裸奔）室内温度落点（apartment，含人体热）===\n');
console.log('灾难              保温级  freeze(<4°)占比  chill(4-16°)占比  warm占比');
for (const d of DISASTERS) {
  for (const insulate of [0, 1, 2, 3]) {
    let freeze = 0;
    let chill = 0;
    let warm = 0;
    let total = 0;
    for (let i = 0; i < 60; i++) {
      const seed = 9000 + i * 17;
      const run = freshRun(d.id, seed, insulate);
      const rng = makeRng(seed + 1);
      run.day = FIRST;
      run.threat = threatOfDay(FIRST);
      applyOnset(run, rng);
      let indoor = COLD.PREP_INDOOR;
      for (let day = FIRST; day <= LAST; day++) {
        run.day = day;
        run.threat = threatOfDay(day);
        tickClimate(run, rng);
        // 每晚漏热：从昨晚室温向热汇靠拢
        indoor = leakIndoor(indoor, run.world.temperature, leakRate(run), occupancyHeat(run));
        total++;
        if (indoor < survivalTemp(run)) freeze++;
        else if (indoor < comfortTemp(run)) chill++;
        else warm++;
      }
    }
    if (insulate === 0) console.log('');
    console.log(
      `${d.id.padEnd(16)}   ${insulate}     ${pct(freeze, total).padStart(9)}        ${pct(chill, total).padStart(9)}      ${pct(warm, total).padStart(6)}`,
    );
  }
}

console.log('\n=== 理想供暖成本：每晚补到舒适线 16° 的油/电需求（apartment）===\n');
console.log('灾难              保温级  日均油(L)  日均电(kWh)  41天总油  41天总电');
for (const d of DISASTERS) {
  for (const insulate of [1, 2, 3]) {
    const run0 = freshRun(d.id, 1, insulate);
    const k = leakRate(run0);
    let totalFuel = 0;
    let totalKwh = 0;
    let days = 0;
    for (let i = 0; i < 60; i++) {
      const seed = 7000 + i * 23;
      const out = sampleOutdoor(d.id, seed);
      for (const s of out) {
        let indoor = COLD.PREP_INDOOR;
        // 逐晚：先漏热，再补到 16
        indoor = leakIndoor(indoor, s.outdoor, k, occupancyHeat(run0));
        const gap = Math.max(0, comfortTemp(run0) - indoor);
        totalFuel += gap * COLD.FUEL_PER_DEGREE;
        totalKwh += gap * COLD.ELECTRIC_PER_DEGREE;
        days++;
      }
    }
    console.log(
      `${d.id.padEnd(16)}   ${insulate}     ${(totalFuel / days).toFixed(2).padStart(7)}    ${(totalKwh / days).toFixed(2).padStart(9)}   ${(totalFuel / 60).toFixed(0).padStart(7)}   ${(totalKwh / 60).toFixed(0).padStart(7)}`,
    );
  }
}

console.log('\n（油 0.12L/度 · 电 0.16kWh/度 · 0 级保温也可供暖，每度消耗 ×2）');
