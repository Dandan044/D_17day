import type { CSSProperties } from 'react';

/**
 * 手绘线稿 + 「背后垫色块」表示比例。
 *
 * 线稿与 `-mask` 成对使用：**填充层在下、线稿在上**，色块被 mask 裁进形状内部
 * （不裁的话线稿是白底、轮廓之外也透明，颜色会从形状外面渗出来糊成一片）。
 * **父层不带 z-index**——定位元素一旦有 z-index 就形成 stacking context（隔离组），
 * 里面的 mask/clip 会失效，表现是「色块糊成一片、形状边界全无」（踩过）。
 *
 * 本文件原先内嵌在 `ArtPlanSheet.tsx` 里，抽出来是因为「清点单」与「过夜结算」
 * 也要用同一套线稿（水瓶堆 / 罐头金字塔 / 温度计 / 发电机—蓄电池），
 * 而 CSS 填色引擎只有一份，不该抄第二份。
 *
 * 用法见 `HANDOFF` 类文档：填色量一律传 0..1，`clip` 只在「一张线稿要分给两个形状」时用
 * （先例：发电机与蓄电池共用 `line-power`，按 `linefigLayout.json` 的 `split` 各占一半）。
 */

/** 线稿本体的墨色是烤进 PNG 的 `INK=(43,56,78)`，这里只负责垫色与裁形。 */
export function LineFig({
  line,
  mask,
  aspect,
  fills,
  className,
}: {
  line: string;
  mask: string;
  /** 线稿的宽高比，来自 `linefigLayout.json`，**不要手填**：water 是竖图（0.8714）。 */
  aspect: number;
  fills: Array<{ from: number; to: number; color: string; clip?: string }>;
  className?: string;
}) {
  return (
    <span className={className ? `art-lfig ${className}` : 'art-lfig'} style={{ aspectRatio: String(aspect) }}>
      {fills.map((f, i) => (
        <span
          key={i}
          className="art-lfig-fill"
          style={
            {
              maskImage: `url(${mask})`,
              WebkitMaskImage: `url(${mask})`,
              clipPath: f.clip,
              '--fill-b': `${Math.max(0, Math.min(1, Math.min(f.from, f.to))) * 100}%`,
              '--fill-h': `${Math.max(0, Math.min(1, Math.abs(f.to - f.from))) * 100}%`,
              '--fill-c': f.color,
            } as CSSProperties
          }
        >
          <i />
        </span>
      ))}
      <img className="art-lfig-line" src={line} alt="" />
    </span>
  );
}

/* ============================================================
   温度刻度：温度计与过夜温差图共用
   ============================================================ */

// 温度计刻度**固化**成 -40..+40，但**不再线性**：0~+40 是天天用到的区间（舒适 16°/生存 4°/灾前 18°），
// 给它最大的间距；0~-40 只在后期核冬天才到，越往下越挤（刻度越密）。于是 0° 被抬到管腔 35% 处，
// 下半段用一个幂函数压扁。填色 / 刻度线 / 刻度数字 / 生存舒适线 / 两根针**全部**经这一支函数，
// 天然对齐——不会出现"线、色、针各走各的"。
export const SCALE_MIN = -40;
export const SCALE_MAX = 40;
export const ZERO_PCT = 35; // 0° 落在管腔 35% 高度
const COLD_POW = 13 / 7; // ≈1.857：使 0° 处上下两段导数相等（1.625 %/°），视觉上不断折

/** 温度 → 管腔高度百分比。**任何**要落在温度计上的东西都必须经这里换算。 */
export function scalePct(temp: number): number {
  const t = Math.max(SCALE_MIN, Math.min(SCALE_MAX, temp));
  if (t >= 0) return ZERO_PCT + (t / SCALE_MAX) * (100 - ZERO_PCT);
  // (t+40)/40 ∈ [0,1]：0=极寒、1=冰点。指数 >1 → 越靠冰点间距越大、越靠 -40 越密
  return ZERO_PCT * Math.pow((t - SCALE_MIN) / (0 - SCALE_MIN), COLD_POW);
}

/** 刻度尺要画的温度点（每 5°），整 10° 为长刻度 */
export const THERMO_TICKS = Array.from({ length: 17 }, (_, i) => SCALE_MIN + i * 5);
