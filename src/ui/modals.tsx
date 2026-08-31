import { useMemo, useState } from 'react';

import { COLD, THREAT_DESC, TIME } from '../game/balance';
import { DISASTER_BY_ID } from '../game/content/disasters';
import { LOCATION_BY_ID, RES_NAME, RES_UNIT } from '../game/content/locations';
import type { HaulItem } from '../game/engine/economy';
import { carryCap, useGame } from '../game/store';
import type { ResourceId, RunState } from '../game/types';
import { Bar, Chip, Modal, Panel, SectionLabel } from './kit';

// ============================================================
// 崩溃日
// ============================================================

export function CollapseScreen({ run }: { run: RunState }) {
  const { acknowledgeCollapse } = useGame();
  const def = DISASTER_BY_ID[run.world.disaster];
  const report = run.collapseReport;
  const [step, setStep] = useState(0);

  const scoreTone = !report ? 'warn' : report.score >= 70 ? 'good' : report.score >= 40 ? 'warn' : 'bad';

  return (
    <div className="scroll-y h-full">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <div className="anim-rise mb-8 text-center">
          <div className="label mb-3 text-alarm">第 {TIME.COLLAPSE_DAY} 天 · 灾难降临</div>
          <h1 className="title-stamp mb-2 text-3xl font-bold text-paper sm:text-4xl">{def.revealTitle}</h1>
          <div className="mt-3 flex items-center justify-center gap-3">
            <div className="h-px w-10 bg-alarmdim" />
            <span className="title-stamp text-[11px] text-alarm">{def.codename}</span>
            <div className="h-px w-10 bg-alarmdim" />
          </div>
        </div>

        <div className="anim-in mb-6 space-y-3">
          {def.reveal.split('\n').map((p, i) => (
            <p key={i} className="text-[14px] leading-relaxed text-dim">
              {p}
            </p>
          ))}
        </div>

        {step === 0 && (
          <button className="btn btn-primary w-full py-3" onClick={() => setStep(1)}>
            清点一下你手里有什么
          </button>
        )}

        {step >= 1 && report && (
          <div className="anim-rise space-y-3">
            <Panel title="准备度清算" mark right={<Chip tone={scoreTone as 'good'}>{report.score} / 100</Chip>}>
              <Bar value={report.score} tone={scoreTone} />
              <p className="mt-2 text-[12.5px] leading-relaxed text-amberhi">{def.thesis}</p>

              {report.hits.length > 0 && (
                <div className="mt-3">
                  <SectionLabel>你做对的</SectionLabel>
                  <div className="space-y-1">
                    {report.hits.map((h, i) => (
                      <div key={i} className="flex gap-1.5 text-[12.5px] leading-snug text-safehi">
                        <span className="text-safe">+</span>
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.misses.length > 0 && (
                <div className="mt-3">
                  <SectionLabel>你要还的</SectionLabel>
                  <div className="space-y-1">
                    {report.misses.map((h, i) => (
                      <div key={i} className="flex gap-1.5 text-[12.5px] leading-snug text-alarmhi">
                        <span className="text-alarm">−</span>
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.losses.length > 0 && (
                <div className="mt-3 border-t border-line pt-3">
                  <SectionLabel>这一夜的损失</SectionLabel>
                  <div className="space-y-1">
                    {report.losses.map((h, i) => (
                      <div key={i} className="text-[12.5px] leading-snug text-dim">
                        {h}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>

            <Panel title="从今天起" mark>
              <p className="text-[12.5px] leading-relaxed text-dim">
                自来水停了，电网{run.world.powerGrid === 'off' ? '彻底断了' : '开始轮流限电'}
                ，超市不会再上货。从现在开始，你每天要决定吃多少、喝多少、开不开灯——
                以及外面那些人什么时候会注意到这里还有活人。
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip tone="bad">末世等级 1 · 恐慌期</Chip>
                <Chip tone="warn">配给制度生效</Chip>
                <Chip tone="warn">暴露度开始累积</Chip>
                <Chip tone="info">还有 {TIME.FINAL_DAY - TIME.COLLAPSE_DAY + 1} 天</Chip>
              </div>
            </Panel>

            <button className="btn btn-primary w-full py-3" onClick={acknowledgeCollapse}>
              开始第一天
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 夜间结算
// ============================================================

export function NightReportModal({ run }: { run: RunState }) {
  const { nightReport, dismissNight } = useGame();
  if (!nightReport) return null;
  const r = nightReport;
  const isPrepNight = r.day < TIME.COLLAPSE_DAY;

  return (
    <Modal
      title={`第 ${r.day} 天 · 夜`}
      subtitle={isPrepNight ? `还剩 ${TIME.PREP_DAYS - r.day} 天` : THREAT_DESC[run.threat]}
      width="max-w-xl"
      footer={
        <button className="btn btn-primary w-full py-2.5" onClick={dismissNight}>
          {r.died ? '结算' : r.collapsed ? '……' : `进入第 ${r.day + 1} 天`}
        </button>
      }
    >
      {r.weekly && (
        <div className="mb-3 border-l-2 border-alarm bg-alarm/8 px-3 py-2.5">
          <div className="label mb-1 text-alarm">一周过去了</div>
          <p className="text-[13px] leading-relaxed text-paper">
            末世等级上升到 {run.threat}：{THREAT_DESC[run.threat]}
          </p>
        </div>
      )}

      {r.notes.length > 0 && (
        <>
          <SectionLabel>结算</SectionLabel>
          <div className="mb-3 space-y-1">
            {r.notes.map((n, i) => (
              <div key={i} className="text-[12.5px] leading-snug text-dim">
                · {n}
              </div>
            ))}
          </div>
        </>
      )}

      {r.healthNotes.length > 0 && (
        <>
          <SectionLabel>身体</SectionLabel>
          <div className="mb-3 space-y-1">
            {r.healthNotes.map((n, i) => (
              <div key={i} className="text-[12.5px] leading-snug text-alarmhi">
                · {n}
              </div>
            ))}
          </div>
        </>
      )}

      {!isPrepNight && (
        <div className="mb-3 space-y-1 border-t border-line pt-3 text-[12.5px] leading-snug text-dim">
          {r.hpAfter !== undefined && (
            <div>
              生命 {r.hpAfter}
              {r.hpParts && r.hpParts.length > 0 && (
                <span>
                  （
                  {r.hpParts
                    .map((p) => `${p.value > 0 ? '+' : ''}${p.value} ${p.label}`)
                    .join('，')}
                  ）
                </span>
              )}
            </div>
          )}
          {r.indoor !== undefined && r.outdoor !== undefined && (
            <div>
              室外 {r.outdoor}°C / 室内 {r.indoor}°C / 目标 {COLD.TARGET}°C
            </div>
          )}
        </div>
      )}

      {!isPrepNight && (
        <div className="grid grid-cols-3 gap-3 border-t border-line pt-3">
          <div>
            <div className="label">生命</div>
            <div className="num text-lg text-paper">{Math.round(run.stats.hp)}</div>
          </div>
          <div>
            <div className="label">理智</div>
            <div className="num text-lg text-paper">{Math.round(run.stats.sanity)}</div>
          </div>
          <div>
            <div className="label">暴露度</div>
            <div className="num text-lg text-paper">
              {Math.round(run.world.exposure)}
              {r.exposureAdded !== 0 && (
                <span className={`ml-1 text-[11px] ${r.exposureAdded > 0 ? 'text-alarmhi' : 'text-safehi'}`}>
                  {r.exposureAdded > 0 ? '+' : ''}
                  {r.exposureAdded}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {r.died && (
        <div className="mt-3 border-l-2 border-alarm bg-alarm/10 px-3 py-2.5 text-[13px] leading-relaxed text-alarmhi">
          你没能撑过这一夜。{r.cause ? `死因：${r.cause}。` : ''}
        </div>
      )}
    </Modal>
  );
}

// ============================================================
// 搜刮取舍
// ============================================================

export function HaulModal({ run }: { run: RunState }) {
  const { haul, takeHaul, discardHaul } = useGame();
  const cap = carryCap(run);

  const [picked, setPicked] = useState<Record<string, number>>(() => {
    if (!haul) return {};
    // 默认按单位重量从轻到重贪心装满
    const sorted = [...haul.items].sort((a, b) => a.weight / a.amount - b.weight / b.amount);
    const out: Record<string, number> = {};
    let used = 0;
    for (const it of sorted) {
      const unitW = it.weight / it.amount;
      const room = Math.max(0, cap - used);
      const canTake = unitW > 0 ? Math.min(it.amount, Math.floor((room / unitW) * 10) / 10) : it.amount;
      out[it.res] = Math.max(0, canTake);
      used += canTake * unitW;
    }
    return out;
  });

  if (!haul) return null;
  const loc = LOCATION_BY_ID[haul.locationId];

  const totalWeight = haul.items.reduce((s, it) => {
    const unitW = it.weight / it.amount;
    return s + (picked[it.res] ?? 0) * unitW;
  }, 0);
  const over = totalWeight > cap + 0.01;

  const set = (res: string, amount: number) => setPicked((p) => ({ ...p, [res]: Math.max(0, amount) }));

  const commit = () => {
    const out: HaulItem[] = haul.items
      .map((it) => {
        const amount = Math.min(it.amount, picked[it.res] ?? 0);
        const unitW = it.weight / it.amount;
        return { res: it.res, amount, weight: amount * unitW };
      })
      .filter((x) => x.amount > 0);
    takeHaul(out);
  };

  return (
    <Modal
      title={`${loc?.name ?? '外面'} · 你找到了这些`}
      subtitle={
        haul.items.length === 0
          ? '什么都没有。这里已经被翻过了。'
          : `背得回去的才算你的 · 负重上限 ${cap} kg${haul.night ? ' · 夜间行动' : ''}`
      }
      width="max-w-xl"
      footer={
        <div className="flex gap-2">
          <button className="btn btn-ghost flex-1 py-2" onClick={discardHaul}>
            全部丢下
          </button>
          <button className="btn btn-primary flex-[2] py-2" disabled={over} onClick={commit}>
            {over ? '超重了' : '带回去'}
          </button>
        </div>
      }
    >
      {haul.items.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-faint">
          你在货架之间走了一圈，只有翻倒的塑料筐和一地碎玻璃。
        </p>
      ) : (
        <>
          <div className="mb-3">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="label">负重</span>
              <span className={`num text-[12.5px] ${over ? 'text-alarmhi' : 'text-paper'}`}>
                {totalWeight.toFixed(1)} / {cap} kg
              </span>
            </div>
            <Bar value={totalWeight} max={cap} tone={over ? 'bad' : totalWeight > cap * 0.8 ? 'warn' : 'good'} />
          </div>

          <div className="space-y-2">
            {haul.items.map((it) => {
              const unitW = it.weight / it.amount;
              const cur = picked[it.res] ?? 0;
              return (
                <div key={it.res} className="panel p-2.5">
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <span className="text-[13px] text-paper">{RES_NAME[it.res as ResourceId]}</span>
                      <span className="num ml-2 text-[11.5px] text-faint">
                        找到 {it.amount} {RES_UNIT[it.res as ResourceId]} · {unitW.toFixed(2)} kg/单位
                      </span>
                    </div>
                    <span className="num text-[13px] text-amberhi">
                      带 {Math.round(cur * 10) / 10}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={it.amount}
                      step={it.amount > 20 ? 1 : 0.5}
                      value={cur}
                      onChange={(e) => set(it.res, Number(e.target.value))}
                      className="flex-1 accent-amber"
                    />
                    <button className="btn btn-ghost px-2 py-0.5 text-[10.5px]" onClick={() => set(it.res, 0)}>
                      0
                    </button>
                    <button
                      className="btn btn-ghost px-2 py-0.5 text-[10.5px]"
                      onClick={() => set(it.res, it.amount)}
                    >
                      全
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {haul.danger > 0 && (
            <p className="mt-3 border-l-2 border-alarmdim bg-alarm/5 px-3 py-2 text-[12px] leading-snug text-alarmhi">
              这一趟的危险度是 {haul.danger}
              {haul.night ? '（夜间更高）' : ''}
              。暴露已经结算进你的档案
              {haul.danger >= 40 ? '；路上可能受伤或丢掉东西' : ''}
              {haul.danger >= 55 ? '，高危地段还有人会跟着你回家。' : '。'}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}

// ============================================================
// 选择结果
// ============================================================

export function ChoiceResultModal() {
  const { lastChoice, dismissChoice } = useGame();
  if (!lastChoice) return null;
  const { checkRoll, notes, title, raid, died } = lastChoice;

  const SKILL_NAME: Record<string, string> = {
    medicine: '医疗',
    mechanics: '机械',
    negotiation: '谈判',
    fitness: '体能',
    stealth: '隐蔽',
  };

  return (
    <Modal
      title="结果"
      width="max-w-lg"
      footer={
        <button className="btn btn-primary w-full py-2.5" onClick={dismissChoice}>
          {died ? '结算' : '继续'}
        </button>
      }
    >
      {checkRoll && (
        <div
          className="mb-3 border-l-2 px-3 py-2.5"
          style={{
            borderColor: checkRoll.success ? 'var(--color-safe)' : 'var(--color-alarm)',
            background: checkRoll.success ? 'rgba(63,158,107,0.07)' : 'rgba(222,74,63,0.07)',
          }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className={`text-[13px] ${checkRoll.success ? 'text-safehi' : 'text-alarmhi'}`}>
              {SKILL_NAME[checkRoll.skill]}判定 {checkRoll.success ? '成功' : '失败'}
            </span>
            <span className="num text-[12px] text-dim">
              d20 {checkRoll.roll} + 技能 {checkRoll.total - checkRoll.roll} = {checkRoll.total} vs {checkRoll.dc}
            </span>
          </div>
        </div>
      )}

      {title && <p className="mb-3 text-[13.5px] leading-relaxed text-paper">{title}</p>}

      {raid && (
        <div
          className="mb-3 border-l-2 px-3 py-2.5"
          style={{
            borderColor: raid.repelled ? 'var(--color-safe)' : 'var(--color-alarm)',
            background: raid.repelled ? 'rgba(63,158,107,0.07)' : 'rgba(222,74,63,0.07)',
          }}
        >
          <div className="label mb-1" style={{ color: raid.repelled ? 'var(--color-safe)' : 'var(--color-alarm)' }}>
            {raid.repelled ? '守住了' : '门被打开了'}
          </div>
          <p className="text-[13px] leading-relaxed text-paper">{raid.narrative}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {raid.hpLost > 0 && <Chip tone="bad">生命 -{raid.hpLost}</Chip>}
            {raid.usedAmmo > 0 && <Chip tone="warn">弹药 -{raid.usedAmmo}</Chip>}
            {raid.moduleDamaged && <Chip tone="bad">{raid.moduleDamaged}受损</Chip>}
            {Object.entries(raid.lost).map(([k, v]) => (
              <Chip key={k} tone="bad">
                {RES_NAME[k as ResourceId]} -{v}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
          {notes.map((n, i) => (
            <Chip
              key={i}
              tone={
                n.includes('还没有结束') || n.includes('续篇将在你')
                  ? 'info'
                  : n.includes('-') || n.includes('受损') || n.includes('失去')
                    ? 'bad'
                    : n.includes('+')
                      ? 'good'
                      : 'default'
              }
            >
              {n}
            </Chip>
          ))}
        </div>
      )}

      {died && (
        <div className="mt-3 border-l-2 border-alarm bg-alarm/10 px-3 py-2.5 text-[13px] leading-relaxed text-alarmhi">
          你没有从这一场里走出来。
        </div>
      )}
    </Modal>
  );
}

// ============================================================
// 提示
// ============================================================

export function Toasts() {
  const { toasts } = useGame();
  const list = useMemo(() => toasts.slice(-4), [toasts]);
  if (list.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-16 right-4 z-50 flex w-72 flex-col gap-1.5">
      {list.map((t) => (
        <div
          key={t.id}
          className="anim-rise border-l-2 bg-panel2/95 px-3 py-2 text-[12.5px] leading-snug shadow-lg backdrop-blur"
          style={{
            borderColor:
              t.tone === 'good' ? 'var(--color-safe)' : t.tone === 'bad' ? 'var(--color-alarm)' : 'var(--color-line2)',
            color: t.tone === 'bad' ? 'var(--color-alarmhi)' : 'var(--color-paper)',
          }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
