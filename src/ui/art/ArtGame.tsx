import { useEffect, useState } from 'react';

import { RAD, TIME } from '../../game/balance';
import { t } from '../../game/copy/t';
import { currentIndoor } from '../../game/engine/climate';
import { effectiveModule, iodineActive, radiationShield, threatName } from '../../game/engine/tags';
import { WEATHER_NAME } from '../../game/engine/world';
import { useGame } from '../../game/store';
import EventCard from '../EventCard';
import { cachedPower } from '../derived';
import { Chip } from '../kit';
import { ArtCutout, ArtSceneFrame } from './ArtHotspot';
import { ART, CUT_HOME, WIN_GLASS, hideBrokenImg, windowArt } from './skin';
import './art.css';

type View = 'desk' | 'side';

export default function ArtGame() {
  const run = useGame((s) => s.run);
  const overlay = useGame((s) => s.overlay);
  const setOverlay = useGame((s) => s.setOverlay);
  const rest = useGame((s) => s.rest);
  const endDay = useGame((s) => s.endDay);
  const goMenu = useGame((s) => s.goMenu);
  const toast = useGame((s) => s.toast);

  const [view, setView] = useState<View>('desk');
  const [leaving, setLeaving] = useState<View | null>(null);
  const [zoomEvent, setZoomEvent] = useState(false);

  useEffect(() => {
    if (run && run.queue.length === 0) setZoomEvent(false);
  }, [run]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && zoomEvent && !overlay) setZoomEvent(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomEvent, overlay]);

  if (!run) return null;

  const isPrep = run.day < TIME.COLLAPSE_DAY;
  const mustRead = run.queue.length > 0;
  const noAp = run.ap <= 0;
  const indoorNow = currentIndoor(run);
  const power = cachedPower(run);
  const shield = radiationShield(run);
  const tol = RAD.SHIELD_TOLERANCE[shield] ?? RAD.SHIELD_TOLERANCE[0]!;
  const airLv = run.modules.airFilter;
  const locked = mustRead && !zoomEvent;
  const shelterPulse = run.projects.length > 0 || (run.wear.filterLife <= 0 && (run.modules.filter > 0 || run.modules.airFilter > 0));

  const act = (fn: () => void) => {
    if (mustRead) {
      toast(t('ui.game.mustRead'), 'bad');
      return;
    }
    fn();
  };

  const goSide = () => {
    if (view !== 'desk' || leaving) return;
    setLeaving('desk');
    window.setTimeout(() => {
      setView('side');
      setLeaving(null);
    }, 420);
  };

  const goDesk = () => {
    if (view !== 'side' || leaving) return;
    setLeaving('side');
    window.setTimeout(() => {
      setView('desk');
      setLeaving(null);
    }, 420);
  };

  const onNotebook = () => {
    if (run.queue.length === 0) {
      toast(t('ui.game.noEvent'), 'neutral');
      return;
    }
    setZoomEvent(true);
  };

  const onBed = () => {
    if (mustRead) {
      toast(t('ui.game.mustRead'), 'bad');
      return;
    }
    if (noAp) endDay();
    else rest();
  };

  return (
    <div className="art-root">
      <div className="art-grain" />

      <div
        className={`art-scene ${view === 'desk' && !leaving ? 'is-on' : ''} ${leaving === 'desk' ? 'is-slide-away' : ''} ${zoomEvent ? 'is-zoom-nb' : ''}`}
      >
        <ArtSceneFrame src={ART.sceneHomeDesk}>
          <img
            className="art-win-glass"
            style={WIN_GLASS}
            src={windowArt(run.world.weather, isPrep)}
            alt=""
            decoding="async"
            onError={hideBrokenImg}
          />
          <ArtCutout
            {...CUT_HOME.window}
            src={ART.cutHWindow}
            label={WEATHER_NAME[run.world.weather]}
            sub={t('ui.game.outdoor', { out: run.world.temperature, in: indoorNow })}
          />
          <ArtCutout
            {...CUT_HOME.blueprint}
            src={ART.cutHBlueprint}
            label={t('ui.game.buildTitle')}
            sub={t('ui.common.ap', { n: 1 })}
            pulse={!locked && shelterPulse}
            locked={locked}
            onClick={() => act(() => setOverlay('shelter'))}
          />
          <ArtCutout
            {...CUT_HOME.notebook}
            src={ART.cutHNotebook}
            label={t('ui.game.eventPeek')}
            sub={mustRead ? t('ui.event.more', { n: Math.max(0, run.queue.length - 1) }) : undefined}
            pulse={mustRead}
            onClick={onNotebook}
          />
          <ArtCutout
            {...CUT_HOME.plan}
            src={ART.cutHPlan}
            label={t('ui.game.planTitle')}
            pulse={false}
            locked={locked}
            onClick={() => act(() => setOverlay('plan'))}
          />
          <ArtCutout {...CUT_HOME.clock} src={ART.cutHClock} label={t('ui.game.ap')} />
          <div className="art-hud art-hud-clock" style={CUT_HOME.clock}>
            <div className="art-hud-day">
              {isPrep ? `D-${TIME.PREP_DAYS - run.day + 1}` : run.day}
            </div>
            <div className="art-hud-ap" aria-label={t('ui.game.ap')}>
              {Array.from({ length: run.apMax }).map((_, i) => (
                <span key={i} className={`art-hud-ap-pip${i < run.ap ? ' is-on' : ''}`} />
              ))}
            </div>
          </div>
          <ArtCutout
            {...CUT_HOME.radio}
            src={ART.cutHRadio}
            label={isPrep ? t('ui.game.intelPrep') : t('ui.game.intelLive')}
            locked={locked}
            onClick={() => act(() => setOverlay('intel'))}
          />
          <div className="art-hud art-hud-sill" style={WIN_GLASS}>
            <span>
              {WEATHER_NAME[run.world.weather]} · {t('ui.game.outdoor', { out: run.world.temperature, in: indoorNow })}
            </span>
            {!isPrep && (
              <span className="art-hud-sill-chips">
                <Chip>{t('ui.common.threatLv', { n: run.threat })}</Chip>
                <Chip>{threatName(run.threat)}</Chip>
                {run.world.radiation > 8 && (
                  <Chip tone={run.world.radiation > tol ? 'bad' : 'warn'}>
                    {t('ui.game.rad', { n: Math.round(run.world.radiation), tol })}
                  </Chip>
                )}
                {airLv > 0 && effectiveModule(run, 'airFilter', power) === 0 && (
                  <Chip tone="bad">{t('ui.game.filterOff')}</Chip>
                )}
                {iodineActive(run) && <Chip tone="good">{t('ui.game.iodine')}</Chip>}
                {run.world.airPollution > 30 && <Chip tone="warn">{t('ui.game.air', { n: Math.round(run.world.airPollution) })}</Chip>}
                {run.world.contagion > 20 && <Chip tone="psyche">{t('ui.game.contagion', { n: Math.round(run.world.contagion) })}</Chip>}
                {run.world.lawOrder < 45 && <Chip tone="bad">{t('ui.game.law', { n: Math.round(run.world.lawOrder) })}</Chip>}
              </span>
            )}
          </div>
          {run.projects.length > 0 && (
            <div className="art-hud art-hud-mark" style={CUT_HOME.blueprint}>
              {t('ui.game.buildingShort')} {run.projects.length}
            </div>
          )}
        </ArtSceneFrame>
      </div>

      <div
        className={`art-scene ${view === 'side' && !leaving ? 'is-on' : ''} ${leaving === 'side' ? 'is-slide-away' : ''} ${view === 'side' && !leaving ? 'is-side-in' : ''}`}
      >
        <ArtSceneFrame src={ART.sceneHomeSide}>
          <ArtCutout
            {...CUT_HOME.bed}
            src={ART.cutHBed}
            label={noAp ? t('ui.game.restEnd') : t('ui.game.restNow')}
            sub={noAp ? t('ui.game.noAp') : t('ui.common.ap', { n: 1 })}
            pulse={!locked && noAp}
            locked={locked}
            onClick={onBed}
          />
          <ArtCutout
            {...CUT_HOME.medkit}
            src={ART.cutHMedkit}
            label={t('ui.game.body')}
            pulse={!locked && run.conditions.length > 0}
            locked={locked}
            onClick={() => act(() => setOverlay('body'))}
          />
          <ArtCutout
            {...CUT_HOME.door}
            src={ART.cutHDoor}
            label={isPrep ? t('ui.game.buyTitle') : t('ui.game.scavTitle')}
            sub={t('ui.common.ap', { n: 1 })}
            locked={locked}
            onClick={() => act(() => setOverlay('map'))}
          />
          <ArtCutout
            {...CUT_HOME.shelf}
            src={ART.cutHShelf}
            label={t('ui.game.supplies')}
            pulse={!locked && run.wear.filterLife <= 0 && (run.modules.filter > 0 || run.modules.airFilter > 0)}
            locked={locked}
            onClick={() => act(() => setOverlay('supplies'))}
          />
        </ArtSceneFrame>
      </div>

      {view === 'desk' && !zoomEvent && (
        <button type="button" className="art-next art-turn-left" onClick={goSide}>
          <svg className="art-next-arrow" viewBox="0 0 48 96" aria-hidden>
            <path d="M10 8 L38 48 L10 88" />
          </svg>
          <span>{t('ui.game.turnSide')}</span>
        </button>
      )}
      {view === 'side' && (
        <button type="button" className="art-next" onClick={goDesk}>
          <svg className="art-next-arrow" viewBox="0 0 48 96" aria-hidden>
            <path d="M10 8 L38 48 L10 88" />
          </svg>
          <span>{t('ui.game.turnDesk')}</span>
        </button>
      )}

      {zoomEvent && run.queue.length > 0 && (
        <div className="art-event-layer">
          <div className="art-event-card">
            <EventCard run={run} />
          </div>
          <button type="button" className="art-link art-event-back" onClick={() => setZoomEvent(false)}>
            {t('ui.game.eventBack')}
          </button>
        </div>
      )}

      <div className="art-dock">
        <button type="button" className="art-link" onClick={goMenu}>
          {t('ui.game.menu')}
        </button>
        <button type="button" className="art-link" onClick={() => setOverlay('log')}>
          {t('ui.game.log')}
        </button>
        <button type="button" className="art-link" onClick={() => setOverlay('help')}>
          {t('ui.game.rules')}
        </button>
      </div>
    </div>
  );
}
