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
