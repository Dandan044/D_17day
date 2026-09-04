import { useEffect, useState } from 'react';

import { useGame } from '../game/store';
import { t } from '../game/copy/t';
import { formatSeed } from '../game/rng';
import { ENDINGS } from '../game/content/endings';
import { DISASTERS } from '../game/content/disasters';
import { Chip, Panel } from './kit';

export default function MainMenu() {
  const { run, meta, goSetup, setOverlay, toast, abandonRun } = useGame();
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  useEffect(() => {
    if (!confirmAbandon) return;
    const timer = setTimeout(() => setConfirmAbandon(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmAbandon]);

  return (
    <div className="relative flex h-full items-center justify-center overflow-y-auto p-6">
      <div className="relative z-10 w-full max-w-3xl">
        <div className="mb-10 text-center">
          <div className="label mb-3 text-amberdim">{t('ui.menu.kicker')}</div>
          <h1
            className="title-stamp text-5xl font-bold text-paper sm:text-6xl"
            style={{ textShadow: '0 0 28px rgba(224,161,18,0.18)' }}
          >
            {t('ui.menu.title')}
          </h1>
          <div className="mt-3 flex items-center justify-center gap-3">
            <div className="h-px w-12 bg-line2" />
            <span className="title-stamp text-[11px] text-amber">{t('ui.menu.en')}</span>
            <div className="h-px w-12 bg-line2" />
          </div>
          <p className="mx-auto mt-6 max-w-lg text-[13.5px] leading-relaxed text-dim">
            {t('ui.menu.blurb1')}
            <br />
            {t('ui.menu.blurb2')}
            <br />
            {t('ui.menu.blurb3')}
          </p>
        </div>

        <div className="mx-auto max-w-md space-y-2.5">
          {run && run.phase !== 'ended' && (
            <button
              className="btn btn-primary w-full py-3 text-[13px]"
              onClick={() => useGame.setState({ screen: 'game' })}
            >
              {t('ui.menu.resume', { n: run.day })}
            </button>
          )}
          <button className="btn w-full py-3 text-[13px]" onClick={goSetup}>
            {run && run.phase !== 'ended' ? t('ui.menu.restart') : t('ui.menu.start')}
          </button>
          {run && run.phase !== 'ended' && (
            <button
              className={`btn btn-ghost w-full py-2 text-[11.5px] ${confirmAbandon ? 'text-alarmhi' : 'text-faint'}`}
              onClick={() => {
                if (confirmAbandon) {
                  setConfirmAbandon(false);
                  abandonRun();
                  return;
                }
                setConfirmAbandon(true);
              }}
            >
              {confirmAbandon ? t('ui.menu.confirm') : t('ui.menu.abandon')}
            </button>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <button className="btn btn-ghost py-2.5" onClick={() => setOverlay('meta')}>
              {t('ui.menu.meta')}
            </button>
            <button className="btn btn-ghost py-2.5" onClick={() => setOverlay('codex')}>
              {t('ui.menu.codex')}
            </button>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-md">
          <Panel title={t('ui.menu.record')} mark>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="num text-2xl text-amberhi">{meta.relics}</div>
                <div className="label mt-1">{t('ui.menu.relics')}</div>
              </div>
              <div>
                <div className="num text-2xl text-paper">{meta.runsPlayed}</div>
                <div className="label mt-1">{t('ui.menu.runs')}</div>
              </div>
              <div>
                <div className="num text-2xl text-paper">{meta.bestDays}</div>
                <div className="label mt-1">{t('ui.menu.best')}</div>
              </div>
            </div>
            {(meta.seenEndings.length > 0 || meta.seenDisasters.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                <Chip tone="info">{t('ui.menu.seenEnding', { a: meta.seenEndings.length, b: ENDINGS.length })}</Chip>
                <Chip tone="warn">{t('ui.menu.seenDisaster', { a: meta.seenDisasters.length, b: DISASTERS.length })}</Chip>
                <Chip>{t('ui.menu.seenEvent', { n: meta.seenFamilies.length })}</Chip>
              </div>
            )}
          </Panel>
        </div>

        <div className="mt-6 text-center">
          <a className="text-[11px] text-faint underline decoration-dotted hover:text-dim" href="./art.html">
            档案试验版
          </a>
        </div>

        {run && run.phase !== 'ended' && (
          <div className="mt-4 text-center text-[11px] text-faint">
            {t('ui.menu.seed')} <span className="num text-amberdim">{formatSeed(run.seed)}</span>
            <button
              className="ml-2 underline decoration-dotted hover:text-dim"
              onClick={() => {
                navigator.clipboard?.writeText(formatSeed(run.seed));
                toast(t('ledger.toast.seedCopied'), 'good');
              }}
            >
              {t('ui.common.copy')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
