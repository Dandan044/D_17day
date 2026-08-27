import { useState } from 'react';

import { TIME } from '../game/balance';
import { DISASTERS, DISASTER_BY_ID } from '../game/content/disasters';
import { SOURCE_NAME } from '../game/content/intel';
import { BASE_PRICE, LOCATIONS, RES_NAME, RES_UNIT } from '../game/content/locations';
import { MODULES, moduleSpec } from '../game/content/modules';
import { SITE_BY_ID } from '../game/content/sites';
import {
  SALVAGE_TARGETS,
  blockingReason,
  buildOptions,
  maintenanceOptions,
  nextLevel,
} from '../game/engine/construction';
import { buyLimit } from '../game/engine/economy';
import { forecastAccuracy, WEATHER_NAME } from '../game/engine/world';
import { useGame } from '../game/store';
import type { BuildPath, DisasterId, ModuleId, ResourceId, RunState } from '../game/types';
import { Bar, Chip, Empty, Modal, Panel, SectionLabel, Stat } from './kit';

const SKILL_NAME: Record<string, string> = {
  medicine: '医疗',
  mechanics: '机械',
  negotiation: '谈判',
  fitness: '体能',
  stealth: '隐蔽',
};

const FACTION_NAME: Record<string, string> = {
  gov: '政府军',
  militia: '自治民兵',
  gang: '帮派',
  looter: '掠夺者',
  quarantine: '防疫队',
  cult: '邪教',
  refugee: '难民潮',
  rescue: '救援队',
  neighbors: '邻居',
  trader: '流浪商人',
};

// ============================================================
// 避难所
// ============================================================

const PATH_NAME: Record<BuildPath, string> = { diy: '自己动手', hire: '雇工', buy: '买成品', salvage: '拆解' };

export function ShelterPanel({ run }: { run: RunState }) {
  const { setOverlay, build, work, cancelProject, salvage, maintain } = useGame();
  const [open, setOpen] = useState<ModuleId | null>(null);
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  const isPrep = run.day < TIME.COLLAPSE_DAY;

  return (
    <Modal
      title={`避难所 · ${site.name}`}
      subtitle="施工中的模块处于劣化状态。什么时候动工，本身就是一个决定。"
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
                    {project && <Chip tone="warn">施工中</Chip>}
                  </div>
                  <div className="truncate text-[11.5px] text-faint">
                    {level > 0 ? (moduleSpec(id, level)?.desc ?? m.desc) : m.zero}
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

                  {project && (
                    <div className="mb-3 border-l-2 border-amber bg-amber/5 p-3">
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="text-[12.5px] text-amberhi">
                          {PATH_NAME[project.path]} · 目标 {project.toLevel} 级
                        </span>
                        <span className="num text-[11.5px] text-dim">
                          {project.path === 'diy'
                            ? `${project.laborDone} / ${project.laborTotal} 工时`
                            : `第 ${project.etaDay} 天`}
                        </span>
                      </div>
                      {project.path === 'diy' && (
                        <Bar value={(project.laborDone / Math.max(1, project.laborTotal)) * 100} tone="warn" />
                      )}
                      <p className="mt-2 text-[11.5px] leading-snug text-alarmhi">{m.buildPenaltyDesc}</p>
                      <div className="mt-2 flex gap-2">
                        {project.path === 'diy' && (
                          <button className="btn px-3 py-1 text-[11.5px]" disabled={run.ap < 1} onClick={() => work(id)}>
                            投入 1 行动点施工
                          </button>
                        )}
                        <button className="btn btn-danger px-3 py-1 text-[11.5px]" onClick={() => cancelProject(id)}>
                          停工（回收一半材料）
                        </button>
                      </div>
                    </div>
                  )}

                  {!project && target && spec && (
                    <>
                      <SectionLabel>
                        升到 {target} 级 · {spec.desc}
                      </SectionLabel>
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
                                <span className="font-medium text-paper">{PATH_NAME[o.path]}</span>
                                {!o.available && <Chip tone="bad">{o.reason}</Chip>}
                              </div>
                              <div className="num mt-1 text-[11.5px] leading-snug text-dim">{o.cost}</div>
                              {o.available && o.path === 'diy' && (o.failRisk ?? 0) > 0 && (
                                <div className="mt-1 text-[11px] text-alarmhi">
                                  技能不足，每次施工有 {Math.round((o.failRisk ?? 0) * 100)}% 概率做坏
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {spec.power ? <p className="mt-2 text-[11.5px] text-faint">每日耗电 {spec.power} kWh</p> : null}
                    </>
                  )}

                  {!project && !target && <div className="text-[12px] text-faint">已经到达这个站点允许的上限。</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <SectionLabel>维护</SectionLabel>
        <div className="grid gap-2 sm:grid-cols-2">
          {maintenanceOptions(run).map((m) => (
            <button key={m.kind} className="choice" disabled={!m.available} onClick={() => maintain(m.kind)}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-paper">{m.name}</span>
                {m.available ? (
                  <Chip tone={m.remaining <= 6 ? 'bad' : 'warn'}>剩 {m.remaining} 天</Chip>
                ) : (
                  <Chip tone="bad">{m.reason}</Chip>
                )}
              </div>
              <div className="mt-1 text-[11.5px] leading-snug text-faint">{m.desc}</div>
              <div className="num mt-1 text-[11px] text-dim">
                {m.parts} 零件 · 1 行动点
              </div>
            </button>
          ))}
        </div>
      </div>

      {!isPrep && (
        <div className="mt-4">
          <SectionLabel>拆解回收</SectionLabel>
          <p className="mb-2 text-[12px] leading-snug text-faint">
            现在买不到建材了。你只能从已经存在的东西上取——每一次都会制造声音，有些还会制造敌人。
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SALVAGE_TARGETS.map((t) => (
              <button key={t.id} className="choice" disabled={run.ap < 1} onClick={() => salvage(t.id)}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-paper">{t.name}</span>
                  <div className="flex gap-1">
                    <Chip tone="warn">暴露 +{t.exposure}</Chip>
                    {t.humanity < 0 && <Chip tone="bad">人性 {t.humanity}</Chip>}
                  </div>
                </div>
                <div className="mt-1 text-[11.5px] leading-snug text-faint">{t.desc}</div>
                <div className="num mt-1 text-[11px] text-dim">
                  建材 {t.materials[0]}-{t.materials[1]} · 零件 {t.parts[0]}-{t.parts[1]}
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

  return (
    <Modal
      title={isPrep ? '采购与搜集' : '外出'}
      subtitle={
        isPrep
          ? `物价指数 ${run.world.priceIndex.toFixed(2)}${run.day >= 5 ? ' · 已开始限购' : ''}`
          : '越远的地方存量越多，也越难回来'
      }
      onClose={() => setOverlay(null)}
      width="max-w-4xl"
    >
      {!isPrep && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="label">出行时段</span>
          <button
            className={`btn px-3 py-1 text-[11.5px] ${!night ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setNight(false)}
          >
            白天
          </button>
          <button
            className={`btn px-3 py-1 text-[11.5px] ${night ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setNight(true)}
          >
            夜间（产出 +40%，危险 ×1.8）
          </button>
        </div>
      )}

      <div className="space-y-2">
        {LOCATIONS.map((loc) => {
          const st = run.locations.find((l) => l.id === loc.id);
          const stock = st?.stock ?? loc.stock;
          const visited = run.visitedToday.includes(loc.id);
          const canGo = !loc.needsVehicle || run.hasVehicle;
          const showStock = run.abilities.includes('perk_scavenger') || visited;

          return (
            <div key={loc.id} className="panel p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[13.5px] font-medium text-paper">{loc.name}</span>
                <Chip tone={loc.distance === 1 ? 'good' : loc.distance === 2 ? 'warn' : 'bad'}>
                  {['', '近', '中', '远'][loc.distance]}
                </Chip>
                <Chip tone={loc.danger < 20 ? 'good' : loc.danger < 40 ? 'warn' : 'bad'}>危险 {loc.danger}</Chip>
                {loc.needsVehicle && <Chip tone={run.hasVehicle ? 'info' : 'bad'}>需要车</Chip>}
                {showStock && (
                  <Chip tone={stock > 60 ? 'good' : stock > 25 ? 'warn' : 'bad'}>存量 {Math.round(stock)}%</Chip>
                )}
                {visited && <Chip>今日已去过</Chip>}
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-dim">{loc.desc}</p>
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
                    {visited ? '再看看货架' : '去采购（1 AP）'}
                  </button>
                )}
                <button
                  className="btn btn-ghost px-3 py-1 text-[11.5px]"
                  disabled={!canGo || run.ap < 1}
                  onClick={() => scavenge(loc.id, night)}
                >
                  {isPrep ? '翻找一遍（1 AP）' : `搜刮（1 AP${night ? ' · 夜间' : ''}）`}
                </button>
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
      title={isPrep ? '情报板' : '无线电与局势'}
      subtitle={isPrep ? '真假混杂。你要在第七天之前赌对一个方向。' : '灾难已经揭晓，现在你要判断的是外面还剩下什么。'}
      onClose={() => setOverlay(null)}
      width="max-w-4xl"
    >
      {run.world.revealed ? (
        <RevealedIntel run={run} />
      ) : (
        <Panel title="方向推断" mark className="mb-4">
          <p className="mb-3 text-[12px] leading-snug text-faint">
            指向某个方向的情报越多，它越可能是真的——但制造噪音也很容易。核实过的情报会给出确认结果，那才是硬信息。
          </p>
          <div className="space-y-2">
            {DISASTERS.map((d) => {
              const t = tally.get(d.id) ?? { total: 0, confirmed: 0, denied: 0 };
              const max = Math.max(1, ...[...tally.values()].map((x) => x.total));
              return (
                <div key={d.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] text-paper">{d.name}</span>
                    <span className="num text-[11.5px] text-dim">
                      {t.total} 条
                      {t.confirmed > 0 && <span className="ml-1.5 text-safehi">确认真 {t.confirmed}</span>}
                      {t.denied > 0 && <span className="ml-1.5 text-alarmhi">确认假 {t.denied}</span>}
                    </span>
                  </div>
                  <div className="mt-0.5">
                    <Bar value={t.total} max={max} tone={t.confirmed > 0 ? 'good' : t.denied > 0 ? 'bad' : 'info'} />
                  </div>
                  <div className="mt-0.5 text-[11px] text-faint">关键物资：{d.keySupplies.join('、')}</div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <SectionLabel>情报流</SectionLabel>
      {days.length === 0 && <Empty>还没有收到任何东西。</Empty>}
      {days.map((day) => (
        <div key={day} className="mb-4">
          <div className="label mb-1.5">
            第 {day} 天{day === run.day && ' · 今天'}
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
                    <Chip tone={i.truthful ? 'good' : 'bad'}>{i.truthful ? '核实：真' : '核实：误导'}</Chip>
                  )}
                  {!i.verified && day === run.day && !run.world.revealed && (
                    <button
                      className="btn btn-ghost px-1.5 py-0 text-[10px]"
                      disabled={run.ap < 1}
                      onClick={() => verifyIntel(i.id)}
                    >
                      核实（1 AP）
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
      <Panel title={`当前灾难 · ${def.name}`} mark>
        <p className="mb-2 text-[12.5px] leading-relaxed text-amberhi">{def.thesis}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <div className="label mb-1">关键物资</div>
            <div className="flex flex-wrap gap-1">
              {def.keySupplies.map((s) => (
                <Chip key={s} tone="warn">
                  {s}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-1">活跃势力</div>
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

      <Panel title="天气预报" mark right={<span className="text-faint">准确度 {Math.round(acc * 100)}%</span>}>
        <div className="flex gap-2">
          {run.world.forecast.map((w, i) => (
            <div key={i} className="flex-1 border border-line bg-ink px-2 py-2 text-center">
              <div className="label">第 {run.day + i + 1} 天</div>
              <div className="mt-1 text-[13px] text-paper">{WEATHER_NAME[w]}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] leading-snug text-faint">
          {run.modules.radio > 0
            ? '无线电让预报更可靠。提前一天知道寒潮，就能提前一天囤燃料。'
            : '没有无线电，你只能靠看天。装一台会让预报准得多。'}
        </p>
      </Panel>

      <Panel title="局势指标" mark>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Stat label="秩序度" value={Math.round(run.world.lawOrder)} tone={run.world.lawOrder < 40 ? 'bad' : 'warn'} />
          <Stat label="物资稀缺度" value={Math.round(run.world.scarcity)} tone="warn" />
          <Stat
            label="社区关系"
            value={Math.round(run.world.neighborhood)}
            tone={run.world.neighborhood > 0 ? 'good' : 'bad'}
          />
          <Stat label="空气污染" value={Math.round(run.world.airPollution)} tone="warn" />
          <Stat label="辐射" value={Math.round(run.world.radiation)} tone={run.world.radiation > 30 ? 'bad' : 'warn'} />
          <Stat label="疫病流行度" value={Math.round(run.world.contagion)} tone="psyche" />
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
      title="这里的人"
      subtitle={`${run.survivors.length} / ${site.companionCap} 人 · 每个人都是一份劳力，也是一份口粮`}
      onClose={() => setOverlay(null)}
      width="max-w-3xl"
    >
      {run.survivors.length === 0 ? (
        <Empty>只有你一个人。这既是最安全的，也是最难熬的。</Empty>
      ) : (
        <div className="space-y-2">
          {run.survivors.map((s) => (
            <Panel key={s.id}>
              <div className="mb-1 flex flex-wrap items-baseline gap-2">
                <span className="text-[14px] font-medium text-paper">{s.name}</span>
                <span className="num text-[11.5px] text-faint">{s.age} 岁</span>
                <span className="text-[11px] text-faint">第 {s.joinedDay} 天加入</span>
                {s.conditions.length > 0 && <Chip tone="bad">生病了</Chip>}
              </div>
              <p className="mb-2 text-[12.5px] leading-relaxed text-dim">{s.bio}</p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {Object.entries(s.skills).map(([k, v]) => (
                  <Chip key={k} tone="info">
                    {SKILL_NAME[k] ?? k} {v}
                  </Chip>
                ))}
                <Chip tone="warn">日耗 ×{s.upkeep}</Chip>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-0.5 flex items-baseline justify-between">
                    <span className="label">士气</span>
                    <span className="num text-[11.5px] text-dim">{Math.round(s.morale)}</span>
                  </div>
                  <Bar value={s.morale} tone={s.morale > 55 ? 'good' : s.morale > 28 ? 'warn' : 'bad'} />
                </div>
                <div>
                  <div className="mb-0.5 flex items-baseline justify-between">
                    <span className="label">信任</span>
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
                <p className="mt-2 text-[11.5px] text-faint">他还有些话没说。信任够高的时候，你会知道。</p>
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
    const lines = run.log.map((l) => `第 ${l.day} 天　${l.text}`);
    const text = `《七日之前》记忆日记\n种子 ${run.seed}\n\n${lines.join('\n\n')}`;
    navigator.clipboard?.writeText(text);
    toast('日记已复制到剪贴板', 'good');
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
      title="记忆日记"
      subtitle="这一局发生过的事，按天记录"
      onClose={() => setOverlay(null)}
      width="max-w-3xl"
      footer={
        <button className="btn btn-ghost w-full py-2" onClick={exportText}>
          复制全文
        </button>
      }
    >
      {days.length === 0 && <Empty>还没有什么值得写下来的。</Empty>}
      {days.map((day) => (
        <div key={day} className="mb-4">
          <div className="label mb-1.5">
            第 {day} 天{day < TIME.COLLAPSE_DAY ? ` · D-${TIME.PREP_DAYS - day + 1}` : ''}
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
  const { closeShop, buy } = useGame();
  const loc = LOCATIONS.find((l) => l.id === locationId);
  if (!loc) return null;
  const hasClerk = run.abilities.includes('clerk_network');
  const st = run.locations.find((l) => l.id === locationId);
  const sellable = Object.keys(loc.prices ?? {}) as ResourceId[];

  return (
    <Modal
      title={loc.name}
      subtitle={`物价指数 ${run.world.priceIndex.toFixed(2)} · 存量 ${Math.round(st?.stock ?? 100)}%${
        run.day >= 5 && !hasClerk ? ' · 已限购' : ''
      }`}
      onClose={closeShop}
      width="max-w-2xl"
    >
      {sellable.length === 0 && <Empty>这里不卖东西，只能翻找。</Empty>}
      <div className="space-y-2">
        {sellable.map((res) => {
          const price = Math.max(
            1,
            Math.round(BASE_PRICE[res] * run.world.priceIndex * (loc.prices?.[res] ?? 1) * (hasClerk ? 0.9 : 1)),
          );
          const limit = buyLimit(run, res, hasClerk);
          const amounts = [1, 5, 10, limit].filter((n, i, a) => n <= limit && a.indexOf(n) === i && n > 0);
          return (
            <div key={res} className="panel flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] text-paper">{RES_NAME[res]}</span>
                  <span className="num text-[11.5px] text-amberdim">
                    {price} 元 / {RES_UNIT[res]}
                  </span>
                </div>
                <div className="text-[11px] text-faint">
                  今日可买 {limit} {RES_UNIT[res]} · 现有 {Math.round(run.res[res] * 10) / 10}
                </div>
              </div>
              <div className="flex gap-1">
                {amounts.map((n) => (
                  <button
                    key={n}
                    className="btn px-2 py-1 text-[11px]"
                    disabled={run.res.cash < price * n}
                    onClick={() => buy(locationId, res, n)}
                  >
                    +{n}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
        <span className="label">现金</span>
        <span className="num text-[15px] text-amberhi">{Math.round(run.res.cash)} 元</span>
      </div>
    </Modal>
  );
}
