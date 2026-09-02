import type { EventFamily } from '../../types';
import { beat, ch, skip } from './factory';

/**
 * 病程提醒事件：恶化主逻辑在 health 引擎，这里只做抉择与铺垫。
 * 强度压在 2–3，minThreat 避免开局砸脸。
 */
export const MED_PROGRESS_EVENTS: EventFamily[] = [
  beat({
    id: 'med_flu_blood_cough',
    kind: 'medical',
    intensity: 3,
    phase: ['survival'],
    weight: 8,
    cooldown: 16,
    minThreat: 2,
    require: { all: ['cond:flu'] },


    choices: [
      ch(
        'meds',
        {
          res: { meds: -2 },
          removeCond: ['flu'],
          stats: { hp: 2, sanity: 2 },

          tone: 'good',
        },
        { requires: { res: { meds: 2 } } },
      ),
      ch(
        'endure',
        {
          stats: { hp: -4, stamina: -8, sanity: -3 },

          tone: 'grim',
        },
      ),
      skip({ stats: { sanity: -2, hp: -2 } }),
    ],
  }),

  beat({
    id: 'med_wound_line',
    kind: 'medical',
    intensity: 3,
    phase: ['survival'],
    weight: 7,
    cooldown: 18,
    minThreat: 2,
    require: { all: ['cond:woundInfection'] },


    choices: [
      ch(
        'treat',
        {
          res: { meds: -3 },
          removeCond: ['woundInfection'],
          stats: { hp: -4, sanity: -3 },

          tone: 'good',
        },
        { requires: { res: { meds: 3 }, modules: { medbay: 1 }, reason: '需要 1 级医疗站' } },
      ),
      ch(
        'meds_only',
        {
          res: { meds: -2 },
          stats: { hp: 1, sanity: -1 },

          tone: 'neutral',
        },
        { requires: { res: { meds: 2 } } },
      ),
      skip({ stats: { sanity: -4, hp: -3 } }),
    ],
  }),

  beat({
    id: 'med_recycle_flank',
    kind: 'medical',
    intensity: 2,
    phase: ['survival'],
    weight: 7,
    cooldown: 14,
    minThreat: 3,
    require: { all: ['water:recycling'] },


    choices: [
      ch(
        'stop_recycle',
        {
          stats: { sanity: 2, stamina: -4 },

          tone: 'neutral',
        },
      ),
      ch(
        'meds',
        {
          res: { meds: -1 },
          stats: { sanity: 1 },

          tone: 'grim',
        },
        { requires: { res: { meds: 1 } } },
      ),
      skip({ stats: { hp: -2, sanity: -2 } }),
    ],
  }),

  beat({
    id: 'med_eyes_yellow',
    kind: 'medical',
    intensity: 3,
    phase: ['survival'],
    weight: 7,
    cooldown: 16,
    minThreat: 3,
    require: { any: ['cond:jaundice', 'cond:dysentery', 'cond:giardia'] },


    choices: [
      ch(
        'treat',
        {
          res: { meds: -4 },
          removeCond: ['jaundice'],
          stats: { sanity: 2 },

          tone: 'good',
        },
        { requires: { res: { meds: 4 }, modules: { medbay: 2 }, reason: '需要 2 级医疗站' } },
      ),
      ch(
        'wait',
        {
          stats: { sanity: -4, hp: -2 },

          tone: 'grim',
        },
      ),
      skip({ stats: { sanity: -3, hp: -2 } }),
    ],
  }),
];
