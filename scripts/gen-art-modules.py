"""避难所家电配图落盘：rembg 抠出主体 → 丢掉边缘杂件 → 居中收紧 → public/art/mod-<id>-<lv>.png

生成在 WorkBuddy ImageGen 里做（本项目本机那套 qwen-image 配置已不存在），
本脚本只负责**后处理与落盘**，职责与 make-shelter-paper.py 同类。

原始图放 `.preview/gen/mod-<id>-<lv>/*.png`（每个目录只放一张，取最新）。

为什么要「丢边缘杂件」：u2net 会把画面里碰巧挨着的台灯、包装袋一起留下
（实测：净水器那张把台灯和咖啡袋都算成了主体）。规则是——
保留「包围盒中心落在中央 72% 区间内」的连通块，另外豁免任何面积 ≥ 最大块 45% 的大块
（防止一个宽主体被误切），再清掉面积 < 最大块 0.5% 的碎屑。

用法：
    python scripts/gen-art-modules.py                 # 只补缺失的
    python scripts/gen-art-modules.py --force         # 全部重做
    python scripts/gen-art-modules.py --only filter-2 # 单张重做（可逗号分隔）

依赖：rembg / onnxruntime / scipy / pillow（都在隔离 venv 里，模型在 ~/.u2net/）。
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance
from scipy import ndimage
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / ".preview" / "gen"
OUT = ROOT / "public" / "art"

IDS = ["fortify", "conceal", "cistern", "filter", "power", "insulate", "airFilter", "medbay", "garden", "radio"]

SIZE = 512           # 输出边长（缩略图 88px、详情小图 40px，512 已有 5x 余量；再大只是白占包体）
MARGIN = 1.12        # 主体四周留白：bbox 撑到画布的 1/1.12
CENTRAL = 0.72       # 判定「居中主体」的中央区间
BIG_PART = 0.45      # 豁免阈值：面积 ≥ 最大块的这个比例，即使偏心也保留
DUST = 0.005         # 碎屑阈值
COVER_MIN = 0.04     # 覆盖度合理区间：低于此说明主体被当背景透掉了
COVER_MAX = 0.62     # 高于此说明连背景一起吃进来了

# 模型链：isnet 对「暗主体贴暗背景」更稳，u2net 兜底（实测 conceal-1 只剩 1%、conceal-2 却留下 79%）
MODELS = ["isnet-general-use", "u2net"]
# 提亮倍数：抠图只看结构，把暗图提亮后重跑一遍常能把「暗主体贴暗背景」救回来（alpha 仍贴回原图）
BRIGHTEN = [1.0, 1.9, 3.4]
COVER_TINY = 0.12     # 低于此视为「只抠下一小块」的碎片 matte，同等条件下不优先

# 生成用的 prompt 留档（生成在 ImageGen 里做，这里是可复现的清单）
JOBS: list[tuple[str, int]] = [(mid, lv) for mid in IDS for lv in (1, 2, 3)]

_sessions: dict[str, object] = {}


def session(name: str):
    if name not in _sessions:
        _sessions[name] = new_session(name)
    return _sessions[name]


def prune(alpha: np.ndarray) -> tuple[np.ndarray, int]:
    """只留居中主体：返回（新 alpha, 丢掉的块数）。"""
    mask = alpha > 128
    labels, n = ndimage.label(mask)
    if n <= 1:
        return alpha, 0

    sizes = ndimage.sum(mask, labels, range(1, n + 1))
    biggest = float(sizes.max())
    h, w = mask.shape
    lo_x, hi_x = w * (1 - CENTRAL) / 2, w * (1 + CENTRAL) / 2
    lo_y, hi_y = h * (1 - CENTRAL) / 2, h * (1 + CENTRAL) / 2

    keep = np.zeros(n + 1, dtype=bool)
    dropped = 0
    for i in range(1, n + 1):
        area = float(sizes[i - 1])
        if area < biggest * DUST:
            dropped += 1
            continue
        ys, xs = np.where(labels == i)
        cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
        central = lo_x <= cx <= hi_x and lo_y <= cy <= hi_y
        if central or area >= biggest * BIG_PART:
            keep[i] = True
        else:
            dropped += 1

    return np.where(keep[labels], alpha, 0).astype(np.uint8), dropped


def matte(src: Path, model: str, gain: float) -> tuple[np.ndarray, int]:
    """跑一个模型（可先提亮）→ 剪杂件 → 返回（alpha, 丢块数）。alpha 与尺寸无关，直接贴回原图。"""
    im = Image.open(src).convert("RGB")
    if gain != 1.0:
        im = ImageEnhance.Brightness(im).enhance(gain)
    cut = remove(im, session=session(model)).convert("RGBA")
    alpha, dropped = prune(np.array(cut)[:, :, 3])
    return alpha, dropped


def pick(src: Path) -> tuple[np.ndarray, str, int, float]:
    """按覆盖度合理性与碎块数在「模型 × 提亮」的组合里择优。"""
    best = None
    for gain in BRIGHTEN:
        for model in MODELS:
            alpha, dropped = matte(src, model, gain)
            cover = float((alpha > 128).mean())
            ok = COVER_MIN <= cover <= COVER_MAX
            # 顺序：落在合理区间 → 不是碎块 → 碎块数少 → 覆盖度接近 0.22
            rank = (0 if ok else 1, 0 if cover >= COVER_TINY else 1, dropped, abs(cover - 0.22))
            tag = f"{model}{'' if gain == 1.0 else f' ×{gain}'}"
            print(f"      {tag:<26} cover {cover:.2f}  丢块 {dropped}  {'✓' if ok else '×'}")
            if best is None or rank < best[0]:
                best = (rank, alpha, model, dropped, cover)
    _, alpha, model, dropped, cover = best
    return alpha, model, dropped, cover


def process(src: Path, dest: Path) -> dict:
    alpha, model, dropped, cover = pick(src)

    ys, xs = np.where(alpha > 128)
    if len(xs) == 0:
        raise RuntimeError("抠图后没有任何主体像素")
    box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)

    rgb = np.array(Image.open(src).convert("RGB"))
    rgba = np.dstack([rgb, alpha])
    subj = Image.fromarray(rgba.astype(np.uint8), "RGBA").crop(box)

    # 居中 + 留白：主体 bbox 撑到画布的 1/MARGIN
    side = int(max(subj.width, subj.height) * MARGIN)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(subj, ((side - subj.width) // 2, (side - subj.height) // 2))
    canvas = canvas.resize((SIZE, SIZE), Image.LANCZOS)

    dest.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dest, "PNG", optimize=True)
    return {"model": model, "cover": cover, "dropped": dropped, "bbox": box, "kb": dest.stat().st_size // 1024}


def main() -> None:
    force = "--force" in sys.argv
    only: set[str] | None = None
    if "--only" in sys.argv:
        only = set(sys.argv[sys.argv.index("--only") + 1].split(","))

    made = skipped = 0
    for mid, lv in JOBS:
        key = f"{mid}-{lv}"
        if only and key not in only:
            continue
        srcs = sorted((SRC / f"mod-{key}").glob("*.png"), key=lambda p: p.stat().st_mtime)
        if not srcs:
            print(f"  缺原始图  {key}")
            continue
        dest = OUT / f"mod-{key}.png"
        if dest.exists() and not force and not only:
            skipped += 1
            continue
        info = process(srcs[-1], dest)
        made += 1
        print(
            f"  {key:<14} {info['model']:<20} cover {info['cover']:.2f}  丢块 {info['dropped']}  "
            f"bbox {info['bbox']}  {info['kb']}KB"
        )

    print(f"\n完成 {made} 张，跳过 {skipped} 张 → {OUT.relative_to(ROOT)}/mod-<id>-<lv>.png")


if __name__ == "__main__":
    main()
