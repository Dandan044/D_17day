import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './game/copy';
import App from './App';
import { useGame } from './game/store';
import { ErrorBoundary, installGlobalCrashHandlers } from './ui/ErrorBoundary';
import './styles.css';

// 兜底要装在渲染之前：装晚了一步，首屏渲染崩掉就没人接得住。
installGlobalCrashHandlers();

/**
 * DEV-only：把 store 挂到 window 上，好让 `scripts/cdp-shot.mjs` 能在真实页面里
 * 直接 `__game.setState({ run, overlay: 'body' })`，而不是靠一串坐标点击走进浮层。
 *
 * 为什么值得加：`overlay` 不在 persist 的 partialize 里（只存 run/meta/screen/gameUi），
 * 所以「刷新一下就直接落在某个浮层上」这条路走不通。没有这个句柄，验证一屏要脚本
 * 连点五六次热点，脆弱且每次改版都要重写。生产构建里 `import.meta.env.DEV` 为 false，
 * 整段会被 tree-shake 掉。
 */
if (import.meta.env.DEV) {
  (globalThis as unknown as { __game?: unknown }).__game = useGame;
}

const el = document.getElementById('root');
if (!el) throw new Error('#root not found');

createRoot(el).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
