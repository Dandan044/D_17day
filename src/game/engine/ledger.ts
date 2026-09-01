/** 夜间结算账本行：状态 + 数值，可选好坏色调 */

export type LedgerTone = 'good' | 'bad' | 'neutral';

export interface LedgerNote {
  text: string;
  tone?: LedgerTone;
}

export function ledger(text: string, tone?: LedgerTone): LedgerNote {
  return tone ? { text, tone } : { text };
}
