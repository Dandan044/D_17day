"""Crop in-run shelter props. RGB from the scene; alpha from rembg/BiRefNet.

CROPS are detection boxes only: after matting, each PNG is auto-tightened to
its alpha bbox (+4px bleed) and the final placement box / hit polygon are
written to src/ui/art/artLayout.json (single source of truth, see art_common).
Window is exempt from tightening (glass punching needs the exact frame box).

Window: keep frame/curtains/lamp, punch outdoor panes so weather sits under the hole.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

import art_common
from art_common import (
    EDGE_EXEMPT,
    drop_border_fringe,
    extract_polygon,
    keep_connected,
    merge_layout,
    sweep_dust,
    tighten,
)

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public" / "art"

# Window geometry: single source of truth shared with the frontend (skin.ts).
WIN_GEO = json.loads((ROOT / "src" / "ui" / "art" / "windowPanes.json").read_text(encoding="utf-8"))
WINDOW_BOX = tuple(float(v) for v in WIN_GEO["window"])
WINDOW_PANES = [tuple(float(v) for v in p) for p in WIN_GEO["panes"]]
# 吊灯保留区：场景分数（相对整图），2026-09-10 按实测重写（旧走廊右偏 66px 裁掉灯罩左 2/3）。
LAMP_BOX = tuple(float(v) for v in WIN_GEO["lamp"]) if "lamp" in WIN_GEO else None

# Prefer BiRefNet (2024, MIT). Fall back if the ~1GB onnx is missing.
MODEL_CANDIDATES = ("birefnet-general", "birefnet-general-lite", "isnet-general-use", "u2net")

# left, top, right, bottom — detection boxes in scene fractions. The final
# placement box (alpha bbox + bleed) lands in artLayout.json automatically.
# 2026-09-09: plan/notebook/clock right edges and bed/medkit boxes were cutting
# through the props; widened to the measured item bounds.
CROPS: dict[str, tuple[str, tuple[float, float, float, float]]] = {
    "cut-h-window": ("scene-home-desk.jpg", WINDOW_BOX),
    "cut-h-blueprint": ("scene-home-desk.jpg", (0.028, 0.096, 0.205, 0.648)),
    "cut-h-notebook": ("scene-home-desk.jpg", (0.158, 0.618, 0.375, 0.801)),
    "cut-h-plan": ("scene-home-desk.jpg", (0.314, 0.600, 0.575, 0.884)),
    "cut-h-clock": ("scene-home-desk.jpg", (0.495, 0.475, 0.665, 0.780)),
    "cut-h-radio": ("scene-home-desk.jpg", (0.64, 0.465, 0.88, 0.84)),
    "cut-h-bed": ("scene-home-side.jpg", (0.00, 0.200, 0.400, 1.00)),
    "cut-h-medkit": ("scene-home-side.jpg", (0.400, 0.512, 0.505, 0.630)),
    "cut-h-door": ("scene-home-side.jpg", (0.482, 0.08, 0.70, 0.96)),
    "cut-h-shelf": ("scene-home-side.jpg", (0.72, 0.055, 0.99, 0.94)),
}

# HUD anchors: art-hud-clock / art-hud-mark reuse the old loose crop boxes for
# positioning, so their anchors must survive box tightening unchanged.
HUD_ANCHORS: dict[str, tuple[float, float, float, float]] = {
    "cut-h-clock": (0.50, 0.48, 0.64, 0.76),
    "cut-h-blueprint": (0.028, 0.096, 0.205, 0.448),
}

_SESSION = None
_MODEL = None


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
    x = ImageOps.autocontrast(im, cutoff=1)
    x = ImageEnhance.Brightness(x).enhance(1.22)
    x = ImageEnhance.Contrast(x).enhance(1.18)
    return x


_FALLBACK = {}


def rembg_named(im: Image.Image, name: str) -> Image.Image:
    from rembg import new_session, remove

    if name not in _FALLBACK:
        print(f"loading rembg model {name} (fallback) ...", flush=True)
        _FALLBACK[name] = new_session(name)
    out = remove(im, session=_FALLBACK[name], post_process_mask=True)
    if not isinstance(out, Image.Image):
        out = Image.open(out)  # type: ignore[arg-type]
    return out.convert("RGBA").split()[-1]


def rembg_alpha(im: Image.Image) -> Image.Image:
    from rembg import remove

    out = remove(im, session=session(), post_process_mask=True)
    if not isinstance(out, Image.Image):
        out = Image.open(out)  # type: ignore[arg-type]
    return out.convert("RGBA").split()[-1]


def _dilate(mask, steps: int = 1):
    import numpy as np

    out = mask
    for _ in range(steps):
        pad = np.pad(out, 1, constant_values=False)
        out = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    return out


def drop_wood_fringe(crop: Image.Image, alpha: Image.Image) -> Image.Image:
    """Paper cutouts: keep pale paper (+ a 2px rim), drop desk slivers."""
    import numpy as np

    lum = np.asarray(crop.convert("L"), dtype=np.float32)
    a = np.asarray(alpha).copy()
    paper = _dilate(lum > 108, 2)
    a[~paper] = 0
    return Image.fromarray(a)


def drop_top_band(crop: Image.Image, alpha: Image.Image, frac: float) -> Image.Image:
    """Zero everything above `frac` of the crop height. For props with a fixed
    background rider in the detection box (the chair back above the plan paper)."""
    import numpy as np

    a = np.asarray(alpha).copy()
    a[: int(frac * a.shape[0]), :] = 0
    return Image.fromarray(a)


def drop_desk_under_book(crop: Image.Image, alpha: Image.Image) -> Image.Image:
    """Notebook: keep dark leather / strap, drop the light wood desk."""
    import numpy as np

    rgb = np.asarray(crop.convert("RGB"), dtype=np.int16)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    lum = (r.astype(np.float32) + g + b) / 3.0
    a = np.asarray(alpha).copy()
    leather = _dilate(lum < 88, 2)
    near = _dilate(leather, 5)
    strap = (lum >= 88) & (lum < 170) & (r > b + 6) & near
    a[~(leather | strap)] = 0
    return Image.fromarray(a)


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


def harden(alpha: Image.Image, lo: int = 28) -> Image.Image:
    """BiRefNet already has soft edges; only crush near-zero dust."""
    return alpha.point(lambda p: p if p >= lo else 0)


def alpha_coverage(alpha: Image.Image) -> float:
    hist = alpha.histogram()
    n = alpha.size[0] * alpha.size[1]
    return (sum(hist[1:]) / n) if n else 0.0


def _erode(mask, steps: int = 1):
    import numpy as np

    out = mask
    for _ in range(steps):
        pad = np.pad(out, 1, constant_values=False)
        out = pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:]
    return out


def glass_mask(crop: Image.Image) -> Image.Image:
    """Punch the outdoor panes (windowPanes.json). Keep lamp, mullions, curtains, wall.

    Lamp keep-rule is confined to the lamp bbox from windowPanes.json ("lamp",
    scene fractions) — outside the bbox nothing warm survives, so the warm dusk
    city baked into the glass cannot leak back in. Inside the bbox the lamp is
    self-lit (r>170 & lum>110 & r>b+25) or dark (shade edges / rope); a
    connected-component pass then keeps only the lamp blob, so warm dusk-sky
    islands around it die. Do not subtract 'wood' by color — dusk buildings in
    the glass are warm and would get eaten.
    """
    import numpy as np

    rgb = np.asarray(crop.convert("RGB"), dtype=np.int16)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    h, w = r.shape
    lum = (r + g + b) / 3.0
    xs = np.arange(w)[None, :]
    ys = np.arange(h)[:, None]

    glass = np.zeros((h, w), dtype=bool)
    for l, t, rr, bb in WINDOW_PANES:
        glass[int(t * h) : int(bb * h), int(l * w) : int(rr * w)] = True

    if LAMP_BOX is not None:
        wl, wt, wr, wb = WINDOW_BOX
        ll, lt, lr, lb = LAMP_BOX
        x0, x1 = (ll - wl) / (wr - wl), (lr - wl) / (wr - wl)
        y0, y1 = (lt - wt) / (wb - wt), (lb - wt) / (wb - wt)
        lamp_zone = (xs >= x0 * w) & (xs <= x1 * w) & (ys >= y0 * h) & (ys <= y1 * h)
        warm = (r > 170) & (lum > 110) & (r > b + 25)
        lamp = lamp_zone & (warm | (lum < 105))
        lamp_img = art_common.keep_connected(Image.fromarray((lamp.astype(np.uint8) * 255)), dilate_steps=2)
        lamp = np.asarray(lamp_img) >= 28
        glass &= ~lamp
    return Image.fromarray((glass.astype(np.uint8) * 255))


def window_layers(crop: Image.Image) -> tuple[Image.Image, Image.Image]:
    """Whole crop stays; only the four panes go transparent for the weather plate."""
    import numpy as np

    glass = glass_mask(crop)
    g = np.asarray(glass)
    alpha = np.full(g.shape, 255, dtype=np.uint8)
    alpha[g > 40] = 0
    return Image.fromarray(alpha), glass


def write_glass_plate(glass: Image.Image, dest: Path) -> None:
    """Luminance mask: white = show weather, black = hide. Fully opaque."""
    import numpy as np

    g = np.asarray(glass)
    rgb = np.zeros((g.shape[0], g.shape[1], 3), dtype=np.uint8)
    rgb[g > 40] = 255
    dest.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgb, "RGB").save(dest, "PNG")


def fill_pinholes(alpha: Image.Image) -> Image.Image:
    import numpy as np

    hard = alpha.point(lambda p: 255 if p >= 28 else 0)
    closed = hard.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    a = np.asarray(alpha)
    c = np.asarray(closed)
    filled = np.where((c > 0) & (a < 28), np.uint8(180), a)
    return Image.fromarray(filled)


# Per-key cut strategy. model: rembg model override; otsu_if_low: union Otsu matte when
# cover below it; lower_boost: re-cut the brightened lower half when cover below it;
# connected: keep only components attached to the main body; post: color-based cleanup;
# pinholes: close tiny holes in the matte.
KEY_CFG: dict[str, dict] = {
    "cut-h-notebook": {"post": ("desk_under_book",)},
    # top_band: 桌后的椅背在纸上方入框，按带清掉（带界落在椅底与纸顶的缝隙里）。
    "cut-h-plan": {"post": ("border_fringe", "top_band"), "otsu_if_low": 0.20, "band_frac": 0.295},
    # 底缘 0.648 已在纸底边之外：fringe 四边全开，底部桌影（暗、连边）被正确清掉。
    "cut-h-blueprint": {"post": ("border_fringe",), "fringe_lum": 130},
    "cut-h-radio": {"connected": True},
    "cut-h-bed": {"lower_boost": 0.22, "pinholes": True},
    # 新框只含铁箱本体（床头柜是背景）；keep_connected 清掉不相干的残片。
    "cut-h-medkit": {"connected": True, "pinholes": True},
    # BiRefNet/isnet 都只认出货架上几瓶水（cover<0.05），整架交给 u2net。
    "cut-h-shelf": {"model": "isnet-general-use", "min_cover": 0.30, "lower_boost": 0.22, "pinholes": True},
    "cut-h-door": {"pinholes": True},
}


def silhouette(crop: Image.Image, key: str) -> tuple[Image.Image, str]:
    cfg = KEY_CFG.get(key, {})
    model = cfg.get("model")
    used = model or "default"

    def run(im: Image.Image) -> Image.Image:
        return rembg_named(im, model) if model else rembg_alpha(im)

    net = run(crop)
    cover = alpha_coverage(net)

    if cover < 0.08 or cover > 0.92:
        boosted = run(boost(crop))
        bcover = alpha_coverage(boosted)
        if 0.08 <= bcover <= 0.92 or abs(0.5 - bcover) < abs(0.5 - cover):
            net, cover = boosted, bcover

    # Otsu union when the model missed the pale paper.
    otsu_low = cfg.get("otsu_if_low")
    if otsu_low and cover < otsu_low:
        pages = otsu_alpha(crop)
        if 0.10 <= alpha_coverage(pages) <= 0.70:
            net = union_alpha(net, pages)

    if cfg.get("lower_boost") and cover < cfg["lower_boost"]:
        h = crop.height
        y0 = int(h * 0.42)
        lower = crop.crop((0, y0, crop.width, h))
        extra = run(boost(ImageEnhance.Brightness(lower).enhance(1.25)))
        placed = Image.new("L", crop.size, 0)
        placed.paste(harden(extra), (0, y0))
        net = union_alpha(harden(net), placed)

    min_cover = cfg.get("min_cover", 0.08)
    if cover < min_cover:
        print(f"  {key} cover={cover:.3f} below {min_cover}, fallback u2net", flush=True)
        fb = rembg_named(crop, "u2net")
        fb_cover = alpha_coverage(fb)
        if fb_cover > cover:
            net, cover = fb, fb_cover
            used = f"{used}->u2net"

    if net.size != crop.size:
        net = net.resize(crop.size, Image.Resampling.LANCZOS)
    net = harden(net)
    net = keep_connected(net) if cfg.get("connected") else sweep_dust(net)
    for post in cfg.get("post", ()):
        if post == "wood_fringe":
            net = drop_wood_fringe(crop, net)
        elif post == "border_fringe":
            net = drop_border_fringe(
                crop,
                net,
                lum_thresh=cfg.get("fringe_lum", 108),
                sides=cfg.get("fringe_sides", ("left", "right", "top", "bottom")),
            )
        elif post == "top_band":
            net = drop_top_band(crop, net, cfg.get("band_frac", 0.3))
        elif post == "desk_under_book":
            net = drop_desk_under_book(crop, net)
    if cfg.get("pinholes"):
        net = fill_pinholes(net)
    return net, used


def cut(src_name: str, box: tuple[float, float, float, float], dest: Path, key: str) -> dict:
    src = Image.open(ART / src_name).convert("RGB")
    w, h = src.size
    l, t, r, b = box
    crop = src.crop((int(l * w), int(t * h), int(r * w), int(b * h)))
    if key == "cut-h-window":
        alpha, glass = window_layers(crop)
        write_glass_plate(glass, ART / "cut-h-window-glass.png")
        model = f"glass-punch+{_MODEL or 'pending'}"
        # Window is exempt from tightening: the glass punch needs the exact
        # frame box, and win-* plates align against it.
        bb = (0, 0, crop.width, crop.height)
        poly = None
        touch: set[str] = set()
    else:
        alpha, used = silhouette(crop, key)
        model = used if used != "default" else (_MODEL or "pending")
        bb, touch = tighten(alpha)
        suspect = touch - EDGE_EXEMPT.get(key, set())
        if suspect:
            print(f"  {key} TRUNCATION-SUSPECT: alpha reaches crop edge {'/'.join(sorted(suspect))}", flush=True)
        if bb is None:
            print(f"  {key}: EMPTY alpha after processing, keeping full crop", flush=True)
            bb = (0, 0, crop.width, crop.height)
        poly = extract_polygon(alpha.crop(bb))
    cover = alpha_coverage(alpha)
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
        "hud": list(HUD_ANCHORS[key]) if key in HUD_ANCHORS else None,
        "cover": round(cover, 3),
        "model": model,
    }


def main() -> None:
    import sys

    args = set(sys.argv[1:])
    poly_only = "--poly-only" in args
    args.discard("--poly-only")
    only = args
    entries: dict[str, dict] = {}
    existing = art_common.load_layout()["items"]
    for key, (src, box) in CROPS.items():
        if only and key not in only:
            continue
        dest = ART / f"{key}.png"
        if not (ART / src).exists():
            print(f"skip {key}: missing {src}", flush=True)
            continue
        if poly_only:
            # Re-extract the hit polygon from the finished PNG (no rembg pass).
            if key not in existing or key == "cut-h-window":
                continue
            info = dict(existing[key])
            alpha = Image.open(dest).convert("RGBA").split()[-1]
            info["poly"] = extract_polygon(alpha)
            entries[key] = info
            print(f"{key}: poly refreshed ({art_common.poly_desc(info['poly'])})", flush=True)
            continue
        print(f"cutting {key} ...", flush=True)
        info = cut(src, box, dest, key)
        entries[key] = info
        print(f"{key} -> {dest.name} {info['px']} box={info['box']} poly={art_common.poly_desc(info['poly'])} cover={info['cover']} model={info['model']}", flush=True)
    if entries:
        merge_layout(entries)
        print(f"wrote {art_common.LAYOUT_PATH}", flush=True)


if __name__ == "__main__":
    main()
