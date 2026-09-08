import { TIME } from '../../game/balance';
import { t } from '../../game/copy/t';
import { SITE_BY_ID } from '../../game/content/sites';
import { useGame } from '../../game/store';
import type { RunState } from '../../game/types';
import { BodyPanel, ExposurePanel, RationPanel, SuppliesPanel } from '../Game';
import { Modal, SectionLabel } from '../kit';
import { PowerPanel } from '../PowerPanel';

export function ArtPlanPanel({ run }: { run: RunState }) {
  const setOverlay = useGame((s) => s.setOverlay);
  return (
    <Modal title={t('ui.game.planTitle')} onClose={() => setOverlay(null)} width="max-w-3xl">
      <RationPanel run={run} />
      <div className="mt-3 border-t border-line pt-3">
        <SectionLabel>{t('ui.game.powerLabel')}</SectionLabel>
        <PowerPanel run={run} embedded />
      </div>
    </Modal>
  );
}

export function ArtBodyPanel({ run }: { run: RunState }) {
  const setOverlay = useGame((s) => s.setOverlay);
  const isPrep = run.day < TIME.COLLAPSE_DAY;
  return (
    <Modal title={t('ui.game.body')} onClose={() => setOverlay(null)} width="max-w-lg">
      <BodyPanel run={run} />
      {!isPrep && (
        <div className="mt-3">
          <ExposurePanel run={run} />
        </div>
      )}
    </Modal>
  );
}

export function ArtSuppliesPanel({ run }: { run: RunState }) {
  const setOverlay = useGame((s) => s.setOverlay);
  const cap = SITE_BY_ID[run.siteId ?? 'apartment']?.companionCap ?? 0;
  return (
    <Modal title={t('ui.game.supplies')} onClose={() => setOverlay(null)} width="max-w-lg">
      <SuppliesPanel run={run} />
      {cap > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <button className="btn btn-ghost w-full py-1.5 text-[11.5px]" onClick={() => setOverlay('crew')}>
            {t('ui.crew.title')}
          </button>
        </div>
      )}
    </Modal>
  );
}
