# 交接文档：抠图截断修复 + 多边形热区

> 2026-09-10。解决档案皮肤「物品抠图右半截断」与「热区大于轮廓」两类问题，局内 10 件 + 主菜单 6 件全量重做。typecheck / build / verify-art-layout 全绿，浏览器实测通过（截图在 `.preview/browser/`）。

## 一、两类问题与根因

1. **抠图截断**：`CROPS` 人工分数框做硬裁剪，物品超出框缘的像素直接丢失（plan/notebook/clock/bed/medkit/door/shelf 全中招，blueprint 底部图签也被切）；blueprint 右上锯齿另有一层原因——旧 `drop_wood_fringe` 的 `lum>108` 全局阈值把阴影中的纸咬掉。
2. **热区过大**：命中区 = 配置框矩形（svg CSS 盒 `pointer-events:auto` + `<image visiblePainted>` 不看 alpha），框内透明留白最大 59%；hover 发光挂在同一矩形上，放大「轮廓外可点」的体感。

## 二、新管线（改框不再需要双写）

```
CROPS（检测框，可重叠）→ rembg + KEY_CFG 后处理 → alpha bbox 自动收紧 PNG(+4px 涂边)
→ 提取多轮廓 hit poly（skimage → RDP → 外扩 2px）→ 写入 src/ui/art/artLayout.json（唯一数据源）
```

- `scripts/art_common.py`：共享库（tighten / drop_border_fringe / keep_connected / sweep_dust / extract_polygon / layout 读写 / EDGE_EXEMPT 豁免表）。
- `scripts/audit-crops.py`：审计（alpha 探针报 TRUNCATION-SUSPECT + 总览网格图 + 2x 放大图）。
- `scripts/verify-art-layout.py`：断言（box/px 一致、alpha 不贴缘、poly 合法、HUD 锚点在位；重叠 report-only）。
- `scripts/preview-home-composite.py`：改读 artLayout.json；matte 模式自动叠 poly 描边；新增 `menu` 模式、`--props` 等。
- `skin.ts`：CUT / CUT_HOME / HOME_POLY / MENU_POLY / HUD_BOX 全部从 artLayout.json 派生；**改框只改 py 里的 CROPS，重跑脚本即可，前端零改动**。
- `cutouts.json` 已无任何引用，待删除。

## 三、多边形热区（ArtCutout）

- `poly` prop（环的数组，clipPath 并集）→ `<clipPath clipPathUnits="objectBoundingBox">` 加在 `<image>` 上：svg 的 drop-shadow 继续按裁剪后轮廓发光，is-pulse/is-off 自动生效。
- 命中面关键：poly 存在时 button 加 `.is-clipped`，CSS 关掉 svg 盒的 pointer-events，命中只剩被裁剪的 image 本体；hover 经祖先传播，tooltip/发光逻辑零改动。
- 兜底：poly=null（window / 提取失败）→ 行为与旧版一致（矩形命中）。

## 四、HUD 锚点（重要）

`art-hud-clock`（天数/AP）与 `art-hud-mark`（建造角标）历史上复用 clock/blueprint 的旧松框定位。收紧后摆放框变了，但 JSON 里 `hud` 字段保存旧框，`HUD_BOX` 供这两处使用——**HUD 位置与改动前逐像素一致**。

## 五、关键修正记录（含踩坑）

| 物品 | 修正 |
|---|---|
| plan | 框右 0.494→0.575（纸尾伸到时钟身后，重叠带由 DOM 序时钟优先）；`top_band 0.295` 清掉桌后椅背 |
| notebook | 框右 0.306→0.375；底 0.801→（菜单本 0.87，书签绳垂到 0.845） |
| blueprint | 底 0.448→0.648（纸底图签整块曾被切）；`border_fringe lum 130` 替代 wood_fringe，锯齿治愈 |
| clock | 框四向微放宽（右沿 0.64→0.665） |
| bed | 框右 0.32→0.40、底 0.98→1.00（右柱与床腿曾被切） |
| medkit | 整框重构 (0.40,0.512,0.505,0.63) 只含铁箱；旧框裹进了床栏杆+床头柜 |
| door/shelf | door 左 0.50→0.482（左框柱被切）；home shelf 顶 0.10→0.055（顶板被切） |
| 菜单 6 件 | 全部按审计图重测重切；table 桌腿、journal 三边、stamp 底座、notebook 书签绳 |
| 菜单 shelves | `carve` 矩形清掉裹进来的桌角桌腿（物品物理重叠，框允许重叠，像素归属由 matte 决定） |

踩坑：
- **birefnet 对裁剪框平移极度敏感**（shelves 框移 10px → 整架只剩碎片），改框后必须重看 matte；shelves 配了 `min_cover: 0.55 → u2net` 兜底。
- **不能给 shelves 开 border_fringe**：暗色金属骨架是整块连通分量，右柱贴边会被连坐清零（0.71→0.02 实录）。
- 框缘截断 ≤3px 且放宽会引进更糟内容时，走 `EDGE_EXEMPT` 豁免（bed 左/底、medkit 左、shelves 左/右、table 左/底、vending 右）。

## 六、日常流程（下次新增/调整物品）

```
python scripts/audit-crops.py home|objects        # 看真实边界（.preview/audit/）
# 改 scripts/cut-art-*.py 的 CROPS / KEY_CFG
python scripts/cut-art-home.py <key...>           # 重切（自动收紧+poly+layout）
python scripts/cut-art-objects.py --force --props [key...]
python scripts/verify-art-layout.py               # 断言必须全绿
python scripts/preview-home-composite.py matte [key...]   # 品红底+poly描边目检
npm run typecheck && npm run build                # 前端无需改动，除非加物品
```

浏览器验证：`npm run dev`（端口占用会顺延，看启动输出）。局内场景靠存档加载，**只切视角看，别点 bed（休息/结束当天）与 stamp 双击（弃局）**。`.preview/pwtest/cdp-test.mjs` 是本次用的 CDP 悬停/点击测试脚本（Edge headless，零依赖），可复用。

## 七、待办

1. `public/art/cutouts.json` 已无引用，等确认后删除。
2. 菜单 journal 的钢笔在 matte 中是镂空（birefnet 视钢笔为背景），点击钢笔不触发账本——影响极小，如在意再加"亮底保暗笔"后处理。
3. 本轮美术改动与之前的窗景修复都未提交，建议一并整理 commit（`build_*.txt`/`dist_*` 杂物不纳入）。
