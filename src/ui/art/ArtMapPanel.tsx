import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { TIME } from '../../game/balance';
import { ITEM_NAME } from '../../game/copy/names';
import { t } from '../../game/copy/t';
import { LOCATIONS, RES_NAME } from '../../game/content/locations';
import { useGame } from '../../game/store';
import type { Location, RunState } from '../../game/types';
import { MAP_CANVAS, MAP_HOME, locPinXY, ringGeometry } from './locPins';
import { ART, hideBrokenImg } from './skin';
import './art.css';

/**
 * 外出：钉在墙上的那张地图。
 *
 * 与「选址」屏用的是同一张 `map-board.jpg`（同一张桌子上的同一张图），但读法完全不同 ——
 * 选址时图是背景，这里是**实物本体**：不虚焦、铺满左栏，三圈等距线与图钉直接钉在画上。
 * 外圈那层虚焦的房间只为说明「这张图在屋里」，与其它纸面浮层同一套做法。
 *
 * ⚠️ 坐标必须落在「与图片同宽高比」的盒子里。图是 1664×928，而 `.art-board-canvas`
 * 用 `aspect-ratio: 1664/928` 定死，于是 `object-fit` 无论是 cover 还是 fill 结果都一样
 * （容器比例＝图片比例 ⇒ 不裁不拉），图钉的百分比坐标才与画上的地物对得上。
 * 若把它塞进一个比例不符的盒子再 `cover`，图会被裁掉一条，全部钉子集体偏位。
 *
 * 与经典 `MapPanel`（`panels.tsx:261-366`）逐字段等价：
 * 标题（采购 / 外出）、副题（物价指数 + 第 5 天起的限购 / 搜刮说明）、
 * 白天·夜间（含夜猫子文案）、每处的地点名、距离档、危险度、需要车、存量、设卡、今日已去过、
 * 灾难前后两套描述、战利品清单、以及准备期「去采购 / 再看看货架」与灾后「搜刮（夜间）」按钮。
 *
 * 两处刻意的差异：
 * 1. **危险度在准备期不出**（沿用经典：准备期危险度还不是可行动信息，也就不给图钉上色，
 *    所有钉子统一走「可采购」色）；
 * 2. 存量条与存量数字一起受 `showStock` 约束（准备期只有搜刮者专长、或当天已经去过才看得见）。
 *
 * 坐标表在 `locPins.ts`：只标角度，半径由 `distance` 定，所以图钉必然落在自己那圈上。
 */

const SHEET_OUT_MS = 240;

/** 危险度分档（与经典 Chip 的阈值一致：<20 好 / <40 中 / 其余差） */
const dangerTone = (d: number) => (d < 20 ? 'good' : d < 40 ? 'warn' : 'bad');
const distanceTone = (d: 1 | 2 | 3) => (d === 1 ? 'good' : d === 2 ? 'warn' : 'bad');
const stockTone = (n: number) => (n <= 0 ? 'bad' : n > 60 ? 'good' : n > 25 ? 'warn' : 'bad');

interface Row {
  loc: Location;
  stock: number;
  visited: boolean;
  canGo: boolean;
  showStock: boolean;
  blocked?: string;
  pin: { x: number; y: number };
}

export function ArtMapPanel({ run }: { run: RunState }) {
  const setOverlay = useGame((s) => s.setOverlay);
  const scavenge = useGame((s) => s.scavenge);
  const visitShop = useGame((s) => s.visitShop);
  const isPrep = run.day < TIME.COLLAPSE_DAY;
  const [night, setNight] = useState(false);
  const [closing, setClosing] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const nightowl = run.abilities.includes('perk_nightowl');

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

  // 准备期只列能采购的（且隐藏信号点还没解锁）；生存期列全部，但隐藏点要已解锁。
  // 与经典 MapPanel 同一套过滤 —— 不直接索引 LOCATION_BY_ID（那是 Record，且不含隐藏点）。
  const rows = useMemo<Row[]>(() => {
    const listed = isPrep
      ? LOCATIONS.filter((loc) => loc.prepShop && !loc.hidden)
      : LOCATIONS.filter((loc) => !loc.hidden || run.locations.some((s) => s.id === loc.id));
    const canScav = run.abilities.includes('perk_scavenger');
    return listed.map((loc) => {
      const st = run.locations.find((l) => l.id === loc.id);
      const visited = run.visitedToday.includes(loc.id);
      return {
        loc,
        stock: st?.stock ?? loc.stock,
        visited,
        canGo: !loc.needsVehicle || run.hasVehicle,
        showStock: !isPrep || canScav || visited,
        blocked: st?.blocked,
        pin: locPinXY(loc.id, loc.distance),
      };
    });
  }, [isPrep, run.locations, run.visitedToday, run.hasVehicle, run.abilities]);

  const rings = ringGeometry();

  return (
    <div
      className={`art-board-veil${closing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={isPrep ? t('ui.map.shop') : t('ui.map.out')}
    >
      <div className="art-board-room" style={{ backgroundImage: `url(${ART.sceneHomeDesk})` }} aria-hidden />

      <div className="art-board-sheet">
        <header className="art-board-head">
          <div className="art-board-headmain">
            <h2 className="art-board-title">{isPrep ? t('ui.map.shop') : t('ui.map.out')}</h2>
            <p className="art-board-sub">
              {isPrep
                ? `${t('ui.map.price', { n: run.world.priceIndex.toFixed(2) })}${run.day >= 5 ? t('ui.map.limited') : ''}`
                : t('ui.map.scavSub')}
            </p>
          </div>
          <button type="button" className="art-board-close" onClick={close}>
            {t('ui.common.close')}
            <span aria-hidden>✕</span>
          </button>
        </header>

        <div className="art-board-body">
          {/* ---- 左：地图本体 ---- */}
          <div className="art-board-map">
            <div className="art-board-canvas">
              <img className="art-board-photo" src={ART.mapBoard} alt="" decoding="async" onError={hideBrokenImg} />

              {/* 三圈等距线：铅笔虚线而不是实心环 —— 这是拿圆规在纸上画的，
                  不是印上去的。半径与图钉共用 `locPins.ts` 的常量，所以必然穿过对应的钉子。 */}
              <svg
                className="art-board-rings"
                viewBox={`0 0 ${MAP_CANVAS.w} ${MAP_CANVAS.h}`}
                preserveAspectRatio="none"
                aria-hidden
              >
                {rings.map((r) => (
                  <ellipse key={r.d} cx={r.cx} cy={r.cy} rx={r.rx} ry={r.ry} />
                ))}
              </svg>

              {/* 家：圆的圆心，不可点（避难所不在这张图的行程里） */}
              <div
                className="art-board-home"
                style={{ left: `${MAP_HOME.x * 100}%`, top: `${MAP_HOME.y * 100}%` }}
                aria-hidden
              >
                <span className="art-board-homehead" />
                <span className="art-board-hometip">{t('ui.map.boardHome')}</span>
              </div>

              {rows.map((r) => {
                const isSel = r.loc.id === sel;
                const tone = isPrep ? 'shop' : dangerTone(r.loc.danger);
                return (
                  <button
                    type="button"
                    key={r.loc.id}
                    className={
                      `art-board-pin is-tone-${tone}` +
                      (isSel ? ' is-sel' : '') +
                      (r.visited ? ' is-visited' : '') +
                      (r.blocked ? ' is-blocked' : '')
                    }
                    style={{ left: `${r.pin.x * 100}%`, top: `${r.pin.y * 100}%` } as CSSProperties}
                    aria-pressed={isSel}
                    aria-label={r.loc.name}
                    /* 距离档写进 DOM：图钉半径与圈半径共用 `locPins.ts` 常量，但「这枚钉子该在哪圈」
                       只有地点自己知道。带上它，校验才能逐枚自证（不然得靠行文里的「近/中/远」猜，
                       而地点名里就有「中」——「城郊仓储中心」在外圈却会被读成中圈）。 */
                    data-dist={r.loc.distance}
                    data-loc={r.loc.id}
                    onClick={() => setSel(isSel ? null : r.loc.id)}
                  >
                    <span className="art-board-pinhead" />
                    <span className="art-board-tip">{r.loc.name}</span>
                    {r.showStock && (
                      <span className="art-board-stockbar" aria-hidden>
                        <i style={{ width: `${Math.max(0, Math.min(100, r.stock))}%` }} />
                      </span>
                    )}
                    {r.visited && <i className="art-board-x" aria-hidden />}
                    {r.blocked && <b className="art-board-seal">{t('ui.map.boardSeal')}</b>}
                    {r.loc.needsVehicle && <b className="art-board-veh">{t('ui.map.needCar')}</b>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ---- 右：行程单 ---- */}
          <div className="art-board-strip">
            {!isPrep && (
              <div className="art-board-when">
                <span className="art-board-whenk">{t('ui.map.when')}</span>
                <button
                  type="button"
                  className={`art-board-whenb${!night ? ' is-on' : ''}`}
                  onClick={() => setNight(false)}
                >
                  {t('ui.map.day')}
                </button>
                <button
                  type="button"
                  className={`art-board-whenb${night ? ' is-on' : ''}`}
                  onClick={() => setNight(true)}
                >
                  {nightowl ? t('ui.map.nightOwl') : t('ui.map.night')}
                </button>
              </div>
            )}

            <ul className="art-board-list">
              {rows.map((r) => {
                const isSel = r.loc.id === sel;
                return (
                  <li key={r.loc.id} className={isSel ? 'is-sel' : undefined}>
                    <button
                      type="button"
                      className="art-board-row"
                      onClick={() => setSel(isSel ? null : r.loc.id)}
                      aria-expanded={isSel}
                    >
                      <span className="art-board-dot" data-tone={isPrep ? 'shop' : dangerTone(r.loc.danger)} />
                      <span className="art-board-name">{r.loc.name}</span>
                      <span className={`art-board-tag is-${distanceTone(r.loc.distance)}`}>
                        {['', t('ui.map.near'), t('ui.map.mid'), t('ui.map.far')][r.loc.distance]}
                      </span>
                      {!isPrep && (
                        <span className={`art-board-tag is-${dangerTone(r.loc.danger)}`}>
                          {t('ui.map.danger', { n: r.loc.danger })}
                        </span>
                      )}
                      {r.loc.needsVehicle && (
                        <span className={`art-board-tag is-${r.canGo ? 'info' : 'bad'}`}>{t('ui.map.needCar')}</span>
                      )}
                      {r.showStock && (
                        <span className={`art-board-tag is-${stockTone(r.stock)}`}>
                          {r.stock <= 0 ? t('ui.map.empty') : t('ui.map.stock', { n: Math.round(r.stock) })}
                        </span>
                      )}
                      {r.blocked && <span className="art-board-tag is-bad">{t('ui.map.blocked')}</span>}
                      {r.visited && <span className="art-board-tag">{t('ui.map.visited')}</span>}
                    </button>

                    {isSel && (
                      <div className="art-board-detail">
                        <p className="art-board-desc">
                          {!isPrep && r.loc.descSurvival ? r.loc.descSurvival : r.loc.desc}
                        </p>
                        <div className="art-board-loot">
                          {r.loc.loot.map((l) => (
                            <span key={l.item ?? l.res} className="art-board-lootc">
                              {l.item ? ITEM_NAME[l.item] : RES_NAME[l.res!]}
                            </span>
                          ))}
                        </div>
                        <div className="art-board-acts">
                          {isPrep && r.loc.prepShop && (
                            <button
                              type="button"
                              className="art-board-act"
                              disabled={!r.canGo || (run.ap < 1 && !r.visited)}
                              onClick={() => visitShop(r.loc.id)}
                            >
                              {r.visited ? t('ui.map.shopAgain') : t('ui.map.shopGo')}
                            </button>
                          )}
                          {!isPrep && (
                            <button
                              type="button"
                              className="art-board-act is-ghost"
                              disabled={!r.canGo || run.ap < 1 || r.stock <= 0}
                              onClick={() => scavenge(r.loc.id, night)}
                            >
                              {r.stock <= 0
                                ? t('ui.map.scavEmpty')
                                : night
                                  ? t('ui.map.scavNight')
                                  : t('ui.map.scavGo')}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <footer className="art-board-legend">
              {sel === null && <p className="art-board-pick">{t('ui.map.boardPick')}</p>}
              <p className="art-board-lg">{t('ui.map.boardRing')}</p>
              {!isPrep && <p className="art-board-lg">{t('ui.map.boardPinDanger')}</p>}
              <p className="art-board-lg">{t('ui.map.boardPinStock')}</p>
              <p className="art-board-lg">{t('ui.map.boardVisited')}</p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
