import { useState } from 'react';

import { CLASSES, PERK_TEXT, SUPPLY_PACKS } from '../game/content/classes';
import { DIFFICULTY_NAME, RES_NAME, RES_UNIT, SKILL_NAME } from '../game/copy/names';
import { t } from '../game/copy/t';
import { formatSeed, parseSeed, randomSeed } from '../game/rng';
import { useGame } from '../game/store';
import type { Difficulty, ResourceId } from '../game/types';
import { Chip, Panel, SectionLabel } from './kit';

const DIFFS: Difficulty[] = ['story', 'normal', 'harsh'];

export default function Setup() {
  const { meta, startRun, goMenu, setOverlay } = useGame();
  const [classId, setClassId] = useState(meta.lastClassId || 'clerk');
  const [packId, setPackId] = useState('none');
  const [difficulty, setDifficulty] = useState<Difficulty>(meta.difficulty);
  const [seedText, setSeedText] = useState('');

  const cls = CLASSES.find((c) => c.id === classId) ?? CLASSES[0]!;
  const pack = SUPPLY_PACKS.find((p) => p.id === packId) ?? SUPPLY_PACKS[0]!;

  const classUnlocked = (id: string) => {
    const c = CLASSES.find((x) => x.id === id)!;
    return !c.unlock || meta.unlocked.includes(c.unlock);
  };
  const packUnlocked = (id: string) => {
    const p = SUPPLY_PACKS.find((x) => x.id === id)!;
    return !p.unlock || meta.unlocked.includes(p.unlock);
  };

  const start = () => {
    const seed = seedText.trim() ? (parseSeed(seedText) ?? randomSeed()) : randomSeed();
    startRun(classId, packId, difficulty, seed);
  };

  return (
    <div className="scroll-y h-full p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="label text-amberdim">{t('ui.setup.kicker')}</div>
            <h2 className="title-stamp text-2xl text-paper">{t('ui.setup.title')}</h2>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => setOverlay('meta')}>
              {t('ui.setup.meta', { n: meta.relics })}
            </button>
            <button className="btn btn-ghost" onClick={goMenu}>
              {t('ui.setup.back')}
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Panel title={t('ui.setup.class')} mark>
              <div className="grid gap-2 sm:grid-cols-2">
                {CLASSES.map((c) => {
                  const ok = classUnlocked(c.id);
                  const sel = c.id === classId;
                  return (
                    <button
                      key={c.id}
                      disabled={!ok}
                      onClick={() => setClassId(c.id)}
                      className={`choice ${sel ? '!border-l-amber !bg-amber/10' : ''}`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-paper">{c.name}</span>
                        {!ok && <Chip tone="bad">{t('ui.common.locked')}</Chip>}
                      </div>
                      <div className="mt-0.5 text-[12px] text-faint">{c.title}</div>
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel title={t('ui.setup.pack')} mark>
              <div className="grid gap-2 sm:grid-cols-2">
                {SUPPLY_PACKS.map((p) => {
                  const ok = packUnlocked(p.id);
                  const sel = p.id === packId;
                  return (
                    <button
                      key={p.id}
                      disabled={!ok}
                      onClick={() => setPackId(p.id)}
                      className={`choice ${sel ? '!border-l-amber !bg-amber/10' : ''}`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-paper">{p.name}</span>
                        {!ok && <Chip tone="bad">{t('ui.common.locked')}</Chip>}
                      </div>
                      <div className="mt-0.5 text-[12px] leading-snug text-faint">{p.desc}</div>
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel title={t('ui.setup.difficulty')} mark>
              <div className="grid gap-2 sm:grid-cols-3">
                {DIFFS.map((id) => (
                  <button
                    key={id}
                    onClick={() => setDifficulty(id)}
                    className={`choice ${id === difficulty ? '!border-l-amber !bg-amber/10' : ''}`}
                  >
                    <div className="font-medium text-paper">{DIFFICULTY_NAME[id]}</div>
                    <div className="mt-0.5 text-[11.5px] leading-snug text-faint">{t(`ui.setup.diffDesc.${id}`)}</div>
                  </button>
                ))}
              </div>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title={t('ui.setup.preview')} mark>
              <p className="mb-3 text-[13px] leading-relaxed text-dim">{cls.desc}</p>
              <SectionLabel>{t('ui.setup.perk')}</SectionLabel>
              <p className="mb-3 text-[12.5px] leading-relaxed text-amberhi">{PERK_TEXT[cls.perk]}</p>

              <SectionLabel>{t('ui.setup.skills')}</SectionLabel>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {Object.entries(cls.skills).length === 0 && (
                  <span className="text-[12px] text-faint">{t('ui.setup.noSkill')}</span>
                )}
                {Object.entries(cls.skills).map(([k, v]) => (
                  <Chip key={k} tone="info">
                    {SKILL_NAME[k as keyof typeof SKILL_NAME] ?? k} {v}
                  </Chip>
                ))}
              </div>

              <SectionLabel>{t('ui.setup.extra')}</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {mergeRes(cls.res, pack.res).map(([k, v]) => (
                  <Chip key={k} tone="good">
                    {RES_NAME[k as ResourceId]} +{v}
                    {RES_UNIT[k as ResourceId]}
                  </Chip>
                ))}
              </div>

              <div className="mt-3 border-t border-line pt-3">
                <div className="label mb-1">{t('ui.setup.ap')}</div>
                <div className="num text-xl text-amberhi">
                  {cls.apMax + (meta.perks.includes('perk_wellprepared') ? 1 : 0)}
                </div>
              </div>
            </Panel>

            <Panel title={t('ui.setup.seed')} mark>
              <input
                value={seedText}
                onChange={(e) => setSeedText(e.target.value)}
                placeholder={formatSeed(randomSeed())}
                className="num w-full border border-line bg-ink px-2 py-1.5 text-[12.5px] text-paper outline-none focus:border-amberdim"
              />
              <p className="mt-2 text-[11.5px] leading-snug text-faint">{t('ui.setup.seedHint')}</p>
            </Panel>

            <button className="btn btn-primary w-full py-3 text-[13px]" onClick={start}>
              {t('ui.setup.start')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function mergeRes(a: Partial<Record<ResourceId, number>>, b: Partial<Record<ResourceId, number>>) {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(a)) out[k] = (out[k] ?? 0) + (v ?? 0);
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + (v ?? 0);
  return Object.entries(out).filter(([, v]) => v > 0);
}
