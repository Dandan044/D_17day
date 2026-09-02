import type { EventFamily } from '../../types';
import { beat } from './factory';
import { URBAN } from './queries';

/**
 * 生存期事件（崩溃日之后）。
 *
 * 这个文件是"事件家族 + 变体"机制的主要展示面：
 * raid_attempt 只写了一次，但洪灾局是有人划艇撬二楼窗，
 * 核战局是巡逻队以战时征收的名义清点物资，
 * 地下站点是有人在通风井上方喊话威胁灌汽油。
 * 合理性由 require/forbid 标签保证，而不是靠作者记住所有组合。
 */
export const SURVIVAL_EVENTS: EventFamily[] = [
beat({
    id: 'pressure_passerby',
    kind: 'social',
    intensity: 1,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        // 通用兜底变体：不带任何条件，保证这一档永远有内容
        id: 'beggar',


        choices: [
          {
            id: 'give',

            requires: { res: { water: 2 } },
            effect: {
              res: { water: -2 },
              stats: { humanity: 4 },
              world: { exposure: 4, neighborhood: 3 },

              tone: 'neutral',
            },
          },
          {
            id: 'silent',

            effect: {
              stats: { humanity: -3, sanity: -3 },

              tone: 'grim',
            },
          },
          {
            id: 'info',

            effect: {
              stats: { humanity: 2 },
              world: { exposure: 2 },

              tone: 'neutral',
            },
          },
        ],
      },
      {
        id: 'distant_figure',


        require: { any: ['site:isolated', 'site:elevated'] },
        choices: [
          {
            id: 'hide_tracks',

            requires: { ap: 1 },
            effect: {
              ap: -1,
              world: { exposure: -12 },
              stats: { stamina: -10 },

              tone: 'good',
            },
          },
          {
            id: 'watch',

            effect: {
              world: { exposure: 4 },

              tone: 'neutral',
            },
          },
        ],
      },
      {
        id: 'vent_voice',


        require: { all: ['site:underground'] },
        choices: [
          {
            id: 'silent',

            effect: {
              world: { exposure: -8 },
              stats: { sanity: -5 },

              tone: 'neutral',
            },
          },
          {
            id: 'noise',

            check: {
              skill: 'stealth',
              dc: 11,
              ok: {
                world: { exposure: -14 },

                tone: 'good',
              },
              bad: {
                world: { exposure: 12 },

                tone: 'bad',
              },
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'pressure_scout',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        // 通用兜底变体：措辞不绑定任何站点类型
        id: 'window_watcher',


        choices: [
          {
            id: 'blackout',

            effect: {
              world: { exposure: -18 },
              stats: { sanity: -6 },
              survivor: { morale: -8 },
              clearFlags: ['flag:gunshotRecent'],

              tone: 'neutral',
            },
          },
          {
            id: 'show_force',

            requires: { tags: { all: ['armed'] }, reason: '需要有弹药' },
            effect: {
              world: { exposure: 8 },
              stats: { humanity: -2 },
              faction: { looter: -4 },

              tone: 'neutral',
            },
          },
          {
            id: 'confront',

            check: {
              skill: 'negotiation',
              dc: 12,
              ok: {
                world: { exposure: -6 },
                stats: { reputation: 3 },

                tone: 'good',
              },
              bad: {
                world: { exposure: 14 },
                stats: { hp: -6, sanity: -6 },
                schedule: [{ familyId: 'raid_attempt', inDays: 2, tags: ['flag:markedByScout'] }],

                tone: 'bad',
              },
            },
          },
          {
            id: 'ignore',

            effect: {
              world: { exposure: 6 },
              schedule: [{ familyId: 'raid_attempt', inDays: 2, tags: ['flag:markedByScout'], unless: { all: ['exposure:calm'] } }],

              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'ramp_mark',


        require: { all: ['site:underground'] },
        choices: [
          {
            id: 'erase',

            requires: { ap: 1 },
            effect: {
              ap: -1,
              world: { exposure: -13 },
              stats: { stamina: -8 },

              tone: 'good',
            },
          },
          {
            id: 'watch_ramp',

            requires: { res: { parts: 3 } },
            effect: {
              res: { parts: -3 },
              setFlags: ['flag:alarmRig'],

              tone: 'good',
            },
          },
          {
            id: 'ignore',

            effect: {
              world: { exposure: 6 },
              schedule: [{ familyId: 'raid_attempt', inDays: 3, unless: { all: ['exposure:calm'] } }],

              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'tire_tracks',


        require: { any: ['weather:snow', 'weather:blizzard'] },
        choices: [
          {
            id: 'cover',

            requires: { ap: 1 },
            effect: {
              ap: -1,
              world: { exposure: -14 },
              stats: { stamina: -10 },

              tone: 'good',
            },
          },
          {
            id: 'trap',

            requires: { res: { parts: 3 } },
            effect: {
              res: { parts: -3 },
              setFlags: ['flag:alarmRig'],

              tone: 'good',
            },
          },
          {
            id: 'wait',

            effect: {
              world: { exposure: 5 },
              schedule: [{ familyId: 'raid_attempt', inDays: 3, unless: { all: ['exposure:calm'] } }],

              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'pressure_tribute',
    kind: 'threat',
    intensity: 4,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        // 通用兜底变体：不带任何 require，保证任何灾难下这一档压力都不会静默消失
        id: 'street_toll',


        require: URBAN,
        forbid: { any: ['site:isolated', 'site:elevated'] },
        choices: [
          {
            id: 'pay',

            requires: { res: { foodStaple: 1, water: 4 } },
            effect: {
              res: { foodStaple: -1, water: -4 },
              world: { exposure: -6 },
              setFlags: ['flag:paysTribute'],
              schedule: [{ familyId: 'pressure_tribute', inDays: 7 }],

              tone: 'neutral',
            },
          },
          {
            id: 'join',

            requires: { stats: { stamina: 30 } },
            effect: {
              stats: { stamina: -22, reputation: 5, humanity: 2 },
              world: { neighborhood: 12, exposure: -4 },
              setFlags: ['flag:joinedWatch'],

              tone: 'good',
            },
          },
          {
            id: 'refuse',

            effect: {
              stats: { humanity: 2 },
              world: { exposure: 10, neighborhood: -8 },
              schedule: [{ familyId: 'raid_attempt', inDays: 4, unless: { all: ['exposure:calm'] } }],

              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'militia_tax',


        require: { any: ['faction:militia:active', 'faction:gang:active'] },
        forbid: { all: ['site:isolated'] },
        choices: [
          {
            id: 'pay',

            requires: { res: { foodStaple: 2, water: 5 } },
            effect: {
              res: { foodStaple: -2, water: -5 },
              stance: { militia: 25, gov: -10 },
              setFlags: ['flag:paysTribute'],
              schedule: [{ familyId: 'pressure_tribute', inDays: 7 }],

              tone: 'neutral',
            },
          },
          {
            id: 'negotiate',

            check: {
              skill: 'negotiation',
              dc: 13,
              ok: {
                stance: { militia: 18 },
                setFlags: ['flag:militiaFavor'],

                tone: 'good',
              },
              bad: {
                res: { foodStaple: -3, water: -6 },
                stats: { hp: -5 },
                stance: { militia: 5 },

                tone: 'bad',
              },
            },
          },
          {
            id: 'refuse',

            effect: {
              stats: { humanity: 3 },
              stance: { militia: -35 },
              world: { exposure: 12 },
              setFlags: ['flag:refusedTribute'],
              schedule: [{ familyId: 'raid_attempt', inDays: 3, tags: ['flag:militiaPunish'] }],

              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'gov_requisition',


        require: { all: ['disaster:nuclear'], any: ['faction:gov:active'] },
        choices: [
          {
            id: 'comply',

            effect: {
              res: { foodStaple: -6, water: -14, fuel: -6 },
              stance: { gov: 22 },
              setFlags: ['flag:govRegistered'],
              schedule: [{ familyId: 'story_gov_ration', inDays: 5 }],

              tone: 'neutral',
            },
          },
          {
            id: 'hide',

            check: {
              skill: 'stealth',
              dc: 12,
              ok: {
                res: { foodStaple: -2, water: -4 },
                stance: { gov: 12 },

                tone: 'good',
              },
              bad: {
                res: { foodStaple: -9, water: -20, meds: -3 },
                stats: { hp: -8 },
                stance: { gov: -30 },
                setFlags: ['flag:govHostile'],

                tone: 'bad',
              },
            },
          },
          {
            id: 'militia_card',

            requires: { tags: { all: ['flag:paysTribute'] }, reason: '需要已在向自治队交保护费' },
            effect: {
              stance: { gov: -25, militia: 10 },
              setFlags: ['flag:markedCollaborator'],

              tone: 'neutral',
            },
          },
        ],
      },
      {
        id: 'boat_toll',


        require: { any: ['weather:flooding', 'water:flooded'] },
        choices: [
          {
            id: 'pay',

            requires: { res: { foodStaple: 2 } },
            effect: {
              res: { foodStaple: -2 },
              setFlags: ['flag:boatAccess'],

              tone: 'neutral',
            },
          },
          {
            id: 'refuse',

            effect: {
              world: { exposure: 8 },

              tone: 'neutral',
            },
          },
          {
            id: 'radio',

            requires: { modules: { radio: 1 }, reason: '需要 1 级无线电' },
            effect: {
              faction: { rescue: 12 },
              stance: { rescue: 18 },
              setFlags: ['flag:rescueContact'],

              tone: 'good',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'raid_attempt',
    kind: 'threat',
    intensity: 5,
    phase: ['survival'],
    weight: 0,
    cooldown: 4,
    variants: [
      {
        // 通用兜底变体：只要不是地下、不是被水围住，就是最朴素的那种破门
        id: 'crowbar',


        forbid: { any: ['site:underground', 'weather:flooding', 'water:flooded'] },
        choices: [
          {
            id: 'barricade',

            requires: { ap: 1 },
            effect: {
              ap: -1,
              stats: { stamina: -18 },
              setFlags: ['flag:raidDefend'],

              tone: 'neutral',
            },
          },
          {
            id: 'shoot',

            requires: { res: { ammo: 2 }, reason: '需要 2 发弹药' },
            effect: {
              res: { ammo: -2 },
              stats: { humanity: -6, sanity: -8 },
              world: { exposure: 14 },
              setFlags: ['flag:gunshotRecent', 'flag:firedWarning', 'flag:raidDefend'],

              tone: 'neutral',
            },
          },
          {
            id: 'talk',

            check: {
              skill: 'negotiation',
              dc: 15,
              ok: {
                res: { foodStaple: -3 },
                stats: { humanity: 2 },

                tone: 'neutral',
              },
              bad: {
                stats: { sanity: -6 },
                setFlags: ['flag:raidDefend'],

                tone: 'bad',
              },
            },
          },
          {
            id: 'hide',

            effect: {
              setFlags: ['flag:raidHide'],
              stats: { sanity: -10, humanity: -2 },

              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'requisition_raid',


        require: {
          all: ['disaster:nuclear', 'flag:govRegistered'],
          any: ['faction:gov:active'],
        },
        forbid: { any: ['flag:govLastRequisition'] },
        choices: [
          {
            id: 'give_all',

            effect: {
              res: { foodStaple: -8, water: -18, meds: -4, fuel: -8 },
              stats: { sanity: -10 },
              stance: { gov: 10 },
              setFlags: ['flag:govLastRequisition'],

              tone: 'grim',
            },
          },
          {
            id: 'fight',

            requires: { tags: { all: ['armed'] }, reason: '需要有弹药' },
            effect: {
              setFlags: ['flag:raidDefend', 'flag:foughtSoldiers', 'flag:govLastRequisition'],
              stats: { humanity: -4 },

              tone: 'bad',
            },
          },
          {
            id: 'appeal',

            requires: { tags: { all: ['flag:govRegistered'] }, reason: '需要之前配合过登记' },
            check: {
              skill: 'negotiation',
              dc: 11,
              ok: {
                res: { foodStaple: -3, water: -6 },
                stance: { gov: 20 },
                setFlags: ['flag:officerFavor', 'flag:govLastRequisition'],

                tone: 'good',
              },
              bad: {
                res: { foodStaple: -8, water: -16, meds: -3 },
                setFlags: ['flag:govLastRequisition'],

                tone: 'bad',
              },
            },
          },
        ],
      },
      {
        id: 'boat_raid',


        require: { any: ['weather:flooding', 'water:flooded'] },
        choices: [
          {
            id: 'push_boat',

            check: {
              skill: 'fitness',
              dc: 12,
              ok: {
                stats: { stamina: -14 },
                world: { exposure: 4 },

                tone: 'good',
              },
              bad: {
                stats: { hp: -14, stamina: -18 },
                addCond: ['woundInfection'],
                setFlags: ['flag:raidDefend'],

                tone: 'bad',
              },
            },
          },
          {
            id: 'trade',

            requires: { res: { foodStaple: 2 } },
            effect: {
              res: { foodStaple: -2, water: -4 },

              tone: 'neutral',
            },
          },
          {
            id: 'defend',

            effect: {
              setFlags: ['flag:raidDefend'],

              tone: 'neutral',
            },
          },
        ],
      },
      {
        id: 'vent_gasoline',


        require: { all: ['site:underground'] },
        choices: [
          {
            id: 'seal_vent',

            requires: { res: { materials: 5 } },
            effect: {
              res: { materials: -5 },
              stats: { stamina: -12 },
              addCond: ['coPoisoning'],

              tone: 'neutral',
            },
          },
          {
            id: 'open',

            effect: {
              res: { foodStaple: -7, water: -12, meds: -3 },
              stats: { sanity: -12, humanity: -2 },
              world: { exposure: 10 },

              tone: 'grim',
            },
          },
          {
            id: 'bluff',

            check: {
              skill: 'negotiation',
              dc: 14,
              ok: {
                world: { exposure: -10 },

                tone: 'good',
              },
              bad: {
                setFlags: ['flag:raidDefend'],
                world: { exposure: 8 },

                tone: 'bad',
              },
            },
          },
        ],
      },
      {
        id: 'frozen_crowd',


        require: { any: ['weather:blizzard', 'temp:freezing', 'temp:extreme'] },
        choices: [
          {
            id: 'let_in',

            effect: {
              res: { fuel: -8, water: -10, foodStaple: -5 },
              stats: { humanity: 14, sanity: 6 },
              world: { exposure: 18, neighborhood: 20 },
              survivor: { recruit: 'random' },
              setFlags: ['flag:openedDoorInBlizzard'],

              tone: 'good',
            },
          },
          {
            id: 'let_child',

            effect: {
              res: { fuel: -3, water: -4, foodStaple: -2 },
              stats: { humanity: 6, sanity: -6 },
              world: { exposure: 8 },

              tone: 'neutral',
            },
          },
          {
            id: 'closed',

            effect: {
              stats: { humanity: -12, sanity: -14 },
              world: { neighborhood: -10 },
              setFlags: ['flag:closedDoorInBlizzard'],
              schedule: [{ familyId: 'story_frozen_morning', inDays: 1 }],

              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'env_ash_roof',
    kind: 'weather',
    intensity: 3,
    phase: ['survival'],
    weight: 8,
    cooldown: 14,
    require: { all: ['weather:ashfall'] },
    variants: [
      {
        id: 'roof_load',


        forbid: { all: ['site:underground'] },
        choices: [
          {
            id: 'clear',

            requires: { ap: 1 },
            effect: {
              ap: -1,
              stats: { stamina: -20, hp: -4 },
              world: { exposure: 3 },

              tone: 'neutral',
            },
          },
          {
            id: 'clear_masked',

            requires: { res: { meds: 1 }, tags: { all: ['mod:airFilter>=1'] }, reason: '需要 1 级空气过滤提供的防护装备' },
            effect: {
              res: { meds: -1 },
              stats: { stamina: -18 },

              tone: 'good',
            },
          },
          {
            id: 'ignore',

            effect: {
              shelter: { insulate: -1, fortify: -1 },
              stats: { hp: -8, sanity: -8 },

              tone: 'bad',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'env_flood_rise',
    kind: 'weather',
    intensity: 4,
    phase: ['survival'],
    weight: 9,
    cooldown: 14,
    require: { any: ['weather:flooding', 'water:flooded'] },
    variants: [
      {
        id: 'underground_flooding',


        require: { all: ['site:underground'] },
        choices: [
          {
            id: 'evacuate',

            effect: {
              res: { water: -20, foodStaple: -8, materials: -10, parts: -6 },
              stats: { stamina: -26, sanity: -14 },
              shelter: { fortify: -2, insulate: -2, conceal: -1 },
              setFlags: ['flag:abandonedShelter'],

              tone: 'bad',
            },
          },
          {
            id: 'dam',

            requires: { res: { materials: 14 } },
            check: {
              skill: 'mechanics',
              dc: 13,
              ok: {
                res: { materials: -14 },
                stats: { stamina: -24 },
                setFlags: ['flag:floodWall'],

                tone: 'good',
              },
              bad: {
                res: { materials: -14, water: -10, foodStaple: -4 },
                stats: { stamina: -28, hp: -10 },
                addCond: ['hypothermiaMild'],

                tone: 'bad',
              },
            },
          },
          {
            id: 'pump',

            requires: { modules: { power: 1 }, res: { parts: 4 }, reason: '需要发电与 4 零件' },
            effect: {
              res: { parts: -4, fuel: -5 },
              stats: { stamina: -12 },
              setFlags: ['flag:sumpPump'],

              tone: 'good',
            },
          },
        ],
      },
      {
        id: 'water_contaminated',


        forbid: { all: ['site:elevated'] },
        choices: [
          {
            id: 'boil',

            requires: { res: { fuel: 4 } },
            effect: {
              res: { fuel: -4 },
              stats: { stamina: -8 },

              tone: 'neutral',
            },
          },
          {
            id: 'filter',

            requires: { modules: { filter: 1 }, reason: '需要 1 级净水' },
            effect: {
              stats: { sanity: 3 },

              tone: 'good',
            },
          },
          {
            id: 'drink',

            effect: {
              addCond: ['dysentery'],
              stats: { sanity: -5 },

              tone: 'bad',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'env_cold_snap',
    kind: 'weather',
    intensity: 3,
    phase: ['survival'],
    weight: 8,
    cooldown: 14,
    require: { any: ['temp:freezing', 'temp:extreme', 'weather:blizzard'] },
    variants: [
      {
        id: 'pipes',


        forbid: { all: ['grid:on'] },
        choices: [
          {
            id: 'thaw',

            requires: { res: { fuel: 2 }, ap: 1 },
            effect: {
              ap: -1,
              res: { fuel: -2 },
              stats: { stamina: -10 },

              tone: 'good',
            },
          },
          {
            id: 'torch',

            check: {
              skill: 'mechanics',
              dc: 12,
              ok: {
                res: { fuel: -1 },

                tone: 'good',
              },
              bad: {
                res: { water: -12, materials: -3 },
                stats: { stamina: -14 },

                tone: 'bad',
              },
            },
          },
          {
            id: 'wait',

            effect: {

              tone: 'neutral',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'med_neighbor_sick',
    kind: 'medical',
    intensity: 3,
    phase: ['survival'],
    weight: 8,
    cooldown: 14,
    require: { any: ['contagion:high', 'contagion:low'] },
    forbid: { all: ['site:isolated'] },
    variants: [
      {
        id: 'fever_at_door',


        require: { none: ['neighbors:hostile'] },
        choices: [
          {
            id: 'give_meds',

            requires: { res: { meds: 3 } },
            effect: {
              res: { meds: -3 },
              stats: { humanity: 8 },
              world: { neighborhood: 16, contagion: 1 },
              setFlags: ['flag:helpedSickNeighbor'],
              schedule: [{ familyId: 'story_neighbor_outcome', inDays: 4 }],

              tone: 'good',
            },
          },
          {
            id: 'go_treat',

            requires: { skills: { medicine: 3 }, res: { meds: 2 }, reason: '需要医疗 3 级' },
            effect: {
              res: { meds: -2 },
              stats: { humanity: 12, hp: -3 },
              world: { neighborhood: 25, contagion: 3 },
              setFlags: ['flag:treatedChild'],
              schedule: [{ familyId: 'story_neighbor_outcome', inDays: 3 }],

              tone: 'good',
            },
          },
          {
            id: 'refuse',

            effect: {
              stats: { humanity: -9, sanity: -7 },
              world: { neighborhood: -18 },
              stance: { neighbors: -20 },
              setFlags: ['flag:refusedSickNeighbor'],

              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'med_own_wound',
    kind: 'medical',
    intensity: 3,
    phase: ['survival'],
    weight: 7,
    cooldown: 14,
    require: { any: ['cond:woundInfection', 'injured'] },
    variants: [
      {
        id: 'red_line',


        choices: [
          {
            id: 'meds',

            requires: { res: { meds: 4 } },
            effect: {
              res: { meds: -4 },
              removeCond: ['woundInfection'],
              stats: { hp: 6 },

              tone: 'good',
            },
          },
          {
            id: 'debride',

            requires: { modules: { medbay: 1 }, reason: '需要 1 级医疗站' },
            check: {
              skill: 'medicine',
              dc: 12,
              ok: {
                res: { meds: -1 },
                removeCond: ['woundInfection'],
                stats: { hp: -6, sanity: -5 },

                tone: 'good',
              },
              bad: {
                stats: { hp: -18, sanity: -12 },

                tone: 'bad',
              },
            },
          },
          {
            id: 'wait',

            effect: {
              stats: { hp: -10, sanity: -6 },

              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'opp_trader',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],
    weight: 9,
    cooldown: 14,
    require: { any: ['faction:trader:active', 'faction:trader:dormant'] },
    variants: [
      {
        id: 'cart_man',


        choices: [
          {
            id: 'trade_meds',

            requires: { res: { meds: 2 } },
            effect: {
              res: { meds: -2, foodStaple: 7, materials: 1 },
              setFlags: ['flag:metTrader', 'flag:hasSeeds'],
              stance: { trader: 15 },

              tone: 'good',
            },
          },
          {
            id: 'trade_parts',

            requires: { res: { parts: 5 } },
            effect: {
              res: { parts: -5, fuel: 10 },
              setFlags: ['flag:metTrader' ],
              stance: { trader: 12 },

              tone: 'good',
            },
          },
          {
            id: 'buy_intel',

            requires: { res: { meds: 1 } },
            effect: {
              res: { meds: -1 },
              setFlags: ['flag:traderIntel', 'flag:knowsNorthRoute'],
              stance: { trader: 8 },
              locations: [
                { id: 'warehouse', stock: 72 },
                { id: 'school', blocked: '路上有人设卡' },
              ],
              schedule: [{ familyId: 'opp_trader_warehouse', inDays: 1 }],

              tone: 'good',
            },
          },
          {
            id: 'pass',

            effect: {
              res: { water: 2 },
              stance: { trader: 3 },
              setFlags: ['flag:metTrader'],

              tone: 'neutral',
            },
          },
          {
            id: 'rob',

            requires: { tags: { all: ['armed'] }, reason: '需要有弹药' },
            effect: {
              res: { foodStaple: 9, meds: 3, fuel: 6, ammo: -1 },
              stats: { humanity: -22, sanity: -16, reputation: -14 },
              faction: { trader: -20 },
              stance: { trader: -60 },
              world: { exposure: 12 },
              setFlags: ['flag:robbedTrader', 'flag:gunshotRecent'],

              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'opp_trader_warehouse',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],
    weight: 0,
    once: true,
    variants: [
      {
        id: 'main',


        choices: [
          {
            id: 'note',

            effect: {
              stats: { sanity: 3 },

              tone: 'good',
            },
          },
          {
            id: 'skip',

            effect: { stats: { stamina: 4, sanity: -2 },  tone: 'neutral' },
          },
        ],
      },
    ],
  }),
beat({
    id: 'opp_supply_drop',
    kind: 'opportunity',
    intensity: 2,
    phase: ['survival'],
    weight: 6,
    cooldown: 14,
    require: { any: ['faction:gov:active', 'faction:rescue:active'] },
    variants: [
      {
        id: 'ration_point',


        choices: [
          {
            id: 'go',

            requires: { ap: 1 },
            effect: {
              ap: -1,
              res: { foodStaple: 5, water: 8 },
              stats: { stamina: -20 },
              world: { contagion: 3, exposure: 4 },

              tone: 'good',
            },
          },
          {
            id: 'go_with_crew',

            requires: { tags: { any: ['crew:some', 'crew:full'] }, ap: 1, reason: '需要有同伴' },
            effect: {
              ap: -1,
              res: { foodStaple: 10, water: 16 },
              stats: { stamina: -24 },
              world: { contagion: 6, exposure: 7 },
              survivor: { morale: 6 },

              tone: 'good',
            },
          },
          {
            id: 'pass',

            effect: {
              stats: { sanity: -2 },

              tone: 'neutral',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'story_neighbor_outcome',
    kind: 'story',
    intensity: 2,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        id: 'child_lived',


        require: { any: ['flag:helpedSickNeighbor', 'flag:treatedChild'] },
        choices: [
          {
            id: 'take',

            effect: {
              res: { water: 20 },
              stats: { sanity: 10, humanity: 4 },
              world: { neighborhood: 10 },
              setFlags: ['flag:pumpRoomKey'],

              tone: 'good',
            },
          },
        ],
      },
      {
        id: 'child_died',


        require: { any: ['flag:refusedSickNeighbor'] },
        choices: [
          {
            id: 'accept',

            effect: {
              res: { meds: 1 },
              stats: { sanity: -16, humanity: -4 },
              world: { neighborhood: -12 },

              tone: 'grim',
            },
          },
          {
            id: 'leave',

            effect: {
              stats: { sanity: -8, humanity: 3 },

              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'story_frozen_morning',
    kind: 'story',
    intensity: 3,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        id: 'morning_after',


        choices: [
          {
            id: 'bury',

            requires: { ap: 1 },
            effect: {
              ap: -1,
              stats: { stamina: -18, sanity: -10, humanity: 6 },
              world: { neighborhood: 6 },

              tone: 'grim',
            },
          },
          {
            id: 'take',

            effect: {
              res: { foodStaple: 2, materials: 3, meds: 1 },
              stats: { humanity: -16, sanity: -18 },
              setFlags: ['flag:tookFromDead'],

              tone: 'grim',
            },
          },
          {
            id: 'close',

            effect: {
              stats: { sanity: -12 },

              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'story_family_radio',
    kind: 'story',
    intensity: 3,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        id: 'county_broadcast',


        require: { any: ['flag:familyAway', 'flag:familyLied'], all: ['mod:radio>=1'] },
        choices: [
          {
            id: 'call',

            requires: { modules: { radio: 2 }, reason: '需要 2 级无线电才能发射' },
            check: {
              skill: 'mechanics',
              dc: 12,
              ok: {
                stats: { sanity: 14, humanity: 4 },
                setFlags: ['flag:familyFound'],

                tone: 'good',
              },
              bad: {
                stats: { sanity: -12 },
                setFlags: ['flag:familyUnknown'],

                tone: 'grim',
              },
            },
          },
          {
            id: 'listen',

            effect: {
              stats: { sanity: -8 },
              setFlags: ['flag:familyUnknown'],

              tone: 'grim',
            },
          },
        ],
      },
      {
        id: 'stair_rumor',


        require: { any: ['flag:familyAway', 'flag:familyLied'] },
        choices: [
          {
            id: 'ask',

            effect: {
              stats: { sanity: -6, stamina: -4 },
              setFlags: ['flag:familyUnknown'],

              tone: 'grim',
            },
          },
          {
            id: 'keep',

            effect: {
              stats: { sanity: -4 },
              setFlags: ['flag:familyUnknown'],

              tone: 'grim',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'story_convoy_news',
    kind: 'story',
    intensity: 2,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        id: 'convoy_fate',


        require: { any: ['flag:convoyKnown', 'flag:choseToStay'] },
        choices: [
          {
            id: 'reflect',

            effect: {
              stats: { sanity: 6 },
              setFlags: ['flag:convoyFailed'],

              tone: 'neutral',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'story_gov_ration',
    kind: 'story',
    intensity: 2,
    phase: ['survival'],
    weight: 0,
    variants: [
      {
        id: 'the_receipt',


        require: { any: ['flag:govRegistered'] },
        choices: [
          {
            id: 'claim',

            effect: {
              res: { foodStaple: 8, water: 12, meds: 2 },
              stance: { gov: 10 },
              stats: { sanity: 6 },

              tone: 'good',
            },
          },
          {
            id: 'share',

            effect: {
              res: { foodStaple: 4, water: 6, meds: 1 },
              stats: { humanity: 10, reputation: 8 },
              world: { neighborhood: 20 },

              tone: 'good',
            },
          },
        ],
      },
    ],
  }),
beat({
    id: 'dream_sequence',
    kind: 'dream',
    intensity: 1,
    phase: ['survival'],
    weight: 7,
    cooldown: 14,
    require: { all: ['sanity:low'] },
    variants: [
      {
        id: 'supermarket_dream',


        choices: [
          {
            id: 'wake',

            effect: {
              stats: { sanity: -3, stamina: -6 },

              tone: 'grim',
            },
          },
          {
            id: 'ask',

            effect: {
              stats: { sanity: 5, humanity: 2 },

              tone: 'neutral',
            },
          },
        ],
      },
    ],
  })
];
