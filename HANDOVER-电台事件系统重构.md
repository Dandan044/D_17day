# HANDOVER · 电台事件系统重构（2026-09-16 复核更新）

> ⚠️ **本文件 2026-09-16 17:30 做过一次事实复核**——原版（9/15 21:08）有一句会引起误判：
> 「文案规则已定稿」容易被读成"文案已完成"。**实际是：规则定稿了，但文案本身从未落盘。**
>
> 现状一句话：**框架改造完成；文案风格框架（含好感朝向模型）定稿并落盘；
> `copy` 表已落盘、缺键 124→0；`verify` 31 条失败→285 全绿；
> P0 硬伤全部修完；P2 规则一致性修完。剩 **P1 事件池量产（23/75）** 与 **git 提交**。**
>
> ⚠️ **所有改动仍在工作区未提交**（`git status` 73 个文件）。接手前先通读，再动第一行。
> ⚠️ **可能有第二条会话在并行改同一批文件**（见第四节「协作风险」）。

---

## 一、当前真实状态（逐项实测，2026-09-16 17:45）

| 项 | 实测 | 证据 |
|---|---|---|
| tsc | ✅ 干净 | `npx tsc --noEmit` |
| **`copy` 表缺键** | ✅ **0**（曾 124） | `npx tsx scripts/lint-content.ts` |
| **`npm run verify`** | ✅ **285 通过 / 0 失败**（曾 240/31） | `npm run verify` |
| lint「正文禁旁白」检查 | ✅ 已加（`narrate` 只许出现在 `silence` 收尾轮） | `scripts/lint-content.ts` |
| narrate 违规 | ✅ 0（曾 13） | lint |
| audit:ids | ✅ 通过 | `npx tsx scripts/audit-ids.ts` |
| smoke / stress | ✅ 7/7 · 40 局无异常 | `.preview/smoke-channel.ts` · `npm run stress:channels -- 40` |
| vite build | ✅ 通过 | `npx vite build` |
| 事件数 | ⚠️ **50 / 75**（9/16 晚 29 → 9/17 上午 45 → 下午 50） | `content/channels/core_xt.ts` vs `docs/xt-pool.md` |
| **git** | ❌ **未提交**（73 文件） | 见第五节 |

### 事件池进度（按 stage）

| stage | 阶段 | 现有 | 蓝图目标 | 关键事件 |
|---|---|---|---|---|
| 1 | 恐慌期 | **9** | ≥25 | xt_hello ✅ |
| 2 | 匮乏期 | **12** | ≥25 | xt_b_address ✅ |
| 3 | 掠夺期 | **9** | ≥25 | xt_c_lockdown ✅ |
| 4 | 严冬期 | **7** | ≥25 | xt_d_cold ✅ |
| 5 | 荒芜期 | **6** | ≥25 | xt_e_lastcell ✅ |
| 6 | 死寂期 | **6**（含 xt_epilogue） | ≥25 | xt_f_rumor ✅ |

9/17 新增 16 个（批次二 7 + 批次三 9）：
`xt_a_east` `xt_a_song` `xt_b_mom` `xt_b_check` `xt_b_grudge` `xt_c_code` `xt_c_mom_leg`
`xt_d_cat` `xt_d_mom_cough` `xt_d_door` `xt_d_newyear` `xt_e_silence` `xt_e_voice`
`xt_f_quiet` `xt_f_power` `xt_f_leave`

六阶段的**关键事件已各就位 1 个**（蓝图要求每组 0-1）。缺口在**普通/关联事件**，尤其
4-6 段（严冬/荒芜/死寂）——这三段是全线情绪最重的部分，也是最需要作者亲自把握的部分。

### 本轮（2026-09-16 下午）修掉的东西

1. **`copy` 表落盘**——整线 46 键组 / 219 条按「好感朝向模型」重写（`v6`），缺键 124→0。
   之前玩家在游戏里**直接看到原始键名**（`RadioPanel` 走 `t()`，查不到返回键名，频道无 fallback）。
2. **好感不再决定生死**——删掉 `xt_ambush` 的 `minAffinity: 40`；改成**轮级分叉**
   （`r1` bond 3-4 / `r1_low` bond 1-2，`elseRound` 汇合）。她**永远会求救**，bond 只决定她怎么喊。
   顺带删掉了永远不可达的 `xt_silent`（含其 stage[9,9] 占位与 audit 豁免）。
3. **`verify` 31 条频道用例重写**——病根是 `doneBefore()` 用了**已被删除的 `e.at` 字段**，
   恒返回空数组 → 前置全不满足 → 整段静默失败（症状与当年"手写清单腐坏"一模一样）。
   新写法：`onlyXt(keep)` 把其它事件全标完成、池里只留目标，抽签变确定。
4. **13 处 narrate 旁白改成台词**（并加 lint 检查）。其中 `xt_up` 是设计收益：
   原旁白「四楼。楼道里一股烧过的塑料味…」占了台词的位置，**玩家念门牌反而没来由**；
   现在她直接问「你到了？」「门牌 背面那个数 你念一遍」，选择终于有了出处。
5. **新增 `xt_b_address`**（匮乏期关键事件，9 轮）+ **新增地点 `sig_xt_building`**
   （七号楼二单元楼道，一次性 hidden 信号点）。尾轮同时交出 `flag:xtKnowsAddress`
   与楼道坐标——门牌/营救主链的脊柱终于接上了（此前 `xt_gift` 用 2 轮就把门牌倒光）。
6. **修了一个引擎 bug**：`pickEvent` 的 key 分支**没检查"阶段是否已到"**，
   导致匮乏期的关键事件会在恐慌期第一天抢先触发、顶掉开场的试音。
   在此之前线上没有任何 key 事件，这条路径从未被走过。
7. **规则入档**：`docs/content-voice.md` 新增「第五轮增补：好感度管「情绪朝谁」，
   不管「有没有情绪」」+ 自检 2 条 + narrate 例外的判定口径（"这句话有没有一个活人能说出来？"）。

---

## 二、已保存产物（接手前按序读）

### 规则文档（真源，按优先级）
| 文件 | 内容 |
|---|---|
| `docs/content-voice.md` | **文案规则真源**。四轮增补 + **「第五轮增补：好感度管「情绪朝谁」，不管「有没有情绪」」**（本轮新增）+ 自检清单加 2 条 |
| `docs/xt-bible.md` | 小桃设定集。**已含「亲密度 × 情绪」章**（两级模型、替换测试、"不许写成短平报事实"、"生死不由 bond 决定"） |
| `docs/radio-voices.md` | 频道线 8 条验收 + 引擎现状核查。**第 6 条已收紧为「正文只有对话行」**（narrate 旧条款废止） |
| `docs/xt-pool.md` | 量产蓝图：六阶段 75 事件骨架、依赖链、每期 1 关键事件 |
| `docs/protagonist-bible.md` | 主角公寓开局设定 |

### 审核稿与草稿（`.preview/`）
| 文件 | 内容 |
|---|---|
| **`xt-copy-v6-draft.ts`** | ★**整线修订稿，可直接替换 copy 表**（46 键组 / 219 条；契约核对通过；装表后缺键 0） |
| `xt-copy-v6-review.md` | v6 的 18 处改动逐条对照（旧/新/理据）+ 实测结果 + 遗留 |
| `xt-bond-orientation-fix.md` | 好感朝向模型修正说明（两级模型 + 替换测试 + 8 条改写示范） |
| `xt-ai-flavor-diagnosis.md` | AI 味九病总账（含"说书腔旁白"等 P0 项） |
| `xt-late-bond-sample.md` | 另一会话的高好感样板（v5，覆盖 live_a/b/c + epilogue） |
| **`xt-drafts/*.json` + `xt-llm-raw-review.md`** | 约束版 LLM 生成的原始草稿（`xt_director.py` 流水线，**未润色**） |
| `xt-sample-events-v3.md` | 三条示例事件（v3 去 AI 味版，**未合并回 src**） |
| `xt-scenes.md` | 小桃即兴原声（**"人味标尺"**，改稿时往它靠） |

### 引擎代码（9/15 改造，已验证）
`types.ts`（`ChannelEvent` stage/minBond/key、`ChatChoice.kwh`、`Effect.enqueue`、`Choice.next`）·
`engine/channels.ts`（`pickEvent` 三优先级抽签、kwh 闸、`bondRankOf`）·
`engine/effects.ts`（`enqueue`）· `engine/run.ts`（多轮 resolve）· `engine/tags.ts`（`visited:`）·
`rng.ts`（`derivedRng` 移入）· `ui/RadioPanel.tsx`（kwh 禁选）· `scripts/audit-ids.ts`

**验证命令**：`npx tsc --noEmit` · `npm run lint:content` · `npm run audit:ids` ·
`npm run stress:channels -- 40` · `npx tsx .preview/smoke-channel.ts` · `npm run verify`

---

## 三、剩余工作

### ✅ 已完成（2026-09-16 下午）

1. ~~落 `copy` 表~~ → 已落（v6），缺键 124→0。
2. ~~修 `verify` 的 31 条频道用例~~ → 已重写（`onlyXt` 钉抽签），285/0 全绿。
3. ~~`xt_ambush` 的 `minAffinity: 40`~~ → 已删，改轮级分叉；顺带删掉不可达的 `xt_silent`。
4. ~~17 处 `narrate` 冲突~~ → 13 处改成台词 + 加 lint 检查（`xt_dead` 2 条按例外保留）。
5. ~~轮级 bond 分叉 0 处使用~~ → `xt_ambush` 已是首个使用处（`r1`/`r1_low`）。
6. ~~门牌在 `xt_gift` 倒光~~ → 新增 `xt_b_address`（9 轮关键事件），`xt_gift` 改为回指。
7. ~~lint 增补「正文禁旁白」~~ → 已加（只许出现在 `silence` 收尾轮）。
8. ~~规则入档~~ → `content-voice` 第五轮增补 + 自检 2 条。

### ❌ 未完成

**P1 · 事件池量产（唯一的大头）**
- **事件数 29 / 75**（蓝图 `docs/xt-pool.md` 每阶段 ≥25）。六阶段关键事件已各 1 个。
- 本轮（2026-09-16 晚）新增 12 个，**按蓝图 id 命名**：
  `xt_a_table` `xt_a_knock` `xt_b_water` `xt_b_table2` `xt_b_visit` `xt_c_lockdown`
  `xt_c_nightwalk` `xt_c_window` `xt_d_cold` `xt_e_lastcell` `xt_e_outside` `xt_f_rumor`
- **id 命名不一致（要注意）**：现有旧事件用的是自拟 id，与蓝图对不上——
  `xt_ambush`≈蓝图 `xt_c_rescue` · `xt_afraid`≈`xt_a_night` · `xt_power`≈`xt_a_power` ·
  `xt_cat`≈`xt_a_cat` · `xt_routine`≈`xt_b_rice` · `xt_share`≈`xt_a_dad`／`xt_b_dad_call`。
  **新批次一律用蓝图 id**；旧的没改名（改名要动 need/flag/验证，风险大于收益）。
  接手时别把 `xt_ambush` 和 `xt_c_rescue` 当成两件事。
- **蓝图与设定集冲突 1 处**：蓝图 `xt_a_name`（她问你怎么称呼）违反 `xt-bible`
  「绝不问：你叫什么」——**以设定集为准，该事件未做**。
- ⚠️ **`xt_hello` 漏标 `key: true`（已修，2026-09-16）**：蓝图标它是「进组首次抽取必先触发」，
  但内容里一直没标 → 第 9 天的开场试音要跟同阶段普通事件**抽签**决定，可能被别的事件顶掉。
  这类"蓝图上写了、内容里漏了"的字段值得再过一遍（`key` 我已逐事件核过，六阶段各 1 个）。
- 文风基准 = `copy/zh/channels/core_xt.ts`（现行生效版）+ `.preview/xt-late-bond-sample.md`
  + `.preview/xt-scenes.md`（**即兴原声，人味标尺**）。
- 写作前先过两把尺子：`stage`（她问什么）× `bond`（她敢露多少）；
  每句过**替换测试**（把「你」换成"任何人"还成立吗）。

**P1 · ✅ 已修（9/17）：28 个「有台词但没选项」的收尾轮**
- `radio-voices` 第 1 条要求「**每一轮都必须有对话选项**，收尾轮也要给玩家收尾动作，
  不许'她说完就没了'」。实测现有旧事件里有 **28 处**违反，例如
  `xt_hello.r_hi`／`r_quiet` · `xt_recall.r1` · `xt_routine.r_water` · `xt_share.r_honest`／`r_brush` ·
  `xt_ambush.r_open`／`r_callout`／`r_safe`／`r_dawn`／`r_gone` · `xt_live_a.r_ok` · `xt_live_b.r_*` ·
  `xt_live_c.r1` · `xt_epilogue.r1`。
- **9/17 已全部补齐**：每轮补 `close`（收尾动作，+好感、置 `flag:xtReplied`）+ `quiet`。
  实测复查「有台词但无选项的轮」= **0**。
- ⚠️ **副作用（语义变好但用例要跟上）**：事件不再"她说完就没了"，**收尾也要玩家回一句才收场**。
  所以 `doneEvents` 的写入时机推后一轮，3 条旧用例据此更新（现 verify **289 通过 / 0 失败**）。
- 补的时候做的一个判断：`xt_alone`（全程没回过话的空线）原本是"系统强制缺席"，
  现在改成**玩家自己选**——「应一声」vs「还是不回」。**缺席应该是选择，不是惩罚。**

**P1 · 地点层剧情**
- `sig_xt_building` **地点定义已加**（`locations.ts`，解锁链已通）。
  但**上楼之后的"交接剧情"事件还没写**——按蓝图应由 `visited:sig_xt_building` 带出
  （`deriveFacts` 已注入该 fact），内容如"门口垫子底下压着那张频率表实物"。

**P1 · 搜索池回填**
- `channelPool` 目前为空（合法状态）。可搜频道量产后，`RadioPanel` 的搜索按钮
  随 `CHANNEL_POOL.length > 0` 自动恢复，无需改 UI。

**P2 · 长对话尾轮接口**
- 8-10 轮事件的终局/营救分支规则 **等用户提供**，落地在
  `xt_c_rescue` / `xt_f_end` / `xt_f_epilogue`。

**P3 · 收尾**
- `chan-snapshot dump` 重铺基线（现有基线是旧内容的）。
- 用户试玩 → **git 提交**（见下节）。

---

## 三之二、git 提交：唯一需要用户拍板的动作

**为什么没直接提交**：整个工作区是**一个连贯的未提交整体**（9/15 的
「模范线重做 + 事件池框架」改造 + 本轮文案/引擎修复，共 73 个文件）。
`content/channels/core_xt.ts` 依赖 `types.ts` 里未提交的 `stage`/`minBond` 字段——
**只提交一部分会得到一个编译不过的提交**。所以只能是"全提交"或"不提交"。

**但全提交会扫进另一条会话正在进行中的工作**（见第四节），而落盘归属一直没定。
所以我停在这里，把决定权交回。

推荐做法：
1. 先问清另一条会话是否已停手；
2. 若已停手 → 按 handover 原计划拆两笔提交：
   「上午：模范线重做」+「下午：事件池框架 + 文案落盘 + 引擎修复」；
3. 提交只在本机做（**`git push` 必须跳出沙箱跑**，沙箱会拦 Windows 凭据存储）。

---

## 四、协作风险（★本轮踩过，务必先处理）

**今天至少两条会话在同一个项目上改同一批文案文件**，已实测互相覆盖：

| 时间 | 事件 |
|---|---|
| 10:34 | 本会话产出 `xt-copy-v4-draft.ts` |
| **10:52** | **另一会话改写该文件**（写入 v5 内容），但**没更新配套审核稿** → 审核稿与草稿不一致 |
| 10:51 / 17:0x | 另一会话改写 `docs/xt-bible.md` 与共享 skill |
| 两次 | 我的一次 `Edit` 因对方刚改过同一文件而失败 |

**规则**：
- 共享文件（`copy/zh/channels/**`、`content/channels/**`、`xt-copy-v*-draft.ts`、
  `docs/xt-bible.md`、`~/.workbuddy/skills/d17day-channel-copy/SKILL.md`）
  **任一时刻只应有一个写者**。
- **落盘前先确认归属**；落盘后**以文件实际内容为准**，别信任何审核稿的描述
  （今天审核稿就落后过草稿）。
- 已发生的后果：`xt-copy-v4-review.md` 描述的 `xt_epilogue` / `xt_re_liveb_silent` /
  `xt_live_c` 与草稿实际内容不同。**已被 v6 取代，但教训保留。**

---

## 五、给接手者的三条提醒（保留原版）

1. **文案规则冲突时以 `content-voice.md` 为准**（含第五轮增补，priority 最高）。
2. **双真源**：改台词必须**同时**动 `copy/zh/channels/**`（生效）与 `content/channels/**`（fallback）。
   lint 只查键存不存在，**不查两者一致性**。
3. 用户三条红线：不说教不金句 · **低好感也要有活人感**（情绪朝外不朝玩家）· 沉默选项在关键轮是正确行为不是惩罚。

---

## 附：`line.N` 键位契约核对脚本

改文案后**必跑**（比人眼可靠，且能抓出"死键"——写了但 content 不引用、永不渲染的行）：

```js
// .preview/.contract.mjs
import fs from 'fs';
const content = fs.readFileSync('src/game/content/channels/core_xt.ts', 'utf8');
const draft = fs.readFileSync('.preview/xt-copy-v6-draft.ts', 'utf8');
const need = new Map();
for (const m of content.matchAll(/channels\.xt\.(xt_[a-z0-9_]+)\.line\.(\d+)/g)) {
  if (!need.has(m[1])) need.set(m[1], new Set());
  need.get(m[1]).add(+m[2]);
}
const have = new Map();
for (const m of draft.matchAll(/^    (xt_[a-z0-9_]+):\s*\{/gm)) {
  let d = 0, i = draft.indexOf('{', m.index), s = i;
  for (; i < draft.length; i++) { if (draft[i] === '{') d++; else if (draft[i] === '}') { d--; if (d === 0) break; } }
  const lm = draft.slice(s, i + 1).match(/line:\s*\{([\s\S]*?)\n      \}/);
  if (lm) have.set(m[1], new Set([...lm[1].matchAll(/'(\d+)':/g)].map((x) => +x[1])));
}
let bad = 0;
for (const [n, nd] of need) {
  const hv = have.get(n);
  if (!hv) { console.log('❌ 缺整块:', n); bad++; continue; }
  for (const k of nd) if (!hv.has(k)) { console.log(`❌ ${n}.line.${k} 缺`); bad++; }
  for (const k of hv) if (!nd.has(k)) { console.log(`⚠ ${n}.line.${k} 死键`); bad++; }
}
console.log(bad === 0 ? '✅ 键位契约一致' : `共 ${bad} 处不一致`);
```
