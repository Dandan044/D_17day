"""Crop menu/archive props from baked scenes. RGB from the scene; alpha from rembg/u2net.

CROPS are detection boxes only: after matting, each PNG is auto-tightened to
its alpha bbox (+4px bleed) and the final placement box / hit polygons are
merged into src/ui/art/artLayout.json (single source of truth, see art_common).
Boxes MAY overlap where props physically occlude each other (table in front of
the shelves); keep_connected gives each matte only its own pixels, so hit
polygons follow visibility.

The 6 cut-model-* images are full-frame matte jobs (no placement box): they
keep box=[0,0,1,1] and poly=null in the layout.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps

import art_common
from art_common import drop_border_fringe, extract_polygon, keep_connected, merge_layout, sweep_dust, tighten

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public" / "art"

MODELS = ("apartment", "bungalow", "bunker", "farmhouse", "garage", "watertower")

# fractions of image: left, top, right, bottom
# 2026-09-09: 按审计图重测——桌子右端 0.42 旧框 0.36 切腿、书架两侧 0.38/0.70 切框、
# 笔记本右 0.32 底 0.74 切页、账本三边切、印章墨池底 0.74 切。相邻框允许重叠，
# 像素/点击归属由各自 matte 决定。
CROPS: dict[str, tuple[str, tuple[float, float, float, float]]] = {
    "cut-table": ("scene-room.jpg", (0.00, 0.42, 0.455, 1.00)),
    "cut-shelves": ("scene-room.jpg", (0.365, 0.16, 0.70, 0.90)),
    "cut-vending": ("scene-room.jpg", (0.70, 0.08, 1.00, 0.99)),
    "cut-notebook": ("scene-desk.jpg", (0.04, 0.34, 0.322, 0.87)),
    "cut-journal": ("scene-desk.jpg", (0.310, 0.32, 0.757, 0.83)),
    "cut-stamp": ("scene-desk.jpg", (0.725, 0.28, 0.93, 0.78)),
}

# Per-key strategy. otsu: union an Otsu matte (open pages); lower: extra matte
# pass over the boosted lower half; connected: drop components not attached to
# the main body; sweep: weaker cleanup (keep separate islands like the stamp
# handle / shelf bays, drop only dust); fringe: remove dark border-connected
# junk (gap shadows bleeding into the matte); carve: zero a scene-fraction
# rect (the shelf matte would otherwise own the table corner in front of it);
# skip_if_exists: don't recut unless --force.
KEY_CFG: dict[str, dict] = {
    "cut-journal": {"otsu": True, "connected": True, "post": ("border_fringe",), "fringe_lum": 160},
    "cut-table": {"lower": True, "connected": True},
    # 注意：不能给 shelves 开 border_fringe——暗色金属骨架是整块连通分量，右柱贴边
    # 会被连坐清零（实测 cover 0.71→0.02）。右缘触边是右框柱本身，豁免。
    "cut-shelves": {"sweep": True, "min_cover": 0.55, "carve": (0.365, 0.525, 0.445, 0.90)},
    "cut-vending": {"connected": True, "skip_if_exists": True},
    "cut-notebook": {"connected": True},
    "cut-stamp": {"sweep": True},
}

# Prefer BiRefNet (same priority as cut-art-home). The historical u2net-only
# session misplaced edges here (shelves bay dropped, stamp handle treated as
# an island, gap shadows glued onto the journal).
MODEL_CANDIDATES = ("birefnet-general", "birefnet-general-lite", "isnet-general-use", "u2net")

_SESSION = None
_MODEL = None
_SESSION_U2NET = None


def rembg_u2net(im: Image.Image) -> Image.Image:
    """Fallback matte with u2net (separate session). birefnet's segmentation of
    the shelves crop proved unstable across runs (full unit → dust fragments);
    u2net's result is close to the originally committed asset."""
    global _SESSION_U2NET
    from rembg import remove, new_session

    if _SESSION_U2NET is None:
        print("loading rembg model u2net (fallback) ...", flush=True)
        _SESSION_U2NET = new_session("u2net")
    out = remove(im, session=_SESSION_U2NET, post_process_mask=True)
    if not isinstance(out, Image.Image):
        out = Image.open(out)  # type: ignore[arg-type]
    return out.convert("RGBA").split()[-1]


def session():
    global _SESSION, _MODEL
    if _SESSION is not None:
        return _SESSION
    from rembg import new_session

    last = None
    for name in MODEL_CANDIDATES:
        try:
            print(f"loading rembg model {name} ...", flush=True)
            _SESSION = new_session(name)
            _MODEL = name
            print(f"using {name}", flush=True)
            return _SESSION
        except Exception as e:
            last = e
            print(f"  skip {name}: {e}", flush=True)
            _SESSION = None
    raise RuntimeError(f"no rembg model available: {last}")


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


def harden(alpha: Image.Image, lo: int = 40) -> Image.Image:
    return alpha.point(lambda p: 255 if p >= lo else 0)


def alpha_coverage(alpha: Image.Image) -> float:
    hist = alpha.histogram()
    n = alpha.size[0] * alpha.size[1]
    return (sum(hist[1:]) / n) if n else 0.0


def silhouette(crop: Image.Image, key: str) -> Image.Image:
    cfg = KEY_CFG.get(key, {})
    net = rembg_alpha(crop)
    cover = alpha_coverage(net)

    if cover < 0.08 or cover > 0.92:
        boosted = rembg_alpha(boost(crop))
        bcover = alpha_coverage(boosted)
        if 0.08 <= bcover <= 0.92 or abs(0.5 - bcover) < abs(0.5 - cover):
            net, cover = boosted, bcover

    min_cover = cfg.get("min_cover", 0.0)
    if min_cover and cover < min_cover:
        print(f"  {key} cover={cover:.3f} below {min_cover}, fallback u2net", flush=True)
        fb = rembg_u2net(crop)
        fb_cover = alpha_coverage(fb)
        if fb_cover > cover:
            net, cover = fb, fb_cover

    # Open journal fills the frame; rembg often keeps only the pen.
    if cfg.get("otsu"):
        pages = otsu_alpha(crop)
        if alpha_coverage(pages) > cover:
            net = union_alpha(net, pages)

    # Table: also matte the lit lower half so the top isn't the only blob.
    if cfg.get("lower"):
        h = crop.height
        y0 = int(h * 0.42)
        lower = crop.crop((0, y0, crop.width, h))
        legs = rembg_alpha(boost(ImageEnhance.Brightness(lower).enhance(1.35)))
        placed = Image.new("L", crop.size, 0)
        placed.paste(harden(legs), (0, y0))
        net = union_alpha(harden(net), placed)

    if net.size != crop.size:
        net = net.resize(crop.size, Image.Resampling.LANCZOS)
    net = harden(net)
    if cfg.get("connected"):
        net = keep_connected(net)
    elif cfg.get("sweep"):
        net = sweep_dust(net)
    for post in cfg.get("post", ()):
        if post == "border_fringe":
            net = drop_border_fringe(crop, net, lum_thresh=cfg.get("fringe_lum", 108), sides=cfg.get("fringe_sides", ("left", "right", "top", "bottom")))
    return net


def cut(src_name: str, box: tuple[float, float, float, float], dest: Path, key: str) -> dict:
    src = Image.open(ART / src_name).convert("RGB")
    w, h = src.size
    l, t, r, b = box
    crop = src.crop((int(l * w), int(t * h), int(r * w), int(b * h)))
    cfg = KEY_CFG.get(key, {})
    alpha = silhouette(crop, key)
    carve = cfg.get("carve")
    if carve:
        # 按场景分数矩形清零 alpha：清掉误入本 matte 的前景物件（桌角/桌腿）。
        import numpy as np

        cl, ct, cr, cb = carve
        arr = np.asarray(alpha).copy()
        ah, aw = arr.shape
        x0, x1 = max(0, int((cl - l) / (r - l) * aw)), min(aw, int((cr - l) / (r - l) * aw))
        y0, y1 = max(0, int((ct - t) / (b - t) * ah)), min(ah, int((cb - t) / (b - t) * ah))
        arr[y0:y1, x0:x1] = 0
        alpha = Image.fromarray(arr)
    cover = alpha_coverage(alpha)
    bb, touch = tighten(alpha)
    suspect = touch - art_common.EDGE_EXEMPT.get(key, set())
    if suspect:
        print(f"  {key} TRUNCATION-SUSPECT: alpha reaches crop edge {'/'.join(sorted(suspect))}", flush=True)
    if bb is None:
        print(f"  {key}: EMPTY alpha after processing, keeping full crop", flush=True)
        bb = (0, 0, crop.width, crop.height)
    poly = extract_polygon(alpha.crop(bb))
    cutout = crop.convert("RGBA")
    cutout.putalpha(alpha)
    cutout = cutout.crop(bb)
    dest.parent.mkdir(parents=True, exist_ok=True)
    cutout.save(dest, "PNG")
    return {
        "src": src_name,
        "file": dest.name,
        "box": [round(l + bb[0] / w, 5), round(t + bb[1] / h, 5), round((bb[2] - bb[0]) / w, 5), round((bb[3] - bb[1]) / h, 5)],
        "px": list(cutout.size),
        "poly": poly,
        "hud": None,
        "cover": round(cover, 3),
        "model": _MODEL or "u2net",
    }


def cut_full(src_name: str, dest: Path, key: str) -> dict:
    """Full-frame matte (model photos): no crop, no tighten, no poly."""
    src = Image.open(ART / src_name).convert("RGB")
    alpha = silhouette(src, key)
    cutout = src.convert("RGBA")
    cutout.putalpha(alpha)
    dest.parent.mkdir(parents=True, exist_ok=True)
    cutout.save(dest, "PNG")
    return {
        "src": src_name,
        "file": dest.name,
        "box": [0, 0, 1, 1],
        "px": list(cutout.size),
        "poly": None,
        "hud": None,
        "cover": round(alpha_coverage(alpha), 3),
        "model": "u2net",
    }


def cut_models(entries: dict[str, dict]) -> None:
    for sid in MODELS:
        src = f"model-{sid}.jpg"
        key = f"cut-model-{sid}"
        dest = ART / f"{key}.png"
        if not (ART / src).exists():
            print(f"skip {key}: missing {src}", flush=True)
            continue
        print(f"cutting {key} ...", flush=True)
        info = cut_full(src, dest, key)
        entries[key] = info
        print(f"{key} -> {dest.name} {info['px']} cover={info['cover']}", flush=True)


def main() -> None:
    args = set(sys.argv[1:])
    models_only = "--models" in args
    props_only = "--props" in args
    force = "--force" in args
    poly_only = "--poly-only" in args
    for flag in ("--models", "--props", "--force", "--poly-only"):
        args.discard(flag)
    only = args

    entries: dict[str, dict] = {}
    existing = art_common.load_layout()["items"]
    if not models_only:
        for key, (src, box) in CROPS.items():
            if only and key not in only:
                continue
            dest = ART / f"{key}.png"
            if not (ART / src).exists():
                print(f"skip {key}: missing {src}", flush=True)
                continue
            if poly_only:
                if key not in existing:
                    continue
                info = dict(existing[key])
                alpha = Image.open(dest).convert("RGBA").split()[-1]
                info["poly"] = extract_polygon(alpha)
                entries[key] = info
                print(f"{key}: poly refreshed ({art_common.poly_desc(info['poly'])})", flush=True)
                continue
            if KEY_CFG.get(key, {}).get("skip_if_exists") and dest.exists() and not force:
                print(f"keep {key} (already hugs the machine; --force to recut)", flush=True)
                continue
            print(f"cutting {key} ...", flush=True)
            info = cut(src, box, dest, key)
            entries[key] = info
            print(f"{key} -> {dest.name} {info['px']} box={info['box']} poly={art_common.poly_desc(info['poly'])} cover={info['cover']}", flush=True)
    if not props_only:
        cut_models(entries)
    if entries:
        merge_layout(entries)
        print(f"wrote {art_common.LAYOUT_PATH}", flush=True)


if __name__ == "__main__":
    main()
