import { useEffect, useRef, useState } from 'react';

import { HEALTH } from '../../game/balance';
import { FAMILY_BY_ID } from '../../game/content/events';
import { SITE_BY_ID } from '../../game/content/sites';
import { RES_NAME, SKILL_NAME } from '../../game/copy/names';
import { t } from '../../game/copy/t';
import { kindName } from '../../game/engine/director';
import { checkRequirement } from '../../game/engine/tags';
import { useGame } from '../../game/store';
import type { Choice, ResourceId, RunState } from '../../game/types';
import { cachedFacts } from '../derived';
import { scrambleText } from '../scramble';
import { NotebookSheet } from './NotebookSheet';
import { TodoSpread } from './TodoSpread';
import './art.css';

/**
 * 今天的事件读法：桌面上那本本子翻开来，**左页是发生了什么，右页是怎么应对**。
 *
 * 入口是同一个本子热点——队列里还有事件就先翻书，翻完落到「今日待办」那两页
 * （`ArtGame` 的 onNotebook 与队列清空后的 effect 负责这段换乘）。
 *
 * 与经典皮肤的关系：`src/ui/EventCard.tsx` 同时被经典皮肤的三栏布局用（`Game.tsx:53`），
 * 所以**不能改它**——这里把查询逻辑（family/variant 查找、`checkRequirement`、
 * 成功率、材料消耗）重写一遍，只换呈现。
 *
 * 结算不再是弹窗：档案皮肤下 App 层那个 `ChoiceResultModal` 被屏蔽，结果**写在左页正文下方**
 * 当一段手写批注，关掉才继续翻页。
 */

const TURN_MS = 430;

/** d20 + 技能 >= dc 的成功率 */
function successChance(dc: number, skill: number): number {
  const need = dc - skill;
  if (need <= 1) return 1;
  if (need > 20) return 0;
  return (21 - need) / 20;
}

function requirementCost(c: Choice): string {
  if (!c.requires?.res) return '';
  return Object.entries(c.requires.res)
    .map(([k, v]) => `${v} ${RES_NAME[k as keyof typeof RES_NAME] ?? k}`)
    .join(' · ');
}

export function ArtEventBook({ run, onBack }: { run: RunState; onBack: () => void }) {
  const resolveChoice = useGame((s) => s.resolveChoice);
  const dismissChoice = useGame((s) => s.dismissChoice);
  const lastChoice = useGame((s) => s.lastChoice);

  const item = run.queue[0];
  // 刚作答的那一件。**结算没关掉之前，页面必须停在它身上**——因为 resolveChoice 会立刻把
  // 队列头换成下一件，不这样做的话第一件的结果就会显示在第二件的正文下面（"还没点确认下一件就翻出来了"）。
  const [answered, setAnswered] = useState<{ familyId: string; variantId: string; choiceId: string } | null>(null);
  const [turning, setTurning] = useState(false);

  const pending = !!lastChoice;
  const display = pending && answered ? answered : item;
  const shownKey = display ? `${display.familyId}:${display.variantId}` : '';
  const prev = useRef(shownKey);

  // 翻页动画：**真正换了显示条目**才播一次（点完「继续」关掉结算后才翻到下一件）
  useEffect(() => {
    if (prev.current && prev.current !== shownKey) {
      prev.current = shownKey;
      setTurning(true);
      const id = window.setTimeout(() => setTurning(false), TURN_MS);
      return () => window.clearTimeout(id);
    }
    prev.current = shownKey;
  }, [shownKey]);

  const family = display ? FAMILY_BY_ID[display.familyId] : undefined;
  const variant = display && family ? family.variants.find((v) => v.id === display.variantId) : undefined;

  const facts = cachedFacts(run);
  const unreliable = run.stats.sanity < HEALTH.SANITY_UNRELIABLE;
  const hideRecruit = (SITE_BY_ID[run.siteId ?? 'apartment']?.companionCap ?? 0) <= 0;
  const visibleChoices = (variant?.choices ?? []).filter((c) => {
    if (!hideRecruit) return true;
    const rec = c.effect?.survivor?.recruit ?? c.check?.ok?.survivor?.recruit ?? c.check?.bad?.survivor?.recruit;
    return !rec;
  });

  const remaining = run.queue.length;
  // 全部读完（队列空、结算也关了）→ 这本本子直接翻到「今日待办」那两页。
  // 关键：**不换组件**——纸还是同一张，只换内容，否则会看到本子又"飞进来"一次，很生硬。
  const finished = remaining === 0 && !pending;

  return (
    <div className="art-nb-veil art-book-veil" role="dialog" aria-modal="true" aria-label={t('ui.event.bookKicker')}>
      <div className="art-nb-room" aria-hidden />

      <NotebookSheet run={run} className="is-book">
        {finished ? (
          <div className="art-book-landed">
            <TodoSpread run={run} onClose={onBack} />
          </div>
        ) : (
          <>
            <header className="art-nb-strip">
              <span className="art-nb-stamp num">{t('ui.event.bookKicker')}</span>
              <h2 className="art-nb-title">
                {family ? kindName(family.kind) : t('ui.event.bookKicker')}
                {family && (
                  <span className="art-book-intensity">
                    {t('ui.event.intensity', { bars: '▍'.repeat(family.intensity) })}
                  </span>
                )}
              </h2>
              <span className="art-book-count">
                {remaining > 1 ? t('ui.event.remaining', { n: remaining }) : t('ui.event.lastPage')}
              </span>
              <button type="button" className="art-nb-close" onClick={onBack}>
                {t('ui.game.eventBack')}
                <span aria-hidden>✕</span>
              </button>
            </header>

            <div className="art-nb-spread is-book">
          {/* ---- 左页：发生了什么 ---- */}
          <section className="art-nb-page is-left" aria-labelledby="book-left">
            <div className="art-nb-pagehead">
              <h3 className="art-nb-pagename" id="book-left">
                {t('ui.event.pageLeft')}
              </h3>
              {remaining > 1 && <span className="art-book-rest">{t('ui.event.remaining', { n: remaining })}</span>}
            </div>

            {!variant ? (
              <p className="art-nb-empty">{t('ui.event.toTodo')}</p>
            ) : (
              <>
                <h4 className="art-book-title">{scrambleText(variant.title ?? '', run, `${display!.familyId}-t`)}</h4>
                <div className={`art-book-body${unreliable ? ' is-unreliable' : ''}`}>
                  {(variant.body ?? '').split('\n').map((p, i) => (
                    <p key={i}>{scrambleText(p, run, `${display!.familyId}-b${i}`)}</p>
                  ))}
                </div>
                {unreliable && <p className="art-book-scramble">{t('ui.event.scramble')}</p>}
              </>
            )}

            {/* 结算：写在左页下方的手写批注（档案皮肤下不再弹窗） */}
            {lastChoice && (
              <div className="art-book-result">
                <p className="art-book-resultk">
                  {t('ui.event.resultNote')}
                  {lastChoice.checkRoll && (
                    <span className={lastChoice.checkRoll.success ? 'is-ok' : 'is-bad'}>
                      {lastChoice.checkRoll.success
                        ? t('ui.result.checkOk', { skill: SKILL_NAME[lastChoice.checkRoll.skill] })
                        : t('ui.result.checkBad', { skill: SKILL_NAME[lastChoice.checkRoll.skill] })}
                    </span>
                  )}
                </p>
                {lastChoice.checkRoll && (
                  <p className="art-book-roll num">
                    {t('ui.result.d20', {
                      roll: lastChoice.checkRoll.roll,
                      skill: lastChoice.checkRoll.total - lastChoice.checkRoll.roll,
                      total: lastChoice.checkRoll.total,
                      dc: lastChoice.checkRoll.dc,
                    })}
                  </p>
                )}
                {lastChoice.title && <p className="art-book-resulttext">{lastChoice.title}</p>}
                {lastChoice.raid && (
                  <>
                    <p className={`art-book-raid${lastChoice.raid.repelled ? ' is-ok' : ' is-bad'}`}>
                      {lastChoice.raid.repelled ? t('ui.result.held') : t('ui.result.broken')}
                      <span> · {lastChoice.raid.narrative}</span>
                    </p>
                    <p className="art-book-chips">
                      {lastChoice.raid.hpLost > 0 && <em className="is-bad">{t('ui.result.hp', { n: lastChoice.raid.hpLost })}</em>}
                      {lastChoice.raid.usedAmmo > 0 && <em>{t('ui.result.ammo', { n: lastChoice.raid.usedAmmo })}</em>}
                      {lastChoice.raid.moduleDamaged && (
                        <em className="is-bad">{t('ui.result.module', { name: lastChoice.raid.moduleDamaged })}</em>
                      )}
                      {Object.entries(lastChoice.raid.lost).map(([k, v]) => (
                        <em key={k} className="is-bad">
                          {RES_NAME[k as ResourceId]} -{v}
                        </em>
                      ))}
                    </p>
                  </>
                )}
                {lastChoice.died && <p className="art-book-raid is-bad">{t('ui.result.died')}</p>}
                {lastChoice.notes.length > 0 && (
                  <p className="art-book-chips">
                    {lastChoice.notes.map((n, i) => (
                      <em key={i}>{n}</em>
                    ))}
                  </p>
                )}
                <button
                  type="button"
                  className="art-book-continue"
                  onClick={() => {
                    setAnswered(null); // 清掉停留标记 → 下一帧才翻到下一件
                    dismissChoice();
                  }}
                >
                  {lastChoice.died ? t('ui.common.settle') : t('ui.common.continue')}
                </button>
              </div>
            )}
          </section>

          {/* ---- 右页：怎么应对 ---- */}
          <section className="art-nb-page is-right" aria-labelledby="book-right">
            <div className="art-nb-pagehead">
              <h3 className="art-nb-pagename" id="book-right">
                {t('ui.event.pageRight')}
              </h3>
            </div>

            <div className={`art-book-choices${pending ? ' is-locked' : ''}`}>
              {visibleChoices.map((c) => {
                const req = checkRequirement(c.requires, run, facts);
                const chance = c.check ? successChance(c.check.dc, run.skills[c.check.skill]) : null;
                const cost = requirementCost(c);
                const disabled = !req.ok || pending;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`art-book-choice${pending && answered?.choiceId === c.id ? ' is-picked' : ''}`}
                    disabled={disabled}
                    onClick={() => {
                      if (!item) return;
                      setAnswered({ familyId: item.familyId, variantId: item.variantId, choiceId: c.id });
                      resolveChoice(item.familyId, item.variantId, c.id);
                    }}
                  >
                    <span className="art-book-choicelabel">
                      {scrambleText(c.label ?? '', run, `${display!.familyId}-${c.id}`)}
                      {!req.ok && <em className="art-book-choicereason">{req.reason}</em>}
                      {req.ok && chance !== null && c.check && (
                        <em className="art-book-chance">
                          {SKILL_NAME[c.check.skill]} · {Math.round(chance * 100)}%
                        </em>
                      )}
                      {req.ok && cost && !c.check && <em className="art-book-chance">{cost}</em>}
                    </span>
                    {c.note && <span className="art-book-choicenote">{c.note}</span>}
                  </button>
                );
              })}
            </div>

            <p className="art-book-hint">{pending ? t('ui.common.continue') : t('ui.event.turnHint')}</p>
          </section>
        </div>

        <p className="art-nb-foot">
          <span>{t('ui.event.bookKicker')}</span>
          <span className="art-nb-footdot" aria-hidden>
            ·
          </span>
          <span>{t('ui.event.turnHint')}</span>
        </p>
          </>
        )}

        {turning && <span className="art-book-leaf" aria-hidden />}
      </NotebookSheet>
    </div>
  );
}
