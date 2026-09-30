import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { TIME, WEAR } from '../../game/balance';
import { ITEM_ORDER } from '../../game/content/items';
import { ITEM_NAME } from '../../game/copy/names';
import { t } from '../../game/copy/t';
import { iodineBoughtCount } from '../../game/engine/economy';
import { iodineActive } from '../../game/engine/tags';
import { useGame } from '../../game/store';
import type { RunState } from '../../game/types';
import { ART } from './skin';
import './art.css';

/**
 * 物品栏：掀开的工具箱。
 *
 * 东西只有三样（备用滤芯 / 一氧化碳报警器 / 碘片），做成「一条条清单」永远比实物远一层，
 * 所以这里直接摊成工具箱的三个凹槽：**有什么、剩几件、在不在装，看凹槽一眼就有**。
 *
 * 凹槽是 CSS 挖出来的（内阴影 + 1px 描边 + 绒面斜纹），不用位图 —— 三样东西的形都简单，
 * 画线稿比拍一张「工具箱照片」更清楚，也免掉一次生图。箱底垫的还是那张公文纸
 * （与计划表同一抽屉），但只用一小块、四周压在绒面里，读起来是「垫在箱底的纸」而不是一张公文。
 *
 * ⚠️ 与经典 `ItemsPanel`（`ui/ItemsPanel.tsx`）逐字段等价，一个都不能少：
 * 名称、数量、在装/没有、碘片生效中·至第 N 天 / 未启用、三样各自的说明、灾前那句
 * 「现在还用不上」、以及「更换滤芯 / 服用」两个按钮（含各自禁用条件）。
 *
 * `App.tsx` 给这屏做分流：档案皮肤走这里，经典皮肤仍走原 `ItemsPanel`。
 */

const SHEET_OUT_MS = 240;
/** 凹槽里最多摆几件实物，超出的走角标 `+n`（摆满就成一片墨了） */
const MAX_GLYPH = 3;
const LIFE_TONE = (life: number) => (life <= 5 ? 'bad' : life <= 12 ? 'warn' : 'good');

/* ============================================================
   凹槽里的三样实物（内联线稿，非位图）
   ============================================================ */

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/**
 * 三张线稿都 `preserveAspectRatio="xMidYMax meet"`：**底边对齐而不是居中**。
 * 默认的 xMidYMid 会在盒子上下各留一截空白（视框比画出来的东西高），
 * 摆进凹槽就成了「浮在半空」，看着像没放稳。
 */

/** 备用滤芯：立着的褶皱滤筒。viewBox 30×100，一比五 —— 细高才像滤芯。 */
function CartridgeGlyph() {
  return (
    <svg
      className="art-tbox-glyph"
      viewBox="0 0 30 100"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden
      focusable="false"
    >
      {/* 筒身 */}
      <path {...S} d="M7 14h16v68a5 5 0 0 1-5 5H12a5 5 0 0 1-5-5V14Z" />
      {/* 顶盖（椭圆透视） */}
      <path {...S} d="M7 14c0-2.2 3.6-3.6 8-3.6s8 1.4 8 3.6-3.6 3.6-8 3.6S7 16.2 7 14Z" />
      {/* 褶皱 */}
      <path {...S} d="M11.5 19v59M15 20v58M18.5 19v59" />
      {/* 底座箍 */}
      <path {...S} d="M7 78h16" />
    </svg>
  );
}

/**
 * 一氧化碳报警器：吸顶圆盘。
 *
 * 别画成「表盘 + 一圈刻度」—— 那样第一眼读成挂钟。要的是检测器的样子：
 * 盘面下半一排竖进气缝（像音箱格栅）、上方一枚小指示灯、四周一道压边。
 */
function AlarmGlyph() {
  return (
    <svg
      className="art-tbox-glyph"
      viewBox="0 0 64 70"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden
      focusable="false"
    >
      {/* 挂座 */}
      <path {...S} d="M27 13h10v5H27z" />
      {/* 盘身 + 压边 */}
      <circle {...S} cx="32" cy="41" r="24" />
      <circle {...S} strokeWidth={1.5} cx="32" cy="41" r="20" />
      {/* 进气缝：下半一排竖缝 */}
      <path {...S} strokeWidth={1.7} d="M21 38v10M26 38v10M32 38v10M38 38v10M43 38v10" />
      {/* 指示灯 */}
      <circle cx="32" cy="27" r="3" fill="currentColor" />
    </svg>
  );
}

/** 碘片：铝箔泡罩板，两行三列。 */
function IodineGlyph() {
  return (
    <svg
      className="art-tbox-glyph"
      viewBox="0 0 64 40"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden
      focusable="false"
    >
      <rect {...S} x="5" y="2" width="54" height="30" rx="3.5" />
      {/* 压边 */}
      <path {...S} d="M5 8h54M5 26h54" />
      {/* 泡罩 */}
      {[17, 32, 47].map((x) =>
        [11, 23].map((y) => <circle key={`${x}-${y}`} {...S} strokeWidth={1.6} cx={x} cy={y} r="3.9" />),
      )}
    </svg>
  );
}

const GLYPH: Record<(typeof ITEM_ORDER)[number], () => ReactElement> = {
  filter: CartridgeGlyph,
  coAlarm: AlarmGlyph,
  iodine: IodineGlyph,
};

/**
 * 凹槽里的实物堆：n 件实物并排，超过 `MAX_GLYPH` 只画前几件 + 角标。
 * `n === 0` 返回空 —— 空槽由 CSS 的虚线轮廓 + 「空槽」两个字来讲。
 */
function GlyphStack({ id, n }: { id: (typeof ITEM_ORDER)[number]; n: number }) {
  const Glyph = GLYPH[id];
  if (n <= 0) return null;
  const shown = Math.min(n, MAX_GLYPH);
  return (
    <div className={`art-tbox-stack is-${id}`}>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className="art-tbox-piece" style={{ zIndex: shown - i }}>
          <Glyph />
        </span>
      ))}
      {n > MAX_GLYPH && <b className="art-tbox-more num">+{n - MAX_GLYPH}</b>}
    </div>
  );
}

/* ============================================================
   面板
   ============================================================ */

export function ArtItemsPanel({ run }: { run: RunState }) {
  const setOverlay = useGame((s) => s.setOverlay);
  const useItem = useGame((s) => s.useItem);
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

  const isPrep = run.day < TIME.COLLAPSE_DAY;
  const cartridgeCount = run.items?.filter ?? 0;
  const cartridgeLife = run.wear?.filterLife ?? 0;
  const alarmOwned = run.flags.includes('flag:coAlarm');
  const iodineCount = iodineBoughtCount(run);
  const iodineOn = iodineActive(run);

  /** 凹槽左下角的「有几件」：有就是备用数，空就直接说空 */
  const stockLine = (n: number) =>
    n > 0 ? t('ui.items.boxSpare', { n }) : t('ui.items.boxEmpty');

  const slotClass = (filled: boolean) => `art-tbox-slot${filled ? '' : ' is-empty'}`;

  return (
    <div
      className={`art-tbox-veil${closing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('ui.items.boxTitle')}
    >
      <div className="art-tbox-room" style={{ backgroundImage: `url(${ART.sceneHomeDesk})` }} aria-hidden />

      <div className="art-tbox-case">
        {/* 翻到后面的盖子：只露一条边，说明这是个「掀开的」箱子 */}
        <div className="art-tbox-lid" aria-hidden />

        <div className="art-tbox-sheet">
          <div className="art-tbox-liner" style={{ backgroundImage: `url(${ART.planPaper})` }} aria-hidden />

          <div className="art-tbox-frame">
            <header className="art-tbox-head">
              <div className="art-tbox-plate">
                <span className="art-tbox-platek">{t('ui.items.boxTitle')}</span>
                <span className="art-tbox-plates">{t('ui.items.boxSub')}</span>
              </div>
              <button type="button" className="art-tbox-close" onClick={close}>
                {t('ui.common.close')}
                <span aria-hidden>✕</span>
              </button>
            </header>

            <div className="art-tbox-slots">
              {/* ---- 槽 1：备用滤芯 ---- */}
              <section className={slotClass(cartridgeCount > 0)} data-item="filter">
                <span className="art-tbox-k">{t('ui.items.slotFilter')}</span>
                <div className="art-tbox-well">
                  <GlyphStack id="filter" n={cartridgeCount} />
                  {cartridgeCount <= 0 && <span className="art-tbox-void">{t('ui.items.boxEmpty')}</span>}
                </div>
                <div className="art-tbox-tag">
                  <span className="art-tbox-name">{ITEM_NAME.filter}</span>
                  <span className="art-tbox-count num" data-count={cartridgeCount}>
                    {stockLine(cartridgeCount)}
                  </span>
                </div>
                {/* 在装那支的耐久：条 + 数字，与经典面板同阈值 */}
                <div className="art-tbox-life">
                  <span className="art-tbox-lifek">{t('ui.items.boxInUse')}</span>
                  <span className="art-tbox-lifebar" data-tone={LIFE_TONE(cartridgeLife)}>
                    <i style={{ width: `${Math.max(0, Math.min(100, (cartridgeLife / WEAR.FILTER_LIFE) * 100))}%` }} />
                  </span>
                  <span className="art-tbox-lifen num">
                    {t('ui.items.boxLifeBar', { n: cartridgeLife.toFixed(1), cap: WEAR.FILTER_LIFE })}
                  </span>
                </div>
                <p className="art-tbox-note">{t('ui.items.filterDesc')}</p>
                <button
                  type="button"
                  className="art-tbox-act"
                  disabled={cartridgeCount < 1}
                  onClick={() => useItem('filter')}
                >
                  {t('ui.items.useFilter')}
                </button>
              </section>

              {/* ---- 槽 2：一氧化碳报警器（被动，无按钮） ---- */}
              <section className={slotClass(alarmOwned)} data-item="coAlarm">
                <span className="art-tbox-k">{t('ui.items.slotAlarm')}</span>
                <div className="art-tbox-well">
                  <GlyphStack id="coAlarm" n={alarmOwned ? 1 : 0} />
                  {!alarmOwned && <span className="art-tbox-void">{t('ui.items.boxEmpty')}</span>}
                </div>
                <div className="art-tbox-tag">
                  <span className="art-tbox-name">{ITEM_NAME.coAlarm}</span>
                  <span className={`art-tbox-count${alarmOwned ? ' is-on' : ''}`} data-count={alarmOwned ? 1 : 0}>
                    {alarmOwned ? t('ui.items.boxInUse') : t('ui.items.none')}
                  </span>
                </div>
                <p className="art-tbox-note">{t('ui.items.coAlarmDesc')}</p>
              </section>

              {/* ---- 槽 3：碘片 ---- */}
              <section
                className={`${slotClass(iodineCount > 0)}${iodineOn ? ' is-burned' : ''}`}
                data-item="iodine"
              >
                <span className="art-tbox-k">{t('ui.items.slotIodine')}</span>
                <div className="art-tbox-well">
                  <GlyphStack id="iodine" n={iodineCount} />
                  {iodineCount <= 0 && <span className="art-tbox-void">{t('ui.items.boxEmpty')}</span>}
                  {/* 服用过：整叠斜划一道，划线的位置与截止日并排读 */}
                  {iodineOn && <b className="art-tbox-used" aria-hidden />}
                </div>
                <div className="art-tbox-tag">
                  <span className="art-tbox-name">{ITEM_NAME.iodine}</span>
                  <span className="art-tbox-count num" data-count={iodineCount}>
                    {stockLine(iodineCount)}
                  </span>
                  <span className={`art-tbox-chip${iodineOn ? ' is-on' : ''}`} data-on={iodineOn ? 1 : 0}>
                    {iodineOn ? t('ui.items.iodineOn', { day: run.iodineUntil ?? 0 }) : t('ui.items.iodineOff')}
                  </span>
                </div>
                <p className="art-tbox-note">{t('ui.items.iodineDesc')}</p>
                {isPrep && <p className="art-tbox-hint">{t('ui.items.iodinePrepHint')}</p>}
                <button
                  type="button"
                  className="art-tbox-act"
                  disabled={iodineCount < 1 || iodineOn || isPrep}
                  onClick={() => useItem('iodine')}
                >
                  {t('ui.items.useIodine')}
                </button>
              </section>
            </div>

            {/* 箱沿一道压印 + 日期：让箱底有个收口，也把这屏与「一张公文纸」区分开 */}
            <footer className="art-tbox-foot" aria-hidden>
              <span className="art-tbox-footrule" />
              <span className="art-tbox-footno num">
                {isPrep ? `D-${TIME.PREP_DAYS - run.day + 1}` : t('ui.common.dayN', { n: run.day })}
              </span>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
