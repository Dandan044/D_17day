import type { EventFamily } from '../../types';
import { beat, ch, skip } from './factory';

/**
 * 收音机等级检定。
 *
 * 1 级电台即可收发，所以这些家族一律挂在 mod:radio>=1 上——断电或电台施工时自然不出现。
 * 2/3 级电台解锁的不是「能不能回话」，而是更狠的处置：锁死频段、定向回话、测向定位。
 */
export const RADIO_EVENTS: EventFamily[] = [
  beat({
    id: 'radio_sweep',
    kind: 'story',
    intensity: 2,
    phase: ['survival'],
    weight: 8,
    minThreat: 1,
    maxThreat: 6,
    require: { all: ['mod:radio>=1'] },
    variants: [
      {
        id: 'band',
        choices: [
          {
            id: 'log_band',
            requires: { modules: { radio: 2 }, reason: '需要 2 级电台（收发机）才能锁死频段' },
            effect: { stats: { sanity: 4 }, setFlags: ['flag:radioBandLogged'], tone: 'good' },
          },
          {
            id: 'listen',
            effect: { stats: { sanity: 6 }, tone: 'neutral' },
          },
          skip(),
        ],
      },
      {
        id: 'band_revisit',
        require: { any: ['flag:radioBandLogged'] },
        choices: [
          {
            id: 'reparse',
            effect: { stats: { sanity: 3 }, tone: 'good' },
          },
          ch('erase', { stats: { sanity: -2 }, clearFlags: ['flag:radioBandLogged'], tone: 'grim' }),
        ],
      },
    ],
  }),
  beat({
    id: 'radio_distress',
    kind: 'social',
    intensity: 3,
    phase: ['survival'],
    weight: 7,
    minThreat: 1,
    maxThreat: 5,
    require: { all: ['mod:radio>=1'] },
    variants: [
      {
        id: 'voice',
        choices: [
          {
            id: 'answer_directed',
            requires: { modules: { radio: 2 }, reason: '需要 2 级电台（收发机）才能定向回话' },
            effect: {
              stats: { sanity: 7, humanity: 4 },
              world: { exposure: 9 },
              setFlags: ['flag:radioAnswered'],
              schedule: [{ familyId: 'radio_echo', inDays: 3 }],
              tone: 'good',
            },
          },
          {
            id: 'note_bearing',
            effect: { stats: { sanity: 2 }, tone: 'neutral' },
          },
          skip(),
        ],
      },
      {
        id: 'voice_after',
        require: { any: ['flag:radioAnswered'] },
        choices: [
          {
            id: 'hold_freq',
            effect: { stats: { sanity: 4 }, world: { exposure: 3 }, tone: 'neutral' },
          },
          skip(),
        ],
      },
    ],
  }),
  beat({
    id: 'radio_echo',
    kind: 'story',
    intensity: 2,
    phase: ['survival'],
    weight: 8,
    minThreat: 1,
    maxThreat: 6,
    require: { all: ['mod:radio>=1'] },
    variants: [
      {
        id: 'answered',
        require: { any: ['flag:radioAnswered'] },
        choices: [
          {
            id: 'meet',
            requires: { modules: { radio: 2 }, reason: '需要 2 级电台（收发机）才能跟进这次约定' },
            effect: { stats: { sanity: 6, humanity: 3 }, world: { exposure: 6 }, tone: 'good' },
          },
          {
            id: 'decline',
            effect: { stats: { sanity: -3 }, tone: 'grim' },
          },
          skip(),
        ],
      },
      {
        id: 'plain',
        choices: [
          {
            id: 'listen_static',
            effect: { stats: { sanity: 2 }, tone: 'neutral' },
          },
          skip(),
        ],
      },
    ],
  }),
  beat({
    id: 'radio_triangulate',
    kind: 'opportunity',
    intensity: 3,
    phase: ['survival'],
    weight: 7,
    minThreat: 2,
    maxThreat: 6,
    require: { all: ['mod:radio>=1'] },
    variants: [
      {
        id: 'hunt',
        choices: [
          {
            id: 'lock',
            requires: { modules: { radio: 3 }, reason: '需要 3 级电台才能测向锁定' },
            check: {
              skill: 'mechanics',
              dc: 13,
              ok: { stats: { sanity: 5 }, setFlags: ['flag:radioJamLocated'], tone: 'good' },
              bad: { stats: { sanity: -5 }, world: { exposure: 6 }, tone: 'bad' },
            },
          },
          {
            id: 'hand_sweep',
            effect: { stats: { stamina: -6, sanity: 1 }, tone: 'neutral' },
          },
          skip(),
        ],
      },
      {
        id: 'jam_after',
        require: { any: ['flag:radioJamLocated'] },
        choices: [
          {
            id: 'raid_source',
            effect: { stats: { stamina: -5, sanity: 3 }, tone: 'good' },
          },
          skip(),
        ],
      },
    ],
  }),
  beat({
    id: 'nuke_radio_beacon',
    kind: 'story',
    intensity: 3,
    phase: ['survival'],
    weight: 7,
    minThreat: 1,
    maxThreat: 6,
    require: { all: ['mod:radio>=1', 'disaster:nuclear'] },
    variants: [
      {
        id: 'beacon',
        choices: [
          {
            id: 'fix_north',
            requires: { modules: { radio: 2 }, reason: '需要 2 级电台（收发机）才能交叉截获信标' },
            effect: {
              stats: { sanity: 4 },
              setFlags: ['flag:knowsNorthRoute', 'flag:radioBeaconFix'],
              tone: 'good',
            },
          },
          {
            id: 'guess',
            effect: { stats: { sanity: -3 }, tone: 'grim' },
          },
          skip(),
        ],
      },
      {
        id: 'beacon_after',
        require: { any: ['flag:radioBeaconFix'] },
        choices: [
          {
            id: 'pack_north',
            effect: { stats: { stamina: -6, sanity: 2 }, tone: 'neutral' },
          },
          skip(),
        ],
      },
    ],
  }),
];
