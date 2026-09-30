/**
 * 给一个本地 HTML 拍一张整页 PNG（无头 Chrome `--screenshot`）。
 *
 * 单独抽出来是因为 Windows 上这里有个坑：`--screenshot=` **必须是绝对路径且不能带正斜杠
 * 的盘符写法**。`--screenshot=.preview/x.png` 会报「系统找不到指定的路径」，
 * `--screenshot=D:/a/b.png` 反而可以，相对路径一律不行（cwd 是 Bash 还是 Node 都不行）。
 *
 *   node scripts/shot-file.mjs .preview/body/body.html .preview/body/body.png 1200 1500
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [html, png, w = '1400', h = '1000'] = process.argv.slice(2);
if (!html || !png) {
  console.error('用法: node scripts/shot-file.mjs <in.html> <out.png> [宽] [高]');
  process.exit(1);
}

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));
if (!CHROME) {
  console.error('找不到 Chrome / Edge');
  process.exit(1);
}

const r = spawnSync(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    `--user-data-dir=${resolve('.preview/.chrome-shot-profile')}`,
    `--screenshot=${resolve(png).replace(/\\/g, '/')}`,
    `--window-size=${w},${h}`,
    '--virtual-time-budget=2500',
    pathToFileURL(resolve(html)).href,
  ],
  { stdio: 'inherit' },
);
process.exit(r.status ?? 1);
