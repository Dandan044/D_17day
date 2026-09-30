import type { ChannelDef } from '../../types';
import { CORE_XT } from './core_xt';

/**
 * 频道定义总表。
 *
 * 与事件家族（content/events）刻意分开：频道节拍不走 run.queue，
 * 也不参与导演系统的权重抽签，所以不进 ALL_FAMILIES。
 *
 * 2026-09-15：收音机内容重做。除小桃（xt）外的 12 个频道全部下线，
 * xt 按「模范线」标准重写（标杆条款见 docs/radio-voices.md）。
 * 后续频道按这条线的标准量产后再回填本表。
 */
export const CHANNEL_DEFS: ChannelDef[] = [CORE_XT];

export const CHANNEL_BY_ID: Record<string, ChannelDef> = Object.fromEntries(
  CHANNEL_DEFS.map((c) => [c.id, c]),
);

/** 可被「搜索频道」搜到的池子。核心频道按剧情到场，不进池 */
export const CHANNEL_POOL: string[] = CHANNEL_DEFS.filter((c) => c.discover === 'search').map((c) => c.id);
