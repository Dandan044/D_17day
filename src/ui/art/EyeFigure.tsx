import { useId } from 'react';

/**
 * 暴露度：一只逐渐睁开的眼睛。
 *
 * ## 为什么是眼睛
 *
 * 暴露度的来源是「外面有多少人知道这栋楼还住着人」——灯光漏出窗外 +5.5、
 * 柴油机噪音 +7、遮光帘每级 -6。这些事全都发生在**窗户**上，被看见的也是窗。
 * 所以档位不用数字条表示，用一只朝外看的眼睛：它睁开多少，就是这里被看得多清楚。
 *
 * ## 怎么做到「逐渐睁开」
 *
 * 关键约束：**SVG 的 `path d` 不能做 CSS 过渡**（改 `d` 是几何重算，浏览器不会插值），
 * 所以开合绝不能靠改路径。这里用两片**不透明的眼睑帘**——上帘的下沿、下帘的上沿
 * 都在 y=62（虹膜圆心高度），各自只做 `translateY`：
 *
 * - 上帘上移 `-30 × --eye-open`，下帘下移 `+22 × --eye-open`
 * - 两片帘与眼球一起被裁在眼裂（almond）内，**帘的颜色就是眼睑色**，
 *   所以「露出来的虹膜高度」就等于开度，不需要 mask、不需要改 `d`
 * - `transform` 与 `opacity` 是 SVG 元素上唯二可靠可过渡的属性
 *
 * 帘必须裁在眼裂内（而不是盖满整个 viewBox），否则睁大时上帘会在画布顶部
 * 糊出一整块矩形——这是这个画法唯一容易踩的地方。
 *
 * ## 五档
 *
 * 档位数**正好五档**，与 `EXPOSURE.TIERS = [22,45,66,84]` 一一对应，
 * 档名见 `copy/names.ts` 的 `TIER_NAMES`。瞳孔跟随档位从「视线避开」转到「正对锁定」——
 * 「被盯上了」这件事靠瞳孔朝向比靠开度更直接。
 */

/** 五档开度。0 档不是全闭：留一条缝比全黑更像「有人在看但还没看清」。 */
const OPEN = [0.1, 0.28, 0.48, 0.7, 0.94] as const;

/** 眼裂：四角 (24,62)/(176,62)，上弧峰 35、下弧底 89。 */
const APERTURE = 'M24 62C56 26 144 26 176 62C144 98 56 98 24 62Z';

export type EyeVariant = 'plain' | 'on-paper' | 'window';

export function EyeFigure({
  tier,
  size,
  variant = 'plain',
  label,
  className,
}: {
  /** 0..4，直接来自 `exposureTier()`。越界会被夹住。 */
  tier: number;
  /** 宽度。数字按 px，字符串原样用（窗浮层要给 `min(720px, 62vw)`）。 */
  size: number | string;
  variant?: EyeVariant;
  /** 可选图注（一般是档名）。给了才渲染。 */
  label?: string;
  className?: string;
}) {
  const uid = useId();
  const clipId = `art-eye-clip-${uid.replace(/[:]/g, '')}`;
  const t = Math.max(0, Math.min(4, Math.round(tier)));
  // 缩到 92px 时线宽只剩 0.74 个视框单位，会糊成一团——小图一律换成不缩放的描边
  const mini = typeof size === 'number' && size < 140;

  return (
    <span
      className={`art-eye is-${variant}${mini ? ' is-mini' : ''}${className ? ` ${className}` : ''}`}
      data-tier={t}
      style={{ width: typeof size === 'number' ? `${size}px` : size }}
    >
      <svg viewBox="0 0 200 132" role="img" aria-label={label ?? ''}>
        <defs>
          <clipPath id={clipId}>
            <path d={APERTURE} />
          </clipPath>
        </defs>

        {/* 眼内：眼球与两片眼睑同处一个裁剪域，帘才能准确盖住虹膜 */}
        <g clipPath={`url(#${clipId})`}>
          <circle className="art-eye-sclera" cx="100" cy="62" r="48" />
          <circle className="art-eye-iris" cx="100" cy="62" r="30" />
          <circle className="art-eye-iris-ring" cx="100" cy="62" r="29" />
          <circle className="art-eye-pupil" cx="100" cy="62" r="13" />
          <circle className="art-eye-glint" cx="89" cy="49" r="5" />
          <path className="art-eye-lid is-upper" d="M-40,-80 L240,-80 L240,62 L-40,62 Z" />
          <path className="art-eye-lid is-lower" d="M-40,62 L240,62 L240,210 L-40,210 Z" />
        </g>

        {/* 眼裂轮廓压在最上，保证边缘永远是利的一条线 */}
        <path className="art-eye-outline" d={APERTURE} />
      </svg>
      {label ? <span className="art-eye-cap">{label}</span> : null}
    </span>
  );
}

/** 供外部（如过夜图解的图例）复用的开度表，免得再抄一份。 */
export const EYE_OPEN = OPEN;
