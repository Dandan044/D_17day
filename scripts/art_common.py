"""Shared helpers for both art cut pipelines (home + objects).

src/ui/art/artLayout.json is the single source of truth for placement boxes,
pixel sizes, hit polygons and HUD anchors:
- cut-art-home.py / cut-art-objects.py merge their entries into it after each run
- skin.ts derives CUT / CUT_HOME / CUT_POLY / HUD_BOX from it
- preview-home-composite.py and verify-art-layout.py read it
(replaces the retired public/art/cutouts.json, which only the scripts used).

Conventions:
- box: [left, top, width, height] as fractions of the source scene image
- poly: [[x, y], ...] normalized to the FINAL (tightened) PNG canvas, [0,1]
- hud: legacy loose box kept for HUD elements that reused the loose crop box
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LAYOUT_PATH = ROOT / "src" / "ui" / "art" / "artLayout.json"

ALPHA_LO = 28          # alpha hard floor, matches cut-art-home.harden
TIGHTEN_MARGIN = 4     # px of bleed kept around the alpha bbox when tightening
POLY_DILATE = 2        # px outward so the clip never bites the visible edge/glow
POLY_MAX_PTS = 48

# Sides where alpha touching the detection-box edge is a real scene boundary,
# not a truncation. Anything else touching an edge is a TRUNCATION-SUSPECT.
EDGE_EXEMPT: dict[str, set[str]] = {
    "cut-h-window": {"left", "right", "top", "bottom"},  # 整框物件：框/帘/墙贴满检测框是设计，豁免收紧
    "cut-h-bed": {"left", "bottom"},  # 床架出画左缘、床腿抵场景底缘
    "cut-h-medkit": {"left"},  # 箱体左面贴检测框左缘，实测截断 ≤2px（放宽会引进床栏杆）
    "cut-table": {"left", "bottom"},
    "cut-shelves": {"left", "right"},  # 左右框柱贴检测框缘，截断 ≤3px；左侧再移 birefnet 会分割崩坏、右侧与售货机物理贴合
    "cut-vending": {"right"},
}
# 民居模型图是全幅抠图（无摆放框），alpha 贴边是常态，豁免四边。
for _m in ("apartment", "bungalow", "bunker", "farmhouse", "garage", "watertower"):
    EDGE_EXEMPT[f"cut-model-{_m}"] = {"left", "right", "top", "bottom"}


def poly_desc(poly) -> str:
    """Human-readable poly summary for logs: "2r/41pts" or "none"."""
    if not poly:
        return "none"
    return f"{len(poly)}r/{sum(len(r) for r in poly)}pts"


def load_layout() -> dict:
    if LAYOUT_PATH.exists():
        return json.loads(LAYOUT_PATH.read_text(encoding="utf-8"))
    return {"version": 1, "items": {}}


def merge_layout(entries: dict[str, dict]) -> None:
    """Merge {key: info} into artLayout.json, preserving other keys so a
    single-key re-cut never wipes sibling entries."""
    data = load_layout()
    data["version"] = 1
    items = data.setdefault("items", {})
    items.update(entries)
    LAYOUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    LAYOUT_PATH.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def dilate_mask(mask, steps: int = 1):
    """Binary dilation with a square structuring element (same shape semantics
    as the _dilate helpers in the cut scripts)."""
    import numpy as np

    out = mask
    for _ in range(steps):
        pad = np.pad(out, 1, constant_values=False)
        out = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    return out


def tighten(alpha: Image.Image, margin_px: int = TIGHTEN_MARGIN, lo: int = ALPHA_LO):
    """Crop suggestion for a finished matte: alpha bbox + margin, clamped.

    Returns (bbox, touch):
    - bbox: (l, t, r, b) exclusive, or None when nothing is kept
    - touch: canvas edges the RAW bbox reaches. Those sides mean the detection
      box cut through (or exactly at) content -> caller flags TRUNCATION-SUSPECT
      unless listed in EDGE_EXEMPT.
    """
    import numpy as np

    fg = np.asarray(alpha) >= lo
    if not fg.any():
        return None, set()
    ys, xs = np.nonzero(fg)
    l, t = int(xs.min()), int(ys.min())
    r, b = int(xs.max()) + 1, int(ys.max()) + 1
    w, h = alpha.size
    touch = set()
    if l == 0:
        touch.add("left")
    if t == 0:
        touch.add("top")
    if r == w:
        touch.add("right")
    if b == h:
        touch.add("bottom")
    bbox = (max(0, l - margin_px), max(0, t - margin_px), min(w, r + margin_px), min(h, b + margin_px))
    return bbox, touch


def _rdp(points, eps: float):
    """Iterative Ramer-Douglas-Peucker on an open polyline [(x, y), ...]."""
    import numpy as np

    pts = np.asarray(points, dtype=np.float64)
    n = len(pts)
    if n < 3:
        return [(float(p[0]), float(p[1])) for p in pts]
    keep = np.zeros(n, dtype=bool)
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        seg = pts[j] - pts[i]
        length = float(np.hypot(seg[0], seg[1])) or 1e-9
        d = np.abs(seg[0] * (pts[i + 1 : j, 1] - pts[i, 1]) - seg[1] * (pts[i + 1 : j, 0] - pts[i, 0])) / length
        k = int(np.argmax(d))
        if d[k] > eps:
            m = i + 1 + k
            keep[m] = True
            stack.append((i, m))
            stack.append((m, j))
    return [(float(p[0]), float(p[1])) for p in pts[keep]]


def _span_outline(mask):
    """Pure-numpy fallback outline: per-row left/right extremes, down the left
    side and back up the right. Crude (vertical concavities only) but always
    available; only used when skimage is missing."""
    import numpy as np

    ys, xs = np.nonzero(mask)
    left: list[tuple[float, float]] = []
    right: list[tuple[float, float]] = []
    for y in np.unique(ys):
        row = xs[ys == y]
        left.append((float(row.min()), float(y)))
        right.append((float(row.max()), float(y)))
    return left + right[::-1]


def _poly_area(pts) -> float:
    """Shoelace area (abs), used to rank/drop small contour islands."""
    acc = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        acc += x1 * y2 - x2 * y1
    return abs(acc) / 2.0


def _simplify(pts, max_pts: int):
    """Adaptive RDP for one closed contour."""
    eps = 1.5
    simp = _rdp(pts, eps)
    while len(simp) > max_pts and eps < 64:
        eps *= 1.6
        simp = _rdp(pts, eps)
    if len(simp) > max_pts:  # last resort: decimate
        step = -(-len(simp) // max_pts)
        simp = simp[::step]
    return simp


def drop_border_fringe(
    crop: Image.Image,
    alpha: Image.Image,
    lum_thresh: int = 108,
    sides: tuple[str, ...] = ("left", "right", "top", "bottom"),
) -> Image.Image:
    """Desk slivers / wall bits / gap shadows, without eating shaded parts of
    the object: drop pixels that are dark AND kept AND connected to the given
    crop-border sides. Interior shadows never reach the border, so they
    survive. `sides` protects borders that carry real content (the
    blueprint's bottom edge is the paper itself).
    """
    import numpy as np

    try:
        from scipy import ndimage
    except ImportError:
        print("  drop_border_fringe: scipy missing, no-op", flush=True)
        return alpha

    lum = np.asarray(crop.convert("L"), dtype=np.float32)
    a = np.asarray(alpha).copy()
    fringe = (a >= 28) & (lum <= lum_thresh)
    if not fringe.any():
        return Image.fromarray(a)
    labels, n = ndimage.label(fringe)
    border = set()
    if "top" in sides:
        border |= set(labels[0, :])
    if "bottom" in sides:
        border |= set(labels[-1, :])
    if "left" in sides:
        border |= set(labels[:, 0])
    if "right" in sides:
        border |= set(labels[:, -1])
    border.discard(0)
    if border:
        a[np.isin(labels, list(border))] = 0
    return Image.fromarray(a)


def sweep_dust(alpha: Image.Image, min_rel: float = 0.03) -> Image.Image:
    """Drop tiny leftover islands; keep the main object (and thin bits like an
    antenna — size-relative, not absolute)."""
    import numpy as np

    try:
        from scipy import ndimage
    except ImportError:
        return alpha

    arr = np.asarray(alpha)
    fg = arr >= 28
    labeled, n = ndimage.label(fg)
    if n <= 1:
        return alpha
    sizes = ndimage.sum(fg, labeled, index=list(range(1, n + 1)))
    sizes = np.atleast_1d(np.asarray(sizes, dtype=np.float64))
    mx = float(sizes.max()) if sizes.size else 0.0
    keep = np.zeros(arr.shape, dtype=bool)
    for i, sz in enumerate(sizes, start=1):
        if sz >= mx * min_rel or sz >= arr.size * 0.008:
            keep |= labeled == i
    out = arr.copy()
    out[~keep] = 0
    return Image.fromarray(out)


def keep_connected(alpha: Image.Image, dilate_steps: int = 3) -> Image.Image:
    """Keep only components attached to the main body (drops glow spills and
    background props that leaked into the detection box). The main component
    is dilated a few px first so thin attached bits (antenna) still count."""
    import numpy as np

    try:
        from scipy import ndimage
    except ImportError:
        return alpha

    arr = np.asarray(alpha)
    fg = arr >= 28
    labeled, n = ndimage.label(fg)
    if n <= 1:
        return alpha
    sizes = ndimage.sum(fg, labeled, index=list(range(1, n + 1)))
    sizes = np.atleast_1d(np.asarray(sizes, dtype=np.float64))
    main = int(sizes.argmax()) + 1
    grown = labeled == main
    for _ in range(dilate_steps):
        pad = np.pad(grown, 1, constant_values=False)
        grown = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    keep = np.zeros(arr.shape, dtype=bool)
    for i in range(1, n + 1):
        comp = labeled == i
        if i == main or (comp & grown).any():
            keep |= comp
    out = arr.copy()
    out[~keep] = 0
    return Image.fromarray(out)


def extract_polygon(
    alpha: Image.Image,
    max_pts: int = POLY_MAX_PTS,
    dilate_px: int = POLY_DILATE,
    lo: int = ALPHA_LO,
    max_polys: int = 6,
    min_rel_area: float = 0.05,
) -> list[list[list[float]]] | None:
    """Hit polygons for a finished matte, normalized to the PNG canvas [0,1].

    Returns a list of polygons (SVG clipPath unions them). Multi-part props
    (stamp + ink pot, props occluding each other) yield separate contours;
    islands below `min_rel_area` of the largest are dropped (dust), thin bits
    like a radio antenna die naturally by area.

    The mask is dilated outward first so the clip never sits tighter than the
    visible edge (glow and anti-aliased rim stay intact). Contour source:
    skimage.measure.find_contours, falling back to a coarse span outline.
    """
    import numpy as np

    mask = np.asarray(alpha) >= lo
    if not mask.any():
        return None
    if dilate_px > 0:
        mask = dilate_mask(mask, dilate_px)
    h, w = mask.shape

    contours: list[list[tuple[float, float]]] = []
    try:
        from skimage import measure

        padded = np.pad(mask, 1).astype(float)
        found = measure.find_contours(padded, 0.5)
        for c in found:
            pts = [(float(p[1] - 1), float(p[0] - 1)) for p in c]  # (x, y)
            if len(pts) > 1 and pts[0] == pts[-1]:
                pts = pts[:-1]
            if len(pts) >= 3:
                contours.append(pts)
    except Exception as e:  # skimage missing or contour failed
        print(f"  polygon: skimage unavailable ({e}); coarse span outline", flush=True)
        pts = _span_outline(mask)
        if len(pts) >= 3:
            contours.append(pts)

    if not contours:
        return None
    areas = [_poly_area(p) for p in contours]
    biggest = max(areas)
    keep = [p for p, a in zip(contours, areas) if a >= biggest * min_rel_area]
    keep.sort(key=_poly_area, reverse=True)
    keep = keep[:max_polys]

    out: list[list[list[float]]] = []
    for p in keep:
        simp = _simplify(p, max_pts)
        if len(simp) >= 3:
            out.append(
                [
                    [round(min(max(x / w, 0.0), 1.0), 4), round(min(max(y / h, 0.0), 1.0), 4)]
                    for x, y in simp
                ]
            )
    return out or None
