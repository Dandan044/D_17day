/**
 * 按需审计：body（左页「发生了什么」）里是否藏了**本该属于选项的行动**。
 *
 * 为什么不做进 lint 闸门：这条判据是**语义**的（"这个动作是不是所有选项的共同前提"），
 * 不是词形的。词形匹配实测准确率约 1/9 —— 会把「纸条上写的字」「接水盆」「读数」
 * 「别人在拆家具」全误伤。刷成噪音后没人再看警告，比没有检查更糟。
 *
 * 所以：**这条铁律靠改写时的人工自检**（见 docs/content-voice.md 第二轮之四）。
 * 本脚本只在做改造批次时按需跑，用来圈出「值得人肉看一眼」的候选。
 *
 * 跑法：npx tsx scripts/audit-left-page.ts
 *
 * 降噪策略：只报**动作紧跟在第一/第二人称主语之后**的（「你敲」「我烧」），
 * 滤掉名词巧合（接水盆/读数）、引用（纸条上写着"敲三下"）、他人动作（有人在拆）。
 */
import { ALL_FAMILIES } from '../src/game/content/events';

const VERBS = [
  '敲', '烧', '推', '开', '关', '拿', '翻', '压', '试', '切', '断', '撕', '写', '数',
  '跑', '爬', '摸', '抓', '拽', '扔', '藏', '搬', '拆', '装', '修', '换', '洗',
  '吃', '喝', '锁', '插', '拔', '挂', '贴', '盖', '灌', '填', '补', '封', '堵',
  '喊', '叫', '接', '站', '坐', '躺', '走', '进', '出',
];

/** 主语 + 可选虚词 + 动作，且主语必须是"我/你"（排除别人、排除名词） */
const SUBJ = '(?:我|你)';
const PARTICLES = '(?:把|给|了|着|过|要|去|来|上|下|回|再|又|也|都|就|先|得)*(?:一点|一点|一壶|一盆|一张|一遍|一下|两下|三下)?';

type Hit = {
  fam: string;
  variant: string;
  verb: string;
  snippet: string;
  /** label 里带这个动作的选项 */
  choices: string[];
  total: number;
};

const hits: Hit[] = [];
let scanned = 0;

for (const f of ALL_FAMILIES as any[]) {
  for (const v of f.variants ?? []) {
    const body: string = v.body ?? '';
    if (!body) continue;
    scanned++;
    const real = (v.choices ?? []).filter(
      (c: any) => c.id !== 'skip' && c.id !== 'pass' && c.label,
    );
    if (real.length < 2) continue;

    for (const verb of VERBS) {
      // body 里：「我/你 …… 动作」（人称主语直接带这个动作）
      const re = new RegExp(SUBJ + PARTICLES + verb);
      const m = re.exec(body);
      if (!m) continue;

      // 引号内的内容不算（纸条上写的字、别人说的话）
      const before = body.slice(0, m.index);
      const quotes = (before.match(/["“”]/g) ?? []).length;
      if (quotes % 2 === 1) continue; // 处在引号内部

      const withVerb = real.filter((c: any) => c.label.includes(verb));
      if (withVerb.length === 0 || withVerb.length === real.length) continue;

      hits.push({
        fam: f.id,
        variant: v.id,
        verb,
        snippet: body.slice(Math.max(0, m.index - 10), m.index + 16).replace(/\n/g, ' ⏎ '),
        choices: withVerb.map((c: any) => c.id),
        total: real.length,
      });
    }
  }
}

const byFam = new Map<string, Hit[]>();
for (const h of hits) {
  if (!byFam.has(h.fam)) byFam.set(h.fam, []);
  byFam.get(h.fam)!.push(h);
}

console.log(
  `[左页审计] 扫了 ${scanned} 个变体；候选 ${byFam.size} 个家族 / ${hits.length} 处\n` +
    `（判据：body 里「我/你 + 动作」，且该动作只被部分选项做 → 疑似替玩家做决定）\n` +
    `⚠ 已降噪但仍需人肉判：可能是"共同前提"（B 型，合法）或引用/他人动作\n`,
);

for (const fam of [...byFam.keys()].sort()) {
  console.log(`  ${fam}`);
  for (const h of byFam.get(fam)!) {
    console.log(
      `      「${h.verb}」 只有 ${h.choices.length}/${h.total} 个选项做它（${h.choices.join('/')}）`,
    );
    console.log(`          body：…${h.snippet}…`);
  }
}
