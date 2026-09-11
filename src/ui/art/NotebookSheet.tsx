import type { ReactNode } from 'react';

import type { RunState } from '../../game/types';
import { NotebookWear } from './NotebookWear';
import { ART } from './skin';

/**
 * 桌上那本横开笔记本的纸：纸面 + 朱红页边线 + 中缝针脚 +（最后叠上的）动态污损层。
 *
 * 「今日待办」和「事件书本」是**同一本本子**的两个状态——翻完今天的事件就落到待办那两页，
 * 所以纸、中缝、污损这三样必须共用一份，否则两处会长得不像同一本。
 *
 * 污损层放在 children **之后**：它要压在文字上（破损与涂鸦遮挡部分信息是预期效果），
 * 靠 `pointer-events: none` 保证点得到下面。
 */
export function NotebookSheet({
  run,
  children,
  className,
}: {
  run: RunState;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`art-nb-sheet${className ? ` ${className}` : ''}`}>
      <div className="art-nb-paper" style={{ backgroundImage: `url(${ART.todoPaper})` }} aria-hidden />
      <span className="art-nb-margin" aria-hidden />
      <span className="art-nb-spine" aria-hidden>
        <i />
        <i />
        <i />
        <i />
      </span>
      {children}
      <NotebookWear run={run} />
    </div>
  );
}
