import { useEffect } from 'react';

import { rebuildSettlement, useGame } from './game/store';
import Game from './ui/Game';
import MainMenu from './ui/MainMenu';
import { CodexPanel, MetaPanel } from './ui/Meta';
import SiteSelect from './ui/SiteSelect';
import Setup from './ui/Setup';
import Summary from './ui/Summary';
import { ChoiceResultModal, CollapseScreen, HaulModal, NightReportModal, Toasts } from './ui/modals';
import { CrewPanel, IntelPanel, LogPanel, MapPanel, ShelterPanel, ShopModal } from './ui/panels';

export default function App() {
  const {
    run,
    meta,
    screen,
    overlay,
    nightReport,
    lastChoice,
    haul,
    openShop,
    settlement,
    setOverlay,
    endDay,
    pruneQueue,
  } = useGame();

  /**
   * 自愈二：队列里留着指向已删除家族/变体的条目时，EventCard 会渲染成 null，
   * 而「结束这一天」又被队列长度拦住。进游戏前先清一遍，别让玩家卡死。
   */
  useEffect(() => {
    if (run && run.queue.length > 0) pruneQueue();
  }, [run, pruneQueue]);

  /**
   * 自愈一：settlement 不进存档，但下面的路由依赖它存在。
   * 结算页刷新后会落进「run 已 ended、settlement 为空」的死角——玩家既领不到遗物，
   * 也回不到菜单。这里按 run.endingId 就地重算一份。
   */
  useEffect(() => {
    if (!run || run.phase !== 'ended' || settlement) return;
    const rebuilt = rebuildSettlement(run, meta);
    if (!rebuilt) return;
    useGame.setState({ settlement: rebuilt, screen: 'summary' });
  }, [run, settlement, meta]);

  // 键盘：Esc 关闭浮层，空格推进一天
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const busy = nightReport || lastChoice || haul || openShop;
      if (e.key === 'Escape') {
        if (openShop) useGame.getState().closeShop();
        else if (overlay) setOverlay(null);
        return;
      }
      if (e.key === ' ' && screen === 'game' && !busy && !overlay && run && run.queue.length === 0) {
        e.preventDefault();
        endDay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay, screen, run, nightReport, lastChoice, haul, openShop, setOverlay, endDay]);

  const body = () => {
    if (screen === 'menu') return <MainMenu />;
    if (screen === 'setup') return <Setup />;
    if (screen === 'summary' && settlement) return <Summary />;
    if (!run) return <MainMenu />;
    if (run.phase === 'siteSelect') return <SiteSelect />;
    if (run.phase === 'collapse') return <CollapseScreen run={run} />;
    if (run.phase === 'ended' && settlement) return <Summary />;
    return <Game />;
  };

  return (
    <div className="relative z-10 h-full">
      {body()}

      {/* 浮层 */}
      {run && overlay === 'shelter' && <ShelterPanel run={run} />}
      {run && overlay === 'map' && <MapPanel run={run} />}
      {run && overlay === 'intel' && <IntelPanel run={run} />}
      {run && overlay === 'crew' && <CrewPanel run={run} />}
      {run && overlay === 'log' && <LogPanel run={run} />}
      {overlay === 'meta' && <MetaPanel />}
      {overlay === 'codex' && <CodexPanel />}

      {/* 模态 */}
      {run && openShop && <ShopModal run={run} locationId={openShop} />}
      {run && haul && <HaulModal run={run} />}
      {run && nightReport && <NightReportModal run={run} />}
      <ChoiceResultModal />

      <Toasts />
    </div>
  );
}
