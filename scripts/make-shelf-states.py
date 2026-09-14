"""把生图出的 25 张「货架态」收敛成可发布的贴图。

输入：`.preview/gen/shelf-l{f}-l{w}/*.png`（f = 口粮档、w = 用水档，各 0..4）
输出：`public/art/shelf/shelf-{f}-{w}.jpg`

为什么是 JPEG 而不是抠好的 PNG：这 25 张贴图是**整块补丁**——生成时本来就保留了周围墙面与门，
按 shelfLayout.region 盖回原位后天然接缝极小；而热点形状由 `skin.ts` 的 SHELF_POLY 裁出来，
所以不需要透明通道，JPEG 省下大量体积。

水印不用管：生成图右下角那个「AI生成」在 region 之外（被多边形裁掉）。

用法：
    python scripts/make-shelf-states.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
# 生图批次目录按优先级找：gen3 = 加变体后的重出版；gen = 最早那批（空架 0-0 仍用它）
GEN_ROOTS = [ROOT / ".preview" / "gen3", ROOT / ".preview" / "gen", ROOT / ".preview" / "gen2"]
OUT = ROOT / "public" / "art" / "shelf"

# 场景里那块区域是 521x781；贴到 624x936（1.2 倍）够高 DPI 用，又不至于让包体膨胀
TARGET_W = 624
QUALITY = 86
LEVELS = range(5)


def newest(d: Path) -> Path | None:
    files = sorted(d.glob("*.png"))
    return files[-1] if files else None


def find_state(f: int, w: int) -> Path | None:
    for root in GEN_ROOTS:
        hit = newest(root / f"shelf-l{f}-l{w}")
        if hit is not None:
            return hit
    return None


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    missing: list[str] = []
    for f in LEVELS:
        for w in LEVELS:
            src = find_state(f, w)
            if src is None:
                missing.append(f"shelf-l{f}-l{w}")
                continue
            im = Image.open(src).convert("RGB")
            h = round(im.size[1] * TARGET_W / im.size[0])
            im = im.resize((TARGET_W, h), Image.LANCZOS)
            dest = OUT / f"shelf-{f}-{w}.jpg"
            im.save(dest, quality=QUALITY, optimize=True, progressive=True)
    got = sorted(OUT.glob("shelf-*.jpg"))
    print(f"产出 {len(got)} / 25 张  ->  {OUT.relative_to(ROOT)}/shelf-<f>-<w>.jpg  ({TARGET_W}x{round(TARGET_W * 781 / 521)})")
    if missing:
        print("缺失：", ", ".join(missing))


if __name__ == "__main__":
    main()
