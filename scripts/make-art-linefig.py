"""把 ImageGen 出的四张线稿做成「线稿 + 填充掩膜」，并量出填充区 bbox 落盘。

用法：
    python scripts/make-art-linefig.py            # 处理全部四张
    python scripts/make-art-linefig.py power      # 只处理一张

产出（public/art/）：
    line-<key>.png        线稿本体：**统一深灰蓝墨色 + alpha = 线条浓度**，内部与四周全透明
    line-<key>-mask.png   填充掩膜：白色 + alpha = 每个形状的内部（含罐头/瓶子之间的空隙会留空）
    src/ui/art/linefigLayout.json   画幅比与填充区 bbox（归一化），是填充/标尺的唯一坐标真源

三个关键点：
1. **抠图不走 rembg**：线稿用「亮度反推 alpha」——白底→全透明、深线→不透明。
   比 rembg 稳得多（rembg 会把线稿内部当背景透掉、把线条切成碎块）。
2. **线稿背后垫色块必须配掩膜**：否则白底让"轮廓之外"也透明，颜色会从形状外面渗出来糊成一片。
   掩膜用 `fill_holes` 而**不是**形态学闭运算——闭运算会把金字塔里相邻罐头的缝桥接起来，
   填充色就会漏进罐与罐之间的空隙。
3. **墨色统一**：四张都刷成同一个深灰蓝，这是"风格一致"最省事也最可靠的做法。
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
GEN = ROOT / ".preview" / "gen"
OUT = ROOT / "public" / "art"
LAYOUT = ROOT / "src" / "ui" / "art" / "linefigLayout.json"

# 统一墨色（深灰蓝，与档案皮肤 --pl-ink / --pl-blue 同族）
INK = (43, 56, 78)
CROP_BOTTOM = 0.09  # 裁掉右下角「AI生成 WORKBUDDY」水印
WHITE_PCT = 86  # 取这个百分位当纸白（低一点能把淡线条也拉出对比）
MASK_THRESHOLD = 0.45
# 底噪切除：生成图的"白底"其实是带胶片颗粒的近白，不切掉的话整片背景会变成
# alpha 1~40 的极淡噪点——不但看起来蒙了一层雾，alpha 通道全是噪声后 PNG 完全压不动
# （实测 1.2MB → 切完 ~150KB）。低于 FLOOR 直接归零，其余线性拉回 0..1。
ALPHA_FLOOR = 0.22
MIN_BLOB = 0.0004  # 小于画幅这个比例的连通域当噪点丢弃


def alpha_of(rgb: np.ndarray) -> tuple[np.ndarray, float]:
    lum = rgb.mean(axis=2) / 255.0
    white = float(np.percentile(lum, WHITE_PCT))
    dark = float(np.percentile(lum, 1))
    span = max(white - dark, 0.15)
    a = np.clip((white - lum) / span, 0, 1)
    a = np.clip((a - ALPHA_FLOOR) / (1 - ALPHA_FLOOR), 0, 1)
    a[a < 0.02] = 0
    return a, white


def clean_blobs(mask: np.ndarray) -> np.ndarray:
    lab, n = ndimage.label(mask)
    if n == 0:
        return mask
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    keep = [i + 1 for i, s in enumerate(sizes) if s > mask.size * MIN_BLOB]
    return np.isin(lab, keep)


def bbox_of(mask: np.ndarray, region: np.ndarray | None = None) -> list[float]:
    """返回归一化 bbox。注意：**必须传整幅的 (H, W) 进来归一**，
    否则对切片求 bbox 时会被切片的宽高归一，x2 会算出 >1 的越界值。"""
    m = mask if region is None else (mask & region)
    ys, xs = np.nonzero(m)
    h, w = mask.shape
    return [round(xs.min() / w, 4), round(ys.min() / h, 4), round((xs.max() + 1) / w, 4), round((ys.max() + 1) / h, 4)]


def bbox_xy(mask: np.ndarray, x0: int, x1: int) -> list[float]:
    """在整幅坐标系里对 [x0, x1) 这一段求 bbox（用整幅尺寸归一）。"""
    ys, xs = np.nonzero(mask[:, x0:x1])
    h, w = mask.shape
    return [
        round((xs.min() + x0) / w, 4),
        round(ys.min() / h, 4),
        round((xs.max() + 1 + x0) / w, 4),
        round((ys.max() + 1) / h, 4),
    ]


# 每张的输出上限（线稿不需要那么大的像素，压小一点省包体）
MAXW = {"power": 1200, "ration": 880, "water": 880, "thermo": 760}


def save_rgba(rgb: np.ndarray, alpha: np.ndarray, path: Path, size: tuple[int, int]) -> None:
    """线稿与掩膜共用：缩放 + alpha 量化后落盘。

    ⚠️ 量化**必须 clip 到 255**：`round(255/10)*10 = 260`，直接 astype(uint8) 会溢出成 4——
    看上去就是"填充区明明是 255 却像完全没填充"，很难查。
    """
    img = Image.fromarray(np.dstack([rgb, alpha]), "RGBA").resize(size, Image.LANCZOS)
    arr = np.asarray(img).copy()
    steps = 24.0  # 24 级足够顺滑，又让 PNG 压得动
    q = np.round(arr[..., 3].astype(np.float32) * (steps / 255.0)) * (255.0 / steps)
    arr[..., 3] = np.clip(q, 0, 255).astype(np.uint8)
    Image.fromarray(arr, "RGBA").save(path, optimize=True)


def process(key: str) -> dict:
    srcs = sorted((GEN / f"line-{key}").glob("*.png"), key=lambda p: p.stat().st_mtime)
    if not srcs:
        raise SystemExit(f"缺原始图：{GEN / f'line-{key}'}/*.png")
    raw = Image.open(srcs[-1]).convert("RGB")
    w, h = raw.size
    raw = raw.crop((0, 0, w, int(h * (1 - CROP_BOTTOM))))
    rgb = np.asarray(raw).astype(np.float32)
    H, W = rgb.shape[:2]

    # ---- 1. 线稿 alpha ----
    a, white = alpha_of(rgb)

    # ---- 2. 填充掩膜：只填"闭合轮廓内部"，不桥接相邻形状 ----
    m = a > MASK_THRESHOLD
    m = ndimage.binary_dilation(m, iterations=2)  # 补上抗锯齿造成的断口，好让 fill_holes 闭合
    m = ndimage.binary_fill_holes(m)
    m = ndimage.binary_erosion(m, iterations=2)  # 还原轮廓，避免掩膜胖出一圈
    m = clean_blobs(m)

    # ---- 3. 按掩膜裁掉透明边距：素材更紧凑，液柱/形状在面板里就能放得更大更清楚 ----
    ys, xs = np.nonzero(m)
    pad_y, pad_x = int(H * 0.02), int(W * 0.02)
    y0, y1 = max(0, ys.min() - pad_y), min(H, ys.max() + 1 + pad_y)
    x0, x1 = max(0, xs.min() - pad_x), min(W, xs.max() + 1 + pad_x)
    a = a[y0:y1, x0:x1]
    m = m[y0:y1, x0:x1]
    H, W = m.shape

    # ---- 4. 落盘：线稿与掩膜**同尺寸同缩放**（否则 CSS 里对不齐）；
    #         alpha 量化后 PNG 才压得动 ----
    tw = min(W, MAXW.get(key, 1000))
    size = (tw, max(1, round(H * tw / W)))
    save_rgba(np.dstack([np.full((H, W), c, np.uint8) for c in INK]), (a**0.9 * 255).astype(np.uint8), OUT / f"line-{key}.png", size)
    save_rgba(
        np.dstack([np.full((H, W), 255, np.uint8)] * 3),
        (m * 255).astype(np.uint8),
        OUT / f"line-{key}-mask.png",
        size,
    )

    info: dict = {"aspect": round(W / H, 4)}
    # ---- 3. bbox ----
    if key == "power":
        # 发电机组与蓄电池柜**被那条电缆连成了同一个连通域**（这正是要表达的"链接关系"），
        # 所以不能按连通域分左右：改用列密度——两个机身列密度高、中间那段电缆细，取中间最窄处当分割。
        col = m.sum(axis=0).astype(np.float64)
        lo, hi = int(W * 0.32), int(W * 0.68)
        split_x = lo + int(np.argmin(col[lo:hi]))
        info["left"] = bbox_xy(m, 0, split_x)
        info["right"] = bbox_xy(m, split_x, W)
        info["split"] = round(split_x / W, 4)
    elif key == "thermo":
        lab, n = ndimage.label(m)
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        big = int(np.argmax(sizes)) + 1
        info["tube"] = bbox_of(m, lab == big)
    else:
        info["whole"] = bbox_of(m)

    print(
        f"  {key:<7} {W}x{H}  白点 {white:.2f}  线条像素 {float((a > 0.45).mean()) * 100:4.1f}%  "
        f"填充区 {float(m.mean()) * 100:4.1f}%  " + "  ".join(f"{k}={v}" for k, v in info.items() if k != "aspect")
    )
    return info


def main() -> None:
    keys = ["power", "ration", "water", "thermo"]
    layout = json.loads(LAYOUT.read_text(encoding="utf-8")) if LAYOUT.exists() else {}
    for k in keys:
        layout[k] = process(k)
    LAYOUT.write_text(json.dumps(layout, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n已写 {LAYOUT.relative_to(ROOT)}")
    for k in keys:
        print(f"  public/art/line-{k}.png + line-{k}-mask.png")


if __name__ == "__main__":
    main()
