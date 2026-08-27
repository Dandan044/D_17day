import type { EventFamily } from '../../types';
import { DAILY_EVENTS } from './daily';
import { PREP_EVENTS } from './prep';
import { SURVIVAL_EVENTS } from './survival';

export const ALL_FAMILIES: EventFamily[] = [...PREP_EVENTS, ...SURVIVAL_EVENTS, ...DAILY_EVENTS];

export const FAMILY_BY_ID: Record<string, EventFamily> = Object.fromEntries(ALL_FAMILIES.map((f) => [f.id, f]));

export { DAILY_EVENTS, PREP_EVENTS, SURVIVAL_EVENTS };
