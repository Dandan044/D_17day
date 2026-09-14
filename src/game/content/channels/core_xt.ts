import type { ChannelDef } from '../../types';

/**
 * 她没了的那个结局。**几个事件里各有一份 `r_dead` 轮，共用这一份文案**——
 * 新模型里一轮只属于一个事件，但文案键可以共享。
 */
const DEAD_LINES = [
  { from: 'peer' as const, sys: 'narrate' as const, text: 'channels.xt.xt_dead.line.1', onRead: { stats: { sanity: -14 }, tone: 'grim' as const } },
  { from: 'peer' as const, sys: 'narrate' as const, text: 'channels.xt.xt_dead.line.2' },
  { from: 'peer' as const, sys: 'silent' as const, text: 'channels.xt.sys.lost' },
];

/**
 * 核心频道 · 小桃（**事件制**）。
 *
 * 隔壁楼 19 岁女生，一个人在家。这条线不提供任何解法，只提供一个人。
 *
 * ## 结构
 * 每个事件 = 开场 + 若干轮 + 明确结局。**没有 `choices` 的轮就是最后一轮**。
 * 轮与轮之间是即时的——要表达"她过了几天才回"，在该轮写 `delayDays`。
 * 日历（`at`）只管**事件什么时候开始**；事件一旦开始，日历就不再插手。
 *
 * ## 刻意的设计
 * - **第 9 天那件是"等你先开口"**（`awaitPlayerOpen`）：她喊「有人吗」喊进空频道，
 *   你应她一声，这件事才算开始。你不应，它会按 `replyWindowDays` 超时收场。
 * - **第 32 天的求救是固定日，但前提是好感度与交心事件**。前提不够时，玩家收到的不是求救，
 *   而是 `xt_silent` 那条「永久静默」——系统永远不会告诉他「因为你好感度不够所以她死了」。
 *   想搞明白只能重开一局。
 * - 她死后那条链（`r_dead`）**在几个事件里各有一份**：新模型里一轮只属于一个事件，
 *   但**文案键可以共用**，所以不会多出文案。
 *
 * 关键节点：
 *   9   试音（等你先开口）   11  电池    15  交心（前置）   23  物资求助
 *   26  离线回归（只在全程没回过时触发）
 *   28  夜里害怕            32  袭击（固定日；不满足门槛 → xt_silent）
 *   36+ 存活线（她活着才有的日常）
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
    {
      id: 'xt_hello',
      at: 9,
      kind: 'open',
      opening: [
        { from: 'peer', text: 'channels.xt.xt_hello.line.1' },
        { from: 'peer', text: 'channels.xt.xt_hello.line.2' },
        { from: 'peer', text: 'channels.xt.xt_hello.line.3' },
        { from: 'peer', text: 'channels.xt.xt_hello.line.4' },
      ],
      // 等你先开口。「有人吗」是喊给空频道的，回不回在你。
      // 一直不回 → 按 replyWindowDays 超时收场；第 26 天那条离线回归正是为这条路写的。
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
          // 你不出声，她也会自己把话说下去——一个人守着唯一一个活着的台就是这个样子
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
        },
        {
          id: 'r_quiet',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_hello_quiet.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_hello_quiet.line.2' },
          ],
        },
      ],
    },

    // ---------- 第 11 天：还撑得住吗 ----------
    {
      id: 'xt_power',
      at: 11,
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
              effect: { setFlags: ['flag:xtLied', 'flag:xtReplied'] },
              next: 'r_lie',
            },
          ],
        },
        {
          id: 'r_honest',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_power_honest.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_power_honest.line.2' },
          ],
        },
        {
          // 她信了。这句谎不会当场被戳穿——它挂在 flag:xtLied 上等后面还
          id: 'r_lie',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_power_lie.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_power_lie.line.2' },
          ],
        },
      ],
    },

    // ---------- 13 / 17 / 19 / 21：她的日常（单轮事件，说完就完） ----------
    {
      id: 'xt_daily_a',
      at: 13,
      need: ['xt_hello'],
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_daily_a.line.1' },
            { from: 'peer', text: 'channels.xt.xt_daily_a.line.2', onRead: { stats: { sanity: 2 }, tone: 'neutral' } },
          ],
        },
      ],
    },

    // ---------- 第 15 天：交心（后面物资求助与求救的前置） ----------
    {
      id: 'xt_share',
      at: 15,
      need: ['xt_hello'],
      kind: 'request',
      opening: [
        { from: 'peer', text: 'channels.xt.xt_share.line.1' },
        { from: 'peer', text: 'channels.xt.xt_share.line.2' },
        { from: 'peer', text: 'channels.xt.xt_share.line.3' },
        { from: 'peer', text: 'channels.xt.xt_share.line.4' },
      ],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [],
          choices: [
            {
              id: 'share',
              label: 'channels.xt.xt_share.choice.share.label',
              note: 'channels.xt.xt_share.choice.share.note',
              say: 'channels.xt.xt_share.choice.share.say',
              affinity: 12,
              effect: { stats: { sanity: 4 }, setFlags: ['flag:xtShared', 'flag:xtReplied'], tone: 'good' },
              next: 'r_share',
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
          ],
        },
        {
          id: 'r_share',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_share_share.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_share_share.line.2' },
            { from: 'peer', text: 'channels.xt.xt_re_share_share.line.3' },
          ],
        },
        {
          id: 'r_brush',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_share_brush.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_share_brush.line.2' },
          ],
        },
      ],
    },
    {
      id: 'xt_daily_b',
      at: 17,
      need: ['xt_hello'],
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_daily_b.line.1' },
            { from: 'peer', text: 'channels.xt.xt_daily_b.line.2' },
          ],
        },
      ],
    },
    {
      id: 'xt_daily_c',
      at: 19,
      need: ['xt_hello'],
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_daily_c.line.1' },
            { from: 'peer', text: 'channels.xt.xt_daily_c.line.2', onRead: { stats: { sanity: 2 }, tone: 'neutral' } },
          ],
        },
      ],
    },
    {
      id: 'xt_daily_d',
      at: 21,
      need: ['xt_hello'],
      kind: 'daily',
      first: 'r1',
      rounds: [{ id: 'r1', out: [{ from: 'peer', text: 'channels.xt.xt_daily_d.line.1' }] }],
    },

    // ---------- 第 23 天：开口要东西。她要得越具体，拒绝越难看 ----------
    {
      id: 'xt_request',
      at: 23,
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
                setFlags: ['flag:xtFed', 'flag:xtReplied'],
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
              effect: { stats: { sanity: -4 }, setFlags: ['flag:xtRefused', 'flag:xtReplied'], tone: 'bad' },
              next: 'r_refuse',
            },
            {
              id: 'mute',
              label: 'channels.xt.xt_request.choice.mute.label',
              note: 'channels.xt.xt_request.choice.mute.note',
              affinity: -6,
              effect: { stats: { sanity: -3 }, setFlags: ['flag:xtReplied'], tone: 'grim' },
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
        },
        {
          id: 'r_refuse',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_req_refuse.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_req_refuse.line.2' },
          ],
        },
        {
          id: 'r_mute',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_req_mute.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_req_mute.line.2' },
            { from: 'peer', text: 'channels.xt.xt_re_req_mute.line.3' },
          ],
        },
      ],
    },

    // ---------- 第 25 天：她的回礼 ----------
    {
      id: 'xt_gift',
      at: 25,
      need: ['xt_request'],
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_gift.line.1' },
            { from: 'peer', text: 'channels.xt.xt_gift.line.2', onRead: { stats: { sanity: 3 }, tone: 'good' } },
          ],
        },
      ],
    },

    // ---------- 第 26 天：离线回归（只在全程没回过话时出现——她一个人把话说了下去） ----------
    {
      id: 'xt_reconnect',
      at: 26,
      need: ['xt_gift'],
      require: { none: ['flag:xtReplied'] },
      kind: 'request',
      opening: [
        { from: 'peer', text: 'channels.xt.xt_reconnect.line.1' },
        { from: 'peer', text: 'channels.xt.xt_reconnect.line.2' },
        { from: 'peer', text: 'channels.xt.xt_reconnect.line.3' },
        { from: 'peer', text: 'channels.xt.xt_reconnect.line.4' },
        { from: 'peer', text: 'channels.xt.xt_reconnect.line.5' },
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
        { id: 'r_dead', silence: true, out: DEAD_LINES },
      ],
    },

    // ---------- 第 28 天：夜里害怕 ----------
    {
      id: 'xt_afraid',
      at: 28,
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
        },
      ],
    },

    // ---------- 第 32 天：袭击。**一个真正的多轮事件**：求救 → 你怎么去 → 结果 ----------
    {
      id: 'xt_ambush',
      at: 32,
      need: ['xt_share'],
      // 前置不够就不是求救，而是静默：事情照样发生，只是没有你的位置
      minAffinity: 40,
      elseEvent: 'xt_silent',
      kind: 'crisis',
      opening: [
        { from: 'peer', text: 'channels.xt.xt_ambush.line.1' },
        { from: 'peer', text: 'channels.xt.xt_ambush.line.2' },
        { from: 'peer', text: 'channels.xt.xt_ambush.line.3' },
      ],
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [],
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
              id: 'soothe',
              label: 'channels.xt.xt_ambush.choice.soothe.label',
              note: 'channels.xt.xt_ambush.choice.soothe.note',
              say: 'channels.xt.xt_ambush.choice.soothe.say',
              affinity: 4,
              next: 'r_soothe',
            },
            {
              id: 'ignore',
              label: 'channels.xt.xt_ambush.choice.ignore.label',
              note: 'channels.xt.xt_ambush.choice.ignore.note',
              affinity: -10,
              next: 'r_dead',
            },
          ],
        },
        {
          // 第二轮的对方台词是旁白：你正在穿过楼道，她那边没有回话
          id: 'r_go',
          out: [
            { from: 'peer', sys: 'narrate', text: 'channels.xt.xt_go.line.1' },
            { from: 'peer', sys: 'narrate', text: 'channels.xt.xt_go.line.2' },
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
              id: 'wait',
              label: 'channels.xt.xt_go.choice.wait.label',
              note: 'channels.xt.xt_go.choice.wait.note',
              say: 'channels.xt.xt_go.choice.wait.say',
              affinity: 2,
              next: 'r_wait',
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
        // 三种结果都是"她活着"，但门槛不同：好感度不够就走 r_dead
        {
          id: 'r_up',
          minAffinity: 55,
          elseRound: 'r_dead',
          out: [
            { from: 'peer', sys: 'narrate', text: 'channels.xt.xt_up.line.1' },
            {
              from: 'peer',
              sys: 'narrate',
              text: 'channels.xt.xt_up.line.2',
              onRead: { stats: { sanity: 8 }, setFlags: ['flag:xtAlive'], tone: 'good' },
            },
          ],
        },
        {
          id: 'r_wait',
          minAffinity: 45,
          elseRound: 'r_dead',
          out: [
            { from: 'peer', sys: 'narrate', text: 'channels.xt.xt_wait.line.1' },
            {
              from: 'peer',
              sys: 'narrate',
              text: 'channels.xt.xt_wait.line.2',
              onRead: { stats: { sanity: 6 }, setFlags: ['flag:xtAlive'], tone: 'good' },
            },
          ],
        },
        {
          id: 'r_soothe',
          minAffinity: 50,
          elseRound: 'r_dead',
          out: [
            { from: 'peer', sys: 'narrate', text: 'channels.xt.xt_soothe.line.1' },
            {
              from: 'peer',
              sys: 'narrate',
              text: 'channels.xt.xt_soothe.line.2',
              onRead: { stats: { sanity: 3 }, setFlags: ['flag:xtAlive'], tone: 'neutral' },
            },
          ],
        },
        { id: 'r_dead', silence: true, out: DEAD_LINES },
      ],
    },

    // ---------- 门槛不够时的替代事件：不是求救，是静默 ----------
    // 没有时间锚 → 永远不会自己到点，只能被 xt_ambush 的 elseEvent 带出来。
    {
      id: 'xt_silent',
      silence: true,
      kind: 'end',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_silent.line.1' },
            { from: 'peer', sys: 'narrate', text: 'channels.xt.xt_silent.line.2', onRead: { stats: { sanity: -6 }, tone: 'grim' } },
            { from: 'peer', sys: 'silent', text: 'channels.xt.sys.lost' },
          ],
        },
      ],
    },

    // ---------- 存活线：她活着才有的日常 ----------
    {
      id: 'xt_live_a',
      at: 36,
      require: { any: ['flag:xtAlive'] },
      kind: 'daily',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_live_a.line.1' },
            { from: 'peer', text: 'channels.xt.xt_live_a.line.2', onRead: { stats: { sanity: 3 }, tone: 'good' } },
          ],
        },
      ],
    },
    {
      id: 'xt_live_b',
      at: 40,
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
              effect: { stats: { sanity: 3 }, setFlags: ['flag:xtHope'], tone: 'good' },
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
        },
        {
          id: 'r_plain',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_liveb_plain.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_liveb_plain.line.2' },
          ],
        },
        {
          id: 'r_silent',
          out: [
            { from: 'peer', text: 'channels.xt.xt_re_liveb_silent.line.1' },
            { from: 'peer', text: 'channels.xt.xt_re_liveb_silent.line.2' },
          ],
        },
      ],
    },
    {
      id: 'xt_live_c',
      at: 45,
      require: { any: ['flag:xtAlive'] },
      kind: 'daily',
      first: 'r1',
      rounds: [
        { id: 'r1', out: [{ from: 'peer', text: 'channels.xt.xt_live_c.line.1', onRead: { stats: { sanity: 2 }, tone: 'neutral' } }] },
      ],
    },
    {
      id: 'xt_epilogue',
      at: 48,
      require: { any: ['flag:xtAlive'] },
      kind: 'end',
      first: 'r1',
      rounds: [
        {
          id: 'r1',
          out: [
            { from: 'peer', text: 'channels.xt.xt_epilogue.line.1' },
            { from: 'peer', text: 'channels.xt.xt_epilogue.line.2', onRead: { stats: { sanity: 4 }, tone: 'good' } },
          ],
        },
      ],
    },
  ],
};
