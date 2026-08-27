import { useEffect } from 'react';

import { useGame } from './game/store';
import Game from './ui/Game';
import MainMenu from './ui/MainMenu';
import { CodexPanel, MetaPanel } from './ui/Meta';
import SiteSelect from './ui/SiteSelect';
import Setup from './ui/Setup';
import Summary from './ui/Summary';
import { ChoiceResultModal, CollapseScreen, HaulModal, NightReportModal, Toasts } from './ui/modals';
import { CrewPanel, IntelPanel, LogPanel, MapPanel, ShelterPanel, ShopModal } from './ui/panels';

export default function App() {
  const { run, screen, overlay, nightReport, lastChoice, haul, openShop, settlement, setOverlay, endDay } = useGame();

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
