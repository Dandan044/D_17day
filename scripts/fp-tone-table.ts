/**
 * 第一人称改造 · 全量基调表 + 改写量统计。
 *
 * 跑法：npx tsx scripts/fp-tone-table.ts
 * 产出：.preview/fp-tone-table.html
 *
 * 干什么：
 *  1. 按 kind × intensity 给 269 个家族定基调（基调表按 content-voice.md + skill 的体系）
 *  2. 统计真实改写量 —— 关键是**先分三类「你」**，不是所有家族都要动：
 *     ① 我的经历 → 必改（人称）
 *     ② 被观察的第三人 → 保留"他"，只改"我看着他"
 *     ③ 无人面白描 → 不动
 *  3. 标出每条家族踩到的机器规则（body 有动作 / 短陈述 / 破折号）
 */
import { ALL_FAMILIES } from '../src/game/content/events';
import { writeFileSync, mkdirSync } from 'node:fs';

// ---------------------------------------------------------------- 基调体系

type Tone = {
  base: string;      // 天然基调
  persona: string;   // 日记里的人格
  quip: '高' | '中' | '低'; // 吐槽含量
};

const TONE: Record<string, Tone> = {
  threat: { base: '紧张 / 后怕 / 硬撑', persona: '会骂人、会算、会装狠', quip: '高' },
  opportunity: { base: '庆幸 / 算计 / 得意', persona: '会偷笑、会盘算、会自嘲贪心', quip: '高' },
  social: { base: '为难 / 犹豫 / 心软或心硬', persona: '会纠结、会给自己找理由', quip: '中' },
  medical: { base: '焦躁 / 忍着 / 嫌麻烦', persona: '会嘟囔、会怕、会硬扛', quip: '中' },
  weather: { base: '抱怨 / 认命 / 麻木', persona: '会骂天、会数日子', quip: '高' },
  moral: { base: '难受 / 辩解 / 沉默', persona: '会替自己开脱，然后失败', quip: '中' },
  story: { base: '沉 / 想得多 / 说不出口', persona: '会停顿、会写不下去', quip: '低' },
  dream: { base: '恍惚 / 记不清', persona: '会语无伦次、分不清真假', quip: '低' },
};

const INTENSITY: Record<number, string> = {
  1: '一句带过',
  2: '抱怨 / 庆幸（压着）',
  3: '情绪上脸',
  4: '崩、写不成句',
};

// ---------------------------------------------------------------- 三类「你」判定

/**
 * 判据（skill 第三节）：主语是不是"我"。
 *  - hasSecondPerson：正文里有没有「你」
 *  - observerOnly：正文里的「你」只是"我看见"的施动者，被观察对象是第三人
 *    → 启发式：题面/变体里出现「尸体 / 老人 / 他 / 她 / 陌生人 / 女人 / 男人」等，
 *      且「你」只出现在"看见/听见/发现"这类感知句里
 */
type Cls = '①我的经历' | '②被观察的第三人' | '③无人面白描' | '混合';

const THIRD_PERSON_WORDS = [
  '尸体', '老人', '陌生人', '女人', '男人', '孩子', '小孩', '他', '她',
  '一家', '邻居', '楼上', '一个人', '有人', '谁',
];

function classify(body: string, title: string): Cls {
  if (!body) return '③无人面白描';
  const hasYou = body.includes('你');
  const hasThird = THIRD_PERSON_WORDS.some((w) => title.includes(w) || body.includes(w));
  if (!hasYou) return '③无人面白描';
  // 「你」是否只出现在感知句里
  const youCount = (body.match(/你/g) ?? []).length;
  const perceptCount = (body.match(/你(看见|听到|听见|发现|闻到|盯着|看到|想起|记得|认得)/g) ?? []).length;
  if (hasThird && youCount > 0 && perceptCount === youCount) return '②被观察的第三人';
  if (hasThird && youCount <= 3 && perceptCount > 0) return '混合';
  return '①我的经历';
}

// ---------------------------------------------------------------- 机器规则标记

const EM_DASH = /——|—/;
const SHORT_CLAUSE = /(?:^|[\n。！？])([^\n。！？，、；：""''（）()]{1,3})。/g;
const SHORT_OK = new Set([
  '也行', '行吧', '算了', '知道了', '知道', '好吧', '是的', '对', '嗯', '哦', '好', '行',
  '谢谢', '没事', '无所谓', '随便', '没问题', '真的', '假的', '是吗', '对吧', '干嘛',
  '怎么', '什么', '哪儿', '谁', '为什么',
]);

function shortHits(blob: string): string[] {
  const out: string[] = [];
  SHORT_CLAUSE.lastIndex = 0;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = SHORT_CLAUSE.exec(blob))) {
    const s = m[1].trim();
    if (!s || seen.has(s) || SHORT_OK.has(s)) continue;
    if (/[吧呢啊嘛啦哦嗯噢]$/.test(s)) continue;
    seen.add(s);
    const n = [...s].length;
    if (n <= 3) out.push(s);
  }
  return out;
}

/** body 里「我/你 + 动作」且只有部分选项做它 → 疑似把选项行动写进左页 */
const LEFT_VERBS = [
  '敲', '烧', '推', '开', '关', '拿', '翻', '压', '试', '切', '断', '撕', '写', '数',
  '跑', '爬', '摸', '抓', '拽', '扔', '藏', '搬', '拆', '装', '修', '换', '洗',
  '吃', '喝', '锁', '插', '拔', '挂', '贴', '盖', '灌', '填', '补', '封', '堵',
  '喊', '叫', '接', '站', '坐', '躺', '走', '进', '出',
];

function leftPageHits(body: string, choices: { id: string; label?: string }[]): string[] {
  if (!body) return [];
  const real = choices.filter((c) => c.id !== 'skip' && c.id !== 'pass' && c.label);
  if (real.length < 2) return [];
  const out: string[] = [];
  for (const verb of LEFT_VERBS) {
    const re = new RegExp('(?:我|你)(?:把|给|了|着|过|要|去|来|上|下|回|再|又|也|都|就|先|得)*' + verb);
    const m = re.exec(body);
    if (!m) continue;
    const before = body.slice(0, m.index);
    if ((before.match(/["“”]/g) ?? []).length % 2 === 1) continue;
    const withVerb = real.filter((c) => c.label!.includes(verb));
    if (withVerb.length === 0 || withVerb.length === real.length) continue;
    out.push(`${verb}（${withVerb.length}/${real.length} 个选项做）`);
  }
  return out;
}

// ---------------------------------------------------------------- 扫描

type Row = {
  id: string;
  kind: string;
  intensity: number;
  baseWeight: number;
  variants: number;
  chars: number;
  cls: Cls;
  /** 需要动笔的行数（body 里含"你"） */
  youLines: number;
  tones: string[];
  flags: string[];
};

const rows: Row[] = [];

for (const f of ALL_FAMILIES as any[]) {
  const allBodies: string[] = [];
  const allTitles: string[] = [];
  let chars = 0;
  let youLines = 0;
  let clsCount: Record<string, number> = {};
  let flags: string[] = [];

  for (const v of f.variants ?? []) {
    const body: string = v.body ?? '';
    const title: string = v.title ?? '';
    allBodies.push(body);
    allTitles.push(title);
    chars += [...body].length + [...title].length;
    if (body.includes('你')) youLines++;
    const c = classify(body, title);
    clsCount[c] = (clsCount[c] ?? 0) + 1;

    // ⚠ 必须含 effect.log / check.ok.log / check.bad.log —— 破折号全部藏在这里
    // （lint-content.ts 的 blob 也是含 log 的；漏了就得到"破折号 0"的假结果）
    const blob = [
      title,
      body,
      ...(v.choices ?? []).flatMap((x: any) => [
        x.label ?? '',
        x.note ?? '',
        x.effect?.log ?? '',
        x.check?.ok?.log ?? '',
        x.check?.bad?.log ?? '',
      ]),
    ].join('\n');
    if (EM_DASH.test(blob)) flags.push('破折号');
    const sh = shortHits(blob);
    if (sh.length) flags.push('短陈述:' + sh.join(','));
    const lp = leftPageHits(body, v.choices ?? []);
    if (lp.length) flags.push('左页:' + lp.join(','));
  }

  // 主导类别
  const cls = (Object.entries(clsCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '③无人面白描') as Cls;
  flags = [...new Set(flags)];

  rows.push({
    id: f.id,
    kind: f.kind,
    intensity: f.intensity,
    baseWeight: f.baseWeight,
    variants: (f.variants ?? []).length,
    chars,
    cls,
    youLines,
    tones: [TONE[f.kind]?.base ?? '', INTENSITY[f.intensity] ?? ''],
    flags,
  });
}

// ---------------------------------------------------------------- 统计

const randomPool = rows.filter((r) => r.baseWeight > 0);
const totalChars = rows.reduce((a, r) => a + r.chars, 0);
const randomChars = randomPool.reduce((a, r) => a + r.chars, 0);
const needWork = rows.filter((r) => r.youLines > 0);
const needWorkChars = needWork.reduce((a, r) => a + r.chars, 0);

const byCls = new Map<string, number>();
for (const r of rows) byCls.set(r.cls, (byCls.get(r.cls) ?? 0) + 1);

const byKind = new Map<string, number>();
for (const r of rows) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);

console.log('===== 全量基调表 =====');
console.log(`家族 ${rows.length} · 变体 ${rows.reduce((a, r) => a + r.variants, 0)}`);
console.log(`总可见字数（title+body）${totalChars}`);
console.log(`其中随机池（baseWeight>0）${randomPool.length} 家族 / ${randomChars} 字`);
console.log('');
console.log('--- 三类「你」分布（按家族主导类别）---');
for (const [c, n] of [...byCls.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${c}  ${n} 个家族`);
}
console.log('');
console.log(`★ 真实需要动笔（body 含「你」）的家族 ${needWork.length} 个 / ${needWorkChars} 字`);
console.log(`   （占比 ${((needWork.length / rows.length) * 100).toFixed(0)}% 家族、${((needWorkChars / totalChars) * 100).toFixed(0)}% 字数）`);
console.log('');
console.log('--- kind 分布 ---');
for (const [k, n] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) {
  const t = TONE[k];
  console.log(`  ${k.padEnd(12)} ${String(n).padStart(3)} 个   吐槽${t?.quip}   基调：${t?.base}`);
}
console.log('');
const flagCount = { 破折号: 0, 短陈述: 0, 左页: 0 };
for (const r of rows) for (const fl of r.flags) {
  if (fl.startsWith('破折号')) flagCount.破折号++;
  else if (fl.startsWith('短陈述')) flagCount.短陈述++;
  else if (fl.startsWith('左页')) flagCount.左页++;
}
console.log('--- 机器规则命中家族数 ---');
console.log(`  破折号 ${flagCount.破折号} · 短陈述 ${flagCount.短陈述} · 左页疑似 ${flagCount.左页}`);

// ---------------------------------------------------------------- HTML

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

const grouped = new Map<string, Row[]>();
for (const r of rows) {
  if (!grouped.has(r.kind)) grouped.set(r.kind, []);
  grouped.get(r.kind)!.push(r);
}

let html = `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">
<title>第一人称改造 · 全量基调表</title>
<style>
:root{--bg:#1a1815;--panel:#242019;--ink:#e8e0d2;--dim:#9a8f7d;--line:#3a332a;--red:#c1554a;--amber:#c9a227;--green:#7a9a6a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.7 "PingFang SC","Microsoft YaHei",sans-serif;padding:32px 28px 80px}
h1{font-size:22px;margin:0 0 6px;font-weight:600}
h2{font-size:16px;margin:34px 0 12px;padding-bottom:7px;border-bottom:1px solid var(--line);color:#f0e8da}
.sub{color:var(--dim);font-size:12.5px;margin-bottom:26px}
.cards{display:flex;flex-wrap:wrap;gap:12px;margin:18px 0 8px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px 18px;min-width:150px}
.card .n{font-size:26px;font-weight:600;line-height:1.1}
.card .l{color:var(--dim);font-size:12px;margin-top:5px}
table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}
th{text-align:left;color:var(--dim);font-weight:500;padding:8px 10px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--bg)}
td{padding:8px 10px;border-bottom:1px solid #2a251e;vertical-align:top}
tr:hover td{background:#221e18}
.id{font-family:Consolas,monospace;font-size:12px;color:#d8cfbe}
.kind{font-size:11px;padding:2px 7px;border-radius:9px;background:#2e282153;border:1px solid var(--line);white-space:nowrap}
.q-高{color:var(--red)}.q-中{color:var(--amber)}.q-低{color:var(--green)}
.cls{font-size:11.5px;white-space:nowrap}
.cls-1{color:var(--red)}.cls-2{color:var(--amber)}.cls-3{color:var(--dim)}.cls-混{color:#8a7fb0}
.flag{font-size:11px;color:#c1554a;background:#3a1f1c55;border:1px solid #5a302a;border-radius:4px;padding:1px 6px;margin-right:4px;display:inline-block;margin-bottom:3px}
.tone{color:var(--dim);font-size:12px}
.note{background:var(--panel);border-left:3px solid var(--amber);padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;font-size:13px;color:#d6cdbe}
</style></head><body>
<h1>第一人称改造 · 全量基调表</h1>
<div class="sub">按 kind × intensity 定基调 · 三类「你」分类 · 机器规则命中。生成自 <code>scripts/fp-tone-table.ts</code></div>

<div class="cards">
  <div class="card"><div class="n">${rows.length}</div><div class="l">家族总数</div></div>
  <div class="card"><div class="n">${rows.reduce((a, r) => a + r.variants, 0)}</div><div class="l">变体</div></div>
  <div class="card"><div class="n">${totalChars.toLocaleString()}</div><div class="l">总可见字数</div></div>
  <div class="card"><div class="n">${needWork.length}</div><div class="l">需动笔家族</div></div>
  <div class="card"><div class="n">${randomPool.length}</div><div class="l">随机池家族</div></div>
</div>

<div class="note">
<b>★ 关键：真实改写量远小于"全库行数"。</b><br>
按三类「你」分类后，只有 <b>${needWork.length} 个家族</b>（${((needWork.length / rows.length) * 100).toFixed(0)}%）
的 body 里出现「你」，需要动笔。<br>
主导类别为「②被观察的第三人」和「③无人面白描」的家族（如 <code>ws_dead_radio_man</code>），
<b>人称几乎不用动</b>，只需检查语法规则（短陈述/破折号/左页）。
</div>

<h2>三类「你」分布</h2>
<table><tr><th>类别</th><th>家族数</th><th>说明</th></tr>
${[...byCls.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => {
  const desc = c === '①我的经历' ? '主体是"我"→ 必改人称'
    : c === '②被观察的第三人' ? '被观察的是第三人 → 保留"他"，只改"我看着他"'
    : c === '③无人面白描' ? '无人称场面 → 不动'
    : '两种情况混在一起 → 逐句判';
  return `<tr><td class="cls cls-${c[1] === '混' ? '混' : c[1]}">${esc(c)}</td><td>${n}</td><td class="tone">${desc}</td></tr>`;
}).join('')}
</table>

<h2>kind × 基调</h2>
<table><tr><th>kind</th><th>家族</th><th>吐槽</th><th>天然基调</th><th>日记里的人格</th></tr>
${[...byKind.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => {
  const t = TONE[k];
  return `<tr><td><span class="kind">${esc(k)}</span></td><td>${n}</td><td class="q-${t?.quip}">${t?.quip}</td><td class="tone">${esc(t?.base ?? '')}</td><td class="tone">${esc(t?.persona ?? '')}</td></tr>`;
}).join('')}
</table>

<h2>全量家族（${rows.length}）</h2>
<table><tr>
<th style="width:210px">家族</th><th style="width:74px">kind</th><th style="width:52px">强度</th>
<th style="width:56px">权重</th><th style="width:96px">三类「你」</th><th>基调 / 机器规则</th>
</tr>
${[...rows].sort((a, b) => a.kind.localeCompare(b.kind) || b.baseWeight - a.baseWeight).map((r) => {
  const t = TONE[r.kind];
  const clsKey = r.cls[1] === '混' ? '混' : r.cls[1];
  return `<tr>
<td class="id">${esc(r.id)}<br><span class="tone">${r.variants} 变体 · ${r.chars} 字${r.youLines ? '' : ' <b style="color:#7a9a6a">无你</b>'}</span></td>
<td><span class="kind">${esc(r.kind)}</span></td>
<td>${r.intensity}</td>
<td>${r.baseWeight>0 ? r.baseWeight : '<span class="tone">链条</span>'}</td>
<td class="cls cls-${clsKey}">${esc(r.cls)}</td>
<td><span class="tone">${esc(INTENSITY[r.intensity] ?? '')} · 吐槽${t?.quip}</span>
${r.flags.length ? '<br>' + r.flags.map((f) => `<span class="flag">${esc(f)}</span>`).join('') : ''}</td>
</tr>`;
}).join('')}
</table>
</body></html>`;

mkdirSync('.preview', { recursive: true });
writeFileSync('.preview/fp-tone-table.html', html, 'utf8');
console.log('\n→ .preview/fp-tone-table.html');
