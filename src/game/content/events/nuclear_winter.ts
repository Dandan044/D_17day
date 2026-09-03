import type { EventFamily } from '../../types';
import { beat, ch } from './factory';

/** 核冬天首日双分支：跌破舒适线 → 寒冬来临；守住舒适线 → 未雨绸缪的回报 */
export const NUCLEAR_WINTER_EVENTS: EventFamily[] = [
  beat({
    id: 'nw_winter_arrives',
    kind: 'weather',
    intensity: 4,
    phase: ['survival'],
    weight: 0,
    once: true,
    require: { all: ['disaster:nuclear'] },
    choices: [
      ch(
        'burn_furniture',
        {
          res: { materials: -4 },
          indoor: 6,
          stats: { stamina: -10, sanity: -3 },
          tone: 'neutral',
        },
        { requires: { res: { materials: 4 } } },
      ),
      ch(
        'full_burn',
        {
          res: { fuel: -8 },
          indoor: 9,
          stats: { stamina: -6 },
          tone: 'good',
        },
        { requires: { res: { fuel: 8 } } },
      ),
      ch('huddle', { stats: { hp: -4, stamina: -6, sanity: -4 }, tone: 'bad' }),
    ],
  }),
  beat({
    id: 'nw_winter_reward',
    kind: 'social',
    intensity: 2,
    phase: ['survival'],
    weight: 0,
    once: true,
    require: { all: ['disaster:nuclear'] },
    choices: [
      ch(
        'share',
        {
          res: { fuel: -3 },
          stats: { humanity: 6, reputation: 5 },
          world: { neighborhood: 6 },
          stance: { neighbors: 8 },
          tone: 'good',
        },
        { requires: { res: { fuel: 3 } } },
      ),
      ch(
        'hot_water',
        {
          res: { water: -3, fuel: -1 },
          stats: { humanity: 3, sanity: 4 },
          tone: 'good',
        },
        { requires: { res: { water: 3, fuel: 1 } } },
      ),
      ch('quiet', { stats: { sanity: -3, humanity: -2 }, tone: 'neutral' }),
    ],
  }),
];
