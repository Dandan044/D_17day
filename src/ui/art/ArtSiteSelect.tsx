import { useState } from 'react';

import { MODULES } from '../../game/content/modules';
import { SITES } from '../../game/content/sites';
import { t } from '../../game/copy/t';
import { useGame } from '../../game/store';
import type { ModuleId, Site } from '../../game/types';
import { ArtFile, ArtSceneFrame } from './ArtHotspot';
import { ART, hideBrokenImg } from './skin';
import './art.css';

const PIN: Record<string, { left: string; top: string }> = {
  apartment: { left: '54%', top: '40%' },
  garage: { left: '70%', top: '64%' },
  bungalow: { left: '50%', top: '58%' },
  bunker: { left: '28%', top: '66%' },
  farmhouse: { left: '22%', top: '46%' },
  watertower: { left: '64%', top: '26%' },
};

export default function ArtSiteSelect() {
  const { run, meta, chooseSite } = useGame();
  const [selected, setSelected] = useState<Site | null>(null);
  if (!run) return null;

  const unlocked = (s: Site) => !s.wip && (!s.unlock || meta.unlocked.includes(s.unlock));

  const costText = (s: Site) => {
    const parts: string[] = [];
    if (s.cost.cash) parts.push(t('ui.common.yuan', { n: s.cost.cash }));
    if (s.cost.ap) parts.push(t('ui.common.apCost', { n: s.cost.ap }));
    if (s.cost.requires?.res?.parts) parts.push(t('ui.common.parts', { n: s.cost.requires.res.parts }));
    return parts.length ? parts.join(' · ') : t('ui.common.free');
  };

  const affordable = (s: Site) => {
    if (!unlocked(s)) return false;
    if (s.cost.cash && run.res.cash < s.cost.cash) return false;
    if (s.cost.requires?.res?.parts && run.res.parts < s.cost.requires.res.parts) return false;
    if (s.cost.requires?.skills?.negotiation && run.skills.negotiation < s.cost.requires.skills.negotiation) return false;
    if (s.cost.requires?.tags?.all?.includes('hasVehicle') && !run.hasVehicle) return false;
    return true;
  };

  const onPin = (s: Site) => {
    if (!unlocked(s)) return;
    if (selected?.id === s.id) {
      if (affordable(s)) chooseSite(s.id);
      return;
    }
    setSelected(s);
  };

  return (
    <div className="art-root">
      <div className="art-grain" />
      <ArtSceneFrame src={ART.mapBoard}>
        <button type="button" className="art-map-miss" aria-label={t('ui.site.look')} onClick={() => setSelected(null)} />

        {SITES.map((s) => {
          const pos = PIN[s.id] ?? { left: '50%', top: '50%' };
          const ok = unlocked(s);
          const can = affordable(s);
          const isSel = selected?.id === s.id;
          const badge = s.wip
            ? t('ui.common.wip')
            : !ok
              ? t('ui.common.locked')
              : isSel
                ? can
                  ? t('ui.site.here', { cost: costText(s) })
                  : t('ui.common.condFail')
                : s.codename;
          return (
            <button
              key={s.id}
              type="button"
              className={`art-pin ${isSel ? 'is-on' : ''} ${!ok || !can ? 'is-off' : ''}`}
              style={{ left: pos.left, top: pos.top }}
              disabled={!ok}
              onClick={() => onPin(s)}
            >
              <img
                src={ART.modelCut(s.id)}
                alt=""
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.dataset.fallback) {
                    hideBrokenImg(e);
                    return;
                  }
                  img.dataset.fallback = '1';
                  img.src = ART.model(s.id);
                }}
              />
              <span className="art-pin-tip">
                {s.name}
                <em>{badge}</em>
              </span>
            </button>
          );
        })}

        {selected && (
          <div className="art-slip" style={{ top: 'auto', right: 'auto', left: '3%', bottom: '6%' }}>
            <div className="art-kicker" style={{ color: '#7a5a12' }}>
              {selected.codename}
            </div>
            <h3>{selected.name}</h3>
            <p>{selected.desc}</p>
            <p>
              {selected.pros.slice(0, 2).join(' · ')}
            </p>
            <p className="art-slip-perk">{selected.cons.slice(0, 2).join(' · ')}</p>
            <div className="mt-2 flex justify-center gap-1">
              {MODULES.slice(0, 10).map((m) => {
                const cap = selected.caps[m.id as ModuleId] ?? 3;
                const base = selected.baseModules[m.id as ModuleId] ?? 0;
                return (
                  <span key={m.id} className="flex gap-0.5" title={m.name}>
                    {[1, 2, 3].map((lv) => (
                      <i
                        key={lv}
                        className="inline-block h-2 w-1"
                        style={{
                          background:
                            lv <= base ? '#3f9e6b' : lv <= cap ? '#8a7d68' : '#c45a4e',
                        }}
                      />
                    ))}
                  </span>
                );
              })}
            </div>
            {affordable(selected) && (
              <ArtFile
                left="82%"
                top="90%"
                width="72px"
                src={ART.stamp}
                label={t('ui.site.here', { cost: costText(selected) })}
                onClick={() => chooseSite(selected.id)}
              />
            )}
          </div>
        )}
      </ArtSceneFrame>

      <div className="art-mark">
        <div className="art-kicker">{t('ui.site.kicker')}</div>
        <h2 className="art-title mt-1 text-2xl">{t('ui.site.title')}</h2>
        <div className="num mt-2 text-[12px] text-amberhi">
          {t('ui.site.cash')} {run.res.cash} {t('ui.common.yuanUnit')}
        </div>
      </div>
    </div>
  );
}
