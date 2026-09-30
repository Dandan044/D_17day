/**
 * CDP 截图器：在真实页面里造一个存档、打开某个浮层、截图。
 *
 * 为什么不用 playwright：本仓 `node_modules` 里没有它（只有 react/zustand/vite/tsx），
 * 而 Node 22 自带全局 `WebSocket`，直连 Chrome DevTools 协议就够用了——零新增依赖。
 *
 * ## 用法
 *
 *   node scripts/cdp-shot.mjs --url http://127.0.0.1:5199/ \
 *     --save .preview/save-body.json \
 *     --setup "setState({overlay:'body'})" \
 *     --out .preview/browser/art-body-body.png
 *
 * - `--save`：可选的存档 JSON（`{ run, meta }`，由 `scripts/mk-save.tsx` 生成）。
 *   有它就先跳到页面、写进 localStorage、再 reload；没有就直接开 `--url`。
 * - `--setup`：reload 之后要在页面里执行的 JS 片段，`__game` 已就绪。
 *   写 `setState({...})` 这种简写即可（会被包成 `__game.setState({...})`）。
 * - `--wait`：reload/setup 之后额外等待的毫秒数（默认 900），用来等浮层入场动画走完。
 *
 * ## 硬约束
 *
 * - **必须等 `__game` 出现**再去 setState，否则报 `Cannot read properties of undefined`。
 *   页面加载完 ≠ store 挂上（React 首次渲染之后才轮到 main.tsx 那段），所以这里轮询。
 * - `overlay` 不在 persist 的 partialize 里，所以它只能靠 `--setup` 在**刷新后**设置，
 *   写进存档 JSON 是没用的。
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));
if (!CHROME) throw new Error('找不到 Chrome / Edge');

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const URL_ = arg('url', 'http://127.0.0.1:5199/');
const SAVE = arg('save', null);
const SETUP = arg('setup', null);
const OUT = arg('out', null);
const WAIT = Number(arg('wait', '900'));
const W = Number(arg('w', '1400'));
const H = Number(arg('h', '1000'));

const SAVE_KEY = 'seven-days-save-v1';
const SAVE_VERSION = 6;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = join(tmpdir(), `cdp-shot-${process.pid}`);
const port = 9200 + (process.pid % 700);

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${W},${H}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

/** 轮询 /json/list 直到出现页面 target。 */
async function pageTarget() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* 还没起来 */
    }
    await sleep(150);
  }
  throw new Error('Chrome 调试端口没起来');
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = (this.id += 1);
    return new Promise((resolve_, reject) => {
      this.pending.set(id, { resolve: resolve_, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  /** 求值并返回 JSON 结果；表达式抛错就原样抛出来，别让错误静默变成 undefined。 */
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error(`页面内求值失败：${r.exceptionDetails.exception?.description ?? '未知'}`);
    }
    return r.result.value;
  }
  async navigate(url) {
    const done = new Promise((r) => {
      const on = (e) => {
        const m = JSON.parse(e.data);
        if (m.method === 'Page.loadEventFired') {
          this.ws.removeEventListener('message', on);
          r();
        }
      };
      this.ws.addEventListener('message', on);
    });
    await this.send('Page.navigate', { url });
    await done;
  }
  /** 等 `__game` 出现在 window 上（React 首渲染之后才轮到 main.tsx 那段赋值）。 */
  async waitGame(timeoutMs = 12000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (await this.eval('!!(globalThis.__game && globalThis.__game.setState)')) return;
      await sleep(120);
    }
    throw new Error('等不到 __game（dev 构建才有，确认 vite 跑的是 dev 而不是 preview）');
  }
}

async function main() {
  const page = await pageTarget();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener('open', r);
    ws.addEventListener('error', j);
  });
  const cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: W,
    height: H,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // 1) 先落到目标 origin，才写得了这个 origin 的 localStorage
  await cdp.navigate(URL_);

  if (SAVE) {
    const raw = JSON.parse(readFileSync(resolve(SAVE), 'utf8'));
    const payload = JSON.stringify({
      state: { run: raw.run, meta: raw.meta, screen: 'game', gameUi: 'art' },
      version: SAVE_VERSION,
    });
    await cdp.eval(
      `localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(payload)}); 'seeded'`,
    );
    await cdp.navigate(URL_);
  }

  await cdp.waitGame();

  if (SETUP) {
    // `setState({...})` 是脚本里最好写的简写；不是这个形状就当成完整表达式跑。
    const expr = /^setState\(/.test(SETUP.trim()) ? `__game.${SETUP}` : `(() => { ${SETUP} })()`;
    await cdp.eval(expr);
  }

  await sleep(WAIT);

  // 崩溃兜底：渲染期抛错会被 ErrorBoundary 接住，截出来是一张白屏。
  // 这里顺手把页面文本捞回来，好在图之外还有一份可判读的证据。
  const crash = await cdp.eval(
    `(() => { const b = document.body.innerText || ''; return b.includes('出错了') || b.includes('ErrorBoundary') ? b.slice(0, 400) : ''; })()`,
  );
  if (crash) console.error('⚠️ 页面像是落到了错误兜底：\n' + crash);

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const out = resolve(OUT ?? '.preview/browser/cdp-shot.png');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(`✓ ${out}  (${W}×${H})`);
  if (crash) process.exitCode = 1;

  ws.close();
}

main()
  .catch((e) => {
    console.error('✗', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    chrome.kill();
    await sleep(250);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* 临时目录清不掉不影响结果 */
    }
  });
