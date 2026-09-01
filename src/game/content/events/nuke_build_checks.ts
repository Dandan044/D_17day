import type { EventFamily } from '../../types';
import { beat, ch, skip } from './factory';
import { APT, HIGH, NUC } from './queries';

/**
 * 核战 × 公寓：建筑模块门槛 + 资源平替。
 * 有模块走轻后果；没模块耗物资硬扛；再不行走惩罚。
 */
export const NUKE_BUILD_CHECK_EVENTS: EventFamily[] = [
  // ---------- 撬门：试顶杆 → 再来 / 门框松 → 换锁 ----------
  beat({
    id: 'nuke_build_pry_1',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 9,
    require: APT,
    minThreat: 2,


    choices: [
      ch(
        'hold_door',
        {
          stats: { stamina: -8, sanity: 2 },
          world: { exposure: -2 },
          setFlags: ['flag:pryHeldByFortify'],
          schedule: [{ familyId: 'nuke_build_pry_2', inDays: 2 }],

          tone: 'good',
        },
        { requires: { modules: { fortify: 1 }, reason: '需要加固 1 级' } },
      ),
      ch(
        'brace',
        {
          res: { materials: -2 },
          stats: { stamina: -14 },
          setFlags: ['flag:pryBraced'],
          schedule: [{ familyId: 'nuke_build_pry_2', inDays: 2 }],

          tone: 'neutral',
        },
        { requires: { res: { materials: 2 } } },
      ),
      ch(
        'warn_shot',
        {
          res: { ammo: -1 },
          stats: { sanity: -6, humanity: -2 },
          world: { exposure: 12 },
          setFlags: ['flag:pryGunshot', 'flag:gunshotRecent', 'flag:firedWarning'],
          schedule: [{ familyId: 'nuke_build_pry_2', inDays: 1 }],

          tone: 'grim',
        },
        { requires: { res: { ammo: 1 } } },
      ),
      skip({
        stats: { sanity: -8 },
        world: { exposure: 8 },
        setFlags: ['flag:pryEndured'],
        schedule: [{ familyId: 'nuke_build_pry_2', inDays: 1 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_build_pry_2',
    kind: 'threat',
    intensity: 4,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: ['flag:pryHeldByFortify', 'flag:pryBraced', 'flag:pryGunshot', 'flag:pryEndured'],
    },


    choices: [
      ch(
        'fort2',
        {
          stats: { stamina: -10 },
          world: { exposure: -4 },
          setFlags: ['flag:pryRepelledHard'],
          schedule: [{ familyId: 'nuke_build_pry_3', inDays: 3 }],

          tone: 'good',
        },
        { requires: { modules: { fortify: 2 }, reason: '需要加固 2 级' } },
      ),
      ch(
        'repair_brace',
        {
          res: { materials: -3, parts: -1 },
          stats: { stamina: -16 },
          setFlags: ['flag:pryRepaired'],
          schedule: [{ familyId: 'nuke_build_pry_3', inDays: 4 }],

          tone: 'neutral',
        },
        { requires: { res: { materials: 3, parts: 1 } } },
      ),
      ch(
        'lose_stuff',
        {
          res: { foodStaple: -3, water: -6 },
          stats: { sanity: -6 },
          world: { exposure: 6 },
          shelter: { fortify: -1 },
          setFlags: ['flag:pryBoughtOff'],
          schedule: [{ familyId: 'nuke_build_pry_3', inDays: 2 }],

          tone: 'bad',
        },
        { requires: { res: { foodStaple: 3, water: 6 } } },
      ),
      skip({
        res: { foodStaple: -2, meds: -1 },
        stats: { hp: -8, stamina: -12, sanity: -8 },
        shelter: { fortify: -1 },
        world: { exposure: 10 },
        setFlags: ['flag:pryBreached'],
        schedule: [{ familyId: 'nuke_build_pry_3', inDays: 2 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_build_pry_3',
    kind: 'story',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: ['flag:pryRepelledHard', 'flag:pryRepaired', 'flag:pryBoughtOff', 'flag:pryBreached'],
    },


    choices: [
      ch(
        'new_core',
        {
          res: { parts: -2 },
          stats: { stamina: -10, sanity: 3 },
          world: { exposure: -2 },

          tone: 'good',
        },
        { requires: { res: { parts: 2 } } },
      ),
      ch('erase_arrow', {
        stats: { stamina: -4 },
        world: { exposure: -3 },

        tone: 'neutral',
      }),
      skip({
        stats: { sanity: -3 },
      }),
    ],
  }),

  // ---------- 楼道灌烟：堵缝 → 烟散 ----------
  beat({
    id: 'nuke_build_smoke_1',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 8,
    require: HIGH,
    minThreat: 2,


    choices: [
      ch(
        'seal_fort',
        {
          stats: { stamina: -6, sanity: 2 },
          world: { airPollution: -2 },
          setFlags: ['flag:smokeSealedFort'],
          schedule: [{ familyId: 'nuke_build_smoke_2', inDays: 1 }],

          tone: 'good',
        },
        { requires: { modules: { fortify: 1 }, reason: '需要加固 1 级' } },
      ),
      ch(
        'seal_insulate',
        {
          stats: { stamina: -6, sanity: 2 },
          world: { airPollution: -2 },
          setFlags: ['flag:smokeSealedInsulate'],
          schedule: [{ familyId: 'nuke_build_smoke_2', inDays: 1 }],

          tone: 'good',
        },
        { requires: { modules: { insulate: 1 }, reason: '需要保温 1 级' } },
      ),
      ch(
        'tape_gap',
        {
          res: { materials: -2 },
          stats: { stamina: -10 },
          setFlags: ['flag:smokeTaped'],
          schedule: [{ familyId: 'nuke_build_smoke_2', inDays: 1 }],

          tone: 'neutral',
        },
        { requires: { res: { materials: 2 } } },
      ),
      ch(
        'wet_cloth',
        {
          res: { water: -2 },
          stats: { stamina: -8, sanity: -3, hp: -2 },
          setFlags: ['flag:smokeCloth'],
          schedule: [{ familyId: 'nuke_build_smoke_2', inDays: 1 }],

          tone: 'grim',
        },
        { requires: { res: { water: 2 } } },
      ),
      skip({
        stats: { hp: -4, sanity: -6 },
        world: { radiation: 3, airPollution: 6, exposure: 4 },
        setFlags: ['flag:smokeOpenedWindow'],
        schedule: [{ familyId: 'nuke_build_smoke_2', inDays: 1 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_build_smoke_2',
    kind: 'medical',
    intensity: 4,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: [
        'flag:smokeSealedFort',
        'flag:smokeSealedInsulate',
        'flag:smokeTaped',
        'flag:smokeCloth',
        'flag:smokeOpenedWindow',
      ],
    },


    choices: [
      ch(
        'scrub',
        {
          res: { water: -3 },
          stats: { stamina: -8, sanity: 2 },

          tone: 'good',
        },
        { requires: { res: { water: 3 } } },
      ),
      ch(
        'meds_throat',
        {
          res: { meds: -1 },
          stats: { hp: 3, sanity: 2 },

          tone: 'good',
        },
        { requires: { res: { meds: 1 } } },
      ),
      skip({
        stats: { sanity: -4, hp: -3 },
        addCond: ['coPoisoning'],
      }),
    ],
  }),

  // ---------- 浑水：滤 / 烧 / 硬喝 → 滤芯或锈味 → 分桶 ----------
  beat({
    id: 'nuke_build_murky_1',
    kind: 'medical',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 9,
    require: NUC,


    choices: [
      ch(
        'run_filter',
        {
          wear: { filterLife: -1 },
          stats: { stamina: -4, sanity: 3 },
          setFlags: ['flag:murkyFiltered'],
          schedule: [{ familyId: 'nuke_build_murky_2', inDays: 2 }],

          tone: 'good',
        },
        { requires: { modules: { filter: 1 }, reason: '需要净水 1 级' } },
      ),
      ch(
        'boil',
        {
          res: { fuel: -1, water: -1 },
          stats: { stamina: -8 },
          setFlags: ['flag:murkyBoiled'],
          schedule: [{ familyId: 'nuke_build_murky_2', inDays: 2 }],

          tone: 'neutral',
        },
        { requires: { res: { fuel: 1 } } },
      ),
      ch(
        'drink_raw',
        {
          stats: { hp: -4, sanity: -3 },
          setFlags: ['flag:murkyDrunkRaw'],
          schedule: [{ familyId: 'nuke_build_murky_2', inDays: 1 }],

          tone: 'bad',
        },
      ),
      skip({
        stats: { sanity: 1 },
        setFlags: ['flag:murkyIsolated'],
        schedule: [{ familyId: 'nuke_build_murky_2', inDays: 3 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_build_murky_2',
    kind: 'medical',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: ['flag:murkyFiltered', 'flag:murkyBoiled', 'flag:murkyDrunkRaw', 'flag:murkyIsolated'],
    },


    choices: [
      ch(
        'filter2',
        {
          wear: { filterLife: -2 },
          stats: { sanity: 3 },
          setFlags: ['flag:murkyDeepFiltered'],
          schedule: [{ familyId: 'nuke_build_murky_3', inDays: 3 }],

          tone: 'good',
        },
        { requires: { modules: { filter: 2 }, reason: '需要净水 2 级' } },
      ),
      ch(
        'replace_core',
        {
          res: { parts: -1 },
          wear: { filterLife: 14 },
          stats: { stamina: -8 },
          setFlags: ['flag:murkyReplacedCore'],
          schedule: [{ familyId: 'nuke_build_murky_3', inDays: 3 }],

          tone: 'good',
        },
        { requires: { res: { parts: 1 } } },
      ),
      ch(
        'keep_boil',
        {
          res: { fuel: -1.5, water: -2 },
          stats: { stamina: -6, sanity: -2 },
          setFlags: ['flag:murkyKeepBoil'],
          schedule: [{ familyId: 'nuke_build_murky_3', inDays: 2 }],

          tone: 'neutral',
        },
        { requires: { res: { fuel: 2 } } },
      ),
      skip({
        stats: { hp: -6, stamina: -10, sanity: -4 },
        addCond: ['dysentery'],
        setFlags: ['flag:murkySick'],
        schedule: [{ familyId: 'nuke_build_murky_3', inDays: 2 }],
      }),
    ],
  }),
  beat({
    id: 'nuke_build_murky_3',
    kind: 'opportunity',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 0,
    require: {
      any: [
        'flag:murkyDeepFiltered',
        'flag:murkyReplacedCore',
        'flag:murkyKeepBoil',
        'flag:murkySick',
      ],
    },


    choices: [
      ch('label_all', {
        stats: { sanity: 4, stamina: -4 },

        tone: 'good',
      }),
      ch(
        'dump_half',
        {
          res: { water: -6 },
          stats: { sanity: 2 },

          tone: 'neutral',
        },
        { requires: { res: { water: 6 } } },
      ),
      skip({
        stats: { sanity: -1 },
      }),
    ],
  }),

  // ---------- 滤芯崩裂（需已有净水） ----------
  beat({
    id: 'nuke_build_filter_crack',
    kind: 'medical',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 7,
    require: { all: ['disaster:nuclear', 'mod:filter>=1'] },


    choices: [
      ch(
        'swap_now',
        {
          res: { parts: -2, materials: -1 },
          wear: { filterLife: 16 },
          stats: { stamina: -12, sanity: 3 },

          tone: 'good',
        },
        { requires: { res: { parts: 2, materials: 1 } } },
      ),
      ch(
        'downgrade',
        {
          shelter: { filter: -1 },
          wear: { filterLife: -4 },
          stats: { sanity: -3 },
          world: { exposure: 2 },

          tone: 'grim',
        },
      ),
      ch(
        'shut_boil',
        {
          shelter: { filter: -1 },
          res: { fuel: -0.5 },
          stats: { stamina: -4 },

          tone: 'neutral',
        },
      ),
      skip({
        wear: { filterLife: -3 },
        stats: { sanity: -2, hp: -2 },
      }),
    ],
  }),

  // ---------- 空调孔灌灰 ----------
  beat({
    id: 'nuke_build_ac_vent',
    kind: 'weather',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 8,
    require: HIGH,


    choices: [
      ch(
        'insulate_block',
        {
          stats: { stamina: -6, sanity: 2 },
          world: { radiation: -1 },

          tone: 'good',
        },
        { requires: { modules: { insulate: 1 }, reason: '需要保温 1 级' } },
      ),
      ch(
        'stuff_materials',
        {
          res: { materials: -1, water: -1 },
          stats: { stamina: -8 },
          world: { radiation: -0.5 },

          tone: 'neutral',
        },
        { requires: { res: { materials: 1, water: 1 } } },
      ),
      skip({
        stats: { sanity: -3, hp: -2 },
        world: { radiation: 2 },
      }),
    ],
  }),

  // ---------- 停电与药品/生鲜 ----------
  beat({
    id: 'nuke_build_fridge_dark',
    kind: 'opportunity',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 8,
    require: APT,


    choices: [
      ch(
        'keep_power',
        {
          stats: { stamina: -4, sanity: 2 },
          wear: { batteryCharge: -4 },

          tone: 'good',
        },
        { requires: { modules: { power: 1 }, reason: '需要发电 1 级' } },
      ),
      ch(
        'gen_fuel',
        {
          res: { fuel: -2 },
          wear: { batteryCharge: 6, generatorOil: -1 },
          stats: { stamina: -8 },
          world: { exposure: 4 },

          tone: 'neutral',
        },
        { requires: { res: { fuel: 2 } } },
      ),
      ch(
        'move_cool',
        {
          res: { foodFresh: -2 },
          stats: { stamina: -4, sanity: -2 },

          tone: 'grim',
        },
        { requires: { res: { foodFresh: 2 } } },
      ),
      skip({
        res: { foodFresh: -3, meds: -1 },
        stats: { sanity: -4 },
      }),
    ],
  }),
];
