"""对账：把代码里引用的美术素材和磁盘上的实际文件比对，列出缺失项。

引用来源：
  1. `src/**` 里所有 `./art/<名字>` 与 `/art/<名字>` 字面量（skin.ts 的 ART 表、组件内联路径）
  2. `src/**` 的 CSS 里 `url(...)` 里的 art 路径
  3. `src/ui/art/artLayout.json` 里每个条目的 `file` 字段
  4. `src/ui/art/cutouts.json` 里出现的文件名字符串
  5. 规则生成的路径（`ART.module(id, lv)` / `ART.modelCut(id)` / `ART.wearSanity(stage, i)` 之类），
     用 MODULES / 等级 / 具体清单枚举出来

输出：缺失清单 + 未被引用的孤儿文件（供参考）。
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public" / "art"
SRC = ROOT / "src"

on_disk = {p.name for p in ART.iterdir() if p.is_file()}
refs: dict[str, set[str]] = {}


def add(name: str, where: str) -> None:
    name = name.strip()
    if not name:
        return
    refs.setdefault(name, set()).add(where)


# ---- 1/2. src 下所有 art 路径字面量（含 css url()）----
pat_art = re.compile(r"[./]*/art/([A-Za-z0-9_\-./]+?\.(?:png|jpg|jpeg|webp|svg))")
for p in SRC.rglob("*"):
    if p.suffix not in {".ts", ".tsx", ".css"}:
        continue
    text = p.read_text(encoding="utf-8", errors="ignore")
    rel = str(p.relative_to(ROOT))
    for m in pat_art.finditer(text):
        add(m.group(1), rel)

# ---- 3. artLayout.json ----
layout = ROOT / "src" / "ui" / "art" / "artLayout.json"
if layout.exists():
    for key, item in json.loads(layout.read_text(encoding="utf-8")).items():
        if isinstance(item, dict) and item.get("file"):
            add(str(item["file"]), f"artLayout.json:{key}")

# ---- 4. 规则生成的路径：模块分级图 / 模型抠图 / 污损 / 线稿 ----
# 只认模块定义那一层的 id（4 空格缩进）——否则 \ 这类嵌套技能 id 会被当成模块，报一堆假缺失
mods = re.findall(r"^    id: '([a-zA-Z]+)',", (SRC / "game/content/modules.ts").read_text(encoding="utf-8"), re.M)
for mid in mods:
    for lv in (1, 2, 3):
        add(f"mod-{mid}-{lv}.png", "ART.module()")
sites = re.findall(r"^    id: '([a-zA-Z]+)',", (SRC / "game/content/sites.ts").read_text(encoding="utf-8"), re.M)
for sid in sites:
    add(f"cut-model-{sid}.png", "ART.modelCut()")
    add(f"model-{sid}.jpg", "ART.model()")
for stage in (2, 3):
    for i, ch in enumerate("abc"):
        add(f"wear-sanity{stage}-{ch}.jpg", "ART.wearSanity()")
for i in (1, 2, 3):
    add(f"wear-blood-{i}.jpg", "ART.wearBlood()")
add("wear-hand.jpg", "ART.wearHand()")
for k in ("power", "ration", "water", "thermo"):
    add(f"line-{k}.png", "线稿")
    add(f"line-{k}-mask.png", "线稿掩膜")

missing = sorted(n for n in refs if n not in on_disk)
orphan = sorted(n for n in on_disk if n not in refs and not n.endswith(".json"))

print(f"磁盘 {len(on_disk)} 个文件；代码引用 {len(refs)} 个名字\n")
print(f"===== 缺失（代码引用但磁盘没有）：{len(missing)} 个 =====")
for n in missing:
    print(f"  ✗ {n:<34} ← {', '.join(sorted(refs[n])[:2])}")
print(f"\n===== 磁盘上有、代码没引用：{len(orphan)} 个 =====")
for n in orphan:
    print(f"  ? {n}")
