import { useState } from 'react';

import { MODULES } from '../game/content/modules';
import { SITES } from '../game/content/sites';
import { SITE_TAG_NAME } from '../game/copy/names';
import { t } from '../game/copy/t';
import { useGame } from '../game/store';
import type { ModuleId, Site } from '../game/types';
import { Chip, Panel } from './kit';

export default function SiteSelect() {
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

  return (
    <div className="scroll-y h-full p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <div className="label text-amberdim">{t('ui.site.kicker')}</div>
          <div className="num text-[12px] text-dim">
            {t('ui.site.cash')} <span className="text-amberhi">{run.res.cash}</span> {t('ui.common.yuanUnit')}
          </div>
        </div>
        <h2 className="title-stamp mb-1 text-2xl text-paper">{t('ui.site.title')}</h2>
        <p className="mb-5 max-w-2xl text-[13px] leading-relaxed text-dim">{t('ui.site.blurb')}</p>

        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {SITES.map((s) => {
            const ok = unlocked(s);
            const can = affordable(s);
            const isSel = selected?.id === s.id;
            return (
              <div
                key={s.id}
                className={`panel corner-mark transition-colors ${
                  s.wip ? 'opacity-50' : 'cursor-pointer'
                } ${isSel ? 'border-amber/70' : s.wip ? '' : 'hover:border-line2'} ${!ok && !s.wip ? 'opacity-45' : ''}`}
                onClick={() => ok && setSelected(s)}
              >
                <div className="panel-head">
                  <span>{s.codename}</span>
                  {s.wip ? (
                    <Chip tone="warn">{t('ui.common.wip')}</Chip>
                  ) : !ok ? (
                    <Chip tone="bad">{t('ui.common.locked')}</Chip>
                  ) : !can ? (
                    <Chip tone="warn">{t('ui.common.condFail')}</Chip>
                  ) : null}
                </div>
                <div className="p-3">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <h3 className="text-[15px] font-medium text-paper">{s.name}</h3>
                    <span className="num text-[11.5px] text-amberdim">{costText(s)}</span>
                  </div>
                  <p className="mb-3 text-[12.5px] leading-relaxed text-dim">{s.desc}</p>

                  <div className="mb-2 flex flex-wrap gap-1">
                    {s.tags.map((tag) => (
                      <Chip key={tag} tone="info">
                        {SITE_TAG_NAME[tag] ?? tag}
                      </Chip>
                    ))}
                  </div>

                  <div className="space-y-1">
                    {s.pros.map((p) => (
                      <div key={p} className="flex gap-1.5 text-[12px] leading-snug text-safehi">
                        <span className="text-safe">+</span>
                        <span>{p}</span>
                      </div>
                    ))}
                    {s.cons.map((c) => (
                      <div key={c} className="flex gap-1.5 text-[12px] leading-snug text-alarmhi">
                        <span className="text-alarm">−</span>
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {selected && (
          <div className="sticky bottom-0 mt-4 border-t border-line bg-ink/95 pt-4 backdrop-blur">
            <div className="grid gap-3 lg:grid-cols-[1fr_240px]">
              <Panel title={t('ui.site.caps', { name: selected.name })}>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                  {MODULES.map((m) => {
                    const cap = selected.caps[m.id as ModuleId] ?? 3;
                    const base = selected.baseModules[m.id as ModuleId] ?? 0;
                    return (
                      <div key={m.id} className="text-center" title={t('ui.site.capHint', { name: m.name, n: cap })}>
                        <div className="label !text-[9px]">{m.name}</div>
                        <div className="mt-1 flex justify-center gap-0.5">
                          {[1, 2, 3].map((lv) => (
                            <span
                              key={lv}
                              className="h-3 w-1.5"
                              style={{
                                background:
                                  lv <= base
                                    ? 'var(--color-safe)'
                                    : lv <= cap
                                      ? 'var(--color-line2)'
                                      : 'var(--color-alarmdim)',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 border-t border-line pt-2 text-[11px] text-faint">
                  <span>
                    <span className="mr-1 inline-block h-2 w-2 bg-safe align-middle" />
                    {t('ui.site.included')}
                  </span>
                  <span>
                    <span className="mr-1 inline-block h-2 w-2 bg-line2 align-middle" />
                    {t('ui.site.buildable')}
                  </span>
                  <span>
                    <span className="mr-1 inline-block h-2 w-2 bg-alarmdim align-middle" />
                    {t('ui.site.limited')}
                  </span>
                  <span className="ml-auto">
                    {t('ui.site.stats', {
                      loot: selected.lootMult,
                      cap: selected.companionCap,
                      water: selected.waterCapMult,
                    })}
                  </span>
                </div>
              </Panel>
              <div className="flex flex-col justify-end gap-2">
                <button
                  className="btn btn-primary py-3"
                  disabled={!affordable(selected)}
                  onClick={() => chooseSite(selected.id)}
                >
                  {t('ui.site.here', { cost: costText(selected) })}
                </button>
                <button className="btn btn-ghost" onClick={() => setSelected(null)}>
                  {t('ui.site.look')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
