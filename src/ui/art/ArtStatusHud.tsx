import { useState } from 'react';

import { t } from '../../game/copy/t';
import type { RunState } from '../../game/types';

/** 低值警示阈值：hp<25（濒危）、stamina<18（=AP.CRITICAL_STAMINA，行动点再减 1）、sanity<25。 */
const ROWS = [
  { id: 'hp', low: 25 },
  { id: 'stamina', low: 18 },
  { id: 'sanity', low: 25 },
] as const;

/** 左下角常驻状态（行动点 + 生命/理智/体力）：黑白末世风，默认只有名称+进度条/点数，
 *  悬停或点击出具体数值与作用说明。fixed + z-50：弹窗与其他界面都不盖它。 */
export function ArtStatusHud({ run }: { run: RunState }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`art-stat-hud${open ? ' is-open' : ''}`}
      onClick={() => setOpen(!open)}
    >
      <div className="art-stat" data-low={run.ap === 0 || undefined}>
        <span className="art-stat-name">{t('ui.game.ap')}</span>
        <span className="art-stat-pips">
          {Array.from({ length: run.apMax }).map((_, i) => (
            <i key={i} className={i < run.ap ? 'is-on' : ''} />
          ))}
        </span>
        <span className="art-stat-detail" role="tooltip">
          <b>
            {t('ui.game.ap')} {run.ap}
            <em>/{run.apMax}</em>
          </b>
          <p>{t('ui.game.apDesc')}</p>
        </span>
      </div>
      {ROWS.map(({ id, low }) => {
        const v = run.stats[id];
        const name = t(`ui.game.${id}`);
        return (
          <div className="art-stat" key={id} data-low={v < low || undefined}>
            <span className="art-stat-name">{name}</span>
            <span className="art-stat-track">
              <i style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
            </span>
            <span className="art-stat-detail" role="tooltip">
              <b>
                {name} {Math.round(v)}
                <em>/100</em>
              </b>
              <p>{t(`ui.game.${id}Desc`)}</p>
            </span>
          </div>
        );
      })}
    </div>
  );
}
