import { useId } from 'react';
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
import type { DisasterId, ModuleId, PowerLoadId, RunState, WeatherId } from '../game/types';
import { Chip, Modal, SectionLabel } from './kit';

function disasterFactorLabel(id: DisasterId): string | null {
  if (id === 'nuclear') return t('ui.power.factorNuclear');
  if (id === 'volcanicWinter') return t('ui.power.factorVolcanic');
  if (id === 'flood') return t('ui.power.factorFlood');
  if (id === 'chemSpill') return t('ui.power.factorChem');
  return null;
}

function GeneratorGauge({
  efficiency,
  weather,
  weatherMult,
  disaster,
  disasterMult,
}: {
  efficiency: number;
  weather: WeatherId;
  weatherMult: number;
  disaster: DisasterId;
  disasterMult: number;
}) {
  const uid = useId();
  const fill = Math.max(0, Math.min(1, efficiency));
  const pct = Math.round(efficiency * 100);
  const fillColor =
    fill >= 0.7 ? 'var(--color-safe)' : fill >= 0.35 ? 'var(--color-amber)' : 'var(--color-alarm)';
  const clipTop = 20 + 30 * (1 - fill);
  const clipH = 30 * fill;
  const factors: Array<{ id: string; label: string; tip: string }> = [
    {
      id: 'weather',
      label: WEATHER_NAME[weather],
      tip: t('ui.power.factorTip', { n: weatherMult.toFixed(2) }),
    },
  ];
  if (disasterMult !== 1) {
    const label = disasterFactorLabel(disaster);
    if (label) {
      factors.push({
        id: 'disaster',
        label,
        tip: t('ui.power.factorTip', { n: disasterMult.toFixed(2) }),
      });
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" title={t('ui.power.efficiencyPct', { n: pct })}>
        <svg viewBox="0 0 56 64" className="h-16 w-14" aria-hidden>
          <defs>
            <clipPath id={`${uid}-fill`}>
              <rect x="8" y={clipTop} width="32" height={clipH} />
            </clipPath>
          </defs>
          <rect x="16" y="6" width="16" height="5" rx="1" fill="var(--color-line2)" />
          <rect x="8" y="14" width="32" height="6" rx="1" fill="var(--color-panel3)" stroke="var(--color-line2)" />
          <rect x="8" y="20" width="32" height="30" rx="2" fill="var(--color-ink)" stroke="var(--color-line2)" />
          <rect x="8" y="20" width="32" height="30" rx="2" fill={fillColor} clipPath={`url(#${uid}-fill)`} opacity="0.88" />
          <rect x="42" y="24" width="8" height="22" rx="2" fill="var(--color-panel3)" stroke="var(--color-line2)" />
          <rect x="44" y="20" width="4" height="5" fill="var(--color-line2)" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x="12" y={24 + i * 6} width="24" height="2" fill="var(--color-line)" opacity="0.7" />
          ))}
          <path
            d="M26 26 L21 35 H25 L23 44 L32 33 H27 Z"
            fill="var(--color-paper)"
            opacity="0.9"
          />
          <rect x="10" y="51" width="8" height="4" fill="var(--color-line2)" />
          <rect x="30" y="51" width="8" height="4" fill="var(--color-line2)" />
        </svg>
        <div className="absolute inset-x-0 -bottom-0.5 text-center font-mono text-[11px] tabular-nums text-paper">
          {t('ui.power.efficiencyPct', { n: pct })}
        </div>
      </div>
      <div className="min-w-0">
        <div className="label">{t('ui.power.efficiency')}</div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {factors.map((f) => (
            <Chip key={f.id} title={f.tip}>
              {f.label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

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
  const disasterMult = isPrep ? 1 : power.disasterMult;
  const efficiency = power.weatherMult * disasterMult;

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
        {isPrep && <div className="mb-2 text-safehi">{t('ui.power.gridOk')}</div>}
        <GeneratorGauge
          efficiency={efficiency}
          weather={run.world.weather}
          weatherMult={power.weatherMult}
          disaster={run.world.disaster}
          disasterMult={isPrep ? 1 : power.disasterMult}
        />
        {power.grid > 0 && <div className="mt-2">{t('ui.power.grid', { n: power.grid.toFixed(1) })}</div>}
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
