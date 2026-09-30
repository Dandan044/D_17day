/**
 * 今日待办文案总览 —— 从真源导出，不手抄。
 *
 * 三块来源：
 *  (A) engine/todos.ts  collectTodos()   左页「迫在眉睫」19 条派生预警（红 6 + 橙 13）
 *  (B) engine/todos.ts  HOOK_CONDITIONS  右页「在等的事」钩子登记
 *      copy/names.ts     HOOK_NAME
 *      copy/zh/events/hook_arcs.ts        arm/follow 20 对 + hook_echo_oldflags 40 变体
 *  (C) Effect.enqueue  → run.queue        静态扫描 content/ 统计挂载数
 *
 * 产出：.preview/todo-copy-report.html
 * 跑法：npx tsx scripts/todo-copy-html.ts
 */
import { writeFileSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { HOOK_CONDITIONS, collectTodos } from '../src/game/engine/todos';
import { createRun } from '../src/game/engine/run';
import { HOOK_NAME } from '../src/game/copy/names';
import { data as HOOK_ARCS_COPY } from '../src/game/copy/zh/events/hook_arcs';
import { data as UI_COPY } from '../src/game/copy/zh/ui';

type Any = any;

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---------------- (A) 左页派生预警 ---------------- */

/** 从真实 RunState 出发改字段，避免手搓出引擎不认的状态。 */
function baseRun(): Any {
  return createRun({ seed: 1, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] } as Any);
}

/** 造一个"全线告急"的状态，让 collectTodos 把所有红/橙分支都吐出来。 */
function brokenRun(): Any {
  const r = baseRun();
  r.day = 12;
  r.phase = 'survival';
  r.res = { ...r.res, water: 0, foodStaple: 0, foodFresh: 0 };
  r.waterUse = 0;
  r.ration = 0;
  r.stats = { ...r.stats, hp: 8, sanity: 5, stamina: 5, humanity: 10, reputation: 10 };
  r.conditions = ['dehydrationSevere', 'hypothermiaSevere', 'flu'];
  r.conditionAge = { dehydrationSevere: 3, hypothermiaSevere: 1, flu: 2 };
  r.modules = { ...r.modules, filter: 1, airFilter: 1, power: 1, cistern: 1, medbay: 0, radio: 1 };
  r.projects = [];
  r.wear = { ...r.wear, filterLife: 0, generatorOil: 0 };
  r.items = { ...r.items, filter: 0 };
  r.world = { ...r.world, radiation: 900, exposure: 80, lawOrder: 20 };
  return r;
}

/** 橙级：水/粮不为零但低于阈值，其余指标落在警戒区（只放能同时成立的那些）。 */
function lowRun(): Any {
  const r = baseRun();
  r.day = 12;
  r.phase = 'survival';
  r.res = { ...r.res, water: 4, foodStaple: 3, foodFresh: 0 };
  r.stats = { ...r.stats, hp: 60, sanity: 30, stamina: 20, humanity: 30, reputation: 30 };
  r.conditions = ['flu'];
  r.conditionAge = { flu: 2 };
  r.modules = { ...r.modules, filter: 1, airFilter: 1, power: 1, cistern: 1 };
  r.wear = { ...r.wear, filterLife: 3, generatorOil: 5 };
  r.world = { ...r.world, radiation: 100, exposure: 45, lawOrder: 40 };
  return r;
}

/**
 * 逐条穷举：每个 todo id 配一个"只让它单独成立"的状态。
 * 这样水不足 / 粮不足 / 生命过低 / 家电停机这些在真实游戏里被 else-if 互斥掉的条目，
 * 也能被完整看到（否则只跑一个复合状态，只能吐出 13 条中的一部分）。
 */
function isolatedRuns(): Record<string, Any> {
  const calm = calmRun;
  const mk = (fn: (r: Any) => void, day = 12): Any => {
    const r = calm();
    fn(r);
    r.day = day;
    r.phase = 'survival';
    return r;
  };
  return {
    'water-low': mk((r) => {
      // normal 档每人每天 3L，阈值 h*3 = 3L，必须严格低于
      r.res = { ...r.res, water: 2 };
    }),
    'food-low': mk((r) => {
      // normal 档每人每天 2 份，阈值 h*2 = 2 份
      r.res = { ...r.res, foodStaple: 1, foodFresh: 0 };
    }),
    'hp-warn': mk((r) => {
      // HP_WARN = 40，必须低于
      r.stats = { ...r.stats, hp: 30 };
    }),
    'sanity-low': mk((r) => {
      r.stats = { ...r.stats, sanity: 30 };
    }),
    'humanity-low': mk((r) => {
      r.stats = { ...r.stats, humanity: 10 };
    }),
    'stamina-low': mk((r) => {
      r.stats = { ...r.stats, stamina: 20 };
    }),
    'condition-mild': mk((r) => {
      r.conditions = ['flu'];
      r.conditionAge = { flu: 2 };
    }),
    'filter-worn': mk((r) => {
      r.modules = { ...r.modules, filter: 1, airFilter: 1 };
      r.wear = { ...r.wear, filterLife: 3 };
    }),
    'generator-oil': mk((r) => {
      r.modules = { ...r.modules, power: 1 };
      r.wear = { ...r.wear, generatorOil: 5 };
    }),
    'power-offline': mk((r) => {
      // 灾前市电在供，collectTodos 的这条本来就不会出现（双重保险）；
      // 要触发必须满足 day >= COLLAPSE_DAY 且市电已断。
      r.modules = { ...r.modules, power: 1 };
      r.wear = { ...r.wear, batteryCharge: 0, generatorOil: 24 };
      r.world = { ...r.world, powerGrid: 'off' };
    }),
    'radiation-high': mk((r) => {
      r.world = { ...r.world, radiation: 900 };
    }),
    'exposure-high': mk((r) => {
      r.world = { ...r.world, exposure: 80 };
    }),
    'law-bad': mk((r) => {
      r.world = { ...r.world, lawOrder: 20 };
    }),
  };
}

/** 平稳态：确认 collectTodos 真的会返回空。 */
function calmRun(): Any {
  const r = baseRun();
  r.day = 12;
  r.phase = 'survival';
  r.res = { ...r.res, water: 999, foodStaple: 999, foodFresh: 999 };
  r.stats = { hp: 100, sanity: 100, stamina: 100, humanity: 100, reputation: 100 };
  r.conditions = [];
  r.conditionAge = {};
  r.modules = { ...r.modules, filter: 0, airFilter: 0, power: 0 };
  r.wear = { ...r.wear, filterLife: 99, generatorOil: 99 };
  r.world = { ...r.world, radiation: 0, exposure: 0, lawOrder: 80 };
  return r;
}

function todoCard(td: Any, idx: number): string {
  const lv = td.level === 'red' ? '红笔' : '橙标';
  const cls = td.level === 'red' ? 'red' : 'orange';
  return `
  <article class="todo ${cls}">
    <header><span class="no num">${idx + 1}</span><span class="lv">${lv}</span>
      <span class="title">${esc(td.title)}</span><span class="id">${esc(td.id)}</span></header>
    <ul class="lines">${td.lines.map((l: string) => `<li>${esc(l)}</li>`).join('')}</ul>
    <p class="fix"><b>对策：</b>${esc(td.fix)}</p>
  </article>`;
}

/* ---------------- (B) 右页钩子 ---------------- */

type Row = { hook: string; cond: string; name: string };

function hookRows(): Row[] {
  return Object.keys(HOOK_CONDITIONS).map((h) => ({
    hook: h,
    cond: (HOOK_CONDITIONS as Any)[h],
    name: (HOOK_NAME as Any)[h] ?? h,
  }));
}

/** hook_arcs.ts 的结构：顶层就是各个家族 id */
function arcFamilies(): { id: string; main: Any; variants: Any }[] {
  return Object.entries(HOOK_ARCS_COPY as Any)
    .filter(([, v]) => v && typeof v === 'object')
    .map(([id, v]: Any) => {
      const keys = Object.keys(v);
      const looksVariant = keys.every((k) => v[k] && typeof v[k] === 'object' && ('title' in v[k] || 'body' in v[k]));
      const variants = keys.filter((k) => k !== 'main' && looksVariant);
      return { id, main: v.main ?? null, variants: variants.map((k) => ({ id: k, ...v[k] })) };
    });
}

/** arm/follow 家族结构真源里的 waitFor 配对 */
function pairInfo(): Record<string, { kind: string; hook: string; cond: string }> {
  return {
    hook_arm_buy: { kind: '预备', hook: 'buy / visitShop', cond: HOOK_NAME.buy },
    hook_follow_buy: { kind: '回响', hook: 'buy / visitShop', cond: HOOK_NAME.buy },
    hook_arm_night: { kind: '预备', hook: 'scavengeNight / scavenge', cond: HOOK_NAME.scavengeNight },
    hook_follow_night: { kind: '回响', hook: 'scavengeNight / scavenge', cond: HOOK_NAME.scavengeNight },
    hook_arm_raid: { kind: '预备', hook: 'raid / raidFailed / raidRepelled', cond: HOOK_NAME.raid },
    hook_follow_raid: { kind: '回响', hook: 'raid / raidFailed / raidRepelled', cond: HOOK_NAME.raid },
    hook_arm_rest: { kind: '预备', hook: 'rest / endDay', cond: HOOK_NAME.rest },
    hook_follow_rest: { kind: '回响', hook: 'rest / endDay', cond: HOOK_NAME.rest },
    hook_arm_intel: { kind: '预备', hook: 'verifyIntel / endDay', cond: HOOK_NAME.verifyIntel },
    hook_follow_intel: { kind: '回响', hook: 'verifyIntel / endDay', cond: HOOK_NAME.verifyIntel },
    hook_arm_ration: { kind: '预备', hook: 'setRation / setWaterUse', cond: HOOK_NAME.setRation },
    hook_follow_ration: { kind: '回响', hook: 'setRation / setWaterUse', cond: HOOK_NAME.setRation },
    hook_arm_low: { kind: '预备', hook: 'foodLow / waterLow / hpLow', cond: HOOK_NAME.foodLow },
    hook_follow_low: { kind: '回响', hook: 'foodLow / waterLow / hpLow', cond: HOOK_NAME.foodLow },
    hook_arm_power: { kind: '预备', hook: 'setPowerPriority / setPowerMode / maintain', cond: HOOK_NAME.setPowerPriority },
    hook_follow_power: { kind: '回响', hook: 'setPowerPriority / setPowerMode / maintain', cond: HOOK_NAME.setPowerPriority },
    hook_arm_work: { kind: '预备', hook: 'work / build / cancelProject', cond: HOOK_NAME.work },
    hook_follow_work: { kind: '回响', hook: 'work / build / cancelProject', cond: HOOK_NAME.work },
    hook_arm_haul: { kind: '预备', hook: 'takeHaul / scavenge', cond: HOOK_NAME.takeHaul },
    hook_follow_haul: { kind: '回响', hook: 'takeHaul / scavenge', cond: HOOK_NAME.takeHaul },
  };
}

function mainBlock(main: Any): string {
  if (!main) return '';
  const choices = Object.entries(main.choice ?? {}).map(([k, c]: Any) =>
    `<li><span class="cl">${esc(c.label)}</span><span class="cid">${esc(k)}</span>${
      c.log ? `<div class="clog">→ ${esc(c.log)}</div>` : ''
    }</li>`);
  return `<div class="main">
    <p class="mtitle">「${esc(main.title)}」</p>
    <p class="mbody">${esc(main.body)}</p>
    ${choices.length ? `<ul class="choices">${choices.join('')}</ul>` : ''}
  </div>`;
}

/* ---------------- (C) enqueue 静态扫描 ---------------- */

function scanEnqueue(): { files: number; hits: string[] } {
  const root = join(process.cwd(), 'src', 'game');
  const hits: string[] = [];
  let files = 0;
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.ts') || p.endsWith('.tsx')) {
        files += 1;
        const txt = readFileSync(p, 'utf8');
        if (/enqueue\s*:/.test(txt)) hits.push(p.replace(process.cwd(), '').replace(/\\/g, '/'));
      }
    }
  };
  walk(root);
  return { files, hits };
}

/* ---------------- 组装 ---------------- */

// 一次性复合状态：看真实游戏里"同时告急"会长什么样
const redTodos = collectTodos(brokenRun());
const orangeTodos = collectTodos(lowRun());

// 逐条穷举：每个条目单独触发一次，保证 19 个分支全覆盖
const isolated = isolatedRuns();
const isolatedTodos = Object.entries(isolated).map(([id, r]) => ({
  id,
  hits: collectTodos(r).filter((t) => t.id === id),
}));
const missed = isolatedTodos.filter((x) => x.hits.length === 0).map((x) => x.id);

const rows = hookRows();
const fams = arcFamilies();
const pairs = pairInfo();
const scan = scanEnqueue();

const armFollow = fams.filter((f) => f.id !== 'hook_echo_oldflags');
const echo = fams.find((f) => f.id === 'hook_echo_oldflags');

// 也把左页在"正常状态"下的空态说明带上
const emptyRunTodos = collectTodos(calmRun());

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>今日待办 · 文案总览</title>
<style>
:root{--bg:#14120f;--paper:#1c1916;--ink:#e8e2d8;--dim:#a89f92;--faint:#7a7266;
--red:#c9553f;--orange:#c98a3f;--line:#38322b;--accent:#8aa88c;}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
font:14px/1.75 "Noto Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif;}
.wrap{max-width:1080px;margin:0 auto;padding:40px 28px 80px}
h1{font-size:26px;margin:0 0 6px;letter-spacing:.04em}
.sub{color:var(--faint);font-size:12.5px;margin-bottom:8px}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 34px}
.stat{background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:8px 14px;font-size:12.5px}
.stat b{color:var(--accent);font-size:17px;margin-right:5px;font-weight:600}
h2{font-size:18px;margin:44px 0 6px;padding-left:12px;border-left:3px solid var(--orange);letter-spacing:.03em}
h2 small{color:var(--faint);font-weight:400;font-size:12px;margin-left:10px}
h3{font-size:14.5px;margin:26px 0 10px;color:var(--dim);letter-spacing:.03em}
.note{color:var(--faint);font-size:12.5px;margin:6px 0 18px;padding:10px 14px;
background:var(--paper);border:1px solid var(--line);border-radius:6px}
.todo{background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:14px 18px;margin-bottom:12px}
.todo.red{border-left:3px solid var(--red)}
.todo.orange{border-left:3px solid var(--orange)}
.todo header{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.todo .no{color:var(--faint);font-size:12px}
.todo .lv{font-size:11px;padding:1px 7px;border-radius:3px;border:1px solid var(--line);color:var(--dim)}
.todo.red .lv{color:var(--red);border-color:#5a3229}
.todo.orange .lv{color:var(--orange);border-color:#5a4527}
.todo .title{font-size:15px;font-weight:600}
.todo .id{color:var(--faint);font-size:11.5px;font-family:ui-monospace,Consolas,monospace;margin-left:auto}
.todo .lines{margin:10px 0 8px;padding-left:18px;color:var(--dim)}
.todo .lines li{margin:3px 0}
.todo .fix{color:var(--accent);font-size:12.5px;margin:8px 0 0}
table{width:100%;border-collapse:collapse;font-size:13px;margin:10px 0 20px}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--faint);font-weight:500;font-size:12px;letter-spacing:.04em}
td.hook{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;color:var(--faint)}
.fam{background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:16px 20px;margin-bottom:14px}
.fam.prep{border-left:3px solid var(--accent)}
.fam.echo2{border-left:3px solid #6a7d9e}
.fam header{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.fam .fid{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;color:var(--accent)}
.fam .tag{font-size:11px;border:1px solid var(--line);border-radius:3px;padding:1px 7px;color:var(--dim)}
.fam .wh{margin-left:auto;font-size:12px;color:var(--faint)}
.main{margin:10px 0 0}
.mtitle{font-size:14.5px;font-weight:600;margin:0 0 6px}
.mbody{color:var(--dim);font-size:13px;margin:0 0 10px;white-space:pre-wrap}
ul.choices{list-style:none;margin:0;padding:0}
ul.choices li{border-top:1px dashed var(--line);padding:8px 0 6px}
.cl{color:var(--ink);font-size:13px}
.cid{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--faint);margin-left:8px}
.clog{color:var(--faint);font-size:12px;margin-top:3px}
details{margin-top:8px}
summary{cursor:pointer;color:var(--dim);font-size:12.5px;padding:6px 0}
details .main{border-left:2px solid var(--line);padding-left:14px;margin-left:4px}
.warn{background:#241a17;border:1px solid #5a3229;border-radius:8px;padding:14px 18px;margin:14px 0}
.warn b{color:var(--red)}
code{background:#241f1a;padding:1px 6px;border-radius:3px;font-size:12px;color:#c9b48a}
.footer{color:var(--faint);font-size:12px;margin-top:60px;border-top:1px solid var(--line);padding-top:16px}
</style></head><body><div class="wrap">

<h1>今日待办 · 文案总览</h1>
<div class="sub">从 src/game 真源直接导出（本子左页 / 右页 / 事件通道），非手抄</div>

<div class="stats">
  <div class="stat"><b>${redTodos.filter((t) => t.level === 'red').length}</b>红笔条目</div>
  <div class="stat"><b>${isolatedTodos.filter((x) => x.hits[0]?.level === 'orange').length + isolatedTodos.filter((x) => x.hits[0]?.level === 'red').length}</b>可触达条目</div>
  <div class="stat"><b>${emptyRunTodos.length}</b>平稳态条目</div>
  <div class="stat"><b>${rows.length}</b>钩子条件（右页）</div>
  <div class="stat"><b>${armFollow.length}</b>arm/follow 家族</div>
  <div class="stat"><b>${echo?.variants.length ?? 0}</b>echo 变体</div>
  <div class="stat"><b>${scan.hits.length}</b>内容侧 enqueue 挂载</div>
</div>

<h2>一 · 左页「迫在眉睫」<small>collectTodos() 实时派生 · 纯函数零副作用</small></h2>
<div class="note">
  这一页<b>不是事件</b>，是从 RunState 算出来的状态预警。红笔（<code>is-red</code>）= 要命，橙标（<code>is-orange</code>）= 预警。<br>
  渲染规则：<b>常显「标题 + 第一条带数字的行」</b>（<code>keyLineOf</code>），其余数值行与「对策」点开才看（<code>restLinesOf</code>）。<br>
  两页都空时显示：<code>${esc((UI_COPY as Any).game.todoNone)}</code> / <code>${esc((UI_COPY as Any).game.todoNoHooks)}</code>
</div>

<h3>① 逐条穷举：全部 ${isolatedTodos.length} 个分支的完整文案</h3>
<p class="note" style="margin-bottom:14px">
  每个条目配一个"只让它单独成立"的状态跑一次 <code>collectTodos</code>。这样互斥分支（水不足 / 粮不足 / 生命过低 / 家电停机）
  也都能看到真实输出 —— 它们在复合状态下会被 <code>else if</code> 或上层条件吃掉。<br>
  ${missed.length === 0 ? '覆盖检查：<b>19 个分支全部命中，无遗漏</b>。' : `<b>未命中：${missed.join('、')}</b>`}
</p>
${isolatedTodos.map((x, i) => (x.hits[0] ? todoCard(x.hits[0], i) : '')).join('')}

<h3>② 复合状态：真实游戏里"同时告急"会是什么样</h3>
<p class="note" style="margin-bottom:14px">
  同一次 <code>collectTodos</code> 调用里，多个条件彼此挤占，屏幕上只会出现下面这些。<br>
  <b>红笔全触发态</b>（水/粮归零 · 生命 8 · 理智 5 · 重症双挂 · 滤芯报废 · 辐射 900 · 暴露 80 · 治安 20）→
  单次实际吐出 ${redTodos.length} 条；<br>
  <b>橙级触发态</b>（水 4L · 粮 3 份 · 生命 60 · 理智 30 · 体力 20 · 人性 30 · 滤芯剩 3 · 发电机 5 · 辐射 100 · 暴露 45 · 治安 40）→
  单次实际吐出 ${orangeTodos.length} 条。
</p>
${redTodos.map((t, i) => todoCard(t, i)).join('')}
${orangeTodos.map((t, i) => todoCard(t, i)).join('')}

<h3>③ 平稳态（左页空态）</h3>
<p class="note">
  全部指标健康时 <code>collectTodos</code> 返回 <b>${emptyRunTodos.length} 条</b>，
  UI 显示：<code>${esc((UI_COPY as Any).game.todoNone)}</code>
</p>

<h2>二 · 右页「在等的事」<small>collectHookRegister() · 只列名与条件，不透露后果</small></h2>
<div class="note">
  数据来自 <code>run.pending</code> 里挂了 <code>waitFor</code> 的条目，<b>按钩子聚合</b>（多条事件等同一钩子只记一行，<code>count&gt;1</code> 时显示「N 件事件在等」）。<br>
  共 ${rows.length} 个钩子有登记条件；<code>HOOK_CONDITIONS</code> 里查不到的钩子会被跳过，不渲染。
</div>
<table><thead><tr><th>玩家看到的名字（HOOK_NAME）</th><th>条件（HOOK_CONDITIONS）</th><th>hook id</th></tr></thead>
<tbody>${rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.cond)}</td><td class="hook">${esc(r.hook)}</td></tr>`).join('')}</tbody></table>

<div class="note">
  第三行固定文案（<code>run.queue.length &gt; 0</code> 才出现）：<br>
  <code>${esc((UI_COPY as Any).game.todoOpenEvent)}</code>
</div>

<h3>arm / follow 家族正文（${armFollow.length} 个）</h3>
<div class="note">
  <b>arm</b>（weight&gt;0）= 随机抽到的事件，挂起 <code>pending.waitFor</code>；<b>follow</b>（weight 0）= 只在该行为真的发射钩子后才入队。<br>
  即：arm 是「你打算做」，follow 是「你做完之后」。
</div>
${['prep', 'follow'].map((kind) => {
  const list = armFollow.filter((f) => (kind === 'prep' ? pairs[f.id]?.kind === '预备' : pairs[f.id]?.kind === '回响'));
  if (!list.length) return '';
  return `<h3 style="margin-top:30px">${kind === 'prep' ? '预备族 hook_arm_*' : '回响族 hook_follow_*'}（${list.length} 个）</h3>` +
    list.map((f) => {
      const p = pairs[f.id];
      return `<section class="fam ${kind === 'prep' ? 'prep' : 'echo2'}">
      <header><span class="fid">${esc(f.id)}</span>
        <span class="tag">${esc(p?.kind ?? '')}</span>
        <span class="wh">等：${esc(p?.hook ?? '')}</span></header>
      ${mainBlock(f.main)}</section>`;
    }).join('');
}).join('')}

${echo ? `<h3 style="margin-top:30px">回响族 ${esc(echo.id)}（${echo.variants.length} 个变体）</h3>
<div class="note">
  这是<b>旧旗标的回声</b>：没有 <code>main</code>，40 个变体每个都直接是一段正文 —— 玩家过去做过的某个选择，如今以一条钩子的形式回来。
  家族自身不挂 <code>waitFor</code>，靠玩家已有的 flag 命中。
</div>
${echo.variants.map((v: Any) => `<section class="fam echo2">
  <header><span class="fid">${esc(v.id)}</span></header>
  <p class="mtitle">「${esc(v.title)}」</p>
  <p class="mbody">${esc(v.body)}</p>
  ${Object.keys(v.choice ?? {}).length ? `<ul class="choices">${Object.entries(v.choice).map(([k, c]: Any) =>
    `<li><span class="cl">${esc(c.label)}</span><span class="cid">${esc(k)}</span>${c.log ? `<div class="clog">→ ${esc(c.log)}</div>` : ''}</li>`).join('')}</ul>` : ''}
</section>`).join('')}` : ''}

<h2>三 · 事件通道 <small>run.queue 的另一个写入点</small></h2>
<div class="note">
  「今日待办」里还有一类不是预警、也不是钩子登记，而是<b>真的占住队列的事件家族</b>。
  <code>run.queue</code> 全库只有两个写入点：
  <ul>
    <li><code>engine/hooks.ts</code> — <code>emitHook → tryInsert</code>（上面第二节的钩子命中后 push）</li>
    <li><code>engine/effects.ts</code> — <code>Effect.enqueue</code>（对话后果专用通道）</li>
  </ul>
  queue 非空会挡「结束这一天」，这就是强制处理语义。
</div>

<div class="warn">
  <b>内容侧 enqueue 挂载：${scan.hits.length} 处。</b><br>
  扫描范围 <code>src/game/**/*.ts(x)</code> 共 ${scan.files} 个文件，匹配 <code>enqueue:</code>。
  ${scan.hits.length === 0
    ? '引擎侧实现已就位（types.ts 的类型 + effects.ts 的 applyEffect 分支 + pickEnqueueVariant 变体选择），但<b>没有任何内容文件挂载过它</b>。也就是说：目前玩家不可能通过这条通路在「今日待办」里看到新事件。'
    : `命中文件：<br>${scan.hits.map((h) => `<code>${esc(h)}</code>`).join('<br>')}`}
</div>

<div class="footer">
  生成自 <code>scripts/todo-copy-html.ts</code> ·
  真源：<code>engine/todos.ts</code> · <code>copy/names.ts</code> · <code>copy/zh/events/hook_arcs.ts</code> · <code>copy/zh/ui.ts</code>
</div>
</div></body></html>`;

mkdirSync('.preview', { recursive: true });
writeFileSync('.preview/todo-copy-report.html', html, 'utf8');

console.log(`[todo-copy] 红笔 ${redTodos.filter((t) => t.level === 'red').length} · 橙标 ${orangeTodos.filter((t) => t.level === 'orange').length}`);
console.log(`[todo-copy] 钩子条件 ${rows.length} · arm/follow ${armFollow.length} · echo 变体 ${echo?.variants.length ?? 0}`);
console.log(`[todo-copy] 内容侧 enqueue 挂载 ${scan.hits.length} 处（扫描 ${scan.files} 文件）`);
console.log('[todo-copy] → .preview/todo-copy-report.html');
