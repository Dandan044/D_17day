"""Diegetic UI objects + map models. Skips files that already exist."""

from __future__ import annotations

import base64
import json
import time
import urllib.error
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "art"
CFG = Path(r"D:\Dandan\LLMbox\LLM_Benchmark\backend\configs\model_configs\img-qwen-image.json")

STYLE = (
    "中国城市民防档案气质的写实摄影，暗调深灰蓝与墨黑，琥珀侧光 #e0a112，"
    "胶片颗粒，纪录片静物。不要卡通，不要赛博霓虹，不要文字、字母、数字、水印。"
)
NEG = (
    "文字, 字母, 汉字, 英文, 数字, 水印, logo, 模糊, 卡通, 动漫, 赛博朋克, "
    "人脸, 多人, 过曝, 鲜艳, 白色背景, 纯白棚拍"
)

JOBS: list[tuple[str, str, str, int]] = [
    (
        "menu-stage.jpg",
        "1664x928",
        STYLE
        + "超宽16:9空荡的民防档案室夜景，作为摆放物件的舞台。"
        "左侧一张空的氧化钢桌被吊灯照着，中央地面有暗影，右侧墙边留出放售货机的空位，"
        "后墙是金属档案架。大量负空间。无人。不要已经放好的日记本或售货机。",
        11001,
    ),
    (
        "obj-notebook.jpg",
        "1024x1024",
        STYLE
        + "单独一件静物居中：一本用旧的硬皮日记本，皮绳捆着，边角起毛，深灰黑背景，琥珀侧光。"
        "物件占画面约60%，四周留暗边以便叠加进房间。无人。",
        11002,
    ),
    (
        "obj-journal.jpg",
        "1024x1024",
        STYLE
        + "单独一件静物居中：摊开的半写日记，一支钢笔压在空白页上，书签绳垂下，深灰黑背景，琥珀侧光。"
        "物件占画面约60%，四周留暗边。页面上不要可辨认文字。",
        11003,
    ),
    (
        "obj-vending.jpg",
        "1024x1024",
        STYLE
        + "单独一件静物：一台中国城市旧自动售货机，玻璃后是瓶装水和方便面，一块熄灭的显示屏，一盏琥珀指示灯。"
        "深灰黑背景，正面三分之四侧面，物件完整可见。无人，无商标文字。",
        11004,
    ),
    (
        "obj-cabinet.jpg",
        "1024x1024",
        STYLE
        + "单独一件静物：一只锈边的绿色铁皮文件柜，一只抽屉微开，露出牛皮纸袋边缘。深灰黑背景，琥珀侧光。无人。",
        11005,
    ),
    (
        "obj-stamp.jpg",
        "1024x1024",
        STYLE
        + "单独一件静物：木质印章和印泥盒，旁边一张空白回执。深灰黑背景，琥珀侧光。印章上不要可辨认文字。",
        11006,
    ),
    (
        "map-board.jpg",
        "1664x928",
        STYLE
        + "超宽16:9：铺在钢桌上的中国北方城市与郊区手绘地图，斜微俯视。"
        "市中心楼群、南边平房、西边田野、北边山丘、一处地下车库符号般的方块、一处人防入口。"
        "油脂铅笔圈，没有地名文字，暗角，档案室灯光。",
        22001,
    ),
    (
        "model-apartment.jpg",
        "1024x1024",
        STYLE
        + "建筑微缩模型，等距45度，同一比例，深灰桌面，博物馆射灯。"
        "中国六层老居民楼，防盗窗，楼顶水箱。模型完整，四周留暗。无文字。",
        33001,
    ),
    (
        "model-bungalow.jpg",
        "1024x1024",
        STYLE
        + "建筑微缩模型，等距45度，深灰桌面，博物馆射灯。"
        "城南待拆迁平房小院，压水井，石榴树，空心砖墙。四周留暗。无文字。",
        33002,
    ),
    (
        "model-garage.jpg",
        "1024x1024",
        STYLE
        + "建筑微缩模型，等距45度，深灰桌面，博物馆射灯。"
        "小区地下车库坡道入口，混凝土，一根将灭的荧光管。四周留暗。无文字。",
        33003,
    ),
    (
        "model-farmhouse.jpg",
        "1024x1024",
        STYLE
        + "建筑微缩模型，等距45度，深灰桌面，博物馆射灯。"
        "郊区农舍、水井、半塌猪圈、冬天的田。四周留暗。无文字。",
        33004,
    ),
    (
        "model-bunker.jpg",
        "1024x1024",
        STYLE
        + "建筑微缩模型，等距45度，深灰桌面，博物馆射灯。"
        "七十年代防空洞入口，锈铁门，藏在关停修车铺后。四周留暗。无文字。",
        33005,
    ),
    (
        "model-watertower.jpg",
        "1024x1024",
        STYLE
        + "建筑微缩模型，等距45度，深灰桌面，博物馆射灯。"
        "山腰停用市政水塔，铁梯，山下有公路。四周留暗。无文字。",
        33006,
    ),
]


def load_cfg() -> dict:
    return json.loads(CFG.read_text(encoding="utf-8"))


def generate(cfg: dict, prompt: str, size: str, seed: int, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(
        {
            "model": cfg.get("model_name", "qwen-image"),
            "prompt": prompt,
            "n": 1,
            "size": size,
            "response_format": "b64_json",
            "num_inference_steps": 28,
            "negative_prompt": NEG,
            "true_cfg_scale": 4.0,
            "seed": seed,
        },
        ensure_ascii=False,
    ).encode("utf-8")
    req = urllib.request.Request(
        cfg["url"],
        data=payload,
        headers={
            "Authorization": f"Bearer {cfg['key']}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=int(cfg.get("timeout_seconds", 120))) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    raw = base64.b64decode(body["data"][0]["b64_json"])
    Image.open(BytesIO(raw)).convert("RGB").save(dest, "JPEG", quality=86, optimize=True)


def main() -> None:
    cfg = load_cfg()
    pending = [j for j in JOBS if not (OUT / j[0]).exists()]
    print(f"{len(JOBS) - len(pending)} exist, {len(pending)} to generate", flush=True)
    for i, (name, size, prompt, seed) in enumerate(pending, 1):
        dest = OUT / name
        print(f"[{i}/{len(pending)}] {name} seed={seed}", flush=True)
        try:
            generate(cfg, prompt, size, seed, dest)
            print(f"  ok {dest.stat().st_size} bytes", flush=True)
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", errors="replace")
            print(f"  HTTP {e.code}: {err[:800]}", flush=True)
            raise
        time.sleep(max(1.0, float(cfg.get("request_interval_seconds", 1.0))))
    print("done", flush=True)


if __name__ == "__main__":
    main()
