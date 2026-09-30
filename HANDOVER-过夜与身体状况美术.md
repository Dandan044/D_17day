# 过夜 / 身体状况：两套 diegetic 美术资源方案

2026-09-21 · 资源已落盘、已接进资源表 · 面板组件尚未改造

---

## 为什么是这两屏

档案皮肤（`art.html`）里已经实物化了三屏：避难所工程 = 墙上的工程图纸、今日计划 = 桌上那张扁纸、今日待办 = 摊开的笔记本。判据只有一条：**进入方式与呈现必须互相解释**。

这两屏还卡在半路上：

| 屏 | 入口热点 | 现在弹出来的 |
|---|---|---|
| 过夜 | 侧墙的床（`cut-h-bed`） | 经典 `NightReportModal` —— 深色控制台面板，零 diegetic 美术 |
| 身体状况 | 侧墙的医疗箱（`cut-h-medkit`） | `ArtBodyPanel` 内部仍是通用 `Modal` 包着经典 `BodyPanel` |

点的是床和药箱，弹出来的却是控制台。这次的方案就是把这两处补齐。

## 两套方案

|  | 过夜 | 身体状况 |
|---|---|---|
| 实物载体 | 床头那一晚：铁架床近景 | 掀开的墨绿铁皮医疗箱 |
| 纸材 | **冷灰蓝**夜间记录纸（自带十字折痕） | **米黄**厚卡纸体征记录卡 |
| 色彩关系 | 冷、低亮度，像夜里灯下压在手边的一页 | 暖、五张纸里最亮，像箱盖内衬那张卡 |
| 承载的逻辑 | 每晚健康结算（`ledger` 条目 / HP 明细 / 环境行） | 五项体征 + 需要处理的疾病 + 治愈率 |
| 进场锚点 | 床在侧墙偏左下 → `transform-origin: 20% 76%` | 药箱在侧墙中偏上 → `transform-origin: 44% 59%` |

进场锚点不是拍脑袋定的，是从 `artLayout.json` 的检测框算的：床 `box=[0, 0.52, 0.39, 0.48]`、药箱 `box=[0.4, 0.548, 0.082, 0.079]`，取各自中心。

### 装配预览

| 过夜 | 身体状况 |
|---|---|
| ![过夜](.preview/art-night-body/night.png) | ![身体状况](.preview/art-night-body/body.png) |

> 预览不是产品代码，只是把「新纸 + 新景深底 + 纸上墨色」按 `ArtShelterPanel` 的规格叠出来看效果（1180×880 纸、`blur(22px) brightness(.33)` 景深、四角 mark、图签横条）。复现：`.preview/art-night-body/{night,body}.html`。

---

## 资源清单（已落盘）

| 文件 | 尺寸 | 用途 | 生成 | 后处理 |
|---|---|---|---|---|
| `public/art/scene-night-bed.jpg` | 1500×937 | 过夜的虚焦景深底 | ImageGen img2img，基准 `cut-h-bed.png` | `make-art-scene-inset.py night` |
| `public/art/paper-night.jpg` | 1260×840 | 过夜的纸面底材 | ImageGen 文生图 | `make-art-paper.py night` |
| `public/art/scene-body-kit.jpg` | 1500×937 | 身体状况的虚焦景深底 | ImageGen img2img，基准 `cut-h-medkit.png` | `make-art-scene-inset.py body` |
| `public/art/paper-body.jpg` | 1322×882 | 身体状况的纸面底材 | ImageGen 文生图 | `make-art-paper.py body` |

已接进 `src/ui/art/skin.ts` 的 `ART` 表：

```ts
sceneNightBed: './art/scene-night-bed.jpg',
nightPaper:    './art/paper-night.jpg',
sceneBodyKit:  './art/scene-body-kit.jpg',
bodyPaper:     './art/paper-body.jpg',
```

### 单张说明

**`scene-night-bed.jpg`** —— 沿用 `scene-home-side.jpg` 里那张床的材质：黑铁管护栏、军绿羊毛毯、灰蓝水泥墙、右上角那盏暖黄吊灯。镜头挪到床尾斜上方，灯罩只露一个角、床头柜与暗门虚化。**锁定材质靠的是 img2img 而不是 prompt 词**：`image1` 传 `cut-h-bed.png`、`input_fidelity: high`，所以连毛毯的绒面走向都和场景图一致。

**`paper-night.jpg`** —— 冷调灰蓝旧纸，带横向折痕与竖折痕，**十字折痕在裁切后仍落在画面中心**，所以 CSS 可以照 `paper-shelter` 的做法用 `background-position: center` 对齐（想画分隔线也不会和烤进图里的折痕错成双线）。去饱和只给 0.08：冷调是这张纸的身份，去多了就退化成又一张米白纸。

**`scene-body-kit.jpg`** —— 同一个医疗箱，箱盖掀开、斜上 45° 俯拍。箱内分两格（左格卷起纱布与绷带、右格金属镊剪与小药瓶），**箱盖内侧天然就是一块米黄卡纸**，正好承接下面那张体征记录卡。

**`paper-body.jpg`** —— 米黄厚卡纸，纤维压痕 + 极淡的胶渍与指印，完全空白。它是五张纸里最亮的一张（L=0.504），和暖卡其的计划纸靠**亮度**分家、和冷灰蓝的记录纸靠**色相**分家。

---

## 视觉规格（与既有三屏对齐的口径）

| 纸 | 相对亮度 L | 与近黑墨的对比 | 去饱和 | 裁切 |
|---|---|---|---|---|
| `paper-shelter`（工程纸） | 0.42 | ≈ 7.9:1 | 0.18 | 0.11（同时量折痕） |
| `paper-plan`（计划纸） | 0.46 | ≈ 7.9:1 | 0.16 | 0.085 |
| `paper-todo`（笔记本页） | 0.55 | ≈ 9:1 | 0.06 | 0.09 |
| **`paper-night`（记录纸）** | **0.432** | **≈ 8.1:1** | **0.08** | **0.09** |
| **`paper-body`（体征卡）** | **0.504** | **≈ 9.3:1** | **0.12** | **0.07** |

所有纸都 ≥ 7:1，正文能用近黑墨。**亮度定标必须在脚本里算准**，靠 prompt 让模型「调暗/调亮」不可靠——实测 img2img 保真太强，让它调暗反而更亮。

### 景深底亮度：这次唯一一处「没有对齐」

`scene-home-desk` L=0.047、`scene-home-side` L=0.047，虚焦 `brightness(.33)` 后平均灰约 15。两张新底图刻意**亮约 1.8 倍**（虚焦后 27 / 30）：

```
scene-home-desk   平均灰 47.6 → 虚焦后 15.7
scene-home-side   平均灰 44.8 → 虚焦后 14.8
scene-night-bed   平均灰 81.4 → 虚焦后 26.9   ← 灯下的床头，刻意亮一档
scene-body-kit    平均灰 91.0 → 虚焦后 30.0   ← 吊灯直射的箱子，刻意亮一档
```

理由是这两张是**灯下近景**，压到全景同一档会把实物轮廓压没，「床头/药箱」这层信息就白生成了。压在 1.8 倍是能辨认轮廓、又不至于比图纸屏亮一截的位置。

### 纸上的语义色（建议变量）

深色 UI 的琥珀/告警在浅纸上没有对比度，语义色要换到墨色系：

```css
/* 过夜：冷灰蓝纸 */
--nt-ink: #1b2028;  --nt-ink-2: #39434c;  --nt-red: #8f2a12;
--nt-green: #27492f; --nt-blue: #23425c;  --nt-ochre: #5c3f0a;

/* 身体状况：米黄卡纸 */
--bd-ink: #1d1a15;  --bd-ink-2: #3a342a;  --bd-red: #93270f;
--bd-green: #2c4a2f; --bd-ochre: #6b4a0c; --bd-blue: #23425c;
```

五个仪表按语义各走一支：生命=朱红、体力=赭石、理智=墨蓝、人性=墨绿、名声=灰。

---

## 装配规格

沿用 `ArtShelterPanel` / `ArtPlanPanel` 已经跑通的那套，不要另造：

1. **背景 = 实物近景虚焦**：`.room { inset: -8%; background-size: cover; filter: blur(22px) brightness(.33) saturate(.7) }`，再叠一层 `radial-gradient` 把边缘压到 0.86。
2. **纸铺满 1180×880**，`box-shadow` 双层投影；纸面单独一层走 `background-size: cover; background-position: center`。
3. **文字与线条全归 CSS**：边框、角标、表格线、图签、印章一律 CSS 画。字能选中、能跟文案表走、能换皮——**别把图签画进图里**。
4. **进/出场从热点位置飞入**：`transform-origin` 用上面算好的锚点，起手 `translate3d(-30vw,-14vh,0) scale(.24) rotate(-3deg) + blur(4px)`，收到 `none`，约 470ms；关闭 240ms 反向，`setTimeout` 延迟 `setOverlay(null)`（本地 `closing` state）。
5. **`var(--art-serif)` 不继承**：浮层挂在 `.art-root` 外面，serif 要在 veil 上重新定义一次。
6. **功能一条不丢**：`NightReportModal` 的每个字段（weekly 周报 / notes / hpParts / healthNotes / hpAfter / 环境影响行 / 三个大数 / 底部主按钮）与 `BodyPanel` 的每个字段（五个 Gauge / 疾病卡 / 用药按钮 / 医疗站提示 / 治愈率档位）都要在新布局里找到落点。列成对照表自查，重构布局可以、删功能不行。

### 折痕与分区标题（已解决）

夜纸的横折痕不是一条，是**一对**暗带（实测 `paper-night.jpg`：47.0–49.4% 与 52.6–53.9%，中间 49.4–52.6% 是折脊；最暗 -4.9 灰阶，纸均值 174）。合计约 7% 高，比密集台账里任何一条空白通道都宽——**折痕一定会压到某几行字**，这是折过的纸本来就有的样子，不去消除。

真正要躲的是它和 CSS 画的标题横线（`.art-paper-sechead i`）重合：两条线挨在一起就不读成折痕了，读成画歪了。

做法（见 `art.css` 的 `.art-paper-veil.is-nt` 一组规则）：把第二个分区「身体」压进下半区，间距从行距（1.6→1.5）与周报块内衬里各收一点抵掉。实测「身体」标题中心落在纸面 45.3%，离最近暗带净空 **14px**；稀疏的日子多出的空当落在 `.art-paper-body` 底部留白里，密集的日子靠回收的 ~25px 抵掉新增的 20px，净高不涨。

另外给标题加了一层极轻的浮雕 `text-shadow`：折痕位置随当天结算条数浮动，不可能每屏都错开，压在暗带上时标题还立得住。

`paper-body.jpg` **没有显著横折痕**（最暗仅 -1.1），所以身体状况那屏不需要这类避让。

---

## 复现

```bash
PY=~/.workbuddy/binaries/python/envs/default/Scripts/python.exe
$PY scripts/make-art-paper.py night      # → public/art/paper-night.jpg
$PY scripts/make-art-paper.py body       # → public/art/paper-body.jpg
$PY scripts/make-art-scene-inset.py night  # → public/art/scene-night-bed.jpg
$PY scripts/make-art-scene-inset.py body   # → public/art/scene-body-kit.jpg
```

两个脚本都从 `.preview/gen/<key>/*.png` 取**最新 mtime** 的那张源图。要重做先生成新图，或删掉目标 jpg。

`make-art-scene-inset.py` 与 `make-art-paper.py` 的分工是刻意的：**纸要对折痕位置负责，所以走对称裁切；实景底图不裁满圈**（四边都切会把「从某个机位看过去」的构图压窄），水印只在底边，所以只切底边那一条。

---

## 面板落地（已完成）

五张资源已全部接进游戏，两屏从「通用 Modal」换成实物浮层：

- [x] 新建 `ArtNightPanel.tsx`（约 290 行）：档案皮肤下过夜走「床边那一晚」的记录纸，与经典 `NightReportModal` **逐字段等价**。
- [x] 重写 `ArtBodyPanel.tsx`（约 330 行）：从 `Modal + BodyPanel` 改成实物化布局，与经典 `BodyPanel + ExposurePanel` 逐字段等价。
- [x] `App.tsx` 分流：过夜按 `art && gameUi === 'art'` 二选一。`overlay === 'body'` **不需要分流**——它只被 `ArtGame.tsx` 的药箱热点使用，经典皮肤的身体状况是内联在侧栏的，该浮层天然是档案皮肤专属。
- [x] 实测脚本 `.preview/pwtest/night-body-shot.mjs`（零依赖 CDP，独立 profile + 就地改 localStorage 造状态）覆盖：字段计数、墨色变量、纸/底图路径、虚焦滤镜、图签格数、折痕净空、内容溢出、关闭动画、两皮肤分流。
- [x] `npm run typecheck` 通过；`npm run verify` 289 通过 · 0 失败。

### 两处刻意的取舍（不是漏做）

- **过夜的环境行去掉了 `hpAfter`**：它恒等于下面「生命」大数（`endDay` 里就是 `report.hpAfter = Math.round(run.stats.hp)`），同一屏出现两次是冗余。
- **身体状况的暴露度那条去掉了 label**：分区标题已写「暴露度」，整字重复；grid 由 `54px 1fr 52px` 收到 `1fr 52px`。

### 仍未做的

- 过夜纸的横折痕避让是**按纸面固定比例**做的静态让位。若以后换成别的夜纸（折痕位置变了），要重跑 `make-art-paper.py night` 后重新量暗带位置，并同步 `night-body-shot.mjs` 里的 `BANDS` 与 `art.css` 里的注释数字。


