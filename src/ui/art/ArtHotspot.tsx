import type { CSSProperties, ReactNode } from 'react';

import { hideBrokenImg } from './skin';

/** 从整图扣下来的物件：叠回原位，光晕走透明轮廓。 */
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
}) {
  if (hidden) return null;
  return (
    <button type="button" className="art-cut" style={{ left, top, width, height }} onClick={onClick}>
      <svg className="art-cut-svg" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
        <image href={src} width="1" height="1" preserveAspectRatio="none" pointerEvents="visiblePainted" />
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
      <img src={src} alt="" onError={hideBrokenImg} />
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
        <img className="art-frame-photo" src={src} alt="" />
        {children}
      </div>
    </div>
  );
}

