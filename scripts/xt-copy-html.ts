/**
 * 小桃线（频道 xt）台词总览 —— 从两个真源直接导出，不手抄。
 *
 * 结构真源：src/game/content/channels/core_xt.ts（stage / minBond / 轮 / 选项 / 数值）
 * 文案真源：src/game/copy/zh/channels/core_xt.ts（玩家实际看到的字）
 *
 * 产出：.preview/xt-dialogue-report.html
 * 跑法：npx tsx scripts/xt-copy-html.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { CORE_XT } from '../src/game/content/channels/core_xt';
import { data as COPY } from '../src/game/copy/zh/channels/core_xt';

type Any = any;

const STAGE_NAMES: Record<number, string> = {
  1: '恐慌期',
  2: '匮乏期',
  3: '掠夺期',
  4: '严冬期',
  5: '荒芜期',
  6: '死寂期',
};

/** channels.xt.xt_hello.line.1 → COPY.xt.xt_hello.line['1'] */
function resolve(key: string): string {
  const parts = key.split('.');
  if (parts[0] === 'channels') parts.shift();
  let node: Any = COPY;
  for (const p of parts) {
    if (node === null || node === undefined) return key;
    node = node[p];
  }
  return typeof node === 'string' ? node : key;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const seenLines = new Set<string>();
let lineCount = 0;
let choiceCount = 0;
let charCount = 0;

function lineHTML(line: Any): string {
  const raw = resolve(line.text);
  const shown = typeof raw === 'string' ? raw : line.text;
  seenLines.add(line.text);
  lineCount += 1;
  charCount += shown.replace(/\s/g, '').length;

  const cls = line.sys === 'narrate' ? 'sys-narrate' : line.sys === 'silent' ? 'sys-silent' : 'peer';
  const badge =
    line.sys === 'narrate' ? '<span class="badge">旁白</span>' : line.sys === 'silent' ? '<span class="badge">收场</span>' : '';
  const onRead = line.onRead ? onReadText(line.onRead) : '';
  return `<div class="line ${cls}">${badge}<span class="txt">${esc(shown)}</span>${onRead}</div>`;
}

function onReadText(o: Any): string {
  const bits: string[] = [];
  if (o.stats) {
    for (const [k, v] of Object.entries(o.stats)) bits.push(`${k} ${(v as number) > 0 ? '+' : ''}${v}`);
  }
  if (o.setFlags) bits.push(o.setFlags.join(' '));
  if (o.tone) bits.push(`tone:${o.tone}`);
  return bits.length ? `<span class="onread">读到时：${esc(bits.join(' · '))}</span>` : '';
}

function choiceHTML(c: Any): string {
  choiceCount += 1;
  const label = resolve(c.label);
  const note = c.note ? resolve(c.note) : '';
  const say = c.say ? resolve(c.say) : '';
  const aff = typeof c.affinity === 'number' ? c.affinity : 0;
  const affCls = aff > 0 ? 'aff-up' : aff < 0 ? 'aff-down' : 'aff-zero';
  const req = c.requires ? `<span class="req">需 ${JSON.stringify(c.requires)}</span>` : '';
  const eff: string[] = [];
  if (c.effect) {
    if (c.effect.stats) for (const [k, v] of Object.entries(c.effect.stats)) eff.push(`${k} ${(v as number) > 0 ? '+' : ''}${v}`);
    if (c.effect.res) for (const [k, v] of Object.entries(c.effect.res)) eff.push(`${k} ${(v as number) > 0 ? '+' : ''}${v}`);
    if (typeof c.effect.ap === 'number') eff.push(`ap ${c.effect.ap > 0 ? '+' : ''}${c.effect.ap}`);
    if (c.effect.world) for (const [k, v] of Object.entries(c.effect.world)) eff.push(`world.${k} ${(v as number) > 0 ? '+' : ''}${v}`);
    if (c.effect.setFlags) eff.push(c.effect.setFlags.join(' '));
    if (c.effect.locations) eff.push('解锁地点 ' + c.effect.locations.map((l: Any) => `${l.id}(库存${l.stock})`).join(', '));
    if (c.effect.tone) eff.push(`tone:${c.effect.tone}`);
  }
  const nextLabel = c.next ? `→ 轮 ${c.next}` : '（事件结束）';
  return `<div class="choice">
    <div class="c-head"><span class="c-label">${esc(label)}</span><span class="aff ${affCls}">好感 ${aff > 0 ? '+' : ''}${aff}</span>${req}<span class="c-next">${esc(nextLabel)}</span></div>
    ${note ? `<div class="c-note">${esc(note)}</div>` : ''}
    ${say ? `<div class="c-say">你说：${esc(say)}</div>` : ''}
    ${eff.length ? `<div class="c-eff">效果：${esc(eff.join(' · '))}</div>` : ''}
  </div>`;
}

function roundHTML(r: Any, index: number): string {
  const lines = (r.out || []).map(lineHTML).join('');
  const chs = (r.choices || []).map(choiceHTML).join('');
  const meta: string[] = [];
  if (r.delayDays) meta.push(`隔 ${r.delayDays} 天`);
  if (typeof r.minAffinity === 'number') meta.push(`好感 ≥ ${r.minAffinity}`);
  if (r.elseRound) meta.push(`否则走 ${r.elseRound}`);
  if (r.silence) meta.push('静默收场');
  return `<div class="round">
    <div class="r-head">轮 ${esc(r.id)}<span class="r-idx">#${index + 1}</span>${meta.map((m) => `<span class="r-meta">${esc(m)}</span>`).join('')}</div>
    ${lines || '<div class="line empty">（本轮无台词，直接给选项）</div>'}
    ${chs ? `<div class="choices">${chs}</div>` : '<div class="no-choice">（无选项 = 事件在此结束）</div>'}
  </div>`;
}

function eventHTML(e: Any): string {
  const opening = (e.opening || []).map(lineHTML).join('');
  const openChoices = (e.openChoices || []).map(choiceHTML).join('');
  const rounds = (e.rounds || []).map(roundHTML).join('');
  const meta: string[] = [];
  meta.push(`阶段 ${e.stage[0]}–${e.stage[1]}（${STAGE_NAMES[e.stage[0]]}${e.stage[1] !== e.stage[0] ? '~' + STAGE_NAMES[e.stage[1]] : ''}）`);
  meta.push(`kind: ${e.kind}`);
  if (e.key) meta.push('★ key 关键');
  if (typeof e.minBond === 'number') meta.push(`好感下限 ${e.minBond}`);
  if (e.need) meta.push('需先经历 ' + e.need.join(', '));
  if (e.require) meta.push('条件 ' + JSON.stringify(e.require));
  if (e.discoverDay) meta.push(`第 ${e.discoverDay} 天出现`);
  const roundCount = (e.rounds || []).length;
  const lineN = (e.opening || []).length + (e.rounds || []).reduce((n: number, r: Any) => n + (r.out || []).length, 0);
  const choiceN = (e.openChoices || []).length + (e.rounds || []).reduce((n: number, r: Any) => n + (r.choices || []).length, 0);
  return `<article class="event" id="${esc(e.id)}">
    <header class="e-head">
      <h3>${esc(e.id)}</h3>
      <div class="e-stats">${lineN} 句台词 · ${roundCount} 轮 · ${choiceN} 个选项</div>
    </header>
    <div class="e-meta">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div>
    ${opening ? `<div class="opening"><div class="o-title">开场</div>${opening}</div>` : ''}
    ${openChoices ? `<div class="choices open-choices"><div class="o-title">开场就要你表态</div>${openChoices}</div>` : ''}
    ${rounds}
  </article>`;
}

const events: Any[] = CORE_XT.events;
const byStage = new Map<number, Any[]>();
for (const e of events) {
  const s = e.stage[0];
  if (!byStage.has(s)) byStage.set(s, []);
  byStage.get(s)!.push(e);
}

const body = [...byStage.keys()]
  .sort((a, b) => a - b)
  .map((s) => {
    const list = byStage.get(s)!;
    return `<section class="stage stage-${s}" id="stage-${s}">
      <h2><span class="s-num">${s}</span>${STAGE_NAMES[s]}<span class="s-count">${list.length} 个事件</span></h2>
      ${list.map(eventHTML).join('')}
    </section>`;
  })
  .join('');

const nav = [...byStage.keys()]
  .sort((a, b) => a - b)
  .map((s) => `<a href="#stage-${s}">${s} ${STAGE_NAMES[s]} <b>${byStage.get(s)!.length}</b></a>`)
  .join('');

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>小桃线 · 台词总览</title>
<style>
  :root{--bg:#141110;--card:#1c1815;--card2:#221d19;--line:#312a24;--ink:#e9dfcd;--dim:#a2937e;--faint:#7a6d5c;--peer:#f2e8d5;--hot:#c9724a;--cool:#7fa08c}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.75 "Songti SC","Noto Serif SC",Georgia,serif;padding:32px 28px 90px}
  .wrap{max-width:1080px;margin:0 auto}
  h1{font-size:26px;margin:0 0 6px;letter-spacing:.04em}
  .sub{color:var(--dim);font-size:13px;margin-bottom:22px}
  .kpi{display:flex;gap:26px;flex-wrap:wrap;margin:0 0 24px;padding:14px 18px;background:var(--card);border:1px solid var(--line);border-radius:6px}
  .kpi div{font-size:13px;color:var(--dim)}
  .kpi b{display:block;font-size:21px;color:var(--ink);font-weight:600}
  nav.stages{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:30px}
  nav.stages a{font-size:12.5px;color:var(--dim);text-decoration:none;border:1px solid var(--line);padding:4px 10px;border-radius:99px;background:var(--card)}
  nav.stages a:hover{color:var(--ink);border-color:var(--hot)}
  nav.stages b{color:var(--hot)}
  section.stage{margin:0 0 42px}
  section.stage h2{font-size:17px;letter-spacing:.06em;border-bottom:1px solid var(--line);padding-bottom:8px;margin:0 0 18px;display:flex;align-items:center;gap:10px}
  .s-num{display:inline-flex;width:22px;height:22px;align-items:center;justify-content:center;border-radius:50%;background:var(--hot);color:#141110;font-size:12px;font-weight:700}
  .s-count{margin-left:auto;font-size:12px;color:var(--faint);font-weight:400}
  article.event{background:var(--card);border:1px solid var(--line);border-radius:7px;padding:16px 18px;margin-bottom:16px}
  .e-head{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
  .e-head h3{margin:0;font-size:15.5px;color:#f3c9a3;font-family:ui-monospace,Consolas,monospace;letter-spacing:.02em}
  .e-stats{margin-left:auto;font-size:11.5px;color:var(--faint)}
  .e-meta{display:flex;gap:6px;flex-wrap:wrap;margin:9px 0 14px}
  .e-meta span{font-size:11.5px;color:var(--dim);background:var(--card2);border:1px solid var(--line);border-radius:4px;padding:2px 7px}
  .o-title{font-size:11.5px;color:var(--faint);letter-spacing:.16em;margin:12px 0 7px}
  .line{padding:2px 0 2px 12px;border-left:2px solid transparent;color:var(--peer)}
  .line .txt{white-space:pre-wrap}
  .line.sys-narrate{color:var(--dim);font-style:italic}
  .line.sys-narrate .txt{color:var(--dim)}
  .line.sys-silent{color:var(--faint)}
  .line.empty{color:var(--faint);font-size:12.5px;font-style:italic}
  .badge{font-size:10.5px;color:var(--faint);border:1px solid var(--line);border-radius:3px;padding:0 4px;margin-right:7px;vertical-align:1px}
  .onread{display:block;font-size:11px;color:var(--faint);padding-left:2px}
  .round{margin:12px 0 0;padding:10px 0 0;border-top:1px dashed var(--line)}
  .r-head{font-size:12px;color:var(--cool);font-family:ui-monospace,Consolas,monospace;margin-bottom:8px;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
  .r-idx{color:var(--faint);font-size:11px}
  .r-meta{font-size:11px;color:var(--hot);border:1px solid #4a352a;background:#241a15;border-radius:3px;padding:0 5px}
  .choices{margin:9px 0 0;display:flex;flex-direction:column;gap:7px}
  .choice{background:var(--card2);border:1px solid var(--line);border-radius:5px;padding:8px 11px}
  .c-head{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
  .c-label{color:var(--ink);font-weight:600;font-size:14px}
  .aff{font-size:11px;border-radius:3px;padding:0 5px}
  .aff-up{color:#e6a07a;background:#2a1c14}
  .aff-down{color:#8fa9a0;background:#1a2420}
  .aff-zero{color:var(--faint);background:#201c19}
  .req{font-size:11px;color:#d8b06a;background:#241f14;border-radius:3px;padding:0 5px}
  .c-next{font-size:11px;color:var(--faint);margin-left:auto}
  .c-note{font-size:11.5px;color:var(--faint);margin-top:3px}
  .c-say{font-size:13.5px;color:#cfe0d4;margin-top:4px}
  .c-eff{font-size:11px;color:var(--dim);margin-top:3px}
  .no-choice{font-size:12px;color:var(--faint);font-style:italic;margin-top:8px}
  .open-choices{margin-bottom:6px}
  @media (max-width:560px){body{padding:20px 14px 70px}.kpi{gap:16px}}
</style></head><body><div class="wrap">
<h1>小桃线 · 台词总览</h1>
<div class="sub">频道 <code>xt</code> · 隔壁楼 19 岁女生 · 结构取自 content/channels/core_xt.ts，文字取自 copy/zh/channels/core_xt.ts</div>
<div class="kpi">
  <div>事件<b>${events.length}</b></div>
  <div>台词行<b>${lineCount}</b></div>
  <div>选项<b>${choiceCount}</b></div>
  <div>正文字数<b>${charCount}</b></div>
</div>
<nav class="stages">${nav}</nav>
${body}
</div></body></html>`;

mkdirSync('.preview', { recursive: true });
writeFileSync('.preview/xt-dialogue-report.html', html, 'utf8');
console.log(
  `已生成 .preview/xt-dialogue-report.html — ${events.length} 事件 / ${lineCount} 行台词 / ${choiceCount} 选项 / ${charCount} 字`,
);
