import { COLD, RAD, THREAT_DESC, TIME } from '../game/balance';
import { CONDITION_BY_ID } from '../game/content/conditions';
import { DISASTER_BY_ID } from '../game/content/disasters';
import { RES_NAME, RES_UNIT } from '../game/content/locations';
import { MODULES } from '../game/content/modules';
import { SITE_BY_ID } from '../game/content/sites';
import { canElectricHeat, canFuelHeat } from '../game/engine/climate';
import { dailyNeeds } from '../game/engine/economy';
import { dailyExposure, exposureTier, TIER_DESC, TIER_NAMES } from '../game/engine/exposure';
import { previewIndoor } from '../game/engine/health';
import { LOAD_NAME } from '../game/engine/power';
import { computePower, effectiveModule, iodineActive, radiationShield, threatName, waterCapacity } from '../game/engine/tags';
import { WEATHER_DESC, WEATHER_NAME } from '../game/engine/world';
import { formatSeed } from '../game/rng';
import { useGame } from '../game/store';
import type { HeatMode, ModuleId, ResourceId, RunState } from '../game/types';
import EventCard from './EventCard';
import { Bar, Chip, Gauge, Panel, SectionLabel, Stat } from './kit';

const RES_ORDER: ResourceId[] = [
  'water',
  'foodStaple',
  'foodFresh',
  'meds',
  'fuel',
  'materials',
  'parts',
  'ammo',
  'cash',
];

export default function Game() {
  const { run } = useGame();
  if (!run) return null;
  const isPrep = run.day < TIME.COLLAPSE_DAY;

  return (
    <div className="flex h-full flex-col">
      <DayHeader run={run} />
      <div className="scroll-y flex-1 p-3 sm:p-4">
        <div className="mx-auto grid max-w-[1500px] gap-3 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
          <div className="space-y-3 xl:order-1">
            <BodyPanel run={run} />
            <RationPanel run={run} />
          </div>
          <div className="space-y-3 xl:order-2">
            {run.queue.length > 0 ? <EventCard run={run} /> : <ActionsPanel run={run} isPrep={isPrep} />}
            {run.queue.length > 0 && (
              <div className="panel p-3 text-[12px] leading-snug text-faint">
                得先把眼前的事处理完，才能安排今天要干什么。
              </div>
            )}
          </div>
          <div className="space-y-3 xl:order-3">
            <SuppliesPanel run={run} />
            <ShelterSummary run={run} />
            {!isPrep && <ExposurePanel run={run} />}
          </div>
        </div>
      </div>
      <FooterBar run={run} />
    </div>
  );
}

// ============================================================
// 顶栏
// ============================================================

function DayHeader({ run }: { run: RunState }) {
  const { setOverlay } = useGame();
  const isPrep = run.day < TIME.COLLAPSE_DAY;
  const site = SITE_BY_ID[run.siteId ?? 'apartment'];
  const indoor = previewIndoor(run);
  const disaster = DISASTER_BY_ID[run.world.disaster];
  const shield = radiationShield(run);
  const tol = RAD.SHIELD_TOLERANCE[shield] ?? RAD.SHIELD_TOLERANCE[0]!;
  const power = computePower(run);
  const airLv = run.modules.airFilter;
  const airEff = effectiveModule(run, 'airFilter', power);

  return (
    <div className="shrink-0 border-b border-line bg-panel/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2 sm:px-4">
        {/* 天数 */}
        <div className="flex items-baseline gap-2">
          <span className="label">{isPrep ? '倒计时' : '第'}</span>
          <span className="num text-2xl font-bold leading-none text-amberhi">
            {isPrep ? `D-${TIME.PREP_DAYS - run.day + 1}` : run.day}
          </span>
          {!isPrep && <span className="label">天</span>}
        </div>

        <div className="h-6 w-px bg-line" />

        {/* 阶段 */}
        <div className="min-w-0">
          <div className="label">{isPrep ? '状态' : `末世等级 ${run.threat}`}</div>
          <div className="truncate text-[12.5px] text-paper">
            {isPrep ? '灾难尚未到来' : threatName(run.threat)}
          </div>
        </div>

        {/* 天气 */}
        <div>
          <div className="label">天候</div>
          <div className="text-[12.5px] text-paper" title={WEATHER_DESC[run.world.weather]}>
            {WEATHER_NAME[run.world.weather]} ·{' '}
            <span className="num">
              室外 {run.world.temperature}°C / 室内 {indoor.indoor}°C（目标 {COLD.TARGET}）
            </span>
          </div>
        </div>

        {/* 环境 */}
        {!isPrep && (
          <div className="hidden sm:block">
            <div className="label">环境</div>
            <div className="flex flex-wrap gap-1.5">
              {run.world.radiation > 8 && (
                <Chip tone={run.world.radiation > tol ? 'bad' : 'warn'}>
                  辐射 {Math.round(run.world.radiation)} / 可挡 {tol}
                </Chip>
              )}
              {airLv > 0 && airEff === 0 && <Chip tone="bad">过滤停摆，按 0 级计</Chip>}
              {iodineActive(run) && <Chip tone="good">碘片保护中</Chip>}
              {run.world.airPollution > 30 && <Chip tone="warn">空气 {Math.round(run.world.airPollution)}</Chip>}
              {run.world.contagion > 20 && <Chip tone="psyche">疫情 {Math.round(run.world.contagion)}</Chip>}
              {run.world.lawOrder < 45 && <Chip tone="bad">秩序 {Math.round(run.world.lawOrder)}</Chip>}
            </div>
          </div>
        )}

        {/* 灾难 */}
        {run.world.revealed && (
          <div className="hidden md:block">
            <div className="label">灾难</div>
            <div className="text-[12.5px] text-alarmhi">{disaster.name}</div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          {/* 行动点 */}
          <div className="text-right">
            <div className="label">行动点</div>
            <div className="flex justify-end gap-1">
              {Array.from({ length: run.apMax }).map((_, i) => (
                <span
                  key={i}
                  className="h-3.5 w-2.5"
                  style={{ background: i < run.ap ? 'var(--color-amber)' : 'var(--color-line)' }}
                />
              ))}
            </div>
          </div>

          <div className="h-6 w-px bg-line" />

          <div className="flex flex-wrap gap-1.5">
            <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={() => setOverlay('shelter')}>
              避难所
            </button>
            <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={() => setOverlay('power')}>
              供电
            </button>
            <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={() => setOverlay('map')}>
              {isPrep ? '采购' : '外出'}
            </button>
            <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={() => setOverlay('intel')}>
              情报
            </button>
            <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={() => setOverlay('log')}>
              日记
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1500px] items-center gap-2 px-3 pb-1.5 text-[11px] text-faint sm:px-4">
        <span className="truncate">
          {site.name} · {isPrep ? '自来水与超市仍在运转' : THREAT_DESC[run.threat]}
        </span>
        <span className="ml-auto num shrink-0 text-amberdim/70">{formatSeed(run.seed)}</span>
      </div>
    </div>
  );
}

// ============================================================
// 身体状况
// ============================================================

function BodyPanel({ run }: { run: RunState }) {
  const { treat } = useGame();
  return (
    <Panel title="身体状况" mark>
      <div className="space-y-2.5">
        <Gauge label="生命" value={run.stats.hp} tone="hp" />
        <Gauge label="体力" value={run.stats.stamina} tone="stamina" />
        <Gauge label="理智" value={run.stats.sanity} tone="sanity" />
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Gauge label="人性" value={run.stats.humanity} tone="humanity" />
          <Gauge label="名声" value={run.stats.reputation} tone="reputation" />
        </div>
      </div>

      {run.conditions.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <SectionLabel>需要处理</SectionLabel>
          <div className="space-y-1.5">
            {run.conditions.map((c) => {
              const def = CONDITION_BY_ID[c];
              const canTreat = !!def.medsCure;
              return (
                <div key={c} className="border-l-2 border-alarmdim bg-alarm/5 px-2 py-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] text-alarmhi">{def.name}</span>
                    {canTreat && (
                      <button
                        className="btn btn-ghost px-1.5 py-0 text-[10px]"
                        onClick={() => treat(c)}
                        title={`消耗 ${def.medsCure} 组药品${def.needsMedbay ? ` + ${def.needsMedbay} 级医疗站` : ''}`}
                      >
                        用药 {def.medsCure}
                      </button>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-faint">
                    {def.desc}
                    {canTreat ? ' 用药只解除状态，不回生命。' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {effectiveModule(run, 'medbay') > 0 && (
        <p className="mt-3 border-t border-line pt-2 text-[11.5px] leading-snug text-faint">
          医疗站减轻病情损耗。治疗只解除状态，不额外回血。
        </p>
      )}
    </Panel>
  );
}

// ============================================================
// 配给
// ============================================================

function RationPanel({ run }: { run: RunState }) {
  const { setRation, setWaterUse, setHeatMode, setOverlay } = useGame();
  const isPrep = run.day < TIME.COLLAPSE_DAY;
  const needs = dailyNeeds(run, run.difficulty);
  const power = computePower(run);
  const indoor = previewIndoor(run);
  const heat = run.heatMode ?? 'off';
  const gap = Math.max(0, COLD.TARGET - indoor.unheated);

  if (isPrep) {
    return (
      <Panel title="今日安排" mark>
        <p className="text-[12px] leading-relaxed text-faint">
          自来水还在供，超市还开着门。配给制度从灾难降临的那天开始生效。
        </p>
        <div className="mt-3 border-t border-line pt-2">
          <Stat label="家里现在有几个人" value={needs.heads} />
          <Stat label="每人每日需水" value="约 3 L" />
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="配给、取暖与用电" mark>
      <div className="space-y-3">
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="label">口粮</span>
            <span className="num text-[11.5px] text-dim">需 {needs.food} 份</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {(['full', 'normal', 'half', 'none'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRation(r)}
                className={`btn px-1 py-1 text-[11px] ${run.ration === r ? 'btn-primary' : 'btn-ghost'}`}
              >
                {{ full: '充足', normal: '标准', half: '减半', none: '断粮' }[r]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="label">用水</span>
            <span className="num text-[11.5px] text-dim">需 {needs.water} L</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(['full', 'normal', 'limited'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setWaterUse(r)}
                className={`btn px-1 py-1 text-[11px] ${run.waterUse === r ? 'btn-primary' : 'btn-ghost'}`}
              >
                {{ full: '充足', normal: '标准', limited: '限量' }[r]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="label">取暖 · 目标 {COLD.TARGET}°C</span>
            <span className="num text-[11.5px] text-dim">
              室内 {indoor.indoor}°C
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(['off', 'fuel', 'electric'] as HeatMode[]).map((m) => {
              const locked = (m === 'fuel' && !canFuelHeat(run)) || (m === 'electric' && !canElectricHeat(run));
              return (
                <button
                  key={m}
                  disabled={locked}
                  onClick={() => setHeatMode(m)}
                  className={`btn px-1 py-1 text-[11px] ${heat === m ? 'btn-primary' : 'btn-ghost'}`}
                  title={
                    locked
                      ? m === 'fuel'
                        ? '保温 1 级解锁烧燃料'
                        : '保温 2 级且发电 1 级解锁电热'
                      : undefined
                  }
                >
                  {{ off: '不取暖', fuel: '烧燃料', electric: '电热' }[m]}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-faint">
            {heat === 'off' && `不加热。室外体感 ${indoor.unheated}°C。`}
            {heat === 'fuel' &&
              (gap > 0
                ? `差 ${gap.toFixed(0)}°C，预计 ${indoor.fuelCost.toFixed(1)} L 油${run.res.fuel < indoor.fuelCost ? '（油不够会按比例升温）' : ''}`
                : '已经够暖，今晚不耗油。')}
            {heat === 'electric' &&
              (gap > 0
                ? `差 ${gap.toFixed(0)}°C，预计 ${indoor.kwh.toFixed(1)} kWh，与灯光/冰箱抢配额`
                : '已经够暖，电热不转。')}
          </p>
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="label">供电</span>
            <span className="num text-[11.5px] text-dim">
              {power.output.toFixed(1)} / {power.demand.toFixed(1)} kWh
            </span>
          </div>
          <button className="btn btn-ghost w-full py-1.5 text-[11.5px]" onClick={() => setOverlay('power')}>
            家电优先级 · 关灯/冰箱/电热
          </button>
          <p className="mt-1.5 text-[11px] leading-snug text-faint">
            光伏 {power.solar.toFixed(1)}（{WEATHER_NAME[run.world.weather]} ×{power.weatherMult.toFixed(2)}
            {power.disasterMult !== 1 ? ` ×核沉降 ${power.disasterMult.toFixed(2)}` : ''}）
            {power.generator > 0 ? ` · 柴油机补 ${power.generator.toFixed(1)}` : ''}
          </p>
          {power.offline.length > 0 && (
            <div className="mt-1.5 text-[11px] leading-snug text-alarmhi">
              电力不足，已停摆：{power.offline.map((m) => LOAD_NAME[m] ?? m).join('、')}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ============================================================
// 行动
// ============================================================

function ActionsPanel({ run, isPrep }: { run: RunState; isPrep: boolean }) {
  const { setOverlay, rest } = useGame();
  const noAp = run.ap <= 0;

  const actions = [
    {
      id: 'out',
      title: isPrep ? '出门采购' : '外出搜刮',
      desc: isPrep
        ? '超市、五金店、药店、加油站、旧货市场。物价每天都在涨，限购是真的，货架会空。'
        : '外面还剩下的东西越来越少。危险会变成暴露，夜里更高。燃料或体力不够就出不去。',
      ap: 1,
      onClick: () => setOverlay('map'),
    },
    {
      id: 'build',
      title: '避难所工程',
      desc: '自己动手、雇人、或者买成品。施工中的模块处于劣化状态——挑对时机很重要。',
      ap: 1,
      onClick: () => setOverlay('shelter'),
    },
    {
      id: 'intel',
      title: isPrep ? '分析情报' : '收听无线电',
      desc: isPrep
        ? '每天三条消息，真假混杂。你要靠它们猜出七天后会来的是什么。'
        : '外面还在广播什么，谁还活着，往哪走。',
      ap: 0,
      onClick: () => setOverlay('intel'),
    },
    {
      id: 'rest',
      title: '休息',
      desc: '恢复体力和一点理智。不回生命。有时候什么都不做是正确的选择。',
      ap: 1,
      onClick: rest,
    },
  ];

  return (
    <Panel title="今天做什么" mark right={<span className="text-faint">剩 {run.ap} 行动点</span>}>
      <div className="space-y-2">
        {actions.map((a) => (
          <button
            key={a.id}
            className="choice"
            disabled={a.ap > 0 && noAp}
            onClick={a.onClick}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-paper">{a.title}</span>
              {a.ap > 0 ? <Chip tone="warn">{a.ap} AP</Chip> : <Chip>免费</Chip>}
            </div>
            <div className="mt-1 text-[12px] leading-snug text-faint">{a.desc}</div>
          </button>
        ))}
      </div>
      {noAp && (
        <p className="mt-3 border-t border-line pt-3 text-[12px] leading-snug text-amberhi">
          今天的时间用完了。结束这一天，看看夜里会发生什么。
        </p>
      )}
    </Panel>
  );
}

// ============================================================
// 物资
// ============================================================

function SuppliesPanel({ run }: { run: RunState }) {
  const waterCap = waterCapacity(run);
  const needs = dailyNeeds(run, run.difficulty);
  const daysOfWater = needs.water > 0 ? run.res.water / needs.water : 99;
  const daysOfFood = needs.food > 0 ? (run.res.foodStaple + run.res.foodFresh) / needs.food : 99;
  const isPrep = run.day < TIME.COLLAPSE_DAY;

  return (
    <Panel
      title="物资"
      mark
      right={
        !isPrep ? (
          <span className="text-faint">
            水 {daysOfWater < 90 ? `${daysOfWater.toFixed(1)} 天` : '—'} · 粮{' '}
            {daysOfFood < 90 ? `${daysOfFood.toFixed(1)} 天` : '—'}
          </span>
        ) : undefined
      }
    >
      <div className="space-y-1">
        {RES_ORDER.map((r) => {
          const v = run.res[r];
          const isWater = r === 'water';
          const low = !isPrep && ((isWater && daysOfWater < 3) || (r === 'foodStaple' && daysOfFood < 3));
          return (
            <div key={r}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="label">{RES_NAME[r]}</span>
                <span className={`num text-[12.5px] ${low ? 'text-alarmhi' : 'text-paper'}`}>
                  {r === 'cash' ? Math.round(v) : Math.round(v * 10) / 10}
                  <span className="ml-0.5 text-[10px] text-faint">{RES_UNIT[r]}</span>
                </span>
              </div>
              {isWater && (
                <div className="mt-0.5">
                  <Bar value={v} max={waterCap} tone={daysOfWater < 3 ? 'bad' : 'info'} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 border-t border-line pt-2 text-[11px] leading-snug text-faint">
        储水上限 {waterCap} L
        {run.res.foodFresh > 0 && ` · 生鲜每天会腐败一部分，先吃它`}
      </div>
    </Panel>
  );
}

// ============================================================
// 避难所摘要
// ============================================================

function ShelterSummary({ run }: { run: RunState }) {
  const { setOverlay } = useGame();
  const power = computePower(run);
  return (
    <Panel
      title="避难所"
      mark
      right={
        <button className="btn btn-ghost px-1.5 py-0 text-[10px]" onClick={() => setOverlay('shelter')}>
          管理
        </button>
      }
    >
      <div className="grid grid-cols-5 gap-1.5">
        {MODULES.map((m) => {
          const level = run.modules[m.id as ModuleId];
          const eff = effectiveModule(run, m.id as ModuleId, power);
          const building = run.projects.some((p) => p.moduleId === m.id);
          return (
            <div
              key={m.id}
              className="text-center"
              title={`${m.name} ${level} 级${building ? '（施工中，当前失效）' : eff < level ? '（停摆）' : ''}`}
            >
              <div
                className="mx-auto flex h-7 w-7 items-center justify-center border text-[11px]"
                style={{
                  borderColor: building ? 'var(--color-amber)' : eff > 0 ? 'var(--color-line2)' : 'var(--color-line)',
                  background: eff > 0 ? 'rgba(63,158,107,0.12)' : 'transparent',
                  color: building ? 'var(--color-amberhi)' : eff > 0 ? 'var(--color-safehi)' : 'var(--color-faint)',
                }}
              >
                {m.short}
              </div>
              <div className="num mt-0.5 text-[10px] text-dim">
                {building ? '施工' : eff < level ? `${level}!` : level}
              </div>
            </div>
          );
        })}
      </div>

      {run.projects.length > 0 && (
        <div className="mt-3 border-t border-line pt-2">
          <SectionLabel>施工队列</SectionLabel>
          {run.projects.map((p) => {
            const def = MODULES.find((m) => m.id === p.moduleId)!;
            const pct = p.laborTotal > 0 ? (p.laborDone / p.laborTotal) * 100 : 0;
            return (
              <div key={p.moduleId} className="mb-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] text-paper">
                    {def.name} → {p.toLevel}
                  </span>
                  <span className="num text-[11px] text-faint">
                    {p.path === 'diy'
                      ? `${p.laborDone}/${p.laborTotal} 工时`
                      : p.path === 'buy'
                        ? `第 ${p.etaDay} 天到货`
                        : `第 ${p.etaDay} 天完工`}
                  </span>
                </div>
                <div className="mt-0.5">
                  <Bar value={p.path === 'diy' ? pct : 50} tone="warn" />
                </div>
                <div className="mt-0.5 text-[10.5px] leading-snug text-alarmhi/80">{def.buildPenaltyDesc}</div>
              </div>
            );
          })}
        </div>
      )}

      {run.wear.filterLife <= 5 && (run.modules.filter > 0 || run.modules.airFilter > 0) && (
        <div className="mt-2 border-t border-line pt-2 text-[11.5px] text-alarmhi">
          滤芯还能用 {Math.max(0, run.wear.filterLife)} 天。用尽后净水与空气过滤会直接失效。
        </div>
      )}
    </Panel>
  );
}

// ============================================================
// 暴露度
// ============================================================

function ExposurePanel({ run }: { run: RunState }) {
  const tier = exposureTier(run.world.exposure);
  const breakdown = dailyExposure(run);
  const tones = ['good', 'info', 'warn', 'bad', 'bad'] as const;

  return (
    <Panel title="暴露度" mark right={<Chip tone={tones[tier]}>{TIER_NAMES[tier]}</Chip>}>
      <Bar value={run.world.exposure} tone={tones[tier]} />
      <p className="mt-2 text-[12px] leading-snug text-dim">{TIER_DESC[tier]}</p>

      <div className="mt-3 border-t border-line pt-2">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="label">今夜将累积</span>
          <span className={`num text-[12.5px] ${breakdown.total > 0 ? 'text-alarmhi' : 'text-safehi'}`}>
            {breakdown.total > 0 ? '+' : ''}
            {breakdown.total}
          </span>
        </div>
        <div className="space-y-0.5">
          {breakdown.parts.map((p, i) => (
            <div key={i} className="flex items-baseline justify-between gap-2 text-[11.5px]">
              <span className="text-faint">{p.label}</span>
              <span className={`num ${p.value > 0 ? 'text-alarmhi/80' : 'text-safehi/80'}`}>
                {p.value > 0 ? '+' : ''}
                {Math.round(p.value * 10) / 10}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ============================================================
// 底栏
// ============================================================

function FooterBar({ run }: { run: RunState }) {
  const { endDay, goMenu } = useGame();
  const blocked = run.queue.length > 0;
  return (
    <div className="shrink-0 border-t border-line bg-panel/90 px-3 py-2 backdrop-blur sm:px-4">
      <div className="mx-auto flex max-w-[1500px] items-center gap-3">
        <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={goMenu}>
          菜单
        </button>
        <div className="flex-1 truncate text-[11.5px] text-faint">
          {blocked
            ? '还有事情等着你处理。'
            : run.ap > 0
              ? `还剩 ${run.ap} 个行动点没用。`
              : '今天没有时间了。'}
        </div>
        <button className="btn btn-primary px-5 py-2" disabled={blocked} onClick={endDay}>
          结束这一天
        </button>
      </div>
    </div>
  );
}
