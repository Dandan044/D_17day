import { useEffect, useRef, useState } from 'react';

import { t } from '../../game/copy/t';
import { useGame } from '../../game/store';
import type { RunState } from '../../game/types';
import { NotebookSheet } from './NotebookSheet';
import { ART } from './skin';
import { TodoSpread } from './TodoSpread';
import './art.css';

/**
 * 今日待办：桌面上那本横开笔记本，翻开摊在眼前。
 *
 * 进入方式与视觉必须呼应——点的是桌上的本子，所以整屏就是这本本子摊开的两页：
 * 左页「迫在眉睫」（红笔划定 = 要命、橙色马克笔 = 预警），右页「在等的事」（钩子登记）。
 * 纸的冷米白、中缝与针脚、横格底线都是拿来解释"这是一本手写本"的。
 *
 * 正文在 `TodoSpread` 里——另一个入口是「事件翻完」，那时纸不该重新进场，
 * 所以只有这里负责整屏 veil 与纸的进/出场动画。
 *
 * 与旧版的两点差别：
 * 1. 详情从"悬停弹深色浮层"改成**点开内联推挤**——深色浮层在米白纸上正是要消灭的控制台感，
 *    而且浮层里的东西悬不稳、触屏直接失效；
 * 2. 每条常显「标题 + 一行最要害的数值」，其余数值行与对策点开才看。
 *
 * 纯派生只读面板——不动 run，随时可开可关。数据契约仍走 collectTodos / collectHookRegister。
 */

const SHEET_OUT_MS = 240;

export function ArtTodoPanel({ run }: { run: RunState }) {
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

  return (
    <div
      className={`art-nb-veil${closing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('ui.game.todoTitle')}
    >
      <div className="art-nb-room" style={{ backgroundImage: `url(${ART.sceneHomeDesk})` }} aria-hidden />
      <NotebookSheet run={run}>
        <TodoSpread run={run} onClose={close} />
      </NotebookSheet>
    </div>
  );
}
