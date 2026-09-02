import type { EventFamily } from '../../types';
import { beat, ch, skip } from './factory';
import { APT, HIGH, NUC } from './queries';

/** 核战 / 六楼专属链。后续拍 weight 0，由 schedule 或 waitFor 接入。 */
export const NUKE_ARC_EVENTS: EventFamily[] = [
  beat({
    id: 'nuke_arc_blackrain_1',
    kind: 'weather',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 10,
    require: NUC,


    choices: [
      ch('seal', { res: { materials: -2 }, stats: { stamina: -10 }, world: { radiation: -2 }, setFlags: ['flag:sealedBlackRain'], schedule: [{ familyId: 'nuke_arc_blackrain_2', inDays: 2 }],  tone: 'good' }, { requires: { res: { materials: 2 } } }),
      ch('sample', { stats: { sanity: -4 }, world: { radiation: 3 }, setFlags: ['flag:sampledRain'], schedule: [{ familyId: 'nuke_arc_blackrain_2', waitFor: 'maintain' }],  tone: 'grim' }),
      skip({ setFlags: ['flag:hidFromRain'], schedule: [{ familyId: 'nuke_arc_blackrain_2', inDays: 3 }] }),
    ],
  }),
  beat({
    id: 'nuke_arc_blackrain_2',
    kind: 'medical',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: { any: ['flag:sealedBlackRain', 'flag:sampledRain', 'flag:hidFromRain'] },


    choices: [
      ch('wipe_mask', { stats: { stamina: -12, sanity: -3 }, world: { radiation: -1, exposure: 2 }, setFlags: ['flag:baggedAsh'], schedule: [{ familyId: 'nuke_arc_blackrain_3', inDays: 4 }],  tone: 'neutral' }),
      ch('leave_ash', { stats: { sanity: -5 }, world: { radiation: 2 }, setFlags: ['flag:leftAsh'], schedule: [{ familyId: 'nuke_arc_blackrain_3', waitFor: 'endDay' }],  tone: 'bad' }),
      skip({ stats: { sanity: -2 }, schedule: [{ familyId: 'nuke_arc_blackrain_3', inDays: 5 }] }),
    ],
  }),
  beat({
    id: 'nuke_arc_blackrain_3',
    kind: 'weather',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('prep', { res: { materials: -1 }, world: { exposure: -4, radiation: -1 }, stats: { stamina: -8 },  tone: 'good' }, { requires: { res: { materials: 1 } } }),
      ch('pills', { res: { meds: -1 }, stats: { sanity: 3 }, setFlags: ['flag:iodine'],  tone: 'good' }, { requires: { res: { meds: 1 } } }),
      skip({ stats: { sanity: -4, hp: -2 } }),
    ],
  }),
  beat({
    id: 'nuke_arc_levy_1',
    kind: 'threat',
    intensity: 4,
    phase: ['survival'],
    once: true,
    weight: 8,
    minThreat: 2,
    require: APT,


    choices: [
      ch('hide', { stats: { stamina: -10, sanity: -3 }, world: { exposure: -3 }, setFlags: ['flag:hidFromLevy'], schedule: [{ familyId: 'nuke_arc_levy_2', inDays: 2, waitFor: ['raid', 'raidFailed', 'raidRepelled'] }],  tone: 'neutral' }),
      ch('give', { res: { foodStaple: -4, water: -6 }, world: { exposure: -6 }, stats: { sanity: 2 }, setFlags: ['flag:paidLevy'], schedule: [{ familyId: 'nuke_arc_levy_2', inDays: 3 }],  tone: 'neutral' }, { requires: { res: { foodStaple: 4, water: 6 } } }),
      skip({ world: { exposure: 4 }, setFlags: ['flag:ignoredLevy'], schedule: [{ familyId: 'nuke_arc_levy_2', inDays: 1 }] }),
    ],
  }),
  beat({
    id: 'nuke_arc_levy_2',
    kind: 'threat',
    intensity: 4,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: { any: ['flag:hidFromLevy', 'flag:paidLevy', 'flag:ignoredLevy'] },


    choices: [
      ch('talk', { stats: { sanity: -4 }, world: { exposure: 3 }, setFlags: ['flag:talkedLevy'],  tone: 'bad' }),
      ch('pay_again', { res: { foodStaple: -2 }, world: { exposure: -2 },  tone: 'neutral' }, { requires: { res: { foodStaple: 2 } } }),
      skip({ world: { exposure: 6 }, schedule: [{ familyId: 'raid_attempt', inDays: 2 }] }),
    ],
  }),
  beat({
    id: 'nuke_arc_balcony_1',
    kind: 'weather',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 8,
    require: HIGH,


    choices: [
      ch('brace', { res: { materials: -3 }, stats: { stamina: -14 }, setFlags: ['flag:bracedBalcony'], schedule: [{ familyId: 'nuke_arc_balcony_2', inDays: 3 }],  tone: 'good' }, { requires: { res: { materials: 3 } } }),
      ch('abandon', { res: { materials: -1 }, stats: { sanity: -3 }, setFlags: ['flag:abandonedBalcony'], schedule: [{ familyId: 'nuke_arc_balcony_2', waitFor: 'build' }],  tone: 'neutral' }, { requires: { res: { materials: 1 } } }),
      skip({ setFlags: ['flag:ignoredBalcony'], schedule: [{ familyId: 'nuke_arc_balcony_2', inDays: 4 }] }),
    ],
  }),
  beat({
    id: 'nuke_arc_balcony_2',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('look', { stats: { stamina: -6, sanity: -4 }, world: { exposure: 2 }, setFlags: ['flag:sawDrop'],  tone: 'grim' }),
      ch('ignore_drop', { stats: { sanity: -6 },  tone: 'neutral' }),
      skip({ stats: { stamina: -4 } }),
    ],
  }),
  beat({
    id: 'nuke_arc_stair_1',
    kind: 'social',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 8,
    require: HIGH,


    choices: [
      ch('detour', { stats: { stamina: -12 }, world: { exposure: -2 }, setFlags: ['flag:usedFireExit'], schedule: [{ familyId: 'nuke_arc_stair_2', waitFor: 'scavenge' }],  tone: 'neutral' }),
      ch('note', { stats: { humanity: 2, reputation: 1 }, world: { neighborhood: 2 }, setFlags: ['flag:stairNote'], schedule: [{ familyId: 'nuke_arc_stair_2', inDays: 2 }],  tone: 'good' }),
      skip({ world: { exposure: 3 }, setFlags: ['flag:tiptoedStair'], schedule: [{ familyId: 'nuke_arc_stair_2', inDays: 3 }] }),
    ],
  }),
  beat({
    id: 'nuke_arc_stair_2',
    kind: 'moral',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('food', { res: { foodStaple: -2 }, stats: { humanity: 4, sanity: 2 }, world: { exposure: 4 }, setFlags: ['flag:fedStairKid'],  tone: 'good' }, { requires: { res: { foodStaple: 2 } } }),
      ch('warn', { stats: { humanity: 2 },  tone: 'neutral' }),
      skip({ stats: { humanity: -2, sanity: -2 } }),
    ],
  }),
  beat({
    id: 'nuke_arc_across_1',
    kind: 'social',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 7,
    require: HIGH,


    choices: [
      ch('signal', { world: { exposure: 5 }, stats: { sanity: 3, humanity: 2 }, setFlags: ['flag:signaledKid'], schedule: [{ familyId: 'nuke_arc_across_2', inDays: 2 }],  tone: 'good' }),
      ch('stop_look', { stats: { sanity: -4 }, setFlags: ['flag:stoppedLooking'], schedule: [{ familyId: 'nuke_arc_across_2', waitFor: 'rest' }],  tone: 'neutral' }),
      skip({ setFlags: ['flag:watchedKid'], schedule: [{ familyId: 'nuke_arc_across_2', inDays: 3 }] }),
    ],
  }),
  beat({
    id: 'nuke_arc_across_2',
    kind: 'social',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('binoculars', { stats: { sanity: -5 }, world: { exposure: 2 }, setFlags: ['flag:sawEmptyWindow'],  tone: 'grim' }),
      ch('accept', { stats: { sanity: 2, humanity: 1 },  tone: 'neutral' }),
      skip({ stats: { sanity: -3 } }),
    ],
  }),
  beat({
    id: 'nuke_arc_thyroid_1',
    kind: 'medical',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 8,
    require: NUC,


    choices: [
      ch('dose', { res: { meds: -1 }, stats: { sanity: 4 }, setFlags: ['flag:iodine', 'flag:lateIodine'], schedule: [{ familyId: 'nuke_arc_thyroid_2', inDays: 3 }],  tone: 'neutral' }, { requires: { res: { meds: 1 } } }),
      ch('wait_sym', { stats: { sanity: -4 }, setFlags: ['flag:watchedNeck'], schedule: [{ familyId: 'nuke_arc_thyroid_2', waitFor: 'treat' }],  tone: 'neutral' }),
      skip({ setFlags: ['flag:ignoredNeck'], schedule: [{ familyId: 'nuke_arc_thyroid_2', inDays: 4 }] }),
    ],
  }),
  beat({
    id: 'nuke_arc_thyroid_2',
    kind: 'medical',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('rest_neck', { res: { water: -3 }, stats: { sanity: 3, hp: 2 },  tone: 'good' }, { requires: { res: { water: 3 } } }),
      ch('more_meds', { res: { meds: -2 }, stats: { hp: 3 }, addCond: [],  tone: 'neutral' }, { requires: { res: { meds: 2 } } }),
      skip({ stats: { sanity: -4, hp: -3 } }),
    ],
  }),
  beat({
    id: 'nuke_arc_radio_north_1',
    kind: 'story',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 7,
    require: { all: ['disaster:nuclear', 'mod:radio>=1'] },


    choices: [
      ch('copy', { stats: { sanity: 2 }, setFlags: ['flag:knowsNorthRoute', 'flag:copiedCoords'], schedule: [{ familyId: 'nuke_arc_radio_north_2', waitFor: 'verifyIntel' }],  tone: 'good' }),
      ch('reply', { world: { exposure: 6 }, stats: { sanity: -3 }, setFlags: ['flag:radioReplied'], schedule: [{ familyId: 'nuke_arc_radio_north_2', inDays: 2 }],  tone: 'neutral' }),
      skip({ setFlags: ['flag:ignoredCoords'], schedule: [{ familyId: 'nuke_arc_radio_north_2', inDays: 4 }] }),
    ],
  }),
  beat({
    id: 'nuke_arc_radio_north_2',
    kind: 'story',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('keep', { stats: { sanity: -2 }, setFlags: ['flag:twoNorthStories'],  tone: 'neutral' }),
      ch('drop', { stats: { sanity: 3 }, clearFlags: ['flag:knowsNorthRoute'],  tone: 'good' }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'nuke_arc_geiger_click',
    kind: 'opportunity',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 6,
    require: { all: ['disaster:nuclear', 'hasGeiger'] },


    choices: [
      ch('map', { stats: { stamina: -4, sanity: 2 }, setFlags: ['flag:mappedClicks'],  tone: 'good' }),
      ch('towel', { res: { materials: -1 }, world: { radiation: -1 },  tone: 'good' }, { requires: { res: { materials: 1 } } }),
      skip({ stats: { sanity: 3 } }),
    ],
  }),
  beat({
    id: 'nuke_arc_iodine_bitter',
    kind: 'medical',
    phase: ['survival'],
    once: true,
    weight: 6,
    require: { all: ['disaster:nuclear', 'flag:iodineDoubt'] },


    choices: [
      ch('stop', { res: { water: -4 }, clearFlags: ['flag:iodine'], stats: { sanity: -2 },  tone: 'neutral' }, { requires: { res: { water: 4 } } }),
      ch('continue', { res: { meds: -1 }, setFlags: ['flag:iodine'], stats: { sanity: -3 },  tone: 'grim' }, { requires: { res: { meds: 1 } } }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'nuke_arc_window_boom',
    kind: 'threat',
    intensity: 4,
    phase: ['survival'],
    once: true,
    weight: 7,
    require: HIGH,


    choices: [
      ch('inner', { stats: { stamina: -8, sanity: 2 }, setFlags: ['flag:sleptBathroom'],  tone: 'good' }),
      ch('tape_x', { res: { materials: -1 }, stats: { stamina: -6 },  tone: 'neutral' }, { requires: { res: { materials: 1 } } }),
      skip({ stats: { sanity: -5 } }),
    ],
  }),
  beat({
    id: 'nuke_arc_elevator_shaft',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 6,
    require: HIGH,


    choices: [
      ch('call', { stats: { stamina: -10, humanity: 3, sanity: -4 }, world: { exposure: 5 }, setFlags: ['flag:helpedShaft'],  tone: 'grim' }),
      ch('tool', { res: { parts: -1 }, stats: { stamina: -14 }, world: { exposure: 6 },  tone: 'bad' }, { requires: { res: { parts: 1 } } }),
      skip({ stats: { humanity: -4, sanity: -5 } }),
    ],
  }),
  beat({
    id: 'nuke_arc_sill_ash',
    kind: 'weather',
    phase: ['survival'],
    weight: 7,
    cooldown: 14,
    require: NUC,


    choices: [
      ch('wipe_daily', { stats: { stamina: -6, sanity: 2 }, world: { radiation: -0.5 },  tone: 'neutral' }),
      ch('caulk', { res: { materials: -1 }, world: { radiation: -1 },  tone: 'good' }, { requires: { res: { materials: 1 } } }),
      skip({ stats: { sanity: -3, hp: -2 } }),
    ],
  }),
  beat({
    id: 'nuke_arc_water_yellow',
    kind: 'medical',
    phase: ['survival'],
    once: true,
    weight: 7,
    require: NUC,


    choices: [
      ch('isolate', { stats: { sanity: 2 }, setFlags: ['flag:isolatedWater'],  tone: 'good' }),
      ch('filter', { wear: { filterLife: -2 }, res: { water: -1 },  tone: 'neutral' }),
      skip({ stats: { sanity: -3 } }),
    ],
  }),
  beat({
    id: 'nuke_arc_skin_itch',
    kind: 'medical',
    phase: ['survival'],
    once: true,
    weight: 6,
    require: NUC,


    choices: [
      ch('wash', { res: { water: -3, meds: -0.5 }, stats: { hp: 2, sanity: 2 },  tone: 'good' }, { requires: { res: { water: 3 } } }),
      ch('ignore_itch', { stats: { sanity: -2 },  tone: 'neutral' }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'nuke_arc_gov_leaflet',
    kind: 'story',
    phase: ['survival'],
    once: true,
    weight: 6,
    require: APT,


    choices: [
      ch('keep_map', { setFlags: ['flag:hasEvacMap', 'flag:knowsNorthRoute'], stats: { sanity: 2 },  tone: 'good' }),
      ch('tear_map', { world: { exposure: -3 }, stats: { sanity: -2 },  tone: 'neutral' }),
      skip({ stats: { humanity: 2 } }),
    ],
  }),
  beat({
    id: 'nuke_arc_night_siren',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 7,
    require: APT,


    choices: [
      ch('go_inner', { stats: { stamina: -6, sanity: 2 }, setFlags: ['flag:drilledOnce'],  tone: 'good' }),
      ch('look_out', { world: { exposure: 3, radiation: 1 }, stats: { sanity: -4 },  tone: 'bad' }),
      skip({ stats: { sanity: -3 } }),
    ],
  }),
  beat({
    id: 'nuke_arc_dust_shoes',
    kind: 'medical',
    phase: ['survival'],
    once: true,
    weight: 6,
    require: NUC,


    choices: [
      ch('leave_shoes', { world: { exposure: 2 }, stats: { sanity: 2 }, setFlags: ['flag:shoesOutside'],  tone: 'good' }),
      ch('wipe_tile', { res: { water: -2 }, stats: { stamina: -8 },  tone: 'neutral' }, { requires: { res: { water: 2 } } }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
];
