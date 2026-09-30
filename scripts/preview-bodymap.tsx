/**
 * BodyMap 离线预览：把人体图在真实纸面色里渲染成静态 HTML，供无头 Chrome 截图。
 *
 * 为什么不直接在游戏里看：游戏要在浏览器里点到医疗箱热点、还得先造出那几条病。
 * 这个脚本把 5 个档位（空 / 单病 / 多病 / 压满 / 悬空 id）一次排开，改完造型 3 秒就能验。
 *
 * ## 为什么要先过一遍 esbuild 才能跑
 *
 * `BodyMap.tsx` 顶层 `import './art.css'`，而 Node 不认 `.css`——直接 `tsx` 跑会报
 * `ERR_UNKNOWN_FILE_EXTENSION: .css`。所以用 esbuild 打成一个 cjs 包，并把 `.css`
 * 映射成空模块（`:css` 只是样式，预览页自己内联整份 art.css，不靠它）。
 *
 *   npm run preview:body     # 打包 + 跑 + 截图，一条命令
 *
 * 或者手动：
 *   npx esbuild scripts/preview-bodymap.tsx --bundle --platform=node --format=cjs \
 *     --jsx=automatic --loader:.css=empty --outfile=.preview/body/_bundle.cjs
 *   node .preview/body/_bundle.cjs
 *
 * 注意 `--format=cjs`：`react-dom/server` 的 node 入口里有 `require('util')`，
 * 打成 esm 会炸在 "Dynamic require of util is not supported"。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import { BodyMap } from '../src/ui/art/BodyMap';
import { aggregateBodyParts } from '../src/ui/art/bodyParts';

const ROOT = process.cwd();
const OUT = join(ROOT, '.preview', 'body');

const CASES: Array<{ name: string; conditions: string[]; sanity: number }> = [
  { name: '空 · 理智 62（环为墨色）', conditions: [], sanity: 62 },
  { name: '单病 · 伤口感染 · 理智 28（环转赭石）', conditions: ['woundInfection'], sanity: 28 },
  {
    name: '多病 · 重度脱水+肺炎+骨折+低温症重 · 理智 9（环转朱红）',
    conditions: ['dehydrationSevere', 'pneumonia', 'fracture', 'hypothermiaSevere'],
    sanity: 9,
  },
  {
    name: '压满 · 23 条全上（标注列撞不撞）',
    conditions: [
      'thirst',
      'dehydrationMild',
      'dehydrationMod',
      'dehydrationSevere',
      'starving',
      'malnourished',
      'dysentery',
      'giardia',
      'jaundice',
      'flu',
      'pneumonia',
      'wound',
      'woundInfection',
      'sepsis',
      'fracture',
      'hypothermiaMild',
      'hypothermiaMod',
      'hypothermiaSevere',
      'radiationSickness',
      'coPoisoning',
      'moldLung',
      'kidneyStrain',
      'despair',
    ],
    sanity: 44,
  },
  {
    name: '悬空 id（旧档） · 必须有「无法识别」提示',
    conditions: ['wound_legacy_gone', 'pneumonia'],
    sanity: 51,
  },
];

function card(c: (typeof CASES)[number], width: number) {
  const agg = aggregateBodyParts(c.conditions, {});
  const body = renderToStaticMarkup(<BodyMap agg={agg} sanity={c.sanity} />);
  return `<figure class="card">
  <figcaption>${c.name} · 容器 ${width}px</figcaption>
  <div class="sheet" style="width:${width}px"><div class="col">${body}</div></div>
</figure>`;
}

const css = readFileSync(join(ROOT, 'src/ui/art/art.css'), 'utf8');

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<style>
:root{--font-mono:ui-monospace,'Cascadia Mono',Consolas,'Courier New',monospace}
body{margin:0;padding:22px;background:#2a2620;font-family:'Noto Sans SC',system-ui,sans-serif;color:#cfc6b4}
.gallery{display:flex;flex-wrap:wrap;gap:22px;align-items:flex-start}
.card{margin:0}
.card figcaption{font-size:12px;letter-spacing:.04em;opacity:.72;margin-bottom:7px}
.sheet{
  /* 纸面色：与 .art-paper-veil.is-bd 同系，人体图在纸上的对比才是真的 */
  background:#cbbd9c;
  padding:16px 18px;
  box-shadow:0 10px 30px rgba(0,0,0,.45);
}
/* 复刻纸面上的真实排版宽度：图列占 ~46% */
.col{width:100%;outline:1px dashed rgba(200,60,20,.45)}
</style>
<style>${css}</style>
<style>
/* 关键：BodyMap 吃的是 .art-paper-veil.is-bd 上那组 --pp-* / --art-serif。
   真实环境里它被那个 veil 包着；预览里必须原样补上，否则 var() 解析失败 →
   stroke 回落 none、fill 回落 black，人体会变成「没有线、只有黑块」。
   这里直接抄变量，不套 .art-paper-veil 本体（那个是 position:fixed，会毁掉画廊排版）。 */
body{
  --art-serif:'Noto Serif SC','Source Han Serif SC','Songti SC','STSong','SimSun','Times New Roman',serif;
  --pp-ink:#1d1a15;
  --pp-ink-2:#3a342a;
  --pp-ink-3:#4c463a;
  --pp-rule:rgba(30,26,18,.26);
  --pp-rule-2:rgba(30,26,18,.5);
  --pp-rule-3:rgba(30,26,18,.85);
  --pp-red:#93270f;
  --pp-red-2:#ad3a1b;
  --pp-green:#2c4a2f;
  --pp-ochre:#6b4a0c;
  --pp-blue:#23425c;
  --pp-paper:#cbbd9c;
  --pp-card:rgba(30,26,18,.06);
  --pp-detail:rgba(30,26,18,.09);
}
</style>
</head><body>
<div class="gallery">
${CASES.map((c) => card(c, 524)).join('\n')}
${CASES.slice(0, 1).map((c) => card(c, 330)).join('\n')}
${CASES.slice(2, 3).map((c) => card(c, 330)).join('\n')}
</div>
</body></html>`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'body.html'), html, 'utf8');
console.log(`wrote ${join(OUT, 'body.html')}  (${html.length} bytes, ${CASES.length} cases)`);
