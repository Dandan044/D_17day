"""把 ImageGen 出的「热点实物近景」做成 diegetic 浮层用的虚焦景深底图。

用法：
    python scripts/make-art-scene-inset.py night      # → public/art/scene-night-bed.jpg
    python scripts/make-art-scene-inset.py body       # → public/art/scene-body-kit.jpg

为什么需要这一步（而不是直接把生成图拷进 public/art）：

1. **右下角水印**：ImageGen 成图右下角烤了「AI生成 WORKBUDDY」（约底部 7%、右下 12%）。
   和 make-art-paper.py 一样对称裁一圈最省事，但这里不能裁满圈——底图是"从某个机位看过去"
   的实景，四边都裁会把构图压窄。水印只在底边，所以只裁底边那一条。
2. **压暗**：这两个面板的底图最终被 CSS 用 `blur() brightness(.33)` 虚焦成景深，
   但虚焦层的亮度是按 scene-home-*.jpg 调的。生成图（尤其海报质感的那张）整体比原场景亮
   一大截，直接进去会虚焦成一片灰白、纸浮不上去。所以在这里按同一档目标亮度压齐。
3. **左右不留白边**：生成图左右边缘偶尔带一点相框式的暗角（模型爱加），按比例左右各切一点。

**不做的事**：不裁成 16:9、不做对称裁切、不动色相——底图的比例交给 CSS 的 cover，
纸面才对折痕位置有要求（那两张走 make-art-paper.py）。
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
GEN = ROOT / ".preview" / "gen"

# kind -> (源目录, 输出文件, 底边裁切比例, 左右各裁比例, 目标相对亮度, 去饱和, 对比)
# 目标亮度：scene-home-side.jpg 的 L≈0.047（平均灰 64），虚焦 brightness(.33) 后约 21。
# 这两个近景（灯下的床 / 吊灯直射的药箱）本就比全景亮，压到和全景同一档会把实物轮廓压没；
# 目标定在平均灰 ~95（虚焦后 ~31，约全景的 1.5 倍）——能辨认出床与药箱，又不至于比图纸屏亮一截。
SCENES: dict[str, tuple[str, str, float, float, float, float, float]] = {
    "night": ("scene-night-bed", "scene-night-bed.jpg", 0.085, 0.012, 0.09, 0.10, 1.04),
    "body": ("scene-body-kit", "scene-body-kit.jpg", 0.085, 0.012, 0.12, 0.08, 1.04),
}


def rel_lum(img: Image.Image) -> float:
    a = np.asarray(img.convert("RGB")).astype(np.float32) / 255.0
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    return float((0.2126 * lin[:, :, 0] + 0.7152 * lin[:, :, 1] + 0.0722 * lin[:, :, 2]).mean())


def normalize(im: Image.Image, target_lum: float) -> Image.Image:
    gray = np.asarray(im.convert("L")).astype(np.float32)
    cur = float(gray.mean()) / 255.0
    target = target_lum ** (1 / 2.2)
    gain = target / max(cur, 1e-6)
    print(f"  定标：平均灰 {cur * 255:.0f} → 目标 {target * 255:.0f}（gain {gain:.3f}）")
    arr = np.asarray(im).astype(np.float32) * gain
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def main() -> None:
    kind = sys.argv[1] if len(sys.argv) > 1 else ""
    if kind not in SCENES:
        sys.exit(f"用法: python scripts/make-art-scene-inset.py <{'|'.join(SCENES)}>")

    src_dir, out_name, crop_bottom, crop_side, target_lum, desat, contrast = SCENES[kind]
    srcs = sorted((GEN / src_dir).glob("*.png"), key=lambda p: p.stat().st_mtime)
    if not srcs:
        sys.exit(f"缺原始图：{GEN / src_dir}/*.png")
    src = srcs[-1]

    im = Image.open(src).convert("RGB")
    w, h = im.size
    print(f"[{kind}] 源 {src.name[:40]}… {w}x{h}  L={rel_lum(im):.3f}")

    dx = int(w * crop_side)
    im = im.crop((dx, 0, w - dx, h - int(h * crop_bottom)))
    im = normalize(im, target_lum)
    im = ImageEnhance.Color(im).enhance(1 - desat)
    im = ImageEnhance.Contrast(im).enhance(contrast)

    out = ROOT / "public" / "art" / out_name
    im.save(out, "JPEG", quality=88)
    print(f"  已写入 public/art/{out_name}  {im.size[0]}x{im.size[1]}  L={rel_lum(im):.3f}")


if __name__ == "__main__":
    main()
