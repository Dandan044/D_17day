import type { ReactNode } from 'react';

import { t } from '../game/copy/t';

// ============================================================
// 面板
// ============================================================

export function Panel({
  title,
  right,
  children,
  className = '',
  bodyClass = '',
  mark,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
  mark?: boolean;
}) {
  return (
    <div className={`panel ${mark ? 'corner-mark' : ''} ${className}`}>
      {title && (
        <div className="panel-head">
          <span>{title}</span>
          {right}
        </div>
      )}
      <div className={bodyClass || 'p-3'}>{children}</div>
    </div>
  );
}

// ============================================================
// 数据条
// ============================================================

const TONE_COLOR: Record<string, string> = {
  hp: 'var(--color-alarm)',
  stamina: 'var(--color-amber)',
  sanity: 'var(--color-psyche)',
  humanity: 'var(--color-safe)',
  reputation: 'var(--color-info)',
  good: 'var(--color-safe)',
  warn: 'var(--color-amber)',
  bad: 'var(--color-alarm)',
  info: 'var(--color-info)',
};

export function Bar({ value, max = 100, tone = 'warn' }: { value: number; max?: number; tone?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar">
      <i style={{ width: `${pct}%`, background: TONE_COLOR[tone] ?? tone }} />
    </div>
  );
}

export function Gauge({
  label,
  value,
  max = 100,
  tone = 'warn',
  suffix,
  hint,
}: {
  label: string;
  value: number;
  max?: number;
  tone?: string;
  suffix?: string;
  hint?: string;
}) {
  return (
    <div title={hint}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="label">{label}</span>
        <span className="num text-[12px] text-paper">
          {Math.round(value)}
          {suffix ?? ''}
        </span>
      </div>
      <div className="mt-1">
        <Bar value={value} max={max} tone={tone} />
      </div>
    </div>
  );
}

// ============================================================
// 徽记
// ============================================================

export function Chip({
  children,
  tone = 'default',
  title,
}: {
  children: ReactNode;
  tone?: 'default' | 'good' | 'bad' | 'warn' | 'info' | 'psyche';
  title?: string;
}) {
  const style: Record<string, string> = {
    good: 'border-safe/50 text-safehi bg-safe/10',
    bad: 'border-alarm/50 text-alarmhi bg-alarm/10',
    warn: 'border-amber/50 text-amberhi bg-amber/10',
    info: 'border-info/50 text-infohi bg-info/10',
    psyche: 'border-psyche/50 text-psyche bg-psyche/10',
    default: '',
  };
  return (
    <span className={`chip ${style[tone]}`} title={title}>
      {children}
    </span>
  );
}

// ============================================================
// 模态
// ============================================================

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  width = 'max-w-2xl',
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose?: () => void;
  width?: string;
  footer?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-void/80 p-4 anim-in backdrop-blur-[2px]">
      <div className={`panel corner-mark w-full ${width} flex max-h-[92vh] flex-col anim-rise`}>
        <div className="panel-head">
          <div className="flex min-w-0 flex-col">
            <span className="truncate">{title}</span>
            {subtitle && <span className="mt-0.5 text-[9px] normal-case tracking-normal text-faint">{subtitle}</span>}
          </div>
          {onClose && (
            <button className="btn-ghost btn px-2 py-0.5 text-[11px]" onClick={onClose}>
              {t('ui.common.close')}
            </button>
          )}
        </div>
        <div className="scroll-y flex-1 p-4">{children}</div>
        {footer && <div className="border-t border-line bg-white/[0.02] p-3">{footer}</div>}
      </div>
    </div>
  );
}

// ============================================================
// 小工具
// ============================================================

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="label">{children}</span>
      <div className="hairline flex-1" />
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="label">{label}</span>
      <span className="num text-[12.5px]" style={tone ? { color: TONE_COLOR[tone] ?? tone } : undefined}>
        {value}
      </span>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-8 text-center text-[12.5px] text-faint">{children}</div>;
}

export function num(v: number, digits = 0): string {
  return v.toFixed(digits);
}
