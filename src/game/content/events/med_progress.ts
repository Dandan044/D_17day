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
    title: '咳嗽带血',
    body: '手背上一小点红。你咳完才看见。\n烧还没退。药匣里还剩几板。',
    choices: [
      ch(
        'meds',
        '按疗程吃药',
        {
          res: { meds: -2 },
          removeCond: ['flu'],
          stats: { hp: 2, sanity: 2 },
          log: '你把两板药吃完。夜里咳得少了。',
          tone: 'good',
        },
        { requires: { res: { meds: 2 } } },
      ),
      ch(
        'endure',
        '硬扛',
        {
          stats: { hp: -4, stamina: -8, sanity: -3 },
          log: '你把痰吐进纸里，纸扔进垃圾袋。烧还在。',
          tone: 'grim',
        },
      ),
      skip('你躺下，把灯关了。', { stats: { stamina: 4, sanity: -2, hp: -2 } }),
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
    title: '红线又往上了',
    body: '早上量到手腕上方，现在快到肘。\n伤口本身不太疼了。这不是好消息。',
    choices: [
      ch(
        'treat',
        '用药清创',
        {
          res: { meds: -3 },
          removeCond: ['woundInfection'],
          stats: { hp: -4, sanity: -3 },
          log: '你清了创，包扎。红线停了一点。',
          tone: 'good',
        },
        { requires: { res: { meds: 3 }, modules: { medbay: 1 }, reason: '需要 1 级医疗站' } },
      ),
      ch(
        'meds_only',
        '只吃药',
        {
          res: { meds: -2 },
          stats: { hp: 1, sanity: -1 },
          log: '药吃了。红线还在，只是慢了一点。',
          tone: 'neutral',
        },
        { requires: { res: { meds: 2 } } },
      ),
      skip('你把袖子拉下来，不想再看。', { stats: { sanity: -4, hp: -3 } }),
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
    title: '腰眼两边疼',
    body: '蹲下接水时，两侧腰眼抽了一下。\n尿色比昨天深。回用喝了不少天。',
    choices: [
      ch(
        'stop_recycle',
        '今天停回用，改限水',
        {
          stats: { sanity: 2, stamina: -4 },
          log: '你把回用的壶推开。喉咙干，腰还是胀。',
          tone: 'neutral',
        },
      ),
      ch(
        'meds',
        '吃药顶一下',
        {
          res: { meds: -1 },
          stats: { sanity: 1 },
          log: '药下去了。疼淡了一点，水还是回用的。',
          tone: 'grim',
        },
        { requires: { res: { meds: 1 } } },
      ),
      skip('你站直，假装没事。', { stats: { hp: -2, sanity: -2 } }),
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
    title: '镜子里眼白发黄',
    body: '你刷牙时抬眼看镜子。眼白不是白的。\n皮肤也跟着一点黄。嘴里有金属味。',
    choices: [
      ch(
        'treat',
        '按黄疸用药',
        {
          res: { meds: -4 },
          removeCond: ['jaundice'],
          stats: { sanity: 2 },
          log: '你按说明吃了疗程。眼睛还黄，人能站直一点。',
          tone: 'good',
        },
        { requires: { res: { meds: 4 }, modules: { medbay: 2 }, reason: '需要 2 级医疗站' } },
      ),
      ch(
        'wait',
        '再观察两天',
        {
          stats: { sanity: -4, hp: -2 },
          log: '你把镜子转过去。黄还在眼角余光里。',
          tone: 'grim',
        },
      ),
      skip('你关掉灯，不去看。', { stats: { sanity: -3 } }),
    ],
  }),
];
