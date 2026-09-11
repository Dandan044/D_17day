import { useEffect, useRef, useState } from 'react';

import { TIME } from '../../game/balance';
import { BUILD_PATH_NAME } from '../../game/copy/names';
import { t } from '../../game/copy/t';
import { MODULES, moduleHardEffect, moduleSpec } from '../../game/content/modules';
import { SITE_BY_ID } from '../../game/content/sites';
import {
  SALVAGE_TARGETS,
  blockingReason,
  buildOptions,
  maintenanceOptions,
  nextLevel,
  nextWorkPortion,
} from '../../game/engine/construction';
import { useGame } from '../../game/store';
import type { ModuleId, RunState } from '../../game/types';
import { ART, hideBrokenImg } from './skin';
import './art.css';

/**
 * 避难所工程：墙上一张工程图纸的"取下来摊开"版。
 *
 * 进入方式与视觉必须呼应——左墙图纸热点打开它，所以这里整张界面就是那张纸：
 * 深调旧纸底、墨线边框、每行两个家电的卡片、点开才展开的施工说明、右下图签。
 * 纸与家电配图都由 ImageGen 生成（见 scripts/gen-art-modules.py / make-shelter-paper.py）。
 *
 * 布局要点：卡片两两成对（.art-shelter-pair 是两列 grid），展开的详情作为该对的最后一个
 * 子项跨两列 —— 单 grid + grid-column:1/-1 会在"左卡展开"时把详情挤到下一行、右列留空洞。
 *
 * 功能与经典界面的 ShelterPanel 逐项等价：10 个模块的展开/等级/施工中/三条建造路径/
 * 工时与材料/停工，维护（机油），崩溃日后的拆解回收。派生只读，不改 run。
 */

const SHEET_OUT_MS = 240;
type CardState = 'building' | 'capped' | 'blocked' | 'open';

/** 两两分组：10 个模块正好 5 对，末行不残缺。 */
function chunk<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export function ArtShelterPanel({ run }: { run: RunState }) {
  const setOverlay = useGame((s) => s.setOverlay);
  const build = useGame((s) => s.build);
  const work = useGame((s) => s.work);
  const cancelProject = useGame((s) => s.cancelProject);
  const salvage = useGame((s) => s.salvage);
  const maintain = useGame((s) => s.maintain);

  const [open, setOpen] = useState<ModuleId | null>(null);
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
  const isPrep = run.day < TIME.COLLAPSE_DAY;
  const stamp = `${t('ui.shelter.sheetNo')}-${site.codename}`;

  /** 一个模块的全部派生态，卡片与详情共用，避免两处重复取。 */
  const derive = (m: (typeof MODULES)[number]) => {
    const id = m.id;
    const level = run.modules[id];
    const cap = site.caps[id] ?? 3;
    const project = run.projects.find((p) => p.moduleId === id);
    const target = nextLevel(run, id);
    const spec = target ? moduleSpec(id, target) : null;
    const blocked = blockingReason(run, id);

    const state: CardState = project ? 'building' : level >= cap ? 'capped' : blocked ? 'blocked' : 'open';
    const stateText =
      state === 'building'
        ? t('ui.common.building')
        : state === 'capped'
          ? t('ui.shelter.stateCapped')
          : state === 'blocked'
            ? t('ui.shelter.stateBlocked')
            : t('ui.shelter.stateOpen');

    const nowFx = moduleHardEffect(id, level, site.waterCapMult) || t('ui.common.none');
    const nextFx = target ? moduleHardEffect(id, target, site.waterCapMult) : '';
    const effectLine =
      moduleHardEffect(id, level, site.waterCapMult) ||
      (level > 0 ? (moduleSpec(id, level)?.desc ?? m.desc) : m.zero);

    const portion = project?.path === 'diy' ? nextWorkPortion(run, id) : null;
    const workLocked =
      run.ap < 1 ||
      (!!portion && run.res.materials < portion.materials) ||
      (!!portion && run.res.parts < portion.parts);

    return { id, level, cap, project, target, spec, blocked, state, stateText, nowFx, nextFx, effectLine, portion, workLocked };
  };

  const renderCard = (m: (typeof MODULES)[number], d: ReturnType<typeof derive>) => {
    const isOpen = open === d.id;
    return (
      <article
        key={d.id}
        role="listitem"
        className={`art-shelter-row is-${d.state}${d.level > 0 ? ' is-built' : ''}${isOpen ? ' is-open' : ''}`}
      >
        <button
          type="button"
          id={`sh-card-${d.id}`}
          className="art-shelter-rowbtn"
          aria-expanded={isOpen}
          aria-controls={`sh-detail-${d.id}`}
          onClick={() => setOpen(isOpen ? null : d.id)}
        >
          <span className="art-shelter-thumbwrap">
            <img
              className="art-shelter-thumb"
              src={ART.module(d.id, d.level)}
              alt=""
              loading="lazy"
              decoding="async"
              onError={hideBrokenImg}
            />
            <span className="art-shelter-codepill" aria-hidden>
              {m.short}
            </span>
            {d.level === 0 && <span className="art-shelter-thumbtag">{t('ui.shelter.notBuilt')}</span>}
          </span>

          <span className="art-shelter-cardmain">
            <span className="sh-item-top">
              <span className="art-shelter-name">{m.name}</span>
              <span className="art-shelter-count num">
                {d.level} / {d.cap}
              </span>
            </span>
            <span className="art-shelter-pips">
              {[1, 2, 3].map((lv) => (
                <i
                  key={lv}
                  className={`art-shelter-pip${lv <= d.level ? ' is-built' : lv <= d.cap ? ' is-open' : ' is-locked'}`}
                />
              ))}
            </span>
            <span className="art-shelter-fx">{d.effectLine}</span>
          </span>

          <span className="art-shelter-cardend">
            <span className={`art-shelter-state is-${d.state}`}>{d.stateText}</span>
            <svg className="art-shelter-caret" viewBox="0 0 12 12" aria-hidden>
              <path d="M2 4.5 L6 8.5 L10 4.5" />
            </svg>
          </span>
        </button>
      </article>
    );
  };

  const renderDetail = (m: (typeof MODULES)[number], d: ReturnType<typeof derive>) => (
    <>
      <div className={`art-shelter-detailhead${d.level > 0 ? ' is-built' : ''}`}>
        <img
          className="art-shelter-detailthumb"
          src={ART.module(d.id, d.level)}
          alt=""
          decoding="async"
          onError={hideBrokenImg}
        />
        <span className="art-shelter-detailname">{m.name}</span>
        <span className="art-shelter-detailrule" />
        <span className={`art-shelter-state is-${d.state}`}>{d.stateText}</span>
      </div>

      <p className="art-shelter-desc">{m.desc}</p>

      <p className="art-shelter-effect">
        <span className="is-now">{t('ui.shelter.current', { fx: d.nowFx })}</span>
        {d.target ? <span className="is-next">{t('ui.shelter.next', { fx: d.nextFx })}</span> : null}
      </p>

      {d.project && (
        <div className="art-shelter-order">
          <div className="sh-order-top">
            <span className="sh-order-title">
              {t('ui.shelter.target', { path: BUILD_PATH_NAME[d.project.path], n: d.project.toLevel })}
            </span>
            <span className="sh-order-eta num">
              {d.project.path === 'diy'
                ? t('ui.common.laborSp', { done: d.project.laborDone, total: d.project.laborTotal })
                : t('ui.common.etaDay', { day: d.project.etaDay ?? 0 })}
            </span>
          </div>
          {d.project.path === 'diy' && (
            <div className="art-shelter-bar">
              <i
                style={{
                  transform: `scaleX(${
                    d.project.laborTotal > 0
                      ? Math.max(0, Math.min(1, d.project.laborDone / d.project.laborTotal))
                      : 0
                  })`,
                }}
              />
            </div>
          )}
          <p className="art-shelter-penalty">{m.buildPenaltyDesc}</p>
          {d.portion && (
            <p className="art-shelter-note num">
              {t('ledger.build.workCost', { mat: d.portion.materials, parts: d.portion.parts })}
            </p>
          )}
          <div className="sh-order-actions">
            {d.project.path === 'diy' && (
              <button
                type="button"
                className="art-shelter-btn is-primary"
                disabled={d.workLocked}
                onClick={() => work(d.id)}
              >
                {t('ui.shelter.work')}
              </button>
            )}
            <button type="button" className="art-shelter-btn is-danger" onClick={() => cancelProject(d.id)}>
              {t('ui.shelter.cancel')}
            </button>
          </div>
        </div>
      )}

      {!d.project && d.target && d.spec && (
        <div className="art-shelter-plan">
          <div className="art-shelter-planhead">{t('ui.shelter.upTo', { n: d.target, desc: d.spec.desc })}</div>
          {d.blocked ? (
            <div className="art-shelter-blocked">{d.blocked}</div>
          ) : (
            <div className="art-shelter-plangrid">
              {buildOptions(run, d.id).map((o) => (
                <button
                  type="button"
                  key={o.path}
                  className="art-shelter-plancard"
                  disabled={!o.available}
                  onClick={() => build(d.id, o.path)}
                >
                  <span className="sh-plan-top">
                    <span className="art-shelter-planname">{BUILD_PATH_NAME[o.path]}</span>
                    {!o.available && <span className="art-shelter-plancap">{o.reason}</span>}
                  </span>
                  <span className="art-shelter-plancost num">{o.cost}</span>
                  {o.available && o.path === 'diy' && (o.failRisk ?? 0) > 0 && (
                    <span className="art-shelter-planrisk">
                      {t('ui.shelter.failRisk', { pct: Math.round((o.failRisk ?? 0) * 100) })}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {d.spec.power ? <p className="art-shelter-note num">{t('ui.shelter.power', { n: d.spec.power })}</p> : null}
        </div>
      )}

      {!d.project && !d.target && <p className="art-shelter-note">{t('ui.shelter.atCap')}</p>}
    </>
  );

  return (
    <div
      className={`art-shelter-veil${closing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('ui.shelter.title', { name: site.name })}
    >
      <div className="art-shelter-room" style={{ backgroundImage: `url(${ART.sceneHomeDesk})` }} aria-hidden />

      <div className="art-shelter-sheet">
        <div className="art-shelter-paper" style={{ backgroundImage: `url(${ART.shelterPaper})` }} aria-hidden />

        <div className="art-shelter-frame">
          <span className="art-shelter-tick is-tl" aria-hidden />
          <span className="art-shelter-tick is-tr" aria-hidden />
          <span className="art-shelter-tick is-bl" aria-hidden />
          <span className="art-shelter-tick is-br" aria-hidden />

          {/* ---- 图头 ---- */}
          <header className="art-shelter-head">
            <div className="art-shelter-head-main">
              <div className="art-shelter-kicker">
                <span className="art-shelter-stamp num">{stamp}</span>
                <span>{t('ui.shelter.sheetKicker')}</span>
              </div>
              <h2 className="art-shelter-title">{t('ui.shelter.title', { name: site.name })}</h2>
              <p className="art-shelter-sub">{t('ui.shelter.subtitle')}</p>
            </div>

            <div className="art-shelter-head-side">
              {run.projects.length > 0 && (
                <span className="art-shelter-seal" aria-hidden>
                  <em>{t('ui.common.building')}</em>
                  <b className="num">{run.projects.length}</b>
                </span>
              )}
              <button type="button" className="art-shelter-close" onClick={close}>
                {t('ui.common.close')}
                <span aria-hidden>✕</span>
              </button>
            </div>
          </header>

          {/* ---- 正文：家电卡片 + 附表 ---- */}
          <div className="art-shelter-body">
            <div className="art-shelter-hintrow">
              <p className="art-shelter-hint">{t('ui.shelter.hint')}</p>
              <span className="art-shelter-legend" aria-hidden>
                <i className="art-shelter-pip is-built" />
                <em>{t('ui.shelter.legBuilt')}</em>
                <i className="art-shelter-pip is-open" />
                <em>{t('ui.shelter.legOpen')}</em>
                <i className="art-shelter-pip is-locked" />
                <em>{t('ui.shelter.legLocked')}</em>
              </span>
            </div>

            <div className="art-shelter-cards" role="list">
              {chunk(MODULES, 2).map((pair, pi) => {
                const derived = pair.map((m) => ({ m, d: derive(m) }));
                const openOne = derived.find((x) => x.d.id === open);
                return (
                  <div className="art-shelter-pair" key={pi}>
                    {derived.map((x) => renderCard(x.m, x.d))}
                    {openOne && (
                      <div
                        className="art-shelter-detail"
                        id={`sh-detail-${openOne.d.id}`}
                        role="region"
                        aria-labelledby={`sh-card-${openOne.d.id}`}
                      >
                        {renderDetail(openOne.m, openOne.d)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ---- 附表一：维护 ---- */}
            <section className="art-shelter-aux">
              <div className="art-shelter-auxhead">
                <span className="art-shelter-auxtitle">{t('ui.shelter.maint')}</span>
                <span className="art-shelter-auxrule" />
              </div>
              <p className="art-shelter-auxhint">{t('ui.shelter.maintHint')}</p>
              <div className="art-shelter-auxgrid">
                {maintenanceOptions(run).map((m) => (
                  <button
                    type="button"
                    key={m.kind}
                    className="art-shelter-auxcard"
                    disabled={!m.available}
                    onClick={() => maintain(m.kind)}
                  >
                    <span className="sh-aux-top">
                      <span className="art-shelter-auxname">{m.name}</span>
                      {m.available ? (
                        <span className={`art-shelter-tag ${m.remaining <= 6 ? 'is-bad' : 'is-warn'}`}>
                          {t('ui.shelter.remain', { n: m.remaining })}
                        </span>
                      ) : (
                        <span className="art-shelter-tag is-bad">{m.reason}</span>
                      )}
                    </span>
                    <span className="art-shelter-auxdesc">{m.desc}</span>
                    <span className="art-shelter-auxcost num">{t('ui.shelter.maintCost', { n: m.parts })}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* ---- 附表二：拆解回收（崩溃日后） ---- */}
            {!isPrep && (
              <section className="art-shelter-aux">
                <div className="art-shelter-auxhead">
                  <span className="art-shelter-auxtitle">{t('ui.shelter.salvage')}</span>
                  <span className="art-shelter-auxrule" />
                </div>
                <p className="art-shelter-auxhint">{t('ui.shelter.salvageHint')}</p>
                <div className="art-shelter-auxgrid">
                  {SALVAGE_TARGETS.map((target) => (
                    <button
                      type="button"
                      key={target.id}
                      className="art-shelter-auxcard"
                      disabled={run.ap < 1}
                      onClick={() => salvage(target.id)}
                    >
                      <span className="sh-aux-top">
                        <span className="art-shelter-auxname">{target.name}</span>
                        <span className="sh-aux-chips">
                          <span className="art-shelter-tag is-warn">
                            {t('ui.shelter.exposure', { n: target.exposure })}
                          </span>
                          {target.humanity < 0 && (
                            <span className="art-shelter-tag is-bad">
                              {t('ui.shelter.humanity', { n: target.humanity })}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="art-shelter-auxdesc">{target.desc}</span>
                      <span className="art-shelter-auxcost num">
                        {t('ui.shelter.salvageRange', {
                          a: target.materials[0],
                          b: target.materials[1],
                          c: target.parts[0],
                          d: target.parts[1],
                        })}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ---- 图签 ---- */}
          <footer className="art-shelter-tb">
            <div className="sh-tb-cell is-wide">
              <span className="sh-tb-k">{t('ui.shelter.tbProject')}</span>
              <span className="sh-tb-v">{t('ui.game.buildTitle')}</span>
            </div>
            <div className="sh-tb-cell">
              <span className="sh-tb-k">{t('ui.shelter.tbSite')}</span>
              <span className="sh-tb-v">{site.name}</span>
            </div>
            <div className="sh-tb-cell">
              <span className="sh-tb-k">{t('ui.shelter.tbCode')}</span>
              <span className="sh-tb-v num">{site.codename}</span>
            </div>
            <div className="sh-tb-cell">
              <span className="sh-tb-k">{t('ui.shelter.tbDate')}</span>
              <span className="sh-tb-v num">
                {isPrep ? `D-${TIME.PREP_DAYS - run.day + 1}` : t('ui.common.dayN', { n: run.day })}
              </span>
            </div>
            <div className="sh-tb-cell">
              <span className="sh-tb-k">{t('ui.game.ap')}</span>
              <span className="sh-tb-v">
                <span className="art-shelter-appips" aria-label={t('ui.common.ap', { n: run.ap })}>
                  {Array.from({ length: run.apMax }).map((_, i) => (
                    <i key={i} className={i < run.ap ? 'is-on' : ''} />
                  ))}
                </span>
              </span>
            </div>
            <div className="sh-tb-cell is-narrow">
              <span className="sh-tb-k">{t('ui.shelter.tbScale')}</span>
              <span className="sh-tb-v num">{t('ui.shelter.tbScaleValue')}</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
