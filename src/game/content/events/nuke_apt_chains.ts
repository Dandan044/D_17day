import type { EventFamily } from '../../types';
import { beat, ch, skip } from './factory';
import { APT, HIGH, HIGHFLOOR, NUC } from './queries';

/**
 * 核战 × 公寓（六楼城区）追加事件链。
 * 首拍 weight>0，续篇 weight 0 + schedule；文案贴地，不对齐已有黑雨/征收/电梯井场面。
 */
export const NUKE_APT_CHAIN_EVENTS: EventFamily[] = [
  // ---------- 对门咳嗽：药 → 纸条 → 门 ----------
  beat({
    id: 'nuke_chain_cough_1',
    kind: 'medical',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 9,
    require: HIGH,


    choices: [
      ch(
        'pass_meds',
        {
          res: { meds: -1 },
          stats: { humanity: 4, sanity: 2 },
          world: { exposure: 3, contagion: 2 },
          setFlags: ['flag:gaveCoughMeds'],
          schedule: [{ familyId: 'nuke_chain_cough_2', inDays: 2 }],

          tone: 'good',
        },
        { requires: { res: { meds: 1 } } },
      ),
      ch(
        'pass_water',
        {
          res: { water: -2 },
          stats: { humanity: 2 },
          world: { exposure: 2 },
          setFlags: ['flag:gaveCoughWater'],
          schedule: [{ familyId: 'nuke_chain_cough_2', inDays: 3 }],

          tone: 'neutral',
        },
        { requires: { res: { water: 2 } } },
      ),
      skip({
        stats: { humanity: -3, sanity: -2 },
        setFlags: ['flag:ignoredCough'],
        schedule: [{ familyId: 'nuke_chain_cough_2', inDays: 4 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_chain_cough_2',
    kind: 'social',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: ['flag:gaveCoughMeds', 'flag:gaveCoughWater', 'flag:ignoredCough'],
    },


    choices: [
      ch('reply', {
        stats: { sanity: 3, reputation: 2 },
        world: { neighborhood: 3 },
        setFlags: ['flag:coughReplied'],
        schedule: [{ familyId: 'nuke_chain_cough_3', waitFor: 'endDay' }],

        tone: 'good',
      }),
      ch('keep_quiet', {
        stats: { sanity: 1 },
        setFlags: ['flag:coughNoteKept'],
        schedule: [{ familyId: 'nuke_chain_cough_3', inDays: 3 }],

        tone: 'neutral',
      }),
      skip({
        stats: { humanity: -2 },
        setFlags: ['flag:coughNoteTorn'],
        schedule: [{ familyId: 'nuke_chain_cough_3', inDays: 2 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_chain_cough_3',
    kind: 'moral',
    intensity: 4,
    phase: ['survival'],
    once: true,
    weight: 0,
    minThreat: 2,
    require: {
      any: ['flag:coughReplied', 'flag:coughNoteKept', 'flag:coughNoteTorn'],
    },


    choices: [
      ch('force_check', {
        stats: { stamina: -6, sanity: -6, humanity: 2 },
        world: { exposure: 6 },

        tone: 'grim',
      }),
      ch('leave_food', {
        res: { foodStaple: -1 },
        stats: { humanity: 4 },
        world: { exposure: 4 },

        tone: 'good',
      }, { requires: { res: { foodStaple: 1 } } }),
      skip({
        stats: { sanity: -4, humanity: -2 },
      }),
    ],
  }),

  // ---------- 对面楼手电：闪 → 上门 ----------
  beat({
    id: 'nuke_chain_flash_1',
    kind: 'social',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 8,
    require: HIGH,


    choices: [
      ch('answer', {
        stats: { sanity: 2 },
        world: { exposure: 4 },
        setFlags: ['flag:answeredFlash'],
        schedule: [{ familyId: 'nuke_chain_flash_2', inDays: 1 }],

        tone: 'neutral',
      }),
      ch('ignore_flash', {
        world: { exposure: -2 },
        setFlags: ['flag:hidFromFlash'],
        schedule: [{ familyId: 'nuke_chain_flash_2', inDays: 2 }],

        tone: 'good',
      }),
      skip({
        stats: { sanity: -2 },
        setFlags: ['flag:watchedFlash'],
        schedule: [{ familyId: 'nuke_chain_flash_2', inDays: 3 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_chain_flash_2',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: ['flag:answeredFlash', 'flag:hidFromFlash', 'flag:watchedFlash'],
    },


    choices: [
      ch('trade', {
        res: { water: -4 },
        wear: { batteryCharge: 2 },
        stats: { sanity: 2 },
        world: { exposure: 5 },
        setFlags: ['flag:tradedFlashMan'],
        schedule: [{ familyId: 'nuke_chain_flash_3', inDays: 4 }],

        tone: 'good',
      }, { requires: { res: { water: 4 } } }),
      ch('refuse_door', {
        stats: { humanity: -1 },
        world: { exposure: 3 },
        setFlags: ['flag:refusedFlashMan'],
        schedule: [{ familyId: 'nuke_chain_flash_3', waitFor: ['raid', 'raidFailed', 'raidRepelled'] }],

        tone: 'neutral',
      }),
      skip({
        stats: { sanity: -3 },
        world: { exposure: 4 },
        setFlags: ['flag:silentFlashMan'],
        schedule: [{ familyId: 'nuke_chain_flash_3', inDays: 2 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_chain_flash_3',
    kind: 'story',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: ['flag:tradedFlashMan', 'flag:refusedFlashMan', 'flag:silentFlashMan'],
    },


    choices: [
      ch('watch_more', {
        stats: { stamina: -10, sanity: -2 },

        tone: 'neutral',
      }),
      ch('write_note', {
        stats: { sanity: 2 },

        tone: 'good',
      }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),

  // ---------- 六楼没水压：停水 → 楼下卖水 → 腹泻/再来 ----------
  beat({
    id: 'nuke_chain_nopressure_1',
    kind: 'opportunity',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 9,
    require: HIGHFLOOR,


    choices: [
      ch('carry_down', {
        stats: { stamina: -14 },
        world: { exposure: 5 },
        setFlags: ['flag:checkedDownstairsWater'],
        schedule: [{ familyId: 'nuke_chain_nopressure_2', inDays: 1 }],

        tone: 'neutral',
      }),
      ch('save_tank', {
        res: { water: 3 },
        stats: { stamina: -6, sanity: -2 },
        setFlags: ['flag:scoopedTank'],
        schedule: [{ familyId: 'nuke_chain_nopressure_2', waitFor: 'endDay' }],

        tone: 'good',
      }),
      skip({
        stats: { sanity: -3 },
        setFlags: ['flag:ignoredNoPressure'],
        schedule: [{ familyId: 'nuke_chain_nopressure_2', inDays: 2 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_chain_nopressure_2',
    kind: 'social',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: ['flag:checkedDownstairsWater', 'flag:scoopedTank', 'flag:ignoredNoPressure'],
    },


    choices: [
      ch('buy_two', {
        res: { cash: -200, water: 16 },
        stats: { stamina: -8 },
        world: { exposure: 4 },
        setFlags: ['flag:boughtStairWater'],
        schedule: [{ familyId: 'nuke_chain_nopressure_3', inDays: 2 }],

        tone: 'neutral',
      }, { requires: { res: { cash: 200 } } }),
      ch('buy_one', {
        res: { cash: -100, water: 8 },
        world: { exposure: 3 },
        setFlags: ['flag:boughtStairWater'],
        schedule: [{ familyId: 'nuke_chain_nopressure_3', inDays: 3 }],

        tone: 'neutral',
      }, { requires: { res: { cash: 100 } } }),
      skip({
        stats: { sanity: -2 },
        setFlags: ['flag:refusedStairWater'],
        schedule: [{ familyId: 'nuke_chain_nopressure_3', inDays: 2 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_chain_nopressure_3',
    kind: 'medical',
    intensity: 4,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: ['flag:boughtStairWater', 'flag:refusedStairWater'],
    },


    choices: [
      ch('meds_rest', {
        res: { meds: -1 },
        stats: { hp: 4, stamina: -8, sanity: -2 },

        tone: 'good',
      }, { requires: { res: { meds: 1 } } }),
      ch('open_yell', {
        stats: { stamina: -6, sanity: -4, reputation: -2 },
        world: { exposure: 8 },

        tone: 'bad',
      }),
      skip({
        stats: { hp: -6, stamina: -12, sanity: -4 },
        addCond: ['dysentery'],
      }),
    ],
  }),

  // ---------- 楼道小孩玩灰：看见 → 家长上门 ----------
  beat({
    id: 'nuke_chain_ashkid_1',
    kind: 'moral',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 8,
    require: APT,


    choices: [
      ch('take_up', {
        res: { water: -2 },
        stats: { humanity: 5, stamina: -6 },
        world: { exposure: 4 },
        setFlags: ['flag:washedAshKid'],
        schedule: [{ familyId: 'nuke_chain_ashkid_2', inDays: 1 }],

        tone: 'good',
      }, { requires: { res: { water: 2 } } }),
      ch('shoo', {
        stats: { humanity: 1 },
        world: { exposure: 2 },
        setFlags: ['flag:shooedAshKid'],
        schedule: [{ familyId: 'nuke_chain_ashkid_2', inDays: 2 }],

        tone: 'neutral',
      }),
      skip({
        stats: { humanity: -3, sanity: -2 },
        setFlags: ['flag:ignoredAshKid'],
        schedule: [{ familyId: 'nuke_chain_ashkid_2', inDays: 2 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_chain_ashkid_2',
    kind: 'social',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: ['flag:washedAshKid', 'flag:shooedAshKid', 'flag:ignoredAshKid'],
    },


    choices: [
      ch('accept_watch', {
        stats: { sanity: 4, reputation: 3 },
        world: { neighborhood: 5, exposure: 2 },
        setFlags: ['flag:ashMomWatch'],
        schedule: [{ familyId: 'nuke_chain_ashkid_3', waitFor: ['raid', 'raidFailed', 'raidRepelled'] }],

        tone: 'good',
      }),
      ch('give_mask', {
        res: { meds: -0.5 },
        stats: { humanity: 3 },
        world: { neighborhood: 3 },
        setFlags: ['flag:gaveKidMask'],
        schedule: [{ familyId: 'nuke_chain_ashkid_3', inDays: 5 }],

        tone: 'good',
      }, { requires: { res: { meds: 1 } } }),
      skip({
        stats: { humanity: -2, reputation: -2 },
        setFlags: ['flag:liedToAshMom'],
        schedule: [{ familyId: 'nuke_chain_ashkid_3', inDays: 4 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_chain_ashkid_3',
    kind: 'threat',
    intensity: 4,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: ['flag:ashMomWatch', 'flag:gaveKidMask', 'flag:liedToAshMom'],
    },


    choices: [
      ch('bang_pots', {
        stats: { stamina: -8, sanity: -3 },
        world: { exposure: 10 },

        tone: 'good',
      }),
      ch('go_help', {
        stats: { stamina: -12, hp: -4, humanity: 4 },
        world: { exposure: 12 },

        tone: 'grim',
      }),
      skip({
        stats: { sanity: -8, humanity: -4 },
      }),
    ],
  }),

  // ---------- 物业钥匙：开单元门 → 试你家锁 ----------
  beat({
    id: 'nuke_chain_keyman_1',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 8,
    require: APT,
    minThreat: 2,


    choices: [
      ch('watch', {
        stats: { stamina: -4, sanity: -2 },
        world: { exposure: -2 },
        setFlags: ['flag:watchedKeyman'],
        schedule: [{ familyId: 'nuke_chain_keyman_2', inDays: 1 }],

        tone: 'neutral',
      }),
      ch('shout', {
        stats: { reputation: 1 },
        world: { exposure: 6 },
        setFlags: ['flag:shoutedKeyman'],
        schedule: [{ familyId: 'nuke_chain_keyman_2', inDays: 1 }],

        tone: 'bad',
      }),
      skip({
        stats: { sanity: -2 },
        setFlags: ['flag:ignoredKeyman'],
        schedule: [{ familyId: 'nuke_chain_keyman_2', inDays: 2 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_chain_keyman_2',
    kind: 'threat',
    intensity: 4,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: ['flag:watchedKeyman', 'flag:shoutedKeyman', 'flag:ignoredKeyman'],
    },


    choices: [
      ch('barricade', {
        ap: -1,
        stats: { stamina: -16 },
        setFlags: ['flag:blockedKeyman'],
        schedule: [{ familyId: 'nuke_chain_keyman_3', inDays: 3 }],

        tone: 'good',
      }, { requires: { ap: 1 } }),
      ch('pay_off', {
        res: { foodStaple: -2 },
        world: { exposure: -4 },
        stats: { sanity: -4 },
        setFlags: ['flag:paidKeyman'],
        schedule: [{ familyId: 'nuke_chain_keyman_3', inDays: 5 }],

        tone: 'grim',
      }, { requires: { res: { foodStaple: 2 } } }),
      skip({
        stats: { sanity: -8 },
        world: { exposure: 6 },
        setFlags: ['flag:enduredKeyman'],
        schedule: [{ familyId: 'nuke_chain_keyman_3', inDays: 2 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_chain_keyman_3',
    kind: 'story',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: ['flag:blockedKeyman', 'flag:paidKeyman', 'flag:enduredKeyman'],
    },


    choices: [
      ch('sign', {
        stats: { reputation: 4, stamina: -4 },
        world: { neighborhood: 4, exposure: 3 },

        tone: 'good',
      }),
      ch('cut_glue', {
        stats: { stamina: -8 },
        world: { exposure: 2 },

        tone: 'neutral',
      }),
      skip({
        stats: { sanity: -2, humanity: -1 },
      }),
    ],
  }),

  // ---------- 碘片传闻：楼道议论 → 有人指认你囤了 ----------
  beat({
    id: 'nuke_chain_iodinerumor_1',
    kind: 'social',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 8,
    require: NUC,


    choices: [
      ch('pass_by', {
        stats: { sanity: -2 },
        world: { exposure: 3 },
        setFlags: ['flag:heardIodineRumor'],
        schedule: [{ familyId: 'nuke_chain_iodinerumor_2', inDays: 2 }],

        tone: 'neutral',
      }),
      ch('deny', {
        stats: { reputation: -1 },
        world: { exposure: 5 },
        setFlags: ['flag:deniedIodineRumor'],
        schedule: [{ familyId: 'nuke_chain_iodinerumor_2', inDays: 1 }],

        tone: 'bad',
      }),
      skip({
        stats: { stamina: -4 },
        setFlags: ['flag:avoidedIodineTalk'],
        schedule: [{ familyId: 'nuke_chain_iodinerumor_2', inDays: 3 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_chain_iodinerumor_2',
    kind: 'threat',
    intensity: 4,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: ['flag:heardIodineRumor', 'flag:deniedIodineRumor', 'flag:avoidedIodineTalk'],
    },


    choices: [
      ch('sell', {
        res: { meds: -1, cash: 200 },
        stats: { humanity: -2, sanity: -2 },
        world: { exposure: 8 },
        setFlags: ['flag:soldIodineDoor'],
        schedule: [{ familyId: 'nuke_chain_iodinerumor_3', inDays: 4 }],

        tone: 'grim',
      }, { requires: { res: { meds: 1 } } }),
      ch('give_free', {
        res: { meds: -1 },
        stats: { humanity: 5, sanity: 2 },
        world: { exposure: 6, neighborhood: 4 },
        setFlags: ['flag:gaveIodineDoor'],
        schedule: [{ familyId: 'nuke_chain_iodinerumor_3', inDays: 5 }],

        tone: 'good',
      }, { requires: { res: { meds: 1 } } }),
      skip({
        stats: { humanity: -4, sanity: -6 },
        world: { exposure: 10 },
        setFlags: ['flag:refusedIodineDoor'],
        schedule: [{ familyId: 'nuke_chain_iodinerumor_3', inDays: 2 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_chain_iodinerumor_3',
    kind: 'story',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: ['flag:soldIodineDoor', 'flag:gaveIodineDoor', 'flag:refusedIodineDoor'],
    },


    choices: [
      ch('erase', {
        res: { materials: -1 },
        stats: { stamina: -6 },
        world: { exposure: -4 },

        tone: 'good',
      }, { requires: { res: { materials: 1 } } }),
      ch('rewrite', {
        stats: { sanity: -2 },
        world: { exposure: 2 },

        tone: 'neutral',
      }),
      skip({
        stats: { sanity: -4 },
        world: { exposure: 4 },
      }),
    ],
  }),

  // ---------- 短波里的熟人嗓音：听 → 回 → 沉默 ----------
  beat({
    id: 'nuke_chain_voice_1',
    kind: 'story',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 7,
    require: { all: ['disaster:nuclear', 'mod:radio>=1'] },


    choices: [
      ch('copy_freq', {
        stats: { sanity: 2 },
        setFlags: ['flag:copiedColleagueFreq'],
        schedule: [{ familyId: 'nuke_chain_voice_2', waitFor: 'verifyIntel' }],

        tone: 'good',
      }),
      ch('call_out', {
        world: { exposure: 4 },
        stats: { sanity: -3 },
        setFlags: ['flag:calledColleagueOnAir'],
        schedule: [{ familyId: 'nuke_chain_voice_2', inDays: 2 }],

        tone: 'neutral',
      }),
      skip({
        stats: { sanity: -2 },
        setFlags: ['flag:leftColleagueVoice'],
        schedule: [{ familyId: 'nuke_chain_voice_2', inDays: 4 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_chain_voice_2',
    kind: 'story',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: ['flag:copiedColleagueFreq', 'flag:calledColleagueOnAir', 'flag:leftColleagueVoice'],
    },


    choices: [
      ch('believe', {
        setFlags: ['flag:knowsNorthRoute', 'flag:stadiumEvac'],
        stats: { sanity: 2 },
        schedule: [{ familyId: 'nuke_chain_voice_3', inDays: 5 }],

        tone: 'good',
      }),
      ch('doubt', {
        stats: { sanity: 1 },
        setFlags: ['flag:doubtedStadium'],
        schedule: [{ familyId: 'nuke_chain_voice_3', waitFor: 'endDay' }],

        tone: 'neutral',
      }),
      skip({
        stats: { sanity: -3 },
        setFlags: ['flag:shutOffVoice'],
        schedule: [{ familyId: 'nuke_chain_voice_3', inDays: 3 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_chain_voice_3',
    kind: 'opportunity',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: ['flag:stadiumEvac', 'flag:doubtedStadium', 'flag:shutOffVoice'],
    },


    choices: [
      ch('update', {
        stats: { sanity: 2 },

        tone: 'good',
      }),
      ch('burn', {
        res: { fuel: -0.2 },
        world: { exposure: -2 },
        stats: { sanity: -2 },

        tone: 'neutral',
      }, { requires: { res: { fuel: 1 } } }),
      skip({
        stats: { sanity: -1 },
      }),
    ],
  }),
];
