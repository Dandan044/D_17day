import { COLD, POWER, TIME } from '../game/balance';
import { MODULE_IDS } from '../game/content/modules';
import { t } from '../game/copy/t';
import { WEATHER_NAME } from '../game/engine/world';
import { canElectricHeat } from '../game/engine/climate';
import {
  LOAD_NAME,
  computePower,
  heaterDrawKwh,
  loadWanted,
  mergedPriority,
  potentialDrawKwh,
} from '../game/engine/power';
import { useGame } from '../game/store';
import type { ModuleId, PowerLoadId, RunState } from '../game/types';
import { Chip, Modal, SectionLabel } from './kit';

export function PowerPanel({ run }: { run: RunState }) {
  const { setOverlay, setPowerPriority, togglePowerLoad } = useGame();
  const power = computePower(run);
  const order = mergedPriority(run).filter((id) => {
    if (id === 'lights' || id === 'fridge') return true;
    if (id === 'heater') return canElectricHeat(run);
    if ((MODULE_IDS as readonly string[]).includes(id)) {
      const level = run.modules[id as ModuleId] ?? 0;
      if (level <= 0) return false;
      return potentialDrawKwh(run, id) > 0;
    }
    return false;
  });
  const isPrep = run.day < TIME.COLLAPSE_DAY;
  const disasterName = run.world.disaster === 'nuclear' ? t('ui.power.nuclear') : t('ui.power.disasterGeneric');

  const move = (id: PowerLoadId, dir: -1 | 1) => {
    const full = mergedPriority(run);
    const i = full.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= full.length) return;
    const next = full.slice();
    const a = next[i]!;
    next[i] = next[j]!;
    next[j] = a;
    setPowerPriority(next);
  };

  return (
    <Modal
      title={t('ui.power.title')}
      subtitle={t('ui.power.subtitle')}
      onClose={() => setOverlay(null)}
      width="max-w-2xl"
    >
      <div className="mb-3 border-l-2 border-line2 bg-ink px-3 py-2 text-[12px] leading-relaxed text-dim">
        {isPrep && <div className="mb-1 text-safehi">{t('ui.power.gridOk')}</div>}
        <div>
          {t('ui.power.solar', {
            base: power.solarBase.toFixed(1),
            weather: WEATHER_NAME[run.world.weather],
            mult: power.weatherMult.toFixed(2),
          })}
          {!isPrep && power.disasterMult !== 1
            ? t('ui.power.disaster', { name: disasterName, mult: power.disasterMult.toFixed(2) })
            : ''}
          {t('ui.power.eq')}
          <span className="num text-paper">{t('ui.power.kwh', { n: power.solar.toFixed(2) })}</span>
        </div>
        {power.grid > 0 && <div>{t('ui.power.grid', { n: power.grid.toFixed(1) })}</div>}
        {(power.batteryStored > 0 || power.batteryCap > 0) && (
          <div>
            {t('ui.power.batt', { stored: power.batteryStored.toFixed(1), cap: power.batteryCap })}
            {power.battery > 0 ? t('ui.power.discharge', { n: power.battery.toFixed(1) }) : ''}
            {power.batteryGain > 0 ? t('ui.power.charge', { n: power.batteryGain.toFixed(1) }) : ''}
          </div>
        )}
        {run.modules.power >= 3 && (
          <div>
            {power.generator > 0
              ? t('ui.power.dieselOn', { gen: power.generator.toFixed(1), fuel: power.fuelBurn.toFixed(1) })
              : t('ui.power.dieselIdle')}
          </div>
        )}
        <div className="mt-1">
          {t('ui.power.tonight')}
          <span className="num text-paper">{power.output.toFixed(1)}</span>
          {t('ui.power.demand')}
          <span className="num text-paper">{power.demand.toFixed(1)}</span> kWh
        </div>
      </div>

      <SectionLabel>{t('ui.power.table')}</SectionLabel>
      <div className="space-y-1.5">
        {order.map((id, idx) => {
          const draw = power.draws.find((d) => d.id === id);
          let kwh = draw?.kwh ?? potentialDrawKwh(run, id);
          if (id === 'heater') kwh = draw?.kwh ?? heaterDrawKwh(run);
          if (kwh <= 0) {
            if (id === 'lights') kwh = POWER.LIGHTS_KWH;
            else if (id === 'fridge') kwh = POWER.FRIDGE_KWH;
          }
          const wanted = loadWanted(run, id);
          const online = wanted && !power.offline.includes(id);
          return (
            <div key={id} className="panel flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="num w-5 text-[11px] text-faint">{idx + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[13px] text-paper">{LOAD_NAME[id]}</span>
                  <span className="num text-[11px] text-dim">{t('ui.power.kwh', { n: kwh.toFixed(2) })}</span>
                  {wanted ? (
                    <Chip tone={online ? 'good' : 'bad'}>{online ? t('ui.power.on') : t('ui.power.off')}</Chip>
                  ) : (
                    <Chip>{t('ui.power.closed')}</Chip>
                  )}
                </div>
                {id === 'lights' && <div className="text-[11px] text-faint">{t('ui.power.lights')}</div>}
                {id === 'fridge' && <div className="text-[11px] text-faint">{t('ui.power.fridge')}</div>}
                {id === 'heater' && (
                  <div className="text-[11px] text-faint">
                    {t('ui.power.heater', {
                      n: run.heatTarget ?? COLD.COMFORT,
                      kwh: kwh.toFixed(1),
                    })}
                  </div>
                )}
                {id === 'airFilter' && <div className="text-[11px] text-faint">{t('ui.power.air')}</div>}
                {id === 'radio' && <div className="text-[11px] text-faint">{t('ui.power.radio')}</div>}
              </div>
              <div className="flex shrink-0 gap-1">
                <button className="btn btn-ghost px-2 py-0.5 text-[10px]" disabled={idx === 0} onClick={() => move(id, -1)}>
                  {t('ui.common.up')}
                </button>
                <button
                  className="btn btn-ghost px-2 py-0.5 text-[10px]"
                  disabled={idx === order.length - 1}
                  onClick={() => move(id, 1)}
                >
                  {t('ui.common.down')}
                </button>
                <button
                  className={`btn px-2 py-0.5 text-[10px] ${wanted ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => togglePowerLoad(id, !wanted)}
                >
                  {wanted ? t('ui.common.yes') : t('ui.common.no')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
