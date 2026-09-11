"""把 ImageGen 生成的空白纸纹理裁好、定标到目标亮度，落盘成面板底图。

用法：
    python scripts/make-art-paper.py todo      # → public/art/paper-todo.jpg（笔记本内页）
    python scripts/make-art-paper.py plan      # → public/art/paper-plan.jpg（计划表纸）

为什么和三张纸各自的差异只在参数表里：两张都是"满幅空白纸 + 裁掉烤进图里的边框与水印 +
亮度定标"，逻辑完全相同，只有裁切比例、目标亮度、去饱和三处不同——所以合成一个脚本、
两种参数，而不是两个近乎重复的文件。（`make-shelter-paper.py` 保持独立：它已经上线并在
交接文档里引用，且多一步"量折痕十字"。）

**亮度定标是必须的**：面板文字用近黑墨，纸上正文要 ≥ 7:1。而靠 prompt 让模型"调暗/调亮"
不可靠（实测 img2img 保真太强，让它调暗反而更亮），所以在这里按公式算准。

**格线不在贴图里**：两个面板的横格线／列线都由 CSS 画（条目高度会随展开变化，
烤进贴图的线必然与内容错位）。所以这里生成的是完全空白的纸面。
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
GEN = ROOT / ".preview" / "gen"

# kind -> (源目录, 输出文件, 四边对称裁切比例, 目标相对亮度, 去饱和, 对比)
PAPERS: dict[str, tuple[str, str, float, float, float, float]] = {
    # 冷米白练习本内页：高调纸，配 --nb-ink #1c2026 ≈ 9:1
    "todo": ("paper-todo", "paper-todo.jpg", 0.09, 0.55, 0.06, 1.05),
    # 暖卡其旧表单纸：中调，配 --pl-ink #191b1c ≈ 7.9:1（比避难所 0.42 略亮，好和图纸分家）
    "plan": ("paper-plan", "paper-plan.jpg", 0.085, 0.46, 0.16, 1.06),
}


def rel_lum(img: Image.Image) -> float:
    a = np.asarray(img.convert("RGB")).astype(np.float32) / 255.0
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    return float((0.2126 * lin[:, :, 0] + 0.7152 * lin[:, :, 1] + 0.0722 * lin[:, :, 2]).mean())


def normalize(im: Image.Image, target_lum: float) -> Image.Image:
    """压/提到目标相对亮度。用 sRGB 增益而非线性缩放，避免暗部糊死。"""
    gray = np.asarray(im.convert("L")).astype(np.float32)
    cur = float(gray.mean()) / 255.0
    target = target_lum ** (1 / 2.2)
    print(f"  定标：平均灰 {cur * 255:.0f} → 目标 {target * 255:.0f}（gain {target / max(cur, 1e-6):.3f}）")
    arr = np.asarray(im).astype(np.float32) * (target / max(cur, 1e-6))
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def main() -> None:
    kind = sys.argv[1] if len(sys.argv) > 1 else ""
    if kind not in PAPERS:
        sys.exit(f"用法: python scripts/make-art-paper.py <{'|'.join(PAPERS)}>")

    src_dir, out_name, crop, target_lum, desat, contrast = PAPERS[kind]
    srcs = sorted((GEN / src_dir).glob("*.png"), key=lambda p: p.stat().st_mtime)
    if not srcs:
        sys.exit(f"缺原始图：{GEN / src_dir}/*.png")
    src = srcs[-1]

    im = Image.open(src).convert("RGB")
    w, h = im.size
    print(f"[{kind}] 源 {src.name[:40]}… {w}x{h}  L={rel_lum(im):.3f}")

    dx, dy = int(w * crop), int(h * crop)
    im = im.crop((dx, dy, w - dx, h - dy))
    im = normalize(im, target_lum)
    im = ImageEnhance.Color(im).enhance(1 - desat)
    im = ImageEnhance.Contrast(im).enhance(contrast)

    out = ROOT / "public" / "art" / out_name
    im.save(out, "JPEG", quality=88)
    got = rel_lum(im)
    ink = 0.0095  # --nb-ink / --pl-ink 一档
    print(
        f"  已写入 public/art/{out_name}  {im.size[0]}x{im.size[1]}  "
        f"L={got:.3f}  与近黑墨对比 ≈ {(got + 0.05) / (ink + 0.05):.1f}:1"
    )


if __name__ == "__main__":
    main()
