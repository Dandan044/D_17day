import type { EventFamily } from '../../types';
import { beat, ch, skip } from './factory';
import { URBAN_OR_HIGH } from './queries';

const COLD = { any: ['weather:blizzard', 'temp:cold', 'temp:freezing', 'temp:extreme'] };

/**
 * 目击式高强度黑暗事件（threat 3-6，每档 6 个）。
 * 掠夺期=目击失序，严冬期=冻毙，荒芜期=成户死亡/乱葬岗/食人，死寂期=最后的黑暗。
 * 均为 intensity 3 档或边缘 2 档，受 pacing 预算保护不会连刷。
 */
export const DARK_WITNESS_EVENTS: EventFamily[] = [
  // ================= threat 3 掠夺期：目击失序 =================
  beat({
    id: 'pl_under_breakin',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 6,
    minThreat: 3,
    maxThreat: 3,
    require: URBAN_OR_HIGH,

    choices: [
      ch('pipes', { world: { exposure: 10 }, stats: { sanity: -4, stamina: -2 }, tone: 'neutral' }, { label: '敲暖气管，大声喊人' }),
      ch(
        'down',
        {},
        {
          label: '拿上刀下楼',
          check: {
            skill: 'fitness',
            dc: 12,
            ok: { world: { exposure: 8 }, stats: { sanity: -6, stamina: -8 }, tone: 'good' },
            bad: { world: { exposure: 14 }, stats: { hp: -8, sanity: -8 }, tone: 'bad' },
          },
        },
      ),
      ch('dark', { stats: { sanity: -8 }, tone: 'bad' }, { label: '关灯，装作没听见' }),
    ],
  }),
  beat({
    id: 'pl_looted_sill',
    kind: 'threat',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 5,
    minThreat: 3,
    maxThreat: 4,
    require: URBAN_OR_HIGH,

    choices: [
      ch('give', { res: { foodStaple: -1 }, stats: { sanity: -2 }, tone: 'good' }, { label: '把自己带的一盒吃的放下' }),
      ch('ask', { stats: { sanity: -6, stamina: -2 }, tone: 'neutral' }, { label: '过去问一句' }),
      ch('bypass', { stats: { sanity: -6 }, tone: 'bad' }, { label: '从街对面绕开' }),
    ],
  }),
  beat({
    id: 'pl_boy_beaten',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 5,
    minThreat: 3,
    maxThreat: 4,
    require: URBAN_OR_HIGH,

    choices: [
      ch('pull', { world: { exposure: 14 }, stats: { sanity: -6, stamina: -8 }, tone: 'good' }, { label: '上前把人拉开' }),
      ch('toss', { res: { foodStaple: -1 }, stats: { sanity: -4 }, tone: 'neutral' }, { label: '往反方向扔半袋吃的，引开他们' }),
      ch('pass', { stats: { sanity: -8 }, tone: 'bad' }, { label: '低头走开' }),
    ],
  }),
  beat({
    id: 'pl_fight_night',
    kind: 'threat',
    intensity: 2,
    phase: ['survival'],
    weight: 5,
    cooldown: 20,
    minThreat: 3,
    maxThreat: 4,
    require: URBAN_OR_HIGH,

    choices: [
      ch('knock', { world: { exposure: 8 }, stats: { sanity: -2, stamina: -4 }, tone: 'neutral' }, { label: '去敲他们的门' }),
      ch('note', { stats: { sanity: -2 }, tone: 'neutral' }, { label: '从门缝塞一张写着你门牌的纸条' }),
      skip({ stats: { sanity: -4 }, tone: 'bad' }),
    ],
  }),
  beat({
    id: 'pl_warning_corpse',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 6,
    minThreat: 3,
    maxThreat: 4,
    require: URBAN_OR_HIGH,

    choices: [
      ch('detour', { stats: { sanity: -6, stamina: -2 }, tone: 'neutral' }, { label: '绕后门，不从他身边过' }),
      ch('bury', { stats: { sanity: -4, stamina: -12 }, tone: 'good' }, { label: '夜里把人抬走埋了' }),
      ch('ignore', { stats: { sanity: -8 }, tone: 'bad' }, { label: '当没看见' }),
    ],
  }),
  beat({
    id: 'pl_drag_marks',
    kind: 'threat',
    intensity: 2,
    phase: ['survival'],
    weight: 5,
    cooldown: 18,
    minThreat: 3,
    maxThreat: 4,
    require: URBAN_OR_HIGH,

    choices: [
      ch('route', { stats: { sanity: -4, stamina: -2 }, tone: 'neutral' }, { label: '换一条路线' }),
      ch('mark', { world: { exposure: 6 }, stats: { sanity: 2 }, tone: 'good' }, { label: '在拐角做记号，提醒这层的住户' }),
      ch('sneak', { stats: { sanity: -6 }, tone: 'bad' }, { label: '不动声色，快步通过' }),
    ],
  }),

  // ================= threat 4 严冬期：冻毙 =================
  beat({
    id: 'wn_undress_snow',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 6,
    minThreat: 4,
    maxThreat: 6,
    require: COLD,

    choices: [
      ch('drag', { stats: { hp: -2, sanity: -8, stamina: -12 }, tone: 'neutral' }, { label: '冲下去把人拖回来' }),
      ch('cover', { res: { materials: -0.5 }, stats: { sanity: -8, stamina: -4 }, tone: 'neutral' }, { label: '下去给他盖上外套，让他走得体面' }),
      ch('curtain', { stats: { sanity: -8 }, tone: 'bad' }, { label: '拉上窗帘' }),
    ],
  }),
  beat({
    id: 'wn_dog_frozen',
    kind: 'moral',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 5,
    minThreat: 4,
    maxThreat: 6,
    require: COLD,

    choices: [
      ch('adopt', { res: { foodStaple: -1 }, stats: { sanity: 4 }, tone: 'good' }, { label: '把狗抱回来养' }),
      ch('feed', { res: { foodStaple: -0.5 }, stats: { sanity: -6 }, tone: 'neutral' }, { label: '喂它一顿，然后赶它走' }),
      ch('otherway', { stats: { sanity: -8 }, tone: 'bad' }, { label: '当没看见，从另一头下楼' }),
    ],
  }),
  beat({
    id: 'wn_queue_dead',
    kind: 'threat',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 5,
    minThreat: 4,
    maxThreat: 6,
    require: COLD,

    choices: [
      ch('carry', { stats: { sanity: -6, stamina: -8 }, tone: 'good' }, { label: '帮忙把人抬到墙边' }),
      ch('stay', { res: { water: 2 }, stats: { sanity: -6, stamina: -6 }, tone: 'neutral' }, { label: '站回队伍里，继续排' }),
      ch('leave', { stats: { sanity: -4 }, tone: 'neutral' }, { label: '退出队伍回家' }),
    ],
  }),
  beat({
    id: 'wn_frozen_grave',
    kind: 'moral',
    intensity: 2,
    phase: ['survival'],
    weight: 5,
    cooldown: 20,
    minThreat: 4,
    maxThreat: 6,
    require: COLD,

    choices: [
      ch('dig', { stats: { sanity: 2, stamina: -14 }, tone: 'good' }, { label: '用大锤和钢钎凿开冻土' }),
      ch('mound', { stats: { sanity: -4, stamina: -4 }, tone: 'neutral' }, { label: '改堆雪成坟，压上砖' }),
      skip({ stats: { sanity: -6 }, tone: 'bad' }),
    ],
  }),
  beat({
    id: 'wn_night_crying',
    kind: 'threat',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 5,
    minThreat: 4,
    maxThreat: 4,

    choices: [
      ch('meds', { res: { meds: -1 }, stats: { sanity: 2 }, tone: 'good' }, { label: '敲开那扇门，把退烧药递进去' }),
      ch('stand', { stats: { sanity: -6 }, tone: 'neutral' }, { label: '去楼道里站一会' }),
      ch('cover', { stats: { sanity: -8 }, tone: 'bad' }, { label: '蒙住头不去听' }),
    ],
  }),
  beat({
    id: 'wn_oil_fight',
    kind: 'threat',
    intensity: 2,
    phase: ['survival'],
    weight: 5,
    cooldown: 18,
    minThreat: 4,
    maxThreat: 6,
    require: COLD,

    choices: [
      ch('separate', { world: { exposure: 10 }, stats: { sanity: -4, stamina: -4 }, tone: 'neutral' }, { label: '上前把两个人分开' }),
      ch('share', { res: { fuel: -1 }, stats: { sanity: -2 }, tone: 'good' }, { label: '把自家的油分他们半桶，劝开' }),
      ch('scoop', { res: { fuel: 0.5 }, stats: { sanity: -8 }, tone: 'bad' }, { label: '等他们打完，把洒在雪里的油收走' }),
    ],
  }),

  // ================= threat 5 荒芜期：成户死亡 / 乱葬岗 / 食人 =================
  beat({
    id: 'ws_family_asleep',
    kind: 'story',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 6,
    minThreat: 5,
    maxThreat: 6,
    require: URBAN_OR_HIGH,

    choices: [
      ch('close', { stats: { sanity: -6 }, tone: 'neutral' }, { label: '把他们盖好，轻轻带上门' }),
      ch('take', { res: { materials: 1, meds: 1 }, stats: { sanity: -8 }, tone: 'bad' }, { label: '翻走还能用的东西' }),
      ch('water', { res: { water: -2 }, stats: { sanity: -4 }, tone: 'neutral' }, { label: '在桌上放下一瓶水' }),
    ],
  }),
  beat({
    id: 'ws_mass_grave',
    kind: 'story',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 6,
    minThreat: 5,
    maxThreat: 6,
    require: URBAN_OR_HIGH,

    choices: [
      ch('count', { stats: { sanity: -8 }, tone: 'neutral' }, { label: '把插着木牌的土堆数一遍' }),
      ch('shovel', { stats: { sanity: -2, stamina: -2 }, tone: 'good' }, { label: '给最后那个没填平的坑添一锹土' }),
      skip({ stats: { sanity: -6 }, tone: 'bad' }),
    ],
  }),
  beat({
    id: 'ws_pot_meat',
    kind: 'story',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 5,
    minThreat: 5,
    maxThreat: 6,

    choices: [
      ch('decline', { stats: { sanity: -8 }, tone: 'neutral' }, { label: '说自己刚吃过，退出去' }),
      ch('flip', { world: { exposure: 14 }, stats: { sanity: -8, stamina: -4 }, tone: 'good' }, { label: '掀翻那口锅' }),
      ch('eat', { res: { foodStaple: 1 }, stats: { sanity: -8 }, tone: 'bad' }, { label: '坐下，把那碗肉吃完' }),
    ],
  }),
  beat({
    id: 'ws_meat_warning',
    kind: 'story',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 5,
    minThreat: 5,
    maxThreat: 6,
    require: URBAN_OR_HIGH,

    choices: [
      ch('copy', { world: { exposure: 6 }, stats: { sanity: -2 }, tone: 'good' }, { label: '抄一份，贴到每一层的电梯口' }),
      ch('self', { stats: { sanity: -4 }, tone: 'neutral' }, { label: '自己记住，不去别家多嘴' }),
      ch('tear', { stats: { sanity: -6 }, tone: 'bad' }, { label: '把纸条撕了，不想知道' }),
    ],
  }),
  beat({
    id: 'ws_beggar_children',
    kind: 'moral',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 5,
    minThreat: 5,
    maxThreat: 6,

    choices: [
      ch('take_in', { res: { foodStaple: -2 }, stats: { sanity: 4 }, tone: 'good' }, { label: '让他们进屋，把炉边腾出来' }),
      ch('daily', { res: { foodStaple: -1 }, stats: { sanity: -2 }, tone: 'neutral' }, { label: '定下规矩，每天给一顿' }),
      ch('drive', { stats: { sanity: -8 }, tone: 'bad' }, { label: '把楼梯间的门锁上' }),
    ],
  }),
  beat({
    id: 'ws_dead_radio_man',
    kind: 'story',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 5,
    minThreat: 5,
    maxThreat: 6,

    choices: [
      ch('salvage', { res: { parts: 1 }, stats: { sanity: -4 }, tone: 'neutral' }, { label: '把收音机拆走，零件能用的很多' }),
      ch('tidy', { stats: { sanity: 2, stamina: -4 }, tone: 'good' }, { label: '把他扶正坐好，本子放回他手里' }),
      skip({ stats: { sanity: -4 }, tone: 'neutral' }),
    ],
  }),

  // ================= threat 6 死寂期：最后的黑暗 =================
  beat({
    id: 'sl_school_cots',
    kind: 'story',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 5,
    minThreat: 6,
    maxThreat: 6,
    require: URBAN_OR_HIGH,

    choices: [
      ch('roster', { stats: { sanity: -8 }, tone: 'neutral' }, { label: '把门口的名册翻完' }),
      ch('blanket', { res: { materials: 1 }, stats: { sanity: -6 }, tone: 'bad' }, { label: '拿走两条没人认领的毯子' }),
      skip({ stats: { sanity: -4 }, tone: 'neutral' }),
    ],
  }),
  beat({
    id: 'sl_relic_stall',
    kind: 'story',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 5,
    minThreat: 6,
    maxThreat: 6,
    require: URBAN_OR_HIGH,

    choices: [
      ch('take', { res: { meds: 1 }, stats: { sanity: -6 }, tone: 'neutral' }, { label: '拿走那板没人要的药' }),
      ch('leave', { res: { foodStaple: -1 }, stats: { sanity: 2 }, tone: 'good' }, { label: '放下自己的一盒罐头' }),
      ch('bypass', { stats: { sanity: -4 }, tone: 'neutral' }, { label: '绕开' }),
    ],
  }),
  beat({
    id: 'sl_three_portions',
    kind: 'dream',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 6,
    minThreat: 6,
    maxThreat: 6,

    choices: [
      ch('eat', { stats: { sanity: -6 }, tone: 'bad' }, { label: '把多出来的两份也吃掉' }),
      ch('keep', { stats: { sanity: -2 }, tone: 'neutral' }, { label: '照旧分成三份，一份一份吃' }),
      ch('door', { res: { foodStaple: -1 }, stats: { sanity: -2 }, tone: 'neutral' }, { label: '把第三份放到门口去' }),
    ],
  }),
  beat({
    id: 'sl_single_shot',
    kind: 'dream',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 5,
    minThreat: 6,
    maxThreat: 6,

    choices: [
      ch('listen', { stats: { sanity: -2 }, tone: 'neutral' }, { label: '到窗边听了一夜' }),
      ch('note', { stats: { sanity: -2 }, tone: 'neutral' }, { label: '把日子记在本子上' }),
      skip({ stats: { sanity: -4 }, tone: 'bad' }),
    ],
  }),
  beat({
    id: 'sl_floor_knock',
    kind: 'story',
    intensity: 3,
    phase: ['survival'],
    once: true,
    weight: 5,
    minThreat: 6,
    maxThreat: 6,

    choices: [
      ch('all', { stats: { sanity: -8, stamina: -4 }, tone: 'neutral' }, { label: '把整层再敲一遍' }),
      ch('water', { res: { water: -2 }, stats: { sanity: -2 }, tone: 'good' }, { label: '在那扇有回应的门口放瓶水' }),
      ch('half', { stats: { sanity: -6 }, tone: 'bad' }, { label: '敲到一半停下' }),
    ],
  }),
  beat({
    id: 'sl_corpse_count',
    kind: 'dream',
    intensity: 2,
    phase: ['survival'],
    once: true,
    weight: 5,
    minThreat: 6,
    maxThreat: 6,

    choices: [
      ch('stop', { stats: { sanity: -4 }, tone: 'neutral' }, { label: '告诉自己别再数了' }),
      ch('keep', { stats: { sanity: -2 }, tone: 'neutral' }, { label: '把今天的数字记下来' }),
      ch('stay_in', { stats: { sanity: -4, stamina: -2 }, tone: 'bad' }, { label: '今天不出门' }),
    ],
  }),
];
