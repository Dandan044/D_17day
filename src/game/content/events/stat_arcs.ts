import type { EventFamily } from '../../types';
import { beat, ch, rest, skip } from './factory';

/** 数值跌破阈值时强制插入的短链。首拍 weight 0。 */
export const STAT_ARC_EVENTS: EventFamily[] = [
  beat({
    id: 'stat_arc_sanity_1',
    kind: 'dream',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('listen', { stats: { sanity: -4 }, setFlags: ['flag:listenedPipe'], schedule: [{ familyId: 'stat_arc_sanity_2', waitFor: 'rest' }],  tone: 'grim' }),
      ch('tap', { stats: { sanity: 2, stamina: -2 }, setFlags: ['flag:tappedPipe'], schedule: [{ familyId: 'stat_arc_sanity_2', inDays: 2 }],  tone: 'neutral' }),
      skip({ stats: { sanity: -2 }, res: { water: -1 }, schedule: [{ familyId: 'stat_arc_sanity_2', inDays: 3 }] }),
    ],
  }),
  beat({
    id: 'stat_arc_sanity_2',
    kind: 'dream',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('write', { stats: { sanity: 4 },  tone: 'good' }),
      ch('wait', { stats: { sanity: -3 }, world: { exposure: 2 },  tone: 'neutral' }),
      skip({ stats: { stamina: -4 } }),
    ],
  }),
  beat({
    id: 'stat_arc_sanity_break',
    kind: 'dream',
    intensity: 4,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('sit', { stats: { sanity: 6, stamina: -8 },  tone: 'good' }),
      ch('eat', { res: { foodStaple: -1 }, stats: { sanity: 3, hp: 0 },  tone: 'neutral' }, { requires: { res: { foodStaple: 1 } } }),
      skip({ stats: { sanity: -6 } }),
    ],
  }),
  beat({
    id: 'stat_arc_hp_1',
    kind: 'medical',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('slow', { stats: { sanity: 2, stamina: 4 }, setFlags: ['flag:admittedHurt'], schedule: [{ familyId: 'stat_arc_hp_2', waitFor: 'treat' }],  tone: 'good' }),
      ch('ignore', { stats: { hp: -2, stamina: -8 }, schedule: [{ familyId: 'stat_arc_hp_2', inDays: 2 }],  tone: 'grim' }),
      skip({ stats: { sanity: -2, hp: -1 } }),
    ],
  }),
  beat({
    id: 'stat_arc_hp_2',
    kind: 'medical',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('clean', { res: { meds: -1, water: -1 }, stats: { sanity: 3 },  tone: 'good' }, { requires: { res: { meds: 1, water: 1 } } }),
      skip({ stats: { sanity: -3, hp: -1 } }),
    ],
  }),
  beat({
    id: 'stat_arc_hp_crit',
    kind: 'medical',
    intensity: 4,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('keep', { stats: { sanity: 2, humanity: 1 },  tone: 'neutral' }),
      ch('tear', { stats: { sanity: -4 },  tone: 'grim' }),
      skip({ stats: { stamina: -6 } }),
    ],
  }),
  beat({
    id: 'stat_arc_stamina_1',
    kind: 'medical',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('half', { stats: { stamina: 8, sanity: 1 }, setFlags: ['flag:lightPack'], schedule: [{ familyId: 'stat_arc_stamina_2', waitFor: 'scavenge' }],  tone: 'good' }),
      ch('push', { stats: { stamina: -10, hp: -1 }, schedule: [{ familyId: 'stat_arc_stamina_2', waitFor: 'scavenge' }],  tone: 'grim' }),
      skip({ stats: { stamina: 10, sanity: -2 } }),
    ],
  }),
  beat({
    id: 'stat_arc_stamina_2',
    kind: 'social',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('wave', { stats: { humanity: 2, reputation: 1, stamina: -2 },  tone: 'good' }),
      ch('hide', { stats: { sanity: -2, reputation: -1 },  tone: 'neutral' }),
      rest(),
    ],
  }),
  beat({
    id: 'stat_arc_humanity_1',
    kind: 'moral',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: { all: ['humanity:low'] },


    choices: [
      ch('nod', { stats: { sanity: -2, humanity: 2 }, setFlags: ['flag:seenFlinch'], schedule: [{ familyId: 'stat_arc_humanity_2', inDays: 2 }],  tone: 'grim' }),
      ch('speak', { stats: { reputation: 1, sanity: -3 },  tone: 'neutral' }),
      skip({ stats: { humanity: -2, sanity: -1 } }),
    ],
  }),
  beat({
    id: 'stat_arc_humanity_2',
    kind: 'moral',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('hate', { stats: { humanity: 3, sanity: -2 },  tone: 'good' }),
      ch('keep', { stats: { humanity: -3, sanity: 2 },  tone: 'grim' }),
      skip({ stats: { stamina: -2 } }),
    ],
  }),
  beat({
    id: 'stat_arc_rep_1',
    kind: 'social',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: { all: ['rep:low'] },


    choices: [
      ch('leave', { res: { water: -2 }, stats: { reputation: 3, humanity: 2 }, schedule: [{ familyId: 'stat_arc_rep_2', inDays: 3 }],  tone: 'good' }, { requires: { res: { water: 2 } } }),
      ch('wait', { world: { exposure: 3 }, stats: { sanity: -2, reputation: -1 },  tone: 'bad' }),
      skip({ stats: { sanity: -3 } }),
    ],
  }),
  beat({
    id: 'stat_arc_rep_2',
    kind: 'social',
    intensity: 1,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('keep', { stats: { sanity: 2, reputation: 1 },  tone: 'neutral' }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'stat_arc_dark_1',
    kind: 'threat',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: { all: ['light:off'] },


    choices: [
      ch('candle', { stats: { sanity: 3 }, world: { exposure: 1 }, setFlags: ['flag:darkCandle'], schedule: [{ familyId: 'stat_arc_dark_2', inDays: 2 }],  tone: 'good' }),
      ch('sit', { stats: { sanity: -3, stamina: 4 }, schedule: [{ familyId: 'stat_arc_dark_2', waitFor: 'setPowerPriority' }],  tone: 'neutral' }),
      skip({ stats: { sanity: 1 } }),
    ],
  }),
  beat({
    id: 'stat_arc_dark_2',
    kind: 'dream',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('no', { stats: { sanity: 2 }, world: { exposure: -2 },  tone: 'good' }),
      ch('yes', { stats: { sanity: -2 }, world: { exposure: 4 },  tone: 'bad' }),
      skip({ stats: { sanity: -1 } }),
    ],
  }),
];
