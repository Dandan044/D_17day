import '../../copy';
import { hydrateFamilies } from '../../copy/hydrate';
import type { EventFamily } from '../../types';
import { DAILY_EVENTS } from './daily';
import { ECHO_SLICE_EVENTS } from './echo_flags';
import { FILTER_BEAT_EVENTS } from './filter_beats';
import { HOOK_ARC_EVENTS } from './hook_arcs';
import { MED_PROGRESS_EVENTS } from './med_progress';
import { NUKE_APT_CHAIN_EVENTS } from './nuke_apt_chains';
import { NUKE_ARC_EVENTS } from './nuke_arcs';
import { NUKE_BUILD_CHECK_EVENTS } from './nuke_build_checks';
import { PREP_EVENTS } from './prep';
import { PREP_SLICE_EVENTS } from './prep_slice';
import { SURV_BEAT_EVENTS } from './surv_beats';
import { STAT_ARC_EVENTS } from './stat_arcs';
import { SURVIVAL_EVENTS } from './survival';

export const ALL_FAMILIES: EventFamily[] = hydrateFamilies([
  ...PREP_EVENTS,
  ...PREP_SLICE_EVENTS,
  ...SURVIVAL_EVENTS,
  ...SURV_BEAT_EVENTS,
  ...FILTER_BEAT_EVENTS,
  ...MED_PROGRESS_EVENTS,
  ...NUKE_ARC_EVENTS,
  ...NUKE_APT_CHAIN_EVENTS,
  ...NUKE_BUILD_CHECK_EVENTS,
  ...HOOK_ARC_EVENTS,
  ...ECHO_SLICE_EVENTS,
  ...DAILY_EVENTS,
  ...STAT_ARC_EVENTS,
]);

export const FAMILY_BY_ID: Record<string, EventFamily> = Object.fromEntries(ALL_FAMILIES.map((f) => [f.id, f]));

export {
  DAILY_EVENTS,
  FILTER_BEAT_EVENTS,
  HOOK_ARC_EVENTS,
  MED_PROGRESS_EVENTS,
  NUKE_APT_CHAIN_EVENTS,
  NUKE_ARC_EVENTS,
  NUKE_BUILD_CHECK_EVENTS,
  PREP_EVENTS,
  PREP_SLICE_EVENTS,
  STAT_ARC_EVENTS,
  SURV_BEAT_EVENTS,
  SURVIVAL_EVENTS,
};
