import { TIME } from '../game/balance';
import { t } from '../game/copy/t';
import { useGame } from '../game/store';
import { Modal, SectionLabel } from './kit';

export function HelpPanel() {
  const { setOverlay } = useGame();
  return (
    <Modal title={t('ui.help.title')} subtitle={t('ui.help.subtitle')} onClose={() => setOverlay(null)} width="max-w-2xl">
      <SectionLabel>{t('ui.help.day')}</SectionLabel>
      <p className="mb-3 text-[12.5px] leading-relaxed text-dim">
        {t('ui.help.dayBody', { prep: TIME.PREP_DAYS, collapse: TIME.COLLAPSE_DAY, final: TIME.FINAL_DAY })}
      </p>

      <SectionLabel>{t('ui.help.wep')}</SectionLabel>
      <p className="mb-3 text-[12.5px] leading-relaxed text-dim">{t('ui.help.wepBody')}</p>

      <SectionLabel>{t('ui.help.exposure')}</SectionLabel>
      <p className="mb-3 text-[12.5px] leading-relaxed text-dim">{t('ui.help.exposureBody')}</p>

      <SectionLabel>{t('ui.help.ration')}</SectionLabel>
      <p className="mb-3 text-[12.5px] leading-relaxed text-dim">{t('ui.help.rationBody')}</p>

      <SectionLabel>{t('ui.help.intel')}</SectionLabel>
      <p className="text-[12.5px] leading-relaxed text-dim">{t('ui.help.intelBody')}</p>
    </Modal>
  );
}
