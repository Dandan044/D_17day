"""Crop in-run shelter props. RGB from the scene; alpha from rembg/u2net.

CROPS must match src/ui/art/skin.ts CUT_HOME (and WIN_GLASS is the inner pane).
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public" / "art"
META = ART / "cutouts.json"

# left, top, right, bottom — same numbers as CUT_HOME in skin.ts
CROPS: dict[str, tuple[str, tuple[float, float, float, float]]] = {
    "cut-h-window": ("scene-home-desk.jpg", (0.30, 0.12, 0.70, 0.46)),
    "cut-h-blueprint": ("scene-home-desk.jpg", (0.02, 0.10, 0.26, 0.50)),
    "cut-h-notebook": ("scene-home-desk.jpg", (0.16, 0.58, 0.33, 0.84)),
    "cut-h-plan": ("scene-home-desk.jpg", (0.33, 0.60, 0.50, 0.88)),
    "cut-h-clock": ("scene-home-desk.jpg", (0.50, 0.48, 0.64, 0.76)),
    "cut-h-radio": ("scene-home-desk.jpg", (0.64, 0.50, 0.88, 0.84)),
    "cut-h-bed": ("scene-home-side.jpg", (0.00, 0.22, 0.32, 0.98)),
    "cut-h-medkit": ("scene-home-side.jpg", (0.32, 0.50, 0.46, 0.82)),
    "cut-h-door": ("scene-home-side.jpg", (0.50, 0.08, 0.70, 0.96)),
    "cut-h-shelf": ("scene-home-side.jpg", (0.72, 0.10, 0.99, 0.94)),
}

# glass hole inside cut-h-window crop, derived from WIN_GLASS vs window box
WINDOW_GLASS = (0.05, 0.12, 0.95, 0.94)

_SESSION = None


def session():
    global _SESSION
    if _SESSION is None:
        from rembg import new_session

        _SESSION = new_session("u2net")
    return _SESSION


def boost(im: Image.Image) -> Image.Image:
    x = ImageOps.autocontrast(im, cutoff=1)
    x = ImageEnhance.Brightness(x).enhance(1.28)
    x = ImageEnhance.Contrast(x).enhance(1.22)
    return x


def rembg_alpha(im: Image.Image) -> Image.Image:
    from rembg import remove

    out = remove(im, session=session(), post_process_mask=True)
    if not isinstance(out, Image.Image):
        out = Image.open(out)  # type: ignore[arg-type]
    return out.convert("RGBA").split()[-1]


def otsu_alpha(im: Image.Image) -> Image.Image:
    import numpy as np

    g = np.asarray(im.convert("L"), dtype=np.int32)
    hist = np.bincount(g.ravel(), minlength=256).astype(np.float64)
    total = g.size
    sum1 = np.dot(np.arange(256), hist)
    sum_b = 0.0
    w_b = 0.0
    max_var = -1.0
    thresh = 80
    for t in range(256):
        w_b += hist[t]
        if w_b == 0:
            continue
        w_f = total - w_b
        if w_f == 0:
            break
        sum_b += t * hist[t]
        var = w_b * w_f * (sum_b / w_b - (sum1 - sum_b) / w_f) ** 2
        if var > max_var:
            max_var = var
            thresh = t
    return Image.fromarray(((g > thresh) * 255).astype(np.uint8))


def union_alpha(*alphas: Image.Image) -> Image.Image:
    import numpy as np

    acc = None
    for a in alphas:
        arr = np.asarray(a)
        acc = arr if acc is None else np.maximum(acc, arr)
    assert acc is not None
    return Image.fromarray(acc)


def harden(alpha: Image.Image, lo: int = 40) -> Image.Image:
    return alpha.point(lambda p: 255 if p >= lo else 0)


def alpha_coverage(alpha: Image.Image) -> float:
    hist = alpha.histogram()
    n = alpha.size[0] * alpha.size[1]
    return (sum(hist[1:]) / n) if n else 0.0


def punch_glass(alpha: Image.Image) -> Image.Image:
    l, t, r, b = WINDOW_GLASS
    w, h = alpha.size
    out = alpha.copy()
    draw = ImageDraw.Draw(out)
    draw.rectangle((int(l * w), int(t * h), int(r * w), int(b * h)), fill=0)
    return out


def silhouette(crop: Image.Image, key: str) -> Image.Image:
    # Window is a hole in the wall — rembg treats glass+sky as background and
    # often keeps only the lamp. Keep the crop opaque and punch the pane.
    if key == "cut-h-window":
        return punch_glass(Image.new("L", crop.size, 255))

    net = rembg_alpha(crop)
    cover = alpha_coverage(net)

    if cover < 0.08 or cover > 0.92:
        boosted = rembg_alpha(boost(crop))
        bcover = alpha_coverage(boosted)
        if 0.08 <= bcover <= 0.92 or abs(0.5 - bcover) < abs(0.5 - cover):
            net, cover = boosted, bcover

    if key == "cut-h-plan":
        pages = otsu_alpha(crop)
        if alpha_coverage(pages) > cover * 0.6:
            net = union_alpha(net, pages)

    if key in {"cut-h-bed", "cut-h-shelf"}:
        h = crop.height
        y0 = int(h * 0.42)
        lower = crop.crop((0, y0, crop.width, h))
        extra = rembg_alpha(boost(ImageEnhance.Brightness(lower).enhance(1.3)))
        placed = Image.new("L", crop.size, 0)
        placed.paste(harden(extra), (0, y0))
        net = union_alpha(harden(net), placed)

    if key == "cut-h-door":
        w, h = crop.size
        slab = Image.new("L", crop.size, 0)
        ImageDraw.Draw(slab).rectangle((int(w * 0.1), int(h * 0.03), int(w * 0.9), int(h * 0.97)), fill=255)
        net = union_alpha(harden(net), slab)

    if net.size != crop.size:
        net = net.resize(crop.size, Image.Resampling.LANCZOS)
    return harden(net)


def cut(src_name: str, box: tuple[float, float, float, float], dest: Path, key: str) -> dict:
    src = Image.open(ART / src_name).convert("RGB")
    w, h = src.size
    l, t, r, b = box
    crop = src.crop((int(l * w), int(t * h), int(r * w), int(b * h)))
    alpha = silhouette(crop, key)
    cutout = crop.convert("RGBA")
    cutout.putalpha(alpha)
    dest.parent.mkdir(parents=True, exist_ok=True)
    cutout.save(dest, "PNG")
    return {
        "src": src_name,
        "file": dest.name,
        "left": l,
        "top": t,
        "width": r - l,
        "height": b - t,
        "px": list(cutout.size),
        "cover": round(alpha_coverage(alpha), 3),
    }


def main() -> None:
    meta: dict[str, dict] = json.loads(META.read_text(encoding="utf-8")) if META.exists() else {}
    for key, (src, box) in CROPS.items():
        dest = ART / f"{key}.png"
        if not (ART / src).exists():
            print(f"skip {key}: missing {src}", flush=True)
            continue
        print(f"cutting {key} ...", flush=True)
        info = cut(src, box, dest, key)
        meta[key] = info
        print(f"{key} -> {dest.name} {info['px']} cover={info['cover']}", flush=True)
    META.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"wrote {META}", flush=True)


if __name__ == "__main__":
    main()
