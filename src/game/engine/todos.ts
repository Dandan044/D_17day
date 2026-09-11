/**
 * 今日待办：从 RunState 实时派生的紧急事件仪表。
 *
 * 纯函数、零副作用——不写 run、不触发事件、不占阈值弧配额。
 * 与 hooks.ts 的阈值事件弧共用同一套常量阈值，但职责不同：
 * 阈值弧负责「讲故事」，这里只负责「报状态」。
 */
import { AP, FOOD_NEED, HEALTH, RAD, WATER_NEED, WEAR } from '../balance';
import { CONDITION_BY_ID } from '../content/conditions';
import type { ActionHook, ConditionId, RunState } from '../types';
import { computePower } from './power';
import { radiationShield } from './tags';

export type TodoLevel = 'red' | 'orange';

export interface TodoItem {
  id: string;
  level: TodoLevel;
  title: string;
  /** 数值与后果，逐行展示 */
  lines: string[];
  /** 解决指引 */
  fix: string;
}

/** 重症：显式列举（无 severity 字段的条件型重症）+ severity≥4 的病理性重症 */
const SEVERE_CONDITIONS: ConditionId[] = ['dehydrationSevere', 'hypothermiaSevere', 'coPoisoning'];

function isSevere(c: ConditionId): boolean {
  return SEVERE_CONDITIONS.includes(c) || (CONDITION_BY_ID[c]?.severity ?? 0) >= 4;
}

function heads(run: RunState): number {
  return 1 + run.survivors.length;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** 收集全部待办。红在前、橙在后，同级按危险度排序。 */
export function collectTodos(run: RunState): TodoItem[] {
  const out: TodoItem[] = [];
  const h = heads(run);
  const red: TodoItem[] = [];
  const orange: TodoItem[] = [];

  // ---- 资源 ----
  if (run.res.water <= 0) {
    red.push({
      id: 'water-zero',
      level: 'red',
      title: '储水归零',
      lines: ['饮用水已见底。', '今晚仍喝不上水，脱水会直接致命。'],
      fix: '把用水档改到急限，或立刻外出取水／开净水器。',
    });
  } else if (run.res.water < h * 3) {
    const days = (run.res.water / (h * WATER_NEED[run.waterUse])).toFixed(1);
    orange.push({
      id: 'water-low',
      level: 'orange',
      title: '储水不足',
      lines: [`剩 ${Math.floor(run.res.water)} L，按当前用水档约够 ${days} 天。`, '断水后进入口渴与脱水链，脱水会要命。'],
      fix: '净水器产水、升级水箱，或外出取水。',
    });
  }

  const food = run.res.foodStaple + run.res.foodFresh;
  if (food <= 0) {
    red.push({
      id: 'food-zero',
      level: 'red',
      title: '存粮归零',
      lines: ['存粮已见底。', '饥饿会发展成营养不良，拖垮整个身体。'],
      fix: '外出搜粮／采购，或把口粮档降到半份先撑住。',
    });
  } else if (food < h * 2) {
    const days = (food / (h * FOOD_NEED[run.ration])).toFixed(1);
    orange.push({
      id: 'food-low',
      level: 'orange',
      title: '存粮不足',
      lines: [`剩 ${Math.floor(food)} 份，按当前口粮档约够 ${days} 天。`, '断粮后进入饥饿链。'],
      fix: '外出搜粮、采购，或开菜圃自产。',
    });
  }

  // ---- 身体 ----
  if (run.stats.hp < HEALTH.HP_CRIT) {
    red.push({
      id: 'hp-crit',
      level: 'red',
      title: '生命危急',
      lines: [`生命 ${Math.round(run.stats.hp)}/100。`, '再受一次伤或病一场，就可能撑不过去。'],
      fix: '用药处理伤口，今晚休息，别再冒险外出。',
    });
  } else if (run.stats.hp < HEALTH.HP_WARN) {
    orange.push({
      id: 'hp-warn',
      level: 'orange',
      title: '生命过低',
      lines: [`生命 ${Math.round(run.stats.hp)}/100。`, '继续恶化会有生命危险。'],
      fix: '用药处理伤口，今晚好好休息。',
    });
  }

  if (run.stats.sanity < HEALTH.SANITY_BREAK) {
    red.push({
      id: 'sanity-break',
      level: 'red',
      title: '理智濒崩',
      lines: [`理智 ${Math.round(run.stats.sanity)}/100。`, '随时可能崩溃失控，做出无法挽回的事。'],
      fix: '安稳地过一天，保证充足补给与睡眠。',
    });
  } else if (run.stats.sanity < HEALTH.SANITY_UNRELIABLE) {
    orange.push({
      id: 'sanity-low',
      level: 'orange',
      title: '理智不稳',
      lines: [`理智 ${Math.round(run.stats.sanity)}/100。`, '坏消息的冲击被放大，事件更容易把人压垮。'],
      fix: '安稳地过几天，吃一顿好的，睡足觉。',
    });
  }

  if (run.stats.stamina < HEALTH.STAMINA_LOW) {
    orange.push({
      id: 'stamina-low',
      level: 'orange',
      title: '体力过低',
      lines: [`体力 ${Math.round(run.stats.stamina)}/100。`, '每天行动点 −1；更低再 −1，什么都干不成。'],
      fix: '吃一顿好的，今晚早点休息。',
    });
  }

  // ---- 病情：重症红、轻中症橙 ----
  const severe = run.conditions.filter(isSevere);
  const mild = run.conditions.filter((c) => !isSevere(c));
  if (severe.length > 0) {
    const lines = severe.map((c) => {
      const def = CONDITION_BY_ID[c];
      const age = run.conditionAge[c] ?? 0;
      const w = def.worsen ? `，再拖可能恶化为${CONDITION_BY_ID[def.worsen.into]?.name ?? def.worsen.into}` : '';
      return `${def.name} · 已 ${age} 天${w}。`;
    });
    red.push({
      id: 'condition-severe',
      level: 'red',
      title: '重症在身',
      lines,
      fix: '用药治疗；医疗站等级足够时，今晚有过治愈判定。',
    });
  }
  if (mild.length > 0) {
    const lines = mild.map((c) => {
      const def = CONDITION_BY_ID[c];
      const age = run.conditionAge[c] ?? 0;
      const w = def.worsen?.afterDays !== undefined ? `，拖过 ${def.worsen.afterDays} 天可能恶化为${CONDITION_BY_ID[def.worsen.into]?.name ?? def.worsen.into}` : '';
      return `${def.name} · 已 ${age} 天${w}。`;
    });
    const hint = mild.some((c) => CONDITION_BY_ID[c]?.kind === 'pathogenic')
      ? '用药治疗；医疗站等级足够时今晚可治愈。'
      : '按病因处理（通风／保暖／喝水），或用药缓解。';
    orange.push({
      id: 'condition-mild',
      level: 'orange',
      title: '患病',
      lines,
      fix: hint,
    });
  }

  // ---- 装备与供电 ----
  const filterInUse = run.modules.filter > 0 || run.modules.airFilter > 0;
  if (filterInUse && run.wear.filterLife <= 0) {
    red.push({
      id: 'filter-dead',
      level: 'red',
      title: '滤芯报废',
      lines: ['滤芯耐久已耗尽，净水器与空气过滤器全部停摆。', `备用滤芯库存：${run.items.filter}`],
      fix: run.items.filter > 0 ? '去物资面板换上备用滤芯。' : '尽快找到滤芯或五金零件应急。',
    });
  } else if (filterInUse && run.wear.filterLife < 6) {
    orange.push({
      id: 'filter-worn',
      level: 'orange',
      title: '滤芯将耗尽',
      lines: [`滤芯剩余耐久 ${run.wear.filterLife.toFixed(1)}/${WEAR.FILTER_LIFE}。`, '耗尽后净水器与空气过滤器一起停。'],
      fix: run.items.filter > 0 ? `换备用滤芯（库存 ${run.items.filter}）。` : '储备备用滤芯或五金零件。',
    });
  }

  if (run.wear.generatorOil < WEAR.OIL_PER_PART && run.modules.power > 0) {
    orange.push({
      id: 'generator-oil',
      level: 'orange',
      title: '发电机缺保养',
      lines: [`发电机保养度 ${Math.round(run.wear.generatorOil)}/${WEAR.GENERATOR_OIL}。`, '油尽后发电机停摆，供电优先级再高也没用。'],
      fix: `用 ${WEAR.OIL_PARTS} 个五金零件做一次保养。`,
    });
  }

  const power = computePower(run);
  if (power.offline.length > 0) {
    const names = [...new Set(power.offline)].join('、');
    orange.push({
      id: 'power-offline',
      level: 'orange',
      title: '家电将停机',
      lines: [`今晚不在线：${names}。`, '冰箱断电食物加速腐坏，取暖器停了夜里会失温。'],
      fix: '补燃油或充电，或在供电面板调整优先级与开关。',
    });
  }

  // ---- 环境 ----
  const tol = RAD.SHIELD_TOLERANCE[radiationShield(run)] ?? RAD.SHIELD_TOLERANCE[0] ?? 50;
  if (run.world.radiation > tol) {
    orange.push({
      id: 'radiation-high',
      level: 'orange',
      title: '辐射超耐受',
      lines: [`辐射 ${Math.round(run.world.radiation)}，高于屏蔽耐受 ${tol}。`, '暴露在外的身体会积累辐射病。'],
      fix: '服碘片、升级屏蔽，辐射天别外出。',
    });
  }
  if (run.world.exposure >= 40) {
    orange.push({
      id: 'exposure-high',
      level: 'orange',
      title: '高暴露度',
      lines: [`暴露度 ${Math.round(run.world.exposure)}/100。`, '被盯上的风险在上升，袭击与麻烦会找上门。'],
      fix: '升级遮光帘，减少喧闹的行为。',
    });
  }
  if (run.world.airPollution > 30) {
    orange.push({
      id: 'air-bad',
      level: 'orange',
      title: '空气污浊',
      lines: [`空气污染 ${Math.round(run.world.airPollution)}。`, '不加过滤会伤肺，霉菌肺病就是从这来的。'],
      fix: '升级空气过滤器，污染天减少开窗与外出。',
    });
  }
  if (run.world.lawOrder < 45) {
    orange.push({
      id: 'law-bad',
      level: 'orange',
      title: '治安恶化',
      lines: [`社会秩序 ${Math.round(run.world.lawOrder)}/100。`, '外面越来越乱，袭击与抢劫会更频繁。'],
      fix: '加固门窗与锁具，减少夜间外出。',
    });
  }

  out.push(...red, ...orange);
  return out;
}

/** 当前最高警戒级：用于本子轮廓描边配色。 */
export function todoTier(run: RunState): TodoLevel | null {
  let tier: TodoLevel | null = null;
  for (const td of collectTodos(run)) {
    if (td.level === 'red') return 'red';
    tier = 'orange';
  }
  return tier;
}

/** 事件钩子登记：只列已挂起的钩子（名 + 触发条件），不透露后果。 */
export const HOOK_CONDITIONS: Partial<Record<ActionHook, string>> = {
  foodLow: '存粮低于 2 天量',
  waterLow: '饮水低于 3 天量',
  hpLow: '生命低于 40',
  sanityLow: '理智低于 35',
  staminaLow: '体力低于 25',
  humanityLow: '人性低于 35',
  repLow: '声望低于 35',
  lightsOff: '照明家电离线',
  filterExpired: '滤芯耐久耗尽',
  exposureUp: '暴露度升到 40',
};

export interface HookRegisterRow {
  hook: ActionHook;
  count: number;
}

/** 汇总 run.pending 里挂起的钩子（按钩子聚合，多条事件等同一钩子只记一行）。 */
export function collectHookRegister(run: RunState): HookRegisterRow[] {
  const rows: HookRegisterRow[] = [];
  for (const p of run.pending) {
    const hooks = Array.isArray(p.waitFor) ? p.waitFor : p.waitFor ? [p.waitFor] : [];
    for (const hook of hooks) {
      if (!HOOK_CONDITIONS[hook]) continue;
      const row = rows.find((r) => r.hook === hook);
      if (row) row.count += 1;
      else rows.push({ hook, count: 1 });
    }
  }
  return rows;
}

/** 供断言/调试：行动点扣减阈值与本表保持一致。 */
export const STAMINA_AP_LINES = { low: AP.LOW_STAMINA, critical: AP.CRITICAL_STAMINA } as const;

export { clamp01 };
