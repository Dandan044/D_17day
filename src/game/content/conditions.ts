import type { ConditionId } from '../types';
import { hydrateNamed } from '../copy/hydrate';
import '../copy';

export interface ConditionDef {
  id: ConditionId;
  name: string;
  desc: string;
  /**
   * pathogenic＝非条件治愈疾病：过夜按 治愈率 = 基础(严重度)+医疗站(通电)+药品 判定；
   * conditional＝条件型：吃/喝/回暖/通风等条件满足即缓解，不走治愈判定。
   */
  kind: 'pathogenic' | 'conditional';
  /** 病理类严重度 1..5：决定基础治愈率与药品加成（CURE.BASE / CURE.MEDS） */
  severity?: 1 | 2 | 3 | 4 | 5;
  /** 传染性疾病：治愈后 IMMUNE_DAYS 内再感染＝已免疫必愈，之后复发基础率减半 */
  infectious?: boolean;
  /** 每日结算的固定损耗 */
  daily: { hp?: number; stamina?: number; sanity?: number };
  /** 每日自愈概率（仅条件型使用；病理类走治愈判定） */
  selfHeal?: number;
  /** 用药治疗需要的药品量（每晚）；缺省表示不能用药 */
  medsCure?: number;
  /** 用药治疗额外需要的医疗站等级 */
  needsMedbay?: number;
  /**
   * 会恶化成什么。
   * afterDays：未满天数不掷；满了再按 chance 恶化。
   */
  worsen?: { into: ConditionId; chance: number; afterDays?: number };
  /** 由充足的食水自动解除 */
  autoCure?: 'water' | 'food';
  /** 条件型疾病在 UI 上的解除条件提示 */
  conditionHint?: string;
}

export const CONDITIONS: ConditionDef[] = [
  {
    id: 'thirst',
    name: '口渴',
    kind: 'conditional',
    desc: '喉咙发紧，尿色变深。水还够维持身体运转——只是不够舒服。',
    daily: { stamina: -5, sanity: -1 },
    conditionHint: '把用水档位提到标准或以上即可消除',
  },
  {
    id: 'dehydrationMild',
    name: '轻度脱水',
    kind: 'conditional',
    desc: '嘴唇起皮，站起来有点头晕。身体开始向不重要的器官回收水分。',
    daily: { hp: -3, stamina: -6, sanity: -1 },
    conditionHint: '限量级饮水止住加重，标准级好转一档，充足级好转两档',
  },
  {
    id: 'dehydrationMod',
    name: '中度脱水',
    kind: 'conditional',
    desc: '站起来眼前发黑，尿液是深黄色的。思考变得像隔着一层棉花。',
    daily: { hp: -6, stamina: -6, sanity: -1 },
    conditionHint: '限量级止住加重，标准级好转一档，充足级直接解除',
  },
  {
    id: 'dehydrationSevere',
    name: '重度脱水',
    kind: 'conditional',
    desc: '皮肤捏起来不会回弹，心脏在干涸的血管里空转。今晚之前必须有水，否则过不去这一夜。',
    daily: { hp: -12, stamina: -6, sanity: -1 },
    conditionHint: '标准级水直接解除；若今晚仍喝不到限量级的水，你会死',
  },
  {
    id: 'starving',
    name: '饥饿',
    kind: 'conditional',
    desc: '胃已经不疼了，那更糟——身体开始烧自己。',
    daily: { hp: -7, stamina: -16, sanity: -3 },
    autoCure: 'food',
    conditionHint: '吃到足量口粮即可解除',
    worsen: { into: 'malnourished', chance: 0.4 },
  },
  {
    id: 'malnourished',
    name: '营养不良',
    kind: 'pathogenic',
    severity: 2,
    desc: '牙龈在出血，伤口不愈合。你还站得住，但身体已经在慢慢关掉一些功能。',
    daily: { hp: -1, stamina: -7, sanity: -1 },
    medsCure: 1,
    autoCure: 'food',
    conditionHint: '连续 3 天足量口粮可解除；也可用药',
  },
  {
    id: 'dysentery',
    name: '痢疾',
    kind: 'pathogenic',
    severity: 3,
    infectious: true,
    desc: '你喝了不该喝的水。现在身体正在把好不容易存下的水全部排出去。',
    daily: { hp: -5, stamina: -12, sanity: -2 },
    medsCure: 1,
  },
  {
    id: 'giardia',
    name: '肠寄生虫',
    kind: 'pathogenic',
    severity: 4,
    infectious: true,
    desc: '肚子一阵一阵地绞。滤过的水也不保险，卵已经在里面了。',
    daily: { hp: -4, stamina: -10 },
    medsCure: 2,
    needsMedbay: 1,
    worsen: { into: 'jaundice', chance: 0.12, afterDays: 5 },
  },
  {
    id: 'jaundice',
    name: '黄疸',
    kind: 'pathogenic',
    severity: 4,
    desc: '眼白发黄，皮肤也跟着黄。镜子里的自己像换了一层纸。',
    daily: { hp: -3, stamina: -12, sanity: -2 },
    medsCure: 2,
    needsMedbay: 2,
  },
  {
    id: 'flu',
    name: '流感',
    kind: 'pathogenic',
    severity: 2,
    infectious: true,
    desc: '发烧，骨头缝里疼。在有暖气和医院的时代这只是一周的假。',
    daily: { hp: -3, stamina: -13, sanity: -2 },
    medsCure: 1,
    worsen: { into: 'pneumonia', chance: 0.18, afterDays: 4 },
  },
  {
    id: 'pneumonia',
    name: '肺炎',
    kind: 'pathogenic',
    severity: 4,
    desc: '呼吸浅，咳出来的东西带着颜色。躺着也喘。',
    daily: { hp: -6, stamina: -16 },
    medsCure: 2,
    needsMedbay: 2,
  },
  {
    id: 'wound',
    name: '伤口',
    kind: 'pathogenic',
    severity: 1,
    desc: '手背裂开一道口子。不深，但在脏地方干活，过夜会渗。',
    daily: { hp: -2, stamina: -4 },
    medsCure: 1,
    worsen: { into: 'woundInfection', chance: 0.22, afterDays: 2 },
  },
  {
    id: 'woundInfection',
    name: '伤口感染',
    kind: 'pathogenic',
    severity: 4,
    desc: '边缘红肿发烫，有一道红线正沿着手臂往上走。你知道那条线意味着什么。',
    daily: { hp: -6, stamina: -8 },
    medsCure: 2,
    needsMedbay: 1,
    worsen: { into: 'sepsis', chance: 0.15, afterDays: 3 },
  },
  {
    id: 'sepsis',
    name: '败血症',
    kind: 'pathogenic',
    severity: 5,
    desc: '全身发冷又发热。伤口本身已经不重要了——感染进了血。',
    daily: { hp: -9, stamina: -14, sanity: -3 },
    medsCure: 3,
    needsMedbay: 3,
  },
  {
    id: 'fracture',
    name: '骨折',
    kind: 'pathogenic',
    severity: 4,
    desc: '固定得再好，它也需要六周。而你没有六周。',
    daily: { hp: -1, stamina: -22, sanity: -2 },
    needsMedbay: 1,
    medsCure: 2,
  },
  {
    id: 'hypothermiaMild',
    name: '低温症（轻）',
    kind: 'conditional',
    desc: '手指发僵，说话有点含糊。屋里再暖一点就会好。',
    daily: { stamina: -6, sanity: -1 },
    conditionHint: '屋里回暖到舒适线以上就会缓解，药没用',
  },
  {
    id: 'hypothermiaMod',
    name: '低温症（中）',
    kind: 'conditional',
    desc: '牙齿对不上，穿衣服要试两次。药没用，得把炉子烧起来。',
    daily: { stamina: -12, sanity: -2 },
    conditionHint: '屋里回暖到舒适线以上就会缓解，药没用',
  },
  {
    id: 'hypothermiaSevere',
    name: '低温症（重）',
    kind: 'conditional',
    desc: '你已经不觉得冷了。这是最危险的阶段。明天屋里若还低于生存线，就过不去这一夜。',
    daily: { stamina: -18, sanity: -4 },
    conditionHint: '屋里回暖到舒适线以上就会缓解，药没用',
  },
  {
    id: 'radiationSickness',
    name: '辐射病',
    kind: 'pathogenic',
    severity: 3,
    desc: '恶心、呕吐、然后是一段虚假的好转期。之后的事，看你吃到的剂量。',
    daily: { hp: -7, stamina: -12, sanity: -4 },
    medsCure: 2,
    needsMedbay: 1,
  },
  {
    id: 'coPoisoning',
    name: '一氧化碳中毒',
    kind: 'conditional',
    desc: '头疼、恶心、判断力下降。它没有味道，所以你昨晚睡得很沉。',
    daily: { hp: -5, stamina: -18, sanity: -5 },
    selfHeal: 0.5,
    conditionHint: '开窗通风、别再密封烧火，会自行缓解',
  },
  {
    id: 'moldLung',
    name: '霉菌性肺病',
    kind: 'pathogenic',
    severity: 3,
    desc: '咳出来的东西带着颜色。潮湿的地方总要收这笔租金。',
    daily: { hp: -3, stamina: -9, sanity: -1 },
    medsCure: 2,
  },
  {
    id: 'kidneyStrain',
    name: '肾伤',
    kind: 'pathogenic',
    severity: 4,
    desc: '腰眼两侧隐隐作痛，尿色深得像茶。回用喝了太久。',
    daily: { hp: -2, stamina: -10 },
    medsCure: 2,
    needsMedbay: 2,
  },
  {
    id: 'despair',
    name: '绝望',
    kind: 'conditional',
    desc: '你昨天没有理由起床，今天也没找到。所有事情都显得没有意义。',
    daily: { hp: -1, stamina: -10, sanity: -5 },
    selfHeal: 0.12,
    conditionHint: '理智回升到 45 以上会消退',
  },
];

for (const c of CONDITIONS) {
  Object.assign(c, hydrateNamed('world.condition', c, ['name', 'desc']));
}

export const CONDITION_BY_ID: Record<ConditionId, ConditionDef> = Object.fromEntries(
  CONDITIONS.map((c) => [c.id, c]),
) as Record<ConditionId, ConditionDef>;
