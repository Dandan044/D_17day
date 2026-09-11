import { useEffect, useState, type CSSProperties } from 'react';

import { COLD, POWER, TIME } from '../../game/balance';
import { MODULE_IDS } from '../../game/content/modules';
import { t } from '../../game/copy/t';
import {
  canElectricHeat,
  canFuelHeat,
  comfortTemp,
  currentIndoor,
  heatSliderMax,
  survivalTemp,
} from '../../game/engine/climate';
import { dailyNeeds } from '../../game/engine/economy';
import { waterCapacity } from '../../game/engine/tags';
import LINEFIG from './linefigLayout.json';
import {
  LOAD_NAME,
  heaterDrawKwh,
  heaterHeadroomKwh,
  loadWanted,
  mergedPriority,
  potentialDrawKwh,
} from '../../game/engine/power';
import { WEATHER_NAME } from '../../game/engine/world';
import { useGame } from '../../game/store';
import type { DisasterId, ModuleId, PowerLoadId, RunState, WeatherId } from '../../game/types';
import { cachedPower, cachedTonightHeat } from '../derived';
import { ART } from './skin';

/**
 * 「今日计划」三栅计划表的三块内容。
 *
 * 为什么不直接复用经典皮肤那套组件（**这是本文件存在的唯一理由**）：
 * `RationPanel` / `HeatThermometer` 内嵌在经典三栏布局里（Game.tsx），
 * `PowerPanel` / `GeneratorGauge` 挂在经典供电浮层上（App.tsx）——它们都是两皮肤共用体，
 * 改本体就会连带改掉经典皮肤。所以这里**重新实现**：只复制引擎数学与 store 动作，
 * 换一套纸面 DOM 与配色（刻度尺滑杆 / 温度带 / 负荷台账 / 纸面效率表）。
 *
 * 逻辑上必须与经典版逐项等价——尤其滑杆的 draft/commit 防抖与负荷排序的换位基准。
 */

// 温度计刻度**固化**成 -40..+40：管腔按这个量程线性映射，顶底两端标数字。
// 超出范围的读数会顶在极端位置（clamp），不会溢出管腔。
const SCALE_MIN = -40;
const SCALE_MAX = 40;

function scalePct(temp: number): number {
  const t = Math.max(SCALE_MIN, Math.min(SCALE_MAX, temp));
  return ((t - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
}

function disasterFactorLabel(id: DisasterId): string | null {
  if (id === 'nuclear') return t('ui.power.factorNuclear');
  if (id === 'volcanicWinter') return t('ui.power.factorVolcanic');
  if (id === 'flood') return t('ui.power.factorFlood');
  if (id === 'chemSpill') return t('ui.power.factorChem');
  return null;
}

/** 线稿 + 「背后垫色块」表示比例。
 *  填充层在下、线稿在上；色块被 mask 裁进形状内部（不裁的话白底让轮廓之外也透明，
 *  颜色会从形状外面渗出来糊成一片）。**父层不带 z-index**——那会形成隔离组让 mask 失效（踩过）。 */
function LineFig({
  line,
  mask,
  aspect,
  fills,
}: {
  line: string;
  mask: string;
  aspect: number;
  fills: Array<{ from: number; to: number; color: string; clip?: string }>;
}) {
  return (
    <span className="art-pl-linefig" style={{ aspectRatio: String(aspect) }}>
      {fills.map((f, i) => (
        <span
          key={i}
          className="art-pl-fill"
          style={
            {
              maskImage: `url(${mask})`,
              WebkitMaskImage: `url(${mask})`,
              clipPath: f.clip,
              '--fill-b': `${Math.max(0, Math.min(1, Math.min(f.from, f.to))) * 100}%`,
              '--fill-h': `${Math.max(0, Math.min(1, Math.abs(f.to - f.from))) * 100}%`,
              '--fill-c': f.color,
            } as CSSProperties
          }
        >
          <i />
        </span>
      ))}
      <img className="art-pl-linefig-line" src={line} alt="" />
    </span>
  );
}

/** 供电那两张形状（发电机 / 蓄电池）共用一张线稿，按量出的分割线各填一半，底下各自标名。 */
function PlanPowerFigure({ eff, batt }: { eff: number; batt: number }) {
  const s = LINEFIG.power.split;
  return (
    <span className="art-pl-powerfig">
      <LineFig
        line={ART.linePower}
        mask={ART.linePowerMask}
        aspect={LINEFIG.power.aspect}
        fills={[
          { from: 0, to: eff, color: 'var(--pl-blue)', clip: `inset(0 ${((1 - s) * 100).toFixed(2)}% 0 0)` },
          { from: 0, to: batt, color: 'var(--pl-ochre)', clip: `inset(0 0 0 ${(s * 100).toFixed(2)}%)` },
        ]}
      />
      <span className="art-pl-powerfig-cap">
        <em style={{ flex: s }}>{t('ui.plan.genLabel')}</em>
        <em style={{ flex: 1 - s }}>{t('ui.plan.battLabel')}</em>
      </span>
    </span>
  );
}

/* ============================================================
   左栅：配给
   ============================================================ */

export function PlanRationColumn({ run }: { run: RunState }) {
  const setRation = useGame((s) => s.setRation);
  const setWaterUse = useGame((s) => s.setWaterUse);
  const isPrep = run.day < TIME.COLLAPSE_DAY;
  const needs = dailyNeeds(run, run.difficulty);
  // 两张图的填色比例：食物以「7 天口粮」为上限（储量本身无上限），水以水箱物理上限为分母；
  // 第二个色值用「当前配给生效后第二天的剩余」推算，于是两色分层 = 今晚会吃掉多少。
  const foodCap = Math.max(1, 7 * needs.food);
  const foodHave = run.res.foodStaple + run.res.foodFresh;
  const foodNowRatio = Math.min(1, foodHave / foodCap);
  const foodNextRatio = Math.min(1, Math.max(0, foodHave - needs.food) / foodCap);
  const waterCap = Math.max(1, waterCapacity(run));
  const waterNowRatio = Math.min(1, run.res.water / waterCap);
  const waterNextRatio = Math.min(1, Math.max(0, run.res.water - needs.water) / waterCap);

  return (
    <section className="art-pl-col" aria-label={t('ui.plan.colRation')}>
      <h3 className="art-pl-colname">{t('ui.plan.colRation')}</h3>

      {isPrep ? (
        /* 准备期：自来水还在供、超市还开着，配给栏只留一张说明卡（与经典版一致） */
        <div className="art-pl-prep">
          <p className="art-pl-preptitle">{t('ui.game.prepTitle')}</p>
          <p className="art-pl-prepbody">{t('ui.game.prepBody')}</p>
          <dl className="art-pl-stats">
            <div>
              <dt>{t('ui.game.heads')}</dt>
              <dd className="num">{needs.heads}</dd>
            </div>
            <div>
              <dt>{t('ui.game.perWater')}</dt>
              <dd className="num">{t('ui.game.perWaterVal')}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <>
          <div className="art-pl-row">
            <span className="art-pl-rowk">{t('ui.game.food')}</span>
            <span className="art-pl-rowv num">{t('ui.game.foodNeed', { n: needs.food })}</span>
          </div>
          <div className="art-pl-stamps is-four">
            {(['full', 'normal', 'half', 'none'] as const).map((r) => (
              <button
                key={r}
                type="button"
                className={`art-pl-stamp${run.ration === r ? ' is-on' : ''}`}
                aria-pressed={run.ration === r}
                onClick={() => setRation(r)}
              >
                {t(`ui.game.ration.${r}`)}
              </button>
            ))}
          </div>

          <div className="art-pl-row is-gap">
            <span className="art-pl-rowk">{t('ui.game.water')}</span>
            <span className="art-pl-rowv num">{t('ui.game.waterNeed', { n: needs.water })}</span>
          </div>
          <div className="art-pl-stamps is-three">
            {(['full', 'normal', 'limited'] as const).map((r) => (
              <button
                key={r}
                type="button"
                className={`art-pl-stamp${run.waterUse === r ? ' is-on' : ''}`}
                aria-pressed={run.waterUse === r}
                onClick={() => setWaterUse(r)}
              >
                {t(`ui.game.waterUse.${r}`)}
              </button>
            ))}
          </div>

          <p className="art-pl-note">{t('ui.game.waterHint')}</p>

          {/* 口粮金字塔 / 水瓶堆：两色分层——下层绿=次日仍在，上层赭=今晚会吃掉的那段。
              食物储量没有上限，所以分母取「7 天口粮量」；水分母取水箱物理上限。 */}
          <div className="art-pl-rationfigs">
            <figure className="art-pl-rationfig">
              <LineFig
                line={ART.lineRation}
                mask={ART.lineRationMask}
                aspect={LINEFIG.ration.aspect}
                fills={[
                  { from: 0, to: foodNextRatio, color: 'var(--pl-green)' },
                  { from: foodNextRatio, to: foodNowRatio, color: 'var(--pl-ochre)' },
                ]}
              />
              <figcaption>{t('ui.game.food')}</figcaption>
            </figure>
            <figure className="art-pl-rationfig">
              <LineFig
                line={ART.lineWater}
                mask={ART.lineWaterMask}
                aspect={LINEFIG.water.aspect}
                fills={[
                  { from: 0, to: waterNextRatio, color: 'var(--pl-blue)' },
                  { from: waterNextRatio, to: waterNowRatio, color: 'var(--pl-ochre)' },
                ]}
              />
              <figcaption>{t('ui.game.water')}</figcaption>
            </figure>
          </div>
        </>
      )}
    </section>
  );
}

/* ============================================================
   中栅：取暖（温度带 + 两根刻度尺滑杆）
   ============================================================ */

export function PlanHeatColumn({ run }: { run: RunState }) {
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
  const warn = plan.indoor < survival ? 'is-danger' : plan.indoor < comfort ? 'is-warn' : '';

  const elecValue = Math.min(elecWant, Math.max(maxElecKwh, 0));
  const fuelValue = Math.min(fuelWant, Math.max(maxFuelL, 0));

  const rangePct = (v: number, max: number) => {
    const m = Math.max(0.1, max);
    return Math.max(0, Math.min(100, (Math.max(0, Math.min(v, m)) / m) * 100));
  };

  // 拖动中只写本地草稿，松手/失焦/抬键才提交一次 store（与经典版逐字一致，别删任何一环）
  const [elecDraft, setElecDraft] = useState<number | null>(null);
  const [fuelDraft, setFuelDraft] = useState<number | null>(null);
  const commit = () => {
    if (elecDraft === null && fuelDraft === null) return;
    setHeatMix(elecDraft ?? elecWant, fuelDraft ?? fuelWant);
    setElecDraft(null);
    setFuelDraft(null);
  };
  // 外部变更（夜间结算、资源变化导致上限变化）后丢弃草稿，回落到 store 真值
  useEffect(() => {
    setElecDraft(null);
  }, [elecValue]);
  useEffect(() => {
    setFuelDraft(null);
  }, [fuelValue]);

  // 温度计：填色随危险级别变（生存线以下=红、舒适线以下=赭、否则墨绿）
  const bandColor = warn === 'is-danger' ? 'var(--pl-red-2)' : warn === 'is-warn' ? 'var(--pl-ochre)' : 'var(--pl-green)';
  // 生存/舒适线与两根针都按 line-thermo 量出的管腔 bbox 定位（唯一坐标真源）。
  // 注意管高那项要乘 100 才是百分比：TB 是 0..1 的归一化值，pct 已是 0..100。
  const TB = LINEFIG.thermo.tube;
  const markAt = (pct: number) => `${((1 - TB[3]) * 100 + (TB[3] - TB[1]) * pct).toFixed(2)}%`;


  return (
    <section className={`art-pl-col${warn ? ` ${warn}` : ''}`} aria-label={t('ui.game.heat')}>
      <h3 className="art-pl-colname">{t('ui.game.heat')}</h3>

      <div className="art-pl-reads">
        <span className={`art-pl-est${warn ? ` ${warn}` : ''}`}>{t('ui.game.heatEst', { n: plan.indoor.toFixed(1) })}</span>
        <span className="art-pl-now">{t('ui.game.heatNow', { n: now.toFixed(1) })}</span>
      </div>

      {/* 取暖：**竖温度计在左、两根刻度尺滑杆在右**。
          温度计管腔（line-thermo 的宽液柱槽）里填色柱表示预估室温，高度由 thermoPct 换算；
          生存/舒适刻度线与当前/预估针同样按 linefigLayout 里量出的 tube bbox 定位——
          三者共用同一套坐标，才不会出现"线、色、针各走各的"。 */}
      <div className="art-pl-heatgrid">
        <div className="art-pl-thermo">
          <LineFig
            line={ART.lineThermo}
            mask={ART.lineThermoMask}
            aspect={LINEFIG.thermo.aspect}
            fills={[{ from: 0, to: scalePct(plan.indoor) / 100, color: bandColor }]}
          />
          {/* 固定刻度：底 -40、中 0、顶 +40，管腔按此线性映射 */}
          <span className="art-pl-tnum is-min" style={{ bottom: markAt(scalePct(SCALE_MIN)) }}>
            {SCALE_MIN}°
          </span>
          <span className="art-pl-tnum is-mid" style={{ bottom: markAt(scalePct(0)) }}>
            0°
          </span>
          <span className="art-pl-tnum is-max" style={{ bottom: markAt(scalePct(SCALE_MAX)) }}>
            +{SCALE_MAX}°
          </span>
          <span className="art-pl-tmark is-survival" style={{ bottom: markAt(scalePct(survival)) }}>
            {t('ui.game.heatSurvival')} {Math.round(survival)}°
          </span>
          <span className="art-pl-tmark is-comfort" style={{ bottom: markAt(scalePct(comfort)) }}>
            {t('ui.game.heatComfort')} {Math.round(comfort)}°
          </span>
          <span
            className="art-pl-tneedle is-now"
            style={{ left: `${TB[0] * 100}%`, bottom: markAt(scalePct(now)) }}
          />
          <span
            className="art-pl-tneedle is-est"
            style={{ left: `${TB[0] * 100}%`, bottom: markAt(scalePct(plan.indoor)) }}
          />
        </div>

        <div className="art-pl-heatright">
          <p className="art-pl-scalehint">{t('ui.plan.scaleNote')}</p>
      {elecOn && (
        <div className="art-pl-scale">
          <div className="art-pl-scaletop">
            <span className="art-pl-rowk">{t('ui.game.heatElecSlider')}</span>
            <span className="art-pl-rowv num">
              {(elecDraft ?? Math.min(elecWant, maxElecKwh)).toFixed(1)} / {maxElecKwh.toFixed(1)} kWh
            </span>
          </div>
          <span
            className={`art-pl-rail is-elec${canElec ? '' : ' is-off'}`}
            style={{ '--fill': `${rangePct(elecDraft ?? elecValue, maxElecKwh)}%` } as CSSProperties}
          >
            <span className="art-pl-rail-ticks" aria-hidden />
            <span className="art-pl-rail-fill" aria-hidden />
            <input
              type="range"
              className="art-pl-range"
              min={0}
              max={Math.max(0.1, maxElecKwh)}
              step={0.1}
              value={elecDraft ?? elecValue}
              disabled={!canElec}
              onChange={(e) => setElecDraft(Number(e.target.value))}
              onPointerUp={commit}
              onKeyUp={commit}
              onBlur={commit}
              aria-label={t('ui.game.heatElecSlider')}
            />
          </span>
        </div>
      )}

      {fuelOn && (
        <div className="art-pl-scale">
          <div className="art-pl-scaletop">
            <span className="art-pl-rowk">{t('ui.game.heatFuelSlider')}</span>
            <span className="art-pl-rowv num">
              {(fuelDraft ?? Math.min(fuelWant, maxFuelL)).toFixed(1)} / {maxFuelL.toFixed(1)} L
            </span>
          </div>
          <span
            className={`art-pl-rail is-fuel${canFuel ? '' : ' is-off'}`}
            style={{ '--fill': `${rangePct(fuelDraft ?? fuelValue, maxFuelL)}%` } as CSSProperties}
          >
            <span className="art-pl-rail-ticks" aria-hidden />
            <span className="art-pl-rail-fill" aria-hidden />
            <input
              type="range"
              className="art-pl-range"
              min={0}
              max={Math.max(0.1, maxFuelL)}
              step={0.1}
              value={fuelDraft ?? fuelValue}
              disabled={!canFuel}
              onChange={(e) => setFuelDraft(Number(e.target.value))}
              onPointerUp={commit}
              onKeyUp={commit}
              onBlur={commit}
              aria-label={t('ui.game.heatFuelSlider')}
            />
          </span>
        </div>
      )}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   右栅：供电（纸面效率表 + 负荷台账）
   ============================================================ */

function PlanGauge({
  efficiency,
  weather,
  weatherMult,
  disaster,
  disasterMult,
  batteryRatio,
}: {
  efficiency: number;
  weather: WeatherId;
  weatherMult: number;
  disaster: DisasterId;
  disasterMult: number;
  batteryRatio: number;
}) {
  const fill = Math.max(0, Math.min(1, efficiency));
  const pct = Math.round(efficiency * 100);
  const factors: Array<{ id: string; label: string; tip: string }> = [
    { id: 'weather', label: WEATHER_NAME[weather], tip: t('ui.power.factorTip', { n: weatherMult.toFixed(2) }) },
  ];
  if (disasterMult !== 1) {
    const label = disasterFactorLabel(disaster);
    if (label) factors.push({ id: 'disaster', label, tip: t('ui.power.factorTip', { n: disasterMult.toFixed(2) }) });
  }

  return (
    <div className="art-pl-gauge">
      <div className="art-pl-gaugesvg" title={t('ui.power.efficiencyPct', { n: pct })}>
        {/* 发电效率 / 蓄电量：一张图两个形状，各自填色高度表示，中间那条电缆就是链接关系 */}
        <PlanPowerFigure eff={fill} batt={batteryRatio} />
        <span className="art-pl-gaugepct num">{t('ui.power.efficiencyPct', { n: pct })}</span>
      </div>
      <div className="art-pl-gaugeinfo">
        <span className="art-pl-gaugek">{t('ui.power.efficiency')}</span>
        <span className="art-pl-factors">
          {factors.map((f) => (
            <span key={f.id} className="art-pl-tag" title={f.tip}>
              {f.label}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

export function PlanPowerColumn({ run }: { run: RunState }) {
  const setPowerPriority = useGame((s) => s.setPowerPriority);
  const togglePowerLoad = useGame((s) => s.togglePowerLoad);
  const power = cachedPower(run);
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

  // 换位必须对**完整** mergedPriority 做，不能对过滤后的 order —— 否则有隐藏行时序号会跳错
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
    <section className="art-pl-col" aria-label={t('ui.game.powerLabel')}>
      <h3 className="art-pl-colname">{t('ui.game.powerLabel')}</h3>

      {isPrep && <p className="art-pl-prepinline">{t('ui.power.gridOk')}</p>}

      <PlanGauge
        efficiency={efficiency}
        weather={run.world.weather}
        weatherMult={power.weatherMult}
        disaster={run.world.disaster}
        disasterMult={isPrep ? 1 : power.disasterMult}
        batteryRatio={power.batteryCap > 0 ? Math.min(1, power.batteryStored / power.batteryCap) : 0}
      />

      <div className="art-pl-supply">
        {power.grid > 0 && <p>{t('ui.power.grid', { n: power.grid.toFixed(1) })}</p>}
        {(power.batteryStored > 0 || power.batteryCap > 0) && (
          <p>
            {t('ui.power.batt', { stored: power.batteryStored.toFixed(1), cap: power.batteryCap })}
            {power.battery > 0 ? t('ui.power.discharge', { n: power.battery.toFixed(1) }) : ''}
            {power.batteryGain > 0 ? t('ui.power.charge', { n: power.batteryGain.toFixed(1) }) : ''}
          </p>
        )}
        {run.modules.power >= 3 && (
          <p>
            {power.generator > 0
              ? t('ui.power.dieselOn', { gen: power.generator.toFixed(1), fuel: power.fuelBurn.toFixed(1) })
              : t('ui.power.dieselIdle')}
          </p>
        )}
        <p className="art-pl-tonight">
          {t('ui.power.tonight')}
          <span className="num">{power.output.toFixed(1)}</span>
          {t('ui.power.demand')}
          <span className="num">{power.demand.toFixed(1)}</span> kWh
        </p>
      </div>

      <div className="art-pl-ledgerhead">{t('ui.power.table')}</div>
      <ul className="art-pl-ledger">
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
            <li key={id} className="art-pl-load">
              <span className="art-pl-loadno num" aria-hidden>
                {idx + 1}
              </span>
              <span className="art-pl-loadmain">
                <span className="art-pl-loadtop">
                  <span className="art-pl-loadname">{LOAD_NAME[id]}</span>
                  <span className="art-pl-loadkwh num">{t('ui.power.kwh', { n: kwh.toFixed(2) })}</span>
                  <span className={`art-pl-tag${wanted ? (online ? ' is-ok' : ' is-bad') : ''}`}>
                    {wanted ? (online ? t('ui.power.on') : t('ui.power.off')) : t('ui.power.closed')}
                  </span>
                </span>
                {id === 'lights' && <span className="art-pl-loadsub">{t('ui.power.lights')}</span>}
                {id === 'fridge' && <span className="art-pl-loadsub">{t('ui.power.fridge')}</span>}
                {id === 'heater' && (
                  <span className="art-pl-loadsub">
                    {t('ui.power.heater', { n: run.heatTarget ?? COLD.COMFORT, kwh: kwh.toFixed(1) })}
                  </span>
                )}
                {id === 'airFilter' && <span className="art-pl-loadsub">{t('ui.power.air')}</span>}
                {id === 'radio' && <span className="art-pl-loadsub">{t('ui.power.radio')}</span>}
              </span>
              <span className="art-pl-loadops">
                <button
                  type="button"
                  className="art-pl-rankbtn"
                  disabled={idx === 0}
                  onClick={() => move(id, -1)}
                  aria-label={t('ui.common.up')}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="art-pl-rankbtn"
                  disabled={idx === order.length - 1}
                  onClick={() => move(id, 1)}
                  aria-label={t('ui.common.down')}
                >
                  ▼
                </button>
                <button
                  type="button"
                  className={`art-pl-switch${wanted ? ' is-on' : ''}`}
                  aria-pressed={wanted}
                  onClick={() => togglePowerLoad(id, !wanted)}
                >
                  {wanted ? t('ui.plan.stampOn') : t('ui.plan.stampOff')}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
