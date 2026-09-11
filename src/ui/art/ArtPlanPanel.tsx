import { useEffect, useRef, useState } from 'react';

import { TIME } from '../../game/balance';
import { t } from '../../game/copy/t';
import { SITE_BY_ID } from '../../game/content/sites';
import { useGame } from '../../game/store';
import type { RunState } from '../../game/types';
import { BodyPanel, ExposurePanel, SuppliesPanel } from '../Game';
import { Modal } from '../kit';
import { PlanHeatColumn, PlanPowerColumn, PlanRationColumn } from './ArtPlanSheet';
import { ART } from './skin';
import './art.css';

/**
 * 今日计划：桌面上那张宽横纸，摊开来是一张「睡前安排」计划表。
 *
 * 入口是并排躺在笔记本右边的那张扁纸（354×105，比本子更宽更扁），所以整屏是一张横向表单：
 * 左栅配给 / 中栅取暖 / 右栅供电，底下一行图签。纸与逻辑都刻意与避难所图纸同族
 * （同一抽屉里的公文纸），但本子是另一套冷色纸——两张纸不能撞车。
 *
 * 三栅内容在 ArtPlanSheet.tsx 里**重新实现**（不复用经典皮肤的 RationPanel/PowerPanel，
 * 那两个组件同时挂在经典三栏布局与经典供电浮层上，改本体就会带偏经典皮肤）。
 */

const SHEET_OUT_MS = 240;

export function ArtPlanPanel({ run }: { run: RunState }) {
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
    timer.current = window.setTimeout(() => setOverlay(null), SHEET_OUT_MS);
  };

  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  const isPrep = run.day < TIME.COLLAPSE_DAY;

  return (
    <div
      className={`art-pl-veil${closing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('ui.game.planTitle')}
    >
      <div className="art-pl-room" style={{ backgroundImage: `url(${ART.sceneHomeDesk})` }} aria-hidden />

      <div className="art-pl-sheet">
        <div className="art-pl-paper" style={{ backgroundImage: `url(${ART.planPaper})` }} aria-hidden />

        <div className="art-pl-frame">
          <header className="art-pl-head">
            <span className="art-pl-stamp num">{t('ui.plan.tbNoValue')}</span>
            <div className="art-pl-headmain">
              <h2 className="art-pl-title">{t('ui.game.planTitle')}</h2>
              <p className="art-pl-sub">
                {t('ui.plan.sheetKicker')} · {site.name}
              </p>
            </div>
            <button type="button" className="art-pl-close" onClick={close}>
              {t('ui.common.close')}
              <span aria-hidden>✕</span>
            </button>
          </header>

          <div className="art-pl-body">
            <div className="art-pl-cols">
              <PlanRationColumn run={run} />
              <PlanHeatColumn run={run} />
              <PlanPowerColumn run={run} />
            </div>
          </div>

          <footer className="art-pl-tb">
            <div className="art-pl-tbcell">
              <span className="art-pl-tbk">{t('ui.plan.tbSite')}</span>
              <span className="art-pl-tbv">{site.name}</span>
            </div>
            <div className="art-pl-tbcell">
              <span className="art-pl-tbk">{t('ui.plan.tbDate')}</span>
              <span className="art-pl-tbv num">
                {isPrep ? `D-${TIME.PREP_DAYS - run.day + 1}` : t('ui.common.dayN', { n: run.day })}
              </span>
            </div>
            <div className="art-pl-tbcell">
              <span className="art-pl-tbk">{t('ui.plan.tbAp')}</span>
              <span className="art-pl-tbv num">
                {run.ap} / {run.apMax}
              </span>
            </div>
            <div className="art-pl-tbcell">
              <span className="art-pl-tbk">{t('ui.plan.tbNo')}</span>
              <span className="art-pl-tbv num">{t('ui.plan.tbNoValue')}</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

export function ArtBodyPanel({ run }: { run: RunState }) {
  const setOverlay = useGame((s) => s.setOverlay);
  const isPrep = run.day < TIME.COLLAPSE_DAY;
  return (
    <Modal title={t('ui.game.body')} onClose={() => setOverlay(null)} width="max-w-lg">
      <BodyPanel run={run} />
      {!isPrep && (
        <div className="mt-3">
          <ExposurePanel run={run} />
        </div>
      )}
    </Modal>
  );
}

export function ArtSuppliesPanel({ run }: { run: RunState }) {
  const setOverlay = useGame((s) => s.setOverlay);
  const cap = SITE_BY_ID[run.siteId ?? 'apartment']?.companionCap ?? 0;
  return (
    <Modal title={t('ui.game.supplies')} onClose={() => setOverlay(null)} width="max-w-lg">
      <SuppliesPanel run={run} />
      {cap > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <button className="btn btn-ghost w-full py-1.5 text-[11.5px]" onClick={() => setOverlay('crew')}>
            {t('ui.crew.title')}
          </button>
        </div>
      )}
    </Modal>
  );
}
