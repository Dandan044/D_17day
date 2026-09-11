import type { ChannelDef } from '../../types';
import { CORE_CV } from './core_cv';
import { CORE_OG } from './core_og';
import { CORE_XT } from './core_xt';
import { TMP_DYING } from './tmp_01_dying';
import { TMP_MOTHER } from './tmp_02_mother';
import {
  TMP_CHILD,
  TMP_COUNTER,
  TMP_DOCTOR,
  TMP_FOREIGNER,
  TMP_NEIGHBOR,
  TMP_SCAMMER,
  TMP_SINGER,
  TMP_TRUCKER,
} from './tmp_extras';

/**
 * 频道定义总表。
 *
 * 与事件家族（content/events）刻意分开：频道节拍不走 run.queue，
 * 也不参与导演系统的权重抽签，所以不进 ALL_FAMILIES。
 */
export const CHANNEL_DEFS: ChannelDef[] = [
  CORE_CV,
  CORE_OG,
  CORE_XT,
  TMP_DYING,
  TMP_MOTHER,
  TMP_SINGER,
  TMP_DOCTOR,
  TMP_CHILD,
  TMP_COUNTER,
  TMP_TRUCKER,
  TMP_FOREIGNER,
  TMP_SCAMMER,
  TMP_NEIGHBOR,
];

export const CHANNEL_BY_ID: Record<string, ChannelDef> = Object.fromEntries(
  CHANNEL_DEFS.map((c) => [c.id, c]),
);

/** 可被「搜索频道」搜到的池子。核心频道按剧情到场，不进池 */
export const CHANNEL_POOL: string[] = CHANNEL_DEFS.filter((c) => c.discover === 'search').map((c) => c.id);
