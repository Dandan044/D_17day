# 交接文档：「今日待办」「今日计划」做成 diegetic 面板

> 2026-09-11。复用「避难所工程」那套经验（点场景实物 → 整屏就是那个实物本身），把这两个面板从通用深色 `Modal` 重做成各自的实物形态。
> `typecheck` / `build` / `lint:content` / `verify`(152 通过) / `verify-art-layout` 全绿；无头 Chrome 实测两个面板。**只动档案皮肤**，经典皮肤一行未改（已用 `classic.html` 冒烟确认 `artRoot = 0`）。

## 一、两个物体，两种纸

入口物件都压在**画面左下桌面**上，但性状完全不同——所以两个面板不能长成同一张纸：

| 维度 | 今日待办 | 今日计划 |
|---|---|---|
| 入口热点 | `cut-h-notebook`（188×81 ≈ 2.3:1） | `cut-h-plan`（354×105 ≈ 3.4:1） |
| 载体 | 本子**摊开的两页** | 一张**宽横三栅计划表** |
| 版面 | 双页对开：左页「迫在眉睫」／右页「在等的事」 | 左栅配给／中栅取暖／右栅供电 + 表底图签 |
| 纸 | **冷**米白微绿练习本内页（`--nb-paper #e3e1d4`） | **暖**卡其旧表单纸（`--pl-paper #c9b994`） |
| 线条 | 每行一条横格底线 + 左侧朱红页边线 | 竖列线 + 双线外框 + 图签分格 |
| 装订 | 中缝折痕 + 四针装订 | 无，有表号 |
| 书写工具 | 蓝黑圆珠笔 + 红笔 + 橙马克笔 + **楷体**（`--nb-hand`） | 深墨制图笔 + 赭红 + 方戳 + 宋体/mono |
| 分级表达 | **手写批注**：红笔划定＝要命、橙色马克笔＝预警 | 红笔划重点框（危险）／赭石批注（预警） |
| 动画锚点 | `transform-origin: 30% 74%`，从左下**抬起摊开** | `transform-origin: 47% 74%`，位移更小、旋转反向 |

**判定一张纸是"同一张纸"还是"另一个物件"，靠六项叠加**：横长比 / 纸温 / 线条方向 / 有没有装订 / 有没有束线 / 书写工具。最忌两纸都取"米白泛黄 + 深墨"。

## 二、两个关键手法

### 1. 分级的表达方式：手写，而不是徽章

纸面上弹深色卡片/徽章会立刻退回"控制台感"。红橙两级改用 CSS 画的笔迹（不依赖素材）：

```css
/* 红笔划定：两条略斜的线叠成手绘下划线 */
.art-nb-item.is-red .art-nb-name::after {
  content: ''; display: block; height: 5px; margin-top: -1px;
  background:
    linear-gradient(94deg, transparent 0 1%, var(--nb-red) 1% 99%, transparent 99%) center 0 / 100% 2px no-repeat,
    linear-gradient(86deg, transparent 46%, var(--nb-red) 46% 53%, transparent 53%) center 100% / 100% 2px no-repeat;
  opacity: .85;
}
/* 橙色马克笔：半透明橙 + 微旋转斜切 + multiply，像笔扫过标题带 */
.art-nb-item.is-orange .art-nb-head::before {
  content: ''; position: absolute; inset: 1px -7px 2px -4px; z-index: 0;
  background: linear-gradient(180deg, transparent 0 14%, var(--nb-marker) 14% 86%, transparent 86%);
  transform: rotate(-0.6deg) skewX(-2deg); mix-blend-mode: multiply; opacity: .6;
}
```

> 橙色在亮纸上作**文字色**对比只有 ~2.2:1，所以橙色只做**底纹**（文字仍用近黑墨，叠底后 9.2:1），另留一个深赭 `--nb-orange-ink #8a5210` 供"预警"字样使用。

### 2. 滑杆做成「纸上刻度尺 + 游标」

```css
.art-pl-rail { position: relative; display: block; height: 30px; }
.art-pl-rail-ticks {           /* 底边实线 + 每 10% 短刻度 */
  position: absolute; left: 0; right: 0; top: 50%; height: 15px; transform: translateY(-50%);
  border-bottom: 1.4px solid var(--pl-rule-2);
  background: repeating-linear-gradient(90deg, var(--pl-rule-2) 0 1px, transparent 1px 10%) 0 100% / 100% 6px repeat-x;
}
.art-pl-rail-fill { width: var(--fill, 0%); }        /* 已选段：电=淡墨蓝，油=淡赭 */
.art-pl-range::-webkit-slider-thumb {                 /* 游标＝重皮后的原生 thumb */
  width: 16px; height: 22px; border: 1.4px solid var(--pl-ink); background: var(--pl-paper-hi);
}
```

**游标必须是原生 thumb**，不要另做一个 `left: var(--fill)` 的独立元素——原生 thumb 在轨道两端有半个 thumb 宽的内缩，独立游标必然与真值错位。

## 三、公共组件复用陷阱（本次最高危）

`ArtPlanPanel` 原本只是壳，正文来自经典皮肤的两个组件：

- `RationPanel` / `HeatThermometer`（`src/ui/Game.tsx`）→ 同时**内嵌在经典三栏布局**里（`Game.tsx:50`）
- `PowerPanel` / `GeneratorGauge`（`src/ui/PowerPanel.tsx`）→ 同时挂在**经典供电浮层**（`App.tsx:125`）

改这两个本体 = 连带改掉经典皮肤。所以三栅内容在 `ArtPlanSheet.tsx` 里**重新实现**：只复制引擎数学与 store 动作，DOM 与配色全新。同理 `src/styles.css` 的 `.thermo-rail/.thermo-range/.heat-module-*`（深色、经典共用）一行没动，新做了 `.art-pl-rail/.art-pl-range`。

**待办那边没有这个问题**：经典皮肤根本没有 `overlay === 'todo'` 的入口（`setOverlay('todo')` 全项目只有 `ArtGame.tsx` 一处），所以 `ArtTodoPanel` 可以就地重写。

## 四、必须守住的四件事

1. **滑杆 draft / commit 四环缺一不可**（改坏即退回"每 0.1 步进就 clone 整树"）：
   `onChange` 只写本地草稿 → `onPointerUp/onKeyUp/onBlur` 才 `setHeatMix` → 两个 `useEffect([elecValue])`/`([fuelValue])` 在外部变化时清草稿回读 store 真值 → 显示值用 `draft ?? min(want, max)`。
   已用 pmtest 哨兵守住：`input` 事件后 localStorage 里 `heatElecWant` 不变，`pointerup` 后才变。
2. **负荷上移/下移必须对完整 `mergedPriority(run)` 换位**，不能对过滤后的 `order` 换位（有隐藏行时序号会跳错）。
3. **准备期分支**：`run.day < TIME.COLLAPSE_DAY` 时配给栅只留一张说明卡（`prepTitle/prepBody/heads/perWater`），不出档位戳。
4. **详情用内联推挤，不用 hover 浮层**：纸面上弹深色浮层既违和又不可交互（浮层里点不稳、触屏失效）。实测展开后列表高度真的变大（+58px）。

## 五、文件

| 文件 | 动作 |
|---|---|
| `src/ui/art/ArtTodoPanel.tsx` | 重写（纯只读，数据契约不动） |
| `src/ui/art/ArtPlanSheet.tsx` | 新建：`PlanRationColumn` / `PlanHeatColumn` / `PlanPowerColumn` / `PlanGauge` |
| `src/ui/art/ArtPlanPanel.tsx` | 只重写 `ArtPlanPanel`；`ArtBodyPanel`/`ArtSuppliesPanel` 原样保留 |
| `src/ui/art/art.css` | 追加 `.art-nb-*`（约 700 行）与 `.art-pl-*`（约 640 行）；删除旧 `.art-todo-*`（89 行） |
| `src/ui/art/skin.ts` | 追加 `todoPaper` / `planPaper` |
| `src/game/copy/zh/ui.ts` | 追加 `ui.todo.*`(7) 与 `ui.plan.*`(10)；`ui.game.*` / `ui.power.*` 能复用的都复用 |
| `scripts/make-art-paper.py` | 新建：一个脚本两种参数（`todo` / `plan`） |
| `public/art/paper-todo.jpg`、`paper-plan.jpg` | 产出 |
| `.preview/pwtest/todo-plan-shot.mjs` | 新建：结构与行为实测 |

**红线（一律没动）**：`src/ui/Game.tsx` 的 `RationPanel`/`HeatThermometer`、`src/ui/PowerPanel.tsx`、`src/styles.css` 的 `.thermo-*`、`src/game/engine/todos.ts` 的数据契约（`ArtGame.tsx` 还在用 `todoTier` 给本子热点描边）、`src/App.tsx`、经典皮肤任何文件。

## 六、素材与定标

两张纸都**只生成"完全空白的纸"**：格线/列线由 CSS 画（条目高度会随展开变化，烤进贴图的线必然与内容错位）。

- 待办纸：`image1 = cut-h-notebook.png`，冷米白微绿练习本内页 → `CROP 0.09` / `TARGET_LUM 0.55` → `1260×840`，实测 L=0.539（与近黑墨 **9.9:1**）
- 计划纸：`image1 = cut-h-plan.png`，泛黄暖卡其旧表单纸 → `CROP 0.085` / `TARGET_LUM 0.46` → `1276×850`，实测 L=0.445（**8.3:1**）

`scripts/make-art-paper.py` 两件事：对称裁掉外圈（清掉烤进图里的边框与右下「AI生成 WORKBUDDY」水印）+ **亮度定标**到目标相对亮度。定标必须在脚本里算——靠 prompt 让模型"调暗"不可靠（实测 img2img 保真太强，让它调暗反而更亮）。

## 七、验证

```bash
npm run typecheck && npm run build && npm run lint:content && npm run verify
python scripts/verify-art-layout.py        # 确认没误动 cut-h-plan / cut-h-notebook 的 box
npx vite --host 127.0.0.1 --port 5200 --strictPort
node .preview/pwtest/todo-plan-shot.mjs http://127.0.0.1:5200/
node .preview/pwtest/probe.mjs http://127.0.0.1:5200/classic.html
```

实测结论：待办 2 页 / 条目数 == `collectTodos` / `is-red` 全在 `is-orange` 前 / 折叠态每项恰一行关键数值（取首个含数字的行，没有数字则退回首行）/ 点开后 `aria-expanded="true"` 且列表真的变高 / 钩子名与条件对上；计划 3 栅 / 口粮 4 戳+用水 3 戳且选中态与 `run.ration`、`run.waterUse` 一致 / 需求数字 == `dailyNeeds` / 两根刻度尺 max 与 value 正确 / 台账首行禁上移末行禁下移 / 效率表在 / 图签四项 / **draft-commit 哨兵通过** / 准备期只剩说明卡；经典皮肤 `artRoot = 0`。

> 测试脚本注意：store 的 persist 是**节流**的，外部改档前要先等一拍（`sleep(1300)`），否则会被上一笔待写回覆盖（本次踩过：第二次改档被吃掉）。

## 八、待办 / 已知弱项

1. **Esc 关闭仍跳过收回动画**（`App.tsx` 全局监听直接 `setOverlay(null)`，与避难所同一个既有问题）；点「关闭」才走 240ms 收回。
2. 待办右页的钩子名与条件是**引擎内联中文**（`copy/names.ts` 的 `HOOK_NAME`、`todos.ts` 的 `HOOK_CONDITIONS`），不走 `t()`；要改措辞得改那两个真源。
3. 「已办结划掉」只做进了页头图例当记号教学——`TodoItem` 里没有"已完成"字段，给真条目划线等于伪造状态；要真划掉需先加一个派生判据（属行为改动）。
4. 计划纸与避难所图纸同族（墨色取同一组 hex），若以后再加第三张纸，注意别再撞。

---

# 追加：事件改成可翻页的书本 + 纸面随理智/人性动态污损

> 2026-09-11 同日追加。**同一个本子**：点本子先翻今天的事件（左页正文 / 右页选项），翻完落到「今日待办」那两页；纸面的皱褶、涂鸦、血污随理智与人性实时变化。

## 九、事件书本（`ArtEventBook.tsx`）

### 为什么必须新建组件

`src/ui/EventCard.tsx` **同时被经典皮肤的三栏布局引用**（`Game.tsx:53`），和 `RationPanel`/`PowerPanel` 是同一类"两皮肤共用体"。所以书本是新文件：只把查询逻辑（`FAMILY_BY_ID` / variant 查找 / `checkRequirement` / 成功率 / 材料消耗）重写一遍，呈现全新。

`ArtGame.tsx` 里原来那套 `.art-event-layer` + `.art-event-card` + `<EventCard>` 整块被替换成 `<ArtEventBook run={run} onBack={...} />`（`zoomEvent` 仍是 ArtGame 的局部 state，所以用回调而不是 store），三个旧类名的样式一并删掉。

### 翻页的数据基础

`run.queue: Array<{familyId, variantId, tags?}>`，一屏一件、永远读 `queue[0]`。作答走 `resolveChoice(familyId, variantId, choiceId)`，它末尾会把对应项 **filter 掉**，于是 `queue[0]` 自动变成下一页——**翻页不需要自己维护页码**，判据是：

- 当前页 = `queue[0]`，页数 = `queue.length`（`还剩 N 件` / 最后一件）
- 翻页动画：监听 `familyId:variantId` 变化播一次 430ms 的 `rotateY` 翻纸
- 注意作答后 `emitHook(run,'choice')` 可能**再塞进新事件**，所以"还剩几件"要实时读、不能缓存

### 结算不再弹窗（要动 App 层，但带皮肤判断）

档案皮肤下把结果**写在左页正文下方**当一段手写批注（`ui.result.*` 文案原样复用：判定成败、d20 明细、袭击守住/被破、掉落芯片、日志条）。为此在 `App.tsx` 屏蔽了公共的那个：

```tsx
{!(art && gameUi === 'art') && <ChoiceResultModal />}
```

带判断，经典皮肤照旧。

**一个必须处理的边界**：答完**最后一件**时 `queue` 已经空，但 `lastChoice` 还在——`ArtGame` 原来的渲染条件是 `queue.length > 0`，那一瞬会把整层卸载，结果就再也看不到了。改成：

```tsx
{zoomEvent && (run.queue.length > 0 || lastChoice) && <ArtEventBook ... />}
```

同理 Esc 也要放行：有未关的结算时不给退（`!lastChoice`）。

### 翻完自动落到待办

原来 `run.queue.length === 0` 只是把 `zoomEvent` 复位回场景。现在：

```tsx
useEffect(() => {
  if (!zoomEvent || !run) return;
  if (run.queue.length === 0 && !lastChoice && run.phase !== 'ended') {
    setZoomEvent(false);
    setOverlay('todo');
  }
}, [zoomEvent, run, lastChoice, setOverlay]);
```

`run.phase !== 'ended'` 是必要的：死亡时 `dismissChoice` 会把 screen 切到 summary，不该再叠一层待办。

实测确认：3 件 → 左页正文 / 右页 3 个选项 / `还剩 3 件` → 选一项出结果且选项全锁 → 关掉翻到第 2 件 → ... → 最后一件关掉结果后**自动进今日待办**。

## 十、纸面动态污损（`NotebookWear.tsx`）

### 分档

| 层 | 判据 | 素材 |
|---|---|---|
| 理智中档 | `sanity < 40` | `wear-sanity2-{a,b,c}`（轻皱 + 少量涂鸦） |
| 理智重档 | `sanity <= 10` | `wear-sanity3-{a,b,c}`（严重褶皱 + 破损 + 大量涂鸦） |
| 血污轻/中/重 | `humanity < 40 / < 20 / < 10` | `wear-blood-{1,2,3}` |
| 血手印 | `humanity < 10` | `wear-hand`（只贴右下角，不铺满） |

**阈值刻意比引擎早一档**（引擎是 35 / 15）：纸面该早一点开始变脏，但理智崩溃的判定不该跟着动。两层相互独立，低理智 + 低人性会同时叠。

变体按 `seed + day` 取模 → **同一天内稳定**（否则每次重渲染换一张会闪），跳天/跳局才换。

### 三个必须知道的实现点

1. **素材走 `mix-blend-mode: multiply`**：全部生成"白底 + 深色损伤"，白 = 不变、深色 = 压暗，纸的肌理仍透得出来，也**不需要抠透明**。
2. **父层绝对不能有 `z-index`**（本次踩的真 bug）：定位元素一旦带 z-index 就形成 stacking context = 隔离组，里面的 `mix-blend-mode` 只能跟"空背景"混合——于是白底部分直接盖在文字上，整页信息被糊掉（诊断特征：字母全没了但纸还在）。正确写法是父层只 `position/inset/pointer-events`，**z-index 写在每个 `.art-wear` 上**。
3. **透明度是可读性闸门**：损伤层铺满整页，压太狠会把所有文字一起吃掉，而用户要的是"遮挡**部分**信息"。实测重档 0.82 时整页不可读，降到 **0.52** 才既有明显损伤又留得住正文。

### 素材后处理（`scripts/make-notebook-wear.py`）

源图 `.preview/gen/wear-*/`（每目录一张）→ `public/art/wear-*.jpg`，三件事：

1. 裁掉底部 9%（右下角「AI生成 WORKBUDDY」水印）；
2. **白点归一**（取 86 分位当白，高出的直接裁成纯白）——不归一的话背景那点灰会在 multiply 下把整页蒙上一层灰纱；取低分位是为了让**淡损伤**也拉开对比；
3. **按"压暗面积"目标二分反求稀疏指数** `k`（`a' = 1-(1-a)^k`）。这一步不能省也不能拍死：模型画出来的"损伤"是铺满整幅的灰场，直接乘上去整页变灰球；而同一串 k 对"细线型"（皱褶、涂鸦）和"整片型"（血渍、灰场）效果差极远——实测固定 k 会把轻档洗成看不见、又让血污重档比中档还少。按目标面积反求后，每档的视觉分量是**可测的**（理智轻档压暗 10~12%、重档 22~27%、血污 6/15/24%、手印 5%）。

### 共用纸面

「今日待办」与「事件书本」是同一本本子，所以纸面抽成了 `NotebookSheet.tsx`（纸 + 朱红页边线 + 中缝针脚 + 污损层）。污损层放在 `children` **之后**（压在文字上），靠 `pointer-events: none` 保证点得到下面的按钮。

---

# 追加二：翻页落定到待办 / 去掉图例 / 罪孽预警条目

## 十一、事件翻完是"翻到下一页"，不是换界面

**问题**：原来队列读完时是 `setZoomEvent(false)` + `setOverlay('todo')` —— 书本组件被卸载、待办面板重新挂载，于是**本子又飞进来一次**（`art-nb-in` 从桌面位置放大入场），切换很生硬。

**做法：不换组件，只换内容。** 待办正文抽成 `TodoSpread.tsx`（抬头 + 左页 + 右页 + 页脚），两处共用：

- `ArtTodoPanel`（直接点本子）＝ veil + 房间 + `NotebookSheet` + `<TodoSpread/>`，负责纸的进/出场动画；
- `ArtEventBook`（今天的事件）＝ 同一个 veil、同一张 `NotebookSheet`，队列读完（`queue.length === 0 && !lastChoice`）时**就地**把事件页换成 `<TodoSpread/>`。

判据 `finished = remaining === 0 && !pending`。配套两处：

1. `ArtGame` 的渲染条件从 `zoomEvent && (queue.length > 0 || lastChoice)` 简化成 **`zoomEvent &&`** —— 否则队列一空整层就卸载了，落定页根本没机会显示；读完之后由书本自己决定显示事件页还是待办页。
2. 换内容时给载体加 `.art-book-landed`：从中缝那侧 `rotateY(-13deg)` + 淡入（480ms），同一时刻 `.art-book-leaf` 扫过右半页 —— 读起来就是"翻过去的一页落定"。

> 教训：**同类实物之间的切换，别用"卸载 A + 挂载 B"**，哪怕 B 长得一样——重新挂载会重播入场动画，看起来像动画穿帮。抽共用正文、就地换内容才对。

## 十二、去掉左页图例

「红笔划的 · 要命 / 马克笔 · 预警 / 办完的划掉」这段太啰嗦、像说明书，删掉。
连带清理：`ui.todo.legendRed/legendOrange/legendStrike` 三个键、`.art-nb-legend/.art-nb-dash/.art-nb-strike` 三组样式（49 行）。
分级本身靠笔迹自己说话——红笔划定 vs 橙色马克笔已经够读。

## 十三、新条目：罪孽爬上了你的脊背（预警档）

`engine/todos.ts` 里新增一条 **orange（预警）**：

- 判据 `run.stats.humanity < HEALTH.HUMANITY_OMEN`（**新常量 = 20**，加在 `balance.ts` 的 `HEALTH` 里，和 SANITY_UNRELIABLE / SANITY_BREAK 排在一起）
- 它**不直接扣任何数值**，只预警"负面事件会接连找上门"，所以归预警档而不是致命档
- 阈值 20 与笔记本纸面的血污档位（<20 起加重、<10 出重档）**对齐**——纸在变脏、清单在警告，两边互相印证
- 文案跟着现有条目的格式：`lines[0]` 是数值（`人性 15/100。`），`lines[1]` 讲后果，`fix` 给可行的对策

## 十四、排查："避难所工程的家具图不见了"

**先给结论：不是 bug，代码与素材都正常。** 实测证据：

| 检查 | 结果 |
|---|---|
| `public/art/mod-*.png` | 30 张齐全（`mod-fortify-1.png` 160072 字节） |
| 唯一在跑的「七日之前」服务（:5200）取图 | **160072 字节，正常** |
| 无头浏览器打开避难所面板 | **10 张缩略图全部 `naturalWidth > 0`** |
| 构建产物（`dist/art/mod-*.png`） | 30 张，且与 public **逐字节一致** |

扫全部 50 个监听端口后，只有 `:5200` 是本项目；`:5174` 是另一个工程（标题 **My Trae Project**，它对 `/art/*` 一律回退成 index.html），`:5175` 是 LLMbox Portal。

**这类"图全没了"的最可能原因（按概率）**：

1. **浏览器标签停在旧页面** —— 尤其是 5174 那个别的工程，或本项目早先的某个标签；
2. **缓存了旧的 404** —— 家具图是后来才生成的，之前那次 404 会被浏览器记住 → **Ctrl+Shift+R 硬刷新**即可；
3. **看的是早先发布/部署出去的快照**（在线链接是那一刻的产物，不含后来的美术）→ 重新发布。

**顺手加的安全网**：`hideBrokenImg` 以前是**静默隐藏**（图挂了只剩一个空框，完全查不到原因），现在开发模式下会把失败的 URL 打到控制台：

```
[art] 图片加载失败，已隐藏： http://…/art/mod-fortify-1.png
```

以后遇到"某块图没了"，先看这一行。
