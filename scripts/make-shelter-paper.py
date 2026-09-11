"""避难所图纸面板底材：把 ImageGen 生成的整张晒图纸纹理裁成可用贴图，并定标到目标亮度。

用法：
    python scripts/make-shelter-paper.py <生成的png>

做四件事：
1. 量纸面中线十字折痕的真实位置（行/列亮度谷），确认它大致落在画面中心；
2. 对称裁掉外圈（去掉烤进图里的边框线、右下角 AI 水印、纸边褐色污渍）；
3. **亮度定标**：把整张纸压到目标相对亮度 —— 面板墨色是近黑，纸上正文要 ≥ 7:1，
   靠 prompt 让模型"调暗"不可靠（实测 img2img 保真太强，反而更亮），所以在这里算准；
   同时轻度去饱和 + 压对比，往"油渍重的深卡其旧纸"靠。
4. 落盘 public/art/paper-shelter.jpg（quality 88）。

对称裁切保证折痕十字仍落在 50% —— CSS 的分栏线按 50% 写死也对得上。
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "art" / "paper-shelter.jpg"
# 四边裁掉的比例：烤进图里的内框线约在 6%、水印在 x>90% y>91%，11% 一并清掉。
CROP = 0.11
# 目标：整张纸的相对亮度。面板墨色 --sh-ink #17191a 的相对亮度约 0.0095，
# L=0.42 → 对比 ≈ (0.42+0.05)/(0.0095+0.05) ≈ 7.9:1，既明显压暗又留得住正文可读性。
TARGET_LUM = 0.42
# 去饱和比例：纯泛黄会显得"新纸"，往灰褐压一点更像油渍旧纸。
DESATURATE = 0.18
CONTRAST = 1.06


def rel_lum(img: Image.Image) -> float:
    a = np.asarray(img.convert("RGB")).astype(np.float32) / 255.0
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    return float((0.2126 * lin[:, :, 0] + 0.7152 * lin[:, :, 1] + 0.0722 * lin[:, :, 2]).mean())


def fold_axes(im: Image.Image) -> tuple[float, float]:
    """返回折痕十字的归一化 (x, y)：在中间 30% 带里找最暗的一行/一列。"""
    small = im.convert("L").resize((160, 107))
    px = small.load()
    w, h = small.size

    def row_lum(y: int) -> float:
        return sum(px[x, y] for x in range(w)) / w

    def col_lum(x: int) -> float:
        return sum(px[x, y] for y in range(h)) / h

    y0, y1 = int(h * 0.35), int(h * 0.65)
    x0, x1 = int(w * 0.35), int(w * 0.65)
    fy = min(range(y0, y1), key=row_lum) / h
    fx = min(range(x0, x1), key=col_lum) / w
    return fx, fy


def normalize(im: Image.Image) -> Image.Image:
    """把纸面压/提到 TARGET_LUM。用 sRGB 增益而非线性缩放，避免暗部糊死。"""
    gray = np.asarray(im.convert("L")).astype(np.float32)
    cur = float(gray.mean()) / 255.0
    # 目标平均灰：由目标相对亮度反推（sRGB 伽马近似）
    target = TARGET_LUM ** (1 / 2.2)
    gain = target / max(cur, 1e-6)
    print(f"  定标：平均灰 {cur * 255:.0f} → 目标 {target * 255:.0f}（gain {gain:.3f}）")
    arr = np.asarray(im).astype(np.float32) * gain
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if not src or not src.exists():
        sys.exit("用法: python scripts/make-shelter-paper.py <生成的png>")

    im = Image.open(src).convert("RGB")
    w, h = im.size
    fx, fy = fold_axes(im)
    print(f"源图 {w}x{h}  折痕十字 ≈ ({fx:.3f}, {fy:.3f})  原始 L={rel_lum(im):.3f}")

    dx, dy = int(w * CROP), int(h * CROP)
    im = im.crop((dx, dy, w - dx, h - dy))

    im = normalize(im)
    im = ImageEnhance.Color(im).enhance(1 - DESATURATE)
    im = ImageEnhance.Contrast(im).enhance(CONTRAST)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT, "JPEG", quality=88)
    got = rel_lum(im)
    ink = 0.0095
    print(
        f"已写入 {OUT.relative_to(ROOT)}  {im.size[0]}x{im.size[1]}  "
        f"L={got:.3f}  与近黑墨对比 ≈ {(got + 0.05) / (ink + 0.05):.1f}:1"
    )


if __name__ == "__main__":
    main()
