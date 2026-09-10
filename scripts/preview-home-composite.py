"""Offline composite preview for the art-skin home scenes — no browser, no save touched.

Scene mode: base jpg -> weather plate (replicates the CSS 156% cover positioning)
-> cut-h-window.png -> prop cutouts, one PNG per weather plate.
Matte mode: every cut-h-*.png over magenta so dirty edges / islands / broken rods
are obvious (the hover glow lights up exactly these edges).

Output: seven-days/.preview/ (not committed).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public" / "art"
OUT = ROOT / ".preview"
LAYOUT = ROOT / "src" / "ui" / "art" / "artLayout.json"

DESK_KEYS = ("cut-h-window", "cut-h-blueprint", "cut-h-notebook", "cut-h-plan", "cut-h-clock", "cut-h-radio")
SIDE_KEYS = ("cut-h-bed", "cut-h-medkit", "cut-h-door", "cut-h-shelf")
MENU_ROOM_KEYS = ("cut-table", "cut-shelves", "cut-vending")
MENU_DESK_KEYS = ("cut-notebook", "cut-journal", "cut-stamp")


def load_boxes() -> dict[str, tuple[float, float, float, float]]:
    """Placement boxes from artLayout.json; legacy cutouts.json fills any key
    that has not been re-cut yet. The window box always comes from
    windowPanes.json (single source of truth, immune to rounding in layout)."""
    boxes: dict[str, tuple[float, float, float, float]] = {}
    if LAYOUT.exists():
        for key, info in json.loads(LAYOUT.read_text(encoding="utf-8"))["items"].items():
            l, t, w, h = info["box"]
            boxes[key] = (l, t, l + w, t + h)
    legacy = ART / "cutouts.json"
    if legacy.exists():
        for key, info in json.loads(legacy.read_text(encoding="utf-8")).items():
            boxes.setdefault(key, (info["left"], info["top"], info["left"] + info["width"], info["top"] + info["height"]))
    win_geo = json.loads((ROOT / "src" / "ui" / "art" / "windowPanes.json").read_text(encoding="utf-8"))
    wl, wt, wr, wb = (float(v) for v in win_geo["window"])
    boxes["cut-h-window"] = (wl, wt, wr, wb)
    return boxes


def load_polys() -> dict[str, list]:
    if not LAYOUT.exists():
        return {}
    return {k: info.get("poly") for k, info in json.loads(LAYOUT.read_text(encoding="utf-8"))["items"].items()}


def plate_layer(weather: Path, win_box: tuple[float, float, float, float], size: tuple[int, int]) -> Image.Image:
    """Weather plate positioned like .art-win-glass: 156% of the window box, offset -28%."""
    W, H = size
    wl, wt, wr, wb = win_box
    pw, ph = 1.56 * (wr - wl) * W, 1.56 * (wb - wt) * H
    pl, pt = (wl - 0.28 * (wr - wl)) * W, (wt - 0.28 * (wb - wt)) * H
    img = Image.open(weather).convert("RGB")
    sw, sh = img.size
    scale = max(pw / sw, ph / sh)
    nw, nh = int(sw * scale + 0.5), int(sh * scale + 0.5)
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    ox, oy = int((nw - pw) * 0.5), int((nh - ph) * 0.42)  # object-position: center 42%
    img = img.crop((ox, oy, ox + int(pw), oy + int(ph)))
    layer = Image.new("RGB", (W, H))
    layer.paste(img, (int(pl), int(pt)))
    return layer


def composite(scene_name: str, keys: tuple[str, ...], boxes: dict, weather: Path | None, dest: Path) -> None:
    scene = Image.open(ART / scene_name).convert("RGB")
    W, H = scene.size
    comp = scene.convert("RGBA")
    if weather is not None and "cut-h-window" in boxes:
        win_box = boxes["cut-h-window"]
        plate = plate_layer(weather, win_box, (W, H))
        glass = Image.open(ART / "cut-h-window-glass.png").convert("L")
        mask = Image.new("L", (W, H), 0)
        mask.paste(glass, (int(win_box[0] * W), int(win_box[1] * H)))
        comp.paste(plate, (0, 0), mask)
    for key in keys:
        png = ART / f"{key}.png"
        if key not in boxes or not png.exists():
            continue
        l, t, _, _ = boxes[key]
        comp.alpha_composite(Image.open(png), (int(l * W), int(t * H)))
    comp.convert("RGB").save(dest, "PNG")


def matte_checks(keys: list[str], polys: dict[str, list] | None = None) -> None:
    polys = polys or {}
    for key in keys:
        png = ART / f"{key}.png"
        if not png.exists():
            continue
        im = Image.open(png)
        bg = Image.new("RGBA", im.size, (255, 0, 255, 255))
        bg.alpha_composite(im)
        poly = polys.get(key)
        if poly:
            d = ImageDraw.Draw(bg)
            for ring in poly:  # multi-contour: one outline per ring
                pts = [(x * im.width, y * im.height) for x, y in ring]
                d.line(pts + [pts[0]], fill=(255, 40, 40, 255), width=2)
        bg.convert("RGB").save(OUT / f"matte-{key}.png")


def main() -> None:
    OUT.mkdir(exist_ok=True)
    boxes = load_boxes()
    polys = load_polys()
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"

    if mode in ("all", "scene"):
        weathers = sorted(ART.glob("win-*.jpg"))
        for w in weathers:
            composite("scene-home-desk.jpg", DESK_KEYS, boxes, w, OUT / f"scene-{w.stem}.png")
            print(f"scene-{w.stem}.png", flush=True)
        composite("scene-home-side.jpg", SIDE_KEYS, boxes, None, OUT / "scene-side.png")
        print("scene-side.png", flush=True)

    if mode in ("all", "menu"):
        composite("scene-room.jpg", MENU_ROOM_KEYS, boxes, None, OUT / "scene-room.png")
        print("scene-room.png", flush=True)
        composite("scene-desk.jpg", MENU_DESK_KEYS, boxes, None, OUT / "scene-menu-desk.png")
        print("scene-menu-desk.png", flush=True)
        matte_checks([k for k in MENU_ROOM_KEYS + MENU_DESK_KEYS], polys)

    if mode in ("all", "matte"):
        keys = sys.argv[2:] or [p.stem for p in sorted(ART.glob("cut-h-*.png")) if not p.stem.endswith("-glass")]
        matte_checks(keys, polys)
        print(f"matte x{len(keys)}", flush=True)


if __name__ == "__main__":
    main()
