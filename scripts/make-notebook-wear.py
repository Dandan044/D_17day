"""把 ImageGen 生成的「纸面污损」素材处理成能叠在笔记本纸上的层。

用法：
    python scripts/make-notebook-wear.py

源图放 `.preview/gen/wear-*/`（每个目录只放一张），产物是 `public/art/<目录名>.jpg`。

这些素材的用法是 `mix-blend-mode: multiply`——**白 = 不变，深色 = 压暗**。
所以后处理只有三件事，但三件都不能少：

1. **裁掉右下角的「AI生成 WORKBUDDY」水印**（底部 9%）；
2. **白点归一**：把背景抬成纯白。不归一的话背景那点灰会整片压暗纸面，
   叠上去像给纸蒙了一层灰纱（乘算下 0.95 的灰 = 全页 -5% 亮度，非常显眼）；
3. **gamma 压深**损伤（>1 只压中间调、不动白点），让皱褶和涂鸦在缩小后仍看得见。

变体是「同一档的多张」，运行时按 `seed + day` 取模选一张，所以这里只负责把每张都做到位。
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GEN = ROOT / ".preview" / "gen"
OUT = ROOT / "public" / "art"

CROP_BOTTOM = 0.09   # 清掉水印带
WHITE_PCT = 86       # 取这个百分位当白点（高出的部分直接裁成纯白，无害；
                     # 取低一点是为了让**淡损伤**也拉开对比，否则轻档淡到看不见）
WIDTH = 1280

# 目标「压暗面积」占比（0~1，= 乘算后真的会变暗的像素比例）。
# 这是决定观感分量的量，所以直接按它反求稀疏指数，而不是拍一个固定的 k：
# 同一串 k 对"细线型"（皱褶、涂鸦）和"整片型"（血渍、灰场）效果差得极远——
# 实测固定 k 会把轻档洗成看不见、又让血污重档比中档还少。
TARGET_DARK = {
    "wear-sanity2-a": 0.11,
    "wear-sanity2-b": 0.10,
    "wear-sanity2-c": 0.12,
    "wear-sanity3-a": 0.22,
    "wear-sanity3-b": 0.24,
    "wear-sanity3-c": 0.27,
    "wear-blood-1": 0.06,
    "wear-blood-2": 0.15,
    "wear-blood-3": 0.24,
    "wear-hand": 0.05,
}
DARK_LEVEL = 170      # 低于这个亮度算「被压暗」


def main() -> None:
    dirs = sorted(d for d in GEN.glob("wear-*") if d.is_dir())
    if not dirs:
        raise SystemExit("没找到 .preview/gen/wear-*/ 素材")

    for d in dirs:
        srcs = sorted(d.glob("*.png"), key=lambda p: p.stat().st_mtime)
        if not srcs:
            print(f"  跳过空目录 {d.name}")
            continue
        im = Image.open(srcs[-1]).convert("RGB")
        w, h = im.size
        im = im.crop((0, 0, w, int(h * (1 - CROP_BOTTOM))))

        a = np.asarray(im).astype(np.float32)
        lum = a.mean(axis=2)
        white = float(np.percentile(lum, WHITE_PCT))
        a = np.clip(a / max(white, 1.0), 0, 1)

        # 稀疏化 `a' = 1 - (1-a)^k`（白点不动，中间调推向白），k 由目标压暗面积二分反求
        target = TARGET_DARK.get(d.name, 0.15)
        lo_k, hi_k = 0.35, 14.0
        for _ in range(20):
            mid = (lo_k + hi_k) / 2
            frac = float(((1.0 - (1.0 - a) ** mid) * 255 < DARK_LEVEL).mean())
            if frac > target:
                lo_k = mid
            else:
                hi_k = mid
        k = (lo_k + hi_k) / 2
        a = 1.0 - (1.0 - a) ** k
        im = Image.fromarray((a * 255.0).astype(np.uint8), "RGB")

        if im.width > WIDTH:
            im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)

        out = OUT / f"{d.name}.jpg"
        im.save(out, "JPEG", quality=86)
        arr = np.asarray(im).astype(np.float32)
        lum2 = arr.mean(axis=2)
        dark = float((lum2 < DARK_LEVEL).mean())
        deep = float((lum2 < 90).mean())
        print(
            f"  {d.name:<16} 白点 {white:.0f}  反求 k={k:.2f}（目标压暗 {target * 100:.0f}%）  "
            f"实得 {dark * 100:.0f}%（深压 {deep * 100:.0f}%）  均值 {lum2.mean() / 255:.2f}"
        )

    print(f"\n处理 {len(dirs)} 张 → {OUT.relative_to(ROOT)}/wear-*.jpg")


if __name__ == "__main__":
    main()
