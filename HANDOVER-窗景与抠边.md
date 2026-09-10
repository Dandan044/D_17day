# 交接文档：窗景对齐与抠边清理

> 2026-09-09。解决《七日之前》档案皮肤局内场景的四类视觉问题。全部改完并验证通过，构建和类型检查绿，玩家第 11 天存档未动。
>
> **2026-09-10 追加修复（见「八、一致性窗景系列」与「九、第二轮：窗几何重测」）**：窗盒底 0.46→0.555（旧盒切掉了下沿 0.08H 玻璃段——「天气没铺满」的真凶）、吊灯保留区从右偏走廊改为 JSON 里的场景分数 bbox（旧走廊右偏 66px 只保住灯罩右 1/3）、窗景整体重制为 18 张一致性系列（三段阶段 × 天气，ImageGen img2img 基准衍生）。

## 一、四类问题与处理结果

### 1. 天气「贴在窗上」（已解决）

**根因**（比初判多一层）：
- 旧掏洞右缘切进窗帘、下缘上方留了一条画死的黄昏城（「原景描边」）。
- `skin.ts` 的 `WIN_PANES` 与 `cut-art-home.py` 的 `WINDOW_PANES` 各自手调漂移，不是一套数。
- 灯规则按「暖亮色」识别，把玻璃里烤进去的**暖色黄昏天空**也当成灯保留——左下一大块暖色城景没被掏空。

**处理**：
- 新建 `src/ui/art/windowPanes.json` 作窗几何唯一来源，`skin.ts` 和 `scripts/cut-art-home.py` 共读。从此只维护一套数。
- 逐像素重测：窗裁切框上沿 0.12→0.10（原来切进了玻璃）；发现**上排是一条宽亮子**（中间暗带是楼影/半截棂），改为整宽掏空；下排两扇按真竖棂 0.481–0.524 分开。
- 灯规则收进实测走廊（窗裁切框内 x 0.55–0.66、y<0.26，暖亮或暗），暖色天空/城景全部掏空。
- 前端天气洞 = 掏洞每边外扩 1.2%（`HOLE_BLEED`），伸到不透明窗框底下挡溢边。

### 2. 天气图自带窗框（已解决）

- 4 张带框图（`win-pre-clear/pre-rain/pre-fog/rainstorm`）重生成。prompt 删掉「从窗玻璃里看出去」（这句话本身就在邀请模型画框），改纯外景平视；新增 `NEG_WIN` 追加窗框/窗帘/窗台/玻璃（全局 `NEG` 不能加，场景图还需要窗）。
- 尺寸 1024²→1664x928：窗裁切区约 2.1:1，方图被 `object-fit:cover` 切掉近一半高度，是「放大像贴图」的部分原因。
- 顺带修了 `gen-art-home.py` 的网络重试：补 `http.client.HTTPException` / `ConnectionError` 等断线异常（大图响应常半截断）。

### 3. 交互件抠边脏（已解决）

`cut-art-home.py` 加了 `KEY_CFG` 按 key 配置（模型覆盖 / 后处理钩子 / 连通块清扫 / min_cover 回退），替代原来散在 `silhouette()` 里的硬编码 if。逐件：

| 物件 | 处理 | 结果 |
|---|---|---|
| 笔记本 | 收框到底部 0.801 + `drop_desk_under_book` | 桌面条没了 |
| 计划纸 | 收框 + `drop_wood_fringe` | 左下木条没了 |
| 图纸 | 收框（右缘 0.26→0.205 去掉墙，下缘 0.50→0.448 切掉桌沿） | 木条没了 |
| 收音机 | 框顶 0.50→0.465 接住完整天线 + `keep_connected` | 天线完整、左下辉光孤岛没了 |
| 货架 | isnet 只认出 0.048 → `min_cover: 0.30` 回退 u2net | 整架保留（cover 0.47） |

门/药箱/床/台钟本来就干净，未动。

### 4. 窗框对齐 + 玻璃感（已解决）

- 两套坐标已合一。
- `art.css` 给 `.art-win-hole::after` 加了轻度斜向反光 + 暗角，天气像隔着玻璃而不是四张 JPEG。没用 `mask-image`（当前浏览器不生效）。

## 二、门槛结论

「窗套窗」已消失（无框天气 + 对齐掏洞），**不需要**重画 `scene-home-desk`。

## 三、当前待解决 / 可选

1. **（可选，唯一的进一步项）** 其余 6 张干净的旧天气图（`win-pre-overcast/snow/ashfall/blackrain/heatwave/smog`）仍是 1024²。想让 10 张清晰度和颗粒尺度统一，删掉它们重跑 `python scripts/gen-art-home.py` 即可（现在 `PANE` 已是 1664x928，prompt 只剩这 6 张还是旧的「从窗玻璃里看出去」写法——重生前先把它们的 prompt 也改成纯外景，否则会带出窗框）。
2. **（低优先）** 台钟顶弧/底边有轻微烤边，未处理。明显的话把 `cut-h-clock` 的 `harden` 阈值略升或 1px 腐蚀。
3. **（低优先）** 笔记本底边在个别光线下可能还有一丝亮线，属残留透视，可再收 1px。

## 四、关键文件

- `src/ui/art/windowPanes.json` — 窗几何唯一来源（裁切框 + 3 块玻璃格）。
- `src/ui/art/skin.ts` — `CUT_HOME.window` 与 `WIN_PANES` 都从 JSON 派生；其余物件框与 `CROPS` 双写。
- `scripts/cut-art-home.py` — 抠图。`KEY_CFG` 按 key 策略；`glass_mask` 掏洞；支持 `python scripts/cut-art-home.py <key>` 单件重切。
- `scripts/gen-art-home.py` — 场景 + 天气生图。`win-*` 用 `NEG_WIN`。
- `scripts/preview-home-composite.py` — 离线合成预览（见下）。
- `src/ui/art/art.css` — `.art-win-hole::after` 玻璃感。

## 五、迭代与验证方法（不碰存档）

改框必须 `CROPS`（cut-art-home.py）与 `CUT_HOME`（skin.ts）双写一致；窗的几何只改 `windowPanes.json`。

```
# 重抠某几件
python scripts/cut-art-home.py cut-h-plan cut-h-notebook

# 离线合成验证（不碰存档）：9+ 种天气合成 + 品红底 matte 检查
python scripts/preview-home-composite.py
# 产物在 .preview/：scene-win-*.png（逐天气合成）、matte-cut-h-*.png（品红底查边）
```

浏览器验证：`npm run dev` 开 `http://localhost:5180/`（档案版）。局内场景靠存档自动加载，**只切视角看，不要点「选择地点」/`startRun`/休息/结束当天**——会覆盖玩家存档。光晕想验就用 CDP 给 `.art-cut` 加 `is-pulse` 类截图（纯 DOM，不动状态）。

## 六、不进 git

`.gitignore` 已补 `.preview/` 和 `__pycache__/`。API key（`D:\Dandan\LLMbox\...img-qwen-image.json`）、rembg 模型（`~/.rembg/models/`、`~/.u2net/`）都在仓库外，不要提交。

## 七、注意：灯走廊是按当前场景实测的

`glass_mask` 里的灯走廊（x 0.55–0.66、y<0.26）和 `windowPanes.json` 的坐标都绑死当前这张 `scene-home-desk.jpg`。若重画场景，两者都要重新实测。

## 八、一致性窗景系列：基准图 + ImageGen img2img 派生（2026-09-10 晚，已验证）

> 用户要求：观测点固定（公寓六楼），全部窗景图结构一致（楼群数量/位置绝不变，只变状态）；基准图衍生；灾后严禁繁荣车流；范围=核交火+公寓。**已取代第八节的 10 张旧系列**（现役 18 张：三段 × 天气）。

### 路线

**ImageGen（WorkBuddy 自带工具）为主**——实测其 img2img 结构保真极强（`input_fidelity=high` 时连阳台晾衣杆位置都逐位对应），且能做语义级修改（破坏、积雪压顶这类 PIL 无解的变化）。PIL 粒子叠层方案弃用（img2img 连雪花都直接生成）。

**衍生链（状态时序正确）**：BASE-A 灾前晴昏（t2i）→ BASE-B 灾变废土（A + 破坏指令）→ BASE-C 核冬大雪（**B** + 雪指令，雪落在废土上——不要从 A 直接派生，雪会落在完好城市上，时序就错了）。三基准在 `.preview/win-base/`（triptych.png 为审定图）。

### 18 板矩阵（`win-{stage}-{weather}.jpg`，1536×952，已裁水印条）

- **prep**（day1-7，池只有 4 态）：clear 暖黄昏晴 / overcast 灰云 / rain 雨丝 / fog 晨雾
- **early**（threat 1-3，城市立着但已死）：clear 死阳光 / overcast 铅灰 / rain 黑灰雨 / fog 灰雾残骸 / snow 初雪 / ashfall 落灰 / blackrain 病绿黑雨
- **winter**（threat 4-6 核冬）：同 7 态深冬版（厚雪压破损檐口、烟熏透雪、冰雾等）

### 前端三段化

- `skin.ts`：`export type WindowStage = 'prep'|'early'|'winter'`；`windowArt(weather, stage)` 三段映射（rain/storm/flooding→*Rain，snow/blizzard→*Snow，heatwave/clear→*Clear，fog→*Fog，blackRain/ashfall 显式，else→*Overcast）。
- `ArtGame.tsx`：`winStage = isPrep ? 'prep' : run.threat >= NUCLEAR_WINTER.THREAT_PHASE ? 'winter' : 'early'`（THREAT_PHASE=4），传 `windowArt(run.world.weather, winStage)`。

### 生成要点（复刻用）

- Prompt 结构：STYLE + VIEW（六楼俯视/地平线 2/5）+ SKELETON（「只能有」锁楼群：左米黄板楼带水箱/中两栋等高灰塔/右三层商铺排/底部横街带斑马线/右下落叶树）+ STATE_SLOT（本张状态）+ 排除段（无窗框…无人。无文字）。灾后槽位写死：窗全黑、烟熏痕、破损、无车无人。
- img2img 指令模板：「保持构图镜头视角和所有楼的位置数量完全不变：……（骨架复述）……不要新增或删除任何楼房，不要修复任何破损。把天气改成 X：……」+ `input_fidelity: "high"` + `size: "1536x1024"`。
- **水印**：ImageGen 右下角有「AI生成 WORKBUDDY」水印（约底部 7%）——落盘时 `crop((0,0,w,int(h*0.93)))` 裁掉；游戏内 cover 可见带本也不含它。
- 落盘映射与 18 板语义见 `.preview/win-base/`（生成原稿）与 `all18.png`（总目检）。

### 已知项

- 天气 id 无 'smog'（灾变浓雾=fog→win-{stage}-fog）；heatwave 仅作 clear 兜底语义（死阳光）。
- 积分成本：img2img ≈5-10/张，本系列 20 张（3 基准+15 派生+2 验证）累计约 150-300。
- 旧 10 张 win-*.jpg 已删（win-rainstorm/snow/ashfall/blackrain/heatwave/smog + 4 张旧 pre-* 被同名覆盖），git 历史可回退。

## 九、第二轮：窗几何重测 + 吊灯遮罩 + 天气图重生成（2026-09-10 晨，已验证）

> 用户报告：① 天气背景没铺满窗户；② 吊灯被遮罩裁掉一半。像素级测量定位如下，全部已修复。

### 根因（三方测量交叉验证）

1. **窗几何低估玻璃下缘**：玻璃真实下缘 y=0.542（行均值 r-b 蓝→暖过零），旧 window 盒底 0.46 / 下排 panes b=0.98（场景 0.4528）——**下沿 0.08H 玻璃段整个在抠图之外**，裸场景露出烤死的旧暮色横带（「天气没铺满」的真凶）。CSS 天气层（156% 板、三洞共板、cover）自洽且覆盖充分，不是病灶。
2. **吊灯被裁是双因**：① glass_mask 灯走廊（裁剪框 x 0.55-0.66 → 场景 0.520-0.564）相对灯罩（场景 x 0.4537-0.5517）**右偏 66px**，只罩住灯罩右 1/3，左 2/3 落在上排玻璃格内被当玻璃清掉；② 窗盒 top=0.10 切掉灯座吊线（y 0.0636-0.096）。

### 处理

- **`windowPanes.json` 重测重写**：window 盒 **[0.3, 0.055, 0.7, 0.555]**（上保灯座、下含玻璃底+窗台）；三块 panes 按旧值 y 重映射（上排 [0.275,0.117,0.709,0.315]、下左 [0.272,0.397,0.481,0.974]、下右 [0.524,0.388,0.738,0.974]——下排 b=0.974 精确落 0.542）；**新增 `lamp` 字段（场景分数 [0.445,0.055,0.565,0.19]）**，吊灯保留区进单一数据源。
- **`glass_mask` 改造**：灯保留区从「走廊 + r>150」改为「场景分数 bbox + 收紧阈值 r>170 & lum>110 & r-b>25」——bbox 外无任何暖色保留，暖色城景误保留的老风险几何性消灭；bbox 内加连通净化（只留灯主体，`art_common.keep_connected`），天色孤岛死掉。
- **重切**：`cut-h-window.png`（665×464）+ `cut-h-window-glass.png`。静态探针：暖亮灯像素 100% 不透明、吊线暗柱 100%、下排两扇掏空 100%、上排 67%（=灯罩轮廓+贴灯 1-3px 窄晕，灯罩列范围外仅 44px）、glass plate 与 alpha 逐位一致。verify-art-layout 全绿（window 加 EDGE_EXEMPT 四边豁免——整框物件贴满检测框是设计）。
- **6 张 1024² 天气图重生成 1664×928**：`gen-art-home.py` 六条旧 prompt 纯外景化（删「从居民楼窗玻璃里看出去」/弱否定，统一「镜头在室外高处平视…没有任何窗框、窗帘、窗台、玻璃或室内元素」）；main() 新增按名过滤（`python scripts/gen-art-home.py win-snow ...` 存在也强制覆盖）。旧方图 cover 后只露中间 ~50% 高度带的问题随之消失。逐张目检：overcast 阴天街景 / snow 核冬雪街（右下远处招牌半模糊伪文字，窗洞缩放下不可辨）/ ashfall 土黄落灰 / blackrain 病绿黑雨 / heatwave 死阳光干裂路（灾前语境有车流合理）/ smog 黄绿毒雾。全部无窗框、无室内元素、地平线中带。
- **`preview-home-composite.py`**：窗框始终读 windowPanes.json（不再依赖 cutouts.json 兜底）。
- **注意**：`WeatherId` 里**没有 'smog'**——灾变期浓雾天气 id 是 `fog`，走 windowArt 的 else 命中 `win-smog.jpg`（WEATHER_NAME 也无 smog 键）。手测切天气时别用 'smog'。

### 验证

品红 matte（灯完整、三格干净、无孤岛）+ 10 天气离线合成 + 浏览器 CDP 实测（`.preview/pwtest/weather-test.mjs`：prep 4 种 + day=8 灾变 6 种，截图 `.preview/browser/wx-*.png`，两两比对互异）——10 种天气洞内画面连续完整、直达玻璃下缘、吊灯完整。

### 换算公式（下次调窗几何用）

场景→框：`cx=(x-0.3)/0.4`，`cy=(y-0.055)/0.5`。玻璃下缘/灯 bbox 等关键实测值见 `windowPanes.json` 的 comment。
