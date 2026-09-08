/**
 * 无头模拟：用若干人格策略跑很多局，验证平衡并抓运行时错误。
 *
 * 用法：
 *   npm run sim -- 240
 *   npm run sim -- 240 harsh
 *   npm run sim -- 240 normal all
 *   npm run sim -- 240 normal oracle
 *   npm run sim -- 240 normal passable --jobs 1
 *   npm run sim -- 1000 normal passable --disaster nuclear --site apartment
 */

import { availableParallelism, cpus } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { TIME } from '../src/game/balance';
import { DISASTERS } from '../src/game/content/disasters';
import { ENDING_BY_ID } from '../src/game/content/endings';
import { SITES } from '../src/game/content/sites';
import type { Difficulty, DisasterId, SiteId } from '../src/game/types';
import { parsePersona, PERSONA_IDS, PERSONA_LABEL, type PersonaId } from './sim/policy';
import { playJobs, type Outcome, type PlayError, type PlayJob } from './sim/play';

interface Cli {
  n: number;
  difficulty: Difficulty;
  persona: PersonaId | 'all';
  jobs: number;
  disaster?: DisasterId;
  site?: SiteId;
}

function parseFlag(argv: string[], i: number, name: string): { value: string; next: number } | null {
  const a = argv[i]!;
  if (a === `--${name}`) return { value: argv[i + 1] ?? '', next: i + 1 };
  if (a.startsWith(`--${name}=`)) return { value: a.slice(`--${name}=`.length), next: i };
  return null;
}

function parseCli(argv: string[]): Cli {
  const positional: string[] = [];
  let jobs: number | undefined;
  let disaster: DisasterId | undefined;
  let site: SiteId | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const j = parseFlag(argv, i, 'jobs');
    if (j) {
      jobs = Number(j.value);
      i = j.next;
      continue;
    }
    const d = parseFlag(argv, i, 'disaster');
    if (d) {
      disaster = d.value as DisasterId;
      i = d.next;
      continue;
    }
    const s = parseFlag(argv, i, 'site');
    if (s) {
      site = s.value as SiteId;
      i = s.next;
      continue;
    }
    if (a.startsWith('--')) throw new Error(`未知参数：${a}`);
    positional.push(a);
  }
  const n = Number(positional[0] ?? 120);
  const difficulty = (positional[1] as Difficulty) ?? 'normal';
  if (!['story', 'normal', 'harsh'].includes(difficulty)) {
    throw new Error(`未知难度：${difficulty}`);
  }
  const persona = parsePersona(positional[2]);
  const cpu = Math.max(1, typeof availableParallelism === 'function' ? availableParallelism() : cpus().length);
  const defaultJobs = Math.min(cpu, 8);
  if (disaster && !DISASTERS.some((x) => x.id === disaster)) {
    throw new Error(`未知灾难：${disaster}`);
  }
  if (site && !SITES.some((x) => x.id === site)) {
    throw new Error(`未知站点：${site}`);
  }
  return {
    n: Number.isFinite(n) && n > 0 ? n : 120,
    difficulty,
    persona,
    jobs: jobs && jobs > 0 ? Math.floor(jobs) : defaultJobs,
    disaster,
    site,
  };
}

const cli = parseCli(process.argv.slice(2));
const PLAYABLE_SITES = SITES.filter((s) => !s.wip && (!cli.site || s.id === cli.site));
const SAMPLE_DISASTERS = DISASTERS.filter((d) => !cli.disaster || d.id === cli.disaster);
if (PLAYABLE_SITES.length === 0) throw new Error(`没有可玩站点${cli.site ? `：${cli.site}` : ''}`);
if (SAMPLE_DISASTERS.length === 0) throw new Error(`没有可采样灾难${cli.disaster ? `：${cli.disaster}` : ''}`);
const SEEDS_PER_CELL = Math.max(1, Math.round(cli.n / (PLAYABLE_SITES.length * SAMPLE_DISASTERS.length)));
const personas: PersonaId[] = cli.persona === 'all' ? PERSONA_IDS : [cli.persona];

function buildJobs(): PlayJob[] {
  const jobs: PlayJob[] = [];
  let rot = 0;
  for (let si = 0; si < PLAYABLE_SITES.length; si++) {
    for (let di = 0; di < SAMPLE_DISASTERS.length; di++) {
      for (let k = 0; k < SEEDS_PER_CELL; k++) {
        jobs.push({
          seed: 1000 + (si * SAMPLE_DISASTERS.length + di) * 7919 + k * 104729,
          site: PLAYABLE_SITES[si]!.id,
          disaster: SAMPLE_DISASTERS[di]!.id,
          difficulty: cli.difficulty,
          persona: personas[rot++ % personas.length]!,
        });
      }
    }
  }
  return jobs;
}

function split<T>(items: T[], parts: number): T[][] {
  const n = Math.max(1, Math.min(parts, items.length));
  const out: T[][] = Array.from({ length: n }, () => []);
  items.forEach((item, i) => out[i % n]!.push(item));
  return out.filter((b) => b.length > 0);
}

function runShard(jobs: PlayJob[]): Promise<{ outcomes: Outcome[]; errors: PlayError[] }> {
  return new Promise((resolve, reject) => {
    const worker = fileURLToPath(new URL('./sim/worker.ts', import.meta.url));
    const child = spawn(process.execPath, [...process.execArgv, worker], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    let buf = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d: string) => {
      buf += d;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`worker 退出码 ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(buf) as { outcomes: Outcome[]; errors: PlayError[] });
      } catch (e) {
        reject(new Error(`worker 输出无法解析：${(e as Error).message}`));
      }
    });
    child.stdin.write(JSON.stringify(jobs));
    child.stdin.end();
  });
}

async function runAll(jobs: PlayJob[]): Promise<{ outcomes: Outcome[]; errors: PlayError[] }> {
  if (cli.jobs <= 1 || jobs.length <= 1) {
    return playJobs(jobs);
  }
  const shards = split(jobs, cli.jobs);
  console.log(`  并行 ${shards.length} 进程 · 每片约 ${shards[0]!.length} 局`);
  try {
    const done: Outcome[] = [];
    const errors: PlayError[] = [];
    let finished = 0;
    const started = Date.now();
    await Promise.all(
      shards.map(async (shard) => {
        const r = await runShard(shard);
        finished += shard.length;
        done.push(...r.outcomes);
        errors.push(...r.errors);
        const sec = (Date.now() - started) / 1000;
        const rate = finished / Math.max(0.001, sec);
        console.log(`  … ${finished}/${jobs.length} 局  ${rate.toFixed(1)} 局/秒`);
      }),
    );
    return { outcomes: done, errors };
  } catch (e) {
    console.log(`  并行失败，改走单进程：${(e as Error).message}`);
    return playJobs(jobs);
  }
}

function pct(n: number, total: number): string {
  return `${((n / Math.max(1, total)) * 100).toFixed(1)}%`;
}

function printReport(
  outcomes: Outcome[],
  errors: PlayError[],
  elapsedMs: number,
): void {
  const finished = outcomes.filter((o) => o.endingId !== 'unfinished');
  const wins = finished.filter((o) => ENDING_BY_ID[o.endingId]?.kind === 'win');
  const avgDays = outcomes.reduce((s, o) => s + o.days, 0) / Math.max(1, outcomes.length);
  const avgModules = outcomes.reduce((s, o) => s + o.finalModules, 0) / Math.max(1, outcomes.length);
  const sec = elapsedMs / 1000;
  const rate = outcomes.length / Math.max(0.001, sec);
  const personaLabel =
    cli.persona === 'all' ? '全人格轮转' : PERSONA_LABEL[cli.persona];

  console.log('');
  console.log(`  模拟 ${outcomes.length} 局 · 难度 ${cli.difficulty} · 策略：${personaLabel}`);
  console.log(
    `  全因子采样：${PLAYABLE_SITES.length} 站点 × ${SAMPLE_DISASTERS.length} 灾难 × ${SEEDS_PER_CELL} 组种子（每格 ${SEEDS_PER_CELL} 局）`,
  );
  console.log(`  耗时 ${sec.toFixed(1)} 秒 · ${rate.toFixed(1)} 局/秒 · jobs=${cli.jobs}`);
  if (SEEDS_PER_CELL < 20) {
    console.log(
      `  注：每格 ${SEEDS_PER_CELL} 局，看边际（每站点/每灾难 ${SEEDS_PER_CELL * SAMPLE_DISASTERS.length} 局）够了；` +
        `要比较单个组合请加大 N（例如 720 → 每格 20 局）`,
    );
  }
  console.log('');
  console.log(`  通关率        ${pct(wins.length, outcomes.length)}  (${wins.length}/${outcomes.length})`);
  console.log(`  平均存活      ${avgDays.toFixed(1)} 天 / ${TIME.FINAL_DAY}`);
  console.log(`  平均模块总级  ${avgModules.toFixed(1)} / 30`);
  console.log('');

  if (personas.length > 1 || outcomes.some((o) => o.persona !== 'passable')) {
    const byPersona = new Map<string, { n: number; wins: number; days: number; night: number; hire: number }>();
    for (const o of outcomes) {
      const cur = byPersona.get(o.persona) ?? { n: 0, wins: 0, days: 0, night: 0, hire: 0 };
      cur.n += 1;
      cur.days += o.days;
      cur.night += o.nightScavenges;
      cur.hire += o.hires;
      if (ENDING_BY_ID[o.endingId]?.kind === 'win') cur.wins += 1;
      byPersona.set(o.persona, cur);
    }
    console.log('  按人格');
    for (const id of PERSONA_IDS.filter((p) => byPersona.has(p))) {
      const v = byPersona.get(id)!;
      console.log(
        `    ${PERSONA_LABEL[id].padEnd(8)} 通关 ${pct(v.wins, v.n).padStart(6)}  平均 ${(v.days / v.n).toFixed(1).padStart(5)} 天  夜探 ${v.night}  雇工 ${v.hire}  n=${v.n}`,
      );
    }
    console.log('');
  }

  const byDisaster = new Map<string, { n: number; days: number; wins: number }>();
  for (const o of outcomes) {
    const cur = byDisaster.get(o.disaster) ?? { n: 0, days: 0, wins: 0 };
    cur.n += 1;
    cur.days += o.days;
    if (ENDING_BY_ID[o.endingId]?.kind === 'win') cur.wins += 1;
    byDisaster.set(o.disaster, cur);
  }
  console.log('  按灾难（通关率升序）');
  for (const [k, v] of [...byDisaster.entries()].sort((a, b) => a[1].wins / a[1].n - b[1].wins / b[1].n)) {
    console.log(
      `    ${k.padEnd(16)} 平均 ${(v.days / v.n).toFixed(1).padStart(5)} 天   通关 ${pct(v.wins, v.n).padStart(6)}   n=${v.n}`,
    );
  }
  const dRates = [...byDisaster.values()].map((v) => (v.wins / v.n) * 100);
  if (dRates.length) {
    console.log(
      `    通关率极差 ${(Math.max(...dRates) - Math.min(...dRates)).toFixed(1)} 个百分点` +
        `  (${Math.min(...dRates).toFixed(1)}% ~ ${Math.max(...dRates).toFixed(1)}%)`,
    );
  }
  console.log('');

  const bySite = new Map<string, { n: number; days: number; wins: number }>();
  for (const o of outcomes) {
    const cur = bySite.get(o.site) ?? { n: 0, days: 0, wins: 0 };
    cur.n += 1;
    cur.days += o.days;
    if (ENDING_BY_ID[o.endingId]?.kind === 'win') cur.wins += 1;
    bySite.set(o.site, cur);
  }
  console.log('  按站点（通关率升序）');
  for (const [k, v] of [...bySite.entries()].sort((a, b) => a[1].wins / a[1].n - b[1].wins / b[1].n)) {
    console.log(
      `    ${k.padEnd(16)} 平均 ${(v.days / v.n).toFixed(1).padStart(5)} 天   通关 ${pct(v.wins, v.n).padStart(6)}   n=${v.n}`,
    );
  }
  const sRates = [...bySite.values()].map((v) => (v.wins / v.n) * 100);
  if (sRates.length) {
    console.log(
      `    通关率极差 ${(Math.max(...sRates) - Math.min(...sRates)).toFixed(1)} 个百分点` +
        `  (${Math.min(...sRates).toFixed(1)}% ~ ${Math.max(...sRates).toFixed(1)}%)`,
    );
  }
  console.log('');

  console.log('  最难的两种灾难，死因构成');
  const hardest = [...byDisaster.entries()].sort((a, b) => a[1].days / a[1].n - b[1].days / a[1].n).slice(0, 2);
  for (const [disaster] of hardest) {
    const causes = new Map<string, number>();
    for (const o of outcomes.filter((x) => x.disaster === disaster)) {
      const def = ENDING_BY_ID[o.endingId];
      if (!def || def.kind === 'win') continue;
      causes.set(def.subtitle, (causes.get(def.subtitle) ?? 0) + 1);
    }
    const parts = [...causes.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`);
    console.log(`    ${disaster.padEnd(16)} ${parts.join(' · ') || '（无失败局）'}`);
  }
  console.log('');

  const byEnding = new Map<string, number>();
  for (const o of outcomes) byEnding.set(o.endingId, (byEnding.get(o.endingId) ?? 0) + 1);
  console.log('  结局分布');
  for (const [k, v] of [...byEnding.entries()].sort((a, b) => b[1] - a[1])) {
    const def = ENDING_BY_ID[k];
    console.log(
      `    ${(def ? `${def.name}（${def.subtitle}）` : k).padEnd(24)} ${String(v).padStart(4)}   ${pct(v, outcomes.length)}`,
    );
  }
  console.log('');

  if (errors.length > 0) {
    console.log(`  运行时错误 ${errors.length} 条`);
    const seen = new Set<string>();
    for (const e of errors) {
      if (seen.has(e.message)) continue;
      seen.add(e.message);
      console.log(`    x 第 ${e.day} 天 seed=${e.seed}：${e.message}`);
    }
    console.log('');
    process.exitCode = 1;
    return;
  }
  console.log('  模拟未出现运行时错误。');
  console.log('');
}

const jobs = buildJobs();
const t0 = Date.now();
const { outcomes, errors } = await runAll(jobs);
printReport(outcomes, errors, Date.now() - t0);
