import { useEffect, useState } from 'react';

import { t } from '../../game/copy/t';
import { formatSeed } from '../../game/rng';
import { useGame } from '../../game/store';
import { ArtCutout, ArtSceneFrame } from './ArtHotspot';
import { ART, CUT } from './skin';
import './art.css';

type Scene = 'room' | 'desk';

export default function ArtMainMenu() {
  const { run, meta, goSetup, setOverlay, toast, abandonRun } = useGame();
  const [scene, setScene] = useState<Scene>('room');
  const [leaving, setLeaving] = useState<Scene | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const live = Boolean(run && run.phase !== 'ended');

  useEffect(() => {
    if (!confirmAbandon) return;
    const timer = setTimeout(() => setConfirmAbandon(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmAbandon]);

  const goDesk = () => {
    if (scene !== 'room') return;
    setLeaving('room');
    window.setTimeout(() => {
      setScene('desk');
      setLeaving(null);
    }, 520);
  };

  const goRoom = () => {
    if (scene !== 'desk') return;
    setLeaving('desk');
    window.setTimeout(() => {
      setScene('room');
      setLeaving(null);
    }, 420);
  };

  return (
    <div className="art-root">
      <div className="art-grain" />

      <div
        className={`art-scene ${scene === 'room' && !leaving ? 'is-on' : ''} ${leaving === 'room' ? 'is-zoom-desk' : ''}`}
      >
        <ArtSceneFrame src={ART.sceneRoom}>
          <ArtCutout {...CUT.table} src={ART.cutTable} label="桌子" sub="开始 / 继续" onClick={goDesk} />
          <ArtCutout
            {...CUT.shelves}
            src={ART.cutShelves}
            label={t('ui.menu.codex')}
            sub={t('ui.menu.seenEvent', { n: meta.seenFamilies.length })}
            onClick={() => setOverlay('codex')}
          />
          <ArtCutout
            {...CUT.vending}
            src={ART.cutVending}
            label={t('ui.menu.meta')}
            sub={`${t('ui.menu.relics')} ${meta.relics}`}
            onClick={() => setOverlay('meta')}
          />
        </ArtSceneFrame>
        <div className="art-mark">
          <div className="art-kicker">{t('ui.menu.kicker')}</div>
          <h1 className="art-title mt-2 text-4xl sm:text-5xl">{t('ui.menu.title')}</h1>
          <div className="art-en mt-3">{t('ui.menu.en')}</div>
          <div className="mt-4">
            <a className="art-link" href="./index.html">
              返回经典界面
            </a>
          </div>
        </div>
      </div>

      <div
        className={`art-scene ${scene === 'desk' && !leaving ? 'is-on' : ''} ${leaving === 'desk' ? 'is-zoom-out' : ''} ${scene === 'desk' && !leaving ? 'is-desk-in' : ''}`}
      >
        <ArtSceneFrame src={ART.sceneDesk}>
          <ArtCutout
            {...CUT.notebook}
            src={ART.cutNotebook}
            label={live ? t('ui.menu.restart') : t('ui.menu.start')}
            onClick={goSetup}
          />
          <ArtCutout
            {...CUT.journal}
            src={ART.cutJournal}
            hidden={!live}
            label={t('ui.menu.resume', { n: run?.day ?? 0 })}
            sub={run ? formatSeed(run.seed) : undefined}
            onClick={() => useGame.setState({ screen: 'game' })}
          />
          <ArtCutout
            {...CUT.stamp}
            src={ART.cutStamp}
            hidden={!live}
            label={confirmAbandon ? t('ui.menu.confirm') : t('ui.menu.abandon')}
            onClick={() => {
              if (confirmAbandon) {
                setConfirmAbandon(false);
                abandonRun();
                return;
              }
              setConfirmAbandon(true);
            }}
          />
          {live && run && (
            <button
              type="button"
              className="art-link art-seed"
              onClick={() => {
                navigator.clipboard?.writeText(formatSeed(run.seed));
                toast(t('ledger.toast.seedCopied'), 'good');
              }}
            >
              {t('ui.common.copy')} {formatSeed(run.seed)}
            </button>
          )}
        </ArtSceneFrame>
        <button type="button" className="art-link art-back" onClick={goRoom}>
          退回房间
        </button>
      </div>
    </div>
  );
}
