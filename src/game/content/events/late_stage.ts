import type { EventFamily } from '../../types';
import { beat, ch, skip } from './factory';
import { URBAN_OR_HIGH } from './queries';

/**
 * 后期通用环境事件（threat 5-6）：任何灾难下的城市都在自行荒废。
 * 档位下限由 minThreat/maxThreat 限定，灾难不限。
 */
export const LATE_STAGE_EVENTS: EventFamily[] = [
  beat({
    id: 'city_grass_crack',
    kind: 'weather',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 5,
    minThreat: 5,
    maxThreat: 6,
    require: URBAN_OR_HIGH,

    choices: [
      ch('cut', { res: { fuel: 1 }, world: { exposure: 3 }, stats: { stamina: -4 }, tone: 'neutral' }, { label: '割一把回去当引火草' }),
      ch('look', { stats: { sanity: 2 }, tone: 'neutral' }, { label: '看一眼就回去' }),
      skip(),
    ],
  }),
  beat({
    id: 'stair_frost_heave',
    kind: 'threat',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 5,
    minThreat: 5,
    maxThreat: 6,
    require: { any: ['weather:blizzard', 'temp:freezing', 'temp:extreme'] },

    choices: [
      ch(
        'chip',
        { res: { materials: -1 }, stats: { stamina: -8 }, tone: 'good' },
        { requires: { res: { materials: 1 }, reason: '需要 1 份建材' }, label: '找工具把翘角敲平' },
      ),
      ch('careful', { stats: { stamina: -3 }, tone: 'neutral' }, { label: '每天横着脚慢慢走' }),
      skip({ stats: { hp: -2 }, tone: 'bad' }),
    ],
  }),
];
