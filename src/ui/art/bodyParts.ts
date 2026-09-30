import { conditionDef } from '../../game/content/lookup';
import { isSevereCondition } from '../../game/engine/todos';
import type { ConditionId } from '../../game/types';

/**
 * 疾病 → 身体部位 的映射层。
 *
 * ## 为什么需要新增这一层
 *
 * 引擎里**没有**任何部位概念。`ConditionDef`（`content/conditions.ts`）的字段只有
 * `kind / severity / daily / medsCure / needsMedbay / worsen / autoCure / conditionHint`，
 * 部位信息只存在于 `desc` 的措辞里（「手背裂开一道口子」「红线正沿着手臂往上走」
 * 「腰眼两侧隐隐作痛」）。`hpParts` 也不是部位，是过夜扣血**来源**明细。
 *
 * 所以部位这一层只能显式写下来。写在这里而不写进 `conditions.ts`，是因为它**纯粹是呈现**：
 * 不参与结算、不进存档、不改变任何数值，只有「身体状况」那屏的人体图读它。
 * 哪天引擎真要做部位伤害，那时再把它挪进 content。
 *
 * ## 两条硬约束
 *
 * 1. **查表必须走 `conditionDef()`**。悬空 id 直接索引 `CONDITION_BY_ID[id].severity`
 *    会在渲染期抛错、让 React 卸掉整棵树、只剩白屏（`lookup.ts` 文件头就是记这事的）。
 *    `aggregateBodyParts()` 因此额外吐出 `unknown[]`，由调用方显示「N 项无法识别」，
 *    而不是静默丢掉。
 * 2. **同一部位多条状态取 `max(severity)`，不相加**。相加会把多病部位涂成一个死色块，
 *    读不出「这里还有多严重」——图上要回答的是「最坏到什么程度」。
 */

export type BodyPartId =
  | 'skin'
  | 'head'
  | 'eyes'
  | 'mouth'
  | 'throat'
  | 'lung'
  | 'heart'
  | 'abdomen'
  | 'kidney'
  | 'arm'
  | 'hand'
  | 'leg';

/**
 * 图上每个部位的锚点（viewBox 0 0 200 340 单位）与它挂到哪一列标注。
 *
 * 这些点必须落在 `BodyMap.tsx` 里对应 `PART_SHAPE` 的**填充面内**，否则引线端点的小圆
 * 会悬在体外——改造型时两边一起改。左右分列就是靠这里的 `side`。
 */
export const PART_ANCHOR: Record<BodyPartId, { x: number; y: number; side: 'L' | 'R' }> = {
  head: { x: 100, y: 34, side: 'R' },
  eyes: { x: 90, y: 30, side: 'L' },
  mouth: { x: 100, y: 45, side: 'R' },
  throat: { x: 100, y: 63, side: 'R' },
  lung: { x: 82, y: 97, side: 'L' },
  heart: { x: 98, y: 101, side: 'R' },
  abdomen: { x: 100, y: 128, side: 'R' },
  kidney: { x: 113, y: 146, side: 'R' },
  arm: { x: 61, y: 108, side: 'L' },
  hand: { x: 57, y: 178, side: 'L' },
  leg: { x: 80, y: 250, side: 'L' },
  // 整身：语义上「哪都在」，所以点落在骨盆线上那一处没有其它器官的横带，避免与器官抢同一根引线。
  skin: { x: 100, y: 158, side: 'R' },
};

/** 疾病 → 它落在身上哪个（些）位置。依据逐条来自 `conditions.ts` 的 `desc`。 */
export const CONDITION_PARTS: Record<ConditionId, readonly BodyPartId[]> = {
  // 「喉咙发紧，尿色变深」——只落喉咙。再加一个「嘴」会在图上写成两行一模一样的「口渴」，
  // 因为 throat(63) 与 mouth(45) 挨得太近，读起来像画重了。
  thirst: ['throat'],
  // 「嘴唇起皮，站起来有点头晕」
  dehydrationMild: ['mouth', 'skin'],
  // 「站起来眼前发黑」
  dehydrationMod: ['head', 'skin'],
  // 「皮肤捏起来不会回弹，心脏在干涸的血管里空转」
  dehydrationSevere: ['skin', 'head', 'heart'],
  // 「胃已经不疼了，那更糟——身体开始烧自己」
  starving: ['abdomen', 'skin'],
  // 「牙龈在出血，伤口不愈合」
  malnourished: ['mouth', 'skin'],
  // 「身体正在把好不容易存下的水全部排出去」
  dysentery: ['abdomen'],
  // 「肚子一阵一阵地绞」
  giardia: ['abdomen'],
  // 「眼白发黄，皮肤也跟着黄」——肝源性黄疸，落眼白 + 皮肤 + 上腹
  jaundice: ['eyes', 'skin', 'abdomen'],
  // 「发烧，骨头缝里疼」
  flu: ['head', 'lung', 'skin'],
  // 「呼吸浅，咳出来的东西带着颜色」
  pneumonia: ['lung'],
  // 「手背裂开一道口子」
  wound: ['hand'],
  // 「有一道红线正沿着手臂往上走」
  woundInfection: ['arm', 'skin'],
  // 「伤口本身已经不重要了——感染进了血」
  sepsis: ['heart', 'skin'],
  // 「固定得再好，它也需要六周」——原文没指哪根骨头，按「走不了路」落腿
  fracture: ['leg'],
  // 「手指发僵」
  hypothermiaMild: ['hand'],
  // 「牙齿对不上，穿衣服要试两次」
  hypothermiaMod: ['hand', 'mouth'],
  // 「你已经不觉得冷了」——最危险的一档，全身体温调节失守
  hypothermiaSevere: ['skin', 'head'],
  // 「恶心、呕吐，然后是一段虚假的好转期」
  radiationSickness: ['abdomen', 'heart', 'skin'],
  // 「头疼、恶心、判断力下降」
  coPoisoning: ['head'],
  // 「咳出来的东西带着颜色。潮湿的地方总要收这笔租金」
  moldLung: ['lung'],
  // 「腰眼两侧隐隐作痛」
  kidneyStrain: ['kidney'],
  // 心理状态，不上身体图。它由颅环旁边的理智数值表达，不是器官病变。
  despair: [],
};

/**
 * 图上深浅用的强度 1..5。
 *
 * 病理性疾病自带 `severity`，直接用。**条件型疾病没有这个字段**（它们不走治愈判定），
 * 但它们在图上恰恰是需要分出梯度的——脱水与低温症都是「轻→中→重」三连，
 * 三档涂成同一个颜色等于把最要紧的进展信息抹掉了。所以这里补一张**仅用于显示**的强度表：
 * 只影响填充深浅，不参与任何结算、不被任何引擎代码读取。
 *
 * 表里没列的一律回落 2（轻度），重症（`isSevereCondition`）一律 5。
 */
const CONDITION_HEAT: Partial<Record<ConditionId, 1 | 2 | 3 | 4 | 5>> = {
  thirst: 1,
  dehydrationMild: 2,
  dehydrationMod: 3,
  dehydrationSevere: 5,
  starving: 3,
  hypothermiaMild: 2,
  hypothermiaMod: 3,
  hypothermiaSevere: 5,
  coPoisoning: 4,
  despair: 2,
};

/** 某条状态在图上的强度 1..5。查不到定义时按「未知」处理，由调用方决定怎么显示。 */
export function conditionHeat(id: ConditionId): number | undefined {
  const def = conditionDef(id);
  if (!def) return CONDITION_HEAT[id] ?? undefined;
  if (def.severity) return def.severity;
  if (isSevereCondition(id)) return 5;
  return CONDITION_HEAT[id] ?? 2;
}

/** 同一部位上堆了多条状态时的聚合结果。 */
export interface BodyPartAgg {
  /** 强度 1..5：**取最大值，不相加**。 */
  heat: number;
  /** 这一档是不是重症——图上要叠斜纹。 */
  severe: boolean;
  /** 挂在同一个部位的病名，按强度降序。图上逐行标出。 */
  names: string[];
  /** 其中有没有条件型（环境失衡而非感染）。决定填充色走赭石还是朱红。 */
  conditional: boolean;
}

export interface BodyMapAgg {
  parts: Map<BodyPartId, BodyPartAgg>;
  /** 查不到定义的 id。调用方要显示出来，不能静默丢。 */
  unknown: string[];
  /** 有状态但图上不占部位（心理类），只用于「图上没标但不代表没事」的提示。 */
  offBody: string[];
}

/**
 * 把一串状态 id 聚成「部位 → 强度 + 病名」。
 *
 * `conditionAge` 只为排序用（同强度时病程久的排前面），可选。
 */
export function aggregateBodyParts(
  conditions: readonly string[],
  conditionAge?: Partial<Record<string, number>>,
): BodyMapAgg {
  const parts = new Map<BodyPartId, BodyPartAgg>();
  const unknown: string[] = [];
  const offBody: string[] = [];
  /** 先收集「部位 → 状态列表」，最后统一算聚合，免得边遍历边改聚合值。 */
  const raw = new Map<BodyPartId, Array<{ id: string; name: string; heat: number; severe: boolean; conditional: boolean; age: number }>>();

  for (const id of conditions) {
    const def = conditionDef(id);
    const heat = conditionHeat(id as ConditionId);
    if (!def || heat === undefined) {
      unknown.push(id);
      continue;
    }
    const targets = CONDITION_PARTS[id as ConditionId] ?? [];
    if (targets.length === 0) {
      offBody.push(def.name);
      continue;
    }
    const entry = {
      id,
      name: def.name,
      heat,
      severe: isSevereCondition(id as ConditionId),
      conditional: def.kind === 'conditional',
      age: conditionAge?.[id] ?? 0,
    };
    for (const part of targets) {
      const list = raw.get(part);
      if (list) list.push(entry);
      else raw.set(part, [entry]);
    }
  }

  for (const [part, list] of raw) {
    // 强度降序；同强度时病程久的先写——玩家更容易先看到拖了几天的那条。
    list.sort((a, b) => b.heat - a.heat || b.age - a.age);
    const top = list[0]!;
    parts.set(part, {
      heat: top.heat,
      severe: list.some((e) => e.severe),
      names: list.map((e) => e.name),
      conditional: list.every((e) => e.conditional),
    });
  }

  return { parts, unknown, offBody };
}
