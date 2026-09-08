import { useEffect, useRef, useState, type ReactNode } from 'react';

import { t } from '../game/copy/t';

// ============================================================
// 帮助标记：小问号，悬停/点击弹出说明（收编常驻的教学句）
// ============================================================

const HELP_W = 240; // 弹层宽度（w-60）
const HELP_EST_H = 170; // 弹层高度估算，用于上/下翻转决策

export function HelpHint({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  /** 按触发点实测坐标定位：fixed 定位逃出滚动容器的 overflow 裁切 */
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(12, Math.min(r.left, window.innerWidth - HELP_W - 12));
    const below = r.bottom + 8;
    // 下方放不下就朝上；朝上空间也不足时贴顶兜底
    const top =
      below + HELP_EST_H <= window.innerHeight - 8
        ? below
        : Math.max(8, Math.min(r.top - 8 - HELP_EST_H, window.innerHeight - HELP_EST_H - 8));
    setPos({ top, left });
    setOpen(true);
  };
  const hide = () => setOpen(false);

  // 打开期间页面滚动/缩放会让固定定位的弹层和触发点脱钩，直接收起
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <span ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={t('ui.common.helpHint')}
        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] leading-none ring-1 transition-colors ${
          open ? 'bg-amber/15 text-amberhi ring-amber/40' : 'text-faint ring-line2 hover:text-paper'
        }`}
        onClick={() => (open ? hide() : show())}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        ?
      </button>
      {open && pos && (
        <span
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: HELP_W }}
          className="z-50 block rounded-sm bg-ink p-2.5 text-left text-[11px] font-normal leading-relaxed text-paper/85 shadow-lg ring-1 ring-line2"
        >
          {children}
        </span>
      )}
    </span>
  );
}

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
      <i style={{ transform: `scaleX(${pct / 100})`, background: TONE_COLOR[tone] ?? tone }} />
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
    <span className={`chip relative ${title ? 'group/chip' : ''} ${style[tone]}`} title={title}>
      {children}
      {title && (
        <span className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 z-30 hidden -translate-x-1/2 whitespace-nowrap rounded-sm bg-ink px-1.5 py-0.5 text-[10px] tracking-normal text-paper ring-1 ring-line2 group-hover/chip:block">
          {title}
        </span>
      )}
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
  titleRight,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose?: () => void;
  width?: string;
  footer?: ReactNode;
  /** 标题右侧的挂点（如 HelpHint） */
  titleRight?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-void/[0.85] p-4 anim-in">
      <div className={`panel corner-mark w-full ${width} flex max-h-[92vh] flex-col anim-rise`}>
        <div className="panel-head">
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-1.5">
              <span className="truncate">{title}</span>
              {titleRight}
            </div>
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
