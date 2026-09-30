import { useId } from 'react';

import { HEALTH } from '../../game/balance';
import { t } from '../../game/copy/t';
import { PART_ANCHOR, type BodyMapAgg, type BodyPartId } from './bodyParts';
import './art.css';

/**
 * 人体轮廓图：把「哪个部位、多严重、叫什么」一次画出来。
 *
 * ## 为什么是手写 SVG 而不是位图
 *
 * 病灶位置与深浅必须**跟着存档变**。位图做不到：每加一条疾病就要出一张图，
 * 而疾病是 23 条、可以任意叠加。手写 path 则是一条状态点亮一个 `<path>`，
 * 组合数再大也不用新增素材。风格上跟 `make-art-linefig.py` 那套线稿同族
 * （`INK=(43,56,78)` 描边、无渐变），所以它放在米黄卡纸上与线稿四件套是一个笔迹。
 *
 * ## 坐标系
 *
 * `viewBox 0 0 320 340`。人体本体画在 **200×340 的局部坐标**里（与 `bodyParts.ts`
 * 的 `PART_ANCHOR` 同一套数字），整组 `translate(60, 16)` 右移下移：
 * 右移是为了给左右两列标注各腾出 100 单位，下移是为了给颅环上面那行理智读数让位。
 * 想改人体造型只动 `PART_SHAPE`；想改锚点只动 `bodyParts.ts`。
 *
 * ## 三条呈现规则（都来自方案，改动前先读）
 *
 * 1. **同部位取 `max`，不相加**——`aggregateBodyParts` 已经做完，这里只负责涂。
 * 2. **`skin` 是整身底色，不透明度砍半**。它语义是「全身」，若与器官同档涂满，
 *    会把上面所有器官的线压没；砍半后读作「整身有反应」，器官仍是主角。
 * 3. **标注两列各自 y 单调**（按锚点 y 排序后逐条下推），所以引线零交叉。
 *    引线是「标注 → 器官」的斜线，落在人体轮廓上是对的——这是临床解剖图的标准画法。
 *
 * ## 视觉验证
 *
 * `.preview/body/body.html` 是离线预览页（不经过游戏），改完造型先看它再跑游戏。
 */

/** 人体本体画在 200×340 的局部坐标里（与 `bodyParts.ts` 的 `PART_ANCHOR` 同一套数字）。 */
const LOCAL = { w: 200, h: 340 };
/** 整组位移：右移给标注列腾地方，下移给颅环读数腾地方。 */
const DX = 94;
const DY = 16;
/**
 * 视框宽高比 **故意做成 388:340 ≈ 1.14**，与真实的图列容器（约 524×460）同比例。
 *
 * 为什么不能随便定：SVG 里的 `font-size` 是**视框单位**，会跟着 viewBox 的缩放一起放大。
 * 视框定窄了（比如 240 宽），缩放到 524px 时字号会变成 20px 以上，标注比人体还抢眼；
 * 定宽了则标注越界。所以宽度是按「200 的人体 + 两侧各一个 6 字病名」反推出来的：
 * `200 + 2 × (9.5 × 6 + 12) ≈ 388`。改字号或改人体宽窄，这个数要跟着重算。
 */
const VIEW = { w: 388, h: 340 };

/** 强度 1..5 → 填充不透明度。轻微是「有反应」，5 档是「快糊了」。 */
const HEAT_ALPHA = [0.16, 0.3, 0.46, 0.64, 0.82];
/** `skin` 的整身底色：同档砍半，否则盖住器官的线。 */
const SKIN_DAMP = 0.5;

/**
 * 12 个部位的路径。**顺序不等于绘制顺序**（见 `DRAW_ORDER`）。
 *
 * 造型是正面站姿的折面示意图，不写实：关节处有硬折、四肢是锥形带，
 * 为的是在 300px 宽的实际渲染尺寸下还能一眼分出部位。
 */
const PART_SHAPE: Record<BodyPartId, string> = {
  // 整身轮廓 = 头 + 躯干 + 双臂 + 双腿四条子路径合成。
  // 头/臂/腿这三条与下面各自部位的 d 逐字节相同，所以它们的描边完全重合，
  // 画出来不会多出「双重线」，只有躯干那条是本层独有的。
  skin:
    'M100 10 C112 10 121 21 121 34 C121 47 112 58 100 58 C88 58 79 47 79 34 C79 21 88 10 100 10 Z ' +
    'M92 70 L108 70 C119 70 127 72 131 78 C132 88 132 98 131 108 C130 120 124 128 123 136 ' +
    'C122 146 125 152 126 158 L74 158 C75 152 78 146 77 136 C76 128 70 120 69 108 ' +
    'C68 98 68 88 69 78 C73 72 81 70 92 70 Z ' +
    'M60 80 C57 92 56 108 55 126 C54 142 54 154 55 166 L67 166 C67 154 67 142 66 126 ' +
    'C65 108 66 94 74 84 C76 76 66 74 60 80 Z ' +
    'M140 80 C143 92 144 108 145 126 C146 142 146 154 145 166 L133 166 C133 154 133 142 134 126 ' +
    'C135 108 134 94 126 84 C124 76 134 74 140 80 Z ' +
    'M74 156 C67 164 65 194 65 222 C65 252 67 280 70 300 L92 300 C92 280 90 250 90 222 ' +
    'C90 194 92 166 96 158 Z ' +
    'M126 156 C133 164 135 194 135 222 C135 252 133 280 130 300 L108 300 C108 280 110 250 110 222 ' +
    'C110 194 108 166 104 158 Z',
  // 腿从骨盆线（y158）落到脚踝（y300）。膝盖处收 3 单位，别做成直筒。
  leg:
    'M74 156 C67 164 65 194 65 222 C65 252 67 280 70 300 L92 300 C92 280 90 250 90 222 C90 194 92 166 96 158 Z ' +
    'M126 156 C133 164 135 194 135 222 C135 252 133 280 130 300 L108 300 C108 280 110 250 110 222 C110 194 108 166 104 158 Z',
  // 手臂：上端有一条圆肩压在躯干肩角（y78 处 x69~131）里，往下收到 11 单位宽，
  // 与躯干之间始终留 3~7 单位纸缝——这缝就是「这是胳膊」的唯一线索。
  arm:
    'M60 80 C57 92 56 108 55 126 C54 142 54 154 55 166 L67 166 C67 154 67 142 66 126 ' +
    'C65 108 66 94 74 84 C76 76 66 74 60 80 Z ' +
    'M140 80 C143 92 144 108 145 126 C146 142 146 154 145 166 L133 166 C133 154 133 142 134 126 ' +
    'C135 108 134 94 126 84 C124 76 134 74 140 80 Z',
  hand:
    'M55 164 C49 168 47 176 48 182 C49 189 55 192 60 189 C65 186 67 177 66 168 Z ' +
    'M145 164 C151 168 153 176 152 182 C151 189 145 192 140 189 C135 186 133 177 134 168 Z',
  abdomen: 'M78 108 L122 108 L120 146 C119 154 81 154 80 146 Z',
  kidney:
    'M86 138 C92 136 95 142 94 148 C93 154 88 156 85 152 C82 148 82 140 86 138 Z ' +
    'M114 138 C120 136 123 142 122 148 C121 154 116 156 113 152 C110 148 110 140 114 138 Z',
  // 肺整片落在胸廓（x 69~131）以内，左右各留 2 单位。超出躯干就会读成「挂在体外的两个球」。
  lung:
    'M80 80 C74 84 71 95 72 108 C73 117 79 121 84 115 C89 109 91 94 89 84 C88 80 84 77 80 80 Z ' +
    'M120 80 C126 84 129 95 128 108 C127 117 121 121 116 115 C111 109 109 94 111 84 C112 80 116 77 120 80 Z',
  heart: 'M97 90 C105 90 109 97 108 104 C107 112 101 116 97 114 C92 112 88 106 89 98 C90 92 93 90 97 90 Z',
  // 颈：整条都躲在颅底那条弧下面（上边就是颅底圆弧本身），底边 y70 与躯干顶边同线。
  // 这样上下各只有一条线，不会在透明的头里露出两三条悬空横线。
  throat: 'M92 54.4 C95 57.8 105 57.8 108 54.4 L108 70 L92 70 Z',
  head: 'M100 10 C112 10 121 21 121 34 C121 47 112 58 100 58 C88 58 79 47 79 34 C79 21 88 10 100 10 Z',
  // 唇做扁（16×3.8）。与眼同高同宽会读成第三只眼。
  mouth: 'M92 44 C96 42.6 104 42.6 108 44 C104 46.4 96 46.4 92 44 Z',
  eyes:
    'M84 30 C87 27 93 27 96 30 C93 33 87 33 84 30 Z ' +
    'M104 30 C107 27 113 27 116 30 C113 33 107 33 104 30 Z',
};

/** 绘制顺序：底 → 顶。头必须在眼/唇之前，否则眼唇被头盖掉。 */
const DRAW_ORDER: readonly BodyPartId[] = [
  'skin',
  'leg',
  'arm',
  'hand',
  'abdomen',
  'kidney',
  'lung',
  'heart',
  'throat',
  'head',
  'mouth',
  'eyes',
];

/** 左列标注：贴着左臂外侧，右对齐；右列：贴着右臂外侧，左对齐。 */
const BUS_X = { L: 80, R: 308 };
const LABEL_ANCHOR = { L: 'end', R: 'start' } as const;
const LINE_H = 10.5;
const LINE_GAP = 11.5;
/** 标注最多三行，多出来的折成「等 N 项」——余量仍在右侧卡里，不丢信息。 */
const MAX_LINES = 3;

/** 颅环：环绕头部、开口朝上的进度弧。圆心跟 `PART_SHAPE.head` 同心（头在局部坐标 (100,34)）。 */
const RING = { cx: DX + LOCAL.w / 2, cy: DY + 34, r: 28, w: 2.6 };
const RING_C = 2 * Math.PI * RING.r;

interface Row {
  id: BodyPartId;
  names: string[];
  y: number;
}

/**
 * 把某一列的行按下推，保证块与块不重叠。
 *
 * 只推 y、不动锚点：引线因此会斜，斜率差就是「这条病拖了几天」的自然错位，
 * 反而比强行对齐好读。因为输入已按锚点 y 升序，输出 y 也单调 → 引线零交叉。
 */
function stack(ids: readonly BodyPartId[], agg: BodyMapAgg): Row[] {
  let bottom = -Infinity;
  const rows: Row[] = [];
  for (const id of ids) {
    const entry = agg.parts.get(id);
    if (!entry) continue;
    const names = entry.names.length <= MAX_LINES ? entry.names : entry.names.slice(0, MAX_LINES - 1);
    const extra = entry.names.length > MAX_LINES ? entry.names.length : 0;
    const lines = extra > 0 ? [...names, t('ui.game.figMore', { n: extra })] : names;
    const anchorY = DY + PART_ANCHOR[id].y;
    const y = Math.max(anchorY, bottom + LINE_GAP);
    bottom = y + (lines.length - 1) * LINE_H;
    rows.push({ id, names: lines, y });
  }
  return rows;
}

/** 一列：引线 + 端点小圆 + 逐行病名。 */
function Column({ side, rows, agg }: { side: 'L' | 'R'; rows: Row[]; agg: BodyMapAgg }) {
  const busX = BUS_X[side];
  const anchor = LABEL_ANCHOR[side];
  return (
    <g>
      {rows.map((row) => {
        const entry = agg.parts.get(row.id)!;
        const ax = DX + PART_ANCHOR[row.id].x;
        const ay = DY + PART_ANCHOR[row.id].y;
        return (
          <g key={row.id} className={entry.severe ? 'art-bmy-lead is-severe' : 'art-bmy-lead'}>
            <path d={`M${busX} ${row.y - 3.5} L${ax} ${ay}`} />
            <circle cx={ax} cy={ay} r="2.1" />
            <text className="art-bmy-lbl" x={busX} y={row.y} textAnchor={anchor}>
              {row.names.map((n, i) => (
                <tspan key={n} x={busX} dy={i === 0 ? 0 : LINE_H}>
                  {n}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/**
 * 颅环：理智流失的独立颜色通道。
 *
 * 分档阈值直接取 `HEALTH.SANITY_UNRELIABLE` / `SANITY_BREAK`（35 / 15），
 * **不是** `NotebookWear` 的 40 / 10 ——那一组是纸面污损的阈值，注释里明写「比机制早一档」。
 * 身体图是临床视图，必须与真正会掉 HP 的那条线同真源，否则会出现
 * 「纸已经撕了、环还是满的」这种假因果。
 */
function SanityRing({ sanity }: { sanity: number }) {
  const s = Math.max(0, Math.min(100, sanity));
  const tone = s < HEALTH.SANITY_BREAK ? 'is-break' : s < HEALTH.SANITY_UNRELIABLE ? 'is-warn' : 'is-ok';
  /** 阈值刻度：把「再掉多少就出事」直接画在环上，不用玩家记数字。 */
  const ticks = [HEALTH.SANITY_BREAK, HEALTH.SANITY_UNRELIABLE].map((v) => {
    const deg = -90 + 360 * (v / 100);
    const rad = (deg * Math.PI) / 180;
    return {
      v,
      x1: RING.cx + Math.cos(rad) * (RING.r - 4.5),
      y1: RING.cy + Math.sin(rad) * (RING.r - 4.5),
      x2: RING.cx + Math.cos(rad) * (RING.r + 4),
      y2: RING.cy + Math.sin(rad) * (RING.r + 4),
    };
  });
  return (
    <g className={`art-bmy-ringg ${tone}`}>
      <circle className="art-bmy-ring" cx={RING.cx} cy={RING.cy} r={RING.r} />
      <circle
        className="art-bmy-ring is-val"
        cx={RING.cx}
        cy={RING.cy}
        r={RING.r}
        strokeDasharray={`${(RING_C * s) / 100} ${RING_C}`}
        transform={`rotate(-90 ${RING.cx} ${RING.cy})`}
      />
      {ticks.map((k) => (
        <line key={k.v} className="art-bmy-tick" x1={k.x1} y1={k.y1} x2={k.x2} y2={k.y2} />
      ))}
      <text className="art-bmy-sanity" x={RING.cx} y="14" textAnchor="middle">
        <tspan className="art-bmy-sanity-k">{t('ui.game.sanityRing')}</tspan>
        <tspan className="art-bmy-sanity-v" dx="5">
          {Math.round(s)}
        </tspan>
      </text>
    </g>
  );
}

export function BodyMap({ agg, sanity, className }: { agg: BodyMapAgg; sanity: number; className?: string }) {
  const uid = useId().replace(/[:]/g, '');
  const hatchId = `art-bmy-hatch-${uid}`;

  // 左右分列后各按锚点 y 升序 —— 这是「引线零交叉」的前提。
  // 注意：必须真的 sort 一次，不能指望 DRAW_ORDER 恰好是竖着的。
  // （DRAW_ORDER 按的是绘制层序，skin 在底、eyes 在顶，跟 y 没有关系。）
  const byAnchorY = (a: BodyPartId, b: BodyPartId) => PART_ANCHOR[a].y - PART_ANCHOR[b].y;
  const rowsL = stack(DRAW_ORDER.filter((id) => PART_ANCHOR[id].side === 'L').sort(byAnchorY), agg);
  const rowsR = stack(DRAW_ORDER.filter((id) => PART_ANCHOR[id].side === 'R').sort(byAnchorY), agg);

  return (
    <div className={className ? `art-bmy ${className}` : 'art-bmy'}>
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} role="img" aria-label={t('ui.game.figHint')}>
        <defs>
          <pattern
            id={hatchId}
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line className="art-bmy-hatchline" x1="0" y1="0" x2="0" y2="7" />
          </pattern>
        </defs>

        <g transform={`translate(${DX} ${DY})`}>
          {DRAW_ORDER.map((id) => {
            const entry = agg.parts.get(id);
            const cls = ['art-bmy-part', id === 'skin' ? 'is-skin' : '', entry?.conditional ? 'is-cond' : 'is-hot']
              .filter(Boolean)
              .join(' ');
            let alpha = 0;
            if (entry) {
              alpha = HEAT_ALPHA[Math.max(0, Math.min(4, entry.heat - 1))]! * (id === 'skin' ? SKIN_DAMP : 1);
            }
            return (
              <g key={id}>
                {/* data-part / data-heat 是给断言脚本用的：12 个部位缺一个、
                    档位与填色对不上，肉眼很难发现（都是同一族暗红） */}
                <path className={cls} data-part={id} data-heat={entry?.heat ?? 0} d={PART_SHAPE[id]} fillOpacity={alpha} />
                {entry?.severe && (
                  <path className="art-bmy-hatch" d={PART_SHAPE[id]} fill={`url(#${hatchId})`} />
                )}
              </g>
            );
          })}
        </g>

        <g className="art-bmy-anno">
          <Column side="L" rows={rowsL} agg={agg} />
          <Column side="R" rows={rowsR} agg={agg} />
        </g>

        <SanityRing sanity={sanity} />
      </svg>

      {/* 图注：只有图上真有东西时才出。空身体配一句「底色越深病越重」是废话。 */}
      {(agg.parts.size > 0 || agg.unknown.length > 0 || agg.offBody.length > 0) && (
        <div className="art-bmy-foot">
          {agg.parts.size > 0 && <span className="art-bmy-hint">{t('ui.game.figHint')}</span>}
          {agg.unknown.length > 0 && (
            <span className="art-bmy-warn">{t('ui.game.figUnknown', { n: agg.unknown.length })}</span>
          )}
          {agg.offBody.length > 0 && (
            <span className="art-bmy-off">
              {t('ui.game.figOffBody', { n: agg.offBody.length, names: agg.offBody.join('、') })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
