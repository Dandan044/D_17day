import { useEffect } from 'react';
import { COLD, RAD, THREAT_DESC, TIME } from '../game/balance';
import { CONDITION_BY_ID } from '../game/content/conditions';
import { DISASTER_BY_ID } from '../game/content/disasters';
import { RES_NAME, RES_UNIT } from '../game/copy/names';
import { t } from '../game/copy/t';
import { MODULES } from '../game/content/modules';
import { SITE_BY_ID } from '../game/content/sites';
import { canElectricHeat, canFuelHeat, comfortTemp, currentIndoor, survivalTemp } from '../game/engine/climate';
import { dailyNeeds } from '../game/engine/economy';
import { dailyExposure, exposureTier, TIER_DESC, TIER_NAMES } from '../game/engine/exposure';
import { LOAD_NAME, batteryCapacity, heaterHeadroomKwh, loadWanted, tonightHeat } from '../game/engine/power';
import { computePower, effectiveModule, iodineActive, radiationShield, threatName, waterCapacity } from '../game/engine/tags';
import { WEATHER_DESC, WEATHER_NAME } from '../game/engine/world';
import { formatSeed } from '../game/rng';
import { useGame } from '../game/store';
import type { ModuleId, ResourceId, RunState } from '../game/types';
import EventCard from './EventCard';
import { Bar, Chip, Gauge, Panel, SectionLabel, Stat } from './kit';

const RES_ORDER: ResourceId[] = [
  'water',
  'foodStaple',
  'foodFresh',
  'meds',
  'fuel',
  'materials',
  'parts',
  'ammo',
  'cash',
];

export default function Game() {
  const { run } = useGame();
  if (!run) return null;
  const isPrep = run.day < TIME.COLLAPSE_DAY;

  return (
    <div className="flex h-full flex-col">
      <DayHeader run={run} />
      <div className="scroll-y flex-1 p-3 sm:p-4">
        <div className="mx-auto grid max-w-[1500px] gap-3 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
          <div className="space-y-3 xl:order-1">
            <BodyPanel run={run} />
            <RationPanel run={run} />
          </div>
          <div className="space-y-3 xl:order-2">
            {run.queue.length > 0 ? <EventCard run={run} /> : <ActionsPanel run={run} isPrep={isPrep} />}
            {run.queue.length > 0 && (
              <div className="panel p-3 text-[12px] leading-snug text-faint">
                {t('ui.game.queueHint')}
              </div>
            )}
          </div>
          <div className="space-y-3 xl:order-3">
            <SuppliesPanel run={run} />
            <ShelterSummary run={run} />
            {!isPrep && <ExposurePanel run={run} />}
          </div>
        </div>
      </div>
      <FooterBar run={run} />
    </div>
  );
}

// ============================================================
// 顶栏
// ============================================================

function DayHeader({ run }: { run: RunState }) {
  const { setOverlay } = useGame();
  const isPrep = run.day < TIME.COLLAPSE_DAY;
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  const indoorNow = currentIndoor(run);
  const disaster = DISASTER_BY_ID[run.world.disaster];
  const shield = radiationShield(run);
  const tol = RAD.SHIELD_TOLERANCE[shield] ?? RAD.SHIELD_TOLERANCE[0]!;
  const power = computePower(run);
  const airLv = run.modules.airFilter;
  const airEff = effectiveModule(run, 'airFilter', power);

  return (
    <div className="shrink-0 border-b border-line bg-panel/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2 sm:px-4">
        {/* 天数 */}
        <div className="flex items-baseline gap-2">
          <span className="label">{isPrep ? t('ui.game.countdown') : t('ui.game.dayPrefix')}</span>
          <span className="num text-2xl font-bold leading-none text-amberhi">
            {isPrep ? `D-${TIME.PREP_DAYS - run.day + 1}` : run.day}
          </span>
          {!isPrep && <span className="label">{t('ui.game.daySuffix')}</span>}
        </div>

        <div className="h-6 w-px bg-line" />

        {/* 阶段 */}
        <div className="min-w-0">
          <div className="label">{isPrep ? t('ui.game.status') : t('ui.common.threatLv', { n: run.threat })}</div>
          <div className="truncate text-[12.5px] text-paper">
            {isPrep ? t('ui.game.preDisaster') : threatName(run.threat)}
          </div>
        </div>

        {/* 天气 */}
        <div>
          <div className="label">{t('ui.game.weather')}</div>
          <div className="text-[12.5px] text-paper" title={WEATHER_DESC[run.world.weather]}>
            {WEATHER_NAME[run.world.weather]} ·{' '}
            <span className="num">
              {t('ui.game.outdoor', { out: run.world.temperature, in: indoorNow })}
            </span>
          </div>
        </div>

        {/* 环境 */}
        {!isPrep && (
          <div className="hidden sm:block">
            <div className="label">{t('ui.game.env')}</div>
            <div className="flex flex-wrap gap-1.5">
              {run.world.radiation > 8 && (
                <Chip tone={run.world.radiation > tol ? 'bad' : 'warn'}>
                  {t('ui.game.rad', { n: Math.round(run.world.radiation), tol })}
                </Chip>
              )}
              {airLv > 0 && airEff === 0 && <Chip tone="bad">{t('ui.game.filterOff')}</Chip>}
              {iodineActive(run) && <Chip tone="good">{t('ui.game.iodine')}</Chip>}
              {computePower(run).batteryCap > 0 && (
                <Chip tone={run.wear.batteryCharge < 0.5 ? 'warn' : 'info'}>
                  {t('ui.game.battery', {
                    stored: run.wear.batteryCharge.toFixed(1),
                    cap: computePower(run).batteryCap,
                  })}
                </Chip>
              )}
              {run.world.airPollution > 30 && <Chip tone="warn">{t('ui.game.air', { n: Math.round(run.world.airPollution) })}</Chip>}
              {run.world.contagion > 20 && <Chip tone="psyche">{t('ui.game.contagion', { n: Math.round(run.world.contagion) })}</Chip>}
              {run.world.lawOrder < 45 && <Chip tone="bad">{t('ui.game.law', { n: Math.round(run.world.lawOrder) })}</Chip>}
            </div>
          </div>
        )}

        {/* 灾难 */}
        {run.world.revealed && (
          <div className="hidden md:block">
            <div className="label">{t('ui.game.disaster')}</div>
            <div className="text-[12.5px] text-alarmhi">{disaster.name}</div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          {/* 行动点 */}
          <div className="text-right">
            <div className="label">{t('ui.game.ap')}</div>
            <div className="flex justify-end gap-1">
              {Array.from({ length: run.apMax }).map((_, i) => (
                <span
                  key={i}
                  className="h-3.5 w-2.5"
                  style={{ background: i < run.ap ? 'var(--color-amber)' : 'var(--color-line)' }}
                />
              ))}
            </div>
          </div>

          <div className="h-6 w-px bg-line" />

          <div className="flex flex-wrap gap-1.5">
            <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={() => setOverlay('shelter')}>
              {t('ui.game.shelter')}
            </button>
            <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={() => setOverlay('power')}>
              {t('ui.game.power')}
            </button>
            <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={() => setOverlay('map')}>
              {isPrep ? t('ui.game.shop') : t('ui.game.out')}
            </button>
            <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={() => setOverlay('intel')}>
              {t('ui.game.intel')}
            </button>
            <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={() => setOverlay('log')}>
              {t('ui.game.log')}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1500px] items-center gap-2 px-3 pb-1.5 text-[11px] text-faint sm:px-4">
        <span className="truncate">
          {site.name} · {isPrep ? t('ui.game.tapOn') : THREAT_DESC[run.threat]}
        </span>
        <span className="ml-auto num shrink-0 text-amberdim/70">{formatSeed(run.seed)}</span>
      </div>
    </div>
  );
}

// ============================================================
// 身体状况
// ============================================================

function BodyPanel({ run }: { run: RunState }) {
  const { treat } = useGame();
  return (
    <Panel title={t('ui.game.body')} mark>
      <div className="space-y-2.5">
        <Gauge label={t('ui.game.hp')} value={run.stats.hp} tone="hp" />
        <Gauge label={t('ui.game.stamina')} value={run.stats.stamina} tone="stamina" />
        <Gauge label={t('ui.game.sanity')} value={run.stats.sanity} tone="sanity" />
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Gauge label={t('ui.game.humanity')} value={run.stats.humanity} tone="humanity" />
          <Gauge label={t('ui.game.reputation')} value={run.stats.reputation} tone="reputation" />
        </div>
      </div>

      {run.conditions.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <SectionLabel>{t('ui.game.treat')}</SectionLabel>
          <div className="space-y-1.5">
            {run.conditions.map((c) => {
              const def = CONDITION_BY_ID[c];
              const canTreat = !!def.medsCure;
              const age = run.conditionAge?.[c] ?? 0;
              const worsenAt = def.worsen?.afterDays;
              const worsenHint =
                worsenAt !== undefined
                  ? age >= worsenAt
                    ? t('ui.game.worsenNow', {
                        age,
                        name: CONDITION_BY_ID[def.worsen!.into]?.name ?? def.worsen!.into,
                      })
                    : t('ui.game.worsenLater', { age, left: worsenAt - age })
                  : '';
              return (
                <div key={c} className="border-l-2 border-alarmdim bg-alarm/5 px-2 py-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] text-alarmhi">{def.name}</span>
                    {canTreat && (
                      <button
                        className="btn btn-ghost px-1.5 py-0 text-[10px]"
                        onClick={() => treat(c)}
                        title={`${t('ui.game.treatTitle', { n: def.medsCure ?? 0 })}${def.needsMedbay ? t('ui.game.treatMedbay', { n: def.needsMedbay }) : ''}`}
                      >
                        {t('ui.game.treatBtn', { n: def.medsCure ?? 0 })}
                        {def.needsMedbay ? t('ui.game.treatMed', { n: def.needsMedbay }) : ''}
                      </button>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-faint">
                    {def.desc}
                    {worsenHint ? ` ${worsenHint}` : ''}
                    {canTreat ? t('ui.game.treatNote') : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {effectiveModule(run, 'medbay') > 0 && (
        <p className="mt-3 border-t border-line pt-2 text-[11.5px] leading-snug text-faint">
          {t('ui.game.medbay')}
          {run.modules.medbay >= 3 ? t('ui.game.medbay3') : t('ui.game.medbaySleep')}
          {t('ui.game.treatRule')}
        </p>
      )}
    </Panel>
  );
}

// ============================================================
// 温度计：可拖目标；电优先、油补缺口
// ============================================================

const THERMO_MIN = -15;
const THERMO_MAX = 25;

function thermoPct(temp: number): number {
  return Math.max(2, Math.min(98, ((temp - THERMO_MIN) / (THERMO_MAX - THERMO_MIN)) * 100));
}

function HeatThermometer({ run }: { run: RunState }) {
  const { setHeatTarget } = useGame();
  const now = currentIndoor(run);
  const { plan } = tonightHeat(run);
  const comfort = comfortTemp(run);
  const survival = survivalTemp(run);
  const elecOn = canElectricHeat(run) && loadWanted(run, 'heater');
  const fuelOn = canFuelHeat(run);
  const headroom = elecOn ? heaterHeadroomKwh(run) : 0;
  const maxElecDeg = COLD.ELECTRIC_PER_DEGREE > 0 ? headroom / COLD.ELECTRIC_PER_DEGREE : 0;
  const maxFuelDeg = fuelOn && COLD.FUEL_PER_DEGREE > 0 ? run.res.fuel / COLD.FUEL_PER_DEGREE : 0;
  const minT = plan.leaked;
  const maxT = Math.round(Math.max(minT, Math.min(THERMO_MAX, minT + maxElecDeg + maxFuelDeg)) * 10) / 10;
  const canSlide = maxT - minT >= 0.15;
  const stored = run.heatTarget ?? comfort;
  const target = Math.max(minT, Math.min(maxT, stored));
  const near = (a: number, b: number) => Math.abs(a - b) < 0.2;
  const setT = (n: number) => setHeatTarget(Math.round(Math.max(minT, Math.min(maxT, n)) * 10) / 10);
  const maxElecKwh = Math.round(maxElecDeg * COLD.ELECTRIC_PER_DEGREE * 10) / 10;
  const maxFuelL = Math.round(maxFuelDeg * COLD.FUEL_PER_DEGREE * 10) / 10;
  const slideLeft = thermoPct(minT);
  const slideWidth = Math.max(canSlide ? 6 : 2, thermoPct(maxT) - slideLeft);

  useEffect(() => {
    const clamped = Math.round(Math.max(minT, Math.min(maxT, stored)) * 10) / 10;
    if (Math.abs(stored - clamped) > 0.049) setHeatTarget(clamped);
  }, [minT, maxT, stored, setHeatTarget]);

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="label">{t('ui.game.heat', { n: target.toFixed(1) })}</span>
        <span className="num text-[11px] text-dim">{t('ui.game.heatNow', { n: now.toFixed(1) })}</span>
      </div>

      <div className="relative mb-1 h-11">
        <div className="absolute inset-x-0 top-4 h-2 overflow-hidden rounded-sm bg-ink ring-1 ring-line2">
          <div className="absolute inset-y-0 left-0 bg-alarmdim/80" style={{ width: `${thermoPct(survival)}%` }} />
          <div
            className="absolute inset-y-0 bg-amberdim/50"
            style={{
              left: `${thermoPct(survival)}%`,
              width: `${Math.max(0, thermoPct(comfort) - thermoPct(survival))}%`,
            }}
          />
          <div
            className="absolute inset-y-0 bg-safe/25"
            style={{ left: `${thermoPct(comfort)}%`, width: `${100 - thermoPct(comfort)}%` }}
          />
        </div>
        <div
          className="absolute top-0 text-[9px] leading-none text-alarmhi"
          style={{ left: `${thermoPct(survival)}%`, transform: 'translateX(-50%)' }}
        >
          {t('ui.game.heatSurvival')}
        </div>
        <div
          className="absolute top-0 text-[9px] leading-none text-safehi"
          style={{ left: `${thermoPct(comfort)}%`, transform: 'translateX(-50%)' }}
        >
          {t('ui.game.heatComfort')}
        </div>
        <div
          className="absolute top-[13px] h-3 w-0.5 bg-paper/80"
          style={{ left: `${thermoPct(now)}%`, transform: 'translateX(-50%)' }}
          title={t('ui.game.heatNow', { n: now.toFixed(1) })}
        />
        <input
          type="range"
          min={minT}
          max={Math.max(minT, maxT)}
          step={0.1}
          value={target}
          disabled={!canSlide}
          onChange={(e) => setT(Number(e.target.value))}
          className="thermo-range absolute top-2"
          style={{ left: `${slideLeft}%`, width: `${slideWidth}%` }}
          aria-label={t('ui.game.heat', { n: target.toFixed(1) })}
        />
        <div
          className="absolute bottom-0 text-[9px] leading-none text-faint"
          style={{ left: `${thermoPct(run.world.temperature)}%`, transform: 'translateX(-50%)' }}
        >
          {t('ui.game.heatOutdoor', { n: run.world.temperature })}
        </div>
      </div>

      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="num text-[11px] text-paper">{t('ui.game.heatEst', { n: plan.indoor.toFixed(1) })}</span>
        <span className="text-[10px] leading-snug text-faint">{t('ui.game.heatEstHint')}</span>
      </div>

      <div className="mb-1.5 grid grid-cols-3 gap-1">
        {(
          [
            ['survive', survival, t('ui.game.heatTargetSurvive', { n: survival })],
            ['comfort', comfort, t('ui.game.heatTargetComfort', { n: comfort })],
            ['buffer', comfort + COLD.BUFFER, t('ui.game.heatTargetBuffer', { n: COLD.BUFFER })],
          ] as const
        ).map(([id, value, label]) => {
          const reachable = value >= minT - 0.05 && value <= maxT + 0.05;
          return (
            <button
              key={id}
              disabled={!reachable}
              onClick={() => setT(value)}
              className={`btn px-1 py-1 text-[11px] ${reachable && near(target, value) ? 'btn-primary' : 'btn-ghost'}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {elecOn && (
        <div className="mb-1.5">
          <div className="mb-0.5 flex items-baseline justify-between">
            <span className="label">{t('ui.game.heatElecSlider')}</span>
            <span className="num text-[11px] text-dim">
              {plan.kwh.toFixed(1)} / {Math.max(plan.kwh, maxElecKwh).toFixed(1)} kWh
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0.1, maxElecKwh)}
            step={0.1}
            value={plan.kwh}
            readOnly
            tabIndex={-1}
            className="thermo-range thermo-range-elec w-full"
            aria-label={t('ui.game.heatElecSlider')}
          />
        </div>
      )}

      {fuelOn && (
        <div className="mb-1.5">
          <div className="mb-0.5 flex items-baseline justify-between">
            <span className="label">{t('ui.game.heatFuelSlider')}</span>
            <span className="num text-[11px] text-dim">
              {plan.fuelCost.toFixed(1)} / {Math.max(plan.fuelCost, maxFuelL).toFixed(1)} L
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0.1, maxFuelL)}
            step={0.1}
            value={plan.fuelCost}
            readOnly
            tabIndex={-1}
            className="thermo-range thermo-range-fuel w-full"
            aria-label={t('ui.game.heatFuelSlider')}
          />
        </div>
      )}

      <p className="text-[11px] leading-snug text-faint">
        {!canSlide && t('ui.game.heatStuck', { n: plan.leaked.toFixed(1) })}
        {canSlide && plan.kwh <= 0 && plan.fuelCost <= 0 && t('ui.game.heatOff', { n: plan.leaked.toFixed(1) })}
        {canSlide && (plan.kwh > 0 || plan.fuelCost > 0) && t('ui.game.heatMix', { n: plan.indoor.toFixed(1) })}
      </p>
    </div>
  );
}

// ============================================================
// 配给
// ============================================================

function RationPanel({ run }: { run: RunState }) {
  const { setRation, setWaterUse, setOverlay } = useGame();
  const isPrep = run.day < TIME.COLLAPSE_DAY;
  const needs = dailyNeeds(run, run.difficulty);
  const power = computePower(run);

  if (isPrep) {
    return (
      <Panel title={t('ui.game.prepTitle')} mark>
        <p className="text-[12px] leading-relaxed text-faint">{t('ui.game.prepBody')}</p>
        <div className="mt-3 border-t border-line pt-2">
          <Stat label={t('ui.game.heads')} value={needs.heads} />
          <Stat label={t('ui.game.perWater')} value={t('ui.game.perWaterVal')} />
        </div>
      </Panel>
    );
  }

  return (
    <Panel title={t('ui.game.rationTitle')} mark>
      <div className="space-y-3">
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="label">{t('ui.game.food')}</span>
            <span className="num text-[11.5px] text-dim">{t('ui.game.foodNeed', { n: needs.food })}</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {(['full', 'normal', 'half', 'none'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRation(r)}
                className={`btn px-1 py-1 text-[11px] ${run.ration === r ? 'btn-primary' : 'btn-ghost'}`}
              >
                {t(`ui.game.ration.${r}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="label">{t('ui.game.water')}</span>
            <span className="num text-[11.5px] text-dim">{t('ui.game.waterNeed', { n: needs.water })}</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(['full', 'normal', 'limited'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setWaterUse(r)}
                className={`btn px-1 py-1 text-[11px] ${run.waterUse === r ? 'btn-primary' : 'btn-ghost'}`}
              >
                {t(`ui.game.waterUse.${r}`)}
              </button>
            ))}
          </div>
        </div>

        <HeatThermometer run={run} />

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="label">{t('ui.game.powerLabel')}</span>
            <span className="num text-[11.5px] text-dim">
              {power.output.toFixed(1)} / {power.demand.toFixed(1)} kWh
            </span>
          </div>
          <button className="btn btn-ghost w-full py-1.5 text-[11.5px]" onClick={() => setOverlay('power')}>
            {t('ui.game.powerBtn')}
          </button>
          <p className="mt-1.5 text-[11px] leading-snug text-faint">
            {t('ui.game.solar', {
              n: power.solar.toFixed(1),
              weather: WEATHER_NAME[run.world.weather],
              mult: power.weatherMult.toFixed(2),
            })}
            {power.disasterMult !== 1 ? t('ui.game.nuclear', { n: power.disasterMult.toFixed(2) }) : ''}
            ）
            {power.generator > 0 ? t('ui.game.genBit', { n: power.generator.toFixed(1) }) : ''}
          </p>
          {power.offline.length > 0 && (
            <div className="mt-1.5 text-[11px] leading-snug text-alarmhi">
              {t('ui.game.powerOff', { list: power.offline.map((m) => LOAD_NAME[m] ?? m).join('、') })}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ============================================================
// 行动
// ============================================================

function ActionsPanel({ run, isPrep }: { run: RunState; isPrep: boolean }) {
  const { setOverlay, rest } = useGame();
  const noAp = run.ap <= 0;

  const actions = [
    {
      id: 'out',
      title: isPrep ? t('ui.game.buyTitle') : t('ui.game.scavTitle'),
      desc: isPrep ? t('ui.game.buyDesc') : t('ui.game.scavDesc'),
      ap: 1,
      onClick: () => setOverlay('map'),
    },
    {
      id: 'build',
      title: t('ui.game.buildTitle'),
      desc: t('ui.game.buildDesc'),
      ap: 1,
      onClick: () => setOverlay('shelter'),
    },
    {
      id: 'intel',
      title: isPrep ? t('ui.game.intelPrep') : t('ui.game.intelLive'),
      desc: isPrep ? t('ui.game.intelPrepDesc') : t('ui.game.intelLiveDesc'),
      ap: 0,
      onClick: () => setOverlay('intel'),
    },
    {
      id: 'rest',
      title: t('ui.game.rest'),
      desc: run.modules.medbay >= 3 ? t('ui.game.restHeal') : t('ui.game.restPlain'),
      ap: 1,
      onClick: rest,
    },
  ];

  return (
    <Panel title={t('ui.game.actions')} mark right={<span className="text-faint">{t('ui.game.apLeft', { n: run.ap })}</span>}>
      <div className="space-y-2">
        {actions.map((a) => (
          <button
            key={a.id}
            className="choice"
            disabled={a.ap > 0 && noAp}
            onClick={a.onClick}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-paper">{a.title}</span>
              {a.ap > 0 ? <Chip tone="warn">{t('ui.common.ap', { n: a.ap })}</Chip> : <Chip>{t('ui.common.free')}</Chip>}
            </div>
            <div className="mt-1 text-[12px] leading-snug text-faint">{a.desc}</div>
          </button>
        ))}
      </div>
      {noAp && (
        <p className="mt-3 border-t border-line pt-3 text-[12px] leading-snug text-amberhi">
          {t('ui.game.noTime')}
        </p>
      )}
    </Panel>
  );
}

// ============================================================
// 物资
// ============================================================

function SuppliesPanel({ run }: { run: RunState }) {
  const waterCap = waterCapacity(run);
  const needs = dailyNeeds(run, run.difficulty);
  const daysOfWater = needs.water > 0 ? run.res.water / needs.water : 99;
  const daysOfFood = needs.food > 0 ? (run.res.foodStaple + run.res.foodFresh) / needs.food : 99;
  const isPrep = run.day < TIME.COLLAPSE_DAY;

  return (
    <Panel
      title={t('ui.game.supplies')}
      mark
      right={
        !isPrep ? (
          <span className="text-faint">
            {daysOfWater < 90 ? t('ui.game.daysWater', { n: daysOfWater.toFixed(1) }) : '—'} ·{' '}
            {daysOfFood < 90 ? t('ui.game.daysFood', { n: daysOfFood.toFixed(1) }) : '—'}
          </span>
        ) : undefined
      }
    >
      <div className="space-y-1">
        {RES_ORDER.map((r) => {
          const v = run.res[r];
          const isWater = r === 'water';
          const low = !isPrep && ((isWater && daysOfWater < 3) || (r === 'foodStaple' && daysOfFood < 3));
          return (
            <div key={r}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="label">{RES_NAME[r]}</span>
                <span className={`num text-[12.5px] ${low ? 'text-alarmhi' : 'text-paper'}`}>
                  {r === 'cash' ? Math.round(v) : Math.round(v * 10) / 10}
                  <span className="ml-0.5 text-[10px] text-faint">{RES_UNIT[r]}</span>
                </span>
              </div>
              {isWater && (
                <div className="mt-0.5">
                  <Bar value={v} max={waterCap} tone={daysOfWater < 3 ? 'bad' : 'info'} />
                </div>
              )}
            </div>
          );
        })}
        {(() => {
          const battCap = batteryCapacity(run);
          if (battCap <= 0) return null;
          const stored = run.wear.batteryCharge ?? 0;
          const low = !isPrep && stored < Math.max(1, battCap * 0.25);
          return (
            <div key="battery">
              <div className="flex items-baseline justify-between gap-2">
                <span className="label">{t('ui.game.batteryLabel')}</span>
                <span className={`num text-[12.5px] ${low ? 'text-alarmhi' : 'text-paper'}`}>
                  {stored.toFixed(1)}/{battCap}
                  <span className="ml-0.5 text-[10px] text-faint">kWh</span>
                </span>
              </div>
              <div className="mt-0.5">
                <Bar value={stored} max={battCap} tone={low ? 'bad' : 'info'} />
              </div>
            </div>
          );
        })()}
      </div>
      <div className="mt-2 border-t border-line pt-2 text-[11px] leading-snug text-faint">
        {t('ui.game.cistern', { n: waterCap })}
        {run.res.foodFresh > 0 && t('ui.game.spoil')}
      </div>
    </Panel>
  );
}

// ============================================================
// 避难所摘要
// ============================================================

function ShelterSummary({ run }: { run: RunState }) {
  const { setOverlay } = useGame();
  const power = computePower(run);
  return (
    <Panel
      title={t('ui.game.shelter')}
      mark
      right={
        <button className="btn btn-ghost px-1.5 py-0 text-[10px]" onClick={() => setOverlay('shelter')}>
          {t('ui.game.manage')}
        </button>
      }
    >
      <div className="grid grid-cols-5 gap-1.5">
        {MODULES.map((m) => {
          const level = run.modules[m.id as ModuleId];
          const eff = effectiveModule(run, m.id as ModuleId, power);
          const building = run.projects.some((p) => p.moduleId === m.id);
          return (
            <div
              key={m.id}
              className="text-center"
              title={`${t('ui.game.moduleTip', { name: m.name, lvl: level })}${building ? t('ui.game.buildingTip') : eff < level ? t('ui.game.offlineTip') : ''}`}
            >
              <div
                className="mx-auto flex h-7 w-7 items-center justify-center border text-[11px]"
                style={{
                  borderColor: building ? 'var(--color-amber)' : eff > 0 ? 'var(--color-line2)' : 'var(--color-line)',
                  background: eff > 0 ? 'rgba(63,158,107,0.12)' : 'transparent',
                  color: building ? 'var(--color-amberhi)' : eff > 0 ? 'var(--color-safehi)' : 'var(--color-faint)',
                }}
              >
                {m.short}
              </div>
              <div className="num mt-0.5 text-[10px] text-dim">
                {building ? t('ui.game.buildingShort') : eff < level ? `${level}!` : level}
              </div>
            </div>
          );
        })}
      </div>

      {run.projects.length > 0 && (
        <div className="mt-3 border-t border-line pt-2">
          <SectionLabel>{t('ui.game.queue')}</SectionLabel>
          {run.projects.map((p) => {
            const def = MODULES.find((m) => m.id === p.moduleId)!;
            const pct = p.laborTotal > 0 ? (p.laborDone / p.laborTotal) * 100 : 0;
            return (
              <div key={p.moduleId} className="mb-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] text-paper">
                    {def.name} → {p.toLevel}
                  </span>
                  <span className="num text-[11px] text-faint">
                    {p.path === 'diy'
                      ? t('ui.common.labor', { done: p.laborDone, total: p.laborTotal })
                      : p.path === 'buy'
                        ? t('ui.common.etaBuy', { day: p.etaDay ?? 0 })
                        : t('ui.common.etaDone', { day: p.etaDay ?? 0 })}
                  </span>
                </div>
                <div className="mt-0.5">
                  <Bar value={p.path === 'diy' ? pct : 50} tone="warn" />
                </div>
                <div className="mt-0.5 text-[10.5px] leading-snug text-alarmhi/80">{def.buildPenaltyDesc}</div>
              </div>
            );
          })}
        </div>
      )}

      {run.wear.filterLife <= 5 && (run.modules.filter > 0 || run.modules.airFilter > 0) && (
        <div className="mt-2 border-t border-line pt-2 text-[11.5px] text-alarmhi">
          {t('ui.game.filterWarn', { n: Math.max(0, run.wear.filterLife) })}
        </div>
      )}
    </Panel>
  );
}

// ============================================================
// 暴露度
// ============================================================

function ExposurePanel({ run }: { run: RunState }) {
  const tier = exposureTier(run.world.exposure);
  const breakdown = dailyExposure(run);
  const tones = ['good', 'info', 'warn', 'bad', 'bad'] as const;

  return (
    <Panel title={t('ui.game.exposure')} mark right={<Chip tone={tones[tier]}>{TIER_NAMES[tier]}</Chip>}>
      <Bar value={run.world.exposure} tone={tones[tier]} />
      <p className="mt-2 text-[12px] leading-snug text-dim">{TIER_DESC[tier]}</p>

      <div className="mt-3 border-t border-line pt-2">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="label">{t('ui.game.tonight')}</span>
          <span className={`num text-[12.5px] ${breakdown.total > 0 ? 'text-alarmhi' : 'text-safehi'}`}>
            {breakdown.total > 0 ? '+' : ''}
            {breakdown.total}
          </span>
        </div>
        <div className="space-y-0.5">
          {breakdown.parts.map((p, i) => (
            <div key={i} className="flex items-baseline justify-between gap-2 text-[11.5px]">
              <span className="text-faint">{p.label}</span>
              <span className={`num ${p.value > 0 ? 'text-alarmhi/80' : 'text-safehi/80'}`}>
                {p.value > 0 ? '+' : ''}
                {Math.round(p.value * 10) / 10}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ============================================================
// 底栏
// ============================================================

function FooterBar({ run }: { run: RunState }) {
  const { endDay, goMenu, setOverlay } = useGame();
  const blocked = run.queue.length > 0;
  return (
    <div className="shrink-0 border-t border-line bg-panel/90 px-3 py-2 backdrop-blur sm:px-4">
      <div className="mx-auto flex max-w-[1500px] items-center gap-3">
        <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={goMenu}>
          {t('ui.game.menu')}
        </button>
        <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={() => setOverlay('help')}>
          {t('ui.game.rules')}
        </button>
        <div className="flex-1 truncate text-[11.5px] text-faint">
          {blocked
            ? t('ui.game.queueWait')
            : run.ap > 0
              ? t('ui.game.apUnused', { n: run.ap })
              : t('ui.game.noAp')}
        </div>
        <button className="btn btn-primary px-5 py-2" disabled={blocked} onClick={endDay}>
          {t('ui.game.endDay')}
        </button>
      </div>
    </div>
  );
}
