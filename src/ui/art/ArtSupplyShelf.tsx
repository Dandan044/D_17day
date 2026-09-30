import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { RES_NAME, RES_UNIT } from '../../game/copy/names';
import { t } from '../../game/copy/t';
import { TIME } from '../../game/balance';
import { SINGLE_NEED, dailyNeeds, stockDays } from '../../game/engine/economy';
import { batteryCapacity } from '../../game/engine/power';
import { waterCapacity } from '../../game/engine/tags';
import { useGame } from '../../game/store';
import type { ResourceId, RunState } from '../../game/types';
import { LineFig } from './LineFig';
import LINEFIG from './linefigLayout.json';
import { ART } from './skin';
import './art.css';
import { siteOf } from '../../game/content/lookup';

/**
 * 物资：纸面清点单。
 *
 * 点局内那面木货架的热点打开。**架上还剩多少，已经由场景里的货架本身表达了**——
 * 货架贴图按「口粮档 × 用水档」切成 25 态（见 shelfLayout.json），所以这里不再画货架。
 *
 * 两段结构：
 * 1. **三格水位表**（水 / 口粮 / 蓄电）—— 这三样有「容器」，装满多少是有意义的信息，
 *    所以走**线稿填色**：一眼看出是半箱水还是见底，比 `58.5 L` 这种数字直接得多。
 *    线稿复用今日计划那三张（`line-water` / `line-ration` / `line-power`），
 *    **色值也刻意与计划表一致**（口粮墨绿、水靛蓝、蓄电赭），同一份库存在两屏是同一个颜色。
 * 2. **另存物资**：其余六项（药品/燃料/建材/零件/弹药/现金）没有对应线稿，
 *    硬画一张图只会误导（「建材」画什么？），所以保留数字行。
 *
 * 与经典皮肤的 `SuppliesPanel`（`Game.tsx` 里经典三栏那一栏）对齐，**一项都不能少**：
 * 九项资源各自的数值与单位、口粮的分项（耐储 / 生鲜）、水与口粮的「约够 N 天」、
 * 蓄电池余量与总容量、以及「剩不到 3 天」的告警色。
 *
 * 三处与经典口径一致但值得写下来：
 * - 水的填色分母是**水箱容量**（`waterCapacity`），天数分母是**单人标准日需求**（`SINGLE_NEED.water`）
 *   ——两个分母用途不同，不是笔误；
 * - 口粮的填色分母是 **`7 × dailyNeeds(run).food`**，与 `ArtPlanSheet` 的「7 天口粮」同源，
 *   两边必须一模一样，否则同一份口粮在两屏显示成两个高度；
 * - 蓄电池的线稿是从 `line-power` 的右半裁出来的（`linefigLayout.json` 的 `batt` bbox，
 *   由 `scripts/make-art-linefig.py` 量出）——`right` 的左沿切在那条电缆上，直接用会带进一段电缆弧。
 *
 * 两处**刻意不同**（本屏原有口径，非本次改动）：
 * - 天数是「单人标准」（`SINGLE_NEED` + `ui.supplies.days`），经典那栏用的是
 *   `dailyNeeds`（含同伴与难度）的 `ui.game.daysWater/daysFood`。告警阈值就跟着**屏上显示的那个数**，
 *   不另算一套 —— 否则会出现「写着 2.8 天却不告警」。
 * - 经典给「生鲜食物」挂了个会坏的 hover 提示；口粮并成一格后没有落点，未保留。
 */

const SHEET_OUT_MS = 240;

/** 「另存物资」的行顺序：三样有容器的已提上水位表，这里只剩数字行 */
const RES_ORDER: ResourceId[] = ['meds', 'fuel', 'materials', 'parts', 'ammo', 'cash'];

/** 「约够 N 天（单人标准）」；Infinity / 极大值走兜底文案。 */
function daysText(days: number): string {
  if (!Number.isFinite(days) || days >= 100) return t('ui.supplies.daysInf');
  return t('ui.supplies.days', { n: days < 10 ? days.toFixed(1) : Math.round(days) });
}

/** 与清单行同一个取整口径：现金取整，其余一位小数 */
const fmtRes = (id: ResourceId, v: number) => (id === 'cash' ? String(Math.round(v)) : String(Math.round(v * 10) / 10));

/* ============================================================
   蓄电格的线稿：从 line-power 右半裁出电池柜
   ============================================================ */

function PowerGaugeFig({ ratio }: { ratio: number | null }) {
  const p = LINEFIG.power;
  const [x0, y0, x1, y1] = p.batt;
  const rw = x1 - x0;
  const rh = y1 - y0;
  // 裁剪框里的那张完整线稿：放大到 1/rw（宽）与 1/rh（高），再往左上推出被裁掉的那块。
  const inner: CSSProperties = {
    width: `${100 / rw}%`,
    height: `${100 / rh}%`,
    left: `${(-x0 / rw) * 100}%`,
    top: `${(-y0 / rh) * 100}%`,
  };
  // ⚠️ 填色是**按整张画幅的高度**算的（`LineFig` 的 `--fill-b/--fill-h` 是元素高度的百分比），
  // 而电池柜只占画幅的 `y0..y1` 那一段。直接传 `ratio` 会把「柜体的 79%」画成「画幅的 79%」——
  // 在这张裁图里看出偏差近 5 个百分点（79% 读成 83%）。所以要先把比例换算回画幅坐标：
  // 底边从画幅底部 `1 - y1` 起，高度＝`ratio × rh`。
  const fills = ratio === null ? [] : [{ from: 1 - y1, to: 1 - y1 + ratio * rh, color: 'var(--sh-ochre-lt)' }];
  return (
    <span className="art-shelf-crop" style={{ aspectRatio: String((rw * p.aspect) / rh) }}>
      <span className="art-shelf-cropshift" style={inner}>
        <LineFig
          line={ART.linePower}
          mask={ART.linePowerMask}
          aspect={p.aspect}
          fills={fills}
          className="is-cropped"
        />
      </span>
    </span>
  );
}

/* ============================================================
   水位表三格
   ============================================================ */

function Gauge({
  tone,
  name,
  ratio,
  value,
  unit,
  days,
  note,
  low,
  figure,
}: {
  tone: 'water' | 'food' | 'power';
  name: string;
  /** 占容器比例 0..1；`null` = 没有容器（引擎当前保证分母恒 > 0，这是护栏） */
  ratio: number | null;
  value: string;
  unit: string;
  days?: string;
  note?: string;
  /** 剩不到 3 天：读数转告警色（沿用经典 SuppliesPanel 的阈值与口径） */
  low?: boolean;
  figure: ReactNode;
}) {
  return (
    <figure className={`art-shelf-gauge is-${tone}${low ? ' is-low' : ''}`} data-gauge={tone}>
      <span className="art-shelf-gaugename">{name}</span>
      <span className="art-shelf-gaugebox">
        {figure}
        {ratio === null && <b className="art-shelf-nocap">{t('ui.supplies.gaugeNoCap')}</b>}
      </span>
      <figcaption className="art-shelf-gaugeread">
        <span className="art-shelf-gaugeval num">
          {value}
          <em>{unit}</em>
        </span>
        <span className="art-shelf-gaugepct num" data-pct={ratio === null ? '' : Math.round(ratio * 100)}>
          {ratio === null ? '—' : t('ui.supplies.gaugeOf', { n: Math.round(ratio * 100) })}
        </span>
        {days && <span className="art-shelf-gaugedays">{days}</span>}
        {note && <span className="art-shelf-gaugenote">{note}</span>}
      </figcaption>
    </figure>
  );
}

export function ArtSupplyShelf({ run }: { run: RunState }) {
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

  const site = siteOf(run.siteId);
  const companionCap = site?.companionCap ?? 0;

  // 天数口径＝单人标准人日：stockDays(库存, 单人 normal 档需求)
  const foodHave = run.res.foodStaple + run.res.foodFresh;
  const foodDays = stockDays(foodHave, SINGLE_NEED.food);
  const waterDays = stockDays(run.res.water, SINGLE_NEED.water);

  // 填色分母：水＝水箱物理容量；口粮＝7 天口粮（与 ArtPlanSheet 同源）；电＝蓄电池容量
  const waterCap = waterCapacity(run);
  const foodCap = Math.max(1, 7 * dailyNeeds(run, run.difficulty).food);
  const battCap = batteryCapacity(run);
  const battStored = run.wear.batteryCharge ?? 0;
  const clamp01 = (r: number) => Math.max(0, Math.min(1, r));
  const waterRatio = waterCap > 0 ? clamp01(run.res.water / waterCap) : null;
  const foodRatio = foodCap > 0 ? clamp01(foodHave / foodCap) : null;
  const battRatio = battCap > 0 ? clamp01(battStored / battCap) : null;

  const supplyWarn = run.wear.filterLife <= 0 && (run.modules.filter > 0 || run.modules.airFilter > 0);

  // 「剩不到 3 天」＝告警（阈值照经典 SuppliesPanel）。
  // 准备期自来水还在供、超市还开着，一切都够用，所以整块告警在灾前不亮。
  const isPrep = run.day < TIME.COLLAPSE_DAY;
  const lowStock = (days: number) => !isPrep && days < 3;

  /** 口粮的分项：水位表把「耐储 / 生鲜」两行并成了一格，两个数字必须都留着 */
  const foodSplit = `${RES_NAME.foodStaple} ${fmtRes('foodStaple', run.res.foodStaple)} ${RES_UNIT.foodStaple} · ${RES_NAME.foodFresh} ${fmtRes('foodFresh', run.res.foodFresh)} ${RES_UNIT.foodFresh}`;

  return (
    <div
      className={`art-shelf-veil${closing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('ui.game.supplies')}
    >
      <div className="art-shelf-room" style={{ backgroundImage: `url(${ART.sceneHomeDesk})` }} aria-hidden />

      <div className="art-shelf-sheet">
        <div className="art-shelf-paper" style={{ backgroundImage: `url(${ART.planPaper})` }} aria-hidden />

        <div className="art-shelf-frame">
          <span className="art-paper-tick is-tl" aria-hidden />
          <span className="art-paper-tick is-tr" aria-hidden />
          <span className="art-paper-tick is-bl" aria-hidden />
          <span className="art-paper-tick is-br" aria-hidden />

          <header className="art-shelf-head">
            <span className="art-shelf-stamp num">{t('ui.supplies.kicker')}</span>
            <div className="art-shelf-headmain">
              <h2 className="art-shelf-title">{t('ui.game.supplies')}</h2>
              <p className="art-shelf-sub">
                {t('ui.supplies.subtitle')} · {site?.name}
              </p>
            </div>
            <button type="button" className="art-shelf-close" onClick={close}>
              {t('ui.common.close')}
              <span aria-hidden>✕</span>
            </button>
          </header>

          <div className="art-shelf-body is-ledger">
            {/* ---- 三格水位表 ---- */}
            <div className="art-shelf-gauges">
              <Gauge
                tone="water"
                name={t('ui.supplies.gaugeWater')}
                ratio={waterRatio}
                value={String(Math.round(run.res.water * 10) / 10)}
                unit={RES_UNIT.water}
                days={daysText(waterDays)}
                low={lowStock(waterDays)}
                figure={
                  <LineFig
                    line={ART.lineWater}
                    mask={ART.lineWaterMask}
                    aspect={LINEFIG.water.aspect}
                    fills={waterRatio === null ? [] : [{ from: 0, to: waterRatio, color: 'var(--sh-blue-lt)' }]}
                  />
                }
              />
              <Gauge
                tone="food"
                name={t('ui.supplies.gaugeFood')}
                ratio={foodRatio}
                value={String(Math.round(foodHave))}
                unit={RES_UNIT.foodStaple}
                days={daysText(foodDays)}
                low={lowStock(foodDays)}
                note={foodSplit}
                figure={
                  <LineFig
                    line={ART.lineRation}
                    mask={ART.lineRationMask}
                    aspect={LINEFIG.ration.aspect}
                    fills={foodRatio === null ? [] : [{ from: 0, to: foodRatio, color: 'var(--sh-green-lt)' }]}
                  />
                }
              />
              <Gauge
                tone="power"
                name={t('ui.supplies.gaugePower')}
                ratio={battRatio}
                value={battStored.toFixed(1)}
                unit={`/${battCap} ${t('ui.supplies.kwh')}`}
                figure={<PowerGaugeFig ratio={battRatio} />}
              />
            </div>

            {/* ---- 另存物资：六项数字行 ---- */}
            <section className="art-shelf-ledger">
              <div className="art-shelf-ledgerhead">
                <span className="art-shelf-ledgertitle">{t('ui.supplies.ledgerTitle')}</span>
                <span className="art-shelf-ledgerrule" />
              </div>
              <dl className="art-shelf-list">
                {RES_ORDER.map((r) => (
                  <div className="art-shelf-row" key={r} data-res={r}>
                    <dt>{RES_NAME[r]}</dt>
                    <dd className="num">
                      {fmtRes(r, run.res[r])}
                      <span className="art-shelf-unit">{RES_UNIT[r]}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <footer className="art-shelf-tb">
            <div className="art-shelf-tbcell">
              <span className="art-shelf-tbk">{t('ui.supplies.tbSite')}</span>
              <span className="art-shelf-tbv">{site?.name}</span>
            </div>
            <div className="art-shelf-tbcell">
              <span className="art-shelf-tbk">{t('ui.supplies.tbDate')}</span>
              <span className="art-shelf-tbv num">{t('ui.common.dayN', { n: run.day })}</span>
            </div>
            <div className="art-shelf-tbcell">
              <span className="art-shelf-tbk">{t('ui.game.ap')}</span>
              <span className="art-shelf-tbv num">
                {run.ap} / {run.apMax}
              </span>
            </div>
            <div className="art-shelf-tbcell is-entry">
              <button
                type="button"
                className={`art-shelf-btn${supplyWarn ? ' is-warn' : ''}`}
                onClick={() => setOverlay('items')}
              >
                {t('ui.supplies.items')}
              </button>
              {companionCap > 0 && (
                <button type="button" className="art-shelf-btn" onClick={() => setOverlay('crew')}>
                  {t('ui.supplies.crew')}
                </button>
              )}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
