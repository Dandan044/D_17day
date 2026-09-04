"""Crop objects from baked scenes. RGB stays from the scene; alpha comes from rembg."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public" / "art"
META = ART / "cutouts.json"

MODELS = ("apartment", "bungalow", "bunker", "farmhouse", "garage", "watertower")

# fractions of image: left, top, right, bottom
CROPS: dict[str, tuple[str, tuple[float, float, float, float]]] = {
    "cut-table": ("scene-room.jpg", (0.00, 0.08, 0.36, 0.98)),
    "cut-shelves": ("scene-room.jpg", (0.38, 0.12, 0.70, 0.90)),
    "cut-vending": ("scene-room.jpg", (0.70, 0.08, 1.00, 0.99)),
    "cut-notebook": ("scene-desk.jpg", (0.04, 0.32, 0.32, 0.74)),
    "cut-journal": ("scene-desk.jpg", (0.34, 0.30, 0.66, 0.76)),
    "cut-stamp": ("scene-desk.jpg", (0.70, 0.26, 0.96, 0.74)),
}

_SESSION = None


def session():
    global _SESSION
    if _SESSION is None:
        from rembg import new_session

        _SESSION = new_session("u2net")
    return _SESSION


def boost(im: Image.Image) -> Image.Image:
    """Lift dark furniture so rembg can see it against the bunker wall."""
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
    """Automatic matte for high-contrast props (open pages on a dark desk)."""
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


def silhouette(crop: Image.Image, key: str) -> Image.Image:
    net = rembg_alpha(crop)
    cover = alpha_coverage(net)

    if cover < 0.08 or cover > 0.92:
        boosted = rembg_alpha(boost(crop))
        bcover = alpha_coverage(boosted)
        if 0.08 <= bcover <= 0.92 or abs(0.5 - bcover) < abs(0.5 - cover):
            net, cover = boosted, bcover

    # Open journal fills the frame; rembg often keeps only the pen.
    if key == "cut-journal":
        pages = otsu_alpha(crop)
        if alpha_coverage(pages) > cover:
            net = union_alpha(net, pages)

    # Table: also matte the lit lower half so the top isn't the only blob.
    if key == "cut-table":
        h = crop.height
        y0 = int(h * 0.42)
        lower = crop.crop((0, y0, crop.width, h))
        legs = rembg_alpha(boost(ImageEnhance.Brightness(lower).enhance(1.35)))
        placed = Image.new("L", crop.size, 0)
        placed.paste(harden(legs), (0, y0))
        net = union_alpha(harden(net), placed)

    if net.size != crop.size:
        net = net.resize(crop.size, Image.Resampling.LANCZOS)
    return harden(net)


def harden(alpha: Image.Image, lo: int = 40) -> Image.Image:
    return alpha.point(lambda p: 255 if p >= lo else 0)


def alpha_coverage(alpha: Image.Image) -> float:
    hist = alpha.histogram()
    n = alpha.size[0] * alpha.size[1]
    return (sum(hist[1:]) / n) if n else 0.0


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


def cut_full(src_name: str, dest: Path, key: str) -> dict:
    src = Image.open(ART / src_name).convert("RGB")
    alpha = silhouette(src, key)
    cutout = src.convert("RGBA")
    cutout.putalpha(alpha)
    dest.parent.mkdir(parents=True, exist_ok=True)
    cutout.save(dest, "PNG")
    return {
        "src": src_name,
        "file": dest.name,
        "left": 0,
        "top": 0,
        "width": 1,
        "height": 1,
        "px": list(cutout.size),
        "cover": round(alpha_coverage(alpha), 3),
    }


def cut_models(meta: dict[str, dict]) -> None:
    for sid in MODELS:
        src = f"model-{sid}.jpg"
        key = f"cut-model-{sid}"
        dest = ART / f"{key}.png"
        if not (ART / src).exists():
            print(f"skip {key}: missing {src}", flush=True)
            continue
        print(f"cutting {key} ...", flush=True)
        info = cut_full(src, dest, key)
        meta[key] = info
        print(f"{key} -> {dest.name} {info['px']} cover={info['cover']}", flush=True)


def main() -> None:
    import sys

    models_only = "--models" in sys.argv
    meta: dict[str, dict] = json.loads(META.read_text(encoding="utf-8")) if META.exists() else {}
    if not models_only:
        for key, (src, box) in CROPS.items():
            dest = ART / f"{key}.png"
            if key == "cut-vending" and dest.exists():
                print(f"keep {key} (already hugs the machine)", flush=True)
                continue
            if not (ART / src).exists():
                print(f"skip {key}: missing {src}", flush=True)
                continue
            print(f"cutting {key} ...", flush=True)
            info = cut(src, box, dest, key)
            meta[key] = info
            print(f"{key} -> {dest.name} {info['px']} cover={info['cover']}", flush=True)
    cut_models(meta)
    META.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"wrote {META}", flush=True)


if __name__ == "__main__":
    main()
