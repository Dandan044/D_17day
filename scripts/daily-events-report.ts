/**
 * 每日随机事件文案总览 —— 从真源导出，不手抄。
 *
 * 范围：darector 的抽签池 = ALL_FAMILIES 里 baseWeight > 0 的那些家族
 *      （baseWeight <= 0 的只由链条 schedule 或 forcedFamilies 带出，不在本报告）
 *
 * 文案已在 import 时经 hydrateFamilies 解析完毕（copy/zh 是真源），
 * 所以这里读到的 title/body/label/log 就是玩家看到的字。
 *
 * 产出：.preview/daily-events-report.html
 * 跑法：npx tsx scripts/daily-events-report.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';

import { ALL_FAMILIES } from '../src/game/content/events';
import { KIND_NAME } from '../src/game/content/lookup';
import type { EventFamily } from '../src/game/types';

type Any = any;

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const KIND_LABEL: Record<string, string> = {
  threat: '威胁',
  opportunity: '机遇',
  social: '社交',
  medical: '医疗',
  weather: '天气',
  moral: '道德',
  story: '剧情',
  dream: '梦境',
};

/** 家族 id 前缀 → 模块分组 */
function groupOf(id: string): string {
  if (id.startsWith('prep_slice_')) return '准备期切片';
  if (id.startsWith('prep_')) return '准备期';
  if (id.startsWith('hook_arm_')) return '钩子·预备';
  if (id.startsWith('hook_follow_')) return '钩子·回响';
  if (id === 'hook_echo_oldflags') return '钩子·回声';
  if (id.startsWith('surv_')) return '生存节拍';
  if (id.startsWith('nuke_')) return '核灾弧线';
  if (id.startsWith('daily_')) return '日常';
  if (id.startsWith('env_')) return '严冬环境';
  if (id.startsWith('pl_')) return '劫掠现场';
  if (id.startsWith('wn_')) return '严冬惨景';
  if (id.startsWith('ws_')) return '荒芜场景';
  if (id.startsWith('sl_')) return '死寂场景';
  if (id.startsWith('radio_')) return '电台';
  if (id.startsWith('opp_')) return '机遇';
  if (id.startsWith('city_') || id.startsWith('stair_')) return '城市肌理';
  if (id.startsWith('dream_')) return '梦境';
  if (id.startsWith('cold_') || id.startsWith('filter_') || id.startsWith('med_')) return '环境/医疗';
  if (id.startsWith('stat_arc_')) return '数值弧';
  if (id.startsWith('dark_')) return '黑暗见证';
  return '其他';
}

const GROUP_ORDER = [
  '准备期',
  '准备期切片',
  '日常',
  '生存节拍',
  '核灾弧线',
  '严冬环境',
  '城市肌理',
  '劫掠现场',
  '严冬惨景',
  '荒芜场景',
  '死寂场景',
  '电台',
  '机遇',
  '梦境',
  '环境/医疗',
  '数值弧',
  '黑暗见证',
  '钩子·预备',
  '钩子·回响',
  '钩子·回声',
  '其他',
];

const all = ALL_FAMILIES.filter((f) => f.baseWeight > 0);
const chained = ALL_FAMILIES.filter((f) => f.baseWeight <= 0);

/** 链条池（baseWeight=0）也统计一下，报告里给出对照 */
let chainedVariants = 0;
let chainedChoices = 0;
for (const f of chained) {
  chainedVariants += f.variants.length;
  for (const v of f.variants) chainedChoices += v.choices.length;
}

/** kind 分布（随机池） */
const kindCounts = new Map<string, number>();
for (const f of all) kindCounts.set(f.kind, (kindCounts.get(f.kind) ?? 0) + 1);
const kindBar = [...kindCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([k, n]) => `<span class="kb"><i>${KIND_LABEL[k] ?? k}</i>${n}</span>`)
  .join('');

/** 按组归类 */
const groups = new Map<string, EventFamily[]>();
for (const f of all) {
  const g = groupOf(f.id);
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g)!.push(f);
}

let variantCount = 0;
let choiceCount = 0;
let charCount = 0;
for (const f of all) {
  for (const v of f.variants) {
    variantCount += 1;
    charCount += (v.title ?? '').replace(/\s/g, '').length + (v.body ?? '').replace(/\s/g, '').length;
    for (const c of v.choices) {
      choiceCount += 1;
      charCount += (c.label ?? '').replace(/\s/g, '').length;
      charCount += (c.note ?? '').replace(/\s/g, '').length;
      if (c.effect?.log) charCount += c.effect.log.replace(/\s/g, '').length;
      if (c.check?.ok?.log) charCount += c.check.ok.log.replace(/\s/g, '').length;
      if (c.check?.bad?.log) charCount += c.check.bad.log.replace(/\s/g, '').length;
    }
  }
}

function reqLine(c: Any): string {
  const parts: string[] = [];
  if (c.requires?.res) {
    parts.push(
      Object.entries(c.requires.res)
        .map(([k, v]) => `${v} ${k}`)
        .join(' · '),
    );
  }
  if (c.requires?.reason) parts.push(`【${c.requires.reason}】`);
  if (c.check) parts.push(`检定 ${c.check.skill} DC${c.check.dc}`);
  return parts.join(' ');
}

function effectBrief(e: Any): string {
  if (!e) return '';
  const bits: string[] = [];
  if (e.log) bits.push(`结果：${e.log}`);
  if (e.setFlags?.length) bits.push(`置旗：${e.setFlags.join(', ')}`);
  if (e.schedule?.length) bits.push(`后续：${e.schedule.map((s: Any) => s.familyId).join(', ')}`);
  return bits.join('<br>');
}

function choiceHTML(c: Any): string {
  const req = reqLine(c);
  const log = c.check
    ? `<div class="clog"><b>成功→</b> ${esc(c.check.ok?.log ?? '')}<br><b>失败→</b> ${esc(c.check.bad?.log ?? '')}</div>`
    : c.effect?.log
      ? `<div class="clog">→ ${esc(c.effect.log)}</div>`
      : '';
  return `<li>
    <div class="crow"><span class="cl">${esc(c.label)}</span>
      <span class="cid">${esc(c.id)}</span>
      ${req ? `<span class="creq">${esc(req)}</span>` : ''}</div>
    ${c.note ? `<div class="cnote">${esc(c.note)}</div>` : ''}
    ${log}
  </li>`;
}

function familyHTML(f: EventFamily): string {
  const phases = f.phase.map((p) => (p === 'prep' ? '准备期' : '灾后')).join('/');
  const meta = [
    `权重 ${f.baseWeight}`,
    `${phases}`,
    `${KIND_LABEL[f.kind] ?? f.kind}`,
    `强度 ${f.intensity}`,
    f.minThreat !== undefined ? `threat≥${f.minThreat}` : '',
    f.maxThreat !== undefined ? `threat≤${f.maxThreat}` : '',
    f.once ? '一次性' : `冷却 ${f.cooldown ?? 3}天`,
  ]
    .filter(Boolean)
    .join(' · ');

  const variants = f.variants
    .map(
      (v) => `<div class="var">
    ${f.variants.length > 1 ? `<span class="vid">变体 ${esc(v.id)}</span>` : ''}
    <p class="vtitle">${esc(v.title)}</p>
    <p class="vbody">${esc(v.body)}</p>
    <ul class="choices">${v.choices.map(choiceHTML).join('')}</ul>
  </div>`,
    )
    .join('');

  return `<section class="fam">
  <header>
    <span class="fid">${esc(f.id)}</span>
    <span class="fmeta">${esc(meta)}</span>
  </header>
  ${variants}
</section>`;
}

const body = GROUP_ORDER.filter((g) => groups.has(g))
  .map((g) => {
    const list = groups.get(g)!;
    const sorted = [...list].sort((a, b) => b.baseWeight - a.baseWeight || a.id.localeCompare(b.id));
    return `<h2>${esc(g)} <small>${sorted.length} 个家族</small></h2>
${sorted.map(familyHTML).join('')}`;
  })
  .join('');

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>每日随机事件 · 文案总览</title>
<style>
:root{--bg:#14120f;--paper:#1c1916;--ink:#e8e2d8;--dim:#a89f92;--faint:#7a7266;
--line:#38322b;--accent:#8aa88c;--warn:#c98a3f;}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
font:14px/1.75 "Noto Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif;}
.wrap{max-width:1080px;margin:0 auto;padding:40px 28px 80px}
h1{font-size:26px;margin:0 0 6px;letter-spacing:.04em}
.sub{color:var(--faint);font-size:12.5px;margin-bottom:8px}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 30px}
.stat{background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:8px 14px;font-size:12.5px}
.stat b{color:var(--accent);font-size:17px;margin-right:5px;font-weight:600}
h2{font-size:18px;margin:46px 0 14px;padding-left:12px;border-left:3px solid var(--warn);letter-spacing:.03em}
h2 small{color:var(--faint);font-weight:400;font-size:12px;margin-left:10px}
.note{color:var(--faint);font-size:12.5px;margin:6px 0 20px;padding:11px 15px;
background:var(--paper);border:1px solid var(--line);border-radius:6px}
.fam{background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:15px 20px;margin-bottom:12px}
.fam header{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.fam .fid{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;color:var(--accent)}
.fam .fmeta{font-size:11.5px;color:var(--faint)}
.var{margin:8px 0 0}
.vid{font-size:11px;color:var(--faint);font-family:ui-monospace,Consolas,monospace}
.vtitle{font-size:15px;font-weight:600;margin:4px 0 6px}
.vbody{color:var(--dim);font-size:13.5px;margin:0 0 10px;white-space:pre-wrap}
ul.choices{list-style:none;margin:0;padding:0}
ul.choices li{border-top:1px dashed var(--line);padding:8px 0 7px}
.crow{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}
.cl{color:var(--ink);font-size:13px}
.cid{font-family:ui-monospace,Consolas,monospace;font-size:10.5px;color:#5d564c}
.creq{font-size:11px;color:var(--warn);margin-left:auto}
.cnote{color:var(--faint);font-size:11.5px;margin-top:2px}
.clog{color:var(--faint);font-size:12px;margin-top:4px;line-height:1.65}
.footer{color:var(--faint);font-size:12px;margin-top:60px;border-top:1px solid var(--line);padding-top:16px}
.kindbar{display:flex;flex-wrap:wrap;gap:8px;margin-top:9px}
.kb{font-size:11.5px;color:var(--dim);border:1px solid var(--line);border-radius:4px;padding:2px 9px}
.kb i{color:var(--accent);font-style:normal;margin-right:6px}
code{background:#241f1a;padding:1px 6px;border-radius:3px;font-size:12px;color:#c9b48a}
</style></head><body><div class="wrap">

<h1>每日随机事件 · 文案总览</h1>
<div class="sub">导演抽签池 <code>baseWeight &gt; 0</code> · 文案已过 hydrate（copy/zh 是真源）· 非手抄</div>

<div class="stats">
  <div class="stat"><b>${all.length}</b>可随机家族</div>
  <div class="stat"><b>${variantCount}</b>变体</div>
  <div class="stat"><b>${choiceCount}</b>选项</div>
  <div class="stat"><b>${charCount.toLocaleString()}</b>可见字数</div>
  <div class="stat"><b>${chained.length}</b>链条家族（不在内）</div>
</div>

<div class="note">
  范围说明：<code>engine/director.ts selectEvents()</code> 第 3 步「按权重补足」从
  <code>ALL_FAMILIES</code> 里筛 <code>baseWeight &gt; 0</code> 的家族，
  再用 <code>baseWeight × pacingMultiplier()</code> 加权抽取，每天抽满 <code>count</code> 个为止。<br>
  <b>不在本报告内</b>的 ${chained.length} 个家族（<code>baseWeight = 0</code>，${chainedVariants} 变体 / ${chainedChoices} 选项）
  只能由 <code>run.pending</code> 链条 <code>schedule</code> 或暴露度阶梯 <code>forcedFamilies</code> 带出，
  <b>不会自己找上门</b> —— 它们属于「因果链事件」，不在"每天随机遇到"的范畴。<br>
  过滤条件：<code>isEligible()</code> 会按 <code>phase</code> / <code>threat</code> 区间 / 冷却 / <code>once</code> /
  <code>require</code> / <code>forbid</code> 硬筛，所以实际某一天能抽到的只是这里的子集。
</div>

<div class="note">
  <b>随机池类型分布</b>（<code>kind</code> 决定 <code>KIND_BASE</code> 基础权重与 UI 徽章配色）：<br>
  <div class="kindbar">${kindBar}</div>
</div>

${body}

<div class="footer">
  生成自 <code>scripts/daily-events-report.ts</code> ·
  真源：<code>content/events/**</code>（结构） + <code>copy/zh/events/**</code>（文案）
</div>
</div></body></html>`;

mkdirSync('.preview', { recursive: true });
writeFileSync('.preview/daily-events-report.html', html, 'utf8');

console.log(`[daily] 可随机家族 ${all.length} · 变体 ${variantCount} · 选项 ${choiceCount} · 可见字 ${charCount}`);
console.log(`[daily] 分组：${GROUP_ORDER.filter((g) => groups.has(g)).map((g) => `${g}(${groups.get(g)!.length})`).join(' ')}`);
console.log('[daily] → .preview/daily-events-report.html');
