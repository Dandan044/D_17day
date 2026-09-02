import type { EventFamily } from '../../types';
import { beat, ch, skip } from './factory';
import { HIGHFLOOR, URBAN, URBAN_OR_HIGH } from './queries';

/** 备灾通用 + 公寓：囤货、房东、碘片、封窗、对门、物业、两份通报 */
export const PREP_SLICE_EVENTS: EventFamily[] = [
  beat({
    id: 'prep_slice_tape_windows',
    kind: 'opportunity',
    phase: ['prep'],
    once: true,
    require: URBAN_OR_HIGH,


    choices: [
      ch('buy_both', { res: { cash: -90, materials: 4 }, setFlags: ['flag:windowTaped'],  tone: 'good' }, { requires: { res: { cash: 90 } } }),
      ch('blue', { res: { cash: -48, materials: 2 }, setFlags: ['flag:windowTaped'],  tone: 'good' }, { requires: { res: { cash: 48 } } }),
      skip(),
    ],
  }),
  beat({
    id: 'prep_slice_elevator_notice',
    kind: 'social',
    phase: ['prep'],
    once: true,
    require: HIGHFLOOR,


    choices: [
      ch('ask', { stats: { stamina: -8, reputation: 2 }, setFlags: ['flag:elevatorWarned'],  tone: 'neutral' }),
      ch('water', { res: { water: 8, cash: -40 }, stats: { stamina: -12 }, setFlags: ['flag:elevatorWarned'],  tone: 'good' }, { requires: { res: { cash: 40 } } }),
      skip(),
    ],
  }),
  beat({
    id: 'prep_slice_opposite_door',
    kind: 'social',
    phase: ['prep'],
    cooldown: 14,
    require: URBAN,


    choices: [
      ch('help', { stats: { stamina: -10, humanity: 3, reputation: 4 }, world: { neighborhood: 6 }, setFlags: ['flag:helpedOpposite'],  tone: 'good', res: { foodStaple: 2 } }),
      ch('ask_where', { stats: { reputation: 1 }, setFlags: ['flag:oppositeLeaving'],  tone: 'neutral' }),
      skip(),
    ],
  }),
  beat({
    id: 'prep_slice_landlord_rent',
    kind: 'social',
    phase: ['prep'],
    once: true,
    require: URBAN,


    choices: [
      ch('pay', { res: { cash: -2800 }, stats: { sanity: 4 }, setFlags: ['flag:rentPaid'],  tone: 'neutral' }, { requires: { res: { cash: 2800 } } }),
      ch('delay', { stats: { reputation: -4, sanity: -3 }, setFlags: ['flag:rentDelayed'],  tone: 'bad' }),
      skip({ stats: { sanity: -4 } }),
    ],
  }),
  beat({
    id: 'prep_slice_iodine_rumor',
    kind: 'opportunity',
    phase: ['prep'],
    once: true,
    forbid: { any: ['hasIodine'] },

    choices: [
      ch('buy', { res: { cash: -180, meds: 2 }, setFlags: ['flag:iodine', 'flag:iodineStock1', 'flag:iodineDoubt'],  tone: 'good' }, { requires: { res: { cash: 180 } } }),
      ch('argue', { stats: { reputation: 3, sanity: 2 }, setFlags: ['flag:iodineDoubt'],  tone: 'neutral' }),
      skip(),
    ],
  }),
  beat({
    id: 'prep_slice_pharmacy_queue',
    kind: 'opportunity',
    phase: ['prep'],
    cooldown: 14,


    choices: [
      ch('queue', { res: { cash: -120, meds: 4 }, stats: { stamina: -8 },  tone: 'good' }, { requires: { res: { cash: 120 } } }),
      ch('script', { res: { cash: -200, meds: 7 }, stats: { reputation: -6, humanity: -2 }, setFlags: ['flag:fakeScript'],  tone: 'grim' }, { requires: { res: { cash: 200 } } }),
      skip(),
    ],
  }),
  beat({
    id: 'prep_slice_plywood',
    kind: 'opportunity',
    phase: ['prep'],
    once: true,
    require: URBAN_OR_HIGH,


    choices: [
      ch('buy', { res: { cash: -360, materials: 8 }, stats: { stamina: -12 }, setFlags: ['flag:hasPlywood'],  tone: 'good' }, { requires: { res: { cash: 360 } } }),
      ch('one', { res: { cash: -180, materials: 4 }, stats: { stamina: -10 }, setFlags: ['flag:hasPlywood'],  tone: 'good' }, { requires: { res: { cash: 180 } } }),
      skip(),
    ],
  }),
  beat({
    id: 'prep_slice_atm',
    kind: 'threat',
    intensity: 3,
    phase: ['prep'],
    once: true,


    choices: [
      ch('wait', { res: { cash: 2000 }, stats: { stamina: -4, sanity: -4 }, setFlags: ['flag:gotCashOut'],  tone: 'good' }),
      ch('leave_card', { stats: { humanity: 4, reputation: 3, sanity: 2 }, world: { neighborhood: 4 },  tone: 'good' }),
      skip({ world: { lawOrder: -2 }, stats: { sanity: -3 } }),
    ],
  }),
  beat({
    id: 'prep_slice_groupchat',
    kind: 'social',
    phase: ['prep'],
    cooldown: 14,


    choices: [
      ch('mute', { stats: { sanity: 6 }, setFlags: ['flag:mutedChat'],  tone: 'neutral' }),
      ch('save', { stats: { sanity: -2 }, setFlags: ['flag:savedNotices', 'flag:assumeWorst'],  tone: 'neutral' }),
      skip(),
    ],
  }),
  beat({
    id: 'prep_slice_tank_key',
    kind: 'opportunity',
    phase: ['prep'],
    once: true,
    require: HIGHFLOOR,


    choices: [
      ch('bribe', { res: { cash: -60, water: 8 }, stats: { stamina: -10, reputation: -2 }, setFlags: ['flag:tankKey'],  tone: 'good' }, { requires: { res: { cash: 60 } } }),
      ch('talk', { stats: { reputation: 2 }, setFlags: ['flag:tankAsked'],  tone: 'neutral' }, { requires: { skills: { negotiation: 2 }, reason: '需要谈判 2 级' } }),
      skip(),
    ],
  }),
  beat({
    id: 'prep_slice_stair_light',
    kind: 'opportunity',
    phase: ['prep'],
    once: true,
    require: HIGHFLOOR,


    choices: [
      ch('fix', { res: { parts: -1, cash: -40 }, stats: { stamina: -8, reputation: 4 }, skills: { mechanics: 1 }, setFlags: ['flag:stairLit'],  tone: 'good' }, { requires: { res: { parts: 1, cash: 40 } } }),
      ch('tape', { res: { materials: -1 }, setFlags: ['flag:stairMarked'],  tone: 'good' }, { requires: { res: { materials: 1 } } }),
      skip({ stats: { stamina: -6 } }),
    ],
  }),
  beat({
    id: 'prep_slice_neighbor_radio',
    kind: 'social',
    phase: ['prep'],
    once: true,
    require: URBAN,


    choices: [
      ch('knock', { stats: { stamina: -4, reputation: 2 }, setFlags: ['flag:metRadioNeighbor'],  tone: 'good' }),
      ch('record', { stats: { sanity: -2 }, setFlags: ['flag:radioClip'],  tone: 'neutral' }),
      skip(),
    ],
  }),
  beat({
    id: 'prep_slice_school_gate',
    kind: 'social',
    phase: ['prep'],
    once: true,


    choices: [
      ch('help_kid', { stats: { humanity: 4, stamina: -6 }, world: { neighborhood: 3 }, setFlags: ['flag:helpedSchoolKid'],  tone: 'good' }),
      ch('ask_teacher', { stats: { sanity: -3 }, setFlags: ['flag:schoolRumor'],  tone: 'neutral' }),
      skip(),
    ],
  }),
  beat({
    id: 'prep_slice_bank_line',
    kind: 'threat',
    intensity: 2,
    phase: ['prep'],
    once: true,


    choices: [
      ch('cash', { res: { cash: 3500 }, stats: { stamina: -14, reputation: -4, sanity: -5 }, setFlags: ['flag:bankRun'],  tone: 'good' }),
      ch('leave', { stats: { sanity: 2 },  tone: 'neutral' }),
      skip({ stats: { sanity: -4, humanity: -1 } }),
    ],
  }),
  beat({
    id: 'prep_slice_mask_gone',
    kind: 'opportunity',
    phase: ['prep'],
    once: true,


    choices: [
      ch('buy_kids', { res: { cash: -80 }, setFlags: ['flag:mask', 'flag:kidMask'],  tone: 'good' }, { requires: { res: { cash: 80 } } }),
      ch('share', { res: { cash: -40 }, stats: { humanity: 3, reputation: 2 }, setFlags: ['flag:mask'],  tone: 'good' }, { requires: { res: { cash: 40 } } }),
      skip(),
    ],
  }),
  beat({
    id: 'prep_slice_last_delivery',
    kind: 'opportunity',
    phase: ['prep'],
    once: true,
    require: URBAN,


    choices: [
      ch('take', { res: { foodStaple: 10 }, stats: { sanity: 3 }, setFlags: ['flag:lastParcel'],  tone: 'good' }),
      ch('other', { res: { foodStaple: 10, meds: 2 }, stats: { humanity: -4, reputation: -3 }, setFlags: ['flag:stoleParcel'],  tone: 'grim' }),
      ch('own_only', { res: { foodStaple: 10 },  tone: 'good' }),
    ],
  }),
  beat({
    id: 'prep_slice_power_notice',
    kind: 'weather',
    phase: ['prep'],
    once: true,


    choices: [
      ch('charge', { stats: { stamina: -6 }, wear: { batteryCharge: 8 }, setFlags: ['flag:chargedUp'],  tone: 'good' }),
      ch('print', { stats: { reputation: 2 }, world: { neighborhood: 2 }, setFlags: ['flag:sharedOutage'],  tone: 'neutral' }),
      skip(),
    ],
  }),
  beat({
    id: 'prep_slice_measure_glass',
    kind: 'opportunity',
    phase: ['prep'],
    once: true,
    require: HIGHFLOOR,


    choices: [
      ch('wave', { stats: { sanity: 3, humanity: 1 }, setFlags: ['flag:wavedAcross'],  tone: 'good' }),
      ch('close', { stats: { sanity: -2 }, world: { exposure: -4 }, setFlags: ['flag:curtainsDrawn'],  tone: 'neutral' }),
      skip(),
    ],
  }),
  beat({
    id: 'prep_slice_withdraw_more',
    kind: 'opportunity',
    phase: ['prep'],
    cooldown: 14,


    choices: [
      ch('join', { res: { cash: 2500 }, stats: { stamina: -16, reputation: 2 }, setFlags: ['flag:withdrewTwice'],  tone: 'good' }),
      ch('shop', { stats: { humanity: 2 },  tone: 'neutral' }),
      skip({ stats: { sanity: -3 } }),
    ],
  }),
  beat({
    id: 'prep_slice_building_meet',
    kind: 'social',
    intensity: 3,
    phase: ['prep'],
    once: true,
    require: URBAN,


    choices: [
      ch('join', { stats: { reputation: 4, humanity: 2 }, world: { neighborhood: 8, exposure: 6 }, setFlags: ['flag:buildingList'],  tone: 'good' }),
      ch('watch', { stats: { sanity: -2 }, setFlags: ['flag:heardBuildingMeet'],  tone: 'neutral' }),
      skip(),
    ],
  }),
];
