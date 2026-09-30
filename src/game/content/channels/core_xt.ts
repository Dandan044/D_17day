import type { ChannelDef } from '../../types';

/**
 * 她没了的那个结局。`xt_reconnect` 与 `xt_ambush` 各有一份 `r_dead` 轮，
 * 共用这一份文案——新模型里一轮只属于一个事件，但文案键可以共享。
 */
const DEAD_LINES = [
  { from: 'peer' as const, sys: 'narrate' as const, text: 'channels.xt.xt_dead.line.1', onRead: { stats: { sanity: -14 }, tone: 'grim' as const } },
  { from: 'peer' as const, sys: 'narrate' as const, text: 'channels.xt.xt_dead.line.2' },
  { from: 'peer' as const, sys: 'silent' as const, text: 'channels.xt.sys.lost' },
];

/**
 * 核心频道 · 小桃（**模范线**）。
 *
 * 隔壁楼 19 岁女生，一个人在家。这条线不提供任何解法，只提供一个人。
 * 隐性设定与标杆条款见 docs/radio-voices.md——后续频道照这套写。
 *
 * ## 标杆条款（全部事件已按此执行）
 * 1. 一个事件 = 一件事：有开场、有玩家的位置、有后果落地。没有纯播报事件。
 * 2. 事件属于「阶段 × 好感」的池子：`stage`（threat 区间）+ `minBond`（表露下限）
 *    决定今天谁到场。**沉默也是内容**（池空 = 今天这一头没有消息）。
 * 3. 每个含选项轮固定三件套：一个行动（代价写进 note）+ 一个软回应（发射·会被测向）
 *    + 一个「什么都不回应」（不发射；数值暗扣保留，由本线既定设计决定）。
 * 4. **生死由玩家行为链决定**（出门/陪跑/不理），**不由暗数值决定**。
 *    求救类事件**严禁**挂 `minAffinity` 当死亡门槛——她**永远会呼救**（人在快死时都会喊），
 *    好感只决定她**怎么喊**（轮级分叉：`round.minAffinity` + `elseRound`）。
 * 5. **正文只有对话行**（2026-09-15 收紧）。玩家的动作、场景、她那头的动静都不进文案——
 *    只有电台里能听见的**她的话**。唯一例外是"她不在场"的系统呈现（`sys:'silent'` 收场），
 *    那不是旁白、是收场标记。
 * 6. flag 只写有下游消费者的：`flag:xtReplied`（缺席判定）、`flag:xtAlive`（存活线）。
 *
 * ## 结构
 * 每个事件 = 开场 + 若干轮 + 明确结局。**没有 `choices` 的轮就是最后一轮**。
 * 轮与轮之间即时——"她过了几天才回"写在该轮的 `delayDays`。
 *
 * ## 两把尺子（写任何一句台词前先过这两问）
 * - **threat 阶段** → 世界多坏、她**问什么**（"有人吗"→"还有吗"→"门结实吗"→"走不走"）
 * - **bond 好感** → 她**敢露多少**（一级情绪全线都在；二级表露才受好感控制）
 *   判据（替换测试）：把「你」换成"任何人"仍成立＝生活情绪，低好感也必须写；
 *   不成立＝对玩家的表露，只有 bond 3+ 才能有。
 *
 * 关键节点：
 *   9   试音（等你先开口）   11  电（她的招牌问句）   13  猫      16  稠粥
 *   18  交心（只说一半）     23  断粮求助             25  回礼+门牌伏笔
 *   26  离线回归（全程没回过时）  27  撤回拍           29  夜里害怕
 *   32  求救（**不设好感门槛**；bond 只决定她怎么喊：报告情况 / 直接要你。
 *       两条生路：出门救 / 电波陪跑。死路只有一个来源：你不在）
 *   36+ 存活线（她活着才有的日常，语言随阶段变化）
 */
export const CORE_XT: ChannelDef = {
  id: 'xt',
  kind: 'person',
  name: 'channels.xt.name',
  short: '桃',
  tagline: 'channels.xt.tagline',
  discover: 'auto',
  discoverDay: 9,
  replyWindowDays: 3,
  core: true,
  events: [
    // ---------- 第 9 天：试音。她喊出去，等你应 ----------
    // 开场只有喊话，没有自我介绍——对空频道报名字是留言，不是喊话。
    // 她确认有人之后才敢自报家门（r_hi），你不应她就说明天再喊（r_quiet）。
    // ★ key（2026-09-16 补）：蓝图标它是「进组首次抽取必先触发」，但内容里一直漏标
    //   ——结果第 9 天要跟同阶段的普通事件抽签，开场试音可能被别的事件顶掉。
    {
      id: 'xt_hello',
      stage: [1, 1],
      key: true,
      kind: 'open',
      opening: [
        { from: 'peer', text: 'channels.xt.xt_hello.line.1' },
        { from: 'peer', text: 'channels.xt.xt_hello.line.2' },
        { from: 'peer', text: 'channels.xt.xt_hello.line.3' },
      ],
      // 等你先开口。「有人吗」是喊给空频道的，回不回在你。
      // 一直不回 → 按 replyWindowDays 超时收场；xt_alone 正是为这条路写的。
      awaitPlayerOpen: true,
      openChoices: [
        {
          id: 'hi',
          label: 'channels.xt.xt_hello.choice.hi.label',
          note: 'channels.xt.xt_hello.choice.hi.note',
          say: 'channels.xt.xt_hello.choice.hi.say',
          affinity: 4,
          effect: { setFlags: ['flag:xtReplied'] },
          next: 'r_hi',
        },
        {
          id: 'shh',
          label: 'channels.xt.xt_hello.choice.shh.label',
          note: 'channels.xt.xt_hello.choice.shh.note',
          affinity: -2,
          next: 'r_quiet',
        },
      ],
      first: 'r_hi',
      rounds: [
        {
          id: 'r_hi',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_hello_hi.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_hello_hi.line.2' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_hello_hi.choice.close.label',
              note: 'channels.xt.xt_re_hello_hi.choice.close.note',
              say: 'channels.xt.xt_re_hello_hi.choice.close.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_hello_hi.choice.quiet.label',
              note: 'channels.xt.xt_re_hello_hi.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r_quiet',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_hello_quiet.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_hello_quiet.line.2' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_hello_quiet.choice.close.label',
              note: 'channels.xt.xt_re_hello_quiet.choice.close.note',
              say: 'channels.xt.xt_re_hello_quiet.choice.close.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_hello_quiet.choice.quiet.label',
              note: 'channels.xt.xt_re_hello_quiet.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 空线回归：全程没回过话，她一个人把话说下去（afterDays 锚） ----------
    // 这一版的她补上了第一天没说成的自报家门——对空频道，她只能一直喊。
    {
      id: 'xt_alone',
      // 【临时】原 afterDays:1 锚已废除——全程没回话时她隔几天再来一次的语义
      // 由 require（没回过话）保持；归属恐慌期-匮乏期池。
      stage: [1, 2],
      need: ['xt_hello'],
      require: { none: ['flag:xtReplied'] },
      kind: 'daily',
      opening: [
        { from: 'peer', text: 'channels.xt.xt_alone.line.1' },
        { from: 'peer', text: 'channels.xt.xt_alone.line.2' },
        { from: 'peer', text: 'channels.xt.xt_alone.line.3' },
      ],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          delayDays: 2,
          out: [
            { from: 'peer', text: 'channels.xt.xt_alone.r1.1' },
            { from: 'peer', text: 'channels.xt.xt_alone.r1.2', onRead: { stats: { sanity: -2 }, tone: 'grim' } },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_alone.choice.close.label',
              note: 'channels.xt.xt_alone.choice.close.note',
              say: 'channels.xt.xt_alone.choice.close.say',
              affinity: 4,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_alone.choice.quiet.label',
              note: 'channels.xt.xt_alone.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 第 11 天：电。「你那还有电吗」其实是问你在不在 ----------
    {
      id: 'xt_power',
      stage: [1, 1],
      need: ['xt_hello'],
      kind: 'daily',
      opening: [
        { from: 'peer', text: 'channels.xt.xt_power.line.1' },
        { from: 'peer', text: 'channels.xt.xt_power.line.2' },
      ],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [],
          choices: [
            {
              id: 'honest',
              label: 'channels.xt.xt_power.choice.honest.label',
              note: 'channels.xt.xt_power.choice.honest.note',
              say: 'channels.xt.xt_power.choice.honest.say',
              affinity: 6,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r_honest',
            },
            {
              id: 'lie',
              label: 'channels.xt.xt_power.choice.lie.label',
              note: 'channels.xt.xt_power.choice.lie.note',
              say: 'channels.xt.xt_power.choice.lie.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r_lie',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_power.choice.quiet.label',
              note: 'channels.xt.xt_power.choice.quiet.note',
              affinity: -4,
            },
          ],
        },
        {
          id: 'r_honest',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_power_honest.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_power_honest.line.2' },
          ],
          choices: [
            {
              id: 'teach',
              label: 'channels.xt.xt_power.choice.teach.label',
              note: 'channels.xt.xt_power.choice.teach.note',
              say: 'channels.xt.xt_power.choice.teach.say',
              affinity: 4,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
              next: 'r_teach',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_power.choice.quiet.label',
              note: 'channels.xt.xt_power.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r_teach',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_power_teach.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_power_teach.line.2', onRead: { stats: { sanity: 2 }, tone: 'good' } },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_power_teach.choice.close.label',
              note: 'channels.xt.xt_re_power_teach.choice.close.note',
              say: 'channels.xt.xt_re_power_teach.choice.close.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_power_teach.choice.quiet.label',
              note: 'channels.xt.xt_re_power_teach.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          // 她信了。这句谎不会当场被戳穿。
          id: 'r_lie',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_power_lie.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_power_lie.line.2' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_power_lie.choice.close.label',
              note: 'channels.xt.xt_re_power_lie.choice.close.note',
              say: 'channels.xt.xt_re_power_lie.choice.close.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_power_lie.choice.quiet.label',
              note: 'channels.xt.xt_re_power_lie.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 第 13 天：猫。试探的第一步 ----------
    {
      id: 'xt_cat',
      stage: [1, 1],
      need: ['xt_hello'],
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_cat.line.1' },
            { from: 'peer', text: 'channels.xt.xt_cat.line.2', onRead: { stats: { sanity: 2 }, tone: 'neutral' } },
          ],
          choices: [
            {
              id: 'chat',
              label: 'channels.xt.xt_cat.choice.chat.label',
              note: 'channels.xt.xt_cat.choice.chat.note',
              say: 'channels.xt.xt_cat.choice.chat.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r_cat',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_cat.choice.quiet.label',
              note: 'channels.xt.xt_cat.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          // 聊了猫的人，两天后才知道它的来历——她的家事从不抢着说
          id: 'r_cat',
          delayDays: 2,
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_cat.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_cat.line.2' },
            { from: 'peer', text: 'channels.xt.xt_re_cat.line.3', onRead: { stats: { sanity: 2 }, tone: 'neutral' } },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_cat.choice.close.label',
              note: 'channels.xt.xt_re_cat.choice.close.note',
              say: 'channels.xt.xt_re_cat.choice.close.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_cat.choice.quiet.label',
              note: 'channels.xt.xt_re_cat.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 第 16 天：稠粥。她的生存状态第一次摊开给你看 ----------
    {
      id: 'xt_routine',
      stage: [2, 2],
      need: ['xt_hello'],
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_routine.line.1' },
            { from: 'peer', text: 'channels.xt.xt_routine.line.2', onRead: { stats: { sanity: 2 }, tone: 'neutral' } },
          ],
          choices: [
            {
              id: 'chat',
              label: 'channels.xt.xt_routine.choice.chat.label',
              note: 'channels.xt.xt_routine.choice.chat.note',
              say: 'channels.xt.xt_routine.choice.chat.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r_water',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_routine.choice.quiet.label',
              note: 'channels.xt.xt_routine.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r_water',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_routine_water.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_routine_water.line.2' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_routine_water.choice.close.label',
              note: 'channels.xt.xt_re_routine_water.choice.close.note',
              say: 'channels.xt.xt_re_routine_water.choice.close.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_routine_water.choice.quiet.label',
              note: 'channels.xt.xt_re_routine_water.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 第 18 天：交心。她只说一半，玩家只认一半 ----------
    // 旧的写法替玩家掏了隐私（"我妈的骨灰还在柜子里"）——删。
    // 玩家能给的只有半句实话（"没人拦我，自己没走"），她的回应把这半句接住。
    {
      id: 'xt_share',
      stage: [2, 2],
      need: ['xt_hello'],
      kind: 'request',
      opening: [
        { from: 'peer', text: 'channels.xt.xt_share.line.1' },
        { from: 'peer', text: 'channels.xt.xt_share.line.2' },
        { from: 'peer', text: 'channels.xt.xt_share.line.3' },
      ],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [],
          choices: [
            {
              id: 'honest',
              label: 'channels.xt.xt_share.choice.honest.label',
              note: 'channels.xt.xt_share.choice.honest.note',
              say: 'channels.xt.xt_share.choice.honest.say',
              affinity: 6,
              effect: { stats: { sanity: 3 }, setFlags: ['flag:xtReplied'], tone: 'good' },
              next: 'r_honest',
            },
            {
              id: 'brush',
              label: 'channels.xt.xt_share.choice.brush.label',
              note: 'channels.xt.xt_share.choice.brush.note',
              say: 'channels.xt.xt_share.choice.brush.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r_brush',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_share.choice.quiet.label',
              note: 'channels.xt.xt_share.choice.quiet.note',
              affinity: -6,
            },
          ],
        },
        {
          id: 'r_honest',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_share_honest.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_share_honest.line.2' },
            { from: 'peer', text: 'channels.xt.xt_re_share_honest.line.3', onRead: { stats: { sanity: 3 }, tone: 'good' } },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_share_honest.choice.close.label',
              note: 'channels.xt.xt_re_share_honest.choice.close.note',
              say: 'channels.xt.xt_re_share_honest.choice.close.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_share_honest.choice.quiet.label',
              note: 'channels.xt.xt_re_share_honest.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r_brush',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_share_brush.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_share_brush.line.2' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_share_brush.choice.close.label',
              note: 'channels.xt.xt_re_share_brush.choice.close.note',
              say: 'channels.xt.xt_re_share_brush.choice.close.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_share_brush.choice.quiet.label',
              note: 'channels.xt.xt_re_share_brush.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 匮乏期关键事件：频率表背面那个数（进组必先触发） ----------
    // 门牌/营救主链的脊柱：把家里的门牌交出去，是全线最大的一次信任交付。
    // 节奏：画表 → 把东西往小说 → 正面好念、背面卡住 → 数终于给出去
    //       → 用窗景找补（怕你找不到）→ 最后漏出"妈不知道"。
    // 尾轮的选项是**后果落地处**（解锁一次性地点 + setFlags），不是评分。
    {
      id: 'xt_b_address',
      stage: [2, 2],
      key: true,
      minBond: 2,
      kind: 'crisis',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_address.line.1' },
            { from: 'peer', text: 'channels.xt.xt_b_address.line.2' },
          ],
          choices: [
            {
              id: 'offer',
              label: 'channels.xt.xt_b_address.choice.offer.label',
              note: 'channels.xt.xt_b_address.choice.offer.note',
              say: 'channels.xt.xt_b_address.choice.offer.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_address.choice.quiet.label',
              note: 'channels.xt.xt_b_address.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          // 把东西往小说：纸不值钱，你才好收
          id: 'r2',
          out: [{ from: 'peer', text: 'channels.xt.xt_b_address.line.3' }],
          choices: [
            {
              id: 'take',
              label: 'channels.xt.xt_b_address.choice.take.label',
              note: 'channels.xt.xt_b_address.choice.take.note',
              say: 'channels.xt.xt_b_address.choice.take.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_address.choice.quiet.label',
              note: 'channels.xt.xt_b_address.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [{ from: 'peer', text: 'channels.xt.xt_b_address.line.4' }],
          choices: [
            {
              id: 'ready',
              label: 'channels.xt.xt_b_address.choice.ready.label',
              note: 'channels.xt.xt_b_address.choice.ready.note',
              say: 'channels.xt.xt_b_address.choice.ready.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_address.choice.quiet.label',
              note: 'channels.xt.xt_b_address.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          // 正面好念，背面卡住。她停在这半句上。
          id: 'r4',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_address.line.5' },
            { from: 'peer', text: 'channels.xt.xt_b_address.line.6' },
          ],
          choices: [
            {
              id: 'wait',
              label: 'channels.xt.xt_b_address.choice.wait.label',
              note: 'channels.xt.xt_b_address.choice.wait.note',
              affinity: 2,
              next: 'r5',
            },
            {
              id: 'push',
              label: 'channels.xt.xt_b_address.choice.push.label',
              note: 'channels.xt.xt_b_address.choice.push.note',
              say: 'channels.xt.xt_b_address.choice.push.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r5',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_address.choice.quiet.label',
              note: 'channels.xt.xt_b_address.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          // 只发得出这半句：是哪一家、哪个门，全咽回去。空格变密＝她在撑。
          id: 'r5',
          out: [{ from: 'peer', text: 'channels.xt.xt_b_address.line.7' }],
          choices: [
            {
              id: 'wait',
              label: 'channels.xt.xt_b_address.choice.wait.label',
              note: 'channels.xt.xt_b_address.choice.wait.note',
              affinity: 2,
              next: 'r6',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_address.choice.quiet.label',
              note: 'channels.xt.xt_b_address.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          // 数给出来。一个字一个字的，像念刻度。
          id: 'r6',
          out: [{ from: 'peer', text: 'channels.xt.xt_b_address.line.8' }],
          choices: [
            {
              id: 'remember',
              label: 'channels.xt.xt_b_address.choice.remember.label',
              note: 'channels.xt.xt_b_address.choice.remember.note',
              say: 'channels.xt.xt_b_address.choice.remember.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r7',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_address.choice.quiet.label',
              note: 'channels.xt.xt_b_address.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          // 怕他找不到，就用他那扇窗的视角指给他。那栋楼她天天看，早数熟了。
          id: 'r7',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_address.line.9' },
            { from: 'peer', text: 'channels.xt.xt_b_address.line.10' },
          ],
          choices: [
            {
              id: 'seen',
              label: 'channels.xt.xt_b_address.choice.seen.label',
              note: 'channels.xt.xt_b_address.choice.seen.note',
              say: 'channels.xt.xt_b_address.choice.seen.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r8',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_address.choice.quiet.label',
              note: 'channels.xt.xt_b_address.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          // 找补立刻跟上：不是让你来，就是万一。需求还是漏了半截。
          id: 'r8',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_address.line.11' },
            { from: 'peer', text: 'channels.xt.xt_b_address.line.12' },
          ],
          choices: [
            {
              id: 'promise',
              label: 'channels.xt.xt_b_address.choice.promise.label',
              note: 'channels.xt.xt_b_address.choice.promise.note',
              say: 'channels.xt.xt_b_address.choice.promise.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r9',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_address.choice.quiet.label',
              note: 'channels.xt.xt_b_address.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          // 尾轮：后果在这里落地——得知门牌（flag）+ 放出那个楼道的坐标（一次性地点）。
          // 她藏着的那句话（妈不知道）也在这时漏出来；说完照常收尾，像什么都没发生。
          id: 'r9',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_address.line.13' },
            { from: 'peer', text: 'channels.xt.xt_b_address.line.14' },
            { from: 'peer', text: 'channels.xt.xt_b_address.line.15' },
          ],
          choices: [
            {
              id: 'goodnight',
              label: 'channels.xt.xt_b_address.choice.goodnight.label',
              note: 'channels.xt.xt_b_address.choice.goodnight.note',
              say: 'channels.xt.xt_b_address.choice.goodnight.say',
              affinity: 2,
              effect: {
                stats: { sanity: 2 },
                setFlags: ['flag:xtKnowsAddress'],
                locations: [{ id: 'sig_xt_building', stock: 40 }],
                tone: 'good',
              },
            },
            {
              id: 'off',
              label: 'channels.xt.xt_b_address.choice.off.label',
              note: 'channels.xt.xt_b_address.choice.off.note',
              affinity: 1,
              effect: {
                setFlags: ['flag:xtKnowsAddress'],
                locations: [{ id: 'sig_xt_building', stock: 40 }],
              },
            },
          ],
        },
      ],
    },

    // ---------- 第 23 天：开口要东西。她要得越具体，拒绝越难看 ----------
    {
      id: 'xt_request',
      stage: [3, 3],
      need: ['xt_share'],
      kind: 'request',
      opening: [
        { from: 'peer', text: 'channels.xt.xt_request.line.1' },
        { from: 'peer', text: 'channels.xt.xt_request.line.2' },
      ],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [],
          choices: [
            {
              id: 'give',
              label: 'channels.xt.xt_request.choice.give.label',
              note: 'channels.xt.xt_request.choice.give.note',
              say: 'channels.xt.xt_request.choice.give.say',
              requires: { res: { foodStaple: 3 } },
              affinity: 15,
              effect: {
                res: { foodStaple: -3 },
                stats: { humanity: 3 },
                tone: 'good',
              },
              next: 'r_give',
            },
            {
              id: 'refuse',
              label: 'channels.xt.xt_request.choice.refuse.label',
              note: 'channels.xt.xt_request.choice.refuse.note',
              say: 'channels.xt.xt_request.choice.refuse.say',
              affinity: -10,
              effect: { stats: { sanity: -4 }, tone: 'bad' },
              next: 'r_refuse',
            },
            {
              id: 'mute',
              label: 'channels.xt.xt_request.choice.mute.label',
              note: 'channels.xt.xt_request.choice.mute.note',
              affinity: -6,
              effect: { stats: { sanity: -3 }, tone: 'grim' },
              // 装没收到：她会再问一次，然后自己把话收回去
              next: 'r_mute',
            },
          ],
        },
        {
          id: 'r_give',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_req_give.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_req_give.line.2' },
          ],
          choices: [
            {
              id: 'wait',
              label: 'channels.xt.xt_request.choice.r2.wait.label',
              note: 'channels.xt.xt_request.choice.r2.wait.note',
              say: 'channels.xt.xt_request.choice.r2.wait.say',
              affinity: 4,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r_give2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_request.choice.r2.quiet.label',
              note: 'channels.xt.xt_request.choice.r2.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r_give2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_req_give2.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_req_give2.line.2' },
            { from: 'peer', text: 'channels.xt.xt_re_req_give2.line.3', onRead: { stats: { sanity: 2 }, tone: 'good' } },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_req_give2.choice.close.label',
              note: 'channels.xt.xt_re_req_give2.choice.close.note',
              say: 'channels.xt.xt_re_req_give2.choice.close.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_req_give2.choice.quiet.label',
              note: 'channels.xt.xt_re_req_give2.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r_refuse',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_req_refuse.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_req_refuse.line.2' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_req_refuse.choice.close.label',
              note: 'channels.xt.xt_re_req_refuse.choice.close.note',
              say: 'channels.xt.xt_re_req_refuse.choice.close.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_req_refuse.choice.quiet.label',
              note: 'channels.xt.xt_re_req_refuse.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r_mute',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_req_mute.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_req_mute.line.2' },
            { from: 'peer', text: 'channels.xt.xt_re_req_mute.line.3' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_req_mute.choice.close.label',
              note: 'channels.xt.xt_re_req_mute.choice.close.note',
              say: 'channels.xt.xt_re_req_mute.choice.close.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_req_mute.choice.quiet.label',
              note: 'channels.xt.xt_re_req_mute.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 第 25 天：回礼。电池、频率表，和背面那个数 ----------
    // 「背面有个数」是第 32 天求救的行为门槛伏笔：她只给说得上那句话的人开门。
    {
      id: 'xt_gift',
      stage: [3, 3],
      need: ['xt_request'],
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_gift.line.1' },
            { from: 'peer', text: 'channels.xt.xt_gift.line.2', onRead: { stats: { sanity: 3 }, tone: 'good' } },
            { from: 'peer', text: 'channels.xt.xt_gift.line.3' },
          ],
          choices: [
            {
              id: 'thanks',
              label: 'channels.xt.xt_gift.choice.thanks.label',
              note: 'channels.xt.xt_gift.choice.thanks.note',
              say: 'channels.xt.xt_gift.choice.thanks.say',
              affinity: 4,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r_thanks',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_gift.choice.quiet.label',
              note: 'channels.xt.xt_gift.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r_thanks',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_gift_thanks.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_gift_thanks.line.2' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_gift_thanks.choice.close.label',
              note: 'channels.xt.xt_re_gift_thanks.choice.close.note',
              say: 'channels.xt.xt_re_gift_thanks.choice.close.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_gift_thanks.choice.quiet.label',
              note: 'channels.xt.xt_re_gift_thanks.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 第 26 天：离线回归（只在全程没回过话时出现——她一个人把话说了下去） ----------
    {
      id: 'xt_reconnect',
      stage: [3, 3],
      need: ['xt_gift'],
      require: { none: ['flag:xtReplied'] },
      kind: 'request',
      opening: [
        { from: 'peer', text: 'channels.xt.xt_reconnect.line.1' },
        { from: 'peer', text: 'channels.xt.xt_reconnect.line.2' },
        { from: 'peer', text: 'channels.xt.xt_reconnect.line.3' },
      ],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [],
          choices: [
            {
              id: 'explain',
              label: 'channels.xt.xt_reconnect.choice.explain.label',
              note: 'channels.xt.xt_reconnect.choice.explain.note',
              say: 'channels.xt.xt_reconnect.choice.explain.say',
              affinity: 6,
              effect: { setFlags: ['flag:xtReplied'], stats: { sanity: 2 }, tone: 'good' },
              next: 'r_ok',
            },
            {
              id: 'nothing',
              label: 'channels.xt.xt_reconnect.choice.nothing.label',
              note: 'channels.xt.xt_reconnect.choice.nothing.note',
              affinity: -12,
              next: 'r_dead',
            },
          ],
        },
        {
          id: 'r_ok',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_reconnect_ok.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_reconnect_ok.line.2' },
            { from: 'peer', text: 'channels.xt.xt_re_reconnect_ok.line.3' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_reconnect_ok.choice.close.label',
              note: 'channels.xt.xt_re_reconnect_ok.choice.close.note',
              say: 'channels.xt.xt_re_reconnect_ok.choice.close.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_reconnect_ok.choice.quiet.label',
              note: 'channels.xt.xt_re_reconnect_ok.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        { id: 'r_dead', silence: true, out: DEAD_LINES },
      ],
    },

    // ---------- 第 27 天：撤回拍。她有话，没说出口 ----------
    // 下午那几下只有半个字长的信号——她按了说话，又松开了。
    {
      id: 'xt_recall',
      stage: [3, 3],
      need: ['xt_gift'],
      require: { any: ['flag:xtReplied'] },
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_recall.line.1' },
            { from: 'peer', text: 'channels.xt.xt_recall.line.2' },
            { from: 'peer', text: 'channels.xt.xt_recall.line.3' },
            { from: 'peer', text: 'channels.xt.xt_recall.line.4', onRead: { stats: { sanity: 2 }, tone: 'neutral' } },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_recall.choice.close.label',
              note: 'channels.xt.xt_recall.choice.close.note',
              say: 'channels.xt.xt_recall.choice.close.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_recall.choice.quiet.label',
              note: 'channels.xt.xt_recall.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 第 29 天：夜里害怕 ----------
    {
      id: 'xt_afraid',
      stage: [4, 4],
      need: ['xt_gift'],
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_afraid.line.1' },
            { from: 'peer', text: 'channels.xt.xt_afraid.line.2' },
            { from: 'peer', text: 'channels.xt.xt_afraid.line.3', onRead: { stats: { sanity: 2 }, tone: 'neutral' } },
          ],
          choices: [
            {
              id: 'stay',
              label: 'channels.xt.xt_afraid.choice.stay.label',
              note: 'channels.xt.xt_afraid.choice.stay.note',
              say: 'channels.xt.xt_afraid.choice.stay.say',
              affinity: 4,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r_stay',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_afraid.choice.quiet.label',
              note: 'channels.xt.xt_afraid.choice.quiet.note',
              affinity: -4,
            },
          ],
        },
        {
          id: 'r_stay',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_afraid_stay.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_afraid_stay.line.2', onRead: { stats: { sanity: 2 }, tone: 'good' } },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_afraid_stay.choice.close.label',
              note: 'channels.xt.xt_re_afraid_stay.choice.close.note',
              say: 'channels.xt.xt_re_afraid_stay.choice.close.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_afraid_stay.choice.quiet.label',
              note: 'channels.xt.xt_re_afraid_stay.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 第 32 天：求救。两条生路，一条死路，全在玩家手上 ----------
    // ★ 不挂 minAffinity（2026-09-16 修）。好感**不得**决定生死——radio-voices 第 5 条：
    //   「生死由行为链决定，不由暗数值决定」。她**永远会求救**（人在快死时都会喊，
    //   与熟不熟无关）；bond 只决定她**怎么喊**（见下面的轮级分叉）：
    //     bond 3-4（≥45）→ 喊得乱，直接要你（r1）
    //     bond 1-2（<45） → 报告情况，不要求你做什么（r1_low）
    //   存活只看玩家行为：出门救 / 电波陪跑 / 不理。
    // 生路一「出门救」：到楼下、上楼、门牌那句话。生路二「电波陪跑」：人过不去，
    // 声音过得去。死路只有一个来源：你不在。
    {
      id: 'xt_ambush',
      stage: [4, 4],
      need: ['xt_share'],
      kind: 'crisis',
      // 开场只有那句喊话，两档共用（开场不归轮级门槛管）。
      opening: [
        { from: 'peer', text: 'channels.xt.xt_ambush.line.1' },
      ],
      first: 'r1',
      rounds: [
        {
          // bond 3-4：她直接开口要人。乱的是秩序，不是音量。
          // 轮级分叉：minAffinity 不达标即走 elseRound；两条支线的 choices 完全一致，
          // 所以无论走哪条，后续轮都是同一组（r_go / r_talk / r_dead），在 r1 之后汇合。
          id: 'r1',
          minAffinity: 45,
          elseRound: 'r1_low',
          out: [
            { from: 'peer', text: 'channels.xt.xt_ambush.line.2' },
            { from: 'peer', text: 'channels.xt.xt_ambush.line.3' },
          ],
          choices: [
            {
              id: 'go',
              label: 'channels.xt.xt_ambush.choice.go.label',
              note: 'channels.xt.xt_ambush.choice.go.note',
              // 门槛原因用通用文案（checkRequirement 对 ap/res 一律给通用提示）
              requires: { ap: 2 },
              say: 'channels.xt.xt_ambush.choice.go.say',
              affinity: 10,
              effect: {
                ap: -2,
                stats: { stamina: -12, sanity: -4 },
                world: { exposure: 8 },
                tone: 'grim',
              },
              next: 'r_go',
            },
            {
              id: 'talk',
              label: 'channels.xt.xt_ambush.choice.talk.label',
              note: 'channels.xt.xt_ambush.choice.talk.note',
              say: 'channels.xt.xt_ambush.choice.talk.say',
              affinity: 4,
              next: 'r_talk',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_ambush.choice.quiet.label',
              note: 'channels.xt.xt_ambush.choice.quiet.note',
              affinity: -10,
              effect: { stats: { sanity: -3 }, tone: 'grim' },
              next: 'r_dead',
            },
          ],
        },
        {
          // bond 1-2：同样是求救，但她喊得像**报告情况**——报手上的活、报自己的处境，
          // 不要求你做什么（宁可要不到也不肯开口）。选项与 r1 完全相同、好感增减也一致：
          // 差别只在她怎么说，不在她能拿到什么。
          id: 'r1_low',
          out: [
            { from: 'peer', text: 'channels.xt.xt_ambush.line.4' },
            { from: 'peer', text: 'channels.xt.xt_ambush.line.5' },
          ],
          choices: [
            {
              id: 'go',
              label: 'channels.xt.xt_ambush.choice.go.label',
              note: 'channels.xt.xt_ambush.choice.go.note',
              requires: { ap: 2 },
              say: 'channels.xt.xt_ambush.choice.go.say',
              affinity: 10,
              effect: {
                ap: -2,
                stats: { stamina: -12, sanity: -4 },
                world: { exposure: 8 },
                tone: 'grim',
              },
              next: 'r_go',
            },
            {
              id: 'talk',
              label: 'channels.xt.xt_ambush.choice.talk.label',
              note: 'channels.xt.xt_ambush.choice.talk.note',
              say: 'channels.xt.xt_ambush.choice.talk.say',
              affinity: 4,
              next: 'r_talk',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_ambush.choice.quiet.label',
              note: 'channels.xt.xt_ambush.choice.quiet.note',
              affinity: -10,
              effect: { stats: { sanity: -3 }, tone: 'grim' },
              next: 'r_dead',
            },
          ],
        },
        {
          // 出门第一段：他已经答应了出门，所以她这两句是**回应**——
          // 让她报"我还听得见你"，而不是旁白替他复述动作。
          id: 'r_go',
          out: [
            { from: 'peer', text: 'channels.xt.xt_go.line.1' },
            { from: 'peer', text: 'channels.xt.xt_go.line.2' },
          ],
          choices: [
            {
              id: 'upstairs',
              label: 'channels.xt.xt_go.choice.upstairs.label',
              note: 'channels.xt.xt_go.choice.upstairs.note',
              say: 'channels.xt.xt_go.choice.upstairs.say',
              affinity: 6,
              effect: { stats: { stamina: -12 }, tone: 'grim' },
              next: 'r_up',
            },
            {
              id: 'callout',
              label: 'channels.xt.xt_go.choice.callout.label',
              note: 'channels.xt.xt_go.choice.callout.note',
              say: 'channels.xt.xt_go.choice.callout.say',
              affinity: 2,
              effect: { world: { exposure: 6 }, tone: 'grim' },
              next: 'r_callout',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_go.choice.quiet.label',
              note: 'channels.xt.xt_go.choice.quiet.note',
              affinity: -2,
              // 不出声也是一种走法：省一句发射，路上少报一声平安
              next: 'r_up',
            },
            {
              id: 'back',
              label: 'channels.xt.xt_go.choice.back.label',
              note: 'channels.xt.xt_go.choice.back.note',
              affinity: -12,
              next: 'r_dead',
            },
          ],
        },
        {
          // 喊走了人，人没上去。她活，代价是暴露
          id: 'r_callout',
          out: [
            { from: 'peer', text: 'channels.xt.xt_callout.line.1' },
            { from: 'peer', text: 'channels.xt.xt_callout.line.2' },
            { from: 'peer', text: 'channels.xt.xt_callout.line.3', onRead: { stats: { sanity: 4 }, setFlags: ['flag:xtAlive'], tone: 'neutral' } },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_callout.choice.close.label',
              note: 'channels.xt.xt_callout.choice.close.note',
              say: 'channels.xt.xt_callout.choice.close.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_callout.choice.quiet.label',
              note: 'channels.xt.xt_callout.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          // 上了楼。她隔着门问门牌——那句话只教给过拿频率表的人
          id: 'r_up',
          out: [
            { from: 'peer', text: 'channels.xt.xt_up.line.1' },
            { from: 'peer', text: 'channels.xt.xt_up.line.2' },
          ],
          choices: [
            {
              id: 'saycode',
              label: 'channels.xt.xt_up.choice.saycode.label',
              note: 'channels.xt.xt_up.choice.saycode.note',
              say: 'channels.xt.xt_up.choice.saycode.say',
              affinity: 6,
              next: 'r_open',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_up.choice.quiet.label',
              note: 'channels.xt.xt_up.choice.quiet.note',
              affinity: -2,
              next: 'r_shut',
            },
          ],
        },
        {
          // 门开了。她活
          id: 'r_open',
          out: [
            { from: 'peer', text: 'channels.xt.xt_open_door.line.1' },
            { from: 'peer', text: 'channels.xt.xt_open_door.line.2' },
            { from: 'peer', text: 'channels.xt.xt_open_door.line.3', onRead: { stats: { sanity: 8 }, setFlags: ['flag:xtAlive'], tone: 'good' } },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_open_door.choice.close.label',
              note: 'channels.xt.xt_open_door.choice.close.note',
              say: 'channels.xt.xt_open_door.choice.close.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_open_door.choice.quiet.label',
              note: 'channels.xt.xt_open_door.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          // 门没开。她也活——贼走了，门里门外隔着的就是那句话
          id: 'r_shut',
          out: [
            { from: 'peer', text: 'channels.xt.xt_shut_door.line.1' },
            { from: 'peer', text: 'channels.xt.xt_shut_door.line.2' },
            { from: 'peer', text: 'channels.xt.xt_shut_door.line.3', onRead: { stats: { sanity: 3 }, setFlags: ['flag:xtAlive'], tone: 'neutral' } },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_shut_door.choice.close.label',
              note: 'channels.xt.xt_shut_door.choice.close.note',
              say: 'channels.xt.xt_shut_door.choice.close.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_shut_door.choice.quiet.label',
              note: 'channels.xt.xt_shut_door.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          // 电波陪跑：人过不去，声音过得去
          id: 'r_talk',
          out: [
            { from: 'peer', text: 'channels.xt.xt_talk.line.1' },
            { from: 'peer', text: 'channels.xt.xt_talk.line.2' },
            { from: 'peer', text: 'channels.xt.xt_talk.line.3' },
          ],
          choices: [
            {
              id: 'check',
              label: 'channels.xt.xt_talk.choice.check.label',
              note: 'channels.xt.xt_talk.choice.check.note',
              say: 'channels.xt.xt_talk.choice.check.say',
              affinity: 4,
              next: 'r_safe',
            },
            {
              id: 'dawn',
              label: 'channels.xt.xt_talk.choice.dawn.label',
              note: 'channels.xt.xt_talk.choice.dawn.note',
              say: 'channels.xt.xt_talk.choice.dawn.say',
              affinity: 6,
              next: 'r_dawn',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_talk.choice.quiet.label',
              note: 'channels.xt.xt_talk.choice.quiet.note',
              affinity: -4,
              next: 'r_gone',
            },
          ],
        },
        {
          id: 'r_safe',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_talk_safe.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_talk_safe.line.2' },
            { from: 'peer', text: 'channels.xt.xt_re_talk_safe.line.3', onRead: { stats: { sanity: 2 }, setFlags: ['flag:xtAlive'], tone: 'neutral' } },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_talk_safe.choice.close.label',
              note: 'channels.xt.xt_re_talk_safe.choice.close.note',
              say: 'channels.xt.xt_re_talk_safe.choice.close.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_talk_safe.choice.quiet.label',
              note: 'channels.xt.xt_re_talk_safe.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r_dawn',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_talk_dawn.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_talk_dawn.line.2', onRead: { stats: { sanity: 4 }, setFlags: ['flag:xtAlive'], tone: 'good' } },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_talk_dawn.choice.close.label',
              note: 'channels.xt.xt_re_talk_dawn.choice.close.note',
              say: 'channels.xt.xt_re_talk_dawn.choice.close.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_talk_dawn.choice.quiet.label',
              note: 'channels.xt.xt_re_talk_dawn.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          // 撂了挑子。她一个人撑过后半夜——活着，但记住了这件事
          id: 'r_gone',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_talk_gone.line.1', onRead: { stats: { sanity: -4 }, tone: 'grim' } },
            { from: 'peer', text: 'channels.xt.xt_re_talk_gone.line.2', onRead: { setFlags: ['flag:xtAlive'] } },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_talk_gone.choice.close.label',
              note: 'channels.xt.xt_re_talk_gone.choice.close.note',
              say: 'channels.xt.xt_re_talk_gone.choice.close.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_talk_gone.choice.quiet.label',
              note: 'channels.xt.xt_re_talk_gone.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        { id: 'r_dead', silence: true, out: DEAD_LINES },
      ],
    },

    // ---------- 「门槛不够」的静默事件已删除（2026-09-16） ----------
    // 旧版：xt_ambush 挂 minAffinity 40，不够熟就改成 xt_silent（"她根本没向你说"）。
    // 那个设计有两处问题：① 好感实际决定了生死——违反 radio-voices 第 5 条
    // 「生死由行为链决定，不由暗数值决定」；② xt_silent 自己是 stage [9,9] 的占位，
    // 永远不可达（audit-ids 专门为它开了一条豁免，那就是味道）。
    // 现在她**永远会求救**，好感只决定"她怎么喊"（见 xt_ambush 的 r1 / r1_low），
    // 死亡由玩家行为落定（r_dead）。xt_silent 的前提消失，事件与文案一并删除。

    // ---------- 存活线：她活着才有的日常。语言变了——她不再问「你那还有电吗」 ----------
    {
      id: 'xt_live_a',
      stage: [5, 5],
      require: { any: ['flag:xtAlive'] },
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_live_a.line.1' },
            { from: 'peer', text: 'channels.xt.xt_live_a.line.2' },
            { from: 'peer', text: 'channels.xt.xt_live_a.line.3', onRead: { stats: { sanity: 3 }, tone: 'good' } },
          ],
          choices: [
            {
              id: 'ok',
              label: 'channels.xt.xt_live_a.choice.ok.label',
              note: 'channels.xt.xt_live_a.choice.ok.note',
              say: 'channels.xt.xt_live_a.choice.ok.say',
              affinity: 3,
              next: 'r_ok',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_live_a.choice.quiet.label',
              note: 'channels.xt.xt_live_a.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r_ok',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_livea_ok.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_livea_ok.line.2' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_livea_ok.choice.close.label',
              note: 'channels.xt.xt_re_livea_ok.choice.close.note',
              say: 'channels.xt.xt_re_livea_ok.choice.close.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_livea_ok.choice.quiet.label',
              note: 'channels.xt.xt_re_livea_ok.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },
    {
      id: 'xt_live_b',
      stage: [5, 6],
      require: { any: ['flag:xtAlive'] },
      kind: 'request',
      opening: [
        { from: 'peer', text: 'channels.xt.xt_live_b.line.1' },
        { from: 'peer', text: 'channels.xt.xt_live_b.line.2' },
      ],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [],
          choices: [
            {
              id: 'hope',
              label: 'channels.xt.xt_live_b.choice.hope.label',
              note: 'channels.xt.xt_live_b.choice.hope.note',
              say: 'channels.xt.xt_live_b.choice.hope.say',
              affinity: 6,
              effect: { stats: { sanity: 3 }, tone: 'good' },
              next: 'r_hope',
            },
            {
              id: 'plain',
              label: 'channels.xt.xt_live_b.choice.plain.label',
              note: 'channels.xt.xt_live_b.choice.plain.note',
              say: 'channels.xt.xt_live_b.choice.plain.say',
              affinity: 2,
              effect: { stats: { sanity: 1 }, tone: 'neutral' },
              next: 'r_plain',
            },
            {
              id: 'silent',
              label: 'channels.xt.xt_live_b.choice.silent.label',
              note: 'channels.xt.xt_live_b.choice.silent.note',
              affinity: -6,
              effect: { stats: { sanity: -3 }, tone: 'grim' },
              next: 'r_silent',
            },
          ],
        },
        {
          id: 'r_hope',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_liveb_hope.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_liveb_hope.line.2' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_liveb_hope.choice.close.label',
              note: 'channels.xt.xt_re_liveb_hope.choice.close.note',
              say: 'channels.xt.xt_re_liveb_hope.choice.close.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_liveb_hope.choice.quiet.label',
              note: 'channels.xt.xt_re_liveb_hope.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r_plain',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_liveb_plain.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_liveb_plain.line.2' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_liveb_plain.choice.close.label',
              note: 'channels.xt.xt_re_liveb_plain.choice.close.note',
              say: 'channels.xt.xt_re_liveb_plain.choice.close.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_liveb_plain.choice.quiet.label',
              note: 'channels.xt.xt_re_liveb_plain.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r_silent',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_liveb_silent.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_liveb_silent.line.2' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_re_liveb_silent.choice.close.label',
              note: 'channels.xt.xt_re_liveb_silent.choice.close.note',
              say: 'channels.xt.xt_re_liveb_silent.choice.close.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_re_liveb_silent.choice.quiet.label',
              note: 'channels.xt.xt_re_liveb_silent.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },
    {
      id: 'xt_live_c',
      stage: [6, 6],
      require: { any: ['flag:xtAlive'] },
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_live_c.line.1' },
            { from: 'peer', text: 'channels.xt.xt_live_c.line.2' },
            { from: 'peer', text: 'channels.xt.xt_live_c.line.3', onRead: { stats: { sanity: 2 }, tone: 'neutral' } },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_live_c.choice.close.label',
              note: 'channels.xt.xt_live_c.choice.close.note',
              say: 'channels.xt.xt_live_c.choice.close.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_live_c.choice.quiet.label',
              note: 'channels.xt.xt_live_c.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },
    {
      // 终章。「以后」这个词回来了——她重新有了未来时态
      id: 'xt_epilogue',
      stage: [6, 6],
      require: { any: ['flag:xtAlive'] },
      kind: 'end',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_epilogue.line.1' },
            { from: 'peer', text: 'channels.xt.xt_epilogue.line.2' },
            { from: 'peer', text: 'channels.xt.xt_epilogue.line.3', onRead: { stats: { sanity: 4 }, tone: 'good' } },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_epilogue.choice.close.label',
              note: 'channels.xt.xt_epilogue.choice.close.note',
              say: 'channels.xt.xt_epilogue.choice.close.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_epilogue.choice.quiet.label',
              note: 'channels.xt.xt_epilogue.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ============================================================
    // 量产批次 2026-09-16（按 docs/xt-pool.md 蓝图，id 用蓝图命名）
    // 写前两问：stage（她问什么）× bond（她敢露多少）；每句过替换测试。
    // 每个含选项轮都带「什么都不回应」。
    // 注：蓝图的 xt_a_name（她问你怎么称呼）**未做**——它违反 xt-bible
    //     「绝不问：你叫什么」，以设定集为准。
    // ============================================================

    // ---------- 恐慌期：手画频率表登场 ----------
    {
      id: 'xt_a_table',
      stage: [1, 1],
      minBond: 2,
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_a_table.line.1' },
            { from: 'peer', text: 'channels.xt.xt_a_table.line.2' },
          ],
          choices: [
            {
              id: 'count',
              label: 'channels.xt.xt_a_table.choice.count.label',
              note: 'channels.xt.xt_a_table.choice.count.note',
              say: 'channels.xt.xt_a_table.choice.count.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_table.choice.quiet.label',
              note: 'channels.xt.xt_a_table.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_a_table.line.3' },
            { from: 'peer', text: 'channels.xt.xt_a_table.line.4' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_a_table.choice.ask.label',
              note: 'channels.xt.xt_a_table.choice.ask.note',
              say: 'channels.xt.xt_a_table.choice.ask.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_table.choice.quiet.label',
              note: 'channels.xt.xt_a_table.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_a_table.line.5' },
            { from: 'peer', text: 'channels.xt.xt_a_table.line.6' },
          ],
          choices: [
            {
              id: 'nice',
              label: 'channels.xt.xt_a_table.choice.nice.label',
              note: 'channels.xt.xt_a_table.choice.nice.note',
              say: 'channels.xt.xt_a_table.choice.nice.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_table.choice.quiet.label',
              note: 'channels.xt.xt_a_table.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r4',
          out: [{ from: 'peer', text: 'channels.xt.xt_a_table.line.7' }],
          choices: [
            {
              id: 'ok',
              label: 'channels.xt.xt_a_table.choice.ok.label',
              note: 'channels.xt.xt_a_table.choice.ok.note',
              say: 'channels.xt.xt_a_table.choice.ok.say',
              affinity: 2,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_table.choice.quiet.label',
              note: 'channels.xt.xt_a_table.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 恐慌期关联关键：暗号（敲两下＝我在） ----------
    // 全线第一件"两个人共同确立的东西"。她主动提规矩，但说完就找补（"你别嫌烦"）。
    {
      id: 'xt_a_knock',
      stage: [1, 1],
      minBond: 2,
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_a_knock.line.1' },
            { from: 'peer', text: 'channels.xt.xt_a_knock.line.2' },
          ],
          choices: [
            {
              id: 'here',
              label: 'channels.xt.xt_a_knock.choice.here.label',
              note: 'channels.xt.xt_a_knock.choice.here.note',
              say: 'channels.xt.xt_a_knock.choice.here.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_knock.choice.quiet.label',
              note: 'channels.xt.xt_a_knock.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_a_knock.line.3' },
            { from: 'peer', text: 'channels.xt.xt_a_knock.line.4' },
          ],
          choices: [
            {
              id: 'explain',
              label: 'channels.xt.xt_a_knock.choice.explain.label',
              note: 'channels.xt.xt_a_knock.choice.explain.note',
              say: 'channels.xt.xt_a_knock.choice.explain.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_knock.choice.quiet.label',
              note: 'channels.xt.xt_a_knock.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_a_knock.line.5' },
            { from: 'peer', text: 'channels.xt.xt_a_knock.line.6' },
          ],
          choices: [
            {
              id: 'two',
              label: 'channels.xt.xt_a_knock.choice.two.label',
              note: 'channels.xt.xt_a_knock.choice.two.note',
              say: 'channels.xt.xt_a_knock.choice.two.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_knock.choice.quiet.label',
              note: 'channels.xt.xt_a_knock.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r4',
          out: [{ from: 'peer', text: 'channels.xt.xt_a_knock.line.7' }],
          choices: [
            {
              id: 'agree',
              label: 'channels.xt.xt_a_knock.choice.agree.label',
              note: 'channels.xt.xt_a_knock.choice.agree.note',
              say: 'channels.xt.xt_a_knock.choice.agree.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r5',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_knock.choice.quiet.label',
              note: 'channels.xt.xt_a_knock.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r5',
          out: [
            { from: 'peer', text: 'channels.xt.xt_a_knock.line.8' },
            { from: 'peer', text: 'channels.xt.xt_a_knock.line.9' },
          ],
          choices: [
            {
              id: 'three',
              label: 'channels.xt.xt_a_knock.choice.three.label',
              note: 'channels.xt.xt_a_knock.choice.three.note',
              say: 'channels.xt.xt_a_knock.choice.three.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r6',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_knock.choice.quiet.label',
              note: 'channels.xt.xt_a_knock.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r6',
          out: [{ from: 'peer', text: 'channels.xt.xt_a_knock.line.10' }],
          choices: [
            {
              id: 'promise',
              label: 'channels.xt.xt_a_knock.choice.promise.label',
              note: 'channels.xt.xt_a_knock.choice.promise.note',
              say: 'channels.xt.xt_a_knock.choice.promise.say',
              affinity: 3,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
              next: 'r7',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_knock.choice.quiet.label',
              note: 'channels.xt.xt_a_knock.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r7',
          out: [
            { from: 'peer', text: 'channels.xt.xt_a_knock.line.11' },
            { from: 'peer', text: 'channels.xt.xt_a_knock.line.12' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_a_knock.choice.listen.label',
              note: 'channels.xt.xt_a_knock.choice.listen.note',
              say: 'channels.xt.xt_a_knock.choice.listen.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r8',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_knock.choice.quiet.label',
              note: 'channels.xt.xt_a_knock.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          // 收尾：她真的敲了两下。玩家的回应也是敲——这条线上第一次"用暗号说话"。
          id: 'r8',
          out: [
            { from: 'peer', text: 'channels.xt.xt_a_knock.line.13' },
            { from: 'peer', text: 'channels.xt.xt_a_knock.line.14' },
          ],
          choices: [
            {
              id: 'knock',
              label: 'channels.xt.xt_a_knock.choice.knock.label',
              note: 'channels.xt.xt_a_knock.choice.knock.note',
              say: 'channels.xt.xt_a_knock.choice.knock.say',
              affinity: 4,
              effect: { stats: { sanity: 4 }, tone: 'good', setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_knock.choice.quiet.label',
              note: 'channels.xt.xt_a_knock.choice.quiet.note',
              affinity: -3,
            },
          ],
        },
      ],
    },

    // ---------- 匮乏期：停水，她下楼接雨水（2 轮） ----------
    {
      id: 'xt_b_water',
      stage: [2, 2],
      minBond: 2,
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_water.line.1' },
            { from: 'peer', text: 'channels.xt.xt_b_water.line.2' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_b_water.choice.ask.label',
              note: 'channels.xt.xt_b_water.choice.ask.note',
              say: 'channels.xt.xt_b_water.choice.ask.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_water.choice.quiet.label',
              note: 'channels.xt.xt_b_water.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_water.line.3' },
            { from: 'peer', text: 'channels.xt.xt_b_water.line.4' },
          ],
          choices: [
            {
              id: 'ok',
              label: 'channels.xt.xt_b_water.choice.ok.label',
              note: 'channels.xt.xt_b_water.choice.ok.note',
              say: 'channels.xt.xt_b_water.choice.ok.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_water.choice.quiet.label',
              note: 'channels.xt.xt_b_water.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 匮乏期：表第二版，加了电池余量刻度 ----------
    {
      id: 'xt_b_table2',
      stage: [2, 2],
      minBond: 2,
      kind: 'daily',
      need: ['xt_a_table'],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_table2.line.1' },
            { from: 'peer', text: 'channels.xt.xt_b_table2.line.2' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_b_table2.choice.ask.label',
              note: 'channels.xt.xt_b_table2.choice.ask.note',
              say: 'channels.xt.xt_b_table2.choice.ask.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_table2.choice.quiet.label',
              note: 'channels.xt.xt_b_table2.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_table2.line.3' },
            { from: 'peer', text: 'channels.xt.xt_b_table2.line.4' },
          ],
          choices: [
            {
              id: 'careful',
              label: 'channels.xt.xt_b_table2.choice.careful.label',
              note: 'channels.xt.xt_b_table2.choice.careful.note',
              say: 'channels.xt.xt_b_table2.choice.careful.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_table2.choice.quiet.label',
              note: 'channels.xt.xt_b_table2.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_table2.line.5' },
            { from: 'peer', text: 'channels.xt.xt_b_table2.line.6' },
          ],
          choices: [
            {
              id: 'worry',
              label: 'channels.xt.xt_b_table2.choice.worry.label',
              note: 'channels.xt.xt_b_table2.choice.worry.note',
              say: 'channels.xt.xt_b_table2.choice.worry.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_table2.choice.quiet.label',
              note: 'channels.xt.xt_b_table2.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r4',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_table2.line.7' },
            { from: 'peer', text: 'channels.xt.xt_b_table2.line.8' },
          ],
          choices: [
            {
              id: 'ok',
              label: 'channels.xt.xt_b_table2.choice.ok.label',
              note: 'channels.xt.xt_b_table2.choice.ok.note',
              say: 'channels.xt.xt_b_table2.choice.ok.say',
              affinity: 2,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_table2.choice.quiet.label',
              note: 'channels.xt.xt_b_table2.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 匮乏期关联关键：从东窗认 401 的窗 ----------
    // 门牌之后她还不放心，非要用一个她从自己窗户就能核对的东西把坐标钉死。
    // 这条是 xt_c_window 的来源，也是营救那晚"知道你在我对面"的伏笔。
    {
      id: 'xt_b_visit',
      stage: [2, 2],
      minBond: 2,
      kind: 'daily',
      need: ['xt_b_address'],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [{ from: 'peer', text: 'channels.xt.xt_b_visit.line.1' }],
          choices: [
            {
              id: 'maybe',
              label: 'channels.xt.xt_b_visit.choice.maybe.label',
              note: 'channels.xt.xt_b_visit.choice.maybe.note',
              say: 'channels.xt.xt_b_visit.choice.maybe.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_visit.choice.quiet.label',
              note: 'channels.xt.xt_b_visit.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_visit.line.2' },
            { from: 'peer', text: 'channels.xt.xt_b_visit.line.3' },
          ],
          choices: [
            {
              id: 'got',
              label: 'channels.xt.xt_b_visit.choice.got.label',
              note: 'channels.xt.xt_b_visit.choice.got.note',
              say: 'channels.xt.xt_b_visit.choice.got.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_visit.choice.quiet.label',
              note: 'channels.xt.xt_b_visit.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_visit.line.4' },
            { from: 'peer', text: 'channels.xt.xt_b_visit.line.5' },
          ],
          choices: [
            {
              id: 'diff',
              label: 'channels.xt.xt_b_visit.choice.diff.label',
              note: 'channels.xt.xt_b_visit.choice.diff.note',
              say: 'channels.xt.xt_b_visit.choice.diff.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_visit.choice.quiet.label',
              note: 'channels.xt.xt_b_visit.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r4',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_visit.line.6' },
            { from: 'peer', text: 'channels.xt.xt_b_visit.line.7' },
          ],
          choices: [
            {
              id: 'why',
              label: 'channels.xt.xt_b_visit.choice.why.label',
              note: 'channels.xt.xt_b_visit.choice.why.note',
              say: 'channels.xt.xt_b_visit.choice.why.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r5',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_visit.choice.quiet.label',
              note: 'channels.xt.xt_b_visit.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r5',
          out: [{ from: 'peer', text: 'channels.xt.xt_b_visit.line.8' }],
          choices: [
            {
              id: 'understand',
              label: 'channels.xt.xt_b_visit.choice.understand.label',
              note: 'channels.xt.xt_b_visit.choice.understand.note',
              say: 'channels.xt.xt_b_visit.choice.understand.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r6',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_visit.choice.quiet.label',
              note: 'channels.xt.xt_b_visit.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          // 收尾照旧找补：不是让你来，就是万一。
          id: 'r6',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_visit.line.9' },
            { from: 'peer', text: 'channels.xt.xt_b_visit.line.10' },
          ],
          choices: [
            {
              id: 'heard',
              label: 'channels.xt.xt_b_visit.choice.heard.label',
              note: 'channels.xt.xt_b_visit.choice.heard.note',
              say: 'channels.xt.xt_b_visit.choice.heard.say',
              affinity: 3,
              effect: { stats: { sanity: 3 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_visit.choice.quiet.label',
              note: 'channels.xt.xt_b_visit.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 掠夺期关键：挨家试门（5 轮） ----------
    {
      id: 'xt_c_lockdown',
      stage: [3, 3],
      minBond: 2,
      key: true,
      kind: 'crisis',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_c_lockdown.line.1' },
            { from: 'peer', text: 'channels.xt.xt_c_lockdown.line.2' },
          ],
          choices: [
            {
              id: 'stay',
              label: 'channels.xt.xt_c_lockdown.choice.stay.label',
              note: 'channels.xt.xt_c_lockdown.choice.stay.note',
              say: 'channels.xt.xt_c_lockdown.choice.stay.say',
              affinity: 1,
              effect: { stats: { sanity: -2 }, setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_c_lockdown.choice.quiet.label',
              note: 'channels.xt.xt_c_lockdown.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_c_lockdown.line.3' },
            { from: 'peer', text: 'channels.xt.xt_c_lockdown.line.4' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_c_lockdown.choice.ask.label',
              note: 'channels.xt.xt_c_lockdown.choice.ask.note',
              say: 'channels.xt.xt_c_lockdown.choice.ask.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_c_lockdown.choice.quiet.label',
              note: 'channels.xt.xt_c_lockdown.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [{ from: 'peer', text: 'channels.xt.xt_c_lockdown.line.5' }],
          choices: [
            {
              id: 'worry',
              label: 'channels.xt.xt_c_lockdown.choice.worry.label',
              note: 'channels.xt.xt_c_lockdown.choice.worry.note',
              say: 'channels.xt.xt_c_lockdown.choice.worry.say',
              affinity: 2,
              effect: { stats: { sanity: -2 }, setFlags: ['flag:xtReplied'] },
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_c_lockdown.choice.quiet.label',
              note: 'channels.xt.xt_c_lockdown.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r4',
          out: [
            { from: 'peer', text: 'channels.xt.xt_c_lockdown.line.6' },
            { from: 'peer', text: 'channels.xt.xt_c_lockdown.line.7' },
          ],
          choices: [
            {
              id: 'offer',
              label: 'channels.xt.xt_c_lockdown.choice.offer.label',
              note: 'channels.xt.xt_c_lockdown.choice.offer.note',
              say: 'channels.xt.xt_c_lockdown.choice.offer.say',
              affinity: 3,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
              next: 'r5',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_c_lockdown.choice.quiet.label',
              note: 'channels.xt.xt_c_lockdown.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          // 收尾：她主动要求"别回这条"。所以 `ok` 是**不发射**的选项——
          // 尊重她的请求本身就是一次表露，不该反过来让她冒险。
          id: 'r5',
          out: [
            { from: 'peer', text: 'channels.xt.xt_c_lockdown.line.8' },
            { from: 'peer', text: 'channels.xt.xt_c_lockdown.line.9' },
          ],
          choices: [
            {
              id: 'ok',
              label: 'channels.xt.xt_c_lockdown.choice.ok.label',
              note: 'channels.xt.xt_c_lockdown.choice.ok.note',
              affinity: 3,
              effect: { stats: { sanity: 2 }, tone: 'good' },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_c_lockdown.choice.quiet.label',
              note: 'channels.xt.xt_c_lockdown.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 掠夺期：夜里有人上楼（2 轮） ----------
    {
      id: 'xt_c_nightwalk',
      stage: [3, 3],
      minBond: 2,
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_c_nightwalk.line.1' },
            { from: 'peer', text: 'channels.xt.xt_c_nightwalk.line.2' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_c_nightwalk.choice.listen.label',
              note: 'channels.xt.xt_c_nightwalk.choice.listen.note',
              say: 'channels.xt.xt_c_nightwalk.choice.listen.say',
              affinity: 1,
              effect: { stats: { sanity: -1 }, setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_c_nightwalk.choice.quiet.label',
              note: 'channels.xt.xt_c_nightwalk.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_c_nightwalk.line.3' },
            { from: 'peer', text: 'channels.xt.xt_c_nightwalk.line.4' },
          ],
          choices: [
            {
              id: 'ok',
              label: 'channels.xt.xt_c_nightwalk.choice.ok.label',
              note: 'channels.xt.xt_c_nightwalk.choice.ok.note',
              say: 'channels.xt.xt_c_nightwalk.choice.ok.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_c_nightwalk.choice.quiet.label',
              note: 'channels.xt.xt_c_nightwalk.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 掠夺期：窗不亮灯了（3 轮·承接 xt_b_visit） ----------
    {
      id: 'xt_c_window',
      stage: [3, 3],
      minBond: 2,
      kind: 'daily',
      need: ['xt_b_visit'],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_c_window.line.1' },
            { from: 'peer', text: 'channels.xt.xt_c_window.line.2' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_c_window.choice.ask.label',
              note: 'channels.xt.xt_c_window.choice.ask.note',
              say: 'channels.xt.xt_c_window.choice.ask.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_c_window.choice.quiet.label',
              note: 'channels.xt.xt_c_window.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_c_window.line.3' },
            { from: 'peer', text: 'channels.xt.xt_c_window.line.4' },
          ],
          choices: [
            {
              id: 'right',
              label: 'channels.xt.xt_c_window.choice.right.label',
              note: 'channels.xt.xt_c_window.choice.right.note',
              say: 'channels.xt.xt_c_window.choice.right.say',
              affinity: 2,
              effect: { stats: { sanity: -2 }, setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_c_window.choice.quiet.label',
              note: 'channels.xt.xt_c_window.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_c_window.line.5' },
            { from: 'peer', text: 'channels.xt.xt_c_window.line.6' },
          ],
          choices: [
            {
              id: 'ok',
              label: 'channels.xt.xt_c_window.choice.ok.label',
              note: 'channels.xt.xt_c_window.choice.ok.note',
              say: 'channels.xt.xt_c_window.choice.ok.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_c_window.choice.quiet.label',
              note: 'channels.xt.xt_c_window.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 严冬期关键：水管冻裂（5 轮） ----------
    {
      id: 'xt_d_cold',
      stage: [4, 4],
      minBond: 3,
      key: true,
      kind: 'crisis',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_cold.line.1' },
            { from: 'peer', text: 'channels.xt.xt_d_cold.line.2' },
          ],
          choices: [
            {
              id: 'howareyou',
              label: 'channels.xt.xt_d_cold.choice.howareyou.label',
              note: 'channels.xt.xt_d_cold.choice.howareyou.note',
              say: 'channels.xt.xt_d_cold.choice.howareyou.say',
              affinity: 1,
              effect: { stats: { sanity: -2 }, setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_cold.choice.quiet.label',
              note: 'channels.xt.xt_d_cold.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_cold.line.3' },
            { from: 'peer', text: 'channels.xt.xt_d_cold.line.4' },
          ],
          choices: [
            {
              id: 'tired',
              label: 'channels.xt.xt_d_cold.choice.tired.label',
              note: 'channels.xt.xt_d_cold.choice.tired.note',
              say: 'channels.xt.xt_d_cold.choice.tired.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_cold.choice.quiet.label',
              note: 'channels.xt.xt_d_cold.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_cold.line.5' },
            { from: 'peer', text: 'channels.xt.xt_d_cold.line.6' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_d_cold.choice.listen.label',
              note: 'channels.xt.xt_d_cold.choice.listen.note',
              say: 'channels.xt.xt_d_cold.choice.listen.say',
              affinity: 2,
              effect: { stats: { sanity: -2 }, setFlags: ['flag:xtReplied'] },
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_cold.choice.quiet.label',
              note: 'channels.xt.xt_d_cold.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r4',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_cold.line.7' },
            { from: 'peer', text: 'channels.xt.xt_d_cold.line.8' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_d_cold.choice.ask.label',
              note: 'channels.xt.xt_d_cold.choice.ask.note',
              say: 'channels.xt.xt_d_cold.choice.ask.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r5',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_cold.choice.quiet.label',
              note: 'channels.xt.xt_d_cold.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r5',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_cold.line.9' },
            { from: 'peer', text: 'channels.xt.xt_d_cold.line.10' },
          ],
          choices: [
            {
              id: 'ok',
              label: 'channels.xt.xt_d_cold.choice.ok.label',
              note: 'channels.xt.xt_d_cold.choice.ok.note',
              say: 'channels.xt.xt_d_cold.choice.ok.say',
              affinity: 2,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_cold.choice.quiet.label',
              note: 'channels.xt.xt_d_cold.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 荒芜期关键：最后一节新电池（6 轮） ----------
    // 她立"隔天开机"的新规矩——这是全线第一次由**她**来规定两人怎么相处。
    {
      id: 'xt_e_lastcell',
      stage: [5, 5],
      minBond: 3,
      key: true,
      kind: 'crisis',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_e_lastcell.line.1' },
            { from: 'peer', text: 'channels.xt.xt_e_lastcell.line.2' },
          ],
          choices: [
            {
              id: 'careful',
              label: 'channels.xt.xt_e_lastcell.choice.careful.label',
              note: 'channels.xt.xt_e_lastcell.choice.careful.note',
              say: 'channels.xt.xt_e_lastcell.choice.careful.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_e_lastcell.choice.quiet.label',
              note: 'channels.xt.xt_e_lastcell.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_e_lastcell.line.3' },
            { from: 'peer', text: 'channels.xt.xt_e_lastcell.line.4' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_e_lastcell.choice.ask.label',
              note: 'channels.xt.xt_e_lastcell.choice.ask.note',
              say: 'channels.xt.xt_e_lastcell.choice.ask.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_e_lastcell.choice.quiet.label',
              note: 'channels.xt.xt_e_lastcell.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_e_lastcell.line.5' },
            { from: 'peer', text: 'channels.xt.xt_e_lastcell.line.6' },
          ],
          choices: [
            {
              id: 'ok',
              label: 'channels.xt.xt_e_lastcell.choice.ok.label',
              note: 'channels.xt.xt_e_lastcell.choice.ok.note',
              say: 'channels.xt.xt_e_lastcell.choice.ok.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_e_lastcell.choice.quiet.label',
              note: 'channels.xt.xt_e_lastcell.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r4',
          out: [{ from: 'peer', text: 'channels.xt.xt_e_lastcell.line.7' }],
          choices: [
            {
              id: 'thanks',
              label: 'channels.xt.xt_e_lastcell.choice.thanks.label',
              note: 'channels.xt.xt_e_lastcell.choice.thanks.note',
              say: 'channels.xt.xt_e_lastcell.choice.thanks.say',
              affinity: 2,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
              next: 'r5',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_e_lastcell.choice.quiet.label',
              note: 'channels.xt.xt_e_lastcell.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r5',
          out: [{ from: 'peer', text: 'channels.xt.xt_e_lastcell.line.8' }],
          choices: [
            {
              id: 'no',
              label: 'channels.xt.xt_e_lastcell.choice.no.label',
              note: 'channels.xt.xt_e_lastcell.choice.no.note',
              say: 'channels.xt.xt_e_lastcell.choice.no.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r6',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_e_lastcell.choice.quiet.label',
              note: 'channels.xt.xt_e_lastcell.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r6',
          out: [
            { from: 'peer', text: 'channels.xt.xt_e_lastcell.line.9' },
            { from: 'peer', text: 'channels.xt.xt_e_lastcell.line.10' },
          ],
          choices: [
            {
              id: 'wait',
              label: 'channels.xt.xt_e_lastcell.choice.wait.label',
              note: 'channels.xt.xt_e_lastcell.choice.wait.note',
              say: 'channels.xt.xt_e_lastcell.choice.wait.say',
              affinity: 3,
              effect: { stats: { sanity: -2 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_e_lastcell.choice.quiet.label',
              note: 'channels.xt.xt_e_lastcell.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 荒芜期：往南走的队伍（2 轮） ----------
    {
      id: 'xt_e_outside',
      stage: [5, 5],
      minBond: 3,
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_e_outside.line.1' },
            { from: 'peer', text: 'channels.xt.xt_e_outside.line.2' },
          ],
          choices: [
            {
              id: 'look',
              label: 'channels.xt.xt_e_outside.choice.look.label',
              note: 'channels.xt.xt_e_outside.choice.look.note',
              say: 'channels.xt.xt_e_outside.choice.look.say',
              affinity: 1,
              effect: { stats: { sanity: -3 }, setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_e_outside.choice.quiet.label',
              note: 'channels.xt.xt_e_outside.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_e_outside.line.3' },
            { from: 'peer', text: 'channels.xt.xt_e_outside.line.4' },
          ],
          choices: [
            {
              id: 'ok',
              label: 'channels.xt.xt_e_outside.choice.ok.label',
              note: 'channels.xt.xt_e_outside.choice.ok.note',
              say: 'channels.xt.xt_e_outside.choice.ok.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_e_outside.choice.quiet.label',
              note: 'channels.xt.xt_e_outside.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 死寂期关键：一段循环录音（5 轮） ----------
    {
      id: 'xt_f_rumor',
      stage: [6, 6],
      minBond: 3,
      key: true,
      kind: 'crisis',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_f_rumor.line.1' },
            { from: 'peer', text: 'channels.xt.xt_f_rumor.line.2' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_f_rumor.choice.ask.label',
              note: 'channels.xt.xt_f_rumor.choice.ask.note',
              say: 'channels.xt.xt_f_rumor.choice.ask.say',
              affinity: 1,
              effect: { stats: { sanity: -2 }, setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_f_rumor.choice.quiet.label',
              note: 'channels.xt.xt_f_rumor.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_f_rumor.line.3' },
            { from: 'peer', text: 'channels.xt.xt_f_rumor.line.4' },
          ],
          choices: [
            {
              id: 'doubt',
              label: 'channels.xt.xt_f_rumor.choice.doubt.label',
              note: 'channels.xt.xt_f_rumor.choice.doubt.note',
              say: 'channels.xt.xt_f_rumor.choice.doubt.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_f_rumor.choice.quiet.label',
              note: 'channels.xt.xt_f_rumor.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_f_rumor.line.5' },
            { from: 'peer', text: 'channels.xt.xt_f_rumor.line.6' },
          ],
          choices: [
            {
              id: 'careful',
              label: 'channels.xt.xt_f_rumor.choice.careful.label',
              note: 'channels.xt.xt_f_rumor.choice.careful.note',
              say: 'channels.xt.xt_f_rumor.choice.careful.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_f_rumor.choice.quiet.label',
              note: 'channels.xt.xt_f_rumor.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r4',
          out: [
            { from: 'peer', text: 'channels.xt.xt_f_rumor.line.7' },
            { from: 'peer', text: 'channels.xt.xt_f_rumor.line.8' },
          ],
          choices: [
            {
              id: 'stay',
              label: 'channels.xt.xt_f_rumor.choice.stay.label',
              note: 'channels.xt.xt_f_rumor.choice.stay.note',
              say: 'channels.xt.xt_f_rumor.choice.stay.say',
              affinity: 2,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
              next: 'r5',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_f_rumor.choice.quiet.label',
              note: 'channels.xt.xt_f_rumor.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r5',
          out: [
            { from: 'peer', text: 'channels.xt.xt_f_rumor.line.9' },
            { from: 'peer', text: 'channels.xt.xt_f_rumor.line.10' },
          ],
          choices: [
            {
              id: 'answer',
              label: 'channels.xt.xt_f_rumor.choice.answer.label',
              note: 'channels.xt.xt_f_rumor.choice.answer.note',
              say: 'channels.xt.xt_f_rumor.choice.answer.say',
              affinity: 3,
              effect: { stats: { sanity: -2 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_f_rumor.choice.quiet.label',
              note: 'channels.xt.xt_f_rumor.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },
    // ============================================================
    // 量产批次二 · 2026-09-17（补普通/关联事件，优先严冬/荒芜/死寂三段）
    // 每轮都有选项（含收尾轮的 close+quiet），符合 radio-voices 第 1 条。
    // need 与蓝图有出入的地方在各自注释里写明（蓝图的前置事件尚未落地时，挂最近的上游）。
    // ============================================================

    // ---------- 恐慌期：她从那扇窗认他（3 轮） ----------
    {
      id: 'xt_a_east',
      stage: [1, 1],
      minBond: 2,
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_a_east.line.1' },
            { from: 'peer', text: 'channels.xt.xt_a_east.line.2' },
          ],
          choices: [
            {
              id: 'yes',
              label: 'channels.xt.xt_a_east.choice.yes.label',
              note: 'channels.xt.xt_a_east.choice.yes.note',
              say: 'channels.xt.xt_a_east.choice.yes.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_east.choice.quiet.label',
              note: 'channels.xt.xt_a_east.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_a_east.line.3' },
            { from: 'peer', text: 'channels.xt.xt_a_east.line.4' },
          ],
          choices: [
            {
              id: 'tell',
              label: 'channels.xt.xt_a_east.choice.tell.label',
              note: 'channels.xt.xt_a_east.choice.tell.note',
              say: 'channels.xt.xt_a_east.choice.tell.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_east.choice.quiet.label',
              note: 'channels.xt.xt_a_east.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_a_east.line.5' },
            { from: 'peer', text: 'channels.xt.xt_a_east.line.6' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_a_east.choice.close.label',
              note: 'channels.xt.xt_a_east.choice.close.note',
              say: 'channels.xt.xt_a_east.choice.close.say',
              affinity: 3,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_east.choice.quiet.label',
              note: 'channels.xt.xt_a_east.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 恐慌期：杂音里的旧歌（3 轮） ----------
    {
      id: 'xt_a_song',
      stage: [1, 1],
      minBond: 2,
      kind: 'daily',
      need: ['xt_a_table'],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_a_song.line.1' },
            { from: 'peer', text: 'channels.xt.xt_a_song.line.2' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_a_song.choice.ask.label',
              note: 'channels.xt.xt_a_song.choice.ask.note',
              say: 'channels.xt.xt_a_song.choice.ask.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_song.choice.quiet.label',
              note: 'channels.xt.xt_a_song.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_a_song.line.3' },
            { from: 'peer', text: 'channels.xt.xt_a_song.line.4' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_a_song.choice.listen.label',
              note: 'channels.xt.xt_a_song.choice.listen.note',
              say: 'channels.xt.xt_a_song.choice.listen.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_song.choice.quiet.label',
              note: 'channels.xt.xt_a_song.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_a_song.line.5' },
            { from: 'peer', text: 'channels.xt.xt_a_song.line.6' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_a_song.choice.close.label',
              note: 'channels.xt.xt_a_song.choice.close.note',
              say: 'channels.xt.xt_a_song.choice.close.say',
              affinity: 3,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_song.choice.quiet.label',
              note: 'channels.xt.xt_a_song.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 匮乏期：第一次正面提妈（5 轮） ----------
    {
      id: 'xt_b_mom',
      stage: [2, 2],
      minBond: 2,
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_mom.line.1' },
            { from: 'peer', text: 'channels.xt.xt_b_mom.line.2' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_b_mom.choice.listen.label',
              note: 'channels.xt.xt_b_mom.choice.listen.note',
              say: 'channels.xt.xt_b_mom.choice.listen.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_mom.choice.quiet.label',
              note: 'channels.xt.xt_b_mom.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_mom.line.3' },
            { from: 'peer', text: 'channels.xt.xt_b_mom.line.4' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_b_mom.choice.ask.label',
              note: 'channels.xt.xt_b_mom.choice.ask.note',
              say: 'channels.xt.xt_b_mom.choice.ask.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_mom.choice.quiet.label',
              note: 'channels.xt.xt_b_mom.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_mom.line.5' },
            { from: 'peer', text: 'channels.xt.xt_b_mom.line.6' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_b_mom.choice.listen.label',
              note: 'channels.xt.xt_b_mom.choice.listen.note',
              say: 'channels.xt.xt_b_mom.choice.listen.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_mom.choice.quiet.label',
              note: 'channels.xt.xt_b_mom.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r4',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_mom.line.7' },
            { from: 'peer', text: 'channels.xt.xt_b_mom.line.8' },
          ],
          choices: [
            {
              id: 'care',
              label: 'channels.xt.xt_b_mom.choice.care.label',
              note: 'channels.xt.xt_b_mom.choice.care.note',
              say: 'channels.xt.xt_b_mom.choice.care.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r5',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_mom.choice.quiet.label',
              note: 'channels.xt.xt_b_mom.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r5',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_mom.line.9' },
            { from: 'peer', text: 'channels.xt.xt_b_mom.line.10' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_b_mom.choice.close.label',
              note: 'channels.xt.xt_b_mom.choice.close.note',
              say: 'channels.xt.xt_b_mom.choice.close.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_mom.choice.quiet.label',
              note: 'channels.xt.xt_b_mom.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 匮乏期：暗号成了习惯（2 轮） ----------
    {
      id: 'xt_b_check',
      stage: [2, 2],
      minBond: 2,
      kind: 'daily',
      need: ['xt_a_knock'],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_check.line.1' },
            { from: 'peer', text: 'channels.xt.xt_b_check.line.2' },
          ],
          choices: [
            {
              id: 'knock',
              label: 'channels.xt.xt_b_check.choice.knock.label',
              note: 'channels.xt.xt_b_check.choice.knock.note',
              say: 'channels.xt.xt_b_check.choice.knock.say',
              affinity: 2,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_check.choice.quiet.label',
              note: 'channels.xt.xt_b_check.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_check.line.3' },
            { from: 'peer', text: 'channels.xt.xt_b_check.line.4' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_b_check.choice.close.label',
              note: 'channels.xt.xt_b_check.choice.close.note',
              say: 'channels.xt.xt_b_check.choice.close.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_check.choice.quiet.label',
              note: 'channels.xt.xt_b_check.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 匮乏期关联：妈把稠的都给她（8 轮·全线情绪重锤） ----------
    {
      id: 'xt_b_grudge',
      stage: [2, 2],
      minBond: 2,
      kind: 'daily',
      need: ['xt_routine'],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_grudge.line.1' },
            { from: 'peer', text: 'channels.xt.xt_b_grudge.line.2' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_b_grudge.choice.listen.label',
              note: 'channels.xt.xt_b_grudge.choice.listen.note',
              say: 'channels.xt.xt_b_grudge.choice.listen.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_grudge.choice.quiet.label',
              note: 'channels.xt.xt_b_grudge.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [{ from: 'peer', text: 'channels.xt.xt_b_grudge.line.3' }],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_b_grudge.choice.ask.label',
              note: 'channels.xt.xt_b_grudge.choice.ask.note',
              say: 'channels.xt.xt_b_grudge.choice.ask.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_grudge.choice.quiet.label',
              note: 'channels.xt.xt_b_grudge.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_grudge.line.4' },
            { from: 'peer', text: 'channels.xt.xt_b_grudge.line.5' },
          ],
          choices: [
            {
              id: 'wait',
              label: 'channels.xt.xt_b_grudge.choice.wait.label',
              note: 'channels.xt.xt_b_grudge.choice.wait.note',
              affinity: 2,
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_grudge.choice.quiet.label',
              note: 'channels.xt.xt_b_grudge.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r4',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_grudge.line.6' },
            { from: 'peer', text: 'channels.xt.xt_b_grudge.line.7' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_b_grudge.choice.listen.label',
              note: 'channels.xt.xt_b_grudge.choice.listen.note',
              say: 'channels.xt.xt_b_grudge.choice.listen.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r5',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_grudge.choice.quiet.label',
              note: 'channels.xt.xt_b_grudge.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r5',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_grudge.line.8' },
            { from: 'peer', text: 'channels.xt.xt_b_grudge.line.9' },
          ],
          choices: [
            {
              id: 'wait',
              label: 'channels.xt.xt_b_grudge.choice.wait.label',
              note: 'channels.xt.xt_b_grudge.choice.wait.note',
              affinity: 2,
              next: 'r6',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_grudge.choice.quiet.label',
              note: 'channels.xt.xt_b_grudge.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r6',
          out: [{ from: 'peer', text: 'channels.xt.xt_b_grudge.line.10' }],
          choices: [
            {
              id: 'wait',
              label: 'channels.xt.xt_b_grudge.choice.wait.label',
              note: 'channels.xt.xt_b_grudge.choice.wait.note',
              affinity: 2,
              next: 'r7',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_grudge.choice.quiet.label',
              note: 'channels.xt.xt_b_grudge.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r7',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_grudge.line.11' },
            { from: 'peer', text: 'channels.xt.xt_b_grudge.line.12' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_b_grudge.choice.listen.label',
              note: 'channels.xt.xt_b_grudge.choice.listen.note',
              say: 'channels.xt.xt_b_grudge.choice.listen.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r8',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_grudge.choice.quiet.label',
              note: 'channels.xt.xt_b_grudge.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r8',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_grudge.line.13' },
            { from: 'peer', text: 'channels.xt.xt_b_grudge.line.14' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_b_grudge.choice.close.label',
              note: 'channels.xt.xt_b_grudge.choice.close.note',
              say: 'channels.xt.xt_b_grudge.choice.close.say',
              affinity: 3,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_grudge.choice.quiet.label',
              note: 'channels.xt.xt_b_grudge.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 掠夺期：暗号升级（4 轮） ----------
    {
      id: 'xt_c_code',
      stage: [3, 3],
      minBond: 2,
      kind: 'daily',
      need: ['xt_a_knock'],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_c_code.line.1' },
            { from: 'peer', text: 'channels.xt.xt_c_code.line.2' },
          ],
          choices: [
            {
              id: 'sorry',
              label: 'channels.xt.xt_c_code.choice.sorry.label',
              note: 'channels.xt.xt_c_code.choice.sorry.note',
              say: 'channels.xt.xt_c_code.choice.sorry.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_c_code.choice.quiet.label',
              note: 'channels.xt.xt_c_code.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_c_code.line.3' },
            { from: 'peer', text: 'channels.xt.xt_c_code.line.4' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_c_code.choice.ask.label',
              note: 'channels.xt.xt_c_code.choice.ask.note',
              say: 'channels.xt.xt_c_code.choice.ask.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_c_code.choice.quiet.label',
              note: 'channels.xt.xt_c_code.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_c_code.line.5' },
            { from: 'peer', text: 'channels.xt.xt_c_code.line.6' },
          ],
          choices: [
            {
              id: 'ok',
              label: 'channels.xt.xt_c_code.choice.ok.label',
              note: 'channels.xt.xt_c_code.choice.ok.note',
              say: 'channels.xt.xt_c_code.choice.ok.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_c_code.choice.quiet.label',
              note: 'channels.xt.xt_c_code.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r4',
          out: [
            { from: 'peer', text: 'channels.xt.xt_c_code.line.7' },
            { from: 'peer', text: 'channels.xt.xt_c_code.line.8' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_c_code.choice.close.label',
              note: 'channels.xt.xt_c_code.choice.close.note',
              say: 'channels.xt.xt_c_code.choice.close.say',
              affinity: 3,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_c_code.choice.quiet.label',
              note: 'channels.xt.xt_c_code.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 掠夺期关联：妈的腿在楼道里挤伤（5 轮） ----------
    {
      id: 'xt_c_mom_leg',
      stage: [3, 3],
      minBond: 2,
      kind: 'daily',
      need: ['xt_b_mom'],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_c_mom_leg.line.1' },
            { from: 'peer', text: 'channels.xt.xt_c_mom_leg.line.2' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_c_mom_leg.choice.ask.label',
              note: 'channels.xt.xt_c_mom_leg.choice.ask.note',
              say: 'channels.xt.xt_c_mom_leg.choice.ask.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_c_mom_leg.choice.quiet.label',
              note: 'channels.xt.xt_c_mom_leg.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_c_mom_leg.line.3' },
            { from: 'peer', text: 'channels.xt.xt_c_mom_leg.line.4' },
          ],
          choices: [
            {
              id: 'care',
              label: 'channels.xt.xt_c_mom_leg.choice.care.label',
              note: 'channels.xt.xt_c_mom_leg.choice.care.note',
              say: 'channels.xt.xt_c_mom_leg.choice.care.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_c_mom_leg.choice.quiet.label',
              note: 'channels.xt.xt_c_mom_leg.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_c_mom_leg.line.5' },
            { from: 'peer', text: 'channels.xt.xt_c_mom_leg.line.6' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_c_mom_leg.choice.ask.label',
              note: 'channels.xt.xt_c_mom_leg.choice.ask.note',
              say: 'channels.xt.xt_c_mom_leg.choice.ask.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_c_mom_leg.choice.quiet.label',
              note: 'channels.xt.xt_c_mom_leg.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r4',
          out: [
            { from: 'peer', text: 'channels.xt.xt_c_mom_leg.line.7' },
            { from: 'peer', text: 'channels.xt.xt_c_mom_leg.line.8' },
          ],
          choices: [
            {
              id: 'wait',
              label: 'channels.xt.xt_c_mom_leg.choice.wait.label',
              note: 'channels.xt.xt_c_mom_leg.choice.wait.note',
              affinity: 2,
              next: 'r5',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_c_mom_leg.choice.quiet.label',
              note: 'channels.xt.xt_c_mom_leg.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r5',
          out: [
            { from: 'peer', text: 'channels.xt.xt_c_mom_leg.line.9' },
            { from: 'peer', text: 'channels.xt.xt_c_mom_leg.line.10' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_c_mom_leg.choice.close.label',
              note: 'channels.xt.xt_c_mom_leg.choice.close.note',
              say: 'channels.xt.xt_c_mom_leg.choice.close.say',
              affinity: 4,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_c_mom_leg.choice.quiet.label',
              note: 'channels.xt.xt_c_mom_leg.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },
    // ============================================================
    // 量产批次三 · 2026-09-17（严冬/荒芜/死寂三段，蓝图缺口最大的部分）
    // ============================================================

    // ---------- 严冬期：煤球三天没回来（5 轮） ----------
    {
      id: 'xt_d_cat',
      stage: [4, 4],
      minBond: 3,
      kind: 'daily',
      need: ['xt_cat'],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_cat.line.1' },
            { from: 'peer', text: 'channels.xt.xt_d_cat.line.2' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_d_cat.choice.ask.label',
              note: 'channels.xt.xt_d_cat.choice.ask.note',
              say: 'channels.xt.xt_d_cat.choice.ask.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_cat.choice.quiet.label',
              note: 'channels.xt.xt_d_cat.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_cat.line.3' },
            { from: 'peer', text: 'channels.xt.xt_d_cat.line.4' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_d_cat.choice.listen.label',
              note: 'channels.xt.xt_d_cat.choice.listen.note',
              say: 'channels.xt.xt_d_cat.choice.listen.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_cat.choice.quiet.label',
              note: 'channels.xt.xt_d_cat.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_cat.line.5' },
            { from: 'peer', text: 'channels.xt.xt_d_cat.line.6' },
          ],
          choices: [
            {
              id: 'wait',
              label: 'channels.xt.xt_d_cat.choice.wait.label',
              note: 'channels.xt.xt_d_cat.choice.wait.note',
              affinity: 2,
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_cat.choice.quiet.label',
              note: 'channels.xt.xt_d_cat.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r4',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_cat.line.7' },
            { from: 'peer', text: 'channels.xt.xt_d_cat.line.8' },
          ],
          choices: [
            {
              id: 'wait',
              label: 'channels.xt.xt_d_cat.choice.wait.label',
              note: 'channels.xt.xt_d_cat.choice.wait.note',
              affinity: 2,
              next: 'r5',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_cat.choice.quiet.label',
              note: 'channels.xt.xt_d_cat.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r5',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_cat.line.9' },
            { from: 'peer', text: 'channels.xt.xt_d_cat.line.10' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_d_cat.choice.close.label',
              note: 'channels.xt.xt_d_cat.choice.close.note',
              say: 'channels.xt.xt_d_cat.choice.close.say',
              affinity: 3,
              effect: { stats: { sanity: -2 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_cat.choice.quiet.label',
              note: 'channels.xt.xt_d_cat.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 严冬期关联：妈整夜咳（6 轮） ----------
    {
      id: 'xt_d_mom_cough',
      stage: [4, 4],
      minBond: 3,
      kind: 'daily',
      need: ['xt_c_mom_leg'],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_mom_cough.line.1' },
            { from: 'peer', text: 'channels.xt.xt_d_mom_cough.line.2' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_d_mom_cough.choice.ask.label',
              note: 'channels.xt.xt_d_mom_cough.choice.ask.note',
              say: 'channels.xt.xt_d_mom_cough.choice.ask.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_mom_cough.choice.quiet.label',
              note: 'channels.xt.xt_d_mom_cough.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_mom_cough.line.3' },
            { from: 'peer', text: 'channels.xt.xt_d_mom_cough.line.4' },
          ],
          choices: [
            {
              id: 'care',
              label: 'channels.xt.xt_d_mom_cough.choice.care.label',
              note: 'channels.xt.xt_d_mom_cough.choice.care.note',
              say: 'channels.xt.xt_d_mom_cough.choice.care.say',
              affinity: 2,
              effect: { stats: { sanity: -2 }, setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_mom_cough.choice.quiet.label',
              note: 'channels.xt.xt_d_mom_cough.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_mom_cough.line.5' },
            { from: 'peer', text: 'channels.xt.xt_d_mom_cough.line.6' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_d_mom_cough.choice.ask.label',
              note: 'channels.xt.xt_d_mom_cough.choice.ask.note',
              say: 'channels.xt.xt_d_mom_cough.choice.ask.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_mom_cough.choice.quiet.label',
              note: 'channels.xt.xt_d_mom_cough.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r4',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_mom_cough.line.7' },
            { from: 'peer', text: 'channels.xt.xt_d_mom_cough.line.8' },
          ],
          choices: [
            {
              id: 'wait',
              label: 'channels.xt.xt_d_mom_cough.choice.wait.label',
              note: 'channels.xt.xt_d_mom_cough.choice.wait.note',
              affinity: 2,
              next: 'r5',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_mom_cough.choice.quiet.label',
              note: 'channels.xt.xt_d_mom_cough.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r5',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_mom_cough.line.9' },
            { from: 'peer', text: 'channels.xt.xt_d_mom_cough.line.10' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_d_mom_cough.choice.listen.label',
              note: 'channels.xt.xt_d_mom_cough.choice.listen.note',
              say: 'channels.xt.xt_d_mom_cough.choice.listen.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r6',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_mom_cough.choice.quiet.label',
              note: 'channels.xt.xt_d_mom_cough.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r6',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_mom_cough.line.11' },
            { from: 'peer', text: 'channels.xt.xt_d_mom_cough.line.12' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_d_mom_cough.choice.close.label',
              note: 'channels.xt.xt_d_mom_cough.choice.close.note',
              say: 'channels.xt.xt_d_mom_cough.choice.close.say',
              affinity: 4,
              effect: { stats: { sanity: -2 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_mom_cough.choice.quiet.label',
              note: 'channels.xt.xt_d_mom_cough.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 严冬期关联：门改成钉死的木条（6 轮） ----------
    // 她把"顶门"升级成"改门"——这是她第一次主动替**两个人**做打算。
    {
      id: 'xt_d_door',
      stage: [4, 4],
      minBond: 3,
      kind: 'daily',
      need: ['xt_ambush'],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_door.line.1' },
            { from: 'peer', text: 'channels.xt.xt_d_door.line.2' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_d_door.choice.ask.label',
              note: 'channels.xt.xt_d_door.choice.ask.note',
              say: 'channels.xt.xt_d_door.choice.ask.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_door.choice.quiet.label',
              note: 'channels.xt.xt_d_door.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_door.line.3' },
            { from: 'peer', text: 'channels.xt.xt_d_door.line.4' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_d_door.choice.listen.label',
              note: 'channels.xt.xt_d_door.choice.listen.note',
              say: 'channels.xt.xt_d_door.choice.listen.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_door.choice.quiet.label',
              note: 'channels.xt.xt_d_door.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_door.line.5' },
            { from: 'peer', text: 'channels.xt.xt_d_door.line.6' },
          ],
          choices: [
            {
              id: 'care',
              label: 'channels.xt.xt_d_door.choice.care.label',
              note: 'channels.xt.xt_d_door.choice.care.note',
              say: 'channels.xt.xt_d_door.choice.care.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_door.choice.quiet.label',
              note: 'channels.xt.xt_d_door.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r4',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_door.line.7' },
            { from: 'peer', text: 'channels.xt.xt_d_door.line.8' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_d_door.choice.ask.label',
              note: 'channels.xt.xt_d_door.choice.ask.note',
              say: 'channels.xt.xt_d_door.choice.ask.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r5',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_door.choice.quiet.label',
              note: 'channels.xt.xt_d_door.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r5',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_door.line.9' },
            { from: 'peer', text: 'channels.xt.xt_d_door.line.10' },
          ],
          choices: [
            {
              id: 'ok',
              label: 'channels.xt.xt_d_door.choice.ok.label',
              note: 'channels.xt.xt_d_door.choice.ok.note',
              say: 'channels.xt.xt_d_door.choice.ok.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r6',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_door.choice.quiet.label',
              note: 'channels.xt.xt_d_door.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r6',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_door.line.11' },
            { from: 'peer', text: 'channels.xt.xt_d_door.line.12' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_d_door.choice.close.label',
              note: 'channels.xt.xt_d_door.choice.close.note',
              say: 'channels.xt.xt_d_door.choice.close.say',
              affinity: 3,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_door.choice.quiet.label',
              note: 'channels.xt.xt_d_door.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 严冬期：挂历翻到用不上的月份（2 轮） ----------
    {
      id: 'xt_d_newyear',
      stage: [4, 4],
      minBond: 3,
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_newyear.line.1' },
            { from: 'peer', text: 'channels.xt.xt_d_newyear.line.2' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_d_newyear.choice.listen.label',
              note: 'channels.xt.xt_d_newyear.choice.listen.note',
              say: 'channels.xt.xt_d_newyear.choice.listen.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_newyear.choice.quiet.label',
              note: 'channels.xt.xt_d_newyear.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_d_newyear.line.3' },
            { from: 'peer', text: 'channels.xt.xt_d_newyear.line.4' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_d_newyear.choice.close.label',
              note: 'channels.xt.xt_d_newyear.choice.close.note',
              say: 'channels.xt.xt_d_newyear.choice.close.say',
              affinity: 3,
              effect: { stats: { sanity: 3 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_d_newyear.choice.quiet.label',
              note: 'channels.xt.xt_d_newyear.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 荒芜期：第一个隔天（3 轮） ----------
    {
      id: 'xt_e_silence',
      stage: [5, 5],
      minBond: 3,
      kind: 'daily',
      need: ['xt_e_lastcell'],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_e_silence.line.1' },
            { from: 'peer', text: 'channels.xt.xt_e_silence.line.2' },
          ],
          choices: [
            {
              id: 'wait',
              label: 'channels.xt.xt_e_silence.choice.wait.label',
              note: 'channels.xt.xt_e_silence.choice.wait.note',
              affinity: 1,
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_e_silence.choice.quiet.label',
              note: 'channels.xt.xt_e_silence.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_e_silence.line.3' },
            { from: 'peer', text: 'channels.xt.xt_e_silence.line.4' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_e_silence.choice.listen.label',
              note: 'channels.xt.xt_e_silence.choice.listen.note',
              say: 'channels.xt.xt_e_silence.choice.listen.say',
              affinity: 2,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_e_silence.choice.quiet.label',
              note: 'channels.xt.xt_e_silence.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_e_silence.line.5' },
            { from: 'peer', text: 'channels.xt.xt_e_silence.line.6' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_e_silence.choice.close.label',
              note: 'channels.xt.xt_e_silence.choice.close.note',
              say: 'channels.xt.xt_e_silence.choice.close.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_e_silence.choice.quiet.label',
              note: 'channels.xt.xt_e_silence.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 荒芜期：她只报一个字（6 轮） ----------
    // 蓝图原句：「她不问电了，开口只报一个字：在」。全线最短的开场，也是最重的。
    {
      id: 'xt_e_voice',
      stage: [5, 5],
      minBond: 4,
      kind: 'daily',
      need: ['xt_b_grudge'],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [{ from: 'peer', text: 'channels.xt.xt_e_voice.line.1' }],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_e_voice.choice.ask.label',
              note: 'channels.xt.xt_e_voice.choice.ask.note',
              say: 'channels.xt.xt_e_voice.choice.ask.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_e_voice.choice.quiet.label',
              note: 'channels.xt.xt_e_voice.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [{ from: 'peer', text: 'channels.xt.xt_e_voice.line.2' }],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_e_voice.choice.listen.label',
              note: 'channels.xt.xt_e_voice.choice.listen.note',
              say: 'channels.xt.xt_e_voice.choice.listen.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_e_voice.choice.quiet.label',
              note: 'channels.xt.xt_e_voice.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [{ from: 'peer', text: 'channels.xt.xt_e_voice.line.3' }],
          choices: [
            {
              id: 'ok',
              label: 'channels.xt.xt_e_voice.choice.ok.label',
              note: 'channels.xt.xt_e_voice.choice.ok.note',
              say: 'channels.xt.xt_e_voice.choice.ok.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_e_voice.choice.quiet.label',
              note: 'channels.xt.xt_e_voice.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r4',
          out: [{ from: 'peer', text: 'channels.xt.xt_e_voice.line.4' }],
          choices: [
            {
              id: 'wait',
              label: 'channels.xt.xt_e_voice.choice.wait.label',
              note: 'channels.xt.xt_e_voice.choice.wait.note',
              affinity: 2,
              next: 'r5',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_e_voice.choice.quiet.label',
              note: 'channels.xt.xt_e_voice.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r5',
          out: [
            { from: 'peer', text: 'channels.xt.xt_e_voice.line.5' },
            { from: 'peer', text: 'channels.xt.xt_e_voice.line.6' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_e_voice.choice.listen.label',
              note: 'channels.xt.xt_e_voice.choice.listen.note',
              say: 'channels.xt.xt_e_voice.choice.listen.say',
              affinity: 3,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
              next: 'r6',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_e_voice.choice.quiet.label',
              note: 'channels.xt.xt_e_voice.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          // 只说满了一句，她自己就慌了——「话别说太满」是她的旧规矩。
          id: 'r6',
          out: [
            { from: 'peer', text: 'channels.xt.xt_e_voice.line.7' },
            { from: 'peer', text: 'channels.xt.xt_e_voice.line.8' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_e_voice.choice.close.label',
              note: 'channels.xt.xt_e_voice.choice.close.note',
              say: 'channels.xt.xt_e_voice.choice.close.say',
              affinity: 3,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_e_voice.choice.quiet.label',
              note: 'channels.xt.xt_e_voice.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 死寂期：只剩两下敲击（2 轮） ----------
    {
      id: 'xt_f_quiet',
      stage: [6, 6],
      minBond: 3,
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [{ from: 'peer', text: 'channels.xt.xt_f_quiet.line.1' }],
          choices: [
            {
              id: 'knock',
              label: 'channels.xt.xt_f_quiet.choice.knock.label',
              note: 'channels.xt.xt_f_quiet.choice.knock.note',
              say: 'channels.xt.xt_f_quiet.choice.knock.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_f_quiet.choice.quiet.label',
              note: 'channels.xt.xt_f_quiet.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [{ from: 'peer', text: 'channels.xt.xt_f_quiet.line.2' }],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_f_quiet.choice.close.label',
              note: 'channels.xt.xt_f_quiet.choice.close.note',
              say: 'channels.xt.xt_f_quiet.choice.close.say',
              affinity: 3,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_f_quiet.choice.quiet.label',
              note: 'channels.xt.xt_f_quiet.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 死寂期：收音机彻底停了（4 轮·暗号线收束） ----------
    {
      id: 'xt_f_power',
      stage: [6, 6],
      minBond: 3,
      kind: 'daily',
      need: ['xt_e_lastcell'],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_f_power.line.1' },
            { from: 'peer', text: 'channels.xt.xt_f_power.line.2' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_f_power.choice.ask.label',
              note: 'channels.xt.xt_f_power.choice.ask.note',
              say: 'channels.xt.xt_f_power.choice.ask.say',
              affinity: 1,
              effect: { stats: { sanity: -3 }, setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_f_power.choice.quiet.label',
              note: 'channels.xt.xt_f_power.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_f_power.line.3' },
            { from: 'peer', text: 'channels.xt.xt_f_power.line.4' },
          ],
          choices: [
            {
              id: 'ok',
              label: 'channels.xt.xt_f_power.choice.ok.label',
              note: 'channels.xt.xt_f_power.choice.ok.note',
              say: 'channels.xt.xt_f_power.choice.ok.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_f_power.choice.quiet.label',
              note: 'channels.xt.xt_f_power.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_f_power.line.5' },
            { from: 'peer', text: 'channels.xt.xt_f_power.line.6' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_f_power.choice.listen.label',
              note: 'channels.xt.xt_f_power.choice.listen.note',
              say: 'channels.xt.xt_f_power.choice.listen.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_f_power.choice.quiet.label',
              note: 'channels.xt.xt_f_power.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r4',
          out: [
            { from: 'peer', text: 'channels.xt.xt_f_power.line.7' },
            { from: 'peer', text: 'channels.xt.xt_f_power.line.8' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_f_power.choice.close.label',
              note: 'channels.xt.xt_f_power.choice.close.note',
              say: 'channels.xt.xt_f_power.choice.close.say',
              affinity: 3,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_f_power.choice.quiet.label',
              note: 'channels.xt.xt_f_power.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 死寂期：没人拦她了（6 轮·"走不走"的分支种子） ----------
    {
      id: 'xt_f_leave',
      stage: [6, 6],
      minBond: 4,
      kind: 'daily',
      need: ['xt_e_outside'],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_f_leave.line.1' },
            { from: 'peer', text: 'channels.xt.xt_f_leave.line.2' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_f_leave.choice.listen.label',
              note: 'channels.xt.xt_f_leave.choice.listen.note',
              say: 'channels.xt.xt_f_leave.choice.listen.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_f_leave.choice.quiet.label',
              note: 'channels.xt.xt_f_leave.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_f_leave.line.3' },
            { from: 'peer', text: 'channels.xt.xt_f_leave.line.4' },
          ],
          choices: [
            {
              id: 'wait',
              label: 'channels.xt.xt_f_leave.choice.wait.label',
              note: 'channels.xt.xt_f_leave.choice.wait.note',
              affinity: 2,
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_f_leave.choice.quiet.label',
              note: 'channels.xt.xt_f_leave.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_f_leave.line.5' },
            { from: 'peer', text: 'channels.xt.xt_f_leave.line.6' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_f_leave.choice.listen.label',
              note: 'channels.xt.xt_f_leave.choice.listen.note',
              say: 'channels.xt.xt_f_leave.choice.listen.say',
              affinity: 2,
              effect: { stats: { sanity: -2 }, setFlags: ['flag:xtReplied'] },
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_f_leave.choice.quiet.label',
              note: 'channels.xt.xt_f_leave.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          // 全线唯一一次她直接把决定交出来：「你说我走吗」。
          id: 'r4',
          out: [{ from: 'peer', text: 'channels.xt.xt_f_leave.line.7' }],
          choices: [
            {
              id: 'stay',
              label: 'channels.xt.xt_f_leave.choice.stay.label',
              note: 'channels.xt.xt_f_leave.choice.stay.note',
              say: 'channels.xt.xt_f_leave.choice.stay.say',
              affinity: 3,
              // 注：劝留分支的 flag 先不新建（rule：「只写有下游消费者的 flag」）。
              // xt_f_end 落地时再把这里换成 flag:xtStayed。
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
              next: 'r5',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_f_leave.choice.quiet.label',
              note: 'channels.xt.xt_f_leave.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r5',
          out: [
            { from: 'peer', text: 'channels.xt.xt_f_leave.line.8' },
            { from: 'peer', text: 'channels.xt.xt_f_leave.line.9' },
          ],
          choices: [
            {
              id: 'wait',
              label: 'channels.xt.xt_f_leave.choice.wait.label',
              note: 'channels.xt.xt_f_leave.choice.wait.note',
              affinity: 2,
              next: 'r6',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_f_leave.choice.quiet.label',
              note: 'channels.xt.xt_f_leave.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r6',
          out: [
            { from: 'peer', text: 'channels.xt.xt_f_leave.line.10' },
            { from: 'peer', text: 'channels.xt.xt_f_leave.line.11' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_f_leave.choice.close.label',
              note: 'channels.xt.xt_f_leave.choice.close.note',
              say: 'channels.xt.xt_f_leave.choice.close.say',
              affinity: 4,
              effect: { stats: { sanity: 3 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_f_leave.choice.quiet.label',
              note: 'channels.xt.xt_f_leave.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },
    // ============================================================
    // 量产批次四 · 2026-09-17（恐慌/匮乏/掠夺三段剩余）
    // ============================================================

    // ---------- 恐慌期：她确认了那栋楼（2 轮） ----------
    {
      id: 'xt_a_east_after',
      stage: [1, 1],
      minBond: 2,
      kind: 'daily',
      need: ['xt_a_east'],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_a_east_after.line.1' },
            { from: 'peer', text: 'channels.xt.xt_a_east_after.line.2' },
          ],
          choices: [
            {
              id: 'yes',
              label: 'channels.xt.xt_a_east_after.choice.yes.label',
              note: 'channels.xt.xt_a_east_after.choice.yes.note',
              say: 'channels.xt.xt_a_east_after.choice.yes.say',
              affinity: 2,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_east_after.choice.quiet.label',
              note: 'channels.xt.xt_a_east_after.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_a_east_after.line.3' },
            { from: 'peer', text: 'channels.xt.xt_a_east_after.line.4' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_a_east_after.choice.close.label',
              note: 'channels.xt.xt_a_east_after.choice.close.note',
              say: 'channels.xt.xt_a_east_after.choice.close.say',
              affinity: 3,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_east_after.choice.quiet.label',
              note: 'channels.xt.xt_a_east_after.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 恐慌期：第二天她补一句（2 轮·承接 xt_afraid） ----------
    // 蓝图把它排在恐慌期，但它必须接在"她第一次承认怕"之后，所以挂 xt_afraid 的阶段。
    {
      id: 'xt_a_quiet',
      stage: [4, 4],
      minBond: 2,
      kind: 'daily',
      need: ['xt_afraid'],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_a_quiet.line.1' },
            { from: 'peer', text: 'channels.xt.xt_a_quiet.line.2' },
          ],
          choices: [
            {
              id: 'care',
              label: 'channels.xt.xt_a_quiet.choice.care.label',
              note: 'channels.xt.xt_a_quiet.choice.care.note',
              say: 'channels.xt.xt_a_quiet.choice.care.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_quiet.choice.quiet.label',
              note: 'channels.xt.xt_a_quiet.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_a_quiet.line.3' },
            { from: 'peer', text: 'channels.xt.xt_a_quiet.line.4' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_a_quiet.choice.close.label',
              note: 'channels.xt.xt_a_quiet.choice.close.note',
              say: 'channels.xt.xt_a_quiet.choice.close.say',
              affinity: 3,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_a_quiet.choice.quiet.label',
              note: 'channels.xt.xt_a_quiet.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 匮乏期：猫粮见底（3 轮） ----------
    {
      id: 'xt_b_catfood',
      stage: [2, 2],
      minBond: 2,
      kind: 'daily',
      need: ['xt_cat'],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_catfood.line.1' },
            { from: 'peer', text: 'channels.xt.xt_b_catfood.line.2' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_b_catfood.choice.ask.label',
              note: 'channels.xt.xt_b_catfood.choice.ask.note',
              say: 'channels.xt.xt_b_catfood.choice.ask.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_catfood.choice.quiet.label',
              note: 'channels.xt.xt_b_catfood.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_catfood.line.3' },
            { from: 'peer', text: 'channels.xt.xt_b_catfood.line.4' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_b_catfood.choice.listen.label',
              note: 'channels.xt.xt_b_catfood.choice.listen.note',
              say: 'channels.xt.xt_b_catfood.choice.listen.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_catfood.choice.quiet.label',
              note: 'channels.xt.xt_b_catfood.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_catfood.line.5' },
            { from: 'peer', text: 'channels.xt.xt_b_catfood.line.6' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_b_catfood.choice.close.label',
              note: 'channels.xt.xt_b_catfood.choice.close.note',
              say: 'channels.xt.xt_b_catfood.choice.close.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_catfood.choice.quiet.label',
              note: 'channels.xt.xt_b_catfood.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 匮乏期：她想拿妈缝的东西换电池（4 轮） ----------
    {
      id: 'xt_b_trade',
      stage: [2, 2],
      minBond: 2,
      kind: 'request',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_trade.line.1' },
            { from: 'peer', text: 'channels.xt.xt_b_trade.line.2' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_b_trade.choice.ask.label',
              note: 'channels.xt.xt_b_trade.choice.ask.note',
              say: 'channels.xt.xt_b_trade.choice.ask.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_trade.choice.quiet.label',
              note: 'channels.xt.xt_b_trade.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_trade.line.3' },
            { from: 'peer', text: 'channels.xt.xt_b_trade.line.4' },
          ],
          choices: [
            {
              id: 'more',
              label: 'channels.xt.xt_b_trade.choice.more.label',
              note: 'channels.xt.xt_b_trade.choice.more.note',
              say: 'channels.xt.xt_b_trade.choice.more.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_trade.choice.quiet.label',
              note: 'channels.xt.xt_b_trade.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_trade.line.5' },
            { from: 'peer', text: 'channels.xt.xt_b_trade.line.6' },
          ],
          choices: [
            {
              id: 'give',
              label: 'channels.xt.xt_b_trade.choice.give.label',
              note: 'channels.xt.xt_b_trade.choice.give.note',
              say: 'channels.xt.xt_b_trade.choice.give.say',
              affinity: 6,
              effect: { stats: { sanity: 3 }, setFlags: ['flag:xtReplied'], tone: 'good' },
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_trade.choice.quiet.label',
              note: 'channels.xt.xt_b_trade.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r4',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_trade.line.7' },
            { from: 'peer', text: 'channels.xt.xt_b_trade.line.8' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_b_trade.choice.close.label',
              note: 'channels.xt.xt_b_trade.choice.close.note',
              say: 'channels.xt.xt_b_trade.choice.close.say',
              affinity: 2,
              effect: { setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_trade.choice.quiet.label',
              note: 'channels.xt.xt_b_trade.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },

    // ---------- 匮乏期：能收到的台越来越少（4 轮） ----------
    {
      id: 'xt_b_listen',
      stage: [2, 2],
      minBond: 2,
      kind: 'daily',
      need: ['xt_a_song'],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_listen.line.1' },
            { from: 'peer', text: 'channels.xt.xt_b_listen.line.2' },
          ],
          choices: [
            {
              id: 'ask',
              label: 'channels.xt.xt_b_listen.choice.ask.label',
              note: 'channels.xt.xt_b_listen.choice.ask.note',
              say: 'channels.xt.xt_b_listen.choice.ask.say',
              affinity: 1,
              effect: { setFlags: ['flag:xtReplied'] },
              next: 'r2',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_listen.choice.quiet.label',
              note: 'channels.xt.xt_b_listen.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r2',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_listen.line.3' },
            { from: 'peer', text: 'channels.xt.xt_b_listen.line.4' },
          ],
          choices: [
            {
              id: 'listen',
              label: 'channels.xt.xt_b_listen.choice.listen.label',
              note: 'channels.xt.xt_b_listen.choice.listen.note',
              say: 'channels.xt.xt_b_listen.choice.listen.say',
              affinity: 2,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
              next: 'r3',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_listen.choice.quiet.label',
              note: 'channels.xt.xt_b_listen.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r3',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_listen.line.5' },
            { from: 'peer', text: 'channels.xt.xt_b_listen.line.6' },
          ],
          choices: [
            {
              id: 'wait',
              label: 'channels.xt.xt_b_listen.choice.wait.label',
              note: 'channels.xt.xt_b_listen.choice.wait.note',
              affinity: 2,
              next: 'r4',
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_listen.choice.quiet.label',
              note: 'channels.xt.xt_b_listen.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
        {
          id: 'r4',
          out: [
            { from: 'peer', text: 'channels.xt.xt_b_listen.line.7' },
            { from: 'peer', text: 'channels.xt.xt_b_listen.line.8' },
          ],
          choices: [
            {
              id: 'close',
              label: 'channels.xt.xt_b_listen.choice.close.label',
              note: 'channels.xt.xt_b_listen.choice.close.note',
              say: 'channels.xt.xt_b_listen.choice.close.say',
              affinity: 2,
              effect: { stats: { sanity: 2 }, setFlags: ['flag:xtReplied'] },
            },
            {
              id: 'quiet',
              label: 'channels.xt.xt_b_listen.choice.quiet.label',
              note: 'channels.xt.xt_b_listen.choice.quiet.note',
              affinity: -2,
            },
          ],
        },
      ],
    },
  ],
};
