import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { TIME } from '../../game/balance';
import { t, tList } from '../../game/copy/t';
import { useGame } from '../../game/store';
import type { LogEntry, RunState } from '../../game/types';
import { ART } from './skin';
import './art.css';

/**
 * 记忆日记：挂在墙上的那页日历，过去的日子被划掉。
 *
 * 进入方式是底部工具条上那条 `.art-link`（房间里没有对应的场景热点——日历挂在门后，
 * 从场景里看不见），所以这屏**没有实物锚点可依**，`transform-origin` 只能给 50% 50%，
 * 让整页纸从正面推近，不做斜向飞入。
 *
 * 载体纸直接复用本子的冷米白内页（`ART.todoPaper`）——**零新生图**。既然同一张纸，
 * 墨色也照抄本子那一族（`--nb-*` 的冷调蓝黑圆珠笔），不另起暖色。
 *
 * 左边是月历栅格：每个格子一天，格下的点阵是那天写了几条（颜色按 `LogEntry.tone`），
 * 划掉的是过去、双圈的是今天、角标 D-n 是七天倒计时。右边是选中那天的正文与「复制全文」。
 * 数据契约与经典 `LogPanel`（`panels.tsx:605-676`）完全一致：同一个 `run.log`，
 * 同一个导出文案、同一个 toast。
 */

const SHEET_OUT_MS = 240;

/** 每条记录的墨色（写在纸上的版本，比经典深色 UI 的 `--color-*` 暗一档） */
const CAL_TONE: Record<string, string> = {
  good: 'var(--cal-green)',
  bad: 'var(--cal-red)',
  grim: 'var(--cal-grim)',
  neutral: 'var(--cal-ink-3)',
};

/** 图例：与格子上的点、右侧条目的左邻线共用同一份色调表 */
const CAL_LEGEND: { tone: keyof typeof CAL_TONE; label: string }[] = [
  { tone: 'good', label: 'ui.log.calLegendGood' },
  { tone: 'bad', label: 'ui.log.calLegendBad' },
  { tone: 'grim', label: 'ui.log.calLegendGrim' },
  { tone: 'neutral', label: 'ui.log.calLegendNeutral' },
];

/** 格子里最多画几个点（超过就只截前几个，条数在右侧选中日里读得到） */
const MAX_DOTS = 6;

export function ArtLogPanel({ run }: { run: RunState }) {
  const setOverlay = useGame((s) => s.setOverlay);
  const toast = useGame((s) => s.toast);
  const [closing, setClosing] = useState(false);
  /** 玩家点中的日子；null＝还没点过，跟随最新有记录的一天 */
  const [sel, setSel] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const close = () => {
    if (closing) return;
    setClosing(true);
    timer.current = window.setTimeout(() => setOverlay(null), SHEET_OUT_MS);
  };

  // 按 run.log 引用缓存分组：面板打开期间的其他 set（toast 等）不再重建 Map
  const { byDay, newest } = useMemo(() => {
    const map = new Map<number, LogEntry[]>();
    for (const l of run.log ?? []) {
      const arr = map.get(l.day) ?? [];
      arr.push(l);
      map.set(l.day, arr);
    }
    let top: number | null = null;
    for (const d of map.keys()) if (top === null || d > top) top = d;
    return { byDay: map, newest: top };
  }, [run.log]);

  const today = run.day;
  const active = sel ?? newest ?? today;
  const activeEntries = byDay.get(active) ?? [];
  /** 栅格从第 1 天排到今天，一天一格 */
  const days = useMemo(() => Array.from({ length: Math.max(0, today) }, (_, i) => i + 1), [today]);
  /** 整行数（七天一行）。纸的高度跟着它长——见 `.art-cal-sheet` 的注释 */
  const rows = Math.max(1, Math.ceil(days.length / 7));
  const week = useMemo(() => tList('ui.log.calWeek'), []);

  const exportText = () => {
    const lines = (run.log ?? []).map((l) => t('ui.log.line', { n: l.day, text: l.text }));
    const text = `${t('ui.log.exportTitle')}\n${t('ui.log.exportSeed', { n: run.seed })}\n\n${lines.join('\n\n')}`;
    navigator.clipboard?.writeText(text);
    toast(t('ledger.toast.diaryCopied'), 'good');
  };

  return (
    <div
      className={`art-cal-veil${closing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('ui.log.title')}
    >
      <div className="art-cal-room" style={{ backgroundImage: `url(${ART.sceneHomeDesk})` }} aria-hidden />

      <div className="art-cal-sheet" style={{ '--cal-rows': rows } as CSSProperties}>
        <div className="art-cal-paper" style={{ backgroundImage: `url(${ART.todoPaper})` }} aria-hidden />

        <div className="art-cal-frame">
          <span className="art-paper-tick is-tl" aria-hidden />
          <span className="art-paper-tick is-tr" aria-hidden />
          <span className="art-paper-tick is-bl" aria-hidden />
          <span className="art-paper-tick is-br" aria-hidden />

          <header className="art-cal-head">
            <div className="art-cal-headmain">
              <h2 className="art-cal-title">{t('ui.log.title')}</h2>
              <p className="art-cal-sub">
                {t('ui.log.subtitle')} · {t('ui.log.calRange', { a: 1, b: today })}
              </p>
            </div>
            <button type="button" className="art-cal-close" onClick={close}>
              {t('ui.common.close')}
              <span aria-hidden>✕</span>
            </button>
          </header>

          <div className="art-cal-body">
            <div className="art-cal-left">
              {/* 星期的设定里没写死，这里按「第 1 天 = 周一」排 —— 七天一行的栅格
                  要有一行表头才读得出是日历，否则只是一张数字表。 */}
              <div className="art-cal-wk" aria-hidden>
                {week.map((w, i) => (
                  <span key={i} className={i >= 5 ? 'is-rest' : undefined}>
                    {w}
                  </span>
                ))}
              </div>

              <div className="art-cal-gridwrap">
                <div className="art-cal-grid">
                  {days.map((d) => {
                    const entries = byDay.get(d) ?? [];
                    const past = d < today;
                    const isToday = d === today;
                    const cls =
                      'art-cal-cell' +
                      (past ? ' is-past' : '') +
                      (isToday ? ' is-today' : '') +
                      (d === active ? ' is-sel' : '') +
                      (entries.length > 0 ? ' is-booked' : '');
                    return (
                      <button
                        type="button"
                        key={d}
                        className={cls}
                        onClick={() => setSel(d)}
                        aria-pressed={d === active}
                        aria-label={
                          entries.length > 0
                            ? `${t('ui.common.dayN', { n: d })} · ${t('ui.log.calCount', { n: entries.length })}`
                            : t('ui.common.dayN', { n: d })
                        }
                      >
                        <span className="art-cal-num num">{d}</span>
                        {d < TIME.COLLAPSE_DAY && (
                          <span className="art-cal-tag">{t('ui.log.calPrepTag', { n: TIME.PREP_DAYS - d + 1 })}</span>
                        )}
                        {entries.length > 0 && (
                          <span className="art-cal-dots" aria-hidden>
                            {entries.slice(0, MAX_DOTS).map((l, i) => (
                              <i key={i} style={{ background: CAL_TONE[l.tone] ?? CAL_TONE.neutral }} />
                            ))}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="art-cal-legend">
                {CAL_LEGEND.map(({ tone, label }) => (
                  <span className="art-cal-lg" key={tone}>
                    <i style={{ background: CAL_TONE[tone] }} />
                    {t(label)}
                  </span>
                ))}
              </div>
            </div>

            <div className="art-cal-side">
              <div className="art-cal-sidehead">
                <span className="art-cal-sidenum num">{t('ui.common.dayN', { n: active })}</span>
                {active < TIME.COLLAPSE_DAY && (
                  <span className="art-cal-sidetag">{t('ui.log.calPrepTag', { n: TIME.PREP_DAYS - active + 1 })}</span>
                )}
                {active === today && <span className="art-cal-sidetoday">{t('ui.log.calToday')}</span>}
                <span className="art-cal-sidecount">{t('ui.log.calCount', { n: activeEntries.length })}</span>
              </div>

              {sel === null && <p className="art-cal-pick">{t('ui.log.calPick')}</p>}

              {activeEntries.length === 0 ? (
                <p className="art-cal-none">{t('ui.log.calEmptyDay')}</p>
              ) : (
                <ul className="art-cal-items">
                  {activeEntries.map((l, i) => (
                    <li key={i} style={{ borderColor: CAL_TONE[l.tone] ?? CAL_TONE.neutral }}>
                      {l.text}
                    </li>
                  ))}
                </ul>
              )}

              <button type="button" className="art-cal-copy" onClick={exportText}>
                {t('ui.log.copy')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
