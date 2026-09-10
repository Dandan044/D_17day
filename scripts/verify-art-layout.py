"""Assert src/ui/art/artLayout.json matches the PNGs on disk.

Run after every re-cut. Exit 0 = all good, 1 = failures (warnings don't fail).

Checks per item:
1. box: fractions in [0,1], w/h > 0
2. PNG exists and its pixel size matches px
3. px ~= round(box * source scene size) within 2px
4. alpha bbox keeps >2px from the PNG canvas edges (truncation guard),
   except sides listed in art_common.EDGE_EXEMPT (real scene boundaries)
5. poly: null -> warning; else 3..64 points, coords within [-0.01, 1.01]
6. HUD anchors present for cut-h-clock / cut-h-blueprint (warning if missing)
7. same-scene box overlaps -> report only
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

from art_common import EDGE_EXEMPT, LAYOUT_PATH

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public" / "art"

HUD_REQUIRED = {"cut-h-clock", "cut-h-blueprint"}
PX_TOLERANCE = 2
EDGE_MARGIN = 2


def main() -> int:
    if not LAYOUT_PATH.exists():
        print(f"FAIL: {LAYOUT_PATH} missing — run the cut scripts first")
        return 1
    layout = __import__("json").loads(LAYOUT_PATH.read_text(encoding="utf-8"))
    items = layout.get("items", {})
    failures: list[str] = []
    warnings: list[str] = []

    for key, info in sorted(items.items()):
        box = info.get("box")
        px = info.get("px")
        src_name = info.get("src")
        png_path = ART / f"{key}.png"

        if not box or len(box) != 4:
            failures.append(f"{key}: box missing/malformed: {box}")
            continue
        l, t, w, h = box
        if not all(0 <= v <= 1 for v in (l, t)) or not (0 < w <= 1) or not (0 < h <= 1):
            failures.append(f"{key}: box out of range: {box}")
        if not png_path.exists():
            failures.append(f"{key}: PNG missing: {png_path.name}")
            continue

        im = Image.open(png_path)
        if px and list(im.size) != list(px):
            failures.append(f"{key}: PNG {im.size} != px {px}")
        if src_name and (ART / src_name).exists():
            sw, sh = Image.open(ART / src_name).size
            expect = (round(w * sw), round(h * sh))
            if max(abs(expect[0] - im.width), abs(expect[1] - im.height)) > PX_TOLERANCE:
                failures.append(f"{key}: PNG {im.size} vs box*scene {expect} (>{PX_TOLERANCE}px)")
        else:
            warnings.append(f"{key}: src '{src_name}' missing, px sanity skipped")

        alpha = im.convert("RGBA").split()[-1]
        bbox, touch = __import__("art_common").tighten(alpha)
        if bbox is None:
            failures.append(f"{key}: PNG alpha is empty")
        else:
            bad = touch - EDGE_EXEMPT.get(key, set())
            if bad:
                failures.append(f"{key}: alpha touches canvas edge {'/'.join(sorted(bad))} (truncated?)")

        poly = info.get("poly")
        if poly is None:
            warnings.append(f"{key}: poly=null (bbox hit area)")
        else:
            # schema: list of polygons, each a list of [x, y]
            if not (1 <= len(poly) <= 8):
                failures.append(f"{key}: poly count {len(poly)} out of 1..8")
            for i, p in enumerate(poly):
                if not (3 <= len(p) <= 64):
                    failures.append(f"{key}: poly[{i}] point count {len(p)} out of 3..64")
                flat = [c for pt in p for c in pt]
                if any(c < -0.01 or c > 1.01 for c in flat):
                    failures.append(f"{key}: poly[{i}] coords out of [-0.01,1.01]")

        if key in HUD_REQUIRED and not info.get("hud"):
            warnings.append(f"{key}: hud anchor missing (HUD will shift after tightening)")

    # report-only overlap check within the same scene
    by_src: dict[str, list[str]] = {}
    for key, info in sorted(items.items()):
        by_src.setdefault(info.get("src", ""), []).append(key)
    for src_name, keys in sorted(by_src.items()):
        for i, a in enumerate(keys):
            for b in keys[i + 1 :]:
                al, at, aw, ah = items[a]["box"]
                bl, bt, bw, bh = items[b]["box"]
                ox = min(al + aw, bl + bw) - max(al, bl)
                oy = min(at + ah, bt + bh) - max(at, bt)
                if ox > 0 and oy > 0:
                    print(f"OVERLAP(report-only): {a} x {b} in {src_name} ({ox:.3f} x {oy:.3f})")

    for w_ in warnings:
        print(f"WARN: {w_}")
    if failures:
        for f in failures:
            print(f"FAIL: {f}")
        print(f"verify-art-layout: {len(failures)} failure(s), {len(warnings)} warning(s)")
        return 1
    print(f"verify-art-layout: OK ({len(items)} items, {len(warnings)} warning(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
