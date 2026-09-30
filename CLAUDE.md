# 项目约定 · 七日之前 / D_17day

## 改文案：动手前必须先读规则

**凡涉及玩家可见中文的增删改，先整篇读 [`docs/content-voice.md`](docs/content-voice.md)。**

范围：`title` / `body` / `label` / `log` / `desc` / `reason`，以及情报、系统说明、结局文案、事件日志——**新增一句或改一句都算**。
那份文档是这个项目唯一的声音真源（四条原则、禁止表、第二轮·第三轮增补、推荐写法、自检清单），也收录了「AI 味」的机器可查版本。**不要发明第二套嗓音。**

### 两个真源都要改

- **生效的是 `src/game/copy/zh/**`** —— `copy/hydrate.ts` 的 `pickCopy` **优先查文案表**；
- `src/game/content/**` 里 `ch(..., { label })` 与 `effect.log` 的内联文字只是兜底；
- 另有大量**不在文案表里的内联中文串**散落在 `src/game/engine/todos.ts`、`src/game/balance.ts`、`src/game/content/*.ts`（事件的 `reason`）等处，改完用 grep 扫一遍；
- `npm run lint:content` **只查文案键存不存在，不查两边是否一致**。

### 收工前

```bash
npm run lint:content
npx tsc --noEmit
```

想确认实际渲染出来的是哪一版，用 `hydrateFamilies()` 把 `title` / `body` / `label` / `log` 打一遍（`body` 按 `\n` 分段）。

## 其它

- 只改文案时不要顺手动 `id` / 数值 / `effect` / `flags` / `requires` / `schedule`——那些不是文案。
- 内容校验、模拟、平衡基线的用法见 `README.md`；美术与场景约定、handover 见 `docs/` 与 `HANDOVER-*.md`。

## 查表一律走 `src/game/content/lookup.ts`

`CONDITION_BY_ID` / `MODULE_BY_ID` / `SITE_BY_ID` / `DISASTER_BY_ID` 的类型都是 `Record<Id, Def>`
（**全量**），`BY_ID[k].name` 在 TS 眼里永远安全。但键有两类来源，第二类没人管：

- 内容里写死的 id → `npm run audit:ids` 静态查，写错当场报；
- **存档里躺着的字符串** → 内容侧改动之后旧档会留下查不到的 id。引擎不在乎
  （`run.conditions` 就是一串字符串，照跑），错一直等到 UI 渲染期取 `.name` 才炸，
  而那时 React 会卸掉整棵树 = **白屏**。

所以凡是用「存档里的 id」下标查表，一律用 `lookup.ts` 的 `conditionDef / conditionName /
moduleDef / moduleName / siteOf / disasterOf / channelDefOf`：查不到回落成 id 原文并打一条
只出现一次的警告。**不要在 UI 或引擎里新写 `XXX_BY_ID[y]!.name`。**

新增一个可能被写进存档的 id 时，顺手在 `scripts/audit-ids.ts` 里加一条对照。

## 崩溃兜底

- 渲染期抛错由 `src/ui/ErrorBoundary.tsx` 接住，换成一张**可复制**的报告；点击回调 /
  异步里的异常走 `window` 的 `error` / `unhandledrejection`，汇到同一个面板。
- 每次玩家动作都经 `store.ts` 的 `withSession`（或 `guarded`）：抛错不吞，记一笔最近操作、
  弹一条 toast、报给面板，**并且不 `set`**（存档保持原样）。
- 加新动作入口时用这两个包装之一，不要直接 `structuredClone(run)` 后裸调引擎。
- 频道那一路 `npm run sim` 覆盖不到（人格策略不碰收音机），改频道内容后要另跑
  `npm run stress:channels -- 40`。

## 频道事件的两种锚：日历优先

`ChannelEvent` 只有两种到场方式——`at`（绝对日）与 `afterDays`（距 `lastContactDay`）。
引擎扫事件时**先扫全部 `at`，再扫 `afterDays` 与无锚**（`tickChannels` 空闲分支里的两趟）。

这不是排序洁癖，是个踩过的坑：`xt_alone` 用 `afterDays: 1` 却排在事件表第 2 位，
而 `lastContactDay` 会被**任何**一条事件收场刷新，于是它从第 10 天起天天"到点"；
按声明顺序扫的话，它会把后面所有 `at` 事件的日子一天一天吃光——玩家在收音机里永远等不到
小桃的求救，整条主线停摆。**写内容时不要在相对锚上承担"早到早投"的期望。**

无锚事件（两种锚都没有）只能被 `elseEvent` 带出来，否则永远排不上队——`npm run audit:ids` 会挡下。

## 测试里不要手写事件 id 清单

`scripts/verify.ts` 的频道用例用 `doneBefore(频道, 第几天)` 从事件表**派生**"这一天之前该走完的事件"。
以前是手写数组（`MAIN` / `PRIOR` / `CV_MAIN`），内容里插一条新事件它就静默腐坏：漏掉的那条
会成为"已到点但没完成"的事件，把用例要测的那一天整个吃掉——症状是几十条断言集体翻车，
而报出来全是 `active=undefined`，看着像引擎坏了。**事件表是唯一真源，别抄。**
