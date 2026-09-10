import { useMemo, useState } from 'react';

import { HOOK_NAME } from '../../game/copy/names';
import { t } from '../../game/copy/t';
import { collectHookRegister, collectTodos, HOOK_CONDITIONS } from '../../game/engine/todos';
import { useGame } from '../../game/store';
import type { RunState } from '../../game/types';
import { Modal, SectionLabel } from '../kit';

/** 今日待办面板：上栏迫在眉睫（红/橙分级卡片，悬停或点击展开详情），
 *  下栏事件钩子登记（只列已挂起钩子的名与触发条件，不透后果）。
 *  纯派生只读面板——不动 run，随时可开可关。 */
export function ArtTodoPanel({ run }: { run: RunState }) {
  const setOverlay = useGame((s) => s.setOverlay);
  const todos = useMemo(() => collectTodos(run), [run]);
  const hooks = useMemo(() => collectHookRegister(run), [run]);
  const [openId, setOpenId] = useState<string | null>(null);
  const hasEventWaiting = run.queue.length > 0;

  return (
    <Modal title={t('ui.game.todoTitle')} onClose={() => setOverlay(null)} width="max-w-2xl">
      <SectionLabel>{t('ui.game.todoUrgent')}</SectionLabel>
      {todos.length === 0 ? (
        <p className="text-[12px] leading-relaxed text-faint">{t('ui.game.todoNone')}</p>
      ) : (
        <div className="space-y-2">
          {todos.map((td) => {
            const open = openId === td.id;
            return (
              <div
                key={td.id}
                className={`art-todo-item is-${td.level}${open ? ' is-open' : ''}`}
                onClick={() => setOpenId(open ? null : td.id)}
              >
                <div className="art-todo-head">
                  <span className="art-todo-dot" aria-hidden />
                  <span className="art-todo-title">{td.title}</span>
                </div>
                <div className="art-todo-detail" role="note">
                  {td.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                  <p className="art-todo-fix">
                    {t('ui.game.todoFix')}：{td.fix}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <SectionLabel>{t('ui.game.todoHooks')}</SectionLabel>
        {hooks.length === 0 ? (
          <p className="text-[12px] text-faint">{t('ui.game.todoNoHooks')}</p>
        ) : (
          <ul className="space-y-1.5">
            {hooks.map((row) => (
              <li key={row.hook} className="flex items-baseline justify-between gap-3 text-[12px] leading-snug">
                <span className="text-[#dfe2e5]">
                  {HOOK_NAME[row.hook]}
                  {row.count > 1 && (
                    <span className="text-faint">
                      （{row.count} {t('ui.game.todoHookWait')}）
                    </span>
                  )}
                </span>
                <span className="text-right text-[11px] text-dim">{HOOK_CONDITIONS[row.hook]}</span>
              </li>
            ))}
          </ul>
        )}
        {hasEventWaiting && (
          <p className="mt-3 border-t border-line pt-2 text-[11.5px] text-amberhi">{t('ui.game.todoOpenEvent')}</p>
        )}
      </div>
    </Modal>
  );
}
