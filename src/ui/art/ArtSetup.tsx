import { useState } from 'react';

import { CLASSES, PERK_TEXT, SUPPLY_PACKS } from '../../game/content/classes';
import { DIFFICULTY_NAME, SKILL_NAME } from '../../game/copy/names';
import { t } from '../../game/copy/t';
import { formatSeed, parseSeed, randomSeed } from '../../game/rng';
import { useGame } from '../../game/store';
import type { Difficulty } from '../../game/types';
import { ArtFile, ArtSceneFrame } from './ArtHotspot';
import { ART } from './skin';
import './art.css';

const DIFFS: Difficulty[] = ['story', 'normal', 'harsh'];

const FILE_POS: Record<string, { left: string; top: string; rot: string }> = {
  clerk: { left: '22%', top: '48%', rot: '-6deg' },
  engineer: { left: '34%', top: '44%', rot: '4deg' },
  nurse: { left: '46%', top: '47%', rot: '-2deg' },
  veteran: { left: '58%', top: '43%', rot: '5deg' },
  hoarder: { left: '26%', top: '68%', rot: '4deg' },
  hacker: { left: '38%', top: '66%', rot: '-4deg' },
  trucker: { left: '50%', top: '70%', rot: '3deg' },
  chemist: { left: '62%', top: '65%', rot: '-3deg' },
};

const PACK_POS: Record<string, { left: string; top: string }> = {
  none: { left: '14%', top: '88%' },
  basic: { left: '23%', top: '90%' },
  medical: { left: '32%', top: '88%' },
  tools: { left: '41%', top: '90%' },
  cash: { left: '50%', top: '88%' },
};

const DIFF_POS: Record<Difficulty, { left: string; top: string }> = {
  story: { left: '72%', top: '86%' },
  normal: { left: '80%', top: '88%' },
  harsh: { left: '88%', top: '86%' },
};

export default function ArtSetup() {
  const { meta, startRun, goMenu } = useGame();
  const [classId, setClassId] = useState(meta.lastClassId || 'clerk');
  const [packId, setPackId] = useState('none');
  const [difficulty, setDifficulty] = useState<Difficulty>(meta.difficulty);
  const [seedText, setSeedText] = useState('');

  const cls = CLASSES.find((c) => c.id === classId) ?? CLASSES[0]!;

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

  const skills = Object.entries(cls.skills)
    .map(([k, v]) => `${SKILL_NAME[k as keyof typeof SKILL_NAME] ?? k} ${v}`)
    .join(' · ');

  return (
    <div className="art-root">
      <div className="art-grain" />
      <ArtSceneFrame src={ART.setupBg}>
        {CLASSES.map((c) => {
          const pos = FILE_POS[c.id] ?? { left: '50%', top: '50%', rot: '0deg' };
          const ok = classUnlocked(c.id);
          return (
            <ArtFile
              key={c.id}
              left={pos.left}
              top={pos.top}
              width="min(13vw, 150px)"
              rot={pos.rot}
              src={ART.class(c.id)}
              label={c.name}
              sub={ok ? c.title : t('ui.common.locked')}
              disabled={!ok}
              selected={c.id === classId}
              onClick={() => ok && setClassId(c.id)}
            />
          );
        })}

        {SUPPLY_PACKS.map((p) => {
          const pos = PACK_POS[p.id] ?? { left: '50%', top: '88%' };
          const ok = packUnlocked(p.id);
          return (
            <ArtFile
              key={p.id}
              left={pos.left}
              top={pos.top}
              width="min(8vw, 96px)"
              src={ART.pack(p.id)}
              label={p.name}
              sub={ok ? p.desc : t('ui.common.locked')}
              disabled={!ok}
              selected={p.id === packId}
              onClick={() => ok && setPackId(p.id)}
            />
          );
        })}

        {DIFFS.map((id) => (
          <ArtFile
            key={id}
            left={DIFF_POS[id].left}
            top={DIFF_POS[id].top}
            width="min(7vw, 88px)"
            src={ART.diff(id)}
            label={DIFFICULTY_NAME[id]}
            sub={t(`ui.setup.diffDesc.${id}`)}
            selected={id === difficulty}
            onClick={() => setDifficulty(id)}
          />
        ))}

        <div className="art-slip">
          <div className="art-kicker" style={{ color: '#7a5a12' }}>
            {t('ui.setup.title')}
          </div>
          <h3>{cls.name}</h3>
          <p>{cls.desc}</p>
          <p className="art-slip-perk">{PERK_TEXT[cls.perk]}</p>
          {skills ? <p>{skills}</p> : <p>{t('ui.setup.noSkill')}</p>}
          <p>
            {t('ui.setup.ap')} {cls.apMax + (meta.perks.includes('perk_wellprepared') ? 1 : 0)}
          </p>
          <label className="mt-2 block">
            <span className="label" style={{ color: '#7a5a12' }}>
              {t('ui.setup.seed')}
            </span>
            <input
              value={seedText}
              onChange={(e) => setSeedText(e.target.value)}
              placeholder={formatSeed(randomSeed())}
              className="num mt-1 w-full border-0 border-b border-[#7a5a12]/40 bg-transparent px-0 py-1 text-[12px] text-[#1a1712] outline-none"
            />
          </label>
        </div>
      </ArtSceneFrame>

      <button type="button" className="art-next" onClick={start}>
        <svg className="art-next-arrow" viewBox="0 0 48 96" aria-hidden>
          <path d="M10 8 L38 48 L10 88" />
        </svg>
        <span>{t('ui.setup.next')}</span>
      </button>

      <button type="button" className="art-link art-back" onClick={goMenu}>
        {t('ui.setup.back')}
      </button>
    </div>
  );
}
