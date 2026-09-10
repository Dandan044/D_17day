import { useId, type CSSProperties, type ReactNode } from 'react';

import { hideBrokenImg, type ArtPoly } from './skin';

/** 从整图扣下来的物件：叠回原位，光晕走透明轮廓。
 *  poly 存在时：clipPath 同时约束命中与发光轮廓（多个环取并集），
 *  透明留白不再可点；svg 盒的 pointer-events 由 .is-clipped 关闭，
 *  命中只剩被裁剪的 image 本体，hover 经祖先传播到 button，发光/tooltip 不变。 */
export function ArtCutout({
  left,
  top,
  width,
  height,
  src,
  label,
  sub,
  onClick,
  hidden,
  pulse,
  locked,
  poly,
  tier,
}: {
  left: string;
  top: string;
  width: string;
  height: string;
  src: string;
  label: string;
  sub?: string;
  onClick?: () => void;
  hidden?: boolean;
  pulse?: boolean;
  locked?: boolean;
  poly?: ArtPoly;
  /** 待办警戒级：本子轮廓常亮同色描边（橙/红），悬停白光晕仍会临时覆盖。 */
  tier?: 'red' | 'orange';
}) {
  const rawId = useId();
  const clipId = 'art-clip-' + rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (hidden) return null;
  return (
    <button
      type="button"
      className={`art-cut${poly ? ' is-clipped' : ''}${pulse ? ' is-pulse' : ''}${locked ? ' is-off' : ''}${tier ? ` is-tier-${tier}` : ''}`}
      style={{ left, top, width, height }}
      onClick={onClick}
    >
      <svg className="art-cut-svg" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
        {poly && (
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            {poly.map((ring, i) => (
              <polygon key={i} points={ring.map(([x, y]) => `${x},${y}`).join(' ')} />
            ))}
          </clipPath>
        )}
        <image
          href={src}
          width="1"
          height="1"
          preserveAspectRatio="none"
          pointerEvents="visiblePainted"
          clipPath={poly ? `url(#${clipId})` : undefined}
        />
      </svg>
      <span className="art-spot-tip">
        {label}
        {sub ? <em>{sub}</em> : null}
      </span>
    </button>
  );
}

/** 静物照片当作桌面上的档案 / 包裹，悬停出名称。 */
export function ArtFile({
  left,
  top,
  width,
  src,
  label,
  sub,
  onClick,
  disabled,
  selected,
  rot,
}: {
  left: string;
  top: string;
  width: string;
  src: string;
  label: string;
  sub?: string;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  rot?: string;
}) {
  const style: CSSProperties = {
    left,
    top,
    width,
    transform: `translate(-50%, -50%) rotate(${rot ?? '0deg'})`,
  };
  return (
    <button
      type="button"
      className={`art-file ${selected ? 'is-on' : ''} ${disabled ? 'is-off' : ''}`}
      style={style}
      disabled={disabled}
      onClick={onClick}
    >
      <img src={src} alt="" loading="lazy" decoding="async" onError={hideBrokenImg} />
      <span className="art-spot-tip">
        {label}
        {sub ? <em>{sub}</em> : null}
      </span>
    </button>
  );
}

export function ArtSceneFrame({ src, children }: { src: string; children: ReactNode }) {
  return (
    <div className="art-frame">
      <div className="art-frame-box">
        <img className="art-frame-photo" src={src} alt="" decoding="async" />
        {children}
      </div>
    </div>
  );
}

