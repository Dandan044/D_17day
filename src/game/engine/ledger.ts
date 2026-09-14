/** 夜间结算账本行：状态 + 数值 + 该行代表的数值图标（可选） */

import type { ValueIconId } from '../types';

export type LedgerTone = 'good' | 'bad' | 'neutral';

export interface LedgerNote {
  text: string;
  tone?: LedgerTone;
  /** 这行说的是哪个数值（水/食物/储电/燃料…）：给了就在行首画对应图标。 */
  icon?: ValueIconId;
}

export function ledger(text: string, tone?: LedgerTone, icon?: ValueIconId): LedgerNote {
  const out: LedgerNote = { text };
  if (tone) out.tone = tone;
  if (icon) out.icon = icon;
  return out;
}
