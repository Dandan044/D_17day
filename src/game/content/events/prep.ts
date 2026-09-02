import type { EventFamily } from '../../types';
import { beat } from './factory';
import { NUC, URBAN } from './queries';

/**
 * 准备期事件（Day 1-7）。
 *
 * 这七天的主题是"信息不足下的押注"：你不知道要来的是什么，
 * 而每一次采购、每一次拒绝邻居，都会在崩溃日之后变成账单或存款。
 */
export const PREP_EVENTS: EventFamily[] = [
beat({
    id: 'prep_hoarding_rush',
    kind: 'opportunity',
    intensity: 2,
    phase: ['prep'],
    weight: 10,
    cooldown: 14,
    require: URBAN,
    variants: [
      {
        id: 'supermarket',


        choices: [
          {
            id: 'queue',


            effect: {
              res: { water: 14, foodStaple: 8, cash: -700 },
              stats: { stamina: -10 },

              tone: 'good',
            },
          },
          {
            id: 'staff',

            requires: { skills: { negotiation: 2 }, reason: '需要谈判 2 级' },
            effect: {
              res: { water: 20, foodStaple: 12, cash: -1400 },
              stats: { reputation: -3 },

              tone: 'good',
            },
          },
          {
            id: 'pass',

            effect: {
              world: { scarcity: 3 },

              tone: 'neutral',
            },
          },
        ],
      },
      {
        id: 'gasline',


        require: { any: ['res:fuel<20'] },
        choices: [
          {
            id: 'wait',

            effect: {
              res: { fuel: 22, cash: -600 },
              stats: { stamina: -8 },

              tone: 'good',
            },
          },
          {
            id: 'jerrycan',

            requires: { res: { cash: 1400 } },
            effect: {
              res: { fuel: 40, cash: -1400, parts: 1 },
              stats: { stamina: -14, reputation: -4 },

              tone: 'good',
            },
          },
          {
            id: 'leave',

            effect: {  tone: 'neutral' },
          },
        ],
      },
    ],
  }),
beat({
    id: 'prep_neighbor_asks',
    kind: 'moral',
    intensity: 2,
    phase: ['prep'],
    weight: 9,
    cooldown: 14,
    require: URBAN,
    variants: [
      {
        id: 'lijie_water',


        require: { none: ['neighbors:hostile'] },
        choices: [
          {
            id: 'give',

            requires: { res: { water: 8 } },
            effect: {
              res: { water: -8 },
              stats: { humanity: 5, reputation: 4 },
              world: { neighborhood: 12 },
              stance: { neighbors: 10 },
              setFlags: ['flag:helpedLijie'],
              schedule: [{ familyId: 'prep_neighbor_repay', inDays: 3 }],

              tone: 'good',
            },
          },
          {
            id: 'share_info',

            effect: {
              stats: { humanity: 1 },
              world: { neighborhood: 3 },

              tone: 'neutral',
            },
          },
          {
            id: 'refuse',

            effect: {
              stats: { humanity: -6, reputation: -5 },
              world: { neighborhood: -14 },
              stance: { neighbors: -12 },
              setFlags: ['flag:refusedLijie'],

              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'child_medicine',


        require: { any: ['res:meds>=2'] },
        choices: [
          {
            id: 'give_meds',

            requires: { res: { meds: 2 } },
            effect: {
              res: { meds: -2 },
              stats: { humanity: 7, reputation: 6 },
              world: { neighborhood: 15 },
              setFlags: ['flag:savedChild'],
              schedule: [{ familyId: 'prep_neighbor_repay', inDays: 4 }],

              tone: 'good',
            },
          },
          {
            id: 'drive',

            requires: { tags: { all: ['hasVehicle'] }, reason: '需要有车' },
            effect: {
              res: { fuel: -6 },
              stats: { stamina: -18, humanity: 9, reputation: 8 },
              world: { neighborhood: 20 },
              setFlags: ['flag:savedChild'],

              tone: 'good',
            },
          },
          {
            id: 'no',

            effect: {
              stats: { humanity: -8, sanity: -3 },
              world: { neighborhood: -10 },
              setFlags: ['flag:refusedChild'],

              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'prep_neighbor_repay',
    kind: 'social',
    intensity: 1,
    phase: ['prep', 'survival'],
    weight: 0,
    require: { any: ['flag:helpedLijie', 'flag:savedChild'] },
    variants: [
      {
        id: 'repay',


        choices: [
          {
            id: 'take',

            effect: {
              res: { foodStaple: 6, materials: 2 },
              stats: { humanity: 2, sanity: 4 },
              world: { neighborhood: 6 },

              tone: 'good',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'prep_coalarm',
    kind: 'opportunity',
    intensity: 1,
    phase: ['prep'],
    weight: 7,
    once: true,
    variants: [
      {
        id: 'hardware_tip',


        choices: [
          {
            id: 'buy',

            requires: { res: { cash: 68 } },
            effect: {
              res: { cash: -68 },
              setFlags: ['flag:coAlarm'],

              tone: 'good',
            },
          },
          {
            id: 'buy_two',

            requires: { res: { cash: 136 } },
            effect: {
              res: { cash: -136 },
              stats: { humanity: 4 },
              world: { neighborhood: 6 },
              setFlags: ['flag:coAlarm'],

              tone: 'good',
            },
          },
          {
            id: 'pass',

            effect: {  tone: 'neutral' },
          },
        ],
      },
    ],
  }),
beat({
    id: 'prep_iodine',
    kind: 'opportunity',
    intensity: 1,
    phase: ['prep'],
    weight: 6,
    once: true,
    require: NUC,
    forbid: { any: ['hasIodine'] },
    variants: [
      {
        id: 'pharmacy',


        choices: [
          {
            id: 'buy_both',

            requires: { res: { cash: 900 } },
            effect: {
              res: { cash: -900, meds: 1 },
              setFlags: ['flag:iodine', 'flag:iodineStock2'],

              tone: 'neutral',
            },
          },
          {
            id: 'buy_one',

            requires: { res: { cash: 450 } },
            effect: {
              res: { cash: -450 },
              setFlags: ['flag:iodine', 'flag:iodineStock1'],

              tone: 'neutral',
            },
          },
          {
            id: 'pass',

            effect: {
              res: { meds: 2, cash: -180 },

              tone: 'neutral',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'prep_vehicle',
    kind: 'opportunity',
    intensity: 2,
    phase: ['prep'],
    weight: 7,
    once: true,
    forbid: { all: ['hasVehicle'] },
    variants: [
      {
        id: 'used_van',


        choices: [
          {
            id: 'buy',

            requires: { res: { cash: 12000 } },
            effect: {
              res: { cash: -12000, fuel: 8 },
              setFlags: ['flag:hasVehicle'],

              tone: 'good',
            },
          },
          {
            id: 'haggle',

            requires: { skills: { negotiation: 3 }, reason: '需要谈判 3 级' },
            check: {
              skill: 'negotiation',
              dc: 11,
              ok: {
                res: { cash: -8500, fuel: 8 },
                setFlags: ['flag:hasVehicle'],

                tone: 'good',
              },
              bad: {
                res: { cash: -12000, fuel: 8 },
                stats: { sanity: -2 },
                setFlags: ['flag:hasVehicle'],

                tone: 'neutral',
              },
            },
          },
          {
            id: 'cart',

            effect: {
              res: { cash: -300 },
              setFlags: ['flag:hasCart'],

              tone: 'neutral',
            },
          },
          { id: 'pass',  effect: {  tone: 'neutral' } },
        ],
      },
    ],
  }),
beat({
    id: 'prep_gun',
    kind: 'opportunity',
    intensity: 3,
    phase: ['prep'],
    weight: 5,
    once: true,
    variants: [
      {
        id: 'blackmarket',


        choices: [
          {
            id: 'buy',

            requires: { res: { cash: 24000 } },
            effect: {
              res: { cash: -24000, ammo: 30 },
              stats: { sanity: -5, humanity: -3 },
              setFlags: ['flag:hasGun'],

              tone: 'neutral',
            },
          },
          {
            id: 'ammo_only',

            requires: { res: { cash: 3000 } },
            effect: {
              res: { cash: -3000, ammo: 12 },

              tone: 'neutral',
            },
          },
          {
            id: 'report',

            effect: {
              stats: { humanity: 4, reputation: 3 },
              world: { lawOrder: 1 },
              faction: { gang: -5 },
              stance: { gang: -20 },

              tone: 'neutral',
            },
          },
          { id: 'walk',  effect: {  tone: 'neutral' } },
        ],
      },
    ],
  }),
beat({
    id: 'prep_family_call',
    kind: 'story',
    intensity: 3,
    phase: ['prep'],
    weight: 8,
    once: true,
    variants: [
      {
        id: 'mother',


        choices: [
          {
            id: 'come_here',

            requires: { tags: { all: ['hasVehicle'] }, reason: '需要有车才能去接' },
            effect: {
              res: { fuel: -18, foodFresh: 6, meds: 4 },
              stats: { stamina: -14, sanity: 12, humanity: 8 },
              survivor: { recruit: 'random' },
              setFlags: ['flag:familyHere'],

              tone: 'good',
            },
          },
          {
            id: 'stay',

            effect: {
              stats: { sanity: -8, humanity: 2 },
              setFlags: ['flag:familyAway'],
              schedule: [{ familyId: 'story_family_radio', inDays: 12 }],

              tone: 'grim',
            },
          },
          {
            id: 'lie',

            effect: {
              stats: { sanity: -8, humanity: -6 },
              setFlags: ['flag:familyLied'],
              schedule: [{ familyId: 'story_family_radio', inDays: 10 }],

              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'prep_workplace',
    kind: 'social',
    intensity: 1,
    phase: ['prep'],
    weight: 7,
    cooldown: 14,
    variants: [
      {
        id: 'boss',


        choices: [
          {
            id: 'go',


            effect: {
              res: { cash: 4200 },
              stats: { stamina: -12 },

              tone: 'neutral',
            },
          },
          {
            id: 'quit',

            effect: {
              stats: { sanity: -4 },
              setFlags: ['flag:quitJob'],

              tone: 'neutral',
            },
          },
          {
            id: 'warn',

            effect: {
              stats: { humanity: 6, reputation: -8, sanity: -3 },
              world: { neighborhood: 4 },

              tone: 'neutral',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'prep_scam',
    kind: 'social',
    intensity: 1,
    phase: ['prep'],
    weight: 6,
    cooldown: 14,
    variants: [
      {
        id: 'kit',


        choices: [
          {
            id: 'expose',

            effect: {
              stats: { humanity: 5, reputation: 6 },
              world: { neighborhood: 8 },

              tone: 'good',
            },
          },
          {
            id: 'buy_cheap',

            requires: { res: { cash: 900 } },
            check: {
              skill: 'negotiation',
              dc: 9,
              ok: {
                res: { cash: -900, foodStaple: 4, materials: 2, parts: 2 },

                tone: 'good',
              },
              bad: {
                res: { cash: -1996, foodStaple: 4, materials: 2 },

                tone: 'neutral',
              },
            },
          },
          { id: 'ignore',  effect: {  tone: 'neutral' } },
        ],
      },
    ],
  }),
beat({
    id: 'prep_pet',
    kind: 'moral',
    intensity: 1,
    phase: ['prep'],
    weight: 5,
    once: true,
    forbid: { all: ['hasPet'] },
    variants: [
      {
        id: 'dog',


        choices: [
          {
            id: 'take',

            effect: {
              res: { foodStaple: -2 },
              stats: { sanity: 10, humanity: 6 },
              setFlags: ['flag:hasPet', 'flag:petDog'],

              tone: 'good',
            },
          },
          {
            id: 'feed',

            effect: {
              res: { foodStaple: -1 },
              stats: { humanity: 2, sanity: -2 },

              tone: 'neutral',
            },
          },
          {
            id: 'ignore',

            effect: {
              stats: { sanity: -4, humanity: -2 },

              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'prep_evacuate',
    kind: 'moral',
    intensity: 4,
    phase: ['prep'],
    weight: 6,
    once: true,
    minThreat: 0,
    variants: [
      {
        id: 'convoy',


        choices: [
          {
            id: 'join',

            requires: { res: { cash: 3000 }, tags: { all: ['hasVehicle'] }, reason: '需要车和 3000 元' },
            effect: {
              res: { cash: -3000 },
              stats: { sanity: 5 },
              setFlags: ['flag:convoyKnown'],
              schedule: [{ familyId: 'story_convoy_news', inDays: 9 }],

              tone: 'neutral',
            },
          },
          {
            id: 'stay',

            effect: {
              stats: { sanity: -3, humanity: 1 },
              setFlags: ['flag:choseToStay'],

              tone: 'neutral',
            },
          },
          {
            id: 'warn',

            check: {
              skill: 'negotiation',
              dc: 13,
              ok: {
                stats: { humanity: 6, reputation: 8 },
                world: { neighborhood: 14 },

                tone: 'good',
              },
              bad: {
                stats: { reputation: -5 },
                world: { neighborhood: -6 },

                tone: 'neutral',
              },
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'prep_stranger_generator',
    kind: 'opportunity',
    intensity: 2,
    phase: ['prep'],
    weight: 6,
    cooldown: 14,
    variants: [
      {
        id: 'generator',


        choices: [
          {
            id: 'go_alone',

            requires: { res: { cash: 16000 } },
            check: {
              skill: 'stealth',
              dc: 10,
              ok: {
                res: { cash: -16000 },
                shelter: { power: 2 },
                stats: { stamina: -10 },

                tone: 'good',
              },
              bad: {
                res: { cash: -16000 },
                stats: { hp: -10, sanity: -8 },
                addCond: ['woundInfection'],
                setFlags: ['flag:robbedOnce'],

                tone: 'bad',
              },
            },
          },
          {
            id: 'go_daylight',

            check: {
              skill: 'negotiation',
              dc: 9,
              ok: {
                res: { cash: -17500 },
                shelter: { power: 2 },

                tone: 'good',
              },
              bad: {

                tone: 'neutral',
              },
            },
          },
          { id: 'pass',  effect: {  tone: 'neutral' } },
        ],
      },
    ],
  }),
beat({
    id: 'prep_landlord',
    kind: 'social',
    intensity: 2,
    phase: ['prep'],
    weight: 5,
    cooldown: 14,
    require: { any: ['site:urban', 'site:highFloor', 'site:underground'] },
    variants: [
      {
        id: 'property',


        choices: [
          {
            id: 'bribe',

            requires: { res: { cash: 1500 } },
            effect: {
              res: { cash: -1500 },
              stats: { reputation: -2 },
              setFlags: ['flag:propertyDeal'],

              tone: 'good',
            },
          },
          {
            id: 'organize',

            check: {
              skill: 'negotiation',
              dc: 10,
              ok: {
                world: { neighborhood: 16 },
                stats: { reputation: 6 },
                res: { materials: 4 },

                tone: 'good',
              },
              bad: {
                world: { neighborhood: -6 },
                stats: { reputation: -4 },

                tone: 'neutral',
              },
            },
          },
          {
            id: 'comply',

            effect: {
              shelter: { fortify: -1 },
              stats: { sanity: -4 },

              tone: 'bad',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'prep_intel_conflict',
    kind: 'story',
    intensity: 1,
    phase: ['prep'],
    weight: 8,
    cooldown: 14,
    variants: [
      {
        id: 'two_reports',


        choices: [
          {
            id: 'analyze',

            requires: { ap: 1 },
            check: {
              skill: 'negotiation',
              dc: 8,
              ok: {
                ap: -1,
                setFlags: ['flag:intelBonus'],
                stats: { sanity: 3 },

                tone: 'good',
              },
              bad: {
                ap: -1,
                stats: { sanity: -4 },

                tone: 'neutral',
              },
            },
          },
          {
            id: 'trust_local',

            effect: {
              stats: { sanity: -2 },
              setFlags: ['flag:assumeWorst'],

              tone: 'neutral',
            },
          },
          {
            id: 'ignore',

            effect: {
              stats: { stamina: -6 },

              tone: 'neutral',
            },
          },
        ],
      },
    ],
  })
];
