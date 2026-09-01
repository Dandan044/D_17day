import type { EventFamily } from '../../types';
import { beat, ch, skip } from './factory';
import { HIGHFLOOR, URBAN } from './queries';

/** 生存期通用即时事件：维护、卫生、滤芯、配给、敲门、安静日 */
export const SURV_BEAT_EVENTS: EventFamily[] = [
  beat({
    id: 'surv_beat_filter_clog',
    kind: 'medical',
    phase: ['survival'],


    choices: [
      ch('replace', { wear: { filterLife: 12 }, res: { parts: -1 }, stats: { stamina: -8 }, setFlags: ['flag:filterReplaced'],  tone: 'good' }, { requires: { res: { parts: 1 } } }),
      ch('boil', { res: { fuel: -1, water: -2 }, stats: { stamina: -6 },  tone: 'neutral' }, { requires: { res: { fuel: 1 } } }),
      skip({ wear: { filterLife: -2 }, stats: { sanity: -3 } }),
    ],
  }),
  beat({
    id: 'surv_beat_ration_self',
    kind: 'moral',
    phase: ['survival'],


    choices: [
      ch('eat', { res: { foodStaple: -2 }, stats: { sanity: 6, stamina: 8, humanity: 1 }, setFlags: ['flag:ateEnough'],  tone: 'good' }, { requires: { res: { foodStaple: 2 } } }),
      ch('half', { res: { foodStaple: -1 }, stats: { sanity: -4, stamina: -6 }, setFlags: ['flag:hidRation'],  tone: 'neutral' }, { requires: { res: { foodStaple: 1 } } }),
      skip({ stats: { stamina: -8, sanity: -5 } }),
    ],
  }),
  beat({
    id: 'surv_beat_quiet_day',
    kind: 'dream',
    intensity: 1,
    phase: ['survival'],


    choices: [
      ch('rest', { stats: { stamina: 18, sanity: 8 }, setFlags: ['flag:quietSlept'],  tone: 'good' }),
      ch('check', { stats: { stamina: -10, sanity: -3 }, world: { exposure: 3 },  tone: 'neutral' }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'surv_beat_knock_water_a',
    kind: 'social',
    phase: ['survival'],
    forbid: { all: ['site:isolated'] },


    choices: [
      ch('give', { res: { water: -3 }, stats: { humanity: 4, sanity: 2 }, world: { exposure: 4, neighborhood: 3 }, setFlags: ['flag:gaveWaterOnce'],  tone: 'good' }, { requires: { res: { water: 3 } } }),
      ch('lie', { stats: { humanity: -3, sanity: -2 }, setFlags: ['flag:liedNoWater'],  tone: 'grim' }),
      skip({ stats: { sanity: -3, humanity: -1 } }),
    ],
  }),
  beat({
    id: 'surv_beat_knock_water_b',
    kind: 'social',
    phase: ['survival'],
    forbid: { all: ['site:isolated'] },


    choices: [
      ch('rope', { res: { materials: -1 }, stats: { humanity: 2 }, world: { exposure: 5 }, setFlags: ['flag:lentRope'],  tone: 'neutral' }, { requires: { res: { materials: 1 } } }),
      ch('refuse_rope', { stats: { humanity: -2 },  tone: 'neutral' }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'surv_beat_toilet_bucket',
    kind: 'medical',
    phase: ['survival'],


    choices: [
      ch('bucket', { res: { water: -2, materials: -1 }, stats: { stamina: -8, sanity: -3 }, setFlags: ['flag:bucketToilet'],  tone: 'neutral' }, { requires: { res: { materials: 1 } } }),
      ch('flush', { res: { water: -8 }, stats: { sanity: 4 },  tone: 'good' }, { requires: { res: { water: 8 } } }),
      skip({ stats: { sanity: -6 }, setFlags: ['flag:sealedToilet'] }),
    ],
  }),
  beat({
    id: 'surv_beat_clothes_wash',
    kind: 'social',
    intensity: 1,
    phase: ['survival'],


    choices: [
      ch('wash', { res: { water: -4 }, stats: { sanity: 5, stamina: -8 }, addCond: [],  tone: 'good' }, { requires: { res: { water: 4 } } }),
      ch('spare', { stats: { sanity: 3 }, setFlags: ['flag:lastCleanShirt'],  tone: 'good' }),
      skip({ stats: { sanity: -3 } }),
    ],
  }),
  beat({
    id: 'surv_beat_radio_static',
    kind: 'opportunity',
    phase: ['survival'],


    choices: [
      ch('scan', { stats: { stamina: -4, sanity: -2 }, setFlags: ['flag:scannedBands'],  tone: 'neutral' }),
      ch('off', { wear: { batteryCharge: 2 }, stats: { sanity: -4 },  tone: 'neutral' }),
      skip({ stats: { sanity: 2 } }),
    ],
  }),
  beat({
    id: 'surv_beat_tape_peel',
    kind: 'weather',
    phase: ['survival'],
    require: { any: ['flag:windowTaped', 'site:highFloor'] },


    choices: [
      ch('retape', { res: { materials: -1 }, stats: { stamina: -8 }, setFlags: ['flag:windowRetaped'],  tone: 'good' }, { requires: { res: { materials: 1 } } }),
      ch('paper', { stats: { stamina: -6, sanity: -2 },  tone: 'neutral' }),
      skip({ stats: { sanity: -3 } }),
    ],
  }),
  beat({
    id: 'surv_beat_stairs_dark',
    kind: 'threat',
    intensity: 2,
    phase: ['survival'],
    require: HIGHFLOOR,


    choices: [
      ch('take', { res: { foodStaple: 1 }, stats: { humanity: -2, sanity: -3 }, setFlags: ['flag:tookStairFood'],  tone: 'grim' }),
      ch('leave', { stats: { humanity: 2, stamina: -4 },  tone: 'good' }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'surv_beat_pipe_drip',
    kind: 'opportunity',
    phase: ['survival'],


    choices: [
      ch('catch', { res: { water: 3, fuel: -0.5 }, stats: { stamina: -6 }, setFlags: ['flag:caughtDrip'],  tone: 'good' }),
      ch('wrench', { res: { parts: -1 }, skills: { mechanics: 1 },  tone: 'neutral' }, { requires: { res: { parts: 1 } } }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'surv_beat_can_bulge',
    kind: 'medical',
    phase: ['survival'],


    choices: [
      ch('toss', { res: { foodStaple: -2 }, stats: { sanity: 2 }, setFlags: ['flag:tossedBulge'],  tone: 'neutral' }, { requires: { res: { foodStaple: 2 } } }),
      ch('open', { stats: { sanity: -4 }, addCond: ['dysentery'],  tone: 'bad' }),
      skip({ stats: { sanity: -3 } }),
    ],
  }),
  beat({
    id: 'surv_beat_sleep_shift',
    kind: 'dream',
    intensity: 1,
    phase: ['survival'],


    choices: [
      ch('schedule', { stats: { sanity: 6, stamina: -4 }, setFlags: ['flag:setSchedule'],  tone: 'good' }),
      ch('nap', { stats: { stamina: 12, sanity: -4 },  tone: 'neutral' }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'surv_beat_count_stock',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],


    choices: [
      ch('open', { res: { foodStaple: 4 }, stats: { sanity: 3 }, setFlags: ['flag:foundStash'],  tone: 'good' }),
      ch('list', { stats: { sanity: 4 }, setFlags: ['flag:stockList'],  tone: 'good' }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'surv_beat_neighbor_silence',
    kind: 'social',
    phase: ['survival'],
    require: URBAN,


    choices: [
      ch('knock', { stats: { stamina: -4, sanity: -2 }, world: { exposure: 3 }, setFlags: ['flag:knockedNext'],  tone: 'neutral' }),
      ch('listen', { stats: { sanity: -4 }, setFlags: ['flag:waitedNext'],  tone: 'grim' }),
      skip({ stats: { sanity: -3 } }),
    ],
  }),
  beat({
    id: 'surv_beat_hall_smell',
    kind: 'medical',
    intensity: 3,
    phase: ['survival'],
    require: URBAN,


    choices: [
      ch('mask', { stats: { stamina: -8, sanity: -6 }, world: { exposure: 4 }, setFlags: ['flag:sawHallSource'],  tone: 'grim' }),
      ch('seal', { res: { materials: -1 }, world: { exposure: -2 },  tone: 'neutral' }, { requires: { res: { materials: 1 } } }),
      skip({ stats: { sanity: -5 } }),
    ],
  }),
  beat({
    id: 'surv_beat_gen_hum',
    kind: 'opportunity',
    phase: ['survival'],


    choices: [
      ch('ask', { res: { fuel: -2 }, wear: { batteryCharge: 6 }, stats: { stamina: -10 }, world: { exposure: 6 }, setFlags: ['flag:tradedPower'],  tone: 'neutral' }, { requires: { res: { fuel: 2 } } }),
      ch('ignore_hum', { stats: { sanity: -2 },  tone: 'neutral' }),
      skip({ stats: { sanity: -1 } }),
    ],
  }),
  beat({
    id: 'surv_beat_calendar_x',
    kind: 'dream',
    intensity: 1,
    phase: ['survival'],


    choices: [
      ch('fix', { stats: { sanity: 5 }, setFlags: ['flag:fixedCalendar'],  tone: 'good' }),
      ch('tear', { stats: { sanity: -3, humanity: 1 },  tone: 'neutral' }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'surv_beat_mirror',
    kind: 'medical',
    intensity: 1,
    phase: ['survival'],


    choices: [
      ch('eat', { res: { foodStaple: -2 }, stats: { hp: 4, sanity: 4 },  tone: 'good' }, { requires: { res: { foodStaple: 2 } } }),
      ch('cover', { stats: { sanity: 2 }, setFlags: ['flag:coveredMirror'],  tone: 'neutral' }),
      skip({ stats: { sanity: -4 } }),
    ],
  }),
  beat({
    id: 'surv_beat_mailslot',
    kind: 'threat',
    intensity: 2,
    phase: ['survival'],
    require: URBAN,


    choices: [
      ch('knock', { world: { exposure: 5, neighborhood: 4 }, stats: { sanity: 2 }, setFlags: ['flag:answeredSlot'],  tone: 'neutral' }),
      ch('write', { res: { water: 4 }, world: { exposure: 8 }, setFlags: ['flag:askedSlotWater'],  tone: 'good' }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'surv_beat_faucet_brown',
    kind: 'weather',
    phase: ['survival'],


    choices: [
      ch('boil', { res: { fuel: -0.8, water: 2 }, stats: { stamina: -6 },  tone: 'neutral' }),
      ch('dump', { stats: { sanity: 2 },  tone: 'good' }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'surv_beat_light_flicker',
    kind: 'opportunity',
    phase: ['survival'],


    choices: [
      ch('candle', { wear: { batteryCharge: 1 }, stats: { sanity: 2 }, setFlags: ['flag:usedBirthdayCandle'],  tone: 'neutral' }),
      ch('dark', { stats: { sanity: -4, stamina: 2 }, world: { exposure: -3 },  tone: 'neutral' }),
      skip({ stats: { sanity: 1 } }),
    ],
  }),
  beat({
    id: 'surv_beat_cockroach',
    kind: 'medical',
    intensity: 1,
    phase: ['survival'],


    choices: [
      ch('seal_food', { stats: { stamina: -8, sanity: 3 }, setFlags: ['flag:sealedFood'],  tone: 'good' }),
      ch('bait', { res: { foodStaple: -0.5 }, stats: { humanity: -1 },  tone: 'neutral' }, { requires: { res: { foodStaple: 1 } } }),
      skip({ stats: { sanity: -3, stamina: -4 } }),
    ],
  }),
  beat({
    id: 'surv_beat_salt_rice',
    kind: 'opportunity',
    phase: ['survival'],


    choices: [
      ch('salt', { stats: { stamina: -8 }, setFlags: ['flag:saltedRice'],  tone: 'good' }),
      ch('cook', { res: { fuel: -1, water: -3 }, stats: { stamina: -6 },  tone: 'neutral' }, { requires: { res: { fuel: 1, water: 3 } } }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'surv_beat_blanket_night',
    kind: 'weather',
    phase: ['survival'],
    require: { any: ['temp:cold', 'temp:freezing', 'temp:extreme'] },


    choices: [
      ch('heat', { res: { fuel: -1.2 }, stats: { hp: 4, sanity: 3 },  tone: 'good' }, { requires: { res: { fuel: 2 } } }),
      ch('layers', { stats: { stamina: -6, sanity: -2 },  tone: 'neutral' }),
      skip({ stats: { hp: -3, sanity: -3 } }),
    ],
  }),
  beat({
    id: 'surv_beat_inventory_sound',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],


    choices: [
      ch('pad', { res: { materials: -1 }, stats: { stamina: -4, sanity: 2 },  tone: 'good' }, { requires: { res: { materials: 1 } } }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'surv_beat_window_condense',
    kind: 'weather',
    intensity: 1,
    phase: ['survival'],


    choices: [
      ch('wipe', { stats: { stamina: -4, sanity: 3 },  tone: 'good' }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'surv_beat_spoon_count',
    kind: 'social',
    intensity: 1,
    phase: ['survival'],


    choices: [
      ch('care', { res: { water: -0.5 }, stats: { sanity: 2 },  tone: 'good' }),
      skip({ stats: { sanity: -1 } }),
    ],
  }),
  beat({
    id: 'surv_beat_clock_battery',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],


    choices: [
      ch('battery', { res: { parts: -1 }, stats: { sanity: 3 },  tone: 'good' }, { requires: { res: { parts: 1 } } }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'surv_beat_soap_end',
    kind: 'medical',
    intensity: 1,
    phase: ['survival'],


    choices: [
      ch('save', { stats: { stamina: -2, sanity: 1 },  tone: 'neutral' }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'surv_beat_chair_creak',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],


    choices: [
      ch('fix', { res: { parts: -1 }, stats: { stamina: -6, sanity: 2 },  tone: 'good' }, { requires: { res: { parts: 1 } } }),
      skip({ stats: { sanity: -1 } }),
    ],
  }),
  beat({
    id: 'surv_beat_dust_sun',
    kind: 'weather',
    intensity: 1,
    phase: ['survival'],


    choices: [
      ch('watch', { stats: { sanity: 4, stamina: 2 },  tone: 'good' }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'surv_beat_label_cans',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],


    choices: [
      ch('mark', { stats: { sanity: 2 },  tone: 'good' }),
      skip({ stats: { sanity: -1 } }),
    ],
  }),
  beat({
    id: 'surv_beat_hand_cramp',
    kind: 'medical',
    intensity: 1,
    phase: ['survival'],


    choices: [
      ch('salt', { res: { water: -1, foodStaple: -0.2 }, stats: { hp: 2, sanity: 1 },  tone: 'good' }, { requires: { res: { water: 1 } } }),
      skip({ stats: { stamina: -4 } }),
    ],
  }),
  beat({
    id: 'surv_beat_neighbor_tap',
    kind: 'social',
    intensity: 1,
    phase: ['survival'],
    require: URBAN,


    choices: [
      ch('reply', { stats: { sanity: 3, humanity: 1 }, world: { neighborhood: 2, exposure: 2 },  tone: 'good' }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'surv_beat_boil_habit',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],


    choices: [
      ch('drink', { res: { fuel: -0.4 }, stats: { sanity: 3 },  tone: 'good' }),
      skip({ res: { fuel: -0.4 }, stats: { sanity: 1 } }),
    ],
  }),
  beat({
    id: 'surv_beat_photo_face',
    kind: 'dream',
    intensity: 1,
    phase: ['survival'],


    choices: [
      ch('turn', { stats: { sanity: 2 },  tone: 'neutral' }),
      skip({ stats: { sanity: -2, humanity: 1 } }),
    ],
  }),
];
