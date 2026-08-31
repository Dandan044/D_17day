import type { EventFamily } from '../../types';
import { DAILY_EVENTS } from './daily';
import { ECHO_SLICE_EVENTS } from './echo_flags';
import { HOOK_ARC_EVENTS } from './hook_arcs';
import { NUKE_ARC_EVENTS } from './nuke_arcs';
import { PREP_EVENTS } from './prep';
import { PREP_SLICE_EVENTS } from './prep_slice';
import { SURV_BEAT_EVENTS } from './surv_beats';
import { STAT_ARC_EVENTS } from './stat_arcs';
import { SURVIVAL_EVENTS } from './survival';

export const ALL_FAMILIES: EventFamily[] = [
  ...PREP_EVENTS,
  ...PREP_SLICE_EVENTS,
  ...SURVIVAL_EVENTS,
  ...SURV_BEAT_EVENTS,
  ...NUKE_ARC_EVENTS,
  ...HOOK_ARC_EVENTS,
  ...ECHO_SLICE_EVENTS,
  ...DAILY_EVENTS,
  ...STAT_ARC_EVENTS,
];

export const FAMILY_BY_ID: Record<string, EventFamily> = Object.fromEntries(ALL_FAMILIES.map((f) => [f.id, f]));

export { DAILY_EVENTS, HOOK_ARC_EVENTS, NUKE_ARC_EVENTS, PREP_EVENTS, PREP_SLICE_EVENTS, STAT_ARC_EVENTS, SURV_BEAT_EVENTS, SURVIVAL_EVENTS };
