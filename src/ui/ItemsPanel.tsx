import { memo } from 'react';

import { TIME, WEAR } from '../game/balance';
import { ITEM_ORDER } from '../game/content/items';
import { t } from '../game/copy/t';
import { iodineBoughtCount } from '../game/engine/economy';
import { iodineActive } from '../game/engine/tags';
import { ITEM_NAME } from '../game/copy/names';
import { useGame } from '../game/store';
import type { RunState } from '../game/types';
import { Bar, Chip, Modal } from './kit';

/**
 * 物品面板：特殊物品（备用滤芯 / 一氧化碳报警器 / 碘片）的独立清单。
 * 主动物品带「使用」按钮；被动生效的报警器不显示按钮。
 * 严格 memo + 父级传入 run 单一来源，内部不做整树订阅。
 */
export const ItemsPanel = memo(function ItemsPanel({ run }: { run: RunState }) {
  const setOverlay = useGame((s) => s.setOverlay);
  const useItem = useGame((s) => s.useItem);

  const isPrep = run.day < TIME.COLLAPSE_DAY;
  const cartridgeCount = run.items?.filter ?? 0;
  const cartridgeLife = run.wear?.filterLife ?? 0;
  const alarmOwned = run.flags.includes('flag:coAlarm');
  const iodineCount = iodineBoughtCount(run);
  const iodineOn = iodineActive(run);

  const rowFor = (id: (typeof ITEM_ORDER)[number]) => {
    const name = ITEM_NAME[id];
    if (id === 'filter') {
      return (
        <div key={id} className="panel p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] text-paper">{name}</span>
              <span className="num text-[11.5px] text-amberdim">×{cartridgeCount}</span>
            </div>
            <button
              className="btn px-3 py-1 text-[11px]"
              disabled={cartridgeCount < 1}
              onClick={() => useItem('filter')}
            >
              {t('ui.items.useFilter')}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Bar value={cartridgeLife} max={WEAR.FILTER_LIFE} tone={cartridgeLife <= 5 ? 'bad' : cartridgeLife <= 12 ? 'warn' : 'good'} />
            <span className="num shrink-0 text-[11px] text-faint">
              {t('ui.items.cartridgeLife', { n: cartridgeLife.toFixed(1), cap: WEAR.FILTER_LIFE })}
            </span>
          </div>
          <div className="mt-1.5 text-[11px] leading-snug text-faint">{t('ui.items.filterDesc')}</div>
        </div>
      );
    }
    if (id === 'coAlarm') {
      return (
        <div key={id} className="panel p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] text-paper">{name}</span>
              {alarmOwned ? <Chip tone="good">{t('ui.items.owned')}</Chip> : <Chip>{t('ui.items.none')}</Chip>}
            </div>
          </div>
          <div className="mt-1.5 text-[11px] leading-snug text-faint">{t('ui.items.coAlarmDesc')}</div>
        </div>
      );
    }
    return (
      <div key={id} className="panel p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] text-paper">{name}</span>
            <span className="num text-[11.5px] text-amberdim">×{iodineCount}</span>
            {iodineOn ? (
              <Chip tone="good">{t('ui.items.iodineOn', { day: run.iodineUntil ?? 0 })}</Chip>
            ) : (
              <Chip>{t('ui.items.iodineOff')}</Chip>
            )}
          </div>
          <button
            className="btn px-3 py-1 text-[11px]"
            disabled={iodineCount < 1 || iodineOn || isPrep}
            onClick={() => useItem('iodine')}
          >
            {t('ui.items.useIodine')}
          </button>
        </div>
        <div className="mt-1.5 text-[11px] leading-snug text-faint">{t('ui.items.iodineDesc')}</div>
        {isPrep && <div className="mt-1 text-[11px] leading-snug text-amberhi">{t('ui.items.iodinePrepHint')}</div>}
      </div>
    );
  };

  return (
    <Modal
      title={t('ui.items.title')}
      subtitle={t('ui.items.subtitle')}
      onClose={() => setOverlay(null)}
      width="max-w-xl"
    >
      <div className="space-y-2">{ITEM_ORDER.map(rowFor)}</div>
    </Modal>
  );
});
