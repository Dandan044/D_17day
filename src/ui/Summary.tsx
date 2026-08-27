import { TIME } from '../game/balance';
import { CLASS_BY_ID } from '../game/content/classes';
import { DISASTER_BY_ID } from '../game/content/disasters';
import { UNLOCK_NAMES } from '../game/content/perks';
import { SITE_BY_ID } from '../game/content/sites';
import { formatSeed } from '../game/rng';
import { useGame } from '../game/store';
import { Chip, Panel, SectionLabel } from './kit';

export default function Summary() {
  const { run, settlement, claimSettlement, toast } = useGame();
  if (!run || !settlement) return null;
  const { ending } = settlement;
  const disaster = DISASTER_BY_ID[run.world.disaster];
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  const cls = CLASS_BY_ID[run.classId];

  const title = ending.name.replace('{day}', String(settlement.daysSurvived));

  const exportDiary = () => {
    const lines = run.log.map((l) => `第 ${l.day} 天　${l.text}`);
    const text = [
      `《七日之前》 · ${title}（${ending.subtitle}）`,
      `${cls?.name ?? ''} · ${site.name} · ${disaster.name}`,
      `存活 ${settlement.daysSurvived} 天 · 末世等级 ${run.threat} · 种子 ${formatSeed(run.seed)}`,
      '',
      ...lines,
    ].join('\n');
    navigator.clipboard?.writeText(text);
    toast('这一局的记录已复制', 'good');
  };

  return (
    <div className="scroll-y h-full">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        {/* ---------- 结局 ---------- */}
        <div className="anim-rise mb-8 text-center">
          <div className={`label mb-3 ${ending.kind === 'win' ? 'text-safe' : 'text-alarm'}`}>
            {ending.kind === 'win' ? '结局' : '死亡'} · {ending.subtitle}
          </div>
          <h1 className="title-stamp text-3xl font-bold text-paper sm:text-4xl">{title}</h1>
          <div className="mt-4 flex items-center justify-center gap-3">
            <div className="h-px w-10 bg-line2" />
            <span className="num text-[11.5px] text-amberdim">
              第 {settlement.daysSurvived} 天 / {TIME.FINAL_DAY}
            </span>
            <div className="h-px w-10 bg-line2" />
          </div>
        </div>

        <div className="anim-in mb-6 space-y-3">
          {ending.text.split('\n').map((p, i) => (
            <p key={i} className="text-[14px] leading-relaxed text-dim">
              {p}
            </p>
          ))}
        </div>

        {/* ---------- 这一局 ---------- */}
        <Panel title="这一局" mark className="mb-3">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Chip tone="info">{cls?.name}</Chip>
            <Chip tone="info">{site.name}</Chip>
            <Chip tone="bad">{disaster.name}</Chip>
            <Chip tone="warn">末世等级 {run.threat}</Chip>
            <Chip>{{ story: '叙事', normal: '标准', harsh: '严苛' }[run.difficulty]}</Chip>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
            {[
              { k: '外出次数', v: run.stats_meta.scavengeRuns },
              { k: '挡住的袭击', v: run.stats_meta.raidsRepelled },
              { k: '收留的人', v: run.survivors.length },
              { k: '人性', v: Math.round(run.stats.humanity) },
            ].map((s) => (
              <div key={s.k}>
                <div className="label">{s.k}</div>
                <div className="num text-lg text-paper">{s.v}</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* ---------- 遗物结算 ---------- */}
        <Panel title="遗物结算" mark className="mb-3">
          <div className="space-y-1">
            {settlement.breakdown.map((b, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2 text-[12.5px]">
                <span className="text-dim">{b.label}</span>
                <span className={`num ${b.value >= 0 ? 'text-amberhi' : 'text-alarmhi'}`}>
                  {b.value >= 0 ? '+' : ''}
                  {b.value}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
            <span className="label">本局获得</span>
            <span className="num text-2xl text-amberhi">{settlement.relics}</span>
          </div>
        </Panel>

        {/* ---------- 解锁 ---------- */}
        {settlement.newUnlocks.length > 0 && (
          <Panel title="新解锁" mark className="mb-3">
            <div className="space-y-1.5">
              {settlement.newUnlocks.map((u) => (
                <div key={u} className="flex items-center gap-2 text-[13px] text-safehi">
                  <span className="text-safe">◈</span>
                  <span>{UNLOCK_NAMES[u] ?? u}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* ---------- 最后几行日记 ---------- */}
        {run.log.length > 0 && (
          <div className="mb-6">
            <SectionLabel>日记的最后几行</SectionLabel>
            <div className="space-y-1.5">
              {run.log.slice(-4).map((l, i) => (
                <p key={i} className="border-l-2 border-line2 px-3 py-1.5 text-[12.5px] leading-relaxed text-faint">
                  第 {l.day} 天　{l.text}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <button className="btn btn-primary w-full py-3" onClick={claimSettlement}>
            领取 {settlement.relics} 遗物，回到菜单
          </button>
          <button className="btn btn-ghost w-full py-2.5" onClick={exportDiary}>
            复制这一局的完整记录
          </button>
        </div>
      </div>
    </div>
  );
}
