import { useState } from 'react';

import { BANK, TIME } from '../game/balance';
import { DISASTERS, DISASTER_BY_ID } from '../game/content/disasters';
import { SOURCE_NAME } from '../game/content/intel';
import { BASE_PRICE, LOCATIONS, RES_NAME, RES_UNIT } from '../game/content/locations';
import { BUILD_PATH_NAME, FACTION_NAME, SKILL_NAME } from '../game/copy/names';
import { t } from '../game/copy/t';
import { MODULES, moduleHardEffect, moduleSpec } from '../game/content/modules';
import { SITE_BY_ID } from '../game/content/sites';
import {
  SALVAGE_TARGETS,
  blockingReason,
  buildOptions,
  maintenanceOptions,
  nextLevel,
  nextWorkPortion,
} from '../game/engine/construction';
import { IODINE_BOX_LIMIT, IODINE_BOX_PRICE, CO_ALARM_PRICE, iodineBoughtCount, remainingBuyLimit, waterRoom } from '../game/engine/economy';
import { effectiveModule, waterCapacity } from '../game/engine/tags';
import { forecastAccuracy, WEATHER_NAME } from '../game/engine/world';
import { useGame } from '../game/store';
import type { DisasterId, ModuleId, ResourceId, RunState } from '../game/types';
import { Bar, Chip, Empty, Modal, Panel, SectionLabel, Stat } from './kit';

// ============================================================
// 避难所
// ============================================================

export function ShelterPanel({ run }: { run: RunState }) {
  const { setOverlay, build, work, cancelProject, salvage, maintain } = useGame();
  const [open, setOpen] = useState<ModuleId | null>(null);
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  const isPrep = run.day < TIME.COLLAPSE_DAY;

  return (
    <Modal
      title={t('ui.shelter.title', { name: site.name })}
      subtitle={t('ui.shelter.subtitle')}
      onClose={() => setOverlay(null)}
      width="max-w-5xl"
    >
      <div className="space-y-2">
        {MODULES.map((m) => {
          const id = m.id;
          const level = run.modules[id];
          const cap = site.caps[id] ?? 3;
          const project = run.projects.find((p) => p.moduleId === id);
          const target = nextLevel(run, id);
          const spec = target ? moduleSpec(id, target) : null;
          const blocked = blockingReason(run, id);
          const isOpen = open === id;

          return (
            <div key={id} className="panel">
              <button
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.02]"
                onClick={() => setOpen(isOpen ? null : id)}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center border text-[12px]"
                  style={{
                    borderColor: project ? 'var(--color-amber)' : level > 0 ? 'var(--color-line2)' : 'var(--color-line)',
                    color: project ? 'var(--color-amberhi)' : level > 0 ? 'var(--color-safehi)' : 'var(--color-faint)',
                  }}
                >
                  {m.short}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13.5px] font-medium text-paper">{m.name}</span>
                    <span className="num text-[11.5px] text-amberdim">
                      {level} / {cap}
                    </span>
                    {project && <Chip tone="warn">{t('ui.common.building')}</Chip>}
                  </div>
                  <div className="truncate text-[11.5px] text-faint">
                    {moduleHardEffect(id, level, site.waterCapMult) ||
                      (level > 0 ? (moduleSpec(id, level)?.desc ?? m.desc) : m.zero)}
                  </div>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  {[1, 2, 3].map((lv) => (
                    <span
                      key={lv}
                      className="h-4 w-1.5"
                      style={{
                        background:
                          lv <= level ? 'var(--color-safe)' : lv <= cap ? 'var(--color-line2)' : 'var(--color-alarmdim)',
                      }}
                    />
                  ))}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-line p-3">
                  <p className="mb-3 text-[12.5px] leading-relaxed text-dim">{m.desc}</p>
                  <div className="mb-3 text-[12px] leading-snug text-amberhi">
                    {t('ui.shelter.current', {
                      fx: moduleHardEffect(id, level, site.waterCapMult) || t('ui.common.none'),
                    })}
                    {target ? t('ui.shelter.next', { fx: moduleHardEffect(id, target, site.waterCapMult) }) : ''}
                  </div>

                  {project && (
                    <div className="mb-3 border-l-2 border-amber bg-amber/5 p-3">
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="text-[12.5px] text-amberhi">
                          {t('ui.shelter.target', { path: BUILD_PATH_NAME[project.path], n: project.toLevel })}
                        </span>
                        <span className="num text-[11.5px] text-dim">
                          {project.path === 'diy'
                            ? t('ui.common.laborSp', { done: project.laborDone, total: project.laborTotal })
                            : t('ui.common.etaDay', { day: project.etaDay ?? 0 })}
                        </span>
                      </div>
                      {project.path === 'diy' && (
                        <Bar value={(project.laborDone / Math.max(1, project.laborTotal)) * 100} tone="warn" />
                      )}
                      <p className="mt-2 text-[11.5px] leading-snug text-alarmhi">{m.buildPenaltyDesc}</p>
                      {project.path === 'diy' && (() => {
                        const portion = nextWorkPortion(run, id);
                        if (!portion) return null;
                        return (
                          <p className="mt-1 text-[11px] text-dim">
                            {t('ledger.build.workCost', { mat: portion.materials, parts: portion.parts })}
                          </p>
                        );
                      })()}
                      <div className="mt-2 flex gap-2">
                        {project.path === 'diy' && (() => {
                          const portion = nextWorkPortion(run, id);
                          const lackMat = portion && run.res.materials < portion.materials;
                          const lackParts = portion && run.res.parts < portion.parts;
                          const blocked = run.ap < 1 || !!lackMat || !!lackParts;
                          return (
                            <button className="btn px-3 py-1 text-[11.5px]" disabled={blocked} onClick={() => work(id)}>
                              {t('ui.shelter.work')}
                            </button>
                          );
                        })()}
                        <button className="btn btn-danger px-3 py-1 text-[11.5px]" onClick={() => cancelProject(id)}>
                          {t('ui.shelter.cancel')}
                        </button>
                      </div>
                    </div>
                  )}

                  {!project && target && spec && (
                    <>
                      <SectionLabel>{t('ui.shelter.upTo', { n: target, desc: spec.desc })}</SectionLabel>
                      {blocked ? (
                        <div className="border-l-2 border-alarmdim bg-alarm/5 px-3 py-2 text-[12px] text-alarmhi">
                          {blocked}
                        </div>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-3">
                          {buildOptions(run, id).map((o) => (
                            <button
                              key={o.path}
                              className="choice"
                              disabled={!o.available}
                              onClick={() => build(id, o.path)}
                            >
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="font-medium text-paper">{BUILD_PATH_NAME[o.path]}</span>
                                {!o.available && <Chip tone="bad">{o.reason}</Chip>}
                              </div>
                              <div className="num mt-1 text-[11.5px] leading-snug text-dim">{o.cost}</div>
                              {o.available && o.path === 'diy' && (o.failRisk ?? 0) > 0 && (
                                <div className="mt-1 text-[11px] text-alarmhi">
                                  {t('ui.shelter.failRisk', { pct: Math.round((o.failRisk ?? 0) * 100) })}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {spec.power ? <p className="mt-2 text-[11.5px] text-faint">{t('ui.shelter.power', { n: spec.power })}</p> : null}
                    </>
                  )}

                  {!project && !target && <div className="text-[12px] text-faint">{t('ui.shelter.atCap')}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <SectionLabel>{t('ui.shelter.maint')}</SectionLabel>
        <p className="mb-2 text-[12px] leading-snug text-faint">{t('ui.shelter.maintHint')}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {maintenanceOptions(run).map((m) => (
            <button key={m.kind} className="choice" disabled={!m.available} onClick={() => maintain(m.kind)}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-paper">{m.name}</span>
                {m.available ? (
                  <Chip tone={m.remaining <= 6 ? 'bad' : 'warn'}>{t('ui.shelter.remain', { n: m.remaining })}</Chip>
                ) : (
                  <Chip tone="bad">{m.reason}</Chip>
                )}
              </div>
              <div className="mt-1 text-[11.5px] leading-snug text-faint">{m.desc}</div>
              <div className="num mt-1 text-[11px] text-dim">
                {t('ui.shelter.maintCost', { n: m.parts })}
              </div>
            </button>
          ))}
        </div>
      </div>

      {!isPrep && (
        <div className="mt-4">
          <SectionLabel>{t('ui.shelter.salvage')}</SectionLabel>
          <p className="mb-2 text-[12px] leading-snug text-faint">{t('ui.shelter.salvageHint')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SALVAGE_TARGETS.map((target) => (
              <button key={target.id} className="choice" disabled={run.ap < 1} onClick={() => salvage(target.id)}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-paper">{target.name}</span>
                  <div className="flex gap-1">
                    <Chip tone="warn">{t('ui.shelter.exposure', { n: target.exposure })}</Chip>
                    {target.humanity < 0 && <Chip tone="bad">{t('ui.shelter.humanity', { n: target.humanity })}</Chip>}
                  </div>
                </div>
                <div className="mt-1 text-[11.5px] leading-snug text-faint">{target.desc}</div>
                <div className="num mt-1 text-[11px] text-dim">
                  {t('ui.shelter.salvageRange', {
                    a: target.materials[0],
                    b: target.materials[1],
                    c: target.parts[0],
                    d: target.parts[1],
                  })}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ============================================================
// 地图 / 外出
// ============================================================

export function MapPanel({ run }: { run: RunState }) {
  const { setOverlay, scavenge, visitShop } = useGame();
  const isPrep = run.day < TIME.COLLAPSE_DAY;
  const [night, setNight] = useState(false);
  const nightowl = run.abilities.includes('perk_nightowl');
  const listed = isPrep ? LOCATIONS.filter((loc) => loc.prepShop) : LOCATIONS;

  return (
    <Modal
      title={isPrep ? t('ui.map.shop') : t('ui.map.out')}
      subtitle={
        isPrep
          ? `${t('ui.map.price', { n: run.world.priceIndex.toFixed(2) })}${run.day >= 5 ? t('ui.map.limited') : ''}`
          : t('ui.map.scavSub')
      }
      onClose={() => setOverlay(null)}
      width="max-w-4xl"
    >
      {!isPrep && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="label">{t('ui.map.when')}</span>
          <button
            className={`btn px-3 py-1 text-[11.5px] ${!night ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setNight(false)}
          >
            {t('ui.map.day')}
          </button>
          <button
            className={`btn px-3 py-1 text-[11.5px] ${night ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setNight(true)}
          >
            {nightowl ? t('ui.map.nightOwl') : t('ui.map.night')}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {listed.map((loc) => {
          const st = run.locations.find((l) => l.id === loc.id);
          const stock = st?.stock ?? loc.stock;
          const visited = run.visitedToday.includes(loc.id);
          const canGo = !loc.needsVehicle || run.hasVehicle;
          const showStock = !isPrep || run.abilities.includes('perk_scavenger') || visited;
          const blocked = st?.blocked;

          return (
            <div key={loc.id} className="panel p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[13.5px] font-medium text-paper">{loc.name}</span>
                <Chip tone={loc.distance === 1 ? 'good' : loc.distance === 2 ? 'warn' : 'bad'}>
                  {['', t('ui.map.near'), t('ui.map.mid'), t('ui.map.far')][loc.distance]}
                </Chip>
                {!isPrep && (
                  <Chip tone={loc.danger < 20 ? 'good' : loc.danger < 40 ? 'warn' : 'bad'}>
                    {t('ui.map.danger', { n: loc.danger })}
                  </Chip>
                )}
                {loc.needsVehicle && <Chip tone={run.hasVehicle ? 'info' : 'bad'}>{t('ui.map.needCar')}</Chip>}
                {showStock && (
                  <Chip tone={stock <= 0 ? 'bad' : stock > 60 ? 'good' : stock > 25 ? 'warn' : 'bad'}>
                    {stock <= 0 ? t('ui.map.empty') : t('ui.map.stock', { n: Math.round(stock) })}
                  </Chip>
                )}
                {blocked && <Chip tone="bad">{t('ui.map.blocked')}</Chip>}
                {visited && <Chip>{t('ui.map.visited')}</Chip>}
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-dim">
                {!isPrep && loc.descSurvival ? loc.descSurvival : loc.desc}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {loc.loot.map((l) => (
                  <Chip key={l.res}>{RES_NAME[l.res]}</Chip>
                ))}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {isPrep && loc.prepShop && (
                  <button
                    className="btn px-3 py-1 text-[11.5px]"
                    disabled={!canGo || (run.ap < 1 && !visited)}
                    onClick={() => visitShop(loc.id)}
                  >
                    {visited ? t('ui.map.shopAgain') : t('ui.map.shopGo')}
                  </button>
                )}
                {!isPrep && (
                  <button
                    className="btn btn-ghost px-3 py-1 text-[11.5px]"
                    disabled={!canGo || run.ap < 1 || stock <= 0}
                    onClick={() => scavenge(loc.id, night)}
                  >
                    {stock <= 0 ? t('ui.map.scavEmpty') : night ? t('ui.map.scavNight') : t('ui.map.scavGo')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ============================================================
// 情报
// ============================================================

export function IntelPanel({ run }: { run: RunState }) {
  const { setOverlay, verifyIntel } = useGame();
  const isPrep = run.day < TIME.COLLAPSE_DAY;

  const tally = new Map<DisasterId | 'none', { total: number; confirmed: number; denied: number }>();
  for (const i of run.intel) {
    const cur = tally.get(i.points) ?? { total: 0, confirmed: 0, denied: 0 };
    cur.total += 1;
    if (i.verified) {
      if (i.truthful) cur.confirmed += 1;
      else cur.denied += 1;
    }
    tally.set(i.points, cur);
  }

  const byDay = new Map<number, typeof run.intel>();
  for (const i of run.intel) {
    const arr = byDay.get(i.day) ?? [];
    arr.push(i);
    byDay.set(i.day, arr);
  }
  const days = [...byDay.keys()].sort((a, b) => b - a);

  return (
    <Modal
      title={isPrep ? t('ui.intel.board') : t('ui.intel.radio')}
      subtitle={isPrep ? t('ui.intel.boardSub') : t('ui.intel.radioSub')}
      onClose={() => setOverlay(null)}
      width="max-w-4xl"
    >
      {run.world.revealed ? (
        <RevealedIntel run={run} />
      ) : (
        <Panel title={t('ui.intel.infer')} mark className="mb-4">
          <p className="mb-3 text-[12px] leading-snug text-faint">{t('ui.intel.inferHint')}</p>
          <div className="space-y-2">
            {DISASTERS.map((d) => {
              const row = tally.get(d.id) ?? { total: 0, confirmed: 0, denied: 0 };
              const max = Math.max(1, ...[...tally.values()].map((x) => x.total));
              return (
                <div key={d.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] text-paper">{d.name}</span>
                    <span className="num text-[11.5px] text-dim">
                      {t('ui.intel.count', { n: row.total })}
                      {row.confirmed > 0 && (
                        <span className="ml-1.5 text-safehi">{t('ui.intel.true', { n: row.confirmed })}</span>
                      )}
                      {row.denied > 0 && (
                        <span className="ml-1.5 text-alarmhi">{t('ui.intel.false', { n: row.denied })}</span>
                      )}
                    </span>
                  </div>
                  <div className="mt-0.5">
                    <Bar
                      value={row.total}
                      max={max}
                      tone={row.confirmed > 0 ? 'good' : row.denied > 0 ? 'bad' : 'info'}
                    />
                  </div>
                  <div className="mt-0.5 text-[11px] text-faint">
                    {t('ui.intel.keys', { list: d.keySupplies.join('、') })}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <SectionLabel>{t('ui.intel.stream')}</SectionLabel>
      {days.length === 0 && <Empty>{t('ui.intel.empty')}</Empty>}
      {days.map((day) => (
        <div key={day} className="mb-4">
          <div className="label mb-1.5">
            {t('ui.common.dayN', { n: day })}
            {day === run.day && t('ui.intel.today')}
          </div>
          <div className="space-y-1.5">
            {(byDay.get(day) ?? []).map((i) => (
              <div
                key={i.id}
                className="border-l-2 px-3 py-2"
                style={{
                  borderColor: i.verified
                    ? i.truthful
                      ? 'var(--color-safe)'
                      : 'var(--color-alarm)'
                    : 'var(--color-line2)',
                  background: i.verified
                    ? i.truthful
                      ? 'rgba(63,158,107,0.06)'
                      : 'rgba(222,74,63,0.06)'
                    : 'transparent',
                }}
              >
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <Chip tone={i.source === 'official' ? 'info' : i.source === 'shortwave' ? 'psyche' : 'default'}>
                    {SOURCE_NAME[i.source]}
                  </Chip>
                  {i.verified && (
                    <Chip tone={i.truthful ? 'good' : 'bad'}>
                      {i.truthful ? t('ui.intel.verifiedTrue') : t('ui.intel.verifiedFalse')}
                    </Chip>
                  )}
                  {!i.verified && day === run.day && !run.world.revealed && (
                    <button
                      className="btn btn-ghost px-1.5 py-0 text-[10px]"
                      disabled={run.ap < 1}
                      onClick={() => verifyIntel(i.id)}
                    >
                      {t('ui.intel.verify')}
                    </button>
                  )}
                </div>
                <p className="text-[12.5px] leading-relaxed text-dim">{i.text}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  );
}

function RevealedIntel({ run }: { run: RunState }) {
  const def = DISASTER_BY_ID[run.world.disaster];
  const acc = forecastAccuracy(run);
  return (
    <div className="mb-4 space-y-3">
      <Panel title={t('ui.intel.current', { name: def.name })} mark>
        <p className="mb-2 text-[12.5px] leading-relaxed text-amberhi">{def.thesis}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <div className="label mb-1">{t('ui.intel.keySupplies')}</div>
            <div className="flex flex-wrap gap-1">
              {def.keySupplies.map((s) => (
                <Chip key={s} tone="warn">
                  {s}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-1">{t('ui.intel.factions')}</div>
            <div className="flex flex-wrap gap-1">
              {def.factions.map((f) => (
                <Chip key={f} tone="info">
                  {FACTION_NAME[f] ?? f} {Math.round(run.world.factions[f])}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel title={t('ui.intel.forecast')} mark right={<span className="text-faint">{t('ui.intel.accuracy', { n: Math.round(acc * 100) })}</span>}>
        <div className="flex gap-2">
          {run.world.forecast.map((w, i) => (
            <div key={i} className="flex-1 border border-line bg-ink px-2 py-2 text-center">
              <div className="label">{t('ui.common.dayN', { n: run.day + i + 1 })}</div>
              <div className="mt-1 text-[13px] text-paper">{WEATHER_NAME[w]}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] leading-snug text-faint">
          {effectiveModule(run, 'radio') > 0
            ? t('ui.intel.radioOn')
            : run.modules.radio > 0
              ? t('ui.intel.radioOff')
              : t('ui.intel.noRadio')}
        </p>
      </Panel>

      <Panel title={t('ui.intel.world')} mark>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Stat label={t('ui.intel.law')} value={Math.round(run.world.lawOrder)} tone={run.world.lawOrder < 40 ? 'bad' : 'warn'} />
          <Stat label={t('ui.intel.scarcity')} value={Math.round(run.world.scarcity)} tone="warn" />
          <Stat
            label={t('ui.intel.neighborhood')}
            value={Math.round(run.world.neighborhood)}
            tone={run.world.neighborhood > 0 ? 'good' : 'bad'}
          />
          <Stat label={t('ui.intel.air')} value={Math.round(run.world.airPollution)} tone="warn" />
          <Stat label={t('ui.intel.rad')} value={Math.round(run.world.radiation)} tone={run.world.radiation > 30 ? 'bad' : 'warn'} />
          <Stat label={t('ui.intel.contagion')} value={Math.round(run.world.contagion)} tone="psyche" />
        </div>
      </Panel>
    </div>
  );
}

// ============================================================
// 同伴
// ============================================================

export function CrewPanel({ run }: { run: RunState }) {
  const { setOverlay } = useGame();
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];

  return (
    <Modal
      title={t('ui.crew.title')}
      subtitle={t('ui.crew.subtitle', { n: run.survivors.length, cap: site.companionCap })}
      onClose={() => setOverlay(null)}
      width="max-w-3xl"
    >
      {run.survivors.length === 0 ? (
        <Empty>{t('ui.crew.empty')}</Empty>
      ) : (
        <div className="space-y-2">
          {run.survivors.map((s) => (
            <Panel key={s.id}>
              <div className="mb-1 flex flex-wrap items-baseline gap-2">
                <span className="text-[14px] font-medium text-paper">{s.name}</span>
                <span className="num text-[11.5px] text-faint">{t('ui.common.age', { n: s.age })}</span>
                <span className="text-[11px] text-faint">{t('ui.common.joined', { n: s.joinedDay })}</span>
                {s.conditions.length > 0 && <Chip tone="bad">{t('ui.common.sick')}</Chip>}
              </div>
              <p className="mb-2 text-[12.5px] leading-relaxed text-dim">{s.bio}</p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {Object.entries(s.skills).map(([k, v]) => (
                  <Chip key={k} tone="info">
                    {SKILL_NAME[k as keyof typeof SKILL_NAME] ?? k} {v}
                  </Chip>
                ))}
                <Chip tone="warn">{t('ui.common.upkeep', { n: s.upkeep })}</Chip>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-0.5 flex items-baseline justify-between">
                    <span className="label">{t('ui.common.morale')}</span>
                    <span className="num text-[11.5px] text-dim">{Math.round(s.morale)}</span>
                  </div>
                  <Bar value={s.morale} tone={s.morale > 55 ? 'good' : s.morale > 28 ? 'warn' : 'bad'} />
                </div>
                <div>
                  <div className="mb-0.5 flex items-baseline justify-between">
                    <span className="label">{t('ui.common.trust')}</span>
                    <span className="num text-[11.5px] text-dim">{Math.round(s.trust)}</span>
                  </div>
                  <Bar value={s.trust} tone="info" />
                </div>
              </div>
              {s.secretRevealed && s.secret && (
                <div className="mt-2 border-l-2 border-psyche bg-psyche/5 px-3 py-2 text-[12px] leading-relaxed text-psyche">
                  {s.secret.text}
                </div>
              )}
              {!s.secretRevealed && s.secret && (
                <p className="mt-2 text-[11.5px] text-faint">{t('ui.crew.secretSoon')}</p>
              )}
            </Panel>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ============================================================
// 日记
// ============================================================

export function LogPanel({ run }: { run: RunState }) {
  const { setOverlay, toast } = useGame();

  const exportText = () => {
    const lines = run.log.map((l) => t('ui.log.line', { n: l.day, text: l.text }));
    const text = `${t('ui.log.exportTitle')}\n${t('ui.log.exportSeed', { n: run.seed })}\n\n${lines.join('\n\n')}`;
    navigator.clipboard?.writeText(text);
    toast(t('ledger.toast.diaryCopied'), 'good');
  };

  const byDay = new Map<number, typeof run.log>();
  for (const l of run.log) {
    const arr = byDay.get(l.day) ?? [];
    arr.push(l);
    byDay.set(l.day, arr);
  }
  const days = [...byDay.keys()].sort((a, b) => b - a);

  const TONE: Record<string, string> = {
    good: 'var(--color-safe)',
    bad: 'var(--color-alarm)',
    grim: 'var(--color-psyche)',
    neutral: 'var(--color-line2)',
  };

  return (
    <Modal
      title={t('ui.log.title')}
      subtitle={t('ui.log.subtitle')}
      onClose={() => setOverlay(null)}
      width="max-w-3xl"
      footer={
        <button className="btn btn-ghost w-full py-2" onClick={exportText}>
          {t('ui.log.copy')}
        </button>
      }
    >
      {days.length === 0 && <Empty>{t('ui.log.empty')}</Empty>}
      {days.map((day) => (
        <div key={day} className="mb-4">
          <div className="label mb-1.5">
            {t('ui.common.dayN', { n: day })}
            {day < TIME.COLLAPSE_DAY ? t('ui.log.prep', { n: TIME.PREP_DAYS - day + 1 }) : ''}
          </div>
          <div className="space-y-1.5">
            {(byDay.get(day) ?? []).map((l, i) => (
              <p
                key={i}
                className="border-l-2 px-3 py-1.5 text-[12.5px] leading-relaxed text-dim"
                style={{ borderColor: TONE[l.tone] }}
              >
                {l.text}
              </p>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  );
}

// ============================================================
// 采购
// ============================================================

export function ShopModal({ run, locationId }: { run: RunState; locationId: string }) {
  const { closeShop, buy, buyIodine, buyCoAlarm, withdraw } = useGame();
  const loc = LOCATIONS.find((l) => l.id === locationId);
  if (!loc) return null;
  const hasClerk = run.abilities.includes('clerk_network');
  const st = run.locations.find((l) => l.id === locationId);
  const sellable = Object.keys(loc.prices ?? {}) as ResourceId[];
  const iodineLeft = IODINE_BOX_LIMIT - iodineBoughtCount(run);
  const iodinePrice = Math.max(1, Math.round(IODINE_BOX_PRICE * run.world.priceIndex));
  const hasCoAlarm = run.flags.includes('flag:coAlarm');
  const coAlarmPrice = Math.max(1, Math.round(CO_ALARM_PRICE * run.world.priceIndex));

  return (
    <Modal
      title={loc.name}
      subtitle={`${t('ui.shop.price', { n: run.world.priceIndex.toFixed(2), stock: Math.round(st?.stock ?? 100) })}${
        run.day >= 5 && !hasClerk ? t('ui.shop.limited') : ''
      }`}
      onClose={closeShop}
      width="max-w-2xl"
    >
      {sellable.length === 0 && locationId !== 'pharmacy' && locationId !== 'hardware' && locationId !== 'bank' && (
        <Empty>{t('ui.shop.empty')}</Empty>
      )}
      {locationId === 'bank' && (
        <div className="panel flex flex-wrap items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] text-paper">{t('ui.shop.atmTitle')}</span>
              <span className="num text-[11.5px] text-amberdim">
                {t('ui.shop.savings', { n: Math.floor(run.savings) })}
              </span>
            </div>
            <div className="text-[11px] leading-snug text-faint">{t('ui.shop.atmHint')}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              className="btn px-3 py-1 text-[11px]"
              disabled={run.savings <= 0 || BANK.DAILY_LIMIT - run.atmUsed <= 0}
              onClick={() => withdraw(locationId, Math.min(BANK.DAILY_LIMIT, run.savings))}
            >
              {t('ui.shop.withdraw', { n: Math.min(BANK.DAILY_LIMIT, Math.floor(run.savings)) })}
            </button>
            <span className="text-[10.5px] text-faint">
              {run.savings <= 0
                ? t('ui.shop.savingsEmpty')
                : BANK.DAILY_LIMIT - run.atmUsed <= 0
                  ? t('ui.shop.atmLimit')
                  : t('ui.shop.atmLeft', { n: BANK.DAILY_LIMIT - run.atmUsed })}
            </span>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {locationId === 'hardware' && (
          <div className="panel flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] text-paper">{t('ui.shop.coAlarm')}</span>
                <span className="num text-[11.5px] text-amberdim">{t('ui.shop.coAlarmUnit', { n: coAlarmPrice })}</span>
              </div>
              <div className="text-[11px] leading-snug text-faint">{t('ui.shop.coAlarmHint')}</div>
            </div>
            <div>
              {hasCoAlarm ? (
                <span className="text-[11px] text-faint">{t('ui.shop.bought')}</span>
              ) : (
                <button
                  className="btn px-2 py-1 text-[11px]"
                  disabled={run.res.cash < coAlarmPrice}
                  onClick={() => buyCoAlarm(locationId)}
                >
                  {t('ui.shop.buyOne')}
                </button>
              )}
            </div>
          </div>
        )}
        {locationId === 'pharmacy' && (
          <div className="panel flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] text-paper">{t('ui.shop.iodine')}</span>
                <Chip tone="warn">{t('ui.shop.notMeds')}</Chip>
                <span className="num text-[11.5px] text-amberdim">{t('ui.shop.box', { n: iodinePrice })}</span>
              </div>
              <div className="text-[11px] leading-snug text-faint">
                {t('ui.shop.iodineHint', { limit: IODINE_BOX_LIMIT, left: iodineLeft })}
              </div>
            </div>
            <div>
              {iodineLeft <= 0 ? (
                <span className="text-[11px] text-faint">{t('ui.shop.bought')}</span>
              ) : (
                <button
                  className="btn px-2 py-1 text-[11px]"
                  disabled={run.res.cash < iodinePrice}
                  onClick={() => buyIodine(locationId)}
                >
                  {t('ui.shop.buyBox')}
                </button>
              )}
            </div>
          </div>
        )}
        {sellable.map((res) => {
          const price = Math.max(
            1,
            Math.round(BASE_PRICE[res] * run.world.priceIndex * (loc.prices?.[res] ?? 1) * (hasClerk ? 0.9 : 1)),
          );
          const limit = remainingBuyLimit(run, res, hasClerk);
          const room = res === 'water' ? waterRoom(run) : Infinity;
          const amounts = [1, 5, 10, limit]
            .filter((n, i, a) => n <= limit && a.indexOf(n) === i && n > 0)
            .map((n) => (res === 'water' ? Math.min(n, Math.max(0, Math.floor(room))) : n))
            .filter((n, i, a) => n > 0 && a.indexOf(n) === i);
          const empty = (st?.stock ?? 100) <= 0 || limit <= 0 || (res === 'water' && room <= 0);
          return (
            <div key={res} className="panel flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] text-paper">{RES_NAME[res]}</span>
                  <span className="num text-[11.5px] text-amberdim">
                    {t('ui.shop.unit', { price, unit: RES_UNIT[res] })}
                  </span>
                </div>
                <div className="text-[11px] text-faint">
                  {t('ui.shop.remain', { limit, unit: RES_UNIT[res], have: Math.round(run.res[res] * 10) / 10 })}
                  {res === 'water' ? t('ui.shop.waterRoom', { room: room.toFixed(1), cap: waterCapacity(run) }) : ''}
                </div>
              </div>
              <div className="flex gap-1">
                {empty ? (
                  <span className="text-[11px] text-faint">
                    {res === 'water' && room <= 0
                      ? t('ui.shop.waterFull')
                      : limit <= 0
                        ? t('ui.shop.dayFull')
                        : t('ui.shop.shelfEmpty')}
                  </span>
                ) : (
                  amounts.map((n) => (
                    <button
                      key={n}
                      className="btn px-2 py-1 text-[11px]"
                      disabled={run.res.cash < price * n}
                      onClick={() => buy(locationId, res, n)}
                    >
                      +{n}
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
        <span className="label">{t('ui.shop.cash')}</span>
        <span className="num text-[15px] text-amberhi">{t('ui.shop.cashAmt', { n: Math.round(run.res.cash) })}</span>
      </div>
    </Modal>
  );
}
