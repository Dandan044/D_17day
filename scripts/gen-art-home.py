"""Generate in-run shelter scenes + window weather plates for the art-skin Game UI.

Hotspot design (fraction boxes are the *intended* layout the prompt must produce;
cut-art-home.py CROPS / skin.ts CUT_HOME must be the same numbers after we measure
the baked pixels — if the model shifts an object, update both files together).

scene-home-desk.jpg  1664x928  eye-level, sitting at the desk, looking forward
  window+curtains   center-top     weather overlay under glass     (0.30, 0.12, 0.70, 0.46)
  glass (weather)   inner pane     not a cutout                    (0.32, 0.16, 0.68, 0.44)
  blueprint         left wall      shelter overlay                 (0.02, 0.10, 0.26, 0.50)
  notebook          desk left      daily event (must-read)         (0.16, 0.58, 0.33, 0.84)
  plan sheet        desk mid       today's plan                    (0.33, 0.60, 0.50, 0.88)
  clock             desk mid-right day / AP HUD                    (0.50, 0.48, 0.64, 0.76)
  radio             desk far right intel / radio                   (0.64, 0.50, 0.88, 0.84)

scene-home-side.jpg  1664x928  same room, camera yawed left
  bed               far left       rest; AP=0 ends the day         (0.00, 0.22, 0.32, 0.98)
  medkit            nightstand     body / treatment                (0.32, 0.50, 0.46, 0.82)
  door              center         map (scavenge / shop)           (0.50, 0.08, 0.70, 0.96)
  shelf             far right      supplies + special items        (0.72, 0.10, 0.99, 0.94)

Window plates are outdoor views only (no frame, no curtains) and get object-fit:cover
into the glass box. Prep vs survival share the same pane.
"""

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
    "人脸, 人物, 手, 重复物体, 过曝, 白色背景, 桌上放杯子, 桌上放书, "
    "第二本笔记本, 第二台收音机, 两张床, 两扇门, 鲜艳高饱和"
)

SCENE = "1664x928"
PANE = "1024x1024"

JOBS: list[tuple[str, str, str, int]] = [
    (
        "scene-home-desk.jpg",
        SCENE,
        STYLE
        + "超宽16:9，镜头平视，从一张旧木桌正后方坐着往前看的房间视角，看不见人，景深清楚不要虚化主体边缘。"
        "中国城市旧公寓，深灰蓝墙，混凝土地面比家具亮一档，左侧窗光加一盏琥珀吊灯打亮桌面。"
        "房间里可点的物件左右分开、互不重叠、互不遮挡，物件之间留空隙："
        "正前方中上部只有一扇老式木框窗户，两边各一块半拉开的厚布窗帘，窗帘停在窗框两侧，"
        "不挡住窗玻璃中央的大块空景，玻璃里是城市黄昏天际线；只能有一扇窗。"
        "左侧墙面钉着一张大号空白工程硫酸纸图纸，纸面空白不要字不要标注，只能有一张。"
        "桌面最左侧一本合上的深色硬皮笔记本，皮绳捆着，只能有一本。"
        "桌面中左一张摊开的空白方格计划纸，纸上完全空白不要字，只能有一张。"
        "桌面中右一座老式机械台钟，表盘刻度模糊不可读，只能有一座。"
        "桌面最右侧一台中国老式木壳收音机，短天线和旋钮，琥珀指示灯，只能有一台。"
        "桌面不要杯子、不要笔、不要其他书、不要烟灰缸。无人。",
        45101,
    ),
    (
        "scene-home-side.jpg",
        SCENE,
        STYLE
        + "超宽16:9，同一间中国城市旧公寓，镜头平视，从桌边转向房间另一侧，景深清楚。"
        "深灰蓝墙，混凝土地面比家具亮一档，侧光加琥珀吊灯。"
        "四件东西左右分开、互不重叠、互不遮挡，中间留空隙："
        "最左侧一张单人铁架床，灰绿军毯叠整齐，床头靠墙，只能有一张床。"
        "床右侧一个矮木床头柜，柜上只有一个深色金属急救药箱，箱盖合上，只能有一个药箱。"
        "画面正中一扇关着的深色旧木门，黄铜把手，门不贴着床也不贴着架子，只能有一扇门。"
        "最右侧一个敞开的木置物架，架子上是无标签罐头、水瓶、牛皮纸箱，不要可读文字，只能有一个架子。"
        "无人。不要第二张床，不要第二扇门。",
        45102,
    ),
    (
        "win-pre-clear.jpg",
        PANE,
        STYLE
        + "从六层居民楼窗玻璃里看出去的城市黄昏，晴朗，中国南方街巷与单元楼，暖色夕光，"
        "没有窗框、没有窗帘、没有室内，只有窗外实景。无人。无文字。",
        45201,
    ),
    (
        "win-pre-overcast.jpg",
        PANE,
        STYLE
        + "从居民楼窗玻璃里看出去的阴天中国城市，灰云压楼顶，街道湿暗但还正常，"
        "没有窗框、没有窗帘、没有室内。无人。无文字。",
        45202,
    ),
    (
        "win-pre-rain.jpg",
        PANE,
        STYLE
        + "从居民楼窗玻璃里看出去的下雨中国城市，雨丝、积水倒影、撑伞的远景剪影尽量不要清晰人脸，"
        "没有窗框、没有窗帘、没有室内。无人近景。无文字。",
        45203,
    ),
    (
        "win-pre-fog.jpg",
        PANE,
        STYLE
        + "从居民楼窗玻璃里看出去的浓雾中国城市，楼房只剩剪影，街灯晕开，"
        "没有窗框、没有窗帘、没有室内。无人。无文字。",
        45204,
    ),
    (
        "win-rainstorm.jpg",
        PANE,
        STYLE
        + "灾难后的中国城市暴雨内涝，窗外街道没过台阶，停电的楼，远处应急灯，"
        "没有窗框、没有窗帘、没有室内。无人。无文字。",
        45211,
    ),
    (
        "win-snow.jpg",
        PANE,
        STYLE
        + "灾难后的中国城市核冬天积雪，灰黑雪、枯树、空荡街道，铅云，"
        "没有窗框、没有窗帘、没有室内。无人。无文字。",
        45212,
    ),
    (
        "win-ashfall.jpg",
        PANE,
        STYLE
        + "灾难后的中国城市落灰，屋顶和马路覆着一层细灰，天色土黄，能见度低，"
        "没有窗框、没有窗帘、没有室内。无人。无文字。",
        45213,
    ),
    (
        "win-blackrain.jpg",
        PANE,
        STYLE
        + "灾难后的中国城市黑雨，雨是深灰近黑，楼墙淌脏水痕，天空病绿，"
        "没有窗框、没有窗帘、没有室内。无人。无文字。",
        45214,
    ),
    (
        "win-heatwave.jpg",
        PANE,
        STYLE
        + "灾难后的中国城市热浪，白晃晃的死阳光，干裂路面，停运的车辆，空气扭曲，"
        "没有窗框、没有窗帘、没有室内。无人。无文字。",
        45215,
    ),
    (
        "win-smog.jpg",
        PANE,
        STYLE
        + "灾难后的中国城市毒雾，黄绿雾气吞楼，能见度极低，几盏应急灯，"
        "没有窗框、没有窗帘、没有室内。无人。无文字。",
        45216,
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
    timeout = int(cfg.get("timeout_seconds", 120))
    delay = 8.0
    last_err: Exception | None = None
    for attempt in range(6):
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
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            raw = base64.b64decode(body["data"][0]["b64_json"])
            Image.open(BytesIO(raw)).convert("RGB").save(dest, "JPEG", quality=88, optimize=True)
            return
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", errors="replace")
            last_err = e
            if e.code != 429:
                print(f"  HTTP {e.code}: {err[:800]}", flush=True)
                raise
            print(f"  HTTP 429, retry in {delay:.0f}s ({attempt + 1}/6)", flush=True)
            time.sleep(delay)
            delay = min(delay * 1.8, 60.0)
    raise last_err if last_err else RuntimeError("generate failed")


def main() -> None:
    cfg = load_cfg()
    pending = [j for j in JOBS if not (OUT / j[0]).exists()]
    print(f"{len(JOBS) - len(pending)} exist, {len(pending)} to generate", flush=True)
    for i, (name, size, prompt, seed) in enumerate(pending, 1):
        dest = OUT / name
        print(f"[{i}/{len(pending)}] {name} seed={seed}", flush=True)
        generate(cfg, prompt, size, seed, dest)
        print(f"  ok {dest.stat().st_size} bytes", flush=True)
        time.sleep(max(3.0, float(cfg.get("request_interval_seconds", 1.0))))
    print("done", flush=True)


if __name__ == "__main__":
    main()
