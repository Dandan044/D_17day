import { useMemo, useState } from 'react';

import { HOOK_NAME } from '../../game/copy/names';
import { t } from '../../game/copy/t';
import { HOOK_CONDITIONS, collectHookRegister, collectTodos, type TodoItem } from '../../game/engine/todos';
import type { RunState } from '../../game/types';

/**
 * 今日待办的**两页正文**（抬头 + 左页迫在眉睫 + 右页在等的事 + 页脚）。
 *
 * 抽出来是因为它有两个入口、但必须是同一本本子：
 * 1. 直接点桌上本子 → `ArtTodoPanel`（整屏纸自己带进场动画）；
 * 2. 今天的事件翻完 → `ArtEventBook` 直接翻到这两页（纸不重新进场，只换内容，
 *    否则会看到本子又"飞进来"一次，很生硬）。
 *
 * 左页分级：红笔划定 = 要命、橙色马克笔 = 预警（都是 CSS 画的笔迹，不用色块徽章）。
 * 每条常显「标题 + 一行最要害的数值」，其余数值行与对策点开才看。
 * 纯派生只读——不动 run。
 */

/** 最要害的一行：第一条带数字的（如「生命 62/100。」），退回首行。 */
const hasDigit = (s: string) => /[0-9]/.test(s);
const keyLineOf = (td: TodoItem) => td.lines.find(hasDigit) ?? td.lines[0] ?? '';
const restLinesOf = (td: TodoItem) => td.lines.filter((l) => l !== keyLineOf(td));

export function TodoSpread({ run, onClose }: { run: RunState; onClose: () => void }) {
  const todos = useMemo(() => collectTodos(run), [run]);
  const hooks = useMemo(() => collectHookRegister(run), [run]);
  const [openId, setOpenId] = useState<string | null>(null);
  const hasEventWaiting = run.queue.length > 0;

  return (
    <>
      <header className="art-nb-strip">
        <span className="art-nb-stamp num">{t('ui.todo.sheetNo')}</span>
        <h2 className="art-nb-title">{t('ui.game.todoTitle')}</h2>
        <button type="button" className="art-nb-close" onClick={onClose}>
          {t('ui.common.close')}
          <span aria-hidden>✕</span>
        </button>
      </header>

      <div className="art-nb-spread">
        {/* ---- 左页：迫在眉睫 ---- */}
        <section className="art-nb-page is-left" aria-labelledby="nb-page-urgent">
          <div className="art-nb-pagehead">
            <h3 className="art-nb-pagename" id="nb-page-urgent">
              {t('ui.game.todoUrgent')}
            </h3>
          </div>

          {todos.length === 0 ? (
            <p className="art-nb-empty">{t('ui.game.todoNone')}</p>
          ) : (
            <div className="art-nb-list" role="list">
              {todos.map((td, i) => {
                const open = openId === td.id;
                return (
                  <article key={td.id} role="listitem" className={`art-nb-item is-${td.level}${open ? ' is-open' : ''}`}>
                    <button
                      type="button"
                      id={`nb-${td.id}`}
                      className="art-nb-itembtn"
                      aria-expanded={open}
                      aria-controls={`nbd-${td.id}`}
                      onClick={() => setOpenId(open ? null : td.id)}
                    >
                      <span className="art-nb-no num" aria-hidden>
                        {i + 1}
                      </span>
                      <span className="art-nb-main">
                        <span className="art-nb-head">
                          <span className="art-nb-name">{td.title}</span>
                        </span>
                        <span className="art-nb-key">{keyLineOf(td)}</span>
                      </span>
                      <svg className="art-nb-caret" viewBox="0 0 12 12" aria-hidden>
                        <path d="M2 4.5 L6 8.5 L10 4.5" />
                      </svg>
                    </button>

                    {open && (
                      <div className="art-nb-detail" id={`nbd-${td.id}`} role="region" aria-labelledby={`nb-${td.id}`}>
                        {restLinesOf(td).map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                        <p className="art-nb-fix">
                          {t('ui.game.todoFix')}：{td.fix}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ---- 右页：在等的事 ---- */}
        <section className="art-nb-page is-right" aria-labelledby="nb-page-waiting">
          <div className="art-nb-pagehead">
            <h3 className="art-nb-pagename" id="nb-page-waiting">
              {t('ui.todo.pageWaiting')}
            </h3>
          </div>

          {hooks.length === 0 ? (
            <p className="art-nb-empty">{t('ui.game.todoNoHooks')}</p>
          ) : (
            <ul className="art-nb-hooks">
              {hooks.map((row) => (
                <li key={row.hook} className="art-nb-hook">
                  <span className="art-nb-hookname">
                    {HOOK_NAME[row.hook]}
                    {row.count > 1 && (
                      <span className="art-nb-hookcount">
                        （{row.count} {t('ui.game.todoHookWait')}）
                      </span>
                    )}
                  </span>
                  <span className="art-nb-hookcond">{HOOK_CONDITIONS[row.hook]}</span>
                </li>
              ))}
            </ul>
          )}

          {hasEventWaiting && <p className="art-nb-note">{t('ui.game.todoOpenEvent')}</p>}
        </section>
      </div>

      <p className="art-nb-foot">
        <span>{t('ui.todo.foldHint')}</span>
        <span className="art-nb-footdot" aria-hidden>
          ·
        </span>
        <span>{t('ui.todo.footNote')}</span>
      </p>
    </>
  );
}
