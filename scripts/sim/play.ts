/**
 * 单局纯函数：创建对局 → 日循环 → Outcome。不 import store。
 */

import { MODULE_IDS } from '../../src/game/content/modules';
import { SITES } from '../../src/game/content/sites';
import { chooseSite as engineChooseSite, createRun } from '../../src/game/engine/run';
import type { Difficulty, DisasterId, SiteId } from '../../src/game/types';
import {
  attach,
  emptyCounters,
  PERSONA_BY_ID,
  playDay,
  type PersonaId,
  type PlayCounters,
} from './policy';

export interface PlayJob {
  seed: number;
  site: SiteId;
  disaster: DisasterId;
  difficulty: Difficulty;
  persona: PersonaId;
}

export interface Outcome {
  seed: number;
  site: SiteId;
  disaster: string;
  persona: PersonaId;
  days: number;
  threat: number;
  endingId: string;
  cause?: string;
  finalModules: number;
  crew: number;
  dayScavenges: number;
  nightScavenges: number;
  hires: number;
  eventScoreAvg: number;
}

export interface PlayError {
  seed: number;
  day: number;
  message: string;
}

export interface PlayResult {
  outcomes: Outcome[];
  errors: PlayError[];
}

const SITE_BY_ID = Object.fromEntries(SITES.map((s) => [s.id, s]));

function injectSiteGate(run: ReturnType<typeof createRun>, siteId: SiteId): void {
  const site = SITE_BY_ID[siteId];
  if (!site) return;
  if (site.cost.cash) run.res.cash += site.cost.cash;
  if (site.cost.requires?.res?.parts) run.res.parts += site.cost.requires.res.parts;
  if (site.cost.requires?.skills?.negotiation) {
    run.skills.negotiation = site.cost.requires.skills.negotiation;
  }
  if (site.cost.requires?.tags?.all?.includes('hasVehicle')) run.hasVehicle = true;
}

export function playRun(job: PlayJob): { outcome?: Outcome; error?: PlayError } {
  const persona = PERSONA_BY_ID[job.persona];
  const counters: PlayCounters = emptyCounters();
  let run;
  try {
    run = createRun({
      seed: job.seed,
      classId: 'clerk',
      packId: 'none',
      difficulty: job.difficulty,
      metaPerks: [],
      forceDisaster: job.disaster,
    });
    injectSiteGate(run, job.site);
    const picked = engineChooseSite(run, job.site);
    if (!picked.ok) engineChooseSite(run, 'apartment');
  } catch (e) {
    return { error: { seed: job.seed, day: 0, message: `创建失败：${(e as Error).message}` } };
  }

  const s = attach(run);
  let cause: string | undefined;
  let guard = 0;
  while (s.run.phase !== 'ended' && guard++ < 80) {
    try {
      const c = playDay(s, persona, counters);
      if (c) cause = c;
    } catch (e) {
      return {
        outcome: snapshot(job, s.run, cause, counters),
        error: { seed: job.seed, day: s.run.day, message: (e as Error).message },
      };
    }
  }

  return { outcome: snapshot(job, s.run, cause, counters) };
}

function snapshot(
  job: PlayJob,
  run: ReturnType<typeof createRun>,
  cause: string | undefined,
  counters: PlayCounters,
): Outcome {
  return {
    seed: job.seed,
    site: run.siteId ?? job.site,
    disaster: run.world.disaster,
    persona: job.persona,
    days: Math.max(0, run.day - 1),
    threat: run.threat,
    endingId: run.endingId ?? 'unfinished',
    cause,
    finalModules: MODULE_IDS.reduce((sum, m) => sum + run.modules[m], 0),
    crew: run.survivors.length,
    dayScavenges: counters.dayScavenges,
    nightScavenges: counters.nightScavenges,
    hires: counters.hires,
    eventScoreAvg: counters.eventPicks > 0 ? counters.eventScoreSum / counters.eventPicks : 0,
  };
}

export function playJobs(jobs: PlayJob[]): PlayResult {
  const outcomes: Outcome[] = [];
  const errors: PlayError[] = [];
  for (const job of jobs) {
    const r = playRun(job);
    if (r.outcome) outcomes.push(r.outcome);
    if (r.error) errors.push(r.error);
  }
  return { outcomes, errors };
}
