import { useMemo, useState } from 'react';

import { COLD, THREAT_DESC, TIME } from '../game/balance';
import { DISASTER_BY_ID } from '../game/content/disasters';
import { LOCATION_BY_ID, RES_NAME, RES_UNIT } from '../game/content/locations';
import { SKILL_NAME } from '../game/copy/names';
import { t } from '../game/copy/t';
import type { HaulItem } from '../game/engine/economy';
import { waterRoom } from '../game/engine/economy';
import { waterCapacity } from '../game/engine/tags';
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
          <div className="label mb-3 text-alarm">{t('ui.collapse.day', { n: TIME.COLLAPSE_DAY })}</div>
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
            {t('ui.collapse.count')}
          </button>
        )}

        {step >= 1 && report && (
          <div className="anim-rise space-y-3">
            <Panel title={t('ui.collapse.score')} mark right={<Chip tone={scoreTone as 'good'}>{report.score} / 100</Chip>}>
              <Bar value={report.score} tone={scoreTone} />
              <p className="mt-2 text-[12.5px] leading-relaxed text-amberhi">{def.thesis}</p>

              {report.hits.length > 0 && (
                <div className="mt-3">
                  <SectionLabel>{t('ui.collapse.hits')}</SectionLabel>
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
                  <SectionLabel>{t('ui.collapse.misses')}</SectionLabel>
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
                  <SectionLabel>{t('ui.collapse.losses')}</SectionLabel>
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

            <Panel title={t('ui.collapse.fromNow')} mark>
              <p className="text-[12.5px] leading-relaxed text-dim">
                {t('ui.collapse.fromNowBody', {
                  grid: run.world.powerGrid === 'off' ? t('ui.collapse.gridOff') : t('ui.collapse.gridRot'),
                })}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip tone="bad">{t('ui.collapse.chipThreat')}</Chip>
                <Chip tone="warn">{t('ui.collapse.chipRation')}</Chip>
                <Chip tone="warn">{t('ui.collapse.chipExposure')}</Chip>
                <Chip tone="info">{t('ui.collapse.chipDays', { n: TIME.FINAL_DAY - TIME.COLLAPSE_DAY + 1 })}</Chip>
              </div>
            </Panel>

            <button className="btn btn-primary w-full py-3" onClick={acknowledgeCollapse}>
              {t('ui.collapse.ack')}
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
      title={t('ui.night.title', { n: r.day })}
      subtitle={isPrepNight ? t('ui.night.leftover', { n: TIME.PREP_DAYS - r.day }) : THREAT_DESC[run.threat]}
      width="max-w-xl"
      footer={
        <button className="btn btn-primary w-full py-2.5" onClick={dismissNight}>
          {r.died ? t('ui.common.settle') : r.collapsed ? t('ui.night.ellipsis') : t('ui.night.enter', { n: r.day + 1 })}
        </button>
      }
    >
      {r.weekly && (
        <div className="mb-3 border-l-2 border-alarm bg-alarm/8 px-3 py-2.5">
          <div className="label mb-1 text-alarm">{t('ui.night.week')}</div>
          <p className="text-[13px] leading-relaxed text-paper">
            {t('ui.night.weekBody', { n: run.threat, desc: THREAT_DESC[run.threat] })}
          </p>
        </div>
      )}

      {r.notes.length > 0 && (
        <>
          <SectionLabel>{t('ui.night.settle')}</SectionLabel>
          <div className="mb-3 space-y-1">
            {r.notes.map((n, i) => (
              <div
                key={i}
                className={`text-[12.5px] leading-snug ${
                  n.tone === 'good' ? 'text-safehi' : n.tone === 'bad' ? 'text-alarmhi' : 'text-dim'
                }`}
              >
                · {n.text}
              </div>
            ))}
          </div>
        </>
      )}

      {r.healthNotes.length > 0 && (
        <>
          <SectionLabel>{t('ui.night.body')}</SectionLabel>
          <div className="mb-3 space-y-1">
            {r.healthNotes.map((n, i) => (
              <div
                key={i}
                className={`text-[12.5px] leading-snug ${
                  n.tone === 'good' ? 'text-safehi' : n.tone === 'bad' ? 'text-alarmhi' : 'text-dim'
                }`}
              >
                · {n.text}
              </div>
            ))}
          </div>
        </>
      )}

      {!isPrepNight && (
        <div className="mb-3 space-y-1 border-t border-line pt-3 text-[12.5px] leading-snug text-dim">
          {r.hpAfter !== undefined && (
            <div>
              {t('ui.night.hp')} {r.hpAfter}
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
              {t('ui.night.outdoor', { out: r.outdoor, in: r.indoor, target: COLD.TARGET })}
            </div>
          )}
        </div>
      )}

      {!isPrepNight && (
        <div className="grid grid-cols-3 gap-3 border-t border-line pt-3">
          <div>
            <div className="label">{t('ui.night.hp')}</div>
            <div className="num text-lg text-paper">{Math.round(run.stats.hp)}</div>
          </div>
          <div>
            <div className="label">{t('ui.night.sanity')}</div>
            <div className="num text-lg text-paper">{Math.round(run.stats.sanity)}</div>
          </div>
          <div>
            <div className="label">{t('ui.night.exposure')}</div>
            <div className="num text-lg text-paper">
              {Math.round((r.exposureAfter ?? run.world.exposure) * 10) / 10}
              {r.exposureAdded !== 0 && (
                <span className={`ml-1 text-[11px] ${r.exposureAdded > 0 ? 'text-alarmhi' : 'text-safehi'}`}>
                  {r.exposureAdded > 0 ? '+' : ''}
                  {r.exposureAdded}
                </span>
              )}
              {!!r.exposureDecay && r.exposureDecay > 0 && (
                <span className="ml-1 text-[11px] text-safehi">{t('ui.night.decay', { n: r.exposureDecay })}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {r.died && (
        <div className="mt-3 border-l-2 border-alarm bg-alarm/10 px-3 py-2.5 text-[13px] leading-relaxed text-alarmhi">
          {t('ui.night.died')}
          {r.cause ? t('ui.night.cause', { cause: r.cause }) : ''}
        </div>
      )}
    </Modal>
  );
}

// ============================================================
// 搜刮取舍
// ============================================================

export function HaulModal({ run }: { run: RunState }) {
  const { haul, takeHaul, discardHaul, toast } = useGame();
  const cap = carryCap(run);
  const room = waterRoom(run);

  const [picked, setPicked] = useState<Record<string, number>>(() => {
    if (!haul) return {};
    // 默认按单位重量从轻到重贪心装满
    const sorted = [...haul.items].sort((a, b) => a.weight / a.amount - b.weight / b.amount);
    const out: Record<string, number> = {};
    let used = 0;
    let waterLeft = Math.max(0, waterCapacity(run) - run.res.water);
    for (const it of sorted) {
      const unitW = it.weight / it.amount;
      const roomKg = Math.max(0, cap - used);
      let canTake = unitW > 0 ? Math.min(it.amount, Math.floor((roomKg / unitW) * 10) / 10) : it.amount;
      if (it.res === 'water') {
        canTake = Math.min(canTake, waterLeft);
        waterLeft = Math.max(0, waterLeft - canTake);
      }
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

  const set = (res: string, amount: number) => {
    if (res === 'water') {
      const maxByRoom = room;
      if (amount > maxByRoom + 0.01) {
        toast(t('ledger.toast.waterRoom', { room: maxByRoom.toFixed(1), cap: waterCapacity(run) }), 'bad');
        setPicked((p) => ({ ...p, [res]: Math.max(0, maxByRoom) }));
        return;
      }
    }
    setPicked((p) => ({ ...p, [res]: Math.max(0, amount) }));
  };

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
      title={t('ui.haul.title', { name: loc?.name ?? t('ui.haul.outside') })}
      subtitle={
        haul.items.length === 0
          ? t('ui.haul.emptySub')
          : `${t('ui.haul.capSub', { cap })}${haul.night ? t('ui.haul.nightBit') : ''}`
      }
      width="max-w-xl"
      footer={
        <div className="flex gap-2">
          <button className="btn btn-ghost flex-1 py-2" onClick={discardHaul}>
            {t('ui.haul.dropAll')}
          </button>
          <button className="btn btn-primary flex-[2] py-2" disabled={over} onClick={commit}>
            {over ? t('ui.haul.overweight') : t('ui.haul.take')}
          </button>
        </div>
      }
    >
      {haul.items.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-faint">{t('ui.haul.emptyBody')}</p>
      ) : (
        <>
          <div className="mb-3">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="label">{t('ui.haul.weight')}</span>
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
              const waterMax = it.res === 'water' ? Math.min(it.amount, room) : it.amount;
              return (
                <div key={it.res} className="panel p-2.5">
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <span className="text-[13px] text-paper">{RES_NAME[it.res as ResourceId]}</span>
                      <span className="num ml-2 text-[11.5px] text-faint">
                        {t('ui.haul.found', {
                          amt: it.amount,
                          unit: RES_UNIT[it.res as ResourceId],
                          w: unitW.toFixed(2),
                        })}
                        {it.res === 'water' ? t('ui.haul.waterRoom', { room: room.toFixed(1) }) : ''}
                      </span>
                    </div>
                    <span className="num text-[13px] text-amberhi">
                      {t('ui.haul.takeAmt', { n: Math.round(cur * 10) / 10 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={waterMax}
                      step={it.amount > 20 ? 1 : 0.5}
                      value={Math.min(cur, waterMax)}
                      onChange={(e) => set(it.res, Number(e.target.value))}
                      className="flex-1 accent-amber"
                    />
                    <button className="btn btn-ghost px-2 py-0.5 text-[10.5px]" onClick={() => set(it.res, 0)}>
                      0
                    </button>
                    <button
                      className="btn btn-ghost px-2 py-0.5 text-[10.5px]"
                      onClick={() => set(it.res, waterMax)}
                    >
                      {t('ui.haul.all')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {haul.danger > 0 && (
            <p className="mt-3 border-l-2 border-alarmdim bg-alarm/5 px-3 py-2 text-[12px] leading-snug text-alarmhi">
              {t('ui.haul.danger', { n: haul.danger })}
              {haul.night ? t('ui.haul.nightHigher') : ''}
              {t('ui.haul.exposed')}
              {haul.danger >= 40 ? t('ui.haul.riskHurt') : ''}
              {haul.danger >= 55 ? t('ui.haul.riskFollow') : t('ui.haul.period')}
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

  return (
    <Modal
      title={t('ui.result.title')}
      width="max-w-lg"
      footer={
        <button className="btn btn-primary w-full py-2.5" onClick={dismissChoice}>
          {died ? t('ui.common.settle') : t('ui.common.continue')}
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
              {checkRoll.success
                ? t('ui.result.checkOk', { skill: SKILL_NAME[checkRoll.skill] })
                : t('ui.result.checkBad', { skill: SKILL_NAME[checkRoll.skill] })}
            </span>
            <span className="num text-[12px] text-dim">
              {t('ui.result.d20', {
                roll: checkRoll.roll,
                skill: checkRoll.total - checkRoll.roll,
                total: checkRoll.total,
                dc: checkRoll.dc,
              })}
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
            {raid.repelled ? t('ui.result.held') : t('ui.result.broken')}
          </div>
          <p className="text-[13px] leading-relaxed text-paper">{raid.narrative}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {raid.hpLost > 0 && <Chip tone="bad">{t('ui.result.hp', { n: raid.hpLost })}</Chip>}
            {raid.usedAmmo > 0 && <Chip tone="warn">{t('ui.result.ammo', { n: raid.usedAmmo })}</Chip>}
            {raid.moduleDamaged && <Chip tone="bad">{t('ui.result.module', { name: raid.moduleDamaged })}</Chip>}
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
          {t('ui.result.died')}
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
      {list.map((item) => (
        <div
          key={item.id}
          className="anim-rise border-l-2 bg-panel2/95 px-3 py-2 text-[12.5px] leading-snug shadow-lg backdrop-blur"
          style={{
            borderColor:
              item.tone === 'good' ? 'var(--color-safe)' : item.tone === 'bad' ? 'var(--color-alarm)' : 'var(--color-line2)',
            color: item.tone === 'bad' ? 'var(--color-alarmhi)' : 'var(--color-paper)',
          }}
        >
          {item.text}
        </div>
      ))}
    </div>
  );
}
