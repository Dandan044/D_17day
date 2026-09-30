import { useEffect, useRef, useState } from 'react';

import { CURE, TIME } from '../../game/balance';
import { t } from '../../game/copy/t';
import { conditionDef, conditionName, siteOf } from '../../game/content/lookup';
import { dailyExposure, exposureTier, TIER_DESC, TIER_NAMES } from '../../game/engine/exposure';
import { cureChanceOf, isImmuneNow } from '../../game/engine/health';
import { effectiveModule } from '../../game/engine/tags';
import { useGame } from '../../game/store';
import type { RunState } from '../../game/types';
import { aggregateBodyParts } from './bodyParts';
import { BodyMap } from './BodyMap';
import { EyeFigure } from './EyeFigure';
import { ART } from './skin';
import './art.css';

/**
 * 身体状况：点墙上那只医疗箱之后，掀开盖子看到的体征记录。
 *
 * 载体是「敞开的医疗箱」——箱盖内侧天然就是一块米黄卡纸，所以整屏是那张卡：
 * 箱体与器械在景深之外虚焦着，卡上写着五项体征与需要处理的伤病。
 *
 * ## 改版后的骨架（原版是一列横条 + 一堆大卡，两条都占满 1037px 的纸宽，浪费得厉害）
 *
 * ```
 * ┌──── 左栏（人体图）────┬──── 右栏（清单）────┐
 * │  人体轮廓图          │  需要处理：病名·档位·用药 │
 * │  （病灶位置+深浅+病名）│  暴露度：眼睛 + 今晚来源  │
 * │  生命 / 体力 两条     │  心理社会：人性 / 名声   │
 * └─────────────────────┴────────────────────┘
 * ```
 *
 * 分工是**图给「哪坏了 / 多严重 / 叫什么」，右栏给「怎么处理」**。疾病卡因此去掉了大边框、
 * 压成两行（病名一行、恶化倒计时一行），`desc` 折进悬停——图上已经说了是什么病，
 * 卡里再复述一遍只是把纸填满。**不会**因为折叠而丢信息：用药按钮、成本、医疗站门槛、
 * 治愈档位、免疫标记、条件型解除条件、每晚损耗全部保留。
 *
 * 为什么另起一个文件、而不再用 `Modal + BodyPanel` 包一层：`BodyPanel` 与 `ExposurePanel`
 * 内嵌在经典皮肤的三栏布局里（Game.tsx），都是**两皮肤共用体**，改本体就会连带改掉经典皮肤。
 * 所以这里只复制引擎数学与 store 动作，换一套纸面 DOM 与墨色——逐字段等价。
 *
 * 入口只有一处（ArtGame 的医疗箱热点），所以这个浮层天然是档案皮肤专属，不需要在 App 里分流。
 */

const SHEET_OUT_MS = 240;

/** 治愈率 → 纸面档位：只给等级与墨色，不给具体概率（与经典版 cureTierOf 同阈值）。 */
function cureTierOf(p: number): { key: string; tone: 'bad' | 'warn' | 'good' } {
  const T = CURE.TIERS;
  if (p < T[0]) return { key: 'ui.game.cureNone', tone: 'bad' };
  if (p < T[1]) return { key: 'ui.game.cureT1', tone: 'bad' };
  if (p < T[2]) return { key: 'ui.game.cureT2', tone: 'warn' };
  if (p < T[3]) return { key: 'ui.game.cureT3', tone: 'warn' };
  if (p < T[4]) return { key: 'ui.game.cureT4', tone: 'good' };
  return { key: 'ui.game.cureT5', tone: 'good' };
}

/** 一条体征：标签 + 墨色条 + 数值。条内填色按语义走（生命朱红 / 体力赭石 / 人性墨绿…）。 */
function BdGauge({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="art-bd-gauge">
      <span className="art-bd-glabel">{label}</span>
      <span className="art-bd-bar">
        <i className={`t-${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </span>
      <span className="art-bd-gval num">{Math.round(value)}</span>
    </div>
  );
}

export function ArtBodyPanel({ run }: { run: RunState }) {
  const setOverlay = useGame((s) => s.setOverlay);
  const medicate = useGame((s) => s.medicate);
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
  const isPrep = run.day < TIME.COLLAPSE_DAY;
  const medbayLv = effectiveModule(run, 'medbay');
  const nurse = run.abilities.includes('nurse_care');
  const medCost = (n: number) => (nurse ? Math.max(1, Math.round(n * 0.6)) : n);

  const tier = exposureTier(run.world.exposure);
  const breakdown = dailyExposure(run);
  // 图上那些点：疾病 → 部位 → 深浅。查不到的 id 会被收进 unknown，底下显式写出来。
  const agg = aggregateBodyParts(run.conditions, run.conditionAge);

  return (
    <div
      className={`art-paper-veil is-bd${closing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('ui.game.body')}
    >
      <div className="art-paper-room" style={{ backgroundImage: `url(${ART.sceneBodyKit})` }} aria-hidden />

      <div className="art-paper-sheet">
        <div className="art-paper" style={{ backgroundImage: `url(${ART.bodyPaper})` }} aria-hidden />

        <div className="art-paper-frame">
          <span className="art-paper-tick is-tl" aria-hidden />
          <span className="art-paper-tick is-tr" aria-hidden />
          <span className="art-paper-tick is-bl" aria-hidden />
          <span className="art-paper-tick is-br" aria-hidden />

          <header className="art-paper-head">
            <div className="art-paper-headmain">
              <div className="art-paper-kicker">
                <span className="art-paper-stamp">MED-KIT</span>
                <span>{t('ui.game.bodySheet')}</span>
              </div>
              <h2 className="art-paper-title">{t('ui.game.body')}</h2>
              <p className="art-paper-sub">
                {site.name} · {t('ui.common.dayN', { n: run.day })} ·{' '}
                {t('ui.sheet.medbay')}{' '}
                {medbayLv > 0 ? t('ui.common.lvl', { n: medbayLv }) : t('ui.shelter.notBuilt')}
              </p>
            </div>

            <div className="art-paper-headside">
              <span className="art-paper-seal" aria-hidden>
                检
              </span>
              <button type="button" className="art-paper-close" onClick={close}>
                {t('ui.common.close')}
                <span aria-hidden>✕</span>
              </button>
            </div>
          </header>

          <div className="art-paper-body">
            <div className="art-bd-split">
              {/* ================= 左栏：人体图 ================= */}
              <div className="art-bd-colL">
                <section className="art-paper-sec">
                  <div className="art-paper-sechead">
                    <span>{t('ui.game.body')}</span>
                    <i />
                    <em>{t('ui.game.bodyGaugeHint')}</em>
                  </div>
                  <BodyMap agg={agg} sanity={run.stats.sanity} />
                </section>

                {/* 图下两条：只有这两个是「身体图上能看出对应」的体征。
                    理智移进了颅环，人性/名声紧跟着单列——它们不落在器官上，
                    混在器官里会误导；放在图正下方反而最贴「图上没有」。 */}
                <div className="art-bd-vitals">
                  <BdGauge label={t('ui.game.hp')} value={run.stats.hp} tone="hp" />
                  <BdGauge label={t('ui.game.stamina')} value={run.stats.stamina} tone="stamina" />
                </div>

                <section className="art-paper-sec">
                  <div className="art-paper-sechead">
                    <span>{t('ui.game.psych')}</span>
                    <i />
                    <em>{t('ui.game.psychNote')}</em>
                  </div>
                  <div className="art-bd-gauges">
                    <BdGauge label={t('ui.game.humanity')} value={run.stats.humanity} tone="humanity" />
                    <BdGauge label={t('ui.game.reputation')} value={run.stats.reputation} tone="reputation" />
                  </div>
                </section>
              </div>

              {/* ================= 右栏：清单 ================= */}
              <div className="art-bd-colR">
                {/* ---- 需要处理：一条都没有时整节不出现。
                       留一个「0 件」的空壳加一句用药规则，反而让「没事」看起来像坏了。 ---- */}
                {run.conditions.length > 0 && (
                <section className="art-paper-sec">
                  <div className="art-paper-sechead">
                    <span>{t('ui.game.treat')}</span>
                    <i />
                    <em className="num">{t('ui.sheet.count', { n: run.conditions.length })}</em>
                  </div>

                  <div className="art-bd-cards">
                    {run.conditions.map((c) => {
                      // 这一块在浮层里每次渲染都要过一遍，而 run.conditions 是存档里的字符串。
                      // 旧档里留着一条已被删掉的状态 id 时，下面第一行 `def.needsMedbay` 就会抛错，
                      // React 会卸掉整棵树 —— 玩家看到的就是白屏。所以查不到就跳过这一条。
                      const def = conditionDef(c);
                      if (!def) return null;
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
                            ? t('ui.game.worsenNow', { age, name: conditionName(def.worsen!.into) })
                            : t('ui.game.worsenLater', { age, left: worsenAt - age })
                          : '';
                      const debuffParts: string[] = [];
                      if (def.daily.hp) debuffParts.push(`生命 ${def.daily.hp}`);
                      if (def.daily.stamina) debuffParts.push(`体力 ${def.daily.stamina}`);
                      if (def.daily.sanity) debuffParts.push(`理智 ${def.daily.sanity}`);
                      const ct = chance === null ? null : cureTierOf(chance);

                      return (
                        <article key={c} className={`art-bd-card${canMedicate ? ' is-treatable' : ''}`}>
                          <div className="art-bd-cardtop">
                            <span className="art-bd-name">
                              {def.name}
                              {immune && <em className="art-bd-immune">（{t('ui.game.immuneTag')}）</em>}
                            </span>
                            {ct ? (
                              <span className={`art-bd-tier is-${ct.tone}`}>{t(ct.key)}</span>
                            ) : (
                              <span className="art-bd-tier is-cond">{t('ui.game.cureConditional')}</span>
                            )}
                            <i className="art-bd-fill" aria-hidden />
                            {canMedicate && (
                              <button
                                type="button"
                                className="art-bd-med"
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

                          {/* 恶化倒计时留在明处：这是「再拖就要出事」的行动信号，不该藏进悬停 */}
                          {worsenHint && <p className="art-bd-worsen">{worsenHint}</p>}

                          {/* 悬停条：病程描述 + 每晚损耗 + 条件型解除条件（不给具体概率） */}
                          <div className="art-bd-tip" role="note">
                            <div className="art-bd-tiprow is-desc">
                              <span className="art-bd-tipv">{def.desc}</span>
                            </div>
                            <div className="art-bd-tiprow">
                              <span className="art-bd-tipk">{t('ui.game.debuffTitle')}</span>
                              <span className="art-bd-tipv">
                                {debuffParts.length > 0 ? debuffParts.join(' · ') : t('ui.game.debuffNone')}
                              </span>
                            </div>
                            {def.conditionHint && (
                              <div className="art-bd-tiprow">
                                <span className="art-bd-tipk">{t('ui.game.conditionCure')}</span>
                                <span className="art-bd-tipv">{def.conditionHint}</span>
                              </div>
                            )}
                            <div className="art-bd-tiprow is-rule">
                              <span className="art-bd-tipk">{t('ui.game.cureTitle')}</span>
                              <span className="art-bd-tipv">{t('ui.game.cureHint')}</span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <p className="art-bd-note">
                    {t('ui.game.treatRule')}
                    {medbayLv > 0 ? t('ui.game.medbay') : ''}
                    {medbayLv >= 3 ? t('ui.game.medbay3') : medbayLv > 0 ? t('ui.game.medbaySleep') : ''}
                  </p>
                </section>
                )}

                {/* ---- 暴露度：灾后才结算，与经典版一致。
                       原来是一条进度条 + 一个数字，现在换成一只睁到这个档位的眼睛 —— 
                       「被盯上了」这件事，眼睛比百分比传得准。来源明细一条不动。 ---- */}
                {!isPrep && (
                  <section className="art-paper-sec">
                    <div className="art-paper-sechead">
                      <span>{t('ui.game.exposure')}</span>
                      <i />
                      <em>{TIER_NAMES[tier]}</em>
                    </div>

                    <div className="art-bd-eye">
                      <EyeFigure tier={tier} size={168} variant="on-paper" />
                      <div className="art-bd-eyeside">
                        <span className="art-bd-eyenum num">{Math.round(run.world.exposure)}</span>
                        <p className="art-bd-desc">{TIER_DESC[tier]}</p>
                      </div>
                    </div>

                    <div className="art-bd-tonight">
                      <div className="art-bd-tiprow">
                        <span className="art-bd-tipk">{t('ui.game.tonight')}</span>
                        <span className={`art-bd-tipv num${breakdown.total > 0 ? ' is-bad' : ' is-good'}`}>
                          {breakdown.total > 0 ? '+' : ''}
                          {breakdown.total}
                        </span>
                      </div>
                      {breakdown.parts.map((p, i) => (
                        <div className="art-bd-tiprow is-sub" key={i}>
                          <span className="art-bd-tipk">{p.label}</span>
                          <span className={`art-bd-tipv num${p.value > 0 ? ' is-bad' : ' is-good'}`}>
                            {p.value > 0 ? '+' : ''}
                            {Math.round(p.value * 10) / 10}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

              </div>
            </div>
          </div>

          <footer className="art-paper-tb">
            <div className="art-paper-tbcell is-wide">
              <span className="art-paper-tbk">{t('ui.sheet.record')}</span>
              <span className="art-paper-tbv">{t('ui.game.bodySheet')}</span>
            </div>
            <div className="art-paper-tbcell">
              <span className="art-paper-tbk">{t('ui.sheet.site')}</span>
              <span className="art-paper-tbv">{site.name}</span>
            </div>
            <div className="art-paper-tbcell">
              <span className="art-paper-tbk">{t('ui.sheet.code')}</span>
              <span className="art-paper-tbv num">{site.codename}</span>
            </div>
            <div className="art-paper-tbcell">
              <span className="art-paper-tbk">{t('ui.sheet.date')}</span>
              <span className="art-paper-tbv num">
                {isPrep ? `D-${TIME.PREP_DAYS - run.day + 1}` : t('ui.common.dayN', { n: run.day })}
              </span>
            </div>
            <div className="art-paper-tbcell">
              <span className="art-paper-tbk">{t('ui.sheet.meds')}</span>
              <span className="art-paper-tbv num">{t('ui.sheet.medsValue', { n: run.res.meds })}</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
