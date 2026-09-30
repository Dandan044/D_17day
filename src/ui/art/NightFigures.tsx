import type { CSSProperties } from 'react';

import { COLD } from '../../game/balance';
import { RES_NAME, RES_UNIT, TIER_NAMES } from '../../game/copy/names';
import { t } from '../../game/copy/t';
import { comfortTemp, survivalTemp } from '../../game/engine/climate';
import { SINGLE_NEED, dailyNeeds, stockDays } from '../../game/engine/economy';
import { exposureTier } from '../../game/engine/exposure';
import type { LedgerNote } from '../../game/engine/ledger';
import type { NightReport } from '../../game/engine/run';
import { waterCapacity } from '../../game/engine/tags';
import type { RunState, ValueIconId } from '../../game/types';
import { ValueIcon } from '../icons';
import { EyeFigure } from './EyeFigure';
import { LineFig, THERMO_TICKS, scalePct } from './LineFig';
import LINEFIG from './linefigLayout.json';
import { ART } from './skin';
import './art.css';

/**
 * 过夜那一晚的**四块图解**。
 *
 * 原来这一屏是「一列文字」——结算条目、HP 明细、环境行、三个大数，读得出但看不出。
 * 这里把其中四件事画成图，**原来的每一行都退成图下的附注，一条不删**：
 *
 * 1. `FigHpWaterfall` —— 生命瀑布：条宽 100% = 生命上限 100，一格 1 点。从「昨夜」竖线起，
 *    按 `hpParts` 逐段左移（掉血·朱红）/右移（回血·墨绿），落在「今晨」竖线上。
 * 2. `FigLedger` —— 消耗对账：油、电两条「估 vs 实扣」的对账条；食、水走线稿填色 + 剩余天数。
 * 3. `FigTemp` —— 夜间温度：竖温度计上一短一中一长三根针（室外 / 估室内 / 实际）。
 * 4. `FigExposure` —— 暴露度小图：瞳孔开度即档位，配数值与昨晚的增减。
 *
 * ## 两个必须守住的坐标真源
 *
 * - **温度计**：三根针、0° 刻度、舒适/生存线**全部**经 `scalePct()` 换算，刻度点取 `THERMO_TICKS`。
 *   自己写一套线性映射，两屏的温差刻度立刻不一致（`scalePct` 在 0° 以下是非线性的）。
 * - **生命瀑布**：条宽与坐标都用「1 点 = 1%」，不做任何缩放，也就不会出现两处各算一次的比例。
 *
 * ## 生命瀑布为什么要补一段「（其余：取整与溢出）」
 *
 * `health.ts` 的 `hit()` 每项都 `Math.round(amount * 10) / 10`，还把 `run.stats.hp` 夹在 `[0, 100]`；
 * 而 `hpDelta` 是 `Math.round(真实差值)`。于是 `hpDelta − ΣhpParts.value` 常常不是 0
 * （逐项取整的残差，或掉血掉到 0 后继续扣的溢出）。不补这一段，瀑布的终点就闭合不到 `hpAfter`，
 * 图会「差一截」而看的人只会以为自己读错了。
 */

/* ============================================================
   1. 生命瀑布
   ============================================================ */

/** 段宽小于这个值就把标签挪到条下的引线列表（条里塞不下三个字） */
const MIN_INLINE_PCT = 6;

export function FigHpWaterfall({ r }: { r: NightReport }) {
  const parts = (r.hpParts ?? []).filter((p) => p.value !== 0);
  const after = r.hpAfter ?? 0;
  const delta = r.hpDelta ?? 0;
  const start = after - delta;
  // 取整残差 + 溢出：|残差| ≥ 0.05 才补（低于这个数是纯浮点噪声，补出来是个看不见的线头）
  const residual = Math.round((after - (start + parts.reduce((s, p) => s + p.value, 0))) * 100) / 100;

  interface Seg {
    label: string;
    from: number;
    to: number;
    value: number;
    residual?: boolean;
    /** 段太窄，标签得走条下的引线列表 */
    outside?: boolean;
    /** 引线列表里的编号 */
    n?: number;
  }
  const segs: Seg[] = [];
  let cur = start;
  for (const p of parts) {
    segs.push({ label: p.label, from: cur, to: cur + p.value, value: p.value });
    cur += p.value;
  }
  if (Math.abs(residual) >= 0.05) {
    segs.push({ label: t('ui.night.figHpRest'), from: cur, to: after, value: residual, residual: true });
  }
  let n = 0;
  for (const s of segs) {
    if (Math.abs(s.to - s.from) < MIN_INLINE_PCT) {
      s.outside = true;
      s.n = ++n;
    }
  }
  const outside = segs.filter((s) => s.outside);

  /** 1 点 = 1%：条宽就是点数，不做缩放 */
  const pos = (v: number) => `${Math.max(0, Math.min(100, v))}%`;
  const clampPct = (v: number) => Math.max(0, Math.min(100, v));
  /** 轴标签贴边会被裁掉一半，往内收 4% */
  const labPos = (v: number) => `${Math.max(4, Math.min(96, v))}%`;
  /** 段要按条范围裁一下：掉血掉穿到 0 以下时，`left/width` 会伸到条外面去 */
  const clipSeg = (s: Seg) => {
    const lo = Math.max(0, Math.min(s.from, s.to));
    const hi = Math.min(100, Math.max(s.from, s.to));
    return { lo, hi, visible: hi - lo > 0.02 };
  };

  return (
    <div className="art-nf-fall" data-fall>
      <div className="art-nf-falltrack">
        {/* 0–100 的稀疏参考线（每 25 点），让「掉了多少」有个尺子 */}
        {[25, 50, 75].map((v) => (
          <span key={v} className="art-nf-rule" style={{ left: pos(v) }} aria-hidden />
        ))}

        {segs.map((s, i) => {
          const c = clipSeg(s);
          if (!c.visible) return null;
          return (
            <span
              key={i}
              className={`art-nf-seg${s.residual ? ' is-rest' : s.value > 0 ? ' is-up' : ' is-down'}${
                s.outside ? ' is-narrow' : ''
              }`}
              style={{ left: pos(c.lo), width: `${c.hi - c.lo}%` } as CSSProperties}
              data-seg={s.value}
              title={`${s.value > 0 ? '+' : ''}${s.value} ${s.label}`}
            >
              {!s.outside && (
                <em className="art-nf-seglab">
                  {s.value > 0 ? '+' : ''}
                  {s.value}
                </em>
              )}
              {s.outside && <b className="art-nf-segn num">{s.n}</b>}
            </span>
          );
        })}

        <span className="art-nf-mark is-start" style={{ left: pos(clampPct(start)) }} aria-hidden />
        <span className="art-nf-mark is-end" style={{ left: pos(clampPct(after)) }} aria-hidden />
      </div>

      <div className="art-nf-fallaxis" data-start={Math.round(start * 10) / 10} data-end={after}>
        <span style={{ left: labPos(clampPct(start)) }}>{t('ui.night.figHpStart')}</span>
        <span className="is-end" style={{ left: labPos(clampPct(after)) }}>
          {t('ui.night.figHpEnd')}
        </span>
      </div>

      {outside.length > 0 && (
        <ul className="art-nf-falllist">
          {outside.map((s) => (
            <li key={s.n}>
              <b className="num">{s.n}</b>
              <span className="num is-val">
                {s.value > 0 ? '+' : ''}
                {s.value}
              </span>
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============================================================
   2. 消耗对账
   ============================================================ */

/** 油/电：两条同底的条，长的那条决定刻度 —— 于是「超了多少」是看出来的，不是算出来的。
 *  条底用同一条基线、归一化到 `max(估, 实扣)`，所以「哪条长」即答案。 */
function LedgerRow({ kind, budget, spent }: { kind: 'fuel' | 'kwh'; budget: number; spent: number }) {
  const max = Math.max(budget, spent, 0.01);
  const over = spent - budget;
  const overPct = (Math.abs(over) / Math.max(budget, 0.01)) * 100;
  const tone = Math.abs(over) < 0.05 ? 'is-even' : over > 0 ? 'is-over' : 'is-under';
  return (
    <div className={`art-nf-ledger ${tone}`} data-ledger={kind} data-over={Math.round(over * 100) / 100}>
      <span className="art-nf-ledgerk">{kind === 'fuel' ? RES_NAME.fuel : t('ui.game.power')}</span>
      <span className="art-nf-ledgerread">
        <span className="num">
          {budget.toFixed(1)} → {spent.toFixed(1)}
        </span>
        {Math.abs(over) >= 0.05 && (
          <em className="art-nf-ledgerdif num">
            {over > 0 ? t('ui.night.figResOver') : t('ui.night.figResUnder')} {Math.round(overPct)}%
          </em>
        )}
      </span>
      <span className="art-nf-ledgerbars">
        <span className="art-nf-bar is-est">
          <em>{t('ui.night.figResEst')}</em>
          <span className="art-nf-bartrack">
            <i style={{ width: `${(budget / max) * 100}%` }} />
          </span>
        </span>
        <span className="art-nf-bar is-spent">
          <em>{t('ui.night.figResSpent')}</em>
          <span className="art-nf-bartrack">
            <i style={{ width: `${(spent / max) * 100}%` }} />
          </span>
        </span>
      </span>
    </div>
  );
}

/** 食/水：线稿填色 + 「剩 N 天」。填色分母**必须与清点单同源**，否则同一份库存两屏两个高度 */
function StockCell({ kind, ratio, days, value, unit }: { kind: 'food' | 'water'; ratio: number; days: number; value: string; unit: string }) {
  const fig =
    kind === 'water'
      ? { line: ART.lineWater, mask: ART.lineWaterMask, aspect: LINEFIG.water.aspect, color: 'var(--pp-blue)' }
      : { line: ART.lineRation, mask: ART.lineRationMask, aspect: LINEFIG.ration.aspect, color: 'var(--pp-green)' };
  return (
    <div className={`art-nf-stock is-${kind}`} data-stock={kind} data-days={Math.round(days * 10) / 10}>
      <span className="art-nf-stockfig">
        <LineFig
          line={fig.line}
          mask={fig.mask}
          aspect={fig.aspect}
          fills={[{ from: 0, to: Math.max(0, Math.min(1, ratio)), color: fig.color }]}
        />
      </span>
      <span className="art-nf-stockinfo">
        <b className="art-nf-stockk">{kind === 'water' ? t('ui.game.water') : t('ui.game.food')}</b>
        <span className="art-nf-stockread num">
          {value}
          <em>{unit}</em>
        </span>
        <span className="art-nf-stockdays num">
          {Number.isFinite(days) && days < 100
            ? t('ui.night.figResDays', { n: days < 10 ? days.toFixed(1) : Math.round(days) })
            : '—'}
        </span>
      </span>
    </div>
  );
}

export function FigLedger({ run, r }: { run: RunState; r: NightReport }) {
  const foodHave = run.res.foodStaple + run.res.foodFresh;
  const foodCap = Math.max(1, 7 * dailyNeeds(run, run.difficulty).food);
  const waterCap = Math.max(1, waterCapacity(run));
  const foodDays = stockDays(foodHave, SINGLE_NEED.food);
  const waterDays = stockDays(run.res.water, SINGLE_NEED.water);
  const hasOil = (r.fuelBudget ?? 0) > 0;
  const hasKwh = (r.kwhBudget ?? 0) > 0;

  return (
    <div className="art-nf-ledgerwrap">
      {hasOil && <LedgerRow kind="fuel" budget={r.fuelBudget ?? 0} spent={r.fuelSpent ?? 0} />}
      {hasKwh && <LedgerRow kind="kwh" budget={r.kwhBudget ?? 0} spent={r.kwhSpent ?? 0} />}
      <div className="art-nf-stocks">
        <StockCell
          kind="food"
          ratio={foodHave / foodCap}
          days={foodDays}
          value={String(Math.round(foodHave))}
          unit={RES_UNIT.foodStaple}
        />
        <StockCell
          kind="water"
          ratio={run.res.water / waterCap}
          days={waterDays}
          value={String(Math.round(run.res.water * 10) / 10)}
          unit={RES_UNIT.water}
        />
      </div>
    </div>
  );
}

/* ============================================================
   3. 夜间温度
   ============================================================ */

export function FigTemp({ run, r }: { run: RunState; r: NightReport }) {
  const TB = LINEFIG.thermo.tube;
  const comfort = comfortTemp(run);
  const survival = survivalTemp(run);
  const outdoor = r.outdoor ?? COLD.PREP_INDOOR;
  const est = r.previewIndoor ?? r.indoor ?? outdoor;
  const inside = r.indoor ?? outdoor;
  /** 管腔里的百分比 → 温度计整体高度里的 bottom；刻度、色柱、三根针共用这一支 */
  const markAt = (pct: number) => `${((1 - TB[3]) * 100 + (TB[3] - TB[1]) * pct).toFixed(2)}%`;
  const needleLeft = `${TB[0] * 100}%`;

  return (
    <div className="art-nf-temp">
      <div className="art-nf-thermo">
        <LineFig
          line={ART.lineThermo}
          mask={ART.lineThermoMask}
          aspect={LINEFIG.thermo.aspect}
          fills={[{ from: 0, to: scalePct(inside) / 100, color: inside < survival ? 'var(--pp-red)' : inside < comfort ? 'var(--pp-ochre)' : 'var(--pp-green)' }]}
        />
        {THERMO_TICKS.map((v) => (
          <span
            key={v}
            className={`art-nf-tick${v % 10 === 0 ? ' is-major' : ''}${v === 0 ? ' is-zero' : ''}`}
            style={{ bottom: markAt(scalePct(v)) }}
            aria-hidden
          />
        ))}
        <span className="art-nf-tmark is-survival" style={{ bottom: markAt(scalePct(survival)) }}>
          {t('ui.game.heatSurvival')} {Math.round(survival)}°
        </span>
        <span className="art-nf-tmark is-comfort" style={{ bottom: markAt(scalePct(comfort)) }}>
          {t('ui.game.heatComfort')} {Math.round(comfort)}°
        </span>
        {/* 三根针：短＝室外、中＝估室内、长＝实际室内。长度差就是「屋里到底比外面暖多少」 */}
        <span
          className="art-nf-needle is-out"
          style={{ left: needleLeft, bottom: markAt(scalePct(outdoor)) }}
          data-temp={outdoor}
        />
        <span
          className="art-nf-needle is-est"
          style={{ left: needleLeft, bottom: markAt(scalePct(est)) }}
          data-temp={est}
        />
        <span
          className="art-nf-needle is-in"
          style={{ left: needleLeft, bottom: markAt(scalePct(inside)) }}
          data-temp={inside}
        />
      </div>

      <ul className="art-nf-tempreads">
        <li className="is-out">
          <b aria-hidden />
          {t('ui.night.figTempOut')}
          <span className="num">{Math.round(outdoor * 10) / 10}°</span>
        </li>
        <li className="is-est">
          <b aria-hidden />
          {t('ui.night.figTempEst')}
          <span className="num">{Math.round(est * 10) / 10}°</span>
        </li>
        <li className="is-in">
          <b aria-hidden />
          {t('ui.night.figTempIn')}
          <span className="num">{Math.round(inside * 10) / 10}°</span>
        </li>
      </ul>
    </div>
  );
}

/* ============================================================
   4. 暴露度
   ============================================================ */

export function FigExposure({ run, r }: { run: RunState; r: NightReport }) {
  const after = r.exposureAfter ?? run.world.exposure;
  const tier = exposureTier(after);
  return (
    <div className="art-nf-eye" data-tier={tier}>
      <EyeFigure tier={tier} size={92} variant="on-paper" label={TIER_NAMES[tier]} />
      <div className="art-nf-eyeread">
        <span className="art-nf-eyeval num">{Math.round(after * 10) / 10}</span>
        {r.exposureAdded !== 0 && (
          <em className={`art-nf-eyedelta num${r.exposureAdded > 0 ? ' is-bad' : ' is-good'}`}>
            {r.exposureAdded > 0 ? '+' : ''}
            {r.exposureAdded}
          </em>
        )}
        <span className="art-nf-eyek">{t('ui.night.exposure')}</span>
      </div>
    </div>
  );
}

/* ============================================================
   结算条目：按 icon 归成六栏，逐条原文保留
   ============================================================ */

type GroupId = 'resource' | 'power' | 'health' | 'exposure' | 'consumable' | 'other';

/** 图标 → 栏。没登记的图标落「附注」，不静默丢 */
const GROUP_OF: Record<string, GroupId> = {
  water: 'resource',
  foodStaple: 'resource',
  foodFresh: 'resource',
  meds: 'resource',
  fuel: 'resource',
  materials: 'resource',
  parts: 'resource',
  ammo: 'resource',
  cash: 'resource',
  battery: 'power',
  hp: 'health',
  stamina: 'health',
  sanity: 'health',
  humanity: 'health',
  reputation: 'health',
  exposure: 'exposure',
  cartridge: 'consumable',
  ap: 'consumable',
};

const GROUP_NAME: Record<GroupId, string> = {
  resource: 'figGroupResource',
  power: 'figGroupPower',
  health: 'figGroupHealth',
  exposure: 'figGroupExposure',
  consumable: 'figGroupConsumable',
  other: 'figGroupOther',
};

const GROUP_ORDER: GroupId[] = ['resource', 'power', 'health', 'exposure', 'consumable', 'other'];

const groupOf = (icon?: ValueIconId): GroupId => (icon ? (GROUP_OF[icon] ?? 'other') : 'other');

const toneOf = (tone?: string) => (tone === 'good' ? ' is-good' : tone === 'bad' ? ' is-bad' : '');

export function FigNotes({ notes }: { notes: LedgerNote[] }) {
  const cols = GROUP_ORDER.map((id) => ({
    id,
    name: t(`ui.night.${GROUP_NAME[id]}`),
    rows: notes.filter((n) => groupOf(n.icon) === id),
  })).filter((c) => c.rows.length > 0);
  if (cols.length === 0) return null;
  return (
    <div className="art-nf-notes" data-cols={cols.length}>
      {cols.map((c) => (
        <section key={c.id} className={`art-nf-note is-${c.id}`}>
          <div className="art-nf-notek">
            {c.name}
            <em className="num">{c.rows.length}</em>
          </div>
          {c.rows.map((n, i) => (
            <p key={i} className={`art-nf-noterow${toneOf(n.tone)}`}>
              {n.icon ? (
                <ValueIcon id={n.icon} className="art-nf-noteico" />
              ) : (
                <span className="art-nf-notemk" aria-hidden>
                  ·
                </span>
              )}
              <span>{n.text}</span>
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
