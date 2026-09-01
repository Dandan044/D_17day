import type { EventFamily } from '../../types';
import { beat } from './factory';
import { HIGHFLOOR } from './queries';

/**
 * 日常生存事件：门槛低、可用面广，负责填满每一天。
 *
 * survival.ts 里那些是"当某个特定条件成立时才合理"的事件，
 * 这个文件里的是"任何一天都可能发生"的事件——两者一起才构成一个不会枯竭的池子。
 */
export const DAILY_EVENTS: EventFamily[] = [
beat({
    id: 'daily_stranger_at_door',
    kind: 'moral',
    intensity: 2,
    phase: ['survival'],
    weight: 10,
    cooldown: 14,
    forbid: { all: ['site:isolated'] },
    variants: [
      {
        id: 'old_man',


        choices: [
          {
            id: 'tell',

            requires: { res: { foodStaple: 1 } },
            effect: {
              res: { foodStaple: -1 },
              stats: { humanity: 5, sanity: 4 },
              world: { exposure: 3, neighborhood: 4 },

              tone: 'good',
            },
          },
          {
            id: 'tell_only',

            effect: {
              stats: { humanity: 1 },
              world: { exposure: 1 },

              tone: 'neutral',
            },
          },
          {
            id: 'silent',

            effect: {
              stats: { humanity: -3, sanity: -4 },

              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'wounded',


        choices: [
          {
            id: 'treat',

            requires: { res: { meds: 2 } },
            effect: {
              res: { meds: -2 },
              stats: { humanity: 8, stamina: -8 },
              world: { exposure: 7 },
              setFlags: ['flag:savedWounded'],
              schedule: [{ familyId: 'daily_debt_repaid', inDays: 3 }],

              tone: 'good',
            },
          },
          {
            id: 'supplies_only',

            requires: { res: { meds: 1 } },
            effect: {
              res: { meds: -1 },
              stats: { humanity: 3 },
              world: { exposure: 3 },

              tone: 'neutral',
            },
          },
          {
            id: 'refuse',

            effect: {
              stats: { humanity: -6, sanity: -5 },

              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'knows_you',


        choices: [
          {
            id: 'trust',

            effect: {
              world: { exposure: 9 },
              stats: { sanity: 5 },
              survivor: { recruit: 'random' },
              setFlags: ['flag:trustedStranger'],

              tone: 'neutral',
            },
          },
          {
            id: 'careful',

            check: {
              skill: 'stealth',
              dc: 10,
              ok: {
                world: { exposure: -3 },

                tone: 'good',
              },
              bad: {
                world: { exposure: 8 },

                tone: 'bad',
              },
            },
          },
          {
            id: 'reject',

            effect: {
              world: { exposure: 2 },
              stats: { humanity: -2 },

              tone: 'neutral',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'daily_debt_repaid',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        id: 'returns',


        require: { any: ['flag:savedWounded'] },
        choices: [
          {
            id: 'accept',

            effect: {
              res: { foodStaple: 6, meds: 3, fuel: 8, parts: 3 },
              stats: { sanity: 8, humanity: 3 },

              tone: 'good',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'daily_maintenance',
    kind: 'medical',
    intensity: 2,
    phase: ['survival'],
    weight: 9,
    cooldown: 14,
    require: { any: ['mod:power>=1', 'mod:filter>=1', 'mod:airFilter>=1'] },
    variants: [
      {
        id: 'breakdown',


        choices: [
          {
            id: 'fix',

            requires: { res: { parts: 2 }, ap: 1 },
            effect: {
              ap: -1,
              res: { parts: -2 },
              stats: { stamina: -10 },

              tone: 'good',
            },
          },
          {
            id: 'bodge',

            check: {
              skill: 'mechanics',
              dc: 11,
              ok: {

                tone: 'neutral',
              },
              bad: {
                shelter: { power: -1 },

                tone: 'bad',
              },
            },
          },
          {
            id: 'ignore',

            effect: {
              setFlags: ['flag:deferredMaintenance'],
              schedule: [{ familyId: 'daily_breakdown_hard', inDays: 4 }],

              tone: 'neutral',
            },
          },
        ],
      },
      {
        id: 'filter_dying',


        require: { all: ['wear:filterLife<=8'] },
        choices: [
          {
            id: 'replace',

            requires: { res: { parts: 4 } },
            effect: {
              res: { parts: -4 },
              wear: { filterLife: 24 },

              tone: 'good',
            },
          },
          {
            id: 'clean',

            requires: { ap: 1 },
            effect: {
              ap: -1,
              stats: { stamina: -8 },
              wear: { filterLife: 8 },

              tone: 'neutral',
            },
          },
          {
            id: 'accept',

            effect: {

              tone: 'neutral',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'daily_breakdown_hard',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        id: 'it_broke',


        require: { any: ['flag:deferredMaintenance'] },
        choices: [
          {
            id: 'rebuild',

            requires: { res: { parts: 6 }, ap: 1 },
            effect: {
              ap: -1,
              res: { parts: -6 },
              stats: { stamina: -14 },
              clearFlags: ['flag:deferredMaintenance'],

              tone: 'neutral',
            },
          },
          {
            id: 'lose',

            effect: {
              shelter: { power: -1 },
              stats: { sanity: -6 },
              clearFlags: ['flag:deferredMaintenance'],

              tone: 'bad',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'daily_hygiene',
    kind: 'medical',
    intensity: 2,
    phase: ['survival'],
    weight: 8,
    cooldown: 14,
    variants: [
      {
        id: 'rats',


        choices: [
          {
            id: 'seal',

            requires: { ap: 1 },
            effect: {
              ap: -1,
              res: { foodStaple: -1, materials: -1 },
              stats: { stamina: -8 },
              setFlags: ['flag:sealedFood'],

              tone: 'good',
            },
          },
          {
            id: 'trap',

            check: {
              skill: 'mechanics',
              dc: 9,
              ok: {
                res: { foodFresh: 1 },

                tone: 'neutral',
              },
              bad: {
                res: { foodStaple: -2 },

                tone: 'bad',
              },
            },
          },
          {
            id: 'ignore',

            effect: {
              res: { foodStaple: -2 },
              addCond: ['dysentery'],

              tone: 'bad',
            },
          },
        ],
      },
      {
        id: 'mold',


        require: { any: ['site:damp', 'site:underground', 'weather:rain', 'weather:flooding'] },
        choices: [
          {
            id: 'treat',

            requires: { res: { materials: 2 }, ap: 1 },
            effect: {
              ap: -1,
              res: { materials: -2 },
              stats: { stamina: -9 },

              tone: 'good',
            },
          },
          {
            id: 'wipe',

            effect: {

              tone: 'neutral',
            },
          },
          {
            id: 'ignore',

            effect: {
              addCond: ['moldLung'],

              tone: 'bad',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'daily_water_find',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],
    weight: 9,
    cooldown: 14,
    variants: [
      {
        id: 'rooftop_tank',


        forbid: { any: ['site:underground', 'site:isolated'] },
        require: HIGHFLOOR,
        choices: [
          {
            id: 'open',

            requires: { ap: 1 },
            effect: {
              ap: -1,
              res: { water: 45 },
              stats: { stamina: -14 },
              world: { exposure: 4 },

              tone: 'good',
            },
          },
          {
            id: 'quiet',

            requires: { res: { parts: 2 }, ap: 1 },
            effect: {
              ap: -1,
              res: { parts: -2, water: 38 },
              stats: { stamina: -10 },

              tone: 'good',
            },
          },
          {
            id: 'share',

            effect: {
              res: { water: 20 },
              stats: { humanity: 7, reputation: 8 },
              world: { neighborhood: 18, exposure: 6 },

              tone: 'good',
            },
          },
        ],
      },
      {
        id: 'rain_catch',


        require: { any: ['weather:precip'] },
        choices: [
          {
            id: 'rig',

            requires: { res: { materials: 3 }, ap: 1 },
            effect: {
              ap: -1,
              res: { materials: -3, water: 26 },
              stats: { stamina: -10 },
              setFlags: ['flag:rainCatcher'],

              tone: 'good',
            },
          },
          {
            id: 'buckets',

            effect: {
              res: { water: 9 },

              tone: 'neutral',
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
    id: 'daily_crew_friction',
    kind: 'social',
    intensity: 2,
    phase: ['survival'],
    weight: 0,
    cooldown: 14,
    require: { any: ['crew:some', 'crew:full'] },
    variants: [
      {
        id: 'ration_argument',


        choices: [
          {
            id: 'explain',

            check: {
              skill: 'negotiation',
              dc: 10,
              ok: {
                survivor: { morale: 10, trust: 8 },
                stats: { reputation: 4 },

                tone: 'good',
              },
              bad: {
                survivor: { morale: -6 },

                tone: 'bad',
              },
            },
          },
          {
            id: 'give_more',

            effect: {
              res: { foodStaple: -3 },
              survivor: { morale: 12 },

              tone: 'good',
            },
          },
          {
            id: 'authority',

            effect: {
              survivor: { morale: -8, trust: -4 },
              stats: { humanity: -3, reputation: -2 },

              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'theft',


        require: { all: ['crew:some'] },
        choices: [
          {
            id: 'confront',

            check: {
              skill: 'negotiation',
              dc: 12,
              ok: {
                res: { foodStaple: 2 },
                survivor: { trust: 6, morale: -4 },

                tone: 'neutral',
              },
              bad: {
                survivor: { morale: -12, trust: -8 },

                tone: 'bad',
              },
            },
          },
          {
            id: 'lock',

            effect: {
              res: { parts: -1 },
              survivor: { morale: -5, trust: -3 },
              setFlags: ['flag:lockedStores'],

              tone: 'neutral',
            },
          },
          {
            id: 'let_go',

            effect: {
              stats: { humanity: 4, sanity: -3 },
              survivor: { morale: 3 },

              tone: 'good',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'daily_recruit',
    kind: 'social',
    intensity: 2,
    phase: ['survival'],
    weight: 0,
    once: true,
    forbid: { all: ['crew:full'] },
    variants: [
      {
        id: 'offer_skills',


        choices: [
          {
            id: 'accept',

            effect: {
              survivor: { recruit: 'random' },
              world: { exposure: 4 },
              stats: { sanity: 5 },

              tone: 'good',
            },
          },
          {
            id: 'trial',

            effect: {
              res: { foodStaple: -2, materials: 3, parts: 3 },
              stats: { humanity: -2 },

              tone: 'neutral',
            },
          },
          {
            id: 'refuse',

            effect: {
              stats: { humanity: -3 },

              tone: 'neutral',
            },
          },
        ],
      },
      {
        id: 'family_pair',


        forbid: { all: ['contagion:high'] },
        choices: [
          {
            id: 'accept',

            effect: {
              survivor: { recruit: 'lijie' },
              stats: { humanity: 12, sanity: 6 },
              world: { exposure: 5, neighborhood: 8 },
              setFlags: ['flag:tookInFamily'],

              tone: 'good',
            },
          },
          {
            id: 'supplies',

            requires: { res: { foodStaple: 2, water: 4 } },
            effect: {
              res: { foodStaple: -2, water: -4 },
              stats: { humanity: 2, sanity: -4 },

              tone: 'neutral',
            },
          },
          {
            id: 'refuse',

            effect: {
              stats: { humanity: -11, sanity: -10 },
              world: { neighborhood: -6 },
              setFlags: ['flag:refusedChild'],

              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'daily_found_document',
    kind: 'story',
    intensity: 1,
    phase: ['survival'],
    weight: 8,
    cooldown: 14,
    variants: [
      {
        id: 'notebook',


        choices: [
          {
            id: 'keep',

            effect: {
              stats: { sanity: 6, humanity: 3 },
              setFlags: ['flag:hasNotebook'],

              tone: 'neutral',
            },
          },
          {
            id: 'search',

            requires: { ap: 1 },
            check: {
              skill: 'stealth',
              dc: 9,
              ok: {
                ap: -1,
                res: { water: 6, meds: 2, foodStaple: 3 },
                stats: { sanity: -8, humanity: 4 },

                tone: 'grim',
              },
              bad: {
                ap: -1,
                stats: { stamina: -12, sanity: -6 },

                tone: 'grim',
              },
            },
          },
          {
            id: 'leave',

            effect: {
              stats: { sanity: -3 },

              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'wall_writing',


        forbid: { all: ['site:isolated'] },
        choices: [
          {
            id: 'add',

            effect: {
              world: { exposure: 14, neighborhood: 10 },
              stats: { humanity: 4 },
              faction: { trader: 8 },
              setFlags: ['flag:markedFriendly'],

              tone: 'neutral',
            },
          },
          {
            id: 'erase',

            requires: { ap: 1 },
            effect: {
              ap: -1,
              world: { exposure: -10, neighborhood: -5 },
              stats: { stamina: -6 },

              tone: 'neutral',
            },
          },
          {
            id: 'fake',

            check: {
              skill: 'stealth',
              dc: 10,
              ok: {
                world: { exposure: -16 },

                tone: 'good',
              },
              bad: {
                world: { exposure: 6 },

                tone: 'bad',
              },
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'daily_radio_voice',
    kind: 'story',
    intensity: 1,
    phase: ['survival'],
    weight: 8,
    cooldown: 14,
    require: { all: ['mod:radio>=1'] },
    variants: [
      {
        id: 'dj',


        choices: [
          {
            id: 'listen',

            effect: {
              stats: { sanity: 9 },
              setFlags: ['flag:knowsDJ'],
              schedule: [{ familyId: 'daily_radio_voice', inDays: 5 }],

              tone: 'good',
            },
          },
          {
            id: 'call',

            requires: { modules: { radio: 2 }, reason: '需要 2 级无线电才能发射' },
            effect: {
              stats: { sanity: 14, reputation: 6 },
              world: { exposure: 8 },
              setFlags: ['flag:talkedToDJ'],
              schedule: [{ familyId: 'daily_dj_mentions', inDays: 3 }],

              tone: 'good',
            },
          },
          {
            id: 'note_coords',

            effect: {
              stats: { sanity: 3 },
              setFlags: ['flag:knowsNorthRoute'],

              tone: 'good',
            },
          },
        ],
      },
      {
        id: 'numbers',


        require: { all: ['mod:radio>=2'] },
        choices: [
          {
            id: 'decode',

            effect: {
              stats: { sanity: -5 },
              setFlags: ['flag:knowsNorthRoute', 'flag:numbersStation'],

              tone: 'grim',
            },
          },
          {
            id: 'off',

            effect: {
              stats: { sanity: -8 },

              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'daily_dj_mentions',
    kind: 'story',
    intensity: 1,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        id: 'on_air',


        require: { any: ['flag:talkedToDJ'] },
        choices: [
          {
            id: 'respond',

            effect: {
              stats: { sanity: 11, humanity: 3 },
              world: { exposure: 5 },
              schedule: [{ familyId: 'daily_dj_mentions', inDays: 6 }],

              tone: 'good',
            },
          },
          {
            id: 'silent',

            effect: {
              stats: { sanity: -6 },
              world: { exposure: -4 },

              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'daily_fuel_choice',
    kind: 'moral',
    intensity: 2,
    phase: ['survival'],
    weight: 8,
    cooldown: 14,
    require: { any: ['temp:cold', 'temp:freezing', 'temp:extreme'] },
    variants: [
      {
        id: 'burn_what',


        choices: [
          {
            id: 'ration_heat',

            effect: {
              stats: { hp: -4, sanity: -5 },
              survivor: { morale: -6 },

              tone: 'neutral',
            },
          },
          {
            id: 'burn_furniture',

            effect: {
              res: { fuel: 5, materials: -3 },
              stats: { sanity: -6 },

              tone: 'neutral',
            },
          },
          {
            id: 'burn_all',

            effect: {
              res: { fuel: -6 },
              stats: { sanity: 8, hp: 3 },
              survivor: { morale: 10 },

              tone: 'good',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'daily_order_decay',
    kind: 'threat',
    intensity: 2,
    phase: ['survival'],
    weight: 8,
    cooldown: 14,
    require: { any: ['order:failing', 'order:collapsed', 'order:strained'] },
    variants: [
      {
        id: 'gunshots',


        choices: [
          {
            id: 'stay',

            effect: {
              world: { exposure: -6 },
              stats: { sanity: -5 },

              tone: 'neutral',
            },
          },
          {
            id: 'look',

            requires: { ap: 1 },
            check: {
              skill: 'stealth',
              dc: 11,
              ok: {
                ap: -1,
                res: { ammo: 4, foodStaple: 3, parts: 2 },
                stats: { sanity: -10, humanity: -4 },

                tone: 'grim',
              },
              bad: {
                ap: -1,
                stats: { hp: -12, sanity: -12 },
                world: { exposure: 10 },

                tone: 'bad',
              },
            },
          },
          {
            id: 'fortify',

            requires: { res: { materials: 2 } },
            effect: {
              res: { materials: -2 },
              stats: { stamina: -10 },
              world: { exposure: -3 },

              tone: 'good',
            },
          },
        ],
      },
      {
        id: 'body_in_street',


        require: { any: ['order:collapsed', 'order:failing'] },
        forbid: { all: ['site:isolated'] },
        choices: [
          {
            id: 'bury',

            requires: { ap: 1 },
            effect: {
              ap: -1,
              stats: { stamina: -16, sanity: -8, humanity: 8, reputation: 6 },
              world: { neighborhood: 16, contagion: -3 },

              tone: 'grim',
            },
          },
          {
            id: 'alone',

            requires: { ap: 1 },
            effect: {
              ap: -1,
              stats: { stamina: -20, sanity: -12, humanity: 6 },
              world: { contagion: -2, exposure: 4 },

              tone: 'grim',
            },
          },
          {
            id: 'ignore',

            effect: {
              stats: { sanity: -7, humanity: -5 },
              world: { contagion: 5 },

              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'daily_quiet_day',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],
    weight: 7,
    cooldown: 14,
    forbid: { any: ['exposure:marked', 'exposure:hunted'] },
    variants: [
      {
        id: 'nothing_happened',


        choices: [
          {
            id: 'organize',

            effect: {
              res: { foodStaple: 2, parts: 1 },
              stats: { sanity: 7 },

              tone: 'good',
            },
          },
          {
            id: 'practice',

            effect: {
              skills: { mechanics: 1 },
              stats: { stamina: -6, sanity: 4 },

              tone: 'good',
            },
          },
          {
            id: 'rest',

            effect: {
              stats: { stamina: 16, sanity: 10 },

              tone: 'good',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'daily_pet_moment',
    kind: 'moral',
    intensity: 2,
    phase: ['survival'],
    weight: 7,
    cooldown: 14,
    require: { all: ['hasPet'] },
    variants: [
      {
        id: 'dog_warns',


        choices: [
          {
            id: 'trust',

            effect: {
              world: { exposure: -8 },
              stats: { stamina: -6 },
              setFlags: ['flag:dogWarning'],

              tone: 'good',
            },
          },
          {
            id: 'ignore',

            effect: {
              world: { exposure: 5 },

              tone: 'bad',
            },
          },
        ],
      },
      {
        id: 'dog_food',


        require: { any: ['food:low'] },
        choices: [
          {
            id: 'share',

            requires: { res: { foodStaple: 1 } },
            effect: {
              res: { foodStaple: -1 },
              stats: { sanity: 8, humanity: 5, hp: -2 },

              tone: 'good',
            },
          },
          {
            id: 'release',

            effect: {
              stats: { sanity: -10, humanity: -4 },
              clearFlags: ['flag:hasPet', 'flag:petDog'],

              tone: 'grim',
            },
          },
          {
            id: 'grim',

            requires: { tags: { all: ['humanity:low'] }, reason: '你还做不到这一步' },
            effect: {
              res: { foodFresh: 6 },
              stats: { sanity: -25, humanity: -20 },
              clearFlags: ['flag:hasPet', 'flag:petDog'],
              setFlags: ['flag:crossedLine'],

              tone: 'grim',
            },
          },
        ],
      },
    ],
  })
];
