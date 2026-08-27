/**
 * 全部数值旋钮集中在此。调平衡只改这个文件。
 */

import type { EventKind, ModuleId, ResourceId, StatId } from './types';

// ============================================================
// 时间轴
// ============================================================

export const TIME = {
  /** 准备期天数：Day 1..7 */
  PREP_DAYS: 7,
  /** 崩溃日 = 灾难降临 = 生存期第一天 */
  COLLAPSE_DAY: 8,
  /** 最终日，活到这天触发结局判定 */
  FINAL_DAY: 49,
  WEEK: 7,
  MAX_THREAT: 6,
} as const;

/** 由天数推导末世等级：准备期 0，崩溃日起 1，每 7 天 +1 */
export function threatOfDay(day: number): number {
  if (day < TIME.COLLAPSE_DAY) return 0;
  const w = Math.floor((day - TIME.COLLAPSE_DAY) / TIME.WEEK) + 1;
  return Math.min(TIME.MAX_THREAT, w);
}

export const THREAT_NAMES = ['备灾期', '恐慌期', '匮乏期', '掠夺期', '严冬期', '荒芜期', '死寂期'] as const;

export const THREAT_DESC = [
  '一切看起来还正常。',
  '秩序在崩解，超市已经被搬空，警笛整夜不停。',
  '货架彻底空了。人们开始为一箱水动手。',
  '有组织的武装团体控制了街区。他们收"税"。',
  '气温断崖下跌。冻死的人比饿死的多。',
  '街上几乎见不到活人。能烧的都烧了。',
  '只剩风声。你已经很久没听到别人的声音。',
] as const;

// ============================================================
// 行动点与体力
// ============================================================

export const AP = {
  PREP_BASE: 4,
  SURVIVAL_BASE: 3,
  /** 体力低于此值时行动点 -1 */
  LOW_STAMINA: 40,
  /** 体力低于此值时行动点再 -1 */
  CRITICAL_STAMINA: 18,
  /** 每名健康同伴提供的额外工时（不是 AP） */
  COMPANION_LABOR: 3,
} as const;

export const STAMINA = {
  /** 睡眠基础恢复 */
  SLEEP_RECOVER: 34,
  /** 休息行动额外恢复 */
  REST_ACTION: 18,
  /** 外出搜刮消耗 */
  SCAVENGE: 16,
  /** 施工消耗 */
  BUILD: 12,
  /** 杂务消耗 */
  CHORE: 7,
} as const;

// ============================================================
// 配给
// ============================================================

/** 每人每日饮水需求 (L) */
export const WATER_NEED = { full: 4, normal: 3, limited: 1.8 } as const;
/** 每人每日食物需求 (份) */
export const FOOD_NEED = { full: 2.6, normal: 2, half: 1.2, none: 0.4 } as const;

/** 配给档位的每日额外结算 */
export const RATION_EFFECT = {
  full: { hp: 1, sanity: 1, morale: 2 },
  normal: { hp: 0, sanity: 0, morale: 0 },
  half: { hp: -2, sanity: -2, morale: -4 },
  none: { hp: -7, sanity: -4, morale: -9 },
} as const;

export const WATER_EFFECT = {
  full: { hp: 1, sanity: 1 },
  normal: { hp: 0, sanity: 0 },
  limited: { hp: -3, sanity: -1 },
} as const;

// ============================================================
// 健康
// ============================================================

export const HEALTH = {
  MAX: 100,
  /** 理智低于此值触发不可靠叙述 */
  SANITY_UNRELIABLE: 35,
  /** 理智低于此值开始每日掉 HP */
  SANITY_BREAK: 15,
  SANITY_BREAK_HP: -3,
  /** 无食物储备时每日强制饥饿 */
  STARVE_HP: -8,
  /** 无饮水储备时每日强制脱水 */
  THIRST_HP: -12,
  /** 营养不良的累积阈值：连续 n 天半配给 */
  MALNOURISH_DAYS: 3,
  /** 生喝未净化水的患病概率 */
  RAW_WATER_SICK: 0.42,
  /** 卫生不足（无净水且无医疗站）的额外患病概率 */
  POOR_HYGIENE_SICK: 0.12,
} as const;

/** 失温判定：体感温度低于阈值且保温不足 */
export const COLD = {
  /** 各保温等级能抵御的温度下限 */
  INSULATE_FLOOR: [9, 1, -9, -20],
  /** 每低于下限 1 度的 HP 损失 */
  HP_PER_DEGREE: 0.38,
  /** 触发失温状态的温差 */
  HYPOTHERMIA_GAP: 7,
  /** 有燃料烧炉子时的体感加成，保温等级会放大它 */
  HEAT_BASE: 4,
  HEAT_PER_INSULATE: 2,
  /** 取暖每日消耗的燃料下限 */
  HEAT_FUEL: 1,
} as const;

/** 空气：过滤等级能抵御的污染上限 */
export const AIR = {
  FILTER_TOLERANCE: [42, 62, 82, 97],
  HP_PER_POINT: 0.1,
  /** 密封对颗粒物同样有效：每级保温提升的容忍度 */
  SEAL_BONUS: 4,
  /** 有口罩时的容忍度加成 */
  MASK_BONUS: 10,
  /** 密封（保温≥2）且燃烧取暖时的 CO 中毒概率，有报警器则清零 */
  CO_RISK: 0.16,
} as const;

/** 辐射：屏蔽等级（地下站点 + 保温 + 空气过滤共同折算） */
export const RAD = {
  SHIELD_TOLERANCE: [30, 52, 74, 94],
  HP_PER_POINT: 0.15,
  /** 碘片可抵消的天数 */
  IODINE_DAYS: 3,
} as const;

// ============================================================
// 暴露度：累积热度条，决定"谁来找你"
// ============================================================

export const EXPOSURE = {
  MAX: 100,
  /** 每日自然衰减 */
  DECAY: 4,
  /** 各来源的每日增量 */
  SRC_POWER_FULL: 9,
  SRC_POWER_THRIFTY: 3,
  SRC_POWER_BLACKOUT: 0,
  SRC_PER_COMPANION: 1.5,
  SRC_GUNSHOT: 14,
  SRC_SALVAGE: 6,
  SRC_SCAVENGE: 2.5,
  /** 每级隐蔽减少的每日暴露度 */
  CONCEAL_REDUCE: 6,
  /** 降雪/浓雾掩盖 */
  WEATHER_COVER: 5,
  /** 分档阈值：路人 -> 踩点 -> 勒索 -> 突袭 */
  TIERS: [22, 45, 66, 84],
} as const;

/** 袭击判定 */
export const RAID = {
  /** 基础概率 = (暴露度/100) * 系数 * 末世等级修正 */
  BASE: 0.55,
  THREAT_MULT: [0, 0.5, 0.75, 1.0, 1.15, 1.3, 1.45],
  /** 每级加固减少的成功率 */
  FORTIFY_DEFENSE: 0.17,
  /** 每名健康同伴减少的成功率 */
  COMPANION_DEFENSE: 0.06,
  /** 有弹药时的额外防御 */
  ARMED_DEFENSE: 0.14,
  /** 施工中加固的惩罚 */
  UNDER_CONSTRUCTION_PENALTY: 0.22,
  /** 袭击成功时被抢走的资源比例 */
  LOOT_RATIO: [0, 0.12, 0.18, 0.26, 0.3, 0.36, 0.42],
} as const;

// ============================================================
// 搜刮与经济
// ============================================================

export const LOOT = {
  /** 各末世等级的产出倍率 */
  THREAT_MULT: [1.0, 0.9, 0.76, 0.63, 0.51, 0.4, 0.3],
  /** 每次搜刮消耗地点存量 */
  STOCK_DRAIN: 12,
  /** 存量对产出的影响下限 */
  MIN_STOCK_MULT: 0.25,
  /** 夜间搜刮：产出加成与危险加成 */
  NIGHT_YIELD: 1.4,
  NIGHT_DANGER: 1.8,
  /** 基础负重 (kg) */
  CARRY_BASE: 22,
  CARRY_VEHICLE: 90,
  CARRY_CART: 40,
} as const;

export const PRICE = {
  /** 准备期每日通胀区间 */
  DAILY_INFLATION: [0.16, 0.4] as const,
  /** D-3 起限购，单次采购上限倍率 */
  RATION_FROM_DAY: 5,
  RATION_CAP: 0.5,
  /** 雇工价格 = 基价 * 物价指数 * 系数 */
  HIRE_MULT: 1.0,
  /** 成品价格 = 基价 * 物价指数 */
  BUY_MULT: 1.0,
  /** 成品被拦截的概率（按到货延迟天数累加） */
  DELIVERY_FAIL_PER_DAY: 0.14,
} as const;

// ============================================================
// 电力
// ============================================================

export const POWER = {
  /** 各发电等级的基础日产量 (kWh)：0 级无、1 太阳能小阵、2 中阵+蓄电、3 柴油机+大阵 */
  BASE_OUTPUT: [0, 2.4, 5.2, 9.0],
  /** 柴油机档位耗油 (L/日) 与额外产出 */
  GENERATOR_FUEL: { full: 3.2, thrifty: 1.4, blackout: 0 },
  GENERATOR_OUTPUT: { full: 6.0, thrifty: 2.4, blackout: 0 },
  /** 天气对太阳能的倍率 */
  SOLAR_WEATHER: {
    clear: 1.0,
    overcast: 0.45,
    rain: 0.3,
    storm: 0.15,
    flooding: 0.3,
    snow: 0.35,
    blizzard: 0.1,
    ashfall: 0.07,
    blackRain: 0.12,
    fog: 0.3,
    heatwave: 1.1,
  } as Record<string, number>,
  /** 灾难对太阳能的长期倍率 */
  SOLAR_DISASTER: {
    nuclear: 0.6,
    pandemic: 1.0,
    gridDown: 1.0,
    volcanicWinter: 0.25,
    flood: 0.7,
    chemSpill: 0.8,
  } as Record<string, number>,
  BATTERY_CAP: [0, 0, 4, 10],
  /** 缺电时默认的保障优先级 */
  DEFAULT_PRIORITY: [
    'filter',
    'insulate',
    'airFilter',
    'medbay',
    'garden',
    'radio',
    'fortify',
    'conceal',
    'cistern',
    'power',
  ] as ModuleId[],
} as const;

/** 易耗品 */
export const WEAR = {
  FILTER_LIFE: 32,
  /** 落灰/毒气天气的额外损耗 */
  FILTER_EXTRA_DUST: 1.5,
  /** 更换一组滤芯要几个零件，恢复多少天寿命 */
  FILTER_PARTS: 4,
  FILTER_RESTORE: 26,
  GENERATOR_OIL: 24,
  OIL_PER_PART: 8,
  OIL_PARTS: 2,
} as const;

// ============================================================
// 储量上限
// ============================================================

export const CAPS = {
  /** 各储水等级的容量 (L)，会乘以站点的 waterCapMult。0 级是浴缸 + 手边的瓶子 */
  WATER: [90, 240, 470, 820],
  /** 农圃各等级日产生鲜食物 */
  GARDEN_YIELD: [0, 0.9, 2.4, 4.5],
  /** 净水各等级日处理量 (L) */
  FILTER_OUTPUT: [0, 9, 18, 32],
  /** 没有雨雪也没有井时，可处理的原水只有这个比例（消防水箱、景观水、积水） */
  RAW_WATER_DRY_MULT: 0.45,
  /** 医疗站各等级的治疗效率倍率 */
  MEDBAY_MULT: [0.5, 1.0, 1.5, 2.2],
} as const;

// ============================================================
// 事件导演
// ============================================================

export const DIRECTOR = {
  /** 每天呈现的事件数量区间 */
  EVENTS_PER_DAY: [1, 2] as const,
  PREP_EVENTS_PER_DAY: [1, 1] as const,
  /** 同一家族的默认冷却 */
  DEFAULT_COOLDOWN: 14,
  /** 节奏控制：观察最近几天 */
  BEAT_WINDOW: 3,
  /** 连续同类别达到此次数后，该类别权重乘以惩罚 */
  SAME_KIND_LIMIT: 2,
  SAME_KIND_PENALTY: 0.2,
  /** 最近强度总和超过阈值后，高强度事件降权 */
  INTENSITY_BUDGET: 7,
  HIGH_INTENSITY_PENALTY: 0.3,
  /** 连续挨打后提高机会类事件权重 */
  RELIEF_BOOST: 2.2,
  /** 秩序度每低 10 点，威胁类事件权重加成 */
  ORDER_THREAT_SCALE: 0.09,
  /** 各类别的基础权重修正 */
  KIND_BASE: {
    threat: 1.0,
    opportunity: 1.0,
    social: 1.0,
    medical: 0.85,
    weather: 0.7,
    moral: 0.9,
    story: 0.6,
    dream: 0.35,
  } as Record<EventKind, number>,
} as const;

// ============================================================
// 情报
// ============================================================

export const INTEL = {
  /** 每日推送条数 */
  PER_DAY: 3,
  /** 真情报的基础比例 */
  TRUTH_RATIO: 0.5,
  /** 无线电每级提升的真情报比例 */
  RADIO_BONUS: 0.09,
  /** 天赋"情报分析"提升 */
  PERK_BONUS: 0.12,
  /** 越接近崩溃日，真情报越多 */
  DAY_BONUS: 0.045,
} as const;

// ============================================================
// 起始资源（在职业与物资包之上叠加）
// ============================================================

export const START_RES: Record<ResourceId, number> = {
  water: 12,
  foodStaple: 6,
  foodFresh: 4,
  meds: 2,
  fuel: 5,
  materials: 4,
  parts: 3,
  ammo: 0,
  cash: 8000,
};

export const START_STATS: Record<StatId, number> = {
  hp: 100,
  stamina: 100,
  sanity: 80,
  humanity: 60,
  reputation: 50,
};

// ============================================================
// 难度
// ============================================================

export const DIFFICULTY = {
  story: { lootMult: 1.25, raidMult: 0.6, needMult: 0.85, canDie: false, relicMult: 0.6 },
  normal: { lootMult: 1.0, raidMult: 1.0, needMult: 1.0, canDie: true, relicMult: 1.0 },
  harsh: { lootMult: 0.8, raidMult: 1.35, needMult: 1.15, canDie: true, relicMult: 1.5 },
} as const;

// ============================================================
// 局外结算
// ============================================================

export const META = {
  /** 每存活一天的遗物 */
  RELIC_PER_DAY: 1,
  /** 撑过崩溃日的一次性奖励 */
  RELIC_SURVIVE_COLLAPSE: 10,
  /** 每提升一级末世等级的奖励 */
  RELIC_PER_THREAT: 8,
  /** 首次见到新事件家族 */
  RELIC_NEW_FAMILY: 2,
  RELIC_NEW_ENDING: 25,
} as const;
