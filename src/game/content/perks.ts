import type { PerkDef } from '../types';
import { TREE_NAMES } from '../copy/names';
import { hydrateNamed } from '../copy/hydrate';
import { pickCopy } from '../copy/t';
import '../copy';

export { TREE_NAMES };

/**
 * 局外天赋树。id 会直接进入 RunState.abilities，被引擎各处读取。
 */
export const PERKS: PerkDef[] = [
  // ============ 生存系 ============
  { id: 'perk_camel', tree: 'survival', tier: 1, name: '耐渴', desc: '每日饮水需求 -15%。', cost: 30, wip: true },
  { id: 'perk_ironstomach', tree: 'survival', tier: 1, name: '铁胃', desc: '喝未净化水的患病概率减半。', cost: 30, wip: true },
  { id: 'perk_scavenger', tree: 'survival', tier: 2, name: '拾荒直觉', desc: '搜刮产出 +15%，且能看到地点的剩余存量。', cost: 60 },
  { id: 'perk_thickblood', tree: 'survival', tier: 2, name: '抗寒体质', desc: '舒适线和生存线各降低 4°C。', cost: 60, requires: ['perk_ironstomach'], wip: true },
  { id: 'perk_nightowl', tree: 'survival', tier: 3, name: '夜行', desc: '夜间搜刮的危险度 -25%，产出加成提高到 1.6 倍。', cost: 110, requires: ['perk_scavenger'] },
  { id: 'perk_ghost', tree: 'survival', tier: 3, name: '不存在的人', desc: '隐蔽的每级效果提高 50%，暴露度自然衰减 +3。', cost: 110, requires: ['perk_thickblood'], wip: true },

  // ============ 建造系 ============
  { id: 'perk_builder_hands', tree: 'build', tier: 1, name: '熟练的手', desc: 'DIY 工时 -15%。', cost: 30 },
  { id: 'perk_maintainer', tree: 'build', tier: 1, name: '会保养', desc: '滤芯与发电机机油寿命 +50%。', cost: 30 },
  { id: 'perk_logistics', tree: 'build', tier: 2, name: '物流关系', desc: '买成品的到货时间 -1 天，被拦截概率显著下降。', cost: 60, requires: ['perk_builder_hands'] },
  { id: 'perk_electrician', tree: 'build', tier: 2, name: '电工', desc: '发电产量 +20%，模块耗电 -10%。', cost: 60, requires: ['perk_maintainer'], wip: true },
  { id: 'perk_salvager', tree: 'build', tier: 3, name: '拆解专家', desc: '拆解回收产出 +40%，且暴露度增量减半。', cost: 110, requires: ['perk_logistics'], wip: true },
  { id: 'perk_greenthumb', tree: 'build', tier: 3, name: '会种东西', desc: '农圃产量 +30%，恶劣环境下的减产减半。', cost: 110, requires: ['perk_electrician'], wip: true },

  // ============ 人际系 ============
  { id: 'perk_haggler', tree: 'social', tier: 1, name: '会砍价', desc: '所有采购价 -12%。', cost: 30, wip: true },
  { id: 'perk_analyst', tree: 'social', tier: 1, name: '情报分析', desc: '真情报比例 +12%，且每天可标记一条情报进行核实。', cost: 30 },
  { id: 'perk_contacts', tree: 'social', tier: 2, name: '人脉', desc: '雇工价格 -20%，成品价格 -12%。', cost: 60 },
  { id: 'perk_reputation', tree: 'social', tier: 2, name: '街坊眼里的好人', desc: '初始名声 +20，初始社区关系 +20。', cost: 60, requires: ['perk_analyst'] },
  { id: 'perk_leader', tree: 'social', tier: 3, name: '有人愿意跟着你', desc: '同伴士气衰减减半，收留上限 +1。', cost: 110, requires: ['perk_contacts'], wip: true },
  { id: 'perk_wellprepared', tree: 'social', tier: 3, name: '早有准备', desc: '起始行动点 +1。', cost: 110, requires: ['perk_reputation'] },
];

for (const p of PERKS) {
  Object.assign(p, hydrateNamed('world.perk', p, ['name', 'desc']));
}

export const PERK_BY_ID: Record<string, PerkDef> = Object.fromEntries(PERKS.map((p) => [p.id, p]));

/** 局外解锁项的展示名（站点、职业、图纸、物资包） */
export const UNLOCK_NAMES: Record<string, string> = {
  site_bunker: '站点：废弃人防工程',
  site_watertower: '站点：山腰水塔',
  class_engineer: '职业：结构工程师',
  class_nurse: '职业：急诊科护士',
  class_veteran: '职业：退役军官',
  class_hoarder: '职业：囤积者',
  class_hacker: '职业：数据分析师',
  class_trucker: '职业：长途货运司机',
  class_chemist: '职业：中学化学老师',
  pack_basic: '物资包：一箱水和一箱面',
  pack_medical: '物资包：家庭医药储备',
  pack_tools: '物资包：装修剩下的材料',
  pack_cash: '物资包：取出来的现金',
  blueprint_hydroponics: '图纸：立体水培',
  blueprint_ventilation: '图纸：热回收换气',
  perk_leader: '天赋：有人愿意跟着你',
  perk_ghost: '天赋：不存在的人',
};

for (const id of Object.keys(UNLOCK_NAMES)) {
  UNLOCK_NAMES[id] = pickCopy(`world.unlock.${id}`, UNLOCK_NAMES[id]);
}

export const UNLOCK_COST: Record<string, number> = {
  site_bunker: 120,
  site_watertower: 200,
  class_engineer: 90,
  class_nurse: 90,
  class_veteran: 120,
  class_hoarder: 100,
  class_hacker: 110,
  class_trucker: 140,
  class_chemist: 130,
  pack_basic: 40,
  pack_medical: 60,
  pack_tools: 60,
  pack_cash: 80,
  blueprint_hydroponics: 150,
  blueprint_ventilation: 90,
};
