import type { EventFamily } from '../../types';
import { beat, ch, skip } from './factory';
import { NUC } from './queries';

/**
 * 核战后期（threat 5-6，荒芜期/死寂期）：人烟散尽后的城市。
 * 人物事件让位给环境与辐射，保留极少量人性之光（nuke_last_light）。
 */
export const LATE_NUCLEAR_EVENTS: EventFamily[] = [
  beat({
    id: 'nuke_dead_city_walk',
    kind: 'weather',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 6,
    minThreat: 5,
    maxThreat: 6,
    require: NUC,

    choices: [
      ch('look', { stats: { sanity: -6, stamina: -4 }, tone: 'grim' }, { label: '把整条街看一遍再下楼' }),
      ch('quick', { stats: { sanity: -3 }, tone: 'neutral' }, { label: '扫一眼就下去' }),
      skip(),
    ],
  }),
  beat({
    id: 'nuke_rad_hotspot',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 6,
    minThreat: 5,
    maxThreat: 6,
    require: NUC,

    choices: [
      ch('detour', { stats: { stamina: -8 }, tone: 'neutral' }, { label: '多爬两层绕过去' }),
      ch(
        'cap',
        {
          res: { materials: -2 },
          world: { radiation: -2 },
          stats: { stamina: -6 },
          tone: 'good',
        },
        { requires: { res: { materials: 2 }, reason: '需要 2 份建材' }, label: '用纸板盖住灰堆，泼水压尘' },
      ),
      {
        id: 'dash',
        label: '屏住呼吸，三步冲过拐角',
        check: {
          skill: 'fitness',
          dc: 12,
          ok: {
            stats: { stamina: -4 },
            tone: 'neutral',
          },
          bad: {
            stats: { hp: -4, sanity: -4 },
            world: { radiation: 3 },
            tone: 'bad',
          },
        },
      },
    ],
  }),
  beat({
    id: 'nuke_empty_floor',
    kind: 'story',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 6,
    minThreat: 5,
    maxThreat: 6,
    require: { all: ['disaster:nuclear'], any: ['site:urban', 'site:highFloor'] },

    choices: [
      ch('take_little', { res: { fuel: 1 }, stats: { sanity: -2 }, tone: 'neutral' }, { label: '拿上打火机就走' }),
      ch(
        'search',
        {
          res: { foodStaple: 2, materials: 3 },
          world: { exposure: 4 },
          stats: { sanity: -6, humanity: -2 },
          tone: 'grim',
        },
        { label: '仔细翻一遍再走' },
      ),
      ch('close_door', { stats: { sanity: 2 }, tone: 'neutral' }, { label: '带上门，不进去' }),
    ],
  }),
  beat({
    id: 'nuke_far_collapse',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 6,
    minThreat: 5,
    maxThreat: 6,
    require: NUC,

    choices: [
      ch(
        'seal',
        { res: { materials: -1 }, world: { exposure: -4 }, stats: { stamina: -6 }, tone: 'good' },
        { requires: { res: { materials: 1 }, reason: '需要 1 份建材' }, label: '把窗缝重新封一遍' },
      ),
      ch('watch', { world: { exposure: 3, radiation: 1 }, stats: { sanity: -4 }, tone: 'bad' }, { label: '开窗看一眼方向' }),
      skip(),
    ],
  }),
  beat({
    id: 'nuke_snow_silence',
    kind: 'weather',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 6,
    minThreat: 6,
    maxThreat: 6,
    require: NUC,

    choices: [
      ch('clear', { stats: { stamina: -10 }, world: { exposure: 3 }, tone: 'neutral' }, { label: '把门口的雪铲开' }),
      ch(
        'seal_door',
        { res: { materials: -1 }, stats: { sanity: 3 }, tone: 'good' },
        { requires: { res: { materials: 1 }, reason: '需要 1 份建材' }, label: '回屋给门缝加一道挡条' },
      ),
      skip(),
    ],
  }),
  beat({
    id: 'nuke_geiger_snow',
    kind: 'opportunity',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 5,
    minThreat: 6,
    maxThreat: 6,
    require: { all: ['disaster:nuclear', 'hasGeiger'] },

    choices: [
      ch(
        'go_out',
        { res: { foodStaple: 2, water: 2 }, world: { exposure: 4 }, stats: { sanity: 4 }, tone: 'good' },
        { label: '趁读数低出门跑一趟' },
      ),
      ch('stay', { stats: { sanity: 1 }, tone: 'neutral' }, { label: '按老规矩，这周不出门' }),
    ],
  }),
  beat({
    id: 'nuke_last_light',
    kind: 'moral',
    intensity: 4,
    phase: ['survival'],
    once: true,
    weight: 5,
    minThreat: 6,
    maxThreat: 6,
    require: NUC,

    choices: [
      ch('answer', { world: { exposure: 10 }, stats: { humanity: 8, sanity: 5 }, tone: 'good' }, { label: '把自己的灯也亮一夜' }),
      ch('flash', { world: { exposure: 4 }, stats: { humanity: 4, sanity: 2 }, tone: 'neutral' }, { label: '用手电回三下就灭' }),
      ch('dark', { stats: { sanity: -4, humanity: -2 }, tone: 'grim' }, { label: '坐在黑暗里，看它亮' }),
    ],
  }),
];
