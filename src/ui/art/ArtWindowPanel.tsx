import { useEffect, useRef, useState } from 'react';

import { TIME } from '../../game/balance';
import { siteOf } from '../../game/content/lookup';
import { t } from '../../game/copy/t';
import { dailyExposure, exposureTier, TIER_DESC, TIER_NAMES } from '../../game/engine/exposure';
import { useGame } from '../../game/store';
import type { RunState } from '../../game/types';
import { EyeFigure } from './EyeFigure';
import { windowArt, windowStageOf } from './skin';
import './art.css';

/**
 * 窗外：暴露度那一屏。
 *
 * ## 为什么要有这一屏
 *
 * 暴露度原本只是身体状况面板里的一条进度条。可它讲的是**外面有多少人知道你在这里**——
 * 那件事的知觉载体不是纸条，是「你在窗户里面，外面有东西在看你」。所以这一屏没有纸：
 * 景深底就是这个天气、这个阶段的**窗景本身**（虚焦 = 它在你玻璃外面），前景是一只眼睛。
 *
 * ## 三层与「眼睛在玻璃外侧」这件事
 *
 * ```
 * ① .art-wn-room   窗景，blur(18px) —— 语义是「窗外」，虚焦就对了
 * ② .art-wn-eye    眼睛
 * ③ .art-wn-sheen  玻璃反光 + 污渍 + 暗角，压在眼睛之上
 * ```
 *
 * 关键是 ③ 在 ② **上面**：反光划过瞳孔时，读到的就是「这只眼睛在玻璃外侧」，
 * 而不是「一张眼睛贴纸贴在玻璃上」。这是这一屏唯一不能省的一层。
 *
 * ## 墨色不复用 `--pp-*`
 *
 * 那组是纸面用的（深墨写在浅纸上）。这一屏是暗底亮字，方向相反，所以另起一组 `--wn-*`。
 * **`--art-serif` 必须重新定义**：浮层挂在 `.art-root` 外面，不继承（先例 `art.css`
 * 里的 `.art-paper-veil` / `.art-pl-veil` / `.art-sh-*`，都各自重定义了一份）。
 *
 * ## 灾前
 *
 * 灾前暴露度还是 0、`dailyExposure` 也没有意义，所以：不显示数值与来源明细，
 * 副标题写「外面」而不是档名（写「无人注意」会让玩家以为面板坏了），正文换成机制说明。
 */

const OUT_MS = 240;

export function ArtWindowPanel({ run }: { run: RunState }) {
  const setOverlay = useGame((s) => s.setOverlay);
  const [closing, setClosing] = useState(false);
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
    timer.current = window.setTimeout(() => setOverlay(null), OUT_MS);
  };

  const site = siteOf(run.siteId);
  const isPrep = run.day < TIME.COLLAPSE_DAY;
  const tier = exposureTier(run.world.exposure);
  const breakdown = dailyExposure(run);

  return (
    <div
      className={`art-wn-veil${closing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('ui.window.title')}
    >
      <div className="art-wn-sheet">
        <div
          className="art-wn-room"
          style={{ backgroundImage: `url(${windowArt(run.world.weather, windowStageOf(run))})` }}
          aria-hidden
        />
        {/* 暗角在正文**下面**（z2）：它上下各压一条暗带，压在正文上会把标题吃掉。
            CSS 里 z 序写死，这里的顺序只为好读。 */}
        <div className="art-wn-vig" aria-hidden />

        <div className="art-wn-body">
          <header className="art-wn-head">
            <div>
              <span className="art-wn-kicker">{t('ui.window.sheet')}</span>
              <h2 className="art-wn-title">{t('ui.window.title')}</h2>
              <p className="art-wn-sub">
                {site.name} · {isPrep ? t('ui.window.subPrep') : t('ui.window.subTier')}
              </p>
            </div>
            <button type="button" className="art-wn-close" onClick={close}>
              {t('ui.common.close')}
              <span aria-hidden>✕</span>
            </button>
          </header>

          <div className="art-wn-eye">
            <EyeFigure tier={tier} size="min(680px, 58vw)" variant="window" />
          </div>

          <div className="art-wn-cap">
            <span className="art-wn-tk">{t('ui.window.tierNow')}</span>
            <span className="art-wn-tv">{TIER_NAMES[tier]}</span>
            {!isPrep && <span className="art-wn-val num">{Math.round(run.world.exposure)}</span>}
          </div>

          <p className="art-wn-desc">{isPrep ? t('ui.window.why') : TIER_DESC[tier]}</p>

          {!isPrep && (
            <div className="art-wn-note">
              <div className="art-wn-nrow is-head">
                <span className="art-wn-nk">{t('ui.window.sources')}</span>
                <span className={`art-wn-nv num${breakdown.total > 0 ? ' is-bad' : ' is-good'}`}>
                  {breakdown.total > 0 ? '+' : ''}
                  {breakdown.total}
                </span>
              </div>
              {breakdown.parts.length === 0 && (
                <div className="art-wn-nrow is-sub">
                  <span className="art-wn-nk">{t('ui.window.none')}</span>
                </div>
              )}
              {breakdown.parts.map((p, i) => (
                <div className="art-wn-nrow is-sub" key={i}>
                  <span className="art-wn-nk">{p.label}</span>
                  <span className={`art-wn-nv num${p.value > 0 ? ' is-bad' : ' is-good'}`}>
                    {p.value > 0 ? '+' : ''}
                    {Math.round(p.value * 10) / 10}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="art-wn-hint">{tier === 0 ? t('ui.eye.hintNone') : t('ui.eye.hint')}</p>
        </div>

        {/* 玻璃反光：压在眼睛之上（z4），这是「眼睛在玻璃外侧」的那一层。 */}
        <div className="art-wn-sheen" aria-hidden />
      </div>
    </div>
  );
}
