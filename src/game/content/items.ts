/**
 * 特殊物品定义表：滤芯、一氧化碳报警器、碘片。
 * 数量的存储分两处——
 *  - filter：run.items.filter（真正的「背包数量」）
 *  - coAlarm / iodine：沿用 flags（flag:coAlarm / flag:iodineStock1/2），UI 层派生显示
 * 物品面板与搜刮掉落渲染都读本表；引擎逻辑不依赖本表。
 */

export type ItemId = 'filter' | 'coAlarm' | 'iodine';

export interface ItemDef {
  id: ItemId;
  /** 主动物品在物品面板显示「使用」按钮；被动物品只展示 */
  kind: 'active' | 'passive';
  /** 库存来源：items 容器或 flags 派生 */
  source: 'items' | 'flag';
}

export const ITEM_DEFS: Record<ItemId, ItemDef> = {
  filter: { id: 'filter', kind: 'active', source: 'items' },
  iodine: { id: 'iodine', kind: 'active', source: 'flag' },
  coAlarm: { id: 'coAlarm', kind: 'passive', source: 'flag' },
};

export const ITEM_ORDER: ItemId[] = ['filter', 'coAlarm', 'iodine'];
