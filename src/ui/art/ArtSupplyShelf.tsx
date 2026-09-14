import { useEffect, useRef, useState } from 'react';

import { RES_NAME, RES_UNIT } from '../../game/copy/names';
import { t } from '../../game/copy/t';
import { SITE_BY_ID } from '../../game/content/sites';
import { SINGLE_NEED, stockDays } from '../../game/engine/economy';
import { batteryCapacity } from '../../game/engine/power';
import { useGame } from '../../game/store';
import type { ResourceId, RunState } from '../../game/types';
import { ART } from './skin';
import './art.css';

/**
 * 物资：纸面台账。
 *
 * 点局内那面木货架的热点打开。**架上还剩多少，已经由场景里的货架本身表达了**——
 * 货架贴图按「口粮档 × 用水档」切成 25 态（见 shelfLayout.json），所以这里不再画货架，
 * 只把数字摆清楚：全资源清单 + 口粮/饮水按「单人标准人日」能撑几天 + 蓄电池余量，
 * 底部保留「特殊物品」「同伴」两个入口。
 *
 * 与 ArtPlanPanel / ArtShelterPanel 同族：veil（整屏）→ room（房间图虚焦当景深）→
 * sheet（纸面）→ 关闭按钮，进场 470ms、关闭 240ms 后再 setOverlay(null)。
 *
 * 刻意不复用经典皮肤的 SuppliesPanel——那会把经典三栏布局的样式带进来。
 */

const SHEET_OUT_MS = 240;

/** 清单顺序沿用经典 SuppliesPanel 的 RES_ORDER */
const RES_ORDER: ResourceId[] = ['water', 'foodStaple', 'foodFresh', 'meds', 'fuel', 'materials', 'parts', 'ammo', 'cash'];

/** 「约够 N 天（单人标准）」；Infinity / 极大值走兜底文案。 */
function daysText(days: number): string {
  if (!Number.isFinite(days) || days >= 100) return t('ui.supplies.daysInf');
  return t('ui.supplies.days', { n: days < 10 ? days.toFixed(1) : Math.round(days) });
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

  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  const companionCap = site?.companionCap ?? 0;

  // 天数口径＝单人标准人日：stockDays(库存, 单人 normal 档需求)
  const foodDays = stockDays(run.res.foodStaple + run.res.foodFresh, SINGLE_NEED.food);
  const waterDays = stockDays(run.res.water, SINGLE_NEED.water);

  const battCap = batteryCapacity(run);
  const battStored = run.wear.batteryCharge ?? 0;
  const supplyWarn = run.wear.filterLife <= 0 && (run.modules.filter > 0 || run.modules.airFilter > 0);

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
            <section className="art-shelf-ledger">
              <div className="art-shelf-ledgerhead">
                <span className="art-shelf-ledgertitle">{t('ui.supplies.ledgerTitle')}</span>
                <span className="art-shelf-ledgerrule" />
              </div>
              <dl className="art-shelf-list">
                {RES_ORDER.map((r) => {
                  const v = run.res[r];
                  const isFood = r === 'foodStaple' || r === 'foodFresh';
                  const isWater = r === 'water';
                  return (
                    <div className="art-shelf-row" key={r}>
                      <dt>
                        {RES_NAME[r]}
                        {(isFood || isWater) && (
                          <em className="art-shelf-rowdays">
                            {daysText(isWater ? waterDays : foodDays)}
                          </em>
                        )}
                      </dt>
                      <dd className="num">
                        {r === 'cash' ? Math.round(v) : Math.round(v * 10) / 10}
                        <span className="art-shelf-unit">{RES_UNIT[r]}</span>
                      </dd>
                    </div>
                  );
                })}
                {battCap > 0 && (
                  <div className="art-shelf-row is-batt">
                    <dt>{t('ui.supplies.battery')}</dt>
                    <dd className="num">
                      {battStored.toFixed(1)}
                      <span className="art-shelf-unit">
                        /{battCap} {t('ui.supplies.kwh')}
                      </span>
                    </dd>
                  </div>
                )}
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
