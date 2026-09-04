"""Small stills for origin packs and difficulty. Skips existing files."""

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
    "中国城市民防档案气质的写实摄影，暗调深灰蓝，琥珀侧光，胶片颗粒，单独静物居中，"
    "深灰黑背景，四周留暗边以便叠加。不要文字、字母、数字、水印、人脸。"
)
NEG = "文字, 字母, 汉字, 英文, 数字, 水印, logo, 卡通, 人脸, 白色背景, 过曝"

JOBS: list[tuple[str, str, int]] = [
    ("pack-none.jpg", STYLE + "空空的桌面一角，只有一个打开的空牛皮纸袋，什么都没装。", 44001),
    ("pack-basic.jpg", STYLE + "一箱瓶装矿泉水和一箱方便面，超市促销袋还套着。", 44002),
    ("pack-medical.jpg", STYLE + "家庭医药箱，纱布、碘伏、过期感冒药，铁盒起锈。", 44003),
    ("pack-tools.jpg", STYLE + "装修剩下的木板、螺丝盒和半桶涂料，堆在阳台一角。", 44004),
    ("pack-cash.jpg", STYLE + "一叠用橡皮筋捆着的人民币现金和一本褪色的存折，不要可辨认数字。", 44005),
    ("diff-story.jpg", STYLE + "一本摊开的小说和一支蜡烛，暖光，安全、叙事感。", 44006),
    ("diff-normal.jpg", STYLE + "一台短波收音机，琥珀指示灯，平静的标准准备。", 44007),
    ("diff-harsh.jpg", STYLE + "熄灭的灯、结霜的窗和一只空碗，严苛、寒冷。", 44008),
]


def main() -> None:
    cfg = json.loads(CFG.read_text(encoding="utf-8"))
    pending = [j for j in JOBS if not (OUT / j[0]).exists()]
    print(f"{len(JOBS) - len(pending)} exist, {len(pending)} to generate", flush=True)
    for i, (name, prompt, seed) in enumerate(pending, 1):
        dest = OUT / name
        print(f"[{i}/{len(pending)}] {name}", flush=True)
        payload = json.dumps(
            {
                "model": cfg.get("model_name", "qwen-image"),
                "prompt": prompt,
                "n": 1,
                "size": "1024x1024",
                "response_format": "b64_json",
                "num_inference_steps": 24,
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
        try:
            with urllib.request.urlopen(req, timeout=int(cfg.get("timeout_seconds", 120))) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            raw = base64.b64decode(body["data"][0]["b64_json"])
            Image.open(BytesIO(raw)).convert("RGB").save(dest, "JPEG", quality=86, optimize=True)
            print(f"  ok {dest.stat().st_size}", flush=True)
        except urllib.error.HTTPError as e:
            print(f"  HTTP {e.code}: {e.read()[:400]!r}", flush=True)
            raise
        time.sleep(1.0)
    print("done", flush=True)


if __name__ == "__main__":
    main()
