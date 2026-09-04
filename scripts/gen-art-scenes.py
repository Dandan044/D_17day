"""Generate two complete menu scenes, then cut objects out of the same pixels."""

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
    "中国城市民防档案气质的写实摄影，暗调深灰蓝与墨黑，琥珀灯光 #e0a112，"
    "胶片颗粒，纪录片。不要卡通，不要赛博霓虹，不要任何文字、字母、数字、水印。"
)
NEG = (
    "文字, 字母, 汉字, 英文, 数字, 水印, logo, 模糊, 卡通, 动漫, 赛博朋克, "
    "人脸, 两台售货机, 桌上放书, 重复物体, 过曝, 白色背景"
)

JOBS: list[tuple[str, str, str, int]] = [
    (
        "scene-room.jpg",
        "1664x928",
        STYLE
        + "超宽16:9一个房间，镜头平视，景深清楚。房间里只有三件东西，左右分开、互不重叠："
        "最左侧一张空的旧木桌或钢桌，桌面完全空着，不要书不要杯子，一盏吊灯照亮桌面；"
        "画面中后方一排金属档案架，装满牛皮纸档案袋；"
        "最右侧一台中国旧自动售货机，只能有一台，玻璃里是瓶装水和方便面，琥珀指示灯。"
        "混凝土地面，暗房间。无人。",
        44101,
    ),
    (
        "scene-desk.jpg",
        "1664x928",
        STYLE
        + "超宽16:9，几乎正俯视的桌面特写，桌子占满画面。"
        "桌面上清楚分开摆着三件东西，左右之间留出空隙，互不重叠、互不遮挡："
        "左侧一本合上的旧硬皮日记本，皮绳捆着；"
        "中间一本摊开的笔记本，钢笔斜放在空白页上，纸上不要字；"
        "右侧一个木质印章和印泥盒。"
        "顶光偏暖，像从吊灯正上方拍下来。无人。",
        44102,
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
            "num_inference_steps": 30,
            "negative_prompt": NEG,
            "true_cfg_scale": 4.2,
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
    Image.open(BytesIO(raw)).convert("RGB").save(dest, "JPEG", quality=88, optimize=True)


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
