import type { ConditionId } from '../types';

export interface ConditionDef {
  id: ConditionId;
  name: string;
  desc: string;
  /** 每日结算的固定损耗 */
  daily: { hp?: number; stamina?: number; sanity?: number };
  /** 每日自愈概率 */
  selfHeal?: number;
  /** 用药治疗需要的药品量；缺省表示不能用药治 */
  medsCure?: number;
  /** 用药治疗额外需要的医疗站等级 */
  needsMedbay?: number;
  /** 会恶化成什么 */
  worsen?: { into: ConditionId; chance: number };
  /** 由充足的食水自动解除 */
  autoCure?: 'water' | 'food';
}

export const CONDITIONS: ConditionDef[] = [
  {
    id: 'dehydrated',
    name: '脱水',
    desc: '嘴唇裂了，尿液是深黄色的。思考变得像隔着一层棉花。',
    daily: { hp: -6, stamina: -14, sanity: -2 },
    autoCure: 'water',
  },
  {
    id: 'starving',
    name: '饥饿',
    desc: '胃已经不疼了，那更糟——身体开始烧自己。',
    daily: { hp: -7, stamina: -16, sanity: -3 },
    autoCure: 'food',
    worsen: { into: 'malnourished', chance: 0.4 },
  },
  {
    id: 'malnourished',
    name: '营养不良',
    desc: '牙龈在出血，伤口不愈合。你还站得住，但身体已经在慢慢关掉一些功能。',
    daily: { hp: -1, stamina: -7, sanity: -1 },
    selfHeal: 0.1,
    medsCure: 2,
    autoCure: 'food',
  },
  {
    id: 'dysentery',
    name: '痢疾',
    desc: '你喝了不该喝的水。现在身体正在把好不容易存下的水全部排出去。',
    daily: { hp: -5, stamina: -12, sanity: -2 },
    medsCure: 2,
    selfHeal: 0.08,
    worsen: { into: 'dehydrated', chance: 0.35 },
  },
  {
    id: 'flu',
    name: '流感',
    desc: '发烧，骨头缝里疼。在有暖气和医院的时代这只是一周的假。',
    daily: { hp: -3, stamina: -13, sanity: -2 },
    medsCure: 2,
    selfHeal: 0.16,
  },
  {
    id: 'woundInfection',
    name: '伤口感染',
    desc: '边缘红肿发烫，有一道红线正沿着手臂往上走。你知道那条线意味着什么。',
    daily: { hp: -6, stamina: -8 },
    medsCure: 3,
    needsMedbay: 1,
    selfHeal: 0.04,
  },
  {
    id: 'fracture',
    name: '骨折',
    desc: '固定得再好，它也需要六周。而你没有六周。',
    daily: { hp: -1, stamina: -22, sanity: -2 },
    needsMedbay: 1,
    medsCure: 3,
  },
  {
    id: 'hypothermia',
    name: '失温',
    desc: '你已经不觉得冷了，手指开始不听话。这是最危险的阶段。',
    daily: { hp: -9, stamina: -16, sanity: -3 },
  },
  {
    id: 'radiationSickness',
    name: '辐射病',
    desc: '恶心、呕吐、然后是一段虚假的好转期。之后的事，看你吃到的剂量。',
    daily: { hp: -7, stamina: -12, sanity: -4 },
    medsCure: 4,
    needsMedbay: 1,
    selfHeal: 0.05,
  },
  {
    id: 'coPoisoning',
    name: '一氧化碳中毒',
    desc: '头疼、恶心、判断力下降。它没有味道，所以你昨晚睡得很沉。',
    daily: { hp: -11, stamina: -18, sanity: -5 },
    selfHeal: 0.5,
  },
  {
    id: 'moldLung',
    name: '霉菌性肺病',
    desc: '咳出来的东西带着颜色。潮湿的地方总要收这笔租金。',
    daily: { hp: -3, stamina: -9, sanity: -1 },
    medsCure: 3,
    selfHeal: 0.06,
  },
  {
    id: 'despair',
    name: '绝望',
    desc: '你昨天没有理由起床，今天也没找到。所有事情都显得没有意义。',
    daily: { hp: -1, stamina: -10, sanity: -5 },
    selfHeal: 0.12,
  },
];

export const CONDITION_BY_ID: Record<ConditionId, ConditionDef> = Object.fromEntries(
  CONDITIONS.map((c) => [c.id, c]),
) as Record<ConditionId, ConditionDef>;
