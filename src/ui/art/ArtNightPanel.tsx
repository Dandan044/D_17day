import { useEffect, useRef, useState } from 'react';

import { THREAT_DESC, TIME } from '../../game/balance';
import { t } from '../../game/copy/t';
import { siteOf } from '../../game/content/lookup';
import { useGame } from '../../game/store';
import type { RunState } from '../../game/types';
import { FigExposure, FigHpWaterfall, FigLedger, FigNotes, FigTemp } from './NightFigures';
import { ART } from './skin';
import './art.css';

/**
 * 过夜：点床之后的那一晚。
 *
 * 进入方式与呈现必须互相解释——热点是床，所以整屏就是床边那一晚：
 * 床头的近景在景深之外虚焦着，一层冷灰蓝的记录纸铺在上面，当晚的结算逐条写在纸上。
 *
 * **四块图解**（`NightFigures.tsx`）＋**按 icon 归栏的附注**取代了原来那列平铺的文字：
 * 生命瀑布 / 消耗对账 / 夜间温度 / 暴露度。原件逐条降为图下的附注，一条不删：
 * 周报 / 结算条目（含 ValueIcon）/ 身体（瀑布分段 + 健康批注）/ 环境三针 / 油电对账 /
 * 三个大数（生命·理智·暴露度，含增减）/ 死亡与死因 / 底部主按钮三态。
 *
 * 为什么另起一个文件，而不是把 `NightReportModal` 改掉：那个 Modal 挂在两皮肤**共用**的
 * 浮层出口上（`App.tsx` 里只写了一次），改本体就会连带改掉经典皮肤。这里只复制它的
 * 字段与分支，换一套纸面 DOM 与墨色——**逐字段等价，不是简化版**。
 *
 * 纸上墨色见 art.css 的 `.art-paper-veil`（冷灰蓝纸那套 `--pp-*`）：深色 UI 的琥珀与告警
 * 在浅冷纸上没有对比度，语义色整体换到墨色系（朱红=坏、墨绿=好、墨蓝=信息）。
 *
 * 准备期（`isPrep`）不出后三块：温度、油电、暴露度那几项**字段本身就没产出**
 * （`endDay` 只在灾后写它们），画一张没有数据的图比不画更糟。
 */

const SHEET_OUT_MS = 240;

export function ArtNightPanel({ run }: { run: RunState }) {
  const nightReport = useGame((s) => s.nightReport);
  const dismissNight = useGame((s) => s.dismissNight);
  const [closing, setClosing] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  if (!nightReport) return null;
  const r = nightReport;
  const site = siteOf(run.siteId);
  const isPrep = r.day < TIME.COLLAPSE_DAY;
  // 瀑布只在有分段时出：没有 hpParts 就没有「昨夜 → 今晨」可画。
  // ⚠️ 但**身体附注不能跟着一起藏** —— 那一夜可能一处 HP 增减都没有、却照样恶化了某个病
  //    （`healthNotes` 与 `hpParts` 是两个独立数组）。所以身体那一节按两者之或来渲染。
  const hasFall = !isPrep && (r.hpParts ?? []).length > 0;
  const hasBody = hasFall || r.healthNotes.length > 0;

  /** 关：先播 240ms 出场，再真的清掉 nightReport（照 ArtShelterPanel 的做法，
   *  否则纸还没飞走，浮层就已经被卸掉了）。 */
  const close = () => {
    if (closing) return;
    setClosing(true);
    timer.current = window.setTimeout(() => dismissNight(), SHEET_OUT_MS);
  };

  /** LedgerNote.tone 是可选的（undefined = 中性），所以这里收可选参数。 */
  const toneOf = (tone?: string) => (tone === 'good' ? ' is-good' : tone === 'bad' ? ' is-bad' : '');

  return (
    <div
      className={`art-paper-veil is-nt${closing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('ui.night.title', { n: r.day })}
    >
      <div className="art-paper-room" style={{ backgroundImage: `url(${ART.sceneNightBed})` }} aria-hidden />

      <div className="art-paper-sheet">
        <div className="art-paper" style={{ backgroundImage: `url(${ART.nightPaper})` }} aria-hidden />

        <div className="art-paper-frame">
          <span className="art-paper-tick is-tl" aria-hidden />
          <span className="art-paper-tick is-tr" aria-hidden />
          <span className="art-paper-tick is-bl" aria-hidden />
          <span className="art-paper-tick is-br" aria-hidden />

          <header className="art-paper-head">
            <div className="art-paper-headmain">
              <div className="art-paper-kicker">
                <span className="art-paper-stamp num">{t('ui.night.sheetNo', { n: r.day })}</span>
                <span>{t('ui.night.sheet')}</span>
              </div>
              <h2 className="art-paper-title">{t('ui.night.title', { n: r.day })}</h2>
              <p className="art-paper-sub">
                {isPrep ? t('ui.night.leftover', { n: TIME.PREP_DAYS - r.day }) : THREAT_DESC[run.threat]}
              </p>
            </div>

            <div className="art-paper-headside">
              <span className="art-paper-seal" aria-hidden>
                夜
              </span>
              <button type="button" className="art-paper-close" onClick={close}>
                {t('ui.common.close')}
                <span aria-hidden>✕</span>
              </button>
            </div>
          </header>

          <div className="art-paper-body">
            {r.weekly && (
              <section className="art-nt-week">
                <div className="art-nt-weektitle">{t('ui.night.week')}</div>
                <p className="art-nt-weekbody">
                  {t('ui.night.weekBody', { n: run.threat, desc: THREAT_DESC[run.threat] })}
                </p>
              </section>
            )}

            {/* ---- 图解区 ---- */}
            {hasBody && (
              <section className="art-paper-sec is-hp">
                <div className="art-paper-sechead">
                  <span>{t('ui.night.figHpTitle')}</span>
                  <i />
                  {/* 生命与理智都是「这一夜之后的身体结果」，理智没有图，就在这行的右端报个数。
                      暴露度不在这儿：它有自己的图解（第 4 块），报两遍就是冗余。 */}
                  <span className="art-nf-headread num" data-hp={r.hpAfter ?? 0} data-sanity={Math.round(run.stats.sanity)}>
                    {t('ui.night.sanity')} {Math.round(run.stats.sanity)}
                    {hasFall && <b className="art-nf-headhp">{t('ui.night.hp')} {r.hpAfter ?? 0}</b>}
                    {hasFall && (r.hpDelta ?? 0) !== 0 && (
                      <em className={`art-nf-headdelta num${(r.hpDelta ?? 0) > 0 ? ' is-good' : ' is-bad'}`}>
                        {(r.hpDelta ?? 0) > 0 ? '+' : ''}
                        {r.hpDelta}
                      </em>
                    )}
                  </span>
                </div>
                {hasFall ? <FigHpWaterfall r={r} /> : <p className="art-nf-flat">{t('ui.night.figHpFlat')}</p>}
                {r.healthNotes.length > 0 && (
                  <div className="art-nf-notes is-single">
                    {r.healthNotes.map((n, i) => (
                      <p key={i} className={`art-nf-noterow${toneOf(n.tone)}`}>
                        <span className="art-nf-notemk" aria-hidden>
                          ·
                        </span>
                        <span>{n.text}</span>
                      </p>
                    ))}
                  </div>
                )}
              </section>
            )}

            {!isPrep && (
              <div className="art-nf-figs">
                <section className="art-paper-sec is-res">
                  <div className="art-paper-sechead">
                    <span>{t('ui.night.figResTitle')}</span>
                    <i />
                  </div>
                  <FigLedger run={run} r={r} />
                </section>

                {/* 温度计条高、占右栏整列；对账与暴露度都不高，叠在左栏 ——
                    把暴露度塞进右栏会让右栏比左栏高出一大截，白白撑高整屏。 */}
                <section className="art-paper-sec is-temp">
                  <div className="art-paper-sechead">
                    <span>{t('ui.night.figTempTitle')}</span>
                    <i />
                  </div>
                  <FigTemp run={run} r={r} />
                </section>

                <section className="art-paper-sec is-eye">
                  <div className="art-paper-sechead">
                    <span>{t('ui.night.figEyeTitle')}</span>
                    <i />
                  </div>
                  <FigExposure run={run} r={r} />
                </section>
              </div>
            )}

            {/* ---- 按 icon 归栏的附注：原文逐条保留 ---- */}
            <section className="art-paper-sec is-notes">
              <div className="art-paper-sechead">
                <span>{t('ui.night.settle')}</span>
                <i />
                <em className="num">{r.notes.length}</em>
              </div>
              <FigNotes notes={r.notes} />
            </section>

            {r.died && (
              <section className="art-nt-died">
                {t('ui.night.died')}
                {r.cause ? t('ui.night.cause', { cause: r.cause }) : ''}
              </section>
            )}
          </div>

          <footer className="art-paper-tb">
            <div className="art-paper-tbcell is-wide">
              <span className="art-paper-tbk">{t('ui.sheet.record')}</span>
              <span className="art-paper-tbv">{t('ui.night.sheet')}</span>
            </div>
            <div className="art-paper-tbcell">
              <span className="art-paper-tbk">{t('ui.sheet.site')}</span>
              <span className="art-paper-tbv">{site.name}</span>
            </div>
            <div className="art-paper-tbcell">
              <span className="art-paper-tbk">{t('ui.sheet.code')}</span>
              <span className="art-paper-tbv num">{site.codename}</span>
            </div>
            <div className="art-paper-tbcell">
              <span className="art-paper-tbk">{t('ui.sheet.date')}</span>
              <span className="art-paper-tbv num">
                {isPrep ? `D-${TIME.PREP_DAYS - r.day + 1}` : t('ui.common.dayN', { n: r.day })}
              </span>
            </div>
            <div className="art-paper-tbcell">
              <span className="art-paper-tbk">{t('ui.sheet.threat')}</span>
              <span className="art-paper-tbv num">{t('ui.common.lvl', { n: run.threat })}</span>
            </div>
          </footer>

          <button type="button" className="art-paper-act" onClick={close}>
            {r.died ? t('ui.common.settle') : r.collapsed ? t('ui.night.ellipsis') : t('ui.night.enter', { n: r.day + 1 })}
          </button>
        </div>
      </div>
    </div>
  );
}
