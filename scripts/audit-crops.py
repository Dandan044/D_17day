"""Audit detection boxes against the real item bounds in the source scenes.

- alpha probe: maps each PNG's alpha bbox back to scene fractions using the box
  it was cut with (artLayout.json, falling back to legacy cutouts.json) and
  flags TRUNCATION-SUSPECT when alpha reaches the crop edge.
- overview per scene: source + 5% grid + crop boxes (red) + alpha bboxes (green)
- per-key 2x zoom of the crop area with edge ticks labeled in scene fractions

Usage: python scripts/audit-crops.py [home|objects|all]
Output: .preview/audit/ (not committed)
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

import art_common
from art_common import EDGE_EXEMPT, LAYOUT_PATH

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public" / "art"
OUT = ROOT / ".preview" / "audit"

SCENES = {
    "scene-home-desk.jpg": ("cut-h-blueprint", "cut-h-notebook", "cut-h-plan", "cut-h-clock", "cut-h-radio", "cut-h-window"),
    "scene-home-side.jpg": ("cut-h-bed", "cut-h-medkit", "cut-h-door", "cut-h-shelf"),
    "scene-room.jpg": ("cut-table", "cut-shelves", "cut-vending"),
    "scene-desk.jpg": ("cut-notebook", "cut-journal", "cut-stamp"),
}


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def stored_boxes() -> dict[str, tuple[float, float, float, float]]:
    """Placement box (l, t, w, h) per key: artLayout.json first, legacy
    cutouts.json as fallback for not-yet-recut keys."""
    boxes: dict[str, tuple[float, float, float, float]] = {}
    if LAYOUT_PATH.exists():
        for key, info in json.loads(LAYOUT_PATH.read_text(encoding="utf-8"))["items"].items():
            boxes[key] = tuple(info["box"])  # type: ignore[assignment]
    legacy = ART / "cutouts.json"
    if legacy.exists():
        for key, info in json.loads(legacy.read_text(encoding="utf-8")).items():
            boxes.setdefault(key, (info["left"], info["top"], info["width"], info["height"]))
    return boxes


def probe(which: str) -> None:
    crops: dict[str, tuple[str, tuple[float, float, float, float]]] = {}
    if which in ("home", "all"):
        crops.update(load_module("cut-art-home", ROOT / "scripts" / "cut-art-home.py").CROPS)
    if which in ("objects", "all"):
        crops.update(load_module("cut-art-objects", ROOT / "scripts" / "cut-art-objects.py").CROPS)
    placed = stored_boxes()

    for key, (src, box) in crops.items():
        png = ART / f"{key}.png"
        if not png.exists():
            print(f"{key}: no PNG yet (box {box})")
            continue
        if key.endswith("window"):
            continue  # full-frame glass punch by design, exempt from the probe
        alpha = Image.open(png).convert("RGBA").split()[-1]
        bb, touch = art_common.tighten(alpha)
        if bb is None:
            print(f"{key}: EMPTY alpha!")
            continue
        if key not in placed:
            print(f"{key}: no stored box (not cut yet?), PNG {png.name} untouched")
            continue
        l, t, w, h = placed[key]
        fx, fy = w / alpha.width, h / alpha.height
        sl, st = l + bb[0] * fx, t + bb[1] * fy
        sr, sb = l + bb[2] * fx, t + bb[3] * fy
        suspect = touch - EDGE_EXEMPT.get(key, set())
        flag = f"  TRUNCATION-SUSPECT: {'/'.join(sorted(suspect))}" if suspect else ""
        print(
            f"{key}: crop=({l:.3f},{t:.3f},{l + w:.3f},{t + h:.3f}) "
            f"alpha_bbox_scene=({sl:.3f},{st:.3f},{sr:.3f},{sb:.3f}){flag}",
            flush=True,
        )


def overview(scene_name: str, keys: tuple[str, ...], placed: dict, crops: dict) -> None:
    src = Image.open(ART / scene_name).convert("RGB")
    W, H = src.size
    img = src.copy()
    d = ImageDraw.Draw(img)
    for i in range(1, 20):  # 5% grid
        x, y = int(W * i / 20), int(H * i / 20)
        d.line([(x, 0), (x, H)], fill=(60, 60, 70), width=1)
        d.line([(0, y), (W, y)], fill=(60, 60, 70), width=1)
        if i % 2 == 0:
            d.text((x + 2, 2), f"{i / 20:.2f}", fill=(200, 200, 90))
            d.text((2, y + 2), f"{i / 20:.2f}", fill=(200, 200, 90))
    for key in keys:
        if key in placed:
            l, t, w, h = placed[key]
            d.rectangle([int(l * W), int(t * H), int((l + w) * W), int((t + h) * H)], outline=(255, 40, 40), width=3)
        if key in crops:
            cl, ct, cr, cb = crops[key][1]
            for (a, b_, c, e), col in (
                ((cl, ct, cr, ct), (255, 170, 40)),
                ((cl, cb, cr, cb), (255, 170, 40)),
                ((cl, ct, cl, cb), (255, 170, 40)),
                ((cr, ct, cr, cb), (255, 170, 40)),
            ):
                d.line([(a * W, b_ * H), (c * W, e * H)], fill=col, width=1)
    img.save(OUT / f"overview-{Path(scene_name).stem}.png")
    print(f"overview-{Path(scene_name).stem}.png", flush=True)


def zoom(key: str, src_name: str, box, placed) -> None:
    src = Image.open(ART / src_name).convert("RGB")
    W, H = src.size
    l, t, r, b = box
    crop = src.crop((int(l * W), int(t * H), int(r * W), int(b * H)))
    crop = crop.resize((crop.width * 2, crop.height * 2), Image.Resampling.NEAREST)
    d = ImageDraw.Draw(crop)
    cw, ch = crop.size
    for i in range(1, 10):
        x, y = int(cw * i / 10), int(ch * i / 10)
        d.line([(x, 0), (x, ch)], fill=(70, 70, 80), width=1)
        d.line([(0, y), (cw, y)], fill=(70, 70, 80), width=1)
        d.text((x + 2, 2), f"{l + (r - l) * i / 10:.3f}", fill=(200, 200, 90))
        d.text((2, y + 2), f"{t + (b - t) * i / 10:.3f}", fill=(200, 200, 90))
    if key in placed:
        pl, pt, pw, ph = placed[key]
        x0, y0 = (pl - l) / (r - l) * cw, (pt - t) / (b - t) * ch
        x1, y1 = (pl + pw - l) / (r - l) * cw, (pt + ph - t) / (b - t) * ch
        d.rectangle([x0, y0, x1, y1], outline=(60, 255, 90), width=2)
    crop.save(OUT / f"{key}-2x.png")


def main() -> None:
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    OUT.mkdir(parents=True, exist_ok=True)

    crops: dict[str, tuple[str, tuple[float, float, float, float]]] = {}
    if which in ("home", "all"):
        crops.update(load_module("cut-art-home", ROOT / "scripts" / "cut-art-home.py").CROPS)
    if which in ("objects", "all"):
        crops.update(load_module("cut-art-objects", ROOT / "scripts" / "cut-art-objects.py").CROPS)
    placed = stored_boxes()

    print("== alpha probe ==", flush=True)
    probe(which)
    print("== overviews ==", flush=True)
    for scene_name, keys in SCENES.items():
        if not (ART / scene_name).exists():
            continue
        scene_keys = tuple(k for k in keys if k in crops)
        if not scene_keys:
            continue
        overview(scene_name, scene_keys, placed, crops)
        for key in scene_keys:
            if key in crops and not key.endswith("window"):
                zoom(key, scene_name, crops[key][1], placed)
    print(f"done -> {OUT}", flush=True)


if __name__ == "__main__":
    main()
