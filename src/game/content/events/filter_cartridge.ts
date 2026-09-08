import type { EventFamily } from '../../types';
import { beat, ch, skip } from './factory';

/**
 * 滤芯专项事件：交易（链式）、受伤换取、人性检定赠芯、零件修复。
 * 除交易主线（拒绝后三天内再上门一次）外均整局一次。
 * 备用芯数量走 run.items.filter（fact: item:filter），效果经 eff.items 结算。
 */
export const FILTER_CARTRIDGE_EVENTS: EventFamily[] = [
  // ---------- ① 交易获芯：拒绝后还会再出现一次 ----------
  beat({
    id: 'filter_trader',
    kind: 'opportunity',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 8,
    minThreat: 1,
    require: { any: ['mod:filter>=1', 'mod:airFilter>=1'], none: ['item:filter>=1'] },
    choices: [
      ch(
        'buy',
        {
          res: { cash: -300, foodStaple: -3 },
          items: { filter: 1 },
          stats: { sanity: 3 },
          tone: 'good',
        },
        { requires: { res: { cash: 300, foodStaple: 3 } } },
      ),
      ch(
        'refuse',
        {
          stats: { sanity: -2 },
          schedule: [{ familyId: 'filter_trader_follow', inDays: 3 }],
          tone: 'neutral',
        },
      ),
      skip({ stats: { sanity: -2 } }),
    ],
  }),

  // 续篇：只由 schedule 可达（weight 0），再拒绝就永远没了
  beat({
    id: 'filter_trader_follow',
    kind: 'opportunity',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 0,
    forbid: { all: ['item:filter>=1'] },
    choices: [
      ch(
        'buy',
        {
          res: { cash: -300, foodStaple: -3 },
          items: { filter: 1 },
          stats: { sanity: 3 },
          tone: 'good',
        },
        { requires: { res: { cash: 300, foodStaple: 3 } } },
      ),
      ch('refuse', { stats: { sanity: -2 }, tone: 'neutral' }),
      skip({ stats: { sanity: -2 } }),
    ],
  }),

  // ---------- ② 以受伤为代价获芯 ----------
  beat({
    id: 'filter_wounded_trader',
    kind: 'opportunity',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 6,
    minThreat: 2,
    require: { any: ['mod:filter>=1', 'mod:airFilter>=1'], none: ['item:filter>=1'] },
    choices: [
      ch(
        'crawl',
        {
          items: { filter: 1 },
          stats: { hp: -10, stamina: -10, humanity: 2 },
          setFlags: ['flag:helpedWoundedTrader'],
          tone: 'neutral',
        },
      ),
      ch(
        'take',
        {
          items: { filter: 1 },
          stats: { sanity: -4 },
          setFlags: ['flag:tookFromWoundedTrader'],
          tone: 'grim',
        },
      ),
      skip({ stats: { sanity: -2 } }),
    ],
  }),

  // ---------- ③ 人性检定赠芯：滤芯耐久不足 6 且人性 > 75，整局一次 ----------
  beat({
    id: 'filter_cartridge_samaritan',
    kind: 'social',
    intensity: 1,
    phase: ['survival'],
    once: true,
    weight: 0,
    choices: [
      ch('accept', { items: { filter: 1 }, stats: { sanity: 4, humanity: 3 }, tone: 'good' }),
    ],
  }),

  // ---------- ④ 零件修复：滤芯耗尽且无备用芯，5 零件 +15 耐久，整局一次 ----------
  beat({
    id: 'filter_rebuild',
    kind: 'opportunity',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 9,
    require: { all: ['filter:expired'], none: ['item:filter>=1'] },
    choices: [
      ch(
        'repair',
        {
          ap: -1,
          res: { parts: -5 },
          wear: { filterLife: 15 },
          stats: { stamina: -8, sanity: 3 },
          tone: 'good',
        },
        { requires: { res: { parts: 5 }, ap: 1 } },
      ),
      ch('give_up', { stats: { sanity: -3 }, tone: 'bad' }),
      skip({ stats: { sanity: -3 } }),
    ],
  }),
];
