---
name: art-ui-pipeline
description: 把游戏菜单/出身/选址/局内场景做成可点击场景：先按抠图需求用本机 qwen-image 生图，再用 rembg（birefnet 优先）抠透明 PNG 并自动收紧+提取多边形热区，最后按 artLayout.json 单一数据源叠回原位做轮廓光晕热点。在用户要做档案风 UI、生图、抠图、场景热点、art.html、diegetic 交互、cut-art、光晕跟轮廓走、轮廓截断、热区误触时使用。
---

# 档案风 UI：生图 → 抠图 → 交互

本技能固化《七日之前》开局三屏与局内场景的做法。后续任何「一张图里点物件」的界面都走同一条流水线，不要另起手描多边形或 CSS 大方块光晕。

参考实现：`seven-days/scripts/`、`seven-days/src/ui/art/`、`seven-days/public/art/`。

## 流水线（必须按序）

```
设计热点 → 为抠图写 prompt → 生图 → 定检测框 → rembg 抠图 + 后处理
→ alpha bbox 自动收紧 PNG → 提取多边形热区 → 写 artLayout.json → 叠回交互 → 四件套验证
```

- [ ] 这一屏几个可点物件、各自动作、要不要轮廓光晕
- [ ] 生图：物件左右分开、互不重叠、对比够、无文字；**主体受光均匀**（半张阴影会被阈值后处理咬掉）
- [ ] 分数坐标只维护一处：抠图脚本 `CROPS`（检测框），重跑后自动写入 `src/ui/art/artLayout.json`
- [ ] `cut-*.png` 自动收紧后叠回原位，光晕用 `drop-shadow`（走 PNG alpha）
- [ ] 热区 = 多边形（clipPath），不是配置框矩形；透明留白点不到
- [ ] 四件套验证全过：verify 断言 / 品红 matte / audit 审计图 / 浏览器悬停
- [ ] 不把 API key、rembg、模型 onnx 推进 git

未设计热点之前不要生图。生图时不把「以后再抠」当事后补丁——构图必须为抠图服务。

## 三种图，三种用法

| 种类 | 例子 | 抠不抠 | 交互 |
|------|------|--------|------|
| 氛围底图 | `menu-bg.jpg`、`setup-bg.jpg` | 不抠 | 只当背景，UI 用 CSS 叠字 |
| 场景整图 | `scene-room.jpg`、`scene-home-desk.jpg` | 从中裁切再抠 | `ArtSceneFrame` 底图 + `ArtCutout` 叠回 |
| 独立静物/模型 | `model-*.jpg`、`pack-*.jpg` | 整图抠 | `ArtFile` / `art-pin`，深色背景便于 matte |

需要「光晕贴着实物走」的，必须走场景抠图或整图抠图。不要在 JPG 矩形上画径向 fade。

## 生图（配合后续抠图）

### API（本机，key 不进仓库）

配置只从本机读，路径不要写进 git 以外的副本：

`D:\Dandan\LLMbox\LLM_Benchmark\backend\configs\model_configs\img-qwen-image.json`

脚本：`scripts/gen-art-ui.py`（氛围/职业/选址）、`scripts/gen-art-scenes.py`（可抠场景）、`scripts/gen-art-home.py`（局内场景+天气板）、`scripts/gen-art-diegetic.py`（静物+建筑模型）、`scripts/gen-art-setup-objs.py`（物资包/难度）。

- 已存在文件会跳过。要重做先删目标 jpg。
- 请求间隔用配置里的 `request_interval_seconds`，至少 1s。
- 场景用 `1664x928`（超宽 16:9）；静物/模型用 `1024x1024`。
- 保存 JPEG quality 86–88。不要把 b64 或 key 打进日志。
- 天气板（窗景）单独生成时，prompt 禁止「从窗玻璃里看出去」这类写法（它在邀请模型画框），NEG 追加窗框/窗帘/窗台（`NEG_WIN` 先例），尺寸对齐窗洞比例（约 2.1:1 用 1664x928，方图会被 cover 切掉近半）。

### Prompt 铁律（为抠图服务）

**场景里要抠的物件：**

- 写清数量和左右位置：「最左 / 中后 / 最右」「只能有一台」。
- **互不重叠、互不遮挡**，左右之间留空隙。重叠处 rembg 会粘成一块，光晕也会糊；确需前后遮挡时按「检测框可重叠、像素归属由 matte 决定」处理（见抠图章节），但能不重叠就不重叠。
- 桌面要抠的三件东西同样：左 / 中 / 右分开。
- 禁止「桌上再放书、杯子」这类添乱细节（见 `gen-art-scenes.py` 的 NEG）。
- 镜头：房间平视、桌面近俯视。景深清楚，不要虚化主体边缘。

**受光与材质（踩坑最多）：**

- **主体受光均匀**：一件物品半张亮半张深影，阈值类后处理（如按亮度清桌缝）会把阴影半张咬成锯齿。prompt 里让主光源（吊灯/壁灯）罩住整个物件。
- 暗家具贴暗墙/暗地面时，模型会把桌腿和地面当成一块。prompt 里加侧光、吊灯打亮桌面、或让地面比家具亮一档。
- **避免把玻璃、半透明、高反光物当主体**（rembg 会当背景透掉）；细长悬空件（收音机天线、挂杆）要么避免，要么在 prompt 里强调完整并配 `keep_connected`。
- 白纸/摊开本在暗桌上对比高，好抠；若模型只留下钢笔，用 Otsu 与 rembg 做 alpha 并集（`cut-journal` 先例）。

**独立静物 / 建筑模型：**

- 深灰黑背景，四周留暗边，物件完整可见，约占画面 60%。
- 不要纯白棚拍（NEG 里禁止白色背景）。
- 建筑：等距约 45°、同一比例、博物馆射灯、深灰桌面。

**全局风格（本游戏）：**

- 中国城市民防档案、深灰蓝 + 琥珀 `#e0a112`、胶片颗粒、纪录片。
- 不要卡通、赛博霓虹、人脸、任何文字/字母/数字/水印。字全由 CSS 叠。

视觉方向细节见 [style.md](style.md)。

## 抠图（重点模块）

### 工具与模型（本机装，不进 git）

不要用手描多边形或 OpenCV GrabCut——轮廓对不齐，光晕会变成大方块。

```text
python -m pip install rembg onnxruntime scipy numpy scikit-image
```

必须用 `python -m pip`，否则可能装到另一个解释器。本机可能装了多个 python，先确认哪个有依赖：`py -0p` 逐个 `python -c "import rembg"`。模型文件在用户目录：

`C:\Users\Administrator\.u2net\`、`C:\Users\Administrator\.rembg\`（birefnet 约 1GB）

GitHub 直下常超时；可用镜像（如 `ghfast.top`）下到该路径。rembg 会 `resolve_existing` 找到它，不必每次再下。

**不要提交：** rembg、onnxruntime、模型 onnx。仓库只留抠图脚本和产出的 `public/art/cut-*.png`、`src/ui/art/artLayout.json`。

**模型优先级（必须用链，不要 u2net-only）：**

```text
birefnet-general → birefnet-general-lite → isnet-general-use → u2net
```

- birefnet 对暗场景、复杂结构（整架货物、开放书页、阴影中的纸）明显更准；u2net 是最后兜底。
- **birefnet 对裁剪框平移极度敏感**：同一物品框移 10px，matte 可能从「完整整架」崩成「只剩碎片」。所以：改框后必须重看 matte；给关键物品配 `min_cover` 兜底（cover 低于阈值自动回退 u2net 再比覆盖）。
- rembg 结果跨进程并非稳定可复现（同输入偶有不同 matte），**不要假设上次的好结果还在**——PNG 一旦被坏 matte 覆盖就要重跑，好结果靠 verify 断言守住。

### 两个框，不要混（截断问题的根源）

- **检测框（CROPS）**：人工分数框 `(left, top, right, bottom)`，只需罩住物品+少量余量。**允许互相重叠**——物品物理遮挡时（桌子前面挡货架）框必然重叠，靠各自 matte 决定像素归属：前景物体的轮廓覆盖重叠带，背景物体的 matte 天然被「咬掉一口」，点击永远落在看得见的那个上（DOM 顺序兜底：后声明者在上）。
- **摆放框（artLayout.json 的 box）**：脚本在 matte 完成后按 **alpha bbox + 4px 涂边自动收紧**得出，写入 JSON，前端直接用。**手工维护的只有检测框**；「框切进物品」= PNG 内容贴死画布缘 = 轮廓截断。

自检口诀：**抠图 PNG 的不透明内容不许贴画布缘**（场景真边界除外，如床架出画左缘、贴墙物品）——脚本会自动报 `TRUNCATION-SUSPECT`，豁免清单在 `art_common.EDGE_EXEMPT`（≤3px 且放宽会引进更糟内容时才豁免，写明原因）。

### 标准步骤

参考实现：`scripts/cut-art-home.py`（局内 10 件）、`scripts/cut-art-objects.py`（菜单 6 件+模型）、共享库 `scripts/art_common.py`。

1. **审计**：`python scripts/audit-crops.py home|objects` —— 看 `.preview/audit/` 的总览网格图（红框=检测框、绿框=实际内容框、5% 网格+分数刻度）与 alpha 探针报告，量出物品真实边界。手工量边界用 1% 网格放大条带最准（eye-ball 误差常到 ±2%）。
2. **改 CROPS**（只改这一处坐标），按需配 `KEY_CFG` 后处理（见下表）。
3. **单件重切**：`python scripts/cut-art-home.py <key...>` / `cut-art-objects.py --force --props [key...]`。脚本自动：rembg → 后处理 → 收紧 PNG → 提取多边形 → 合并写 `src/ui/art/artLayout.json`（保留其他 key，单件重跑不覆写兄弟条目）。
4. **四件套验证**（见验证章节）。

原则不变：**RGB 来自场景裁切像素，alpha 来自 rembg**。叠回原位时颜色与底图一致，只有轮廓变透明。

### 后处理钩子速查（KEY_CFG）

| 钩子 | 作用 | 用例 |
|------|------|------|
| `otsu` / `otsu_if_low` | Otsu 亮度 matte 与 rembg 取并集 | 摊开日记本只留钢笔 |
| `lower` / `lower_boost` | 下半张提亮后单独再抠，paste 回去 | 暗桌腿、暗货架 |
| `connected` | 只保留与主连通体相连的成分 | 清桌缝残片、辉光孤岛 |
| `sweep` | 弱化版清理：保留分离色块，只清灰尘 | **多部件物品**（印章手柄+墨池）、货架各层 |
| `border_fringe` | 只删「暗 ∧ 保留 ∧ 连通到框缘」，内部阴影永不受累 | 桌缝/墙影/亮阴影；`fringe_lum` 提阈值清亮阴影，`fringe_sides` 保护承载真内容的边 |
| `carve: [l,t,r,b]` | 按场景分数矩形清零 alpha | 清掉误入 matte 的**前景**物件（货架 matte 里的桌角） |
| `top_band: frac` | 清掉检测框顶部的固定背景骑带 | 计划纸上方的椅背 |
| `min_cover` | cover 低于阈值回退 u2net | birefnet 塌缩兜底 |
| `pinholes` | 闭合 matte 小孔 | 门/药箱 |

**勾子红线：**
- **不要用全局亮度阈值当主抠图**（旧 `drop_wood_fringe` 的 `lum>108` keep 把阴影中的半张蓝图咬成锯齿）。阈值只配 border_fringe 这类「连通到框缘才删」的形态。
- **大面积暗色骨架物品禁用 border_fringe**：暗色连通分量跨全物品时，一条贴边的柱子会连坐清零整个 matte（实录：货架 cover 0.71→0.02）。
- 细长件（天线）依赖 `connected` 的 3px 膨胀接续，重抠后务必目检天线还在。

### 多边形热区（poly）

- 从收紧后的 alpha 提轮廓：skimage `find_contours` → RDP 抽稀（≤48 点/环）→ **先外扩 2px**（clip 永不比可见轮廓更紧，光晕不被咬）→ 归一化到 PNG 画布 [0,1]。
- **返回环的数组**：多部件物品（印章手柄+墨池、被遮挡成碎块的物件）每个 ≥5% 面积的环都保留，clipPath 并集——单轮廓会让小色块点不到。提取失败兜底 poly=null（回退矩形命中）并在 verify 里告警。
- 前端 `ArtCutout` 收 `poly` prop：`<clipPath clipPathUnits="objectBoundingBox">` 加在 `<image>` 上（**不是**加在 svg 上——svg 的 drop-shadow 要按裁剪后轮廓发光）；poly 存在时 button 加 `.is-clipped`，CSS 关掉 svg 盒的 pointer-events，命中只剩被裁剪的 image 本体。透明留白从此点不到、hover 也不亮。

### 特例（已踩过）

- 摊开日记本：rembg 当「填满画面」只留钢笔 → 与 Otsu 亮度 matte 取并集（钢笔会变镂空，点击钢笔不触发账本，影响极小可接受）。
- 暗桌腿：对画面下半再抠一次，paste 回全图 alpha。
- 售货机已经贴合就不要重抠（`skip_if_exists` + `--force` 才重抠）。注意跳过守卫会导致该 key 缺 layout 条目——重跑时记得 `--force` 补齐。
- 独立模型是整图抠（`cut_full`），layout 条目 box=[0,0,1,1]、poly=null，EDGE_EXEMPT 四边豁免。

## 坐标：单一数据源（不要再双写）

**`src/ui/art/artLayout.json` 是唯一摆放数据源**，由抠图脚本自动写入（box/px/poly/hud/cover/model）；`skin.ts` 从它派生 `CUT` / `CUT_HOME` / `HOME_POLY` / `MENU_POLY` / `HUD_BOX`；preview 与 verify 脚本也读它。

旧模式（CROPS 与 skin.ts `CUT` 手工双写）已废除——三处手写必然漂移（实录：cutouts.json 与磁盘 PNG 脱节导致预览错位）。改框只改 py 的 CROPS，重跑脚本即可，前端零改动。

**HUD 锚点**：若 UI 里有元素复用物品框定位（局内的天数/AP 点、建造角标），收紧框会让它们位移。layout 条目的 `hud` 字段保存旧松框，`HUD_BOX` 供这些 UI 使用——位置与改动前逐像素一致。新增物品时想想有没有别的东西在「借用」它的框。

## 交互叠图

入口：`index.html` / `art.html` 的 `<body data-skin="art">` → `isArtSkin()`。经典界面在 `classic.html`。`App.tsx` 仅 `menu` / `setup` / `siteSelect` 走试验版；局内走 `ArtGame`（存档驱动）。

组件（已有就复用，不要新造一套）：

- `ArtSceneFrame`：场景 jpg 当底，`.art-frame-box` 按 1664/928 比例缩放，物品全部用分数坐标挂里面。
- `ArtCutout`：扣图叠回。button `pointer-events: none`；poly 存在时加 `.is-clipped` 关掉 svg 盒命中，**命中面 = clipPath 裁剪后的 image 区域**（注意：SVG `<image visiblePainted>` 命中的是整个图像矩形、不看 alpha 透明度——旧描述「点的是不透明像素」是错的，透明区照样命中，必须靠 clipPath 收紧）。
- `ArtFile`：独立静物（出身页档案/包裹）。
- `art-pin`：地图上的建筑 PNG。

光晕：`filter: drop-shadow(...)` 打在 PNG/SVG 上，**不要** `box-shadow` 或椭圆径向遮罩。clipPath 加在 image 上时 drop-shadow 自动沿裁剪后轮廓走，is-pulse/is-off 变体也自动生效。

未解锁 / 开发中：`opacity: 1` + `grayscale`，不要半透明 fade，也不要空闲椭圆光晕。

悬停提示用 `.art-spot-tip`（锚在配置框上缘居中——框收紧后 tooltip 反而更贴物品中心），不要把说明文字画进图里。

**同屏物品重叠时的点击归属**：按 DOM 顺序（后声明者在上）。把「视觉上在前」的物品放前面声明，让后景物品在重叠带让位；重叠带通常就是前景像素，归属自然正确。

浏览器自动化要点：SVG 或对 button 调 `.click()`；**点在多边形外/透明处不触发是预期行为**（这正是验证项）。

## 验证（四件套，必做）

1. **断言**：`python scripts/verify-art-layout.py` —— box/px 一致、alpha 不贴画布缘（豁免表除外）、poly 点数与坐标合法、HUD 锚点在位、同场景框重叠 report-only。必须全绿。
2. **matte 目检**：`python scripts/preview-home-composite.py matte [key...]` —— 品红底 + 红色 poly 描边，脏边/孤岛/截断/clip 过紧一眼可见。
3. **审计图**：`python scripts/audit-crops.py` —— 改框前量边界用（总览网格 + 2x 放大 + TRUNCATION-SUSPECT 探针）。
4. **浏览器悬停**：`npm run dev` 后开档案版，逐件悬停看三点：光晕是否贴轮廓、tooltip 是否弹出、**点/悬停透明留白区必须无反应**。现成 CDP 测试脚本 `.preview/pwtest/cdp-test.mjs`（Edge headless 零依赖，可整条流程回归：菜单→开局→局内两视角→逐件悬停+透明区负样本）。

存档安全（手测时）：开 `http://localhost:5180/`（端口被占会顺延，看启动输出）。**不要**为了截图去点「选择地点」/调用 `startRun`：会新建 run，覆盖玩家存档（曾有第 11 天档）。测完用「返回」，不要结束或开新局。局内只切视角；**床（休息/结束当天）与印章（弃局确认）绝不点**。CDP 脚本只做悬停 + 安全点击（打开 overlay 类）。

## 禁止事项

- 手描多边形 / GrabCut 当主抠图方案。
- 用全局亮度阈值清背景当主手段（会咬物品内部阴影）；暗骨架物品开 border_fringe。
- 假设「只改了检测框，matte 不变」——birefnet 对框平移敏感，改框必看 matte。
- 把 key、`.u2net`、venv、`node_modules`、`dist_bak/` 推进 git。
- 在生图 prompt 里写界面文案（标题、按钮字）。
- 让热点矩形比物件大一圈还用矩形光晕「将就」；热区收紧允许框重叠，但不要让矩形当命中面。
- 同一屏堆太多可点物导致重叠；先减数量或换镜头。
- build 前 `mv dist dist_bak`（genie-trash 清 dist 的环境坑，报错≠代码错）。

## 本仓库文件地图

- 生图：`scripts/gen-art-*.py`（天气板用 `NEG_WIN`）
- 抠图：`scripts/cut-art-home.py`（局内）、`scripts/cut-art-objects.py`（菜单）、`scripts/art_common.py`（共享库：tighten/extract_polygon/drop_border_fringe/keep_connected/sweep_dust/EDGE_EXEMPT/layout 读写）
- 审计/校验：`scripts/audit-crops.py`、`scripts/verify-art-layout.py`、`scripts/preview-home-composite.py`
- 摆放数据：`src/ui/art/artLayout.json`（生成物，勿手改）、`src/ui/art/windowPanes.json`（窗几何）、`src/ui/art/skin.ts`（派生）
- 组件：`src/ui/art/ArtHotspot.tsx`、`ArtGame.tsx`、`ArtMainMenu.tsx`、`ArtSetup.tsx`、`ArtSiteSelect.tsx`
- 样式：`src/ui/art/art.css`（`.art-cut`、`.is-clipped`、`.art-spot-tip`）
- 产出：`public/art/*.jpg`、`public/art/cut-*.png`、`public/art/cut-h-*.png`
- 交接文档：`HANDOVER-窗景与抠边.md`、`HANDOVER-热区与抠图.md`
