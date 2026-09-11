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

### 首选：WorkBuddy ImageGen（一致性靠 img2img，不靠 prompt）

素材只要有「已经存在的同类实物」当基准，就走 **ImageGen 的图生图**，而不是本机 API：`image1` 传基准图（如墙上的 `cut-h-blueprint.png`）、`input_fidelity: "high"`、`size` 按用途（广幅 1536x1024）。实测结构/材质保真极强（连阳台晾衣杆位置都逐位对应），材质一致性比写一百个 prompt 词都准。

- 用途：同一实物的新视角/新状态（窗景 18 板、纸面纹理、阶段化纸面）。
- 纯凭空新建、没有基准可锁的，才走下面的本机 API。
- 成图右下角有「AI生成 WORKBUDDY」水印（约底部 7%），落盘前裁掉；`scripts/make-shelter-paper.py` 是「量折痕 + 对称裁切 + 落盘」的现成例子。
- **对称裁切**能让基准图里的几何特征（如纸张十字折痕）留在 50%，CSS 侧才能用 `background-position: center` 直接对齐——不对称裁会让 CSS 画的线与烤进图里的线错开成双线。

### 备选：本机 API（批量、可复现 seed）

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

入口：`index.html` / `art.html` 的 `<body data-skin="art">` → `isArtSkin()`。经典界面在 `classic.html`。`App.tsx` 仅 `menu` / `setup` / `siteSelect` 走试验版；局内走 `ArtGame`（存档驱动）。**局内浮层按皮肤分流**：`overlay==='shelter'` 在 `art && gameUi==='art'` 时走 `ArtShelterPanel`（图纸版），否则走经典 `ShelterPanel`——改一个界面不要牵动另一个。

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

## 局内浮层的 diegetic 化（把弹窗做成场景里的实物）

场景热点打开的功能面板**不要**直接落回通用 `Modal`——点的是墙上的图纸、弹出来的却是控制台面板，沉浸感就断在这一次跳转上。判据是一条：**进入方式与呈现必须互相解释**。

现成例子：避难所工程 = 左墙图纸热点 → 整屏就是那张摊开的工程图纸（`src/ui/art/ArtShelterPanel.tsx`，2026-09-10）。

做法要点：

1. **背景 = 实物材质**：整屏铺一张用 img2img 从「那个热点物件」衍生出来的材质图（`ART.shelterPaper`），外面一层房间图 `blur(22px) brightness(.33)` 虚焦当景深。
2. **文字与线条仍归 CSS**：材质图只负责纸/布/铁的肌理，边框、角标、表格线、图签、所有文字全用 CSS 画——文字能选中、能跟文案表走、能换皮。**别把图签画进图里**。
3. **语义色换到实物上**：深色 UI 的琥珀/告警在米白纸上没对比度。纸上改用墨色系——暗墨蓝正文、朱红批注（进行中/危险）、墨绿（可用）、赭石（警示），定义成 `--sh-*` 挂在最外层 veil 上。
4. **进/出场从热点位置飞入**：`transform-origin` 指向该物件在场景里的位置，起手 `translate3d(-30vw,-14vh,0) scale(.24) rotate(-3deg) + blur(4px)`，收到 `none`，约 470ms。关闭做 240ms 反向（要延迟 `setOverlay(null)`，本地 `closing` state + `setTimeout`）。
5. **功能一条不丢**：老面板的每个字段/按钮都要能在新布局里找到落点（列成对照表自查）。重构布局可以，删功能不行；新增的只允许是**只读**装帧信息（代号、日期、AP、状态章）。
6. **`var(--art-serif)` 不继承**：浮层挂在 `.art-root` **外面**（`App.tsx` 与 body 平级渲染），要用 serif 得在 veil 上重新定义一次；`--font-mono` 来自 Tailwind `@theme`，全局可用。

## 一个项目里做多个 diegetic 面板

做完第一个（图纸）之后再做第二、第三个（笔记本、计划表）时，这六条是硬约束：

1. **先查"这个面板的正文是不是公共组件"**。本项目里 `ArtPlanPanel` 只是壳，正文来自 `RationPanel`/`HeatThermometer`（同时内嵌在经典皮肤的三栏布局）与 `PowerPanel`（同时挂在经典供电浮层）——**改本体就会连带改另一个皮肤**。正确做法：新建专属子组件，只复制引擎数学与 store 动作，DOM 与配色全新。动任何"看起来是面板私有"的组件前，先 grep 它在别处的引用。
2. **多张纸不能撞车**：同一项目里第二张纸必须换一套纸。靠六项叠加区分——横长比 / 纸温（冷调 vs 暖调）/ 线条方向（横格 vs 竖栏）/ 有没有装订（中缝针脚）/ 有没有束线表格 / 书写工具（楷体手写 vs 宋体制图笔 + 图章）。最忌"米白泛黄 + 深墨"再来一张。
3. **格线与列线一律归 CSS，不要烤进贴图**。条目高度会随展开变化、列宽由栅格决定，烤进图的线必然与内容错位。做法：每条目自带一条底线（永远对齐）、竖栏线用 `:not(:last-child) { border-right }`、页面贴图只出**完全空白的纸**。这条比"让贴图带格线更像纸"重要得多。
4. **表单类面板的滑杆做成"纸上刻度尺 + 游标"**：刻度用 `repeating-linear-gradient` 画在轨道底边，**游标就是重皮后的原生 thumb**（`::-webkit-slider-thumb` / `::-moz-range-thumb`）。不要另做一个 `left: var(--fill)` 的独立游标元素——原生 thumb 两端有半个 thumb 宽的内缩，独立游标必然与真值错位。
5. **会写 store 的控件要保住 draft/commit 四环**：`onChange` 只写本地草稿 → `onPointerUp/onKeyUp/onBlur` 才提交一次 → 受控值变化的 `useEffect` 清草稿回读真值 → 显示值用 `draft ?? min(want, max)`。改成 `onChange` 直接提交就退回"每一步进都 clone 整棵树"的卡顿源。用无头浏览器做哨兵断言守住它（`input` 事件后持久化内容不变、`pointerup` 后才变）。
6. **详情用"点击内联推挤"，别用 hover 浮层**。纸面上弹深色浮层正是要消灭的控制台感，而且浮层里的东西悬不稳、触屏直接失效。内联展开还有个附带好处：列表高度真的会变，可以用"展开后容器变高"当断言。
7. **纸上的分级用"手写批注"而不是色块徽章**：红笔划定 = 两条略斜的 `linear-gradient` 叠成手绘下划线；马克笔 = 半透明色 + 微旋转 `skew` + `mix-blend-mode: multiply` 扫过标题带。注意**亮纸上橙色作文字色只有 ~2.2:1**，只能做底纹（文字仍用近黑墨），另需一个深赭色专供"预警"字样。
8. 只在点「关闭」时走收回动画；App 层的 Esc 是直接关的（本项目两处面板都这样，属既有行为，不要在面板里再加第二个 keydown）。
9. **同一个实物可以有多个状态**：本子既是「事件书本」也是「今日待办」。纸面（纸 + 装订 + 污损）要抽成共用组件（本项目 `NotebookSheet.tsx`），否则两处会长得不像同一本。翻页类界面**不要让组件自己维护页码**——本项目 `run.queue` 就是页，作答后队列被 filter 掉，`queue[0]` 自然变成下一页，"还剩几件"直接读长度（注意作答可能触发钩子**再塞进新事件**，所以别缓存）。
10. **别把公共反馈弹窗整个换掉，加皮肤判断**：档案皮肤下把结算写进书页，是在 `App.tsx` 写 `{!(art && gameUi === 'art') && <ChoiceResultModal />}`，经典皮肤照旧。同时要处理一个边界——答完**最后一件**时队列已空但结算还在，该层不能因为"队列空了"就卸载，否则那一瞬结果再也看不到。
11. **同类实物之间的切换，别用"卸载 A + 挂载 B"**。本项目"事件翻完 → 今日待办"是同一个本子的两种内容：若卸载书本再挂待办面板，待办会重播入场动画（本子又飞进来一次），像穿帮。正确做法是把正文抽成共用组件（`TodoSpread`），**就地换内容**，再给载体加一个"落定"动画（从中缝侧 `rotateY` + 淡入）。配套：父组件的渲染条件要放宽成"打开着就渲染"，由内部决定显示哪一页。
12. **别用图例解释记号**。第一版在待办页头写了「红笔划的 · 要命 / 马克笔 · 预警」，被用户直斥"太蠢"。手写笔迹本身就是语言，加说明反而像说明书。

### 图挂了要能查

美术面板最容易遇到"整块图不见了"，而**静默隐藏破图**会让你完全无从下手（浏览器默认的破图标被藏掉，只剩一个空框）。做法：`onError` 里除了 `visibility:hidden`，**在开发模式下把失败的 URL 打到控制台**。排查顺序：素材文件在不在 → **唯一在跑的那个服务**能不能取到（`curl … | wc -c`）→ 浏览器是不是停在旧标签或缓存了旧的 404（Ctrl+Shift+R）。

两个坑：Git Bash 下 `curl -o /dev/null` 会因写错误报 **0 字节**，那是假象，要改成管道 `| wc -c` 才准；本机常同时跑着多个工程的服务，**先扫一遍所有监听端口、按 `<title>` 认领**（本项目就撞上过 `:5174` 是另一个工程、`/art/*` 一律回退成它的 index.html），比盯着自己代码查快得多。

### 叠加式素材层（污损 / 血迹 / 划痕这类）

需要"按数值动态变化的污损"时，走这条路最省事：**素材生成成"白底 + 深色损伤"，全部用 `mix-blend-mode: multiply`**（白 = 不变、深色 = 压暗）。好处：纸的肌理仍透得出来、**完全不需要抠透明**、多层可直接叠。

四个坑，一个都不能踩：

1. **父层绝对不能带 `z-index`**。定位元素一旦有 z-index 就形成 stacking context = 隔离组，里面的 `mix-blend-mode` 只能跟"空背景"混合，于是白底部分**直接盖在文字上把内容糊掉**（诊断特征：字全没了但纸还在，特别容易误判成"层级太低"）。正确写法：父层只留 `position/inset/pointer-events`，`z-index` 写在每个素材层自己身上。
2. **白点必须归一**。不归一的话背景那点灰会在 multiply 下把整页蒙一层灰纱（乘算 0.95 = 全页 -5% 亮度，很显眼）。取 85 分位当白、高出的裁成纯白（裁白无害，还能让淡损伤拉出对比）。
3. **透明度是可读性闸门**。这种层是铺满整页的，压太狠会把文字一起吃掉。要求"遮挡**部分**信息"时，实测重档 0.82 完全不可读，降到 ~0.5 才既有明显损伤又留得住正文。
4. **按"压暗面积"反求曲线参数，不要拍固定值**。模型画的"损伤"往往是铺满整幅的灰场，直接乘上去整页变灰球；要把中间调推向白、只留最深的（`a' = 1-(1-a)^k`），而同一个 k 对"细线型"（皱褶、涂鸦）和"整片型"（血渍）效果差极远——固定 k 会把轻档洗到看不见、又让重档比中档还淡。做法：定目标压暗面积（轻档 10%、重档 25%、血渍 6/15/24%），在该面积上二分求 k。这样每档的视觉分量是**可测的**。

**变体选择要稳定**：同档多张素材按 `seed + day` 取模，同一天内不换（否则每次重渲染换一张会闪），跳天才换。

## 同一实物的分级配图（1→2→3 递进）

游戏里很多实体是**分级的**（避难所 10 个家电各 3 级）。别给每级单独文生图——三级会长成三件不同的东西。做法：

1. **1 级文生图**，但想清楚"1 级是什么"。**别默认画废墟**：故事里玩家还在现代文明社会的公寓里，1 级就该是**崭新的现代家用成品**（干净的防盗门、新净水器、新毛毯）。末日感随等级递增：2 级自建加固（管路、支架、焊痕、沙袋），3 级军用级末世装备（气密门斗、反渗透、柴发、NBC 机组）。
2. **2/3 级用上一级的图做 img2img**（`input_fidelity: "high"`），prompt 固定写「保持同一件东西、同一机位与光线不变，只做升级改造：<本级增量>」+「背景是一面无杂物的暗色墙面」「画面中只有这一件东西」。
3. 每级增量直接取内容里该级的 `level.desc` 意象，别自己编。
4. 背景写「无杂物暗墙」而不是"公寓室内"：反正要抠图，简单背景的 matte 干净得多，也压得住链式漂移。
5. **每级必须目检"还是同一件东西"**。链式会漂——实测模型会把"毛毯"一路画成"床"，导致 1、2 级区分不出来，那时只能砍掉整条链从 1 级重生。

### 批量抠图落盘（`scripts/gen-art-modules.py` 是现成实现）

- **模型链 + 提亮回退**：`isnet-general-use` / `u2net` 两个模型各跑 `brighten 1.0 / 1.9 / 3.4`，共 6 个候选，按「覆盖度落在合理区间 → 不是碎块 → 碎块少 → 覆盖度接近 0.22」择优。**提亮后重跑**是治「暗主体贴暗背景」的通用招（u2net 对黑窗帘只剩 1% 覆盖度，提亮后才认出来）；alpha 与尺寸无关，仍贴回原图。
- **剪边缘杂件**：rembg 会把碰巧挨着的台灯、包装袋、地毯一起留下。只保留"包围盒中心落在中央 70%~72% 内"的连通块，豁免 ≥ 最大块 45% 的大块（防宽主体被切），再清 < 0.5% 碎屑。
- **落 512² 就够**：缩略图 88px、详情小图 40px，512 有 5x 余量；1024 版 30 张 25MB 太重（512 后 7.5MB）。
- **不要用 ImageGen 的 `background: "transparent"`**：它不产出 alpha，而是把"透明棋盘格"画成像素。抠图只能走 rembg。
- 模型下载：`C:\Users\Administrator\.u2net\`（u2net 176MB / isnet 179MB）。GitHub 直下会卡死，走 `ghfast.top` 镜像 + `curl -C -` 断点续传循环，下完核对 `content-length`。**不要提交**。

### ImageGen 调用铁律

- **不要并行调用**：`output_dir` 会互相串（5 张全落进同一个目录，同秒重名还会互相覆盖）。**逐张调用**，每张用独立的 `output_dir`（如 `.preview/gen/mod-<id>-<lv>/`），且**每个目录只放一张**——落盘脚本按目录取图就不需要改名。
- 成图右下有「AI生成 WORKBUDDY」水印，裁掉再落盘。
- **让它"调暗/去背景"这类像素级要求别指望 prompt**：实测 img2img 保真太强，"调暗"指令反而出图更亮。像素级目标（亮度定标、裁切、抠图）一律放到后处理脚本里算准。

## 验证（四件套，必做）

1. **断言**：`python scripts/verify-art-layout.py` —— box/px 一致、alpha 不贴画布缘（豁免表除外）、poly 点数与坐标合法、HUD 锚点在位、同场景框重叠 report-only。必须全绿。
2. **matte 目检**：`python scripts/preview-home-composite.py matte [key...]` —— 品红底 + 红色 poly 描边，脏边/孤岛/截断/clip 过紧一眼可见。
3. **审计图**：`python scripts/audit-crops.py` —— 改框前量边界用（总览网格 + 2x 放大 + TRUNCATION-SUSPECT 探针）。
4. **浏览器悬停 / 走完整流程**：`npm run dev` 后开档案版，逐件悬停看三点：光晕是否贴轮廓、tooltip 是否弹出、**点/悬停透明留白区必须无反应**。现成 **零依赖 CDP 脚本**（Node 22 自带全局 `WebSocket`，不用装 playwright）在 `.preview/pwtest/`：`shelter-shot.mjs`（开局→点热点→展开→滚到底→关闭 + 截图）、`shelter-states.mjs`（构造在建项目/崩溃日后等状态）、`todo-plan-shot.mjs`（待办/计划两面板 + 滑杆 draft-commit 哨兵）、`event-book-shot.mjs`（事件书本翻页全流程 + 污损分档）、`stage-showcase.mjs`（把各数值档位逐档截图，用来给用户看"分阶段的实际观感"，可改 CASES 表复用）、`probe.mjs`（页面渲染冒烟，可指 `classic.html` 查经典界面没被带偏）。五个环境坑记牢：
   - Chrome 必须加 `--no-proxy-server --proxy-bypass-list=*`——本机 `http_proxy` 有值，不加连 127.0.0.1 都拒；
   - `curl` 自检也要 `--noproxy '*'`（否则走代理拿到 502，误判服务没起）；
   - vite 默认只绑 `[::1]`，要 127.0.0.1 就 `--host 127.0.0.1`（端口被占会顺延，看启动输出）；
   - profile 目录**别 `fs.rmSync`**（本机 shim 成 trash，二手目录被锁会抛 `Some operations were aborted`）——用带时间戳的唯一目录名，顺带天然隔离玩家存档；
   - 外部改档（写 localStorage 造状态）前先 `sleep(1300)`：**store 的 persist 是节流的**，刚做过的交互可能还有一笔待写回，不等它落盘就改档会被它覆盖（实测第二次改档被吃掉，白查半天）。

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

- 生图：**优先 WorkBuddy ImageGen**（本机 `scripts/gen-art-*.py` 依赖的 `img-qwen-image.json` 已不存在，跑不了；要复活那套本机 API 得先补回配置）
- 后处理/落盘：`scripts/make-shelter-paper.py`（图纸纸面）、`scripts/make-art-paper.py <todo|plan>`（笔记本内页 / 计划表纸，两种参数一张表）、`scripts/make-notebook-wear.py`（污损层：裁水印 + 白点归一 + 按压暗面积反求稀疏指数）、`scripts/gen-art-modules.py`（批量抠图落盘）、`scripts/rename-modules.py`（模块改名的显式短语映射）
- 抠图：`scripts/cut-art-home.py`（局内）、`scripts/cut-art-objects.py`（菜单）、`scripts/art_common.py`（共享库：tighten/extract_polygon/drop_border_fringe/keep_connected/sweep_dust/EDGE_EXEMPT/layout 读写）
- 审计/校验：`scripts/audit-crops.py`、`scripts/verify-art-layout.py`、`scripts/preview-home-composite.py`
- 摆放数据：`src/ui/art/artLayout.json`（生成物，勿手改）、`src/ui/art/windowPanes.json`（窗几何）、`src/ui/art/skin.ts`（派生 + `ART` 资源表）
- 组件：`src/ui/art/ArtHotspot.tsx`、`ArtGame.tsx`、`ArtMainMenu.tsx`、`ArtSetup.tsx`、`ArtSiteSelect.tsx`、`ArtShelterPanel.tsx`、`ArtTodoPanel.tsx`、`ArtEventBook.tsx`、`NotebookSheet.tsx`（共用纸面）、`NotebookWear.tsx`（动态污损）、`ArtPlanPanel.tsx` + `ArtPlanSheet.tsx`（diegetic 图示范例：图纸／笔记本／计划表）
- 样式：`src/ui/art/art.css`（`.art-cut`、`.is-clipped`、`.art-spot-tip`、`.art-shelter-*`）
- 浏览器实测：`.preview/pwtest/*.mjs`（零依赖 CDP）
- 产出：`public/art/*.jpg`、`public/art/cut-*.png`、`public/art/cut-h-*.png`
- 交接文档：`HANDOVER-窗景与抠边.md`、`HANDOVER-热区与抠图.md`、`HANDOVER-避难所图纸面板.md`

## 线稿类素材：抠图 + 「背后垫色块」表示比例

做「温度计液柱 / 罐头余量 / 发电效率」这种**用色块占比表达数值**的图时，配方是固定的：

1. **生图只出「纯白底 + 深灰蓝细线 + 形状内部完全留白」**。内部留白是硬要求（prompt 里明写"内部完全留白、不填任何颜色"），后面全靠它透色。
2. **抠图不走 rembg**，用 `alpha = clamp((白点 − 亮度) / span)`：白底→全透明、深线→不透明。rembg 会把线稿内部当背景透掉、把线条切成碎块。
3. **必须再产一张填充掩膜**：`binary_dilation(2)` → `binary_fill_holes` → `binary_erosion(2)`。
   - **用 `fill_holes`、不要用形态学闭运算**：闭运算会把金字塔里相邻罐头的缝桥接起来，填充色就漏进罐与罐之间的空隙了。
   - 掩膜的作用是把填充色**裁进形状内部**——不裁的话，白底让轮廓之外也透明，颜色会从形状外面渗出来糊成一片。
4. **层序**：填充层在下 → 线稿在上；父层**不带 z-index**（隔离组坑，见上）。
   填充高度用**百分比**（相对素材盒），与像素坐标无关，天然对齐；掩膜用 `mask-size: 100% 100%`（用 `contain` 会 letterbox 错位）。
5. **裁掉透明边距**：按掩膜 bbox 裁一圈，素材更紧凑，液柱/形状在面板里就能放得更大更清楚。
6. **bbox 由脚本量出来当唯一坐标真源**（写进 `linefigLayout.json`），填充、标尺、指针全由它换算，禁止手填百分比。
   两个形状被一条线缆连成一个连通域时（如"发电机—电缆—蓄电池"），**不能按连通域分左右**，改用**列密度**在中间找最窄处当分割线。

### 两个必踩的坑

- **`np.round(x/10)*10` 会 uint8 溢出**：`round(255/10)*10 = 260 → 溢出成 4`。症状是"填充区明明是 255 却像完全没填充"，极难查。量化 alpha 一律 `np.clip(..., 0, 255)`。
- **生成图的"白底"是带颗粒的近白**，不切底噪的话整片背景会变成 alpha 1~40 的极淡噪点：既像蒙了层雾，又让 alpha 通道全是噪声、PNG 完全压不动（实测 1.2MB → 切完 ~150KB）。做法：低于 `FLOOR≈0.22` 直接归零，其余线性拉回 0..1。
- **「液体分层」必须画成两段不重叠的色带**：每段显式给 `from`／`to`（底边 = from、高度 = to − from），
  下层 `[0, 次日剩余]`、上层 `[次日剩余, 今日剩余]`。**别让两段都从底部起**——上层会把下层整个盖掉，
  症状是"永远单色"（本项目水瓶/罐头就这么中过招）。分色也别用没定义过的 CSS 变量（`--pl-info` 不存在，
  整条 var 链失效后色块直接不显示）。
- **百分比定位留意单位**：0..1 的归一化坐标换算成 CSS 百分比要 ×100。本项目温度计刻度写成
  `(TB[3] - TB[1]) * (pct / 100)`，漏了乘 100，结果所有刻度与指针都被压到离底 5.5%（看起来"标签全挤在最下面"）。
  排查很省事：**直接读 `getComputedStyle(el).bottom` 的 px 值**，除以容器高度就知道比例对不对。

### 资产对账（"我是不是丢了素材"这类问题）

别靠记忆或截图，**拿代码的引用去对磁盘**：扫 `src/**` 里的 `./art/<名字>` 与 css `url()`，加上 artLayout.json 的 `file` 字段，再按规则枚举（`mod-<id>-<lv>`、`cut-model-<site>`、`wear-*`、`line-*`），最后 `comm` 出"引用但不存在"。
两个注意：① 从 `modules.ts` 抠 `id:` 时要限定缩进，否则会把 `skill: { id: 'mechanics' }` 这类嵌套技能 id 当成模块、报一堆假缺失；② `git log --diff-filter=D --name-only -- public/art` 能列出**曾被删过的**素材——那是"主动退役"还是"误删"一眼可辨。
