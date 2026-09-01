/**
 * 七日之前 — 全部数据类型的唯一真相源。
 * 引擎只解释这里的声明式结构，内容层不写逻辑。
 */

// ============================================================
// 基础标识
// ============================================================

export type ResourceId =
  | 'water' // 饮用水 (L)
  | 'foodStaple' // 耐储食物：罐头/米面/速食 (份)
  | 'foodFresh' // 生鲜食物：会腐败 (份)
  | 'meds' // 药品与医疗物资 (单位)
  | 'fuel' // 汽油/柴油 (L)
  | 'materials' // 建材：木板/钢材/沙袋/水泥 (单位)
  | 'parts' // 五金零件：管件/电线/轴承/滤芯 (单位)
  | 'ammo' // 弹药 (发)
  | 'cash'; // 现金 (元)

export type StatId =
  | 'hp' // 生命
  | 'stamina' // 体力，决定行动点
  | 'sanity' // 理智
  | 'humanity' // 人性：内在，只有你自己知道
  | 'reputation'; // 名声：外在，别人怎么看你

export type SkillId =
  | 'medicine' // 医疗
  | 'mechanics' // 机械与电工
  | 'negotiation' // 谈判
  | 'fitness' // 体能
  | 'stealth'; // 隐蔽

export type ConditionId =
  | 'dehydrated' // 脱水
  | 'starving' // 饥饿
  | 'malnourished' // 营养不良
  | 'dysentery' // 痢疾
  | 'giardia' // 肠寄生虫
  | 'jaundice' // 黄疸
  | 'flu' // 流感
  | 'pneumonia' // 肺炎
  | 'woundInfection' // 伤口感染
  | 'sepsis' // 败血症
  | 'fracture' // 骨折
  | 'hypothermia' // 失温
  | 'radiationSickness' // 辐射病
  | 'coPoisoning' // 一氧化碳中毒
  | 'moldLung' // 霉菌性肺病
  | 'kidneyStrain' // 肾伤
  | 'despair'; // 绝望

export type ModuleId =
  | 'fortify' // 加固
  | 'conceal' // 隐蔽伪装
  | 'cistern' // 储水
  | 'filter' // 净水
  | 'power' // 发电
  | 'insulate' // 保温
  | 'airFilter' // 空气过滤
  | 'medbay' // 医疗站
  | 'garden' // 农圃
  | 'radio'; // 无线电

export type DisasterId =
  | 'nuclear' // 核交火
  | 'pandemic' // 超级流感
  | 'gridDown' // 电网永久崩溃
  | 'volcanicWinter' // 火山冬天 / 尘暴
  | 'flood' // 区域性洪灾
  | 'chemSpill'; // 化工泄漏

export type WeatherId =
  | 'clear'
  | 'overcast'
  | 'rain'
  | 'storm'
  | 'flooding' // 内涝
  | 'snow'
  | 'blizzard'
  | 'ashfall' // 落灰
  | 'blackRain' // 黑雨（放射性沉降）
  | 'fog'
  | 'heatwave';

export type FactionId =
  | 'gov' // 政府军 / 军管
  | 'militia' // 自治民兵
  | 'gang' // 帮派
  | 'looter' // 散兵游勇的掠夺者
  | 'quarantine' // 防疫队
  | 'cult' // 邪教
  | 'refugee' // 难民潮
  | 'rescue' // 救援队
  | 'neighbors' // 邻居社区
  | 'trader'; // 流浪商人

export type SiteId =
  | 'apartment' // 自家公寓 6 楼
  | 'bungalow' // 老城区平房带院
  | 'garage' // 地下停车场 B2
  | 'farmhouse' // 郊区农舍
  | 'bunker' // 废弃人防工程
  | 'watertower'; // 山腰水塔

export type Phase = 'menu' | 'siteSelect' | 'prep' | 'collapse' | 'survival' | 'ended';

export type BuildPath = 'diy' | 'hire' | 'buy' | 'salvage';

export type EventKind =
  | 'threat'
  | 'opportunity'
  | 'social'
  | 'medical'
  | 'weather'
  | 'moral'
  | 'story'
  | 'dream';

export type RationLevel = 'full' | 'normal' | 'half' | 'none';
export type WaterLevel = 'full' | 'normal' | 'limited';
/** @deprecated 供电三档已删除，旧存档可能仍带此字段 */
export type PowerMode = 'full' | 'thrifty' | 'blackout';
export type HeatMode = 'off' | 'fuel' | 'electric';
/** 供电表里的一行：建筑模块或家电 */
export type ApplianceId = 'lights' | 'fridge' | 'heater';
export type PowerLoadId = ModuleId | ApplianceId;
export type Difficulty = 'story' | 'normal' | 'harsh';

/**
 * 玩家行为钩子：故事链可监听其中任意一种。
 * 每一次有意义的操作都会 emit，pending.waitFor 命中则插入后续事件。
 */
export type ActionHook =
  | 'endDay'
  | 'collapse'
  | 'threatUp'
  | 'scavenge'
  | 'scavengeDay'
  | 'scavengeNight'
  | 'takeHaul'
  | 'visitShop'
  | 'buy'
  | 'rest'
  | 'build'
  | 'work'
  | 'cancelProject'
  | 'salvage'
  | 'maintain'
  | 'treat'
  | 'verifyIntel'
  | 'setRation'
  | 'setWaterUse'
  | 'setPowerMode'
  | 'setPowerPriority'
  | 'setHeatMode'
  | 'raid'
  | 'raidRepelled'
  | 'raidFailed'
  | 'choice'
  | 'foodLow'
  | 'waterLow'
  | 'hpLow'
  | 'sanityLow'
  | 'staminaLow'
  | 'humanityLow'
  | 'repLow'
  | 'lightsOff'
  | 'filterExpired'
  | 'exposureUp';

// ============================================================
// 标签系统
// ============================================================

/**
 * 事实表：由 RunState 实时推导，事件查询只针对它。
 * flags 是布尔标签（`site:underground`），nums 是可比较的数值事实（`mod:fortify`）。
 */
export interface Facts {
  flags: Set<string>;
  nums: Record<string, number>;
}

/**
 * 标签查询。项可以是布尔标签，也可以是比较式：`mod:power>=1`、`world:temperature<0`。
 * all 全部命中、any 至少一个命中、none 全部不命中。
 */
export interface TagQuery {
  all?: string[];
  any?: string[];
  none?: string[];
}

// ============================================================
// 需求与效果
// ============================================================

/** 选项/建造的前置条件。不满足则置灰，并把 reason 显示给玩家。 */
export interface Requirement {
  res?: Partial<Record<ResourceId, number>>;
  stats?: Partial<Record<StatId, number>>;
  skills?: Partial<Record<SkillId, number>>;
  modules?: Partial<Record<ModuleId, number>>;
  tags?: TagQuery;
  ap?: number;
  reason?: string;
}

/** 往未来某天种下一个事件——因果链的骨架。 */
export interface ScheduledSeed {
  familyId: string;
  /** 延期天数；可与 waitFor 并存，谁先触发谁算 */
  inDays?: number;
  /** 监听的玩家行为；命中时插入该家族 */
  waitFor?: ActionHook | ActionHook[];
  /** 钩子触发时世界还需满足 */
  require?: TagQuery;
  /** 触发时附加的叙事标签 */
  tags?: string[];
  /** 到期时若这些条件不满足则取消 */
  unless?: TagQuery;
}

export interface Effect {
  res?: Partial<Record<ResourceId, number>>;
  /**
   * 行动点增减：负为消耗，正为返还。
   * 与 `Requirement.ap` 配套——门槛在那里声明，成本在这里兑现，跟 res 的约定一致。
   */
  ap?: number;
  stats?: Partial<Record<StatId, number>>;
  addCond?: ConditionId[];
  removeCond?: ConditionId[];
  /** 直接改动模块等级（正为修好/升级，负为损毁） */
  shelter?: Partial<Record<ModuleId, number>>;
  /** 易耗品增量：滤芯寿命、机油、蓄电 */
  wear?: Partial<{ filterLife: number; generatorOil: number; batteryCharge: number }>;
  skills?: Partial<Record<SkillId, number>>;
  /** 世界状态增量 */
  world?: Partial<{
    lawOrder: number;
    scarcity: number;
    neighborhood: number;
    exposure: number;
    airPollution: number;
    radiation: number;
    contagion: number;
    temperature: number;
  }>;
  /** 势力活跃度增量 */
  faction?: Partial<Record<FactionId, number>>;
  /** 势力对你的态度增量 */
  stance?: Partial<Record<FactionId, number>>;
  survivor?: {
    /** 按模板 id 招募，'random' 表示随机生成 */
    recruit?: string;
    /** 随机失去 n 名同伴 */
    lose?: number;
    morale?: number;
    trust?: number;
  };
  /** 打上/清除叙事标签 */
  setFlags?: string[];
  clearFlags?: string[];
  /** 改地点存量 / 封路 */
  locations?: Array<{ id: string; stock?: number; blocked?: string | null }>;
  /** 种下延迟事件 */
  schedule?: ScheduledSeed[];
  /** 局外永久解锁 */
  unlock?: string[];
  /** 记忆日记里的一行 */
  log: string;
  /** 日记条目的语气，决定 UI 颜色 */
  tone?: 'good' | 'bad' | 'neutral' | 'grim';
}

// ============================================================
// 事件
// ============================================================

export interface SkillCheck {
  skill: SkillId;
  /** 难度：技能值 + d20 需要达到的目标 */
  dc: number;
  ok: Effect;
  bad: Effect;
}

/**
 * 一个事件选项。
 *
 * 这里曾经有个 `endsDay?: boolean`（选完立刻结束当天），但引擎从未实现它，
 * 内容层也一次都没用过——它只是让「声明了但没接线」这条坑又多了一个。
 * 真要做「逃走 / 昏倒 / 外出过夜」这类选项，加回来时必须在 resolveChoice 里实现，
 * 否则写了照样没反应。
 */
export interface Choice {
  id: string;
  label: string;
  /** 补充说明，例如"消耗 2 份罐头" */
  note?: string;
  requires?: Requirement;
  check?: SkillCheck;
  effect?: Effect;
}

export interface EventVariant {
  id: string;
  require?: TagQuery;
  forbid?: TagQuery;
  title: string;
  /** 支持 {{}} 占位符，由引擎注入运行时数值 */
  body: string;
  choices: Choice[];
}

/**
 * 事件家族：同一母题，按世界标签换外衣。
 * 「有人来抢你」写一次，洪水/核战/暴风雪/地下站点各有合理变体。
 */
export interface EventFamily {
  id: string;
  kind: EventKind;
  /** 强度 1-5，供节奏控制使用 */
  intensity: number;
  phase: Array<'prep' | 'survival'>;
  baseWeight: number;
  require?: TagQuery;
  forbid?: TagQuery;
  /** 触发后的冷却天数 */
  cooldown?: number;
  /** 整局只触发一次 */
  once?: boolean;
  /** 仅在这些末世等级区间可用 */
  minThreat?: number;
  maxThreat?: number;
  variants: EventVariant[];
}

// ============================================================
// 站点与避难所
// ============================================================

export interface Site {
  id: SiteId;
  name: string;
  codename: string;
  desc: string;
  /** 本切片未开放：选址界面显示「开发中」，引擎拒绝迁入 */
  wip?: boolean;
  /** 需要的局外解锁 id，缺省为初始可用 */
  unlock?: string;
  cost: { cash?: number; ap?: number; requires?: Requirement };
  baseModules: Partial<Record<ModuleId, number>>;
  caps: Partial<Record<ModuleId, number>>;
  tags: string[];
  /** 搜刮产出倍率 */
  lootMult: number;
  /** 每次外出的燃料消耗 */
  travelFuel: number;
  /** 每次外出额外体力消耗 */
  travelStamina: number;
  /** 被发现的基础暴露度 */
  exposureBase: number;
  companionCap: number;
  /** 储水容量倍率（承重限制） */
  waterCapMult: number;
  pros: string[];
  cons: string[];
}

export interface ModuleLevelSpec {
  /** DIY 所需建材 */
  materials: number;
  parts: number;
  /** 总工时 */
  labor: number;
  /** 雇工现金基价（准备期会按通胀放大） */
  hireCash: number;
  /** 买成品现金基价 */
  buyCash: number;
  /** 成品到货天数 */
  buyDays: number;
  /** 技能门槛，不足则 DIY 有失败率 */
  skill?: { id: SkillId; level: number };
  /** 前置模块等级要求 */
  requiresModules?: Partial<Record<ModuleId, number>>;
  /** 每日耗电 (kWh) */
  power?: number;
  desc: string;
}

export interface ModuleDef {
  id: ModuleId;
  name: string;
  short: string;
  desc: string;
  /** 0 级（未建造）的描述 */
  zero: string;
  levels: [ModuleLevelSpec, ModuleLevelSpec, ModuleLevelSpec];
  /** 施工期间打上的负面标签 */
  buildPenaltyTags: string[];
  /** 施工期间的说明，提示玩家"半成品更脆弱" */
  buildPenaltyDesc: string;
}

export interface Project {
  moduleId: ModuleId;
  toLevel: number;
  path: BuildPath;
  laborTotal: number;
  laborDone: number;
  /** buy 路径的到货日 */
  etaDay?: number;
  /** buy 路径是否已付款 */
  paid?: boolean;
  startedDay: number;
}

// ============================================================
// 搜刮地点
// ============================================================

export interface LootEntry {
  res: ResourceId;
  min: number;
  max: number;
  /** 出现概率 0-1 */
  chance: number;
  /** kg/单位，用于负重 */
  weight: number;
}

export interface Location {
  id: string;
  name: string;
  desc: string;
  /** 灾难后地图文案；缺省则沿用 desc */
  descSurvival?: string;
  /** 距离档：影响体力与燃料 */
  distance: 1 | 2 | 3;
  /** 需要车辆 */
  needsVehicle?: boolean;
  /** 准备期可采购（花钱），生存期只能搜刮 */
  prepShop?: boolean;
  /** 基础危险度 0-100 */
  danger: number;
  /** 剩余存量 0-100，搜刮会耗尽 */
  stock: number;
  loot: LootEntry[];
  /** 采购时的商品单价（准备期） */
  prices?: Partial<Record<ResourceId, number>>;
  tags?: string[];
}

export interface LocationState {
  id: string;
  stock: number;
  searchedDay?: number;
  /** 路况：封路/桥断/检查站 */
  blocked?: string;
}

// ============================================================
// 同伴
// ============================================================

export interface SurvivorTemplate {
  id: string;
  name: string;
  age: number;
  bio: string;
  skills: Partial<Record<SkillId, number>>;
  /** 性格标签，影响事件 */
  traits: string[];
  /** 秘密：满足条件时揭露 */
  secret?: { id: string; revealAtTrust?: number; revealAfterDays?: number; text: string };
  /** 每日食水消耗倍率 */
  upkeep: number;
}

export interface Survivor extends SurvivorTemplate {
  morale: number;
  trust: number;
  joinedDay: number;
  conditions: ConditionId[];
  secretRevealed?: boolean;
}

// ============================================================
// 情报
// ============================================================

export interface IntelItem {
  id: string;
  /** 来源：官方通报/社交媒体/邻里传闻/短波电台 */
  source: 'official' | 'social' | 'rumor' | 'shortwave';
  text: string;
  /** 这条情报指向哪种灾难；'none' 表示纯噪音 */
  points: DisasterId | 'none';
  /** 最早出现日 */
  minDay?: number;
}

export interface IntelReading extends IntelItem {
  day: number;
  /** 是否指向真实灾难。由运行时计算，不由内容作者指定 */
  truthful: boolean;
  /** 玩家是否已通过分析确认真伪 */
  verified?: boolean;
}

// ============================================================
// 世界状态
// ============================================================

export interface WorldState {
  disaster: DisasterId;
  /** 灾难是否已揭晓 */
  revealed: boolean;
  weather: WeatherId;
  forecast: WeatherId[];
  temperature: number;
  season: 'autumn' | 'winter';
  /** 以下三项均为"越高越糟" */
  airPollution: number;
  radiation: number;
  contagion: number;
  waterTable: 'normal' | 'polluted' | 'flooded';
  powerGrid: 'on' | 'rolling' | 'off';
  lawOrder: number;
  scarcity: number;
  neighborhood: number;
  /** 暴露度热度条：累积值，决定"谁来找你" */
  exposure: number;
  factions: Record<FactionId, number>;
  factionStance: Record<FactionId, number>;
  /** 物价指数，准备期通胀 */
  priceIndex: number;
}

// ============================================================
// 单局状态
// ============================================================

export interface LogEntry {
  day: number;
  text: string;
  tone: 'good' | 'bad' | 'neutral' | 'grim';
}

export interface PendingEvent {
  familyId: string;
  /** 日历到期日；仅 waitFor 的链可省略 */
  dueDay?: number;
  waitFor?: ActionHook | ActionHook[];
  require?: TagQuery;
  tags?: string[];
  unless?: TagQuery;
  /** 变体暂不可用时的重试次数，满 5 次断链 */
  retries?: number;
}

export interface RunState {
  seed: number;
  rngCursor: number;
  phase: Phase;
  /** 全局天数，1..7 为准备期，8 为崩溃日，9+ 为生存期 */
  day: number;
  /** 末世等级 1-6，准备期为 0 */
  threat: number;
  ap: number;
  apMax: number;

  classId: string;
  packId: string;
  siteId: SiteId | null;
  difficulty: Difficulty;
  /** 本局生效的能力 id：职业专长 + 已点的局外天赋 */
  abilities: string[];

  res: Record<ResourceId, number>;
  stats: Record<StatId, number>;
  skills: Record<SkillId, number>;
  conditions: ConditionId[];
  /** 各状态已持续天数，用于 afterDays 恶化 */
  conditionAge: Partial<Record<ConditionId, number>>;

  modules: Record<ModuleId, number>;
  projects: Project[];
  /** 滤芯剩余天数、发电机保养度等易耗品 */
  wear: { filterLife: number; generatorOil: number; batteryCharge: number };
  /** 连续状态计数器 */
  streaks: { lowRation: number; noThreatDays: number; goodRation: number };

  ration: RationLevel;
  waterUse: WaterLevel;
  heatMode: HeatMode;
  /** 旧存档兼容，引擎不再读取 */
  powerMode?: PowerMode;
  /** 缺电时的停摆优先级，靠前的先保 */
  powerPriority: PowerLoadId[];
  /** 家电/模块是否想开着；缺省为开 */
  powerEnabled: Partial<Record<PowerLoadId, boolean>>;
  /** 碘片效果截止日（含当天） */
  iodineUntil?: number;
  /** 概率链权重加成 */
  directorBoost: Record<string, number>;
  /** 阈值事件上次触发日 */
  thresholdFired: Record<string, number>;

  survivors: Survivor[];
  locations: LocationState[];
  /** 今日已采购数量，限购按累计而不是单次 */
  boughtToday: Partial<Record<ResourceId, number>>;
  /** 今天已经跑过的地点，重复进入不再消耗行动点 */
  visitedToday: string[];
  hasVehicle: boolean;

  world: WorldState;

  intel: IntelReading[];
  flags: string[];
  /** familyId -> 最后触发日，用于冷却 */
  eventHistory: Record<string, number>;
  /** 最近若干天的事件类别与强度，用于节奏控制 */
  recentBeats: Array<{ day: number; kind: EventKind; intensity: number }>;
  pending: PendingEvent[];
  /** 当天待呈现的事件队列（variantId 已定） */
  queue: Array<{ familyId: string; variantId: string; tags?: string[] }>;

  log: LogEntry[];
  /** 崩溃日的准备度清算，供崩溃日界面展示 */
  collapseReport?: { score: number; hits: string[]; misses: string[]; losses: string[] };
  endingId?: string;
  /** 结算用统计 */
  stats_meta: { daysSurvived: number; scavengeRuns: number; raidsRepelled: number; peopleHelped: number; peopleRefused: number };
}

// ============================================================
// 局外成长
// ============================================================

export interface CharacterClass {
  id: string;
  name: string;
  title: string;
  desc: string;
  unlock?: string;
  skills: Partial<Record<SkillId, number>>;
  res: Partial<Record<ResourceId, number>>;
  modules?: Partial<Record<ModuleId, number>>;
  apMax: number;
  perk: string;
  tags?: string[];
}

export interface PerkDef {
  id: string;
  tree: 'survival' | 'build' | 'social';
  tier: number;
  name: string;
  desc: string;
  cost: number;
  requires?: string[];
  /** 本切片未接线则不在商店出售 */
  wip?: boolean;
}

export interface MetaState {
  relics: number;
  unlocked: string[];
  perks: string[];
  /** 已见过的事件家族/变体/结局/灾难，供 Codex */
  seenFamilies: string[];
  seenVariants: string[];
  seenEndings: string[];
  seenDisasters: DisasterId[];
  runsPlayed: number;
  bestDays: number;
  lastClassId: string;
  difficulty: Difficulty;
}

// ============================================================
// 结局
// ============================================================

export interface EndingDef {
  id: string;
  name: string;
  subtitle: string;
  kind: 'win' | 'lose' | 'neutral';
  /** 判定优先级，数字大的先判 */
  priority: number;
  /** 同伴系统冻结期间隐藏独狼/社区等 */
  wip?: boolean;
  require?: Requirement;
  /** 死亡结局：匹配死因 */
  cause?: string[];
  text: string;
  relics: number;
  unlock?: string[];
}
