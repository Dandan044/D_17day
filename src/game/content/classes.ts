import type { CharacterClass, ResourceId } from '../types';

/**
 * 职业。perk 是一个被引擎识别的能力 id，不是纯文本。
 */
export const CLASSES: CharacterClass[] = [
  {
    id: 'clerk',
    name: '便利店店主',
    title: '你知道哪些货最先卖光',
    desc: '你在这条街开了九年店。你认识每一个供货司机，也第一个发现瓶装水的进货价涨了三倍。',
    skills: { negotiation: 2, fitness: 1 },
    res: { foodStaple: 8, water: 10, cash: 2000 },
    apMax: 4,
    perk: 'clerk_network',
    tags: ['flag:classClerk'],
  },
  {
    id: 'engineer',
    name: '结构工程师',
    title: '你看得见墙里面的东西',
    desc: '你算过太多次承重和荷载。别人看到一间屋子，你看到一张受力图——以及它会从哪里先塌。',
    unlock: 'class_engineer',
    skills: { mechanics: 4, fitness: 1 },
    res: { materials: 8, parts: 8 },
    apMax: 4,
    perk: 'engineer_efficiency',
    tags: ['flag:classEngineer'],
  },
  {
    id: 'nurse',
    name: '急诊科护士',
    title: '你见过人是怎么死的',
    desc: '连续三年夜班。你能在灯光昏暗的走廊里摸到血管，也早就学会了不去记住每一张脸。',
    unlock: 'class_nurse',
    skills: { medicine: 4, negotiation: 1 },
    res: { meds: 6 },
    modules: { medbay: 1 },
    apMax: 4,
    perk: 'nurse_care',
    tags: ['flag:classNurse'],
  },
  {
    id: 'veteran',
    name: '退役军官',
    title: '你受过训练，为的正是这一天',
    desc: '十二年军旅，两次维和。你早就知道秩序是一层很薄的东西，也知道它破掉之后人会变成什么。',
    unlock: 'class_veteran',
    skills: { fitness: 3, stealth: 2 },
    res: { ammo: 14, foodStaple: 4 },
    apMax: 4,
    perk: 'veteran_defense',
    tags: ['flag:classVeteran'],
  },
  {
    id: 'hoarder',
    name: '囤积者',
    title: '他们笑了你十年',
    desc: '你的储物间从地板堆到天花板。家人说你有病，同事说你偏执。你只是比他们更早地不信任这个世界。',
    unlock: 'class_hoarder',
    skills: {},
    res: { water: 40, foodStaple: 20, foodFresh: 6, meds: 4, fuel: 15, materials: 10, parts: 8 },
    apMax: 3,
    perk: 'hoarder_stash',
    tags: ['flag:classHoarder'],
  },
  {
    id: 'hacker',
    name: '数据分析师',
    title: '你能分辨哪条消息是真的',
    desc: '你的工作是从噪音里找信号。这次要找的东西不在数据库里，在几万条互相矛盾的传闻里。',
    unlock: 'class_hacker',
    skills: { mechanics: 2, negotiation: 2 },
    res: { cash: 7000, parts: 2 },
    modules: { radio: 1 },
    apMax: 4,
    perk: 'hacker_analysis',
    tags: ['flag:classHacker'],
  },
  {
    id: 'trucker',
    name: '长途货运司机',
    title: '你有一辆车，和一箱油',
    desc: '跑了十七年长途。你知道哪条路上没有摄像头，哪个服务区的柴油最便宜，以及一个人在路上要怎么熬过一夜。',
    unlock: 'class_trucker',
    skills: { fitness: 3, mechanics: 1 },
    res: { fuel: 30, foodStaple: 5 },
    apMax: 4,
    perk: 'trucker_vehicle',
    tags: ['flag:classTrucker'],
  },
  {
    id: 'chemist',
    name: '中学化学老师',
    title: '你知道什么能中和什么',
    desc: '你在实验室准备室里待过太多午休。碘、活性炭、次氯酸钠——这些名字对别人是名词，对你是操作步骤。',
    unlock: 'class_chemist',
    skills: { medicine: 2, mechanics: 3 },
    res: { meds: 4, parts: 5, materials: 3 },
    apMax: 4,
    perk: 'chemist_consumables',
    tags: ['flag:classChemist'],
  },
];

export const CLASS_BY_ID: Record<string, CharacterClass> = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

/** 职业能力的说明文本，UI 直接显示 */
export const PERK_TEXT: Record<string, string> = {
  clerk_network: '熟客网络：采购不受限购影响，且所有采购价 -10%。',
  engineer_efficiency: '结构直觉：DIY 工时 -25%，且技能不足时不会失败。',
  nurse_care: '临床经验：治疗效果 +50%，每日患病概率 -25%，自带 1 级医疗站。',
  veteran_defense: '战术素养：袭击防御 +15%，防守时弹药消耗减半。',
  hoarder_stash: '十年囤积：起始物资极其丰厚，但行动点 -1、初始理智 -15。',
  hacker_analysis: '信号识别：情报辨伪率 +20%，自带 1 级无线电。',
  trucker_vehicle: '自带车辆：可去远距离地点，负重上限 +40 kg。',
  chemist_consumables: '化学储备：滤芯与药品消耗速度 -40%，生水患病率减半。',
};

// ============================================================
// 起手物资包
// ============================================================

export interface SupplyPack {
  id: string;
  name: string;
  desc: string;
  unlock?: string;
  res: Partial<Record<ResourceId, number>>;
}

export const SUPPLY_PACKS: SupplyPack[] = [
  {
    id: 'none',
    name: '什么都没准备',
    desc: '你和大多数人一样，把这条新闻当成了又一次虚惊。',
    res: {},
  },
  {
    id: 'basic',
    name: '一箱水和一箱面',
    desc: '上周超市促销，你顺手多买了一点。现在这点"顺手"值一条命。',
    unlock: 'pack_basic',
    res: { water: 24, foodStaple: 10 },
  },
  {
    id: 'medical',
    name: '家庭医药储备',
    desc: '你妈总说家里得备着药。你嫌她啰嗦，但一直没扔。',
    unlock: 'pack_medical',
    res: { meds: 6, water: 8 },
  },
  {
    id: 'tools',
    name: '装修剩下的材料',
    desc: '去年装修堆在阳台的木板、螺丝和半桶防水涂料。你一直懒得清。',
    unlock: 'pack_tools',
    res: { materials: 14, parts: 10 },
  },
  {
    id: 'cash',
    name: '取出来的现金',
    desc: '你在新闻出来的第一天就把定期取了。所有人都说你反应过度。',
    unlock: 'pack_cash',
    res: { cash: 12000 },
  },
];

export const PACK_BY_ID: Record<string, SupplyPack> = Object.fromEntries(SUPPLY_PACKS.map((p) => [p.id, p]));
