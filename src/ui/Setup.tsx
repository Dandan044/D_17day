import { useState } from 'react';

import { CLASSES, PERK_TEXT, SUPPLY_PACKS } from '../game/content/classes';
import { RES_NAME, RES_UNIT } from '../game/content/locations';
import { formatSeed, parseSeed, randomSeed } from '../game/rng';
import { useGame } from '../game/store';
import type { Difficulty, ResourceId } from '../game/types';
import { Chip, Panel, SectionLabel } from './kit';

const DIFF_INFO: Array<{ id: Difficulty; name: string; desc: string }> = [
  { id: 'story', name: '叙事', desc: '不会死亡，产出更高。为了看故事。' },
  { id: 'normal', name: '标准', desc: '设计意图下的平衡。' },
  { id: 'harsh', name: '严苛', desc: '产出更低，袭击更凶，遗物 ×1.5。' },
];

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
            <div className="label text-amberdim">开局配置</div>
            <h2 className="title-stamp text-2xl text-paper">你是谁</h2>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => setOverlay('meta')}>
              局外成长（{meta.relics} 遗物）
            </button>
            <button className="btn btn-ghost" onClick={goMenu}>
              返回
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* ---------- 职业 ---------- */}
          <div className="space-y-4">
            <Panel title="职业" mark>
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
                        {!ok && <Chip tone="bad">未解锁</Chip>}
                      </div>
                      <div className="mt-0.5 text-[12px] text-faint">{c.title}</div>
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel title="起手物资包" mark>
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
                        {!ok && <Chip tone="bad">未解锁</Chip>}
                      </div>
                      <div className="mt-0.5 text-[12px] leading-snug text-faint">{p.desc}</div>
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel title="难度" mark>
              <div className="grid gap-2 sm:grid-cols-3">
                {DIFF_INFO.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    className={`choice ${d.id === difficulty ? '!border-l-amber !bg-amber/10' : ''}`}
                  >
                    <div className="font-medium text-paper">{d.name}</div>
                    <div className="mt-0.5 text-[11.5px] leading-snug text-faint">{d.desc}</div>
                  </button>
                ))}
              </div>
            </Panel>
          </div>

          {/* ---------- 预览 ---------- */}
          <div className="space-y-4">
            <Panel title="开局状况" mark>
              <p className="mb-3 text-[13px] leading-relaxed text-dim">{cls.desc}</p>
              <SectionLabel>专长</SectionLabel>
              <p className="mb-3 text-[12.5px] leading-relaxed text-amberhi">{PERK_TEXT[cls.perk]}</p>

              <SectionLabel>技能</SectionLabel>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {Object.entries(cls.skills).length === 0 && <span className="text-[12px] text-faint">没有专精</span>}
                {Object.entries(cls.skills).map(([k, v]) => (
                  <Chip key={k} tone="info">
                    {SKILL_NAME[k] ?? k} {v}
                  </Chip>
                ))}
              </div>

              <SectionLabel>额外物资</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {mergeRes(cls.res, pack.res).map(([k, v]) => (
                  <Chip key={k} tone="good">
                    {RES_NAME[k as ResourceId]} +{v}
                    {RES_UNIT[k as ResourceId]}
                  </Chip>
                ))}
              </div>

              <div className="mt-3 border-t border-line pt-3">
                <div className="label mb-1">每日行动点</div>
                <div className="num text-xl text-amberhi">
                  {cls.apMax + (meta.perks.includes('perk_wellprepared') ? 1 : 0)}
                </div>
              </div>
            </Panel>

            <Panel title="种子（可选）" mark>
              <input
                value={seedText}
                onChange={(e) => setSeedText(e.target.value)}
                placeholder={formatSeed(randomSeed())}
                className="num w-full border border-line bg-ink px-2 py-1.5 text-[12.5px] text-paper outline-none focus:border-amberdim"
              />
              <p className="mt-2 text-[11.5px] leading-snug text-faint">
                留空则随机。填入同一个种子会得到完全相同的灾难、天气与事件序列，可以用来复盘或和别人比。
              </p>
            </Panel>

            <button className="btn btn-primary w-full py-3 text-[13px]" onClick={start}>
              开始 · 第 1 天
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const SKILL_NAME: Record<string, string> = {
  medicine: '医疗',
  mechanics: '机械',
  negotiation: '谈判',
  fitness: '体能',
  stealth: '隐蔽',
};

function mergeRes(a: Partial<Record<ResourceId, number>>, b: Partial<Record<ResourceId, number>>) {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(a)) out[k] = (out[k] ?? 0) + (v ?? 0);
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + (v ?? 0);
  return Object.entries(out).filter(([, v]) => v > 0);
}
