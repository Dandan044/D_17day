import type { SurvivorTemplate } from '../types';

/**
 * 同伴模板。
 * traits 会以 `crew:has:<trait>` 的形式进入标签系统，
 * 所以"队里有个前警察"本身就能成为某些事件的前提。
 */
export const SURVIVORS: SurvivorTemplate[] = [
  {
    id: 'lijie',
    name: '李姐',
    age: 47,
    bio: '三楼的邻居，一个人带孩子。会做饭，会缝东西，也会在你不在的时候把门看得很紧。',
    skills: { medicine: 2, negotiation: 3 },
    traits: ['caretaker', 'neighbor'],
    upkeep: 1,
  },
  {
    id: 'laochen',
    name: '老陈',
    age: 58,
    bio: '对门退休的锅炉工。话少，手很稳，能听出发电机哪个部件在响。',
    skills: { mechanics: 4, fitness: 1 },
    traits: ['handy', 'neighbor'],
    secret: { id: 'chen_gun', revealAtTrust: 60, text: '老陈从床垫下摸出一把猎枪，用油布包着。"我儿子的。他去年走了。"' },
    upkeep: 0.9,
  },
  {
    id: 'xiaoyu',
    name: '小雨',
    age: 19,
    bio: '大二学生，学校封了回不去。跑得快，眼睛好，怕黑。',
    skills: { stealth: 3, fitness: 2 },
    traits: ['young', 'fast'],
    upkeep: 1.1,
  },
  {
    id: 'zhaodaifu',
    name: '赵医生',
    age: 41,
    bio: '社区医院的全科医生，走的时候只带了一个箱子，里面全是药。',
    skills: { medicine: 5 },
    traits: ['medic'],
    secret: { id: 'zhao_exposed', revealAfterDays: 5, text: '赵医生终于说了实话：她在医院最后一班接触过确诊病例，一直在自己数天数。' },
    upkeep: 1,
  },
  {
    id: 'wutou',
    name: '吴头',
    age: 35,
    bio: '装修队的工头，带着一整套电动工具。嗓门大，力气大，脾气也大。',
    skills: { mechanics: 3, fitness: 3 },
    traits: ['handy', 'loud'],
    upkeep: 1.3,
  },
  {
    id: 'linjing',
    name: '林警官',
    age: 33,
    bio: '派出所的，制服还穿着，但已经三天没接到指令了。',
    skills: { fitness: 3, negotiation: 3, stealth: 2 },
    traits: ['police', 'armed'],
    secret: { id: 'lin_orders', revealAtTrust: 70, text: '林警官说出了那条最后的指令：所有人员就地解散，自行保障。她一直没敢告诉别人。' },
    upkeep: 1.2,
  },
  {
    id: 'guming',
    name: '顾明',
    age: 28,
    bio: '外卖骑手，全城的路他都熟。有一辆能跑的电动车和一块拆下来的电池。',
    skills: { fitness: 2, stealth: 2, negotiation: 1 },
    traits: ['courier', 'fast'],
    upkeep: 1.1,
  },
  {
    id: 'stranger',
    name: '不说名字的人',
    age: 40,
    bio: '你在楼道里遇到他的时候，他正在喝雨水。他没说自己从哪来，你也没问。',
    skills: { fitness: 2, stealth: 3 },
    traits: ['unknown'],
    secret: { id: 'stranger_scout', revealAfterDays: 6, text: '你在他的口袋里发现一张手绘的地图，上面标着这条街每一户人家，你家旁边画了一个圈。' },
    upkeep: 1,
  },
];

export const SURVIVOR_BY_ID: Record<string, SurvivorTemplate> = Object.fromEntries(SURVIVORS.map((s) => [s.id, s]));
