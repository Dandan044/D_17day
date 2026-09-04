"""Generate pre-game UI art via on-prem qwen-image. Skips files that already exist."""

from __future__ import annotations

import base64
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "art"
CFG = Path(r"D:\Dandan\LLMbox\LLM_Benchmark\backend\configs\model_configs\img-qwen-image.json")

STYLE = (
    "中国城市民防档案气质的写实摄影，暗调深灰蓝与墨黑，琥珀警示灯 #e0a112，"
    "旧牛皮纸文件夹、氧化钢板、档案室顶灯、胶片颗粒、纪录片静物构图，"
    "克制、冷静、官僚机构的触觉感。不要卡通，不要赛博霓虹，不要辐射废土卡通，"
    "不要血腥，画面中不要出现任何文字、字母、数字、水印、logo。"
)
NEG = (
    "文字, 字母, 汉字, 英文, 数字, 水印, 签名, logo, 模糊, 低分辨率, "
    "卡通, 动漫, 赛博朋克霓虹, 辐射避难所卡通, 血腥 gore, 僵尸, "
    "过曝, 鲜艳高饱和, 笑脸, 摆拍广告, 人脸特写, 多人合影"
)

JOBS: list[tuple[str, str, str]] = [
    (
        "menu-bg.jpg",
        "1664x928",
        STYLE
        + "超宽16:9游戏主菜单背景。夜晚的民防档案室，一只吊灯照在钢桌上，画面中央和左侧大面积留暗，方便叠标题。"
        "桌上有合上的牛皮纸档案袋、一台发出微弱琥珀指示灯的短波收音机、一张用油脂铅笔圈过的中国城市地图、窗外是熄灯的天际线。"
        "体积光尘埃，暗角，电影静帧，无人。",
    ),
    (
        "setup-bg.jpg",
        "1664x928",
        STYLE
        + "超宽16:9出身选择界面背景。档案室长廊，金属密集架向深处退去，一只抽屉被拉开，里面是人事档案袋。"
        "尽头有一盏琥珀工作灯。冷、制度感、略带庄重。中央大面积留暗给UI。无人，无文字。",
    ),
    (
        "site-bg.jpg",
        "1664x928",
        STYLE
        + "超宽16:9选址界面背景。钢桌上摊开一张中国城市地图，油脂铅笔圈出几个点，旁边是指南针、手电筒和一串钥匙。"
        "窗外阴天。画面四周有细节，中下留暗给卡片。无人，无文字。",
    ),
    (
        "class-clerk.jpg",
        "1024x1024",
        STYLE
        + "职业静物：中国街边便利店打烊后的柜台。货架上的瓶装水和方便面，进货单夹在铁夹上，老式收银机，卷帘门半落。"
        "冷荧光，纪录片静物，无人。",
    ),
    (
        "class-engineer.jpg",
        "1024x1024",
        STYLE
        + "职业静物：结构工程师的工作台。晒过的建筑图纸、比例尺、安全帽放在一边、混凝土试块、一只旧计算器。"
        "台灯暖琥珀，无人。",
    ),
    (
        "class-nurse.jpg",
        "1024x1024",
        STYLE
        + "职业静物：医院夜班走廊尽头的处置台。口罩、碘伏、听诊器、写了一半的交班本，冷荧光管将灭未灭。"
        "疲惫而干净，无人。",
    ),
    (
        "class-veteran.jpg",
        "1024x1024",
        STYLE
        + "职业静物：退役军人的抽屉。叠好的便装、一双擦过的旧军靴、指南针、褪色的布条，没有勋章特写。"
        "克制，室内窗光，无人。",
    ),
    (
        "class-hoarder.jpg",
        "1024x1024",
        STYLE
        + "职业静物：从地板堆到天花板的储物间。米面油桶、胶带封箱、标签朝里，一条仅能侧身通过的缝。"
        "逼仄，琥珀灯泡，无人。",
    ),
    (
        "class-hacker.jpg",
        "1024x1024",
        STYLE
        + "职业静物：数据分析师的桌子。多块暗着的显示器、打印出来的折线、短波天线、便利贴全是色块没有字。"
        "屏幕微光，无人。",
    ),
    (
        "class-trucker.jpg",
        "1024x1024",
        STYLE
        + "职业静物：长途货车驾驶室夜宿。方向盘、暖壶、一箱方便面、油卡和一只手电筒，挡风玻璃外是服务区的黑暗。"
        "无人。",
    ),
    (
        "class-chemist.jpg",
        "1024x1024",
        STYLE
        + "职业静物：中学化学准备室午后。试剂柜、碘酒瓶、活性炭、量筒，窗帘半拉，没有危险品标签文字。"
        "安静，无人。",
    ),
    (
        "site-apartment.jpg",
        "1664x928",
        STYLE
        + "选址关键图16:9：中国城市六楼两居室，傍晚。旧防盗门，太多窗户对着城市天际线，地板有一块会响。"
        "窗帘未拉严，琥珀路灯漏进来。无人，无招牌文字。",
    ),
    (
        "site-bungalow.jpg",
        "1664x928",
        STYLE
        + "选址关键图16:9：城南待拆迁平房小院。废弃压水井、一棵石榴树、空心砖墙、远处有拆迁编号涂漆但字迹被抹掉。"
        "阴天，无人。",
    ),
    (
        "site-garage.jpg",
        "1664x928",
        STYLE
        + "选址关键图16:9：小区地下车库负二层角落。没有自然光，一根将灭的荧光管，厚混凝土顶，地面有油渍和水渍。"
        "恒温洞穴感，无人。",
    ),
    (
        "site-farmhouse.jpg",
        "1664x928",
        STYLE
        + "选址关键图16:9：离城四十公里的郊区农舍。水井、半塌的猪圈、冬天的田，地平线上没有邻居。"
        "冷风，孤立，无人。",
    ),
    (
        "site-bunker.jpg",
        "1664x928",
        STYLE
        + "选址关键图16:9：七十年代防空洞入口，藏在关停的修车铺后面。锈死的铁门，滴水的顶，墙上褪色标语已被刮到无法辨认。"
        "潮湿，无人。",
    ),
    (
        "site-watertower.jpg",
        "1664x928",
        STYLE
        + "选址关键图16:9：北山半坡停用的市政水塔。三百级铁梯，风打在铁皮上，山下是进城公路。"
        "高处视野，阴天，无人。",
    ),
]


def load_cfg() -> dict:
    return json.loads(CFG.read_text(encoding="utf-8"))


def generate(cfg: dict, prompt: str, size: str, dest: Path) -> None:
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
            "seed": 20260904,
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
    if dest.suffix.lower() in {".jpg", ".jpeg"}:
        from io import BytesIO
        from PIL import Image

        Image.open(BytesIO(raw)).convert("RGB").save(dest, "JPEG", quality=86, optimize=True)
    else:
        dest.write_bytes(raw)


def main() -> None:
    cfg = load_cfg()
    print(f"endpoint {cfg['url']}", flush=True)
    pending = [(name, size, prompt) for name, size, prompt in JOBS if not (OUT / name).exists()]
    print(f"{len(JOBS) - len(pending)} exist, {len(pending)} to generate", flush=True)
    for i, (name, size, prompt) in enumerate(pending, 1):
        dest = OUT / name
        print(f"[{i}/{len(pending)}] {name} {size}", flush=True)
        try:
            generate(cfg, prompt, size, dest)
            print(f"  ok {dest.stat().st_size} bytes", flush=True)
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", errors="replace")
            print(f"  HTTP {e.code}: {err[:800]}", flush=True)
            raise
        except Exception as e:
            print(f"  fail: {e}", flush=True)
            raise
        time.sleep(max(1.0, float(cfg.get("request_interval_seconds", 1.0))))
    print("done", flush=True)


if __name__ == "__main__":
    main()
