import { Component, useState, type ErrorInfo, type ReactNode } from 'react';

import { buildReport, errText, noteAction, reportCrash, subscribeCrash } from '../game/debug/crashReport';
import { useGame } from '../game/store';

/**
 * 崩溃面板：白屏换成一张能复制的报告。
 *
 * 起因：全站没有任何错误兜底，渲染期或 useEffect 里一个 TypeError 就整页白屏，
 * 玩家手里只剩一个白页面，既看不到原因也没法反馈。
 *
 * 两条入口都要，缺一不可：
 * - 渲染期（含子组件 effect）→ React 的 ErrorBoundary（本组件）；
 * - 点击回调 / 异步里的异常 → window 的 'error' 与 'unhandledrejection'（installGlobalCrashHandlers），
 *   经 reportCrash 广播到这里；React 树那时通常还活着，所以同一个面板能用。
 *
 * 面板**不改任何游戏状态、不做静默降级**——它只负责把错误说清楚，
 * 缺字段该补的地方去补，别把真 bug 藏起来。
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown; source: string }> {
  state: { error: unknown; source: string } = { error: null, source: '' };

  private unsubscribe: (() => void) | null = null;

  static getDerivedStateFromError(error: unknown): { error: unknown; source: string } {
    return { error, source: '渲染期' };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    // 只记日志，不 setState（避免二次崩溃循环）
    console.error('[七日之前] 渲染崩溃：', error, info.componentStack);
    noteAction(`渲染崩溃 ${errText(error)}`);
  }

  componentDidMount(): void {
    this.unsubscribe = subscribeCrash(({ error, source }) => this.setState({ error, source }));
  }

  componentWillUnmount(): void {
    this.unsubscribe?.();
  }

  private reset = (): void => {
    this.setState({ error: null, source: '' });
  };

  render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    return <CrashPanel error={this.state.error} source={this.state.source} onDismiss={this.reset} />;
  }
}

/**
 * 全局兜底：window 的 error / unhandledrejection 都送进同一个面板。
 *
 * 注意区分两类 'error' 事件：脚本抛错（ErrorEvent，带 error/message）要接住；
 * **资源加载失败**（`<img>` 404、字体挂掉）也会触发同名事件，但它既没有 error
 * 也没有 message——那种误报一张全屏崩溃面板比不报更糟，直接放过。
 */
export function installGlobalCrashHandlers(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => {
    if (!e.error && !e.message) return;
    reportCrash(e.error ?? e.message, 'window.onerror');
  });
  window.addEventListener('unhandledrejection', (e) => reportCrash(e.reason, 'unhandledrejection'));
}

// ============================================================
// 面板本体（内联样式：此时设计系统的样式表可能都没加载好，
// 而且两套皮肤共用它，不能依赖任何一套的 CSS）
// ============================================================

const S = {
  veil: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: '#14161a',
    color: '#e8e4dc',
    font: '13px/1.6 ui-monospace, Consolas, "Cascadia Mono", monospace',
    padding: '24px 28px',
    overflow: 'auto',
  },
  h1: { fontSize: '16px', margin: '0 0 4px', color: '#e8b46a' },
  sub: { margin: '0 0 16px', color: '#8b8578' },
  block: { margin: '0 0 14px' },
  label: { color: '#8b8578', marginBottom: '4px' },
  pre: {
    margin: 0,
    padding: '10px 12px',
    background: '#1c1f24',
    border: '1px solid #2b2f36',
    borderRadius: '4px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '30vh',
    overflow: 'auto',
  },
  warn: { color: '#e0736a' },
  bar: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '12px' },
  btn: {
    padding: '7px 14px',
    background: '#262a31',
    color: '#e8e4dc',
    border: '1px solid #3a3f48',
    borderRadius: '4px',
    font: 'inherit',
    cursor: 'pointer',
  },
  ok: { color: '#7fb069' },
} as const;

function CrashPanel({ error, source, onDismiss }: { error: unknown; source: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const report = buildReport(error, source, currentRun());

  const goMenu = () => {
    try {
      useGame.setState({ screen: 'menu', overlay: null });
    } catch (e) {
      console.error(e);
    }
    onDismiss();
  };

  return (
    <div style={S.veil} role="alertdialog" aria-label="游戏出错了">
      <h1 style={S.h1}>游戏出错了</h1>
      <p style={S.sub}>这一步没能完成。下面的报告整段复制发给我即可，里面有当时的进度和最近的操作。</p>

      <div style={S.block}>
        <div style={S.label}>错误</div>
        <pre style={{ ...S.pre, ...S.warn, maxHeight: 'none' }}>{errText(error)}</pre>
      </div>

      <div style={S.block}>
        <div style={S.label}>完整报告（点一下会自动全选）</div>
        <textarea
          readOnly
          value={report}
          spellCheck={false}
          onFocus={(e) => e.currentTarget.select()}
          style={{ ...S.pre, width: '100%', height: '34vh', boxSizing: 'border-box', resize: 'vertical' }}
        />
      </div>

      <div style={S.bar}>
        <button
          type="button"
          style={S.btn}
          onClick={() => {
            void copyText(report).then((ok) => {
              if (!ok) return;
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            });
          }}
        >
          复制报告
        </button>
        <button type="button" style={S.btn} onClick={goMenu}>
          回到主菜单
        </button>
        <button type="button" style={S.btn} onClick={() => location.reload()}>
          重新加载页面
        </button>
        {copied && <span style={S.ok}>已复制</span>}
      </div>
    </div>
  );
}

/** 取当前 run 用做体检；store 起不来也不能让面板自己再炸一次 */
function currentRun(): unknown {
  try {
    return useGame.getState().run;
  } catch {
    return undefined;
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false; // 上面那个 textarea 就是退路：点一下自动全选
  }
}
