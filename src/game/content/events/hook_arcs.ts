import type { EventFamily } from '../../types';
import { beat, ch, skip } from './factory';

/** 钩子续篇：arm 族随机出现并挂 pending.waitFor，follow 族只在对应行为后入队 */
export const HOOK_ARC_EVENTS: EventFamily[] = [
  beat({
    id: 'hook_arm_buy',
    kind: 'opportunity',
    phase: ['prep'],
    once: true,
    weight: 7,


    choices: [
      ch('go', { stats: { sanity: 2 }, setFlags: ['flag:rewroteList'], schedule: [{ familyId: 'hook_follow_buy', waitFor: 'buy' }],  tone: 'good' }),
      skip({ schedule: [{ familyId: 'hook_follow_buy', waitFor: 'visitShop' }] }),
    ],
  }),
  beat({
    id: 'hook_follow_buy',
    kind: 'social',
    phase: ['prep', 'survival'],
    once: true,
    weight: 0,


    choices: [
      ch('sub', { res: { cash: -80, foodStaple: 2 }, stats: { sanity: 2 },  tone: 'good' }, { requires: { res: { cash: 80 } } }),
      ch('empty', { stats: { sanity: -3 }, setFlags: ['flag:listHole'],  tone: 'neutral' }),
      skip({ stats: { sanity: 1 } }),
    ],
  }),
  beat({
    id: 'hook_arm_night',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 7,
    minThreat: 2,
    maxThreat: 4,


    choices: [
      ch('plan', { stats: { stamina: -4 }, setFlags: ['flag:plannedNight'], schedule: [{ familyId: 'hook_follow_night', waitFor: 'scavengeNight' }],  tone: 'neutral' }),
      skip({ schedule: [{ familyId: 'hook_follow_night', waitFor: ['scavengeNight', 'scavenge'] }] }),
    ],
  }),
  beat({
    id: 'hook_follow_night',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('run', { stats: { stamina: -10, sanity: -3 }, world: { exposure: 6 }, setFlags: ['flag:nightCalled'],  tone: 'bad' }),
      ch('answer', { stats: { humanity: 1 }, world: { exposure: 8 },  tone: 'grim' }),
      skip({ world: { exposure: 4 }, stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'hook_arm_raid',
    kind: 'threat',
    intensity: 4,
    phase: ['survival'],
    once: true,
    weight: 6,
    minThreat: 2,
    maxThreat: 6,


    choices: [
      ch('ready', { stats: { stamina: -6 }, setFlags: ['flag:bracedDoor'], schedule: [{ familyId: 'hook_follow_raid', waitFor: ['raid', 'raidFailed', 'raidRepelled'] }],  tone: 'neutral' }),
      skip({ schedule: [{ familyId: 'hook_follow_raid', waitFor: ['raid', 'raidFailed', 'raidRepelled'] }] }),
    ],
  }),
  beat({
    id: 'hook_follow_raid',
    kind: 'moral',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('fix_frame', { res: { materials: -1 }, stats: { stamina: -10, sanity: 4 },  tone: 'good' }, { requires: { res: { materials: 1 } } }),
      ch('keep_scar', { stats: { sanity: -2 }, setFlags: ['flag:keptScar'],  tone: 'neutral' }),
      skip({ stats: { sanity: 1 } }),
    ],
  }),
  beat({
    id: 'hook_arm_rest',
    kind: 'dream',
    intensity: 1,
    phase: ['survival'],
    once: true,
    weight: 6,


    choices: [
      ch('permit', { setFlags: ['flag:permitSleep'], schedule: [{ familyId: 'hook_follow_rest', waitFor: 'rest' }],  tone: 'good' }),
      skip({ schedule: [{ familyId: 'hook_follow_rest', waitFor: ['rest', 'endDay'] }] }),
    ],
  }),
  beat({
    id: 'hook_follow_rest',
    kind: 'dream',
    intensity: 1,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('up', { stats: { stamina: -6, sanity: 2 },  tone: 'neutral' }),
      ch('stay', { stats: { stamina: 8, sanity: -2 },  tone: 'good' }),
      skip({ stats: { stamina: -8, sanity: -4 } }),
    ],
  }),
  beat({
    id: 'hook_arm_intel',
    kind: 'story',
    phase: ['prep', 'survival'],
    once: true,
    weight: 7,


    choices: [
      ch('mark', { setFlags: ['flag:savedUnreadIntel'], schedule: [{ familyId: 'hook_follow_intel', waitFor: 'verifyIntel' }],  tone: 'neutral' }),
      skip({ setFlags: ['flag:assumeWorst'], schedule: [{ familyId: 'hook_follow_intel', waitFor: ['verifyIntel', 'endDay'] }] }),
    ],
  }),
  beat({
    id: 'hook_follow_intel',
    kind: 'story',
    phase: ['prep', 'survival'],
    once: true,
    weight: 0,
    require: { any: ['flag:savedUnreadIntel', 'flag:assumeWorst'] },


    choices: [
      ch('widen', { stats: { sanity: -3 }, setFlags: ['flag:changedThesis'],  tone: 'neutral' }),
      ch('patch', { stats: { sanity: 3 },  tone: 'good' }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'hook_arm_ration',
    kind: 'moral',
    phase: ['survival'],
    once: true,
    weight: 6,


    choices: [
      ch('decide', { setFlags: ['flag:touchedRation'], schedule: [{ familyId: 'hook_follow_ration', waitFor: 'setRation' }],  tone: 'neutral' }),
      skip({ schedule: [{ familyId: 'hook_follow_ration', waitFor: ['setRation', 'setWaterUse'] }] }),
    ],
  }),
  beat({
    id: 'hook_follow_ration',
    kind: 'moral',
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('ok', { stats: { sanity: 4, humanity: 1 }, setFlags: ['flag:acceptedRation'],  tone: 'good' }),
      ch('undo_feel', { stats: { sanity: -4 },  tone: 'grim' }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
  beat({
    id: 'hook_arm_low',
    kind: 'threat',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 6,
    // 只在真实接近见底时出现：food:low = 总食物 < 人口 × 2 份
    require: { all: ['food:low'] },
    minThreat: 2,
    maxThreat: 6,


    choices: [
      ch('rehearse', { setFlags: ['flag:rehearsedEmpty'], schedule: [{ familyId: 'hook_follow_low', waitFor: ['foodLow', 'waterLow'] }],  tone: 'neutral' }),
      skip({ schedule: [{ familyId: 'hook_follow_low', waitFor: ['foodLow', 'hpLow'] }] }),
    ],
  }),
  beat({
    id: 'hook_follow_low',
    kind: 'moral',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('count', { stats: { sanity: -3 },  tone: 'neutral' }),
      ch('out', { stats: { stamina: -4, sanity: 2 }, world: { exposure: 2 },  tone: 'good' }),
      skip({ stats: { sanity: -4, stamina: -4 } }),
    ],
  }),
  beat({
    id: 'hook_arm_power',
    kind: 'opportunity',
    phase: ['survival'],
    once: true,
    weight: 5,


    choices: [
      ch('list', { setFlags: ['flag:powerList'], schedule: [{ familyId: 'hook_follow_power', waitFor: ['setPowerPriority', 'setPowerMode'] }],  tone: 'neutral' }),
      skip({ schedule: [{ familyId: 'hook_follow_power', waitFor: ['setPowerPriority', 'setPowerMode', 'maintain'] }] }),
    ],
  }),
  beat({
    id: 'hook_follow_power',
    kind: 'opportunity',
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('accept_dark', { stats: { sanity: 3 },  tone: 'good' }),
      ch('miss', { stats: { sanity: -3 },  tone: 'neutral' }),
      skip({ stats: { stamina: -4 } }),
    ],
  }),
  beat({
    id: 'hook_arm_work',
    kind: 'opportunity',
    phase: ['survival'],
    once: true,
    weight: 5,


    choices: [
      ch('commit', { setFlags: ['flag:mustWork'], schedule: [{ familyId: 'hook_follow_work', waitFor: ['work', 'build'] }],  tone: 'good' }),
      skip({ schedule: [{ familyId: 'hook_follow_work', waitFor: ['work', 'cancelProject'] }] }),
    ],
  }),
  beat({
    id: 'hook_follow_work',
    kind: 'opportunity',
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('continue', { stats: { stamina: -8, sanity: 4 }, skills: { mechanics: 1 },  tone: 'good' }),
      ch('stop_now', { world: { exposure: -2 }, stats: { sanity: 1 },  tone: 'neutral' }),
      skip({ stats: { stamina: -2 } }),
    ],
  }),
  beat({
    id: 'hook_arm_haul',
    kind: 'opportunity',
    phase: ['survival'],
    once: true,
    weight: 5,


    choices: [
      ch('scale', { setFlags: ['flag:packMarks'], schedule: [{ familyId: 'hook_follow_haul', waitFor: 'takeHaul' }],  tone: 'good' }),
      skip({ schedule: [{ familyId: 'hook_follow_haul', waitFor: ['takeHaul', 'scavenge'] }] }),
    ],
  }),
  beat({
    id: 'hook_follow_haul',
    kind: 'moral',
    phase: ['survival'],
    once: true,
    weight: 0,


    choices: [
      ch('keep', { res: { parts: 1 }, stats: { sanity: -2 },  tone: 'neutral' }),
      ch('toss', { stats: { sanity: 3, humanity: 1 }, world: { exposure: -2 },  tone: 'good' }),
      skip({ stats: { sanity: -1 } }),
    ],
  }),

  // 旧旗标回响：让只写不读的叙事标签真正进入过滤器
  {
    id: 'hook_echo_oldflags',
    kind: 'story',
    intensity: 2,
    phase: ['prep', 'survival'],
    baseWeight: 5,
    cooldown: 14,
    variants: [
      {
        id: 'assume',
        require: { all: ['flag:assumeWorst'] },


        choices: [
          { id: 'keep',  effect: { stats: { stamina: -6, sanity: 3 },  tone: 'neutral' } },
          { id: 'ease',  effect: { stats: { sanity: 5, stamina: 4 },  tone: 'good' } },
          skip(),
        ],
      },
      {
        id: 'dog',
        require: { all: ['flag:dogWarning'] },


        choices: [
          { id: 'trust',  effect: { world: { exposure: -3 }, stats: { sanity: 2 },  tone: 'good' } },
          skip(),
        ],
      },
      {
        id: 'lijie_no',
        require: { all: ['flag:refusedLijie'] },


        choices: [
          { id: 'note',  effect: { stats: { humanity: -1, sanity: -2 }, world: { neighborhood: -2 },  tone: 'grim' } },
          skip(),
        ],
      },
      {
        id: 'gun',
        require: { all: ['flag:hasGun'] },


        choices: [
          { id: 'check',  effect: { stats: { sanity: -2, stamina: -2 },  tone: 'neutral' } },
          skip(),
        ],
      },
      {
        id: 'family_here',
        require: { all: ['flag:familyHere'] },


        choices: [
          { id: 'talk',  effect: { stats: { sanity: 4, humanity: 2 },  tone: 'good' } },
          skip(),
        ],
      },
      {
        id: 'quit',
        require: { all: ['flag:quitJob'] },


        choices: [
          { id: 'disable',  effect: { stats: { sanity: 3 },  tone: 'good' } },
          skip(),
        ],
      },
      {
        id: 'stranger',
        require: { all: ['flag:trustedStranger'] },


        choices: [
          { id: 'lock',  effect: { world: { exposure: -2 }, stats: { sanity: 1 },  tone: 'neutral' } },
          skip(),
        ],
      },
      {
        id: 'notebook',
        require: { all: ['flag:hasNotebook'] },


        choices: [
          { id: 'read',  effect: { stats: { sanity: -4, humanity: 2 },  tone: 'grim' } },
          skip(),
        ],
      },
      {
        id: 'locked',
        require: { all: ['flag:lockedStores'] },


        choices: [
          { id: 'keep_lock',  effect: { stats: { sanity: 2, stamina: -3 },  tone: 'neutral' } },
          skip(),
        ],
      },
      {
        id: 'marked_f',
        require: { all: ['flag:markedFriendly'] },


        choices: [
          { id: 'rewrite',  effect: { stats: { humanity: 2, reputation: 1 }, world: { exposure: 3 },  tone: 'good' } },
          skip(),
        ],
      },
      {
        id: 'dj',
        require: { all: ['flag:knowsDJ'] },


        choices: [
          { id: 'listen',  effect: { stats: { sanity: 2 },  tone: 'good' } },
          skip(),
        ],
      },
      {
        id: 'numbers',
        require: { all: ['flag:numbersStation'] },


        choices: [
          { id: 'write',  effect: { stats: { sanity: 2 }, setFlags: ['flag:knowsNorthRoute'],  tone: 'neutral' } },
          skip(),
        ],
      },
      {
        id: 'crossed',
        require: { all: ['flag:crossedLine'] },


        choices: [
          { id: 'wash',  effect: { res: { water: -1 }, stats: { sanity: -2, humanity: -1 },  tone: 'grim' } },
          skip(),
        ],
      },
      {
        id: 'watch',
        require: { all: ['flag:joinedWatch'] },


        choices: [
          { id: 'go',  effect: { stats: { stamina: -12, reputation: 3 }, world: { exposure: 4, neighborhood: 4 },  tone: 'good' } },
          skip(),
        ],
      },
      {
        id: 'militia',
        require: { all: ['flag:militiaFavor'] },


        choices: [
          { id: 'hide',  effect: { world: { exposure: -4 }, stats: { sanity: -2 },  tone: 'neutral' } },
          skip(),
        ],
      },
      {
        id: 'refused_t',
        require: { all: ['flag:refusedTribute'] },


        choices: [
          { id: 'prepare',  effect: { res: { materials: -1 }, world: { exposure: -2 },  tone: 'good' }, requires: { res: { materials: 1 } } },
          skip(),
        ],
      },
      {
        id: 'gov_h',
        require: { all: ['flag:govHostile'] },


        choices: [
          { id: 'correct',  effect: { world: { exposure: 5 }, stats: { sanity: -3 },  tone: 'bad' } },
          skip(),
        ],
      },
      {
        id: 'collab',
        require: { all: ['flag:markedCollaborator'] },


        choices: [
          { id: 'erase',  effect: { stats: { stamina: -8, sanity: -3 }, world: { exposure: 3 },  tone: 'neutral' } },
          skip(),
        ],
      },
      {
        id: 'boat',
        require: { all: ['flag:boatAccess'] },


        choices: [
          { id: 'map',  effect: { stats: { sanity: 2 },  tone: 'good' } },
          skip(),
        ],
      },
      {
        id: 'rescue',
        require: { all: ['flag:rescueContact'] },


        choices: [
          { id: 'retry',  effect: { world: { exposure: 3 }, stats: { sanity: -2 },  tone: 'neutral' } },
          skip(),
        ],
      },
      {
        id: 'fired',
        require: { all: ['flag:firedWarning'] },


        choices: [
          { id: 'clean',  effect: { stats: { stamina: -4, sanity: -2 },  tone: 'neutral' } },
          skip(),
        ],
      },
      {
        id: 'fought',
        require: { all: ['flag:foughtSoldiers'] },


        choices: [
          { id: 'avoid',  effect: { stats: { stamina: -6 }, world: { exposure: -2 },  tone: 'neutral' } },
          skip(),
        ],
      },
      {
        id: 'officer',
        require: { all: ['flag:officerFavor'] },


        choices: [
          { id: 'hold',  effect: { stats: { sanity: -2 },  tone: 'neutral' } },
          skip(),
        ],
      },
      {
        id: 'blizzard_open',
        require: { all: ['flag:openedDoorInBlizzard'] },


        choices: [
          { id: 'seal',  effect: { res: { materials: -1 },  tone: 'good' }, requires: { res: { materials: 1 } } },
          skip(),
        ],
      },
      {
        id: 'blizzard_closed',
        require: { all: ['flag:closedDoorInBlizzard'] },


        choices: [
          { id: 'live',  effect: { stats: { sanity: 3, humanity: -2 },  tone: 'grim' } },
          skip(),
        ],
      },
      {
        id: 'abandoned',
        require: { all: ['flag:abandonedShelter'] },


        choices: [
          { id: 'wake',  effect: { stats: { sanity: 2 },  tone: 'good' } },
          skip(),
        ],
      },
      {
        id: 'sump',
        require: { all: ['flag:sumpPump'] },


        choices: [
          { id: 'test',  effect: { res: { fuel: -0.5 }, stats: { sanity: 2 },  tone: 'good' }, requires: { res: { fuel: 1 } } },
          skip(),
        ],
      },
      {
        id: 'trader',
        require: { all: ['flag:metTrader'] },


        choices: [
          { id: 'yes',  effect: { stats: { sanity: 2 },  tone: 'good' } },
          skip(),
        ],
      },
      {
        id: 'seeds',
        require: { all: ['flag:hasSeeds'] },


        choices: [
          { id: 'pot',  effect: { stats: { sanity: 3, stamina: -4 },  tone: 'good' } },
          skip(),
        ],
      },
      {
        id: 'tintel',
        require: { all: ['flag:traderIntel'] },


        choices: [
          { id: 'note',  effect: { stats: { sanity: 1 },  tone: 'neutral' } },
          skip(),
        ],
      },
      {
        id: 'rob_t',
        require: { all: ['flag:robbedTrader'] },


        choices: [
          { id: 'live',  effect: { stats: { humanity: -2, sanity: -3 },  tone: 'grim' } },
          skip(),
        ],
      },
      {
        id: 'pump_key',
        require: { all: ['flag:pumpRoomKey'] },


        choices: [
          { id: 'hide',  effect: { stats: { sanity: -2 },  tone: 'neutral' } },
          skip(),
        ],
      },
      {
        id: 'dead',
        require: { all: ['flag:tookFromDead'] },


        choices: [
          { id: 'use',  effect: { stats: { humanity: -2, sanity: -2 },  tone: 'grim' } },
          skip(),
        ],
      },
      {
        id: 'fam_found',
        require: { all: ['flag:familyFound'] },


        choices: [
          { id: 'keep',  effect: { stats: { sanity: -3, humanity: 2 },  tone: 'neutral' } },
          skip(),
        ],
      },
      {
        id: 'fam_unk',
        require: { all: ['flag:familyUnknown'] },


        choices: [
          { id: 'write',  effect: { stats: { sanity: 3, humanity: 2 },  tone: 'good' } },
          skip(),
        ],
      },
      {
        id: 'convoy_f',
        require: { all: ['flag:convoyFailed'] },


        choices: [
          { id: 'stay',  effect: { stats: { sanity: 4 }, setFlags: ['flag:choseToStay'],  tone: 'good' } },
          skip(),
        ],
      },
      {
        id: 'property',
        require: { all: ['flag:propertyDeal'] },


        choices: [
          { id: 'keep',  effect: { stats: { sanity: 2 },  tone: 'neutral' } },
          skip(),
        ],
      },
      {
        id: 'robbed',
        require: { all: ['flag:robbedOnce'] },


        choices: [
          { id: 'chain',  effect: { res: { materials: -1 }, world: { exposure: -2 },  tone: 'good' }, requires: { res: { materials: 1 } } },
          skip(),
        ],
      },
      {
        id: 'took_fam',
        require: { all: ['flag:tookInFamily'] },


        choices: [
          { id: 'listen',  effect: { stats: { sanity: 2, humanity: 1 },  tone: 'neutral' } },
          skip(),
        ],
      },
      {
        id: 'fake_script',
        require: { all: ['flag:fakeScript'] },


        choices: [
          { id: 'burn',  effect: { stats: { sanity: 3, humanity: 1 },  tone: 'good' } },
          skip(),
        ],
      },
    ],
  },
];
