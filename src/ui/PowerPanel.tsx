import { COLD, POWER, TIME } from '../game/balance';
import { MODULE_IDS } from '../game/content/modules';
import { WEATHER_NAME } from '../game/engine/world';
import { canElectricHeat, canFuelHeat, heatGap } from '../game/engine/climate';
import {
  LOAD_NAME,
  computePower,
  loadWanted,
  mergedPriority,
  potentialDrawKwh,
} from '../game/engine/power';
import { useGame } from '../game/store';
import type { ModuleId, PowerLoadId, RunState } from '../game/types';
import { Chip, Modal, SectionLabel } from './kit';

export function PowerPanel({ run }: { run: RunState }) {
  const { setOverlay, setPowerPriority, togglePowerLoad } = useGame();
  const power = computePower(run);
  const order = mergedPriority(run).filter((id) => {
    if (id === 'lights' || id === 'fridge') return true;
    if (id === 'heater') return (run.heatMode ?? 'off') === 'electric' && canElectricHeat(run);
    if ((MODULE_IDS as readonly string[]).includes(id)) {
      const level = run.modules[id as ModuleId] ?? 0;
      if (level <= 0) return false;
      return potentialDrawKwh(run, id) > 0;
    }
    return false;
  });
  const isPrep = run.day < TIME.COLLAPSE_DAY;
  const disasterName = run.world.disaster === 'nuclear' ? '核沉降' : '灾难';

  const move = (id: PowerLoadId, dir: -1 | 1) => {
    const full = mergedPriority(run);
    const i = full.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= full.length) return;
    const next = full.slice();
    const a = next[i]!;
    next[i] = next[j]!;
    next[j] = a;
    setPowerPriority(next);
  };

  return (
    <Modal
      title="供电优先级"
      subtitle="关掉或往后排就是省电。光伏随天气走，柴油机只补缺口。"
      onClose={() => setOverlay(null)}
      width="max-w-2xl"
    >
      <div className="mb-3 border-l-2 border-line2 bg-ink px-3 py-2 text-[12px] leading-relaxed text-dim">
        {isPrep && (
          <div className="mb-1 text-safehi">市电充足：今晚不会因缺电停摆（自己拆线路除外）。</div>
        )}
        <div>
          光伏 {power.solarBase.toFixed(1)} × {WEATHER_NAME[run.world.weather]} {power.weatherMult.toFixed(2)}
          {!isPrep && power.disasterMult !== 1 ? ` × ${disasterName} ${power.disasterMult.toFixed(2)}` : ''}
          {' = '}
          <span className="num text-paper">{power.solar.toFixed(2)} kWh</span>
        </div>
        {power.grid > 0 && <div>市电 +{power.grid.toFixed(1)} kWh</div>}
        {run.modules.power >= 3 ? (
          <div>
            {power.generator > 0
              ? `柴油机补 ${power.generator.toFixed(1)} kWh / 烧 ${power.fuelBurn.toFixed(1)} L`
              : '柴油机待命：光伏够用就不转'}
          </div>
        ) : (
          <div className="text-faint">发电未到 3 级，柴油机不开</div>
        )}
        <div className="mt-1">
          今晚可用 <span className="num text-paper">{power.output.toFixed(1)}</span> / 想开着的负荷{' '}
          <span className="num text-paper">{power.demand.toFixed(1)}</span> kWh
        </div>
      </div>

      <SectionLabel>负荷表（越靠上越优先保电）</SectionLabel>
      <div className="space-y-1.5">
        {order.map((id, idx) => {
          const draw = power.draws.find((d) => d.id === id);
          let kwh = draw?.kwh ?? potentialDrawKwh(run, id);
          if (id === 'heater' && !draw) {
            kwh = heatGap(run) * (COLD.ELECTRIC_PER_DEGREE[run.modules.insulate] ?? 0);
          }
          if (kwh <= 0) {
            if (id === 'lights') kwh = POWER.LIGHTS_KWH;
            else if (id === 'fridge') kwh = POWER.FRIDGE_KWH;
          }
          const wanted = loadWanted(run, id);
          const online = wanted && !power.offline.includes(id);
          return (
            <div key={id} className="panel flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="num w-5 text-[11px] text-faint">{idx + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[13px] text-paper">{LOAD_NAME[id]}</span>
                  <span className="num text-[11px] text-dim">{kwh.toFixed(2)} kWh</span>
                  {wanted ? (
                    <Chip tone={online ? 'good' : 'bad'}>{online ? '今晚有电' : '今晚会停'}</Chip>
                  ) : (
                    <Chip>已关掉</Chip>
                  )}
                </div>
                {id === 'lights' && (
                  <div className="text-[11px] text-faint">开着漏光加暴露；关掉理智夜间 −6</div>
                )}
                {id === 'fridge' && <div className="text-[11px] text-faint">关掉则生鲜腐败加快</div>}
                {id === 'heater' && <div className="text-[11px] text-faint">电热：把室内往 {COLD.TARGET}°C 推</div>}
                {id === 'airFilter' && <div className="text-[11px] text-faint">停摆时辐射屏蔽按 0 级计</div>}
                {id === 'radio' && <div className="text-[11px] text-faint">没电则情报和预报不准</div>}
              </div>
              <div className="flex shrink-0 gap-1">
                <button className="btn btn-ghost px-2 py-0.5 text-[10px]" disabled={idx === 0} onClick={() => move(id, -1)}>
                  上
                </button>
                <button
                  className="btn btn-ghost px-2 py-0.5 text-[10px]"
                  disabled={idx === order.length - 1}
                  onClick={() => move(id, 1)}
                >
                  下
                </button>
                <button
                  className={`btn px-2 py-0.5 text-[10px] ${wanted ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => togglePowerLoad(id, !wanted)}
                >
                  {wanted ? '开' : '关'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {canFuelHeat(run) && (run.heatMode ?? 'off') !== 'electric' && (
        <p className="mt-3 text-[11.5px] leading-snug text-faint">
          电热一行只在取暖策略选「电热」时出现。现在烧油或不开取暖，不占电力配额。
        </p>
      )}
    </Modal>
  );
}
