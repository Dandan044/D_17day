import { useState } from 'react';

import { CLASSES, PERK_TEXT, SUPPLY_PACKS } from '../game/content/classes';
import { DISASTERS } from '../game/content/disasters';
import { ENDINGS } from '../game/content/endings';
import { ALL_FAMILIES } from '../game/content/events';
import { PERKS, TREE_NAMES, UNLOCK_COST, UNLOCK_NAMES } from '../game/content/perks';
import { SITES } from '../game/content/sites';
import { kindName } from '../game/engine/director';
import { useGame } from '../game/store';
import type { PerkDef } from '../game/types';
import { Chip, Empty, Modal, Panel, SectionLabel } from './kit';

// ============================================================
// 局外成长
// ============================================================

export function MetaPanel() {
  const { meta, setOverlay, buyPerk, buyUnlock } = useGame();
  const [tab, setTab] = useState<'perks' | 'unlocks'>('perks');

  const canBuy = (p: PerkDef) =>
    !meta.perks.includes(p.id) &&
    meta.relics >= p.cost &&
    (!p.requires || p.requires.every((r) => meta.perks.includes(r)));

  const unlockGroups = [
    { label: '职业', ids: CLASSES.filter((c) => c.unlock).map((c) => c.unlock!) },
    { label: '站点', ids: SITES.filter((s) => s.unlock).map((s) => s.unlock!) },
    { label: '起手物资包', ids: SUPPLY_PACKS.filter((p) => p.unlock).map((p) => p.unlock!) },
    { label: '图纸', ids: ['blueprint_hydroponics', 'blueprint_ventilation'] },
  ];

  return (
    <Modal
      title="局外成长"
      subtitle={`遗物 ${meta.relics} · 每一局的存活天数与结局都会变成这里的进度`}
      onClose={() => setOverlay(null)}
      width="max-w-4xl"
    >
      <div className="mb-4 flex gap-2">
        <button
          className={`btn px-4 py-1.5 text-[12px] ${tab === 'perks' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('perks')}
        >
          天赋树（{meta.perks.length}/{PERKS.length}）
        </button>
        <button
          className={`btn px-4 py-1.5 text-[12px] ${tab === 'unlocks' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('unlocks')}
        >
          解锁
        </button>
        <div className="ml-auto flex items-baseline gap-2">
          <span className="label">遗物</span>
          <span className="num text-xl text-amberhi">{meta.relics}</span>
        </div>
      </div>

      {tab === 'perks' && (
        <div className="grid gap-3 md:grid-cols-3">
          {(['survival', 'build', 'social'] as const).map((tree) => (
            <Panel key={tree} title={TREE_NAMES[tree]} mark>
              <div className="space-y-2">
                {PERKS.filter((p) => p.tree === tree)
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
                            <Chip tone="good">已获得</Chip>
                          ) : locked ? (
                            <Chip tone="bad">需前置</Chip>
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
                        {owned ? <Chip tone="good">已解锁</Chip> : <Chip tone={meta.relics >= cost ? 'warn' : 'bad'}>{cost}</Chip>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-[11.5px] leading-snug text-faint">
            部分内容也可以通过达成特定结局直接解锁——那样不花遗物。
          </p>
        </div>
      )}
    </Modal>
  );
}

// ============================================================
// 档案馆
// ============================================================

export function CodexPanel() {
  const { meta, setOverlay } = useGame();
  const [tab, setTab] = useState<'endings' | 'disasters' | 'events' | 'classes'>('endings');

  const tabs = [
    { id: 'endings' as const, label: `结局 ${meta.seenEndings.length}/${ENDINGS.length}` },
    { id: 'disasters' as const, label: `灾难 ${meta.seenDisasters.length}/${DISASTERS.length}` },
    { id: 'events' as const, label: `事件 ${meta.seenFamilies.length}/${ALL_FAMILIES.length}` },
    { id: 'classes' as const, label: '职业' },
  ];

  return (
    <Modal
      title="档案馆"
      subtitle="你见过的东西会留在这里。见过越多，下一局你知道得越多。"
      onClose={() => setOverlay(null)}
      width="max-w-4xl"
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`btn px-3 py-1.5 text-[11.5px] ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
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
                    {seen ? e.name.replace('{day}', '?') : '？？？'}
                  </span>
                  <Chip tone={e.kind === 'win' ? 'good' : 'bad'}>{e.subtitle}</Chip>
                  {!seen && <Chip>未发现</Chip>}
                </div>
                {seen ? (
                  <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-relaxed text-dim">{e.text}</p>
                ) : (
                  <p className="mt-1.5 text-[12px] text-faint">
                    {e.kind === 'win' ? '还有一种活下去的方式你没找到。' : '还有一种死法你没遇到。'}
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
                    {seen ? d.name : '未知灾难'}
                  </span>
                  <span className="title-stamp text-[10px] text-amberdim">{seen ? d.codename : '████'}</span>
                </div>
                {seen ? (
                  <>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-amberhi">{d.thesis}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="label mr-1">关键物资</span>
                      {d.keySupplies.map((s) => (
                        <Chip key={s} tone="warn">
                          {s}
                        </Chip>
                      ))}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <span className="label mr-1">线索关键词</span>
                      {d.clueTopics.map((s) => (
                        <Chip key={s} tone="info">
                          {s}
                        </Chip>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-1.5 text-[12px] text-faint">经历过一次之后，这里会列出它的线索关键词与关键物资。</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'events' && (
        <>
          {meta.seenFamilies.length === 0 && <Empty>还没有记录任何事件。</Empty>}
          <div className="grid gap-2 sm:grid-cols-2">
            {ALL_FAMILIES.map((f) => {
              const seen = meta.seenFamilies.includes(f.id);
              const variant = f.variants[0];
              return (
                <div key={f.id} className={`panel p-2.5 ${seen ? '' : 'opacity-45'}`}>
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="text-[12.5px] text-paper">{seen ? (variant?.title ?? f.id) : '未记录'}</span>
                    <Chip>{kindName(f.kind)}</Chip>
                    {seen && f.variants.length > 1 && <Chip tone="info">{f.variants.length} 种情形</Chip>}
                  </div>
                  {seen && (
                    <p className="mt-1 text-[11.5px] leading-snug text-faint">
                      强度 {f.intensity} · 冷却 {f.cooldown ?? 14} 天
                      {f.once && ' · 每局一次'}
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
                  {!unlocked && <Chip tone="bad">未解锁</Chip>}
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
