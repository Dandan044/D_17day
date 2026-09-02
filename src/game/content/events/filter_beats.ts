import type { EventFamily } from '../../types';
import { beat, ch, skip } from './factory';

/**
 * 净水相关即时事件：雨雪接水、旱天回用、滤芯与心理。
 * 强度压在 1–2，不发重病。
 */
export const FILTER_BEAT_EVENTS: EventFamily[] = [
  beat({
    id: 'filter_first_recycle',
    kind: 'moral',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 11,
    require: { all: ['water:recycling'], none: ['weather:precip'] },


    choices: [
      ch(
        'keep',
        {
          stats: { sanity: -4, humanity: -1 },

          tone: 'grim',
        },
      ),
      ch(
        'dump',
        {
          stats: { sanity: 2 },

          tone: 'neutral',
        },
      ),
      skip({ stats: { sanity: -2 } }),
    ],
  }),

  beat({
    id: 'filter_ammonia_rim',
    kind: 'medical',
    intensity: 1,
    phase: ['survival'],
    weight: 8,
    cooldown: 12,
    require: { all: ['water:recycling', 'mod:filter>=1'] },


    choices: [
      ch(
        'refilter',
        {
          stats: { stamina: -8, sanity: 2 },

          tone: 'good',
        },
      ),
      ch(
        'drink_anyway',
        {
          stats: { sanity: -3 },
          addCond: ['dysentery'],

          tone: 'bad',
        },
      ),
      skip({ stats: { stamina: -2 } }),
    ],
  }),

  beat({
    id: 'filter_yellow_rain',
    kind: 'weather',
    intensity: 2,
    phase: ['survival'],
    weight: 9,
    cooldown: 10,
    require: { all: ['weather:precip', 'mod:filter=1'] },


    choices: [
      ch(
        'keep',
        {
          res: { water: 2 },
          wear: { filterLife: -1 },
          stats: { sanity: -2 },

          tone: 'neutral',
        },
      ),
      ch(
        'dump',
        {
          res: { water: -4 },
          stats: { sanity: 1 },

          tone: 'grim',
        },
        { requires: { res: { water: 4 } } },
      ),
      skip({ stats: { sanity: -1 } }),
    ],
  }),

  beat({
    id: 'filter_core_brown',
    kind: 'medical',
    intensity: 2,
    phase: ['survival'],
    weight: 9,
    cooldown: 14,
    require: { all: ['mod:filter>=1', 'wear:filterLife<=8'] },


    choices: [
      ch(
        'swap',
        {
          ap: -1,
          res: { parts: -2 },
          wear: { filterLife: 20 },
          stats: { stamina: -6, sanity: 3 },

          tone: 'good',
        },
        { requires: { res: { parts: 2 }, ap: 1 } },
      ),
      ch(
        'stretch',
        {
          wear: { filterLife: -2 },
          stats: { sanity: -2 },

          tone: 'grim',
        },
      ),
      skip({ stats: { sanity: -1 } }),
    ],
  }),

  beat({
    id: 'filter_black_rain_rim',
    kind: 'weather',
    intensity: 2,
    phase: ['survival'],
    weight: 10,
    cooldown: 10,
    require: { all: ['weather:blackRain', 'mod:filter>=1'] },


    choices: [
      ch(
        'catch',
        {
          res: { water: 5 },
          wear: { filterLife: -2 },
          world: { radiation: 1 },
          stats: { sanity: -2 },

          tone: 'neutral',
        },
      ),
      ch(
        'skip_rain',
        {
          stats: { sanity: 1 },

          tone: 'good',
        },
      ),
      skip({ stats: { stamina: -2 } }),
    ],
  }),

  beat({
    id: 'filter_clear_out',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],
    weight: 7,
    cooldown: 16,
    require: { all: ['weather:precip', 'mod:filter>=3'] },


    choices: [
      ch(
        'extra',
        {
          res: { water: 4 },
          world: { exposure: 3 },
          stats: { stamina: -4 },

          tone: 'good',
        },
      ),
      ch(
        'share',
        {
          res: { water: -2 },
          stats: { humanity: 4, sanity: 3 },
          world: { neighborhood: 4, exposure: 2 },

          tone: 'good',
        },
        { requires: { res: { water: 2 } } },
      ),
      skip({ stats: { sanity: 1 } }),
    ],
  }),

  beat({
    id: 'filter_taste_gone',
    kind: 'moral',
    intensity: 1,
    phase: ['survival'],
    weight: 8,
    cooldown: 12,
    require: { all: ['water:recycling', 'mod:filter>=2'] },


    choices: [
      ch(
        'more',
        {
          res: { water: -2 },
          stats: { sanity: -2 },
          addCond: ['dysentery'],

          tone: 'bad',
        },
        { requires: { res: { water: 2 } } },
      ),
      ch(
        'ration',
        {
          stats: { sanity: 2 },

          tone: 'good',
        },
      ),
      skip({ stats: { sanity: -1 } }),
    ],
  }),

  beat({
    id: 'filter_half_basin',
    kind: 'social',
    intensity: 1,
    phase: ['survival'],
    weight: 8,
    cooldown: 10,
    require: { all: ['water:stored:low'], none: ['weather:precip'] },


    choices: [
      ch(
        'limit',
        {
          stats: { sanity: -2, stamina: -4 },

          tone: 'neutral',
        },
      ),
      ch(
        'normal',
        {
          res: { water: -2 },
          stats: { sanity: 1 },

          tone: 'grim',
        },
        { requires: { res: { water: 2 } } },
      ),
      skip({ stats: { sanity: -1 } }),
    ],
  }),

  beat({
    id: 'filter_tank_full',
    kind: 'opportunity',
    intensity: 1,
    phase: ['survival'],
    weight: 7,
    cooldown: 14,
    require: { all: ['weather:precip', 'mod:filter>=2'] },


    choices: [
      ch(
        'stop',
        {
          wear: { filterLife: 1 },
          stats: { sanity: 2 },

          tone: 'good',
        },
      ),
      ch(
        'give',
        {
          res: { water: -4 },
          stats: { humanity: 5, reputation: 3, sanity: 3 },
          world: { neighborhood: 6, exposure: 4 },

          tone: 'good',
        },
        { requires: { res: { water: 4 } } },
      ),
      skip({ wear: { filterLife: -1 }, stats: { sanity: -1 } }),
    ],
  }),

  beat({
    id: 'filter_puddle_scoop',
    kind: 'medical',
    intensity: 2,
    phase: ['survival'],
    weight: 8,
    cooldown: 12,
    require: { all: ['site:urban'], none: ['weather:precip', 'mod:filter>=1'] },


    choices: [
      ch(
        'boil',
        {
          res: { water: 3, fuel: -0.5 },
          stats: { stamina: -6 },
          addCond: ['dysentery'],

          tone: 'bad',
        },
        { requires: { res: { fuel: 0.5 } } },
      ),
      ch(
        'leave',
        {
          stats: { sanity: 1, stamina: -2 },

          tone: 'good',
        },
      ),
      skip({ stats: { sanity: -2 } }),
    ],
  }),
];
