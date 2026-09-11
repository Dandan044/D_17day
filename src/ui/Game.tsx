import { memo, useEffect, useState, type CSSProperties } from 'react';

import { COLD, CURE, RAD, TIME } from '../game/balance';
import { CONDITION_BY_ID } from '../game/content/conditions';
import { DISASTER_BY_ID } from '../game/content/disasters';
import { RES_NAME, RES_UNIT } from '../game/copy/names';
import { t } from '../game/copy/t';
import { MODULES } from '../game/content/modules';
import { SITE_BY_ID } from '../game/content/sites';
import { canElectricHeat, canFuelHeat, comfortTemp, currentIndoor, heatCostMult, heatSliderMax, survivalTemp } from '../game/engine/climate';
import { dailyNeeds } from '../game/engine/economy';
import { dailyExposure, exposureTier, TIER_DESC, TIER_NAMES } from '../game/engine/exposure';
import { cureChanceOf, isImmuneNow } from '../game/engine/health';
import { LOAD_NAME, batteryCapacity, heaterHeadroomKwh } from '../game/engine/power';
import { effectiveModule, iodineActive, radiationShield, threatName, waterCapacity } from '../game/engine/tags';
import { WEATHER_DESC, WEATHER_NAME } from '../game/engine/world';
import { formatSeed } from '../game/rng';
import { useGame } from '../game/store';
import type { ModuleId, ResourceId, RunState } from '../game/types';
import EventCard from './EventCard';
import { cachedPower, cachedTonightHeat } from './derived';
import { Bar, Chip, Gauge, HelpHint, Panel, SectionLabel, Stat } from './kit';

/** 暴露度分档配色（0 无人注意 → 4 被猎捕），与经典侧 ExposurePanel 保持一致 */
const EXPOSURE_TONES = ['good', 'info', 'warn', 'bad', 'bad'] as const;

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

// memo：Game 无 props、自订阅 run。App 因 overlay/openShop/toasts 等变化重渲染时
// 整树不再跟着重渲染（含所有引擎派生调用）；run 变化照常经 selector 触发更新。
export default memo(function Game() {
  const run = useGame((s) => s.run);
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
});

// ============================================================
// 顶栏
// ============================================================

function DayHeader({ run }: { run: RunState }) {
  const isPrep = run.day < TIME.COLLAPSE_DAY;
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  const indoorNow = currentIndoor(run);
  const disaster = DISASTER_BY_ID[run.world.disaster];
  const shield = radiationShield(run);
  const tol = RAD.SHIELD_TOLERANCE[shield] ?? RAD.SHIELD_TOLERANCE[0]!;
  const power = cachedPower(run);
  const airLv = run.modules.airFilter;
  const airEff = effectiveModule(run, 'airFilter', power);

  return (
    <div className="shrink-0 border-b border-line bg-panel">
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
        {/* 暴露度灾前也得看得见（灾前只有事件会加它） */}
        {(!isPrep || run.world.exposure > 0) && (
          <div className="hidden sm:block">
            <div className="label">{t('ui.game.env')}</div>
            <div className="flex flex-wrap gap-1.5">
              {run.world.exposure > 0 && (
                <Chip tone={EXPOSURE_TONES[exposureTier(run.world.exposure)]}>
                  {t('ui.game.exposure')} {Math.round(run.world.exposure)} · {TIER_NAMES[exposureTier(run.world.exposure)]}
                </Chip>
              )}
              {run.world.radiation > 8 && (
                <Chip tone={run.world.radiation > tol ? 'bad' : 'warn'}>
                  {t('ui.game.rad', { n: Math.round(run.world.radiation), tol })}
                </Chip>
              )}
              {airLv > 0 && airEff === 0 && <Chip tone="bad">{t('ui.game.filterOff')}</Chip>}
              {iodineActive(run) && <Chip tone="good">{t('ui.game.iodine')}</Chip>}
              {power.batteryCap > 0 && (
                <Chip tone={run.wear.batteryCharge < 0.5 ? 'warn' : 'info'}>
                  {t('ui.game.battery', {
                    stored: run.wear.batteryCharge.toFixed(1),
                    cap: power.batteryCap,
                  })}
                </Chip>
              )}
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
        </div>
      </div>

      <div className="mx-auto flex max-w-[1500px] items-center gap-2 px-3 pb-1.5 text-[11px] text-faint sm:px-4">
        <span className="truncate">{site.name}</span>
        <span className="ml-auto num shrink-0 text-amberdim/70">{formatSeed(run.seed)}</span>
      </div>
    </div>
  );
}

// ============================================================
// 身体状况
// ============================================================

/** 治愈率 → 显示档位（不给数值，只给等级与颜色） */
function cureTierOf(p: number): { key: string; cls: string } {
  const T = CURE.TIERS;
  if (p < T[0]) return { key: 'ui.game.cureNone', cls: 'text-alarmhi' };
  if (p < T[1]) return { key: 'ui.game.cureT1', cls: 'text-alarmhi' };
  if (p < T[2]) return { key: 'ui.game.cureT2', cls: 'text-amberhi' };
  if (p < T[3]) return { key: 'ui.game.cureT3', cls: 'text-paper' };
  if (p < T[4]) return { key: 'ui.game.cureT4', cls: 'text-safehi' };
  return { key: 'ui.game.cureT5', cls: 'text-safehi' };
}

export function BodyPanel({ run }: { run: RunState }) {
  const medicate = useGame((s) => s.medicate);
  const nurse = run.abilities.includes('nurse_care');
  const medCost = (n: number) => (nurse ? Math.max(1, Math.round(n * 0.6)) : n);
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
          <div className="flex items-center gap-1.5">
            <SectionLabel>{t('ui.game.treat')}</SectionLabel>
            <HelpHint>
              <span className="block">{t('ui.game.cureHint')}</span>
              <span className="mt-1 block text-faint">{t('ui.game.treatRule')}</span>
              {effectiveModule(run, 'medbay') > 0 && (
                <span className="mt-1 block text-faint">
                  {t('ui.game.medbay')}
                  {run.modules.medbay >= 3 ? t('ui.game.medbay3') : t('ui.game.medbaySleep')}
                </span>
              )}
            </HelpHint>
          </div>
          <div className="space-y-1.5">
            {run.conditions.map((c) => {
              const def = CONDITION_BY_ID[c];
              const immune = isImmuneNow(run, c);
              const chance = cureChanceOf(run, c); // null = 条件型
              const medicated = run.medicated?.includes(c) ?? false;
              const gateOk = !def.needsMedbay || run.modules.medbay >= def.needsMedbay;
              const cost = def.medsCure ? medCost(def.medsCure) : 0;
              const afford = run.res.meds >= cost;
              const canMedicate = def.kind === 'pathogenic' && !!def.medsCure;
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
              const debuffParts: string[] = [];
              if (def.daily.hp) debuffParts.push(`生命 ${def.daily.hp}`);
              if (def.daily.stamina) debuffParts.push(`体力 ${def.daily.stamina}`);
              if (def.daily.sanity) debuffParts.push(`理智 ${def.daily.sanity}`);
              const tier = chance === null ? null : cureTierOf(chance);
              return (
                <div key={c} className="group/cond relative border-l-2 border-alarmdim bg-alarm/5 px-2 py-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] text-alarmhi">
                      {def.name}
                      {immune && <span className="text-faint">（{t('ui.game.immuneTag')}）</span>}
                    </span>
                    {canMedicate && (
                      <button
                        className="btn btn-ghost shrink-0 px-1.5 py-0 text-[10px]"
                        disabled={medicated || !gateOk || !afford}
                        title={
                          !gateOk
                            ? t('ui.game.medicateMedbayGate', { n: def.needsMedbay ?? 0 })
                            : t('ui.game.medicateTitle', { n: cost })
                        }
                        onClick={() => medicate(c)}
                      >
                        {medicated ? t('ui.game.medicated') : t('ui.game.medicateBtn', { n: cost })}
                        {def.needsMedbay ? t('ui.game.medicateMed', { n: def.needsMedbay }) : ''}
                      </button>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-faint">
                    {def.desc}
                    {worsenHint ? ` ${worsenHint}` : ''}
                  </div>
                  {/* 悬停：治愈判定档位 + 每晚损耗详情（不显示具体概率） */}
                  <div className="pointer-events-none absolute right-2 top-[calc(100%-4px)] z-30 hidden w-56 rounded-sm bg-ink p-2.5 text-[11px] leading-relaxed shadow-lg ring-1 ring-line2 group-hover/cond:block">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-dim">{t('ui.game.cureTitle')}</span>
                      {tier ? (
                        <span className={tier.cls}>{t(tier.key)}</span>
                      ) : (
                        <span className="text-infohi">{t('ui.game.cureConditional')}</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-start justify-between gap-2 border-t border-line pt-1.5">
                      <span className="shrink-0 text-dim">{t('ui.game.debuffTitle')}</span>
                      <span className="text-right text-paper/80">
                        {debuffParts.length > 0 ? debuffParts.join(' · ') : t('ui.game.debuffNone')}
                      </span>
                    </div>
                    {def.conditionHint && (
                      <div className="mt-1.5 border-t border-line pt-1.5 text-faint">
                        <span className="text-dim">{t('ui.game.conditionCure')}：</span>
                        {def.conditionHint}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}

// ============================================================
// 温度计：电、油滑块各自控制，升温叠加
// ============================================================

const THERMO_MIN = -15;
const THERMO_MAX = 25;

function thermoPct(temp: number): number {
  return Math.max(2, Math.min(98, ((temp - THERMO_MIN) / (THERMO_MAX - THERMO_MIN)) * 100));
}

function HeatThermometer({ run }: { run: RunState }) {
  const setHeatMix = useGame((s) => s.setHeatMix);
  const now = currentIndoor(run);
  const { plan } = cachedTonightHeat(run);
  const comfort = comfortTemp(run);
  const survival = survivalTemp(run);
  const elecOn = canElectricHeat(run);
  const fuelOn = canFuelHeat(run);
  const sliderCap = heatSliderMax(run);
  const maxElecKwh = elecOn ? Math.round(Math.min(heaterHeadroomKwh(run), sliderCap.elecKwh) * 10) / 10 : 0;
  const maxFuelL = fuelOn ? Math.round(Math.min(run.res.fuel, sliderCap.fuelL) * 10) / 10 : 0;
  const elecWant = run.heatElecWant ?? plan.kwh;
  const fuelWant = run.heatFuelWant ?? plan.fuelCost;
  const canElec = elecOn && maxElecKwh >= 0.05;
  const canFuel = fuelOn && maxFuelL >= 0.05;
  const warn =
    plan.indoor < survival ? 'heat-module-danger' : plan.indoor < comfort ? 'heat-module-warn' : '';

  const elecValue = Math.min(elecWant, Math.max(maxElecKwh, 0));
  const fuelValue = Math.min(fuelWant, Math.max(maxFuelL, 0));

  // 轨道已填充比例（0-100%），内联成 --fill 交给 CSS 画进度色。
  // 分母与 input 的 max 保持一致（Math.max(0.1, max)），否则 0 值时除零。
  const rangePct = (v: number, max: number) => {
    const m = Math.max(0.1, max);
    return Math.max(0, Math.min(100, (Math.max(0, Math.min(v, m)) / m) * 100));
  };

  // 拖动中仅写本地草稿，松手/失焦/键盘抬起时提交一次 store。
  // 原实现每步进 0.1 都触发一次全量 structuredClone + persist 序列化 + 整棵树重渲染，
  // 是游玩界面最主要的卡顿源；提交后 draft 清空，UI 回读 store 真值（applyHeatWants 可能 clamp）。
  const [elecDraft, setElecDraft] = useState<number | null>(null);
  const [fuelDraft, setFuelDraft] = useState<number | null>(null);
  const commit = () => {
    if (elecDraft === null && fuelDraft === null) return;
    setHeatMix(elecDraft ?? elecWant, fuelDraft ?? fuelWant);
    setElecDraft(null);
    setFuelDraft(null);
  };
  // 外部变更（夜间结算、资源变化导致滑块上限变化）后丢弃草稿，回落到 store 值
  useEffect(() => {
    setElecDraft(null);
  }, [elecValue]);
  useEffect(() => {
    setFuelDraft(null);
  }, [fuelValue]);

  const elecDeg =
    COLD.ELECTRIC_PER_DEGREE > 0 ? plan.kwh / (COLD.ELECTRIC_PER_DEGREE * (plan.costMult ?? heatCostMult(run))) : 0;
  const elecIndoor = plan.leaked + elecDeg;
  const mixElecLeft = thermoPct(plan.leaked);
  const mixElecWidth = Math.max(0, thermoPct(elecIndoor) - mixElecLeft);
  const mixFuelLeft = thermoPct(elecIndoor);
  const mixFuelWidth = Math.max(0, thermoPct(plan.indoor) - mixFuelLeft);

  return (
    <div className={`heat-module ${warn}`}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="num text-[12px] text-paper">{t('ui.game.heatEst', { n: plan.indoor.toFixed(1) })}</span>
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
          {mixElecWidth > 0 && (
            <div
              className="absolute inset-y-0 bg-infohi/70"
              style={{ left: `${mixElecLeft}%`, width: `${mixElecWidth}%` }}
            />
          )}
          {mixFuelWidth > 0 && (
            <div
              className="absolute inset-y-0 bg-amber/70"
              style={{ left: `${mixFuelLeft}%`, width: `${mixFuelWidth}%` }}
            />
          )}
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
        <div
          className="absolute top-[13px] h-3 w-0.5 bg-amberhi"
          style={{ left: `${thermoPct(plan.indoor)}%`, transform: 'translateX(-50%)' }}
          title={t('ui.game.heatEst', { n: plan.indoor.toFixed(1) })}
        />
        <div
          className="absolute bottom-0 text-[9px] leading-none text-faint"
          style={{ left: `${thermoPct(run.world.temperature)}%`, transform: 'translateX(-50%)' }}
        >
          {t('ui.game.heatOutdoor', { n: run.world.temperature })}
        </div>
      </div>

      {elecOn && (
        <div className="mb-1.5">
          <div className="mb-0.5 flex items-baseline justify-between">
            <span className="label">{t('ui.game.heatElecSlider')}</span>
            <span className="num text-[11px] text-dim">
              {(elecDraft ?? Math.min(elecWant, maxElecKwh)).toFixed(1)} / {maxElecKwh.toFixed(1)} kWh
            </span>
          </div>
          <span
            className={`thermo-rail thermo-rail-elec${canElec ? '' : ' thermo-rail-off'}`}
            style={{ '--fill': `${rangePct(elecDraft ?? elecValue, maxElecKwh)}%` } as CSSProperties}
          >
            <span className="thermo-rail-fill" />
            <input
              type="range"
              min={0}
              max={Math.max(0.1, maxElecKwh)}
              step={0.1}
              value={elecDraft ?? elecValue}
              disabled={!canElec}
              onChange={(e) => setElecDraft(Number(e.target.value))}
              onPointerUp={commit}
              onKeyUp={commit}
              onBlur={commit}
              className="thermo-range thermo-range-elec"
              aria-label={t('ui.game.heatElecSlider')}
            />
          </span>
        </div>
      )}

      {fuelOn && (
        <div className="mb-1.5">
          <div className="mb-0.5 flex items-baseline justify-between">
            <span className="label">{t('ui.game.heatFuelSlider')}</span>
            <span className="num text-[11px] text-dim">
              {(fuelDraft ?? Math.min(fuelWant, maxFuelL)).toFixed(1)} / {maxFuelL.toFixed(1)} L
            </span>
          </div>
          <span
            className={`thermo-rail thermo-rail-fuel${canFuel ? '' : ' thermo-rail-off'}`}
            style={{ '--fill': `${rangePct(fuelDraft ?? fuelValue, maxFuelL)}%` } as CSSProperties}
          >
            <span className="thermo-rail-fill" />
            <input
              type="range"
              min={0}
              max={Math.max(0.1, maxFuelL)}
              step={0.1}
              value={fuelDraft ?? fuelValue}
              disabled={!canFuel}
              onChange={(e) => setFuelDraft(Number(e.target.value))}
              onPointerUp={commit}
              onKeyUp={commit}
              onBlur={commit}
              className="thermo-range thermo-range-fuel"
              aria-label={t('ui.game.heatFuelSlider')}
            />
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 配给
// ============================================================

export function RationPanel({ run }: { run: RunState }) {
  const setRation = useGame((s) => s.setRation);
  const setWaterUse = useGame((s) => s.setWaterUse);
  const isPrep = run.day < TIME.COLLAPSE_DAY;
  const needs = dailyNeeds(run, run.difficulty);

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
            <span className="flex items-center gap-1.5">
              <span className="label">{t('ui.game.water')}</span>
              {!isPrep && (
                <HelpHint>
                  <span className="block">{t('ui.game.waterHint')}</span>
                </HelpHint>
              )}
            </span>
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
      </div>
    </Panel>
  );
}

// ============================================================
// 行动
// ============================================================

function ActionsPanel({ run, isPrep }: { run: RunState; isPrep: boolean }) {
  const setOverlay = useGame((s) => s.setOverlay);
  const rest = useGame((s) => s.rest);
  const noAp = run.ap <= 0;
  const shelterNeedsAttention =
    run.projects.length > 0 ||
    (run.wear.filterLife <= 0 && (run.modules.filter > 0 || run.modules.airFilter > 0));

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
      pulse: shelterNeedsAttention,
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
            className={`choice${'pulse' in a && a.pulse ? ' heat-module-warn' : ''}`}
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

export function SuppliesPanel({ run }: { run: RunState }) {
  const setOverlay = useGame((s) => s.setOverlay);
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
                <span className="flex items-center gap-1.5">
                  <span className="label">{RES_NAME[r]}</span>
                  {r === 'foodFresh' && !isPrep && (
                    <HelpHint>
                      <span className="block">{t('ui.game.spoil')}</span>
                    </HelpHint>
                  )}
                </span>
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

      {/* 特殊物品入口：原在顶栏按钮组，随该组一并下放到物资卡底部，
          宽度/样式与「供电优先级」一致（btn-ghost + w-full）。滤芯耗尽时脉冲提示保留。 */}
      <div className="mt-3 border-t border-line pt-3">
        <button
          className={`btn btn-ghost w-full py-1.5 text-[11.5px]${
            run.wear.filterLife <= 0 && (run.modules.filter > 0 || run.modules.airFilter > 0)
              ? ' heat-module-warn'
              : ''
          }`}
          onClick={() => setOverlay('items')}
        >
          {t('ui.game.itemsSpecial')}
        </button>
      </div>
    </Panel>
  );
}

// ============================================================
// 避难所摘要
// ============================================================

function ShelterSummary({ run }: { run: RunState }) {
  const setOverlay = useGame((s) => s.setOverlay);
  const power = cachedPower(run);
  const isPrep = run.day < TIME.COLLAPSE_DAY;
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
          {t('ui.game.filterWarn', { n: Math.max(0, Math.floor(run.wear.filterLife)) })}
        </div>
      )}

      {/* 供电：先独立成卡，用户反馈两张卡接在一起分不开，改为避难所卡内的分区。
          电力本就属于避难所的一部分，且右列短一截。仅灾后出现（与独立成卡时一致）。 */}
      {!isPrep && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <SectionLabel>{t('ui.game.powerLabel')}</SectionLabel>
            <span className="num text-[11.5px] text-dim">
              {power.output.toFixed(1)} / {power.demand.toFixed(1)} kWh
            </span>
          </div>
          <button className="btn btn-ghost w-full py-1.5 text-[11.5px]" onClick={() => setOverlay('power')}>
            {t('ui.game.powerBtn')}
          </button>
          <p className="mt-1.5 text-[11px] leading-snug text-faint">
            {t('ui.game.solarEst', { n: power.solar.toFixed(1) })}
          </p>
          {power.offline.length > 0 && (
            <div className="mt-1.5 text-[11px] leading-snug text-alarmhi">
              {t('ui.game.powerOff', { list: power.offline.map((m) => LOAD_NAME[m] ?? m).join('、') })}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

// ============================================================
// 暴露度
// ============================================================

export function ExposurePanel({ run }: { run: RunState }) {
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
  const endDay = useGame((s) => s.endDay);
  const goMenu = useGame((s) => s.goMenu);
  const setOverlay = useGame((s) => s.setOverlay);
  const blocked = run.queue.length > 0;
  return (
    <div className="shrink-0 border-t border-line bg-panel px-3 py-2 sm:px-4">
      <div className="mx-auto flex max-w-[1500px] items-center gap-3">
        <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={goMenu}>
          {t('ui.game.menu')}
        </button>
        <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={() => setOverlay('help')}>
          {t('ui.game.rules')}
        </button>
        {/* 日记：原顶栏按钮组移除后，全项目仅此一处入口（setOverlay('log') 唯一调用点） */}
        <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={() => setOverlay('log')}>
          {t('ui.game.log')}
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
