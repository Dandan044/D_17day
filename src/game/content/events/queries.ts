import type { TagQuery } from '../../types';

/** 核战 */
export const NUC: TagQuery = { all: ['disaster:nuclear'] };

/** 核战 + 城区（楼下喇叭、征收等） */
export const APT: TagQuery = { all: ['disaster:nuclear', 'site:urban'] };

/** 核战 + 高楼（阳台、电梯井、对面楼） */
export const HIGH: TagQuery = { all: ['disaster:nuclear', 'site:highFloor'] };

/** 城区（不绑灾难） */
export const URBAN: TagQuery = { all: ['site:urban'] };

/** 高楼（不绑灾难） */
export const HIGHFLOOR: TagQuery = { all: ['site:highFloor'] };

/** 城区或高楼（公寓切片常用） */
export const URBAN_OR_HIGH: TagQuery = { any: ['site:urban', 'site:highFloor'] };

/**
 * 救助-袭击联动钩子：玩家救助行为留下的 flag。
 * 新增援助来源时：这里加 flag，并在 raid_aided_repel 下加对应变体（require 该 flag、选项 clearFlags 消耗它）。
 * 消费方：director.selectEvents 的 tryPush 替换层、raid_aided_repel 家族 require。
 */
export const AID_HOOK_FLAGS: string[] = ['flag:shelteredInBlizzard'];
