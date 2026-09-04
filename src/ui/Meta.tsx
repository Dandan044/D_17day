import { useState } from 'react';

import { CLASSES, PERK_TEXT, SUPPLY_PACKS } from '../game/content/classes';
import { DISASTERS } from '../game/content/disasters';
import { ENDINGS } from '../game/content/endings';
import { ALL_FAMILIES } from '../game/content/events';
import { PERKS, TREE_NAMES, UNLOCK_COST, UNLOCK_NAMES } from '../game/content/perks';
import { SITES } from '../game/content/sites';
import { t } from '../game/copy/t';
import { kindName } from '../game/engine/director';
import { useGame } from '../game/store';
import type { PerkDef } from '../game/types';
import { Chip, Empty, Modal, Panel, SectionLabel } from './kit';

export function MetaPanel() {
  const meta = useGame((s) => s.meta);
  const setOverlay = useGame((s) => s.setOverlay);
  const buyPerk = useGame((s) => s.buyPerk);
  const buyUnlock = useGame((s) => s.buyUnlock);
  const [tab, setTab] = useState<'perks' | 'unlocks'>('perks');

  const canBuy = (p: PerkDef) =>
    !p.wip &&
    !meta.perks.includes(p.id) &&
    meta.relics >= p.cost &&
    (!p.requires || p.requires.every((r) => meta.perks.includes(r)));

  const shopPerks = PERKS.filter((p) => !p.wip);
  const unlockGroups = [
    { label: t('ui.meta.class'), ids: CLASSES.filter((c) => c.unlock).map((c) => c.unlock!) },
    { label: t('ui.meta.site'), ids: SITES.filter((s) => s.unlock && !s.wip).map((s) => s.unlock!) },
    { label: t('ui.meta.pack'), ids: SUPPLY_PACKS.filter((p) => p.unlock).map((p) => p.unlock!) },
  ];

  return (
    <Modal
      title={t('ui.meta.title')}
      subtitle={t('ui.meta.subtitle', { n: meta.relics })}
      onClose={() => setOverlay(null)}
      width="max-w-4xl"
    >
      <div className="mb-4 flex gap-2">
        <button
          className={`btn px-4 py-1.5 text-[12px] ${tab === 'perks' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('perks')}
        >
          {t('ui.meta.perks', {
            a: meta.perks.filter((id) => shopPerks.some((p) => p.id === id)).length,
            b: shopPerks.length,
          })}
        </button>
        <button
          className={`btn px-4 py-1.5 text-[12px] ${tab === 'unlocks' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('unlocks')}
        >
          {t('ui.meta.unlocks')}
        </button>
        <div className="ml-auto flex items-baseline gap-2">
          <span className="label">{t('ui.meta.relics')}</span>
          <span className="num text-xl text-amberhi">{meta.relics}</span>
        </div>
      </div>

      {tab === 'perks' && (
        <div className="grid gap-3 md:grid-cols-3">
          {(['survival', 'build', 'social'] as const).map((tree) => (
            <Panel key={tree} title={TREE_NAMES[tree]} mark>
              <div className="space-y-2">
                {shopPerks
                  .filter((p) => p.tree === tree)
                  .sort((a, b) => a.tier - b.tier)
                  .map((p) => {
                    const owned = meta.perks.includes(p.id);
                    const locked = p.requires && !p.requires.every((r) => meta.perks.includes(r));
                    return (
                      <button
                        key={p.id}
                        className={`choice ${owned ? '!border-l-safe !bg-safe/8' : ''}`}
                        disabled={owned || !canBuy(p)}
                        onClick={() => buyPerk(p.id)}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={`font-medium ${owned ? 'text-safehi' : 'text-paper'}`}>{p.name}</span>
                          {owned ? (
                            <Chip tone="good">{t('ui.common.owned')}</Chip>
                          ) : locked ? (
                            <Chip tone="bad">{t('ui.common.needReq')}</Chip>
                          ) : (
                            <Chip tone={meta.relics >= p.cost ? 'warn' : 'bad'}>{p.cost}</Chip>
                          )}
                        </div>
                        <div className="mt-1 text-[11.5px] leading-snug text-faint">{p.desc}</div>
                      </button>
                    );
                  })}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {tab === 'unlocks' && (
        <div className="space-y-4">
          {unlockGroups.map((g) => (
            <div key={g.label}>
              <SectionLabel>{g.label}</SectionLabel>
              <div className="grid gap-2 sm:grid-cols-2">
                {g.ids.map((id) => {
                  const owned = meta.unlocked.includes(id);
                  const cost = UNLOCK_COST[id] ?? 999;
                  return (
                    <button
                      key={id}
                      className={`choice ${owned ? '!border-l-safe !bg-safe/8' : ''}`}
                      disabled={owned || meta.relics < cost}
                      onClick={() => buyUnlock(id)}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={owned ? 'text-safehi' : 'text-paper'}>{UNLOCK_NAMES[id] ?? id}</span>
                        {owned ? (
                          <Chip tone="good">{t('ui.common.unlocked')}</Chip>
                        ) : (
                          <Chip tone={meta.relics >= cost ? 'warn' : 'bad'}>{cost}</Chip>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-[11.5px] leading-snug text-faint">{t('ui.meta.unlockHint')}</p>
        </div>
      )}
    </Modal>
  );
}

export function CodexPanel() {
  const meta = useGame((s) => s.meta);
  const setOverlay = useGame((s) => s.setOverlay);
  const [tab, setTab] = useState<'endings' | 'disasters' | 'events' | 'classes'>('endings');

  const tabs = [
    { id: 'endings' as const, label: t('ui.meta.tabEnding', { a: meta.seenEndings.length, b: ENDINGS.length }) },
    { id: 'disasters' as const, label: t('ui.meta.tabDisaster', { a: meta.seenDisasters.length, b: DISASTERS.length }) },
    { id: 'events' as const, label: t('ui.meta.tabEvent', { a: meta.seenFamilies.length, b: ALL_FAMILIES.length }) },
    { id: 'classes' as const, label: t('ui.meta.tabClass') },
  ];

  return (
    <Modal
      title={t('ui.meta.codex')}
      subtitle={t('ui.meta.codexSub')}
      onClose={() => setOverlay(null)}
      width="max-w-4xl"
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            className={`btn px-3 py-1.5 text-[11.5px] ${tab === item.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'endings' && (
        <div className="space-y-2">
          {ENDINGS.map((e) => {
            const seen = meta.seenEndings.includes(e.id);
            return (
              <div key={e.id} className="panel p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className={`text-[13.5px] font-medium ${seen ? 'text-paper' : 'text-faint'}`}>
                    {seen ? e.name.replace('{day}', '?') : t('ui.meta.unseen')}
                  </span>
                  <Chip tone={e.kind === 'win' ? 'good' : 'bad'}>{e.subtitle}</Chip>
                  {!seen && <Chip>{t('ui.meta.undiscovered')}</Chip>}
                </div>
                {seen ? (
                  <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-relaxed text-dim">{e.text}</p>
                ) : (
                  <p className="mt-1.5 text-[12px] text-faint">
                    {e.kind === 'win' ? t('ui.meta.winHint') : t('ui.meta.deathHint')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'disasters' && (
        <div className="space-y-2">
          {DISASTERS.map((d) => {
            const seen = meta.seenDisasters.includes(d.id);
            return (
              <div key={d.id} className="panel p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className={`text-[13.5px] font-medium ${seen ? 'text-paper' : 'text-faint'}`}>
                    {seen ? d.name : t('ui.meta.unknownDisaster')}
                  </span>
                  <span className="title-stamp text-[10px] text-amberdim">{seen ? d.codename : '████'}</span>
                </div>
                {seen ? (
                  <>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-amberhi">{d.thesis}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="label mr-1">{t('ui.meta.keySupplies')}</span>
                      {d.keySupplies.map((s) => (
                        <Chip key={s} tone="warn">
                          {s}
                        </Chip>
                      ))}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <span className="label mr-1">{t('ui.meta.clues')}</span>
                      {d.clueTopics.map((s) => (
                        <Chip key={s} tone="info">
                          {s}
                        </Chip>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-1.5 text-[12px] text-faint">{t('ui.meta.disasterHint')}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'events' && (
        <>
          {meta.seenFamilies.length === 0 && <Empty>{t('ui.meta.noEvents')}</Empty>}
          <div className="grid gap-2 sm:grid-cols-2">
            {ALL_FAMILIES.map((f) => {
              const seen = meta.seenFamilies.includes(f.id);
              const variant = f.variants[0];
              const seenVarCount = f.variants.filter((v) => meta.seenVariants.includes(`${f.id}/${v.id}`)).length;
              return (
                <div key={f.id} className={`panel p-2.5 ${seen ? '' : 'opacity-45'}`}>
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="text-[12.5px] text-paper">{seen ? (variant?.title ?? f.id) : t('ui.meta.unrecorded')}</span>
                    <Chip>{kindName(f.kind)}</Chip>
                    {seen && f.variants.length > 1 && (
                      <Chip tone="info">{t('ui.meta.variants', { a: seenVarCount, b: f.variants.length })}</Chip>
                    )}
                  </div>
                  {seen && (
                    <p className="mt-1 text-[11.5px] leading-snug text-faint">
                      {t('ui.meta.intensity', { n: f.intensity, cd: f.cooldown ?? 14 })}
                      {f.once ? t('ui.meta.once') : ''}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'classes' && (
        <div className="space-y-2">
          {CLASSES.map((c) => {
            const unlocked = !c.unlock || meta.unlocked.includes(c.unlock);
            return (
              <div key={c.id} className={`panel p-3 ${unlocked ? '' : 'opacity-50'}`}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[13.5px] font-medium text-paper">{c.name}</span>
                  <span className="text-[12px] text-faint">{c.title}</span>
                  {!unlocked && <Chip tone="bad">{t('ui.common.locked')}</Chip>}
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-dim">{c.desc}</p>
                <p className="mt-1.5 text-[12px] text-amberhi">{PERK_TEXT[c.perk]}</p>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
