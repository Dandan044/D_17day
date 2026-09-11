import type { ChannelDef } from '../../types';

/**
 * 核心频道 · 小桃。
 *
 * 隔壁楼 19 岁女生，一个人在家。这条线不提供任何解法，只提供一个人。
 *
 * 结构上有一个刻意的设计：**第 32 天的求救是固定日，但前提是好感度与交心拍**。
 * 前提不够时，玩家收到的不是求救，而是一条「永久静默」——系统永远不会告诉他
 * 「因为你好感度不够所以她死了」。想搞明白只能重开一局。
 *
 * 关键节点：
 *   9   试音        15  交心（前置）    23  物资求助    28  夜里害怕
 *   26  离线回归（只在全程没回过时触发）
 *   32  袭击（固定日，minAffinity 40 + 交心；不满足 → xt_silent）
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
  beats: [
    {
      id: 'xt_hello',
      at: 9,
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.xt.xt_hello.line.1' },
        { from: 'peer', text: 'channels.xt.xt_hello.line.2' },
        { from: 'peer', text: 'channels.xt.xt_hello.line.3' },
        { from: 'peer', text: 'channels.xt.xt_hello.line.4' },
      ],
      choices: [
        {
          id: 'hi',
          label: 'channels.xt.xt_hello.choice.hi.label',
          note: 'channels.xt.xt_hello.choice.hi.note',
          say: 'channels.xt.xt_hello.choice.hi.say',
          affinity: 4,
          effect: { setFlags: ['flag:xtReplied'] },
        },
        {
          id: 'shh',
          label: 'channels.xt.xt_hello.choice.shh.label',
          note: 'channels.xt.xt_hello.choice.shh.note',
          affinity: -2,
        },
      ],
    },
    {
      id: 'xt_power',
      at: 11,
      need: ['xt_hello'],
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.xt.xt_power.line.1' },
        { from: 'peer', text: 'channels.xt.xt_power.line.2' },
      ],
      choices: [
        {
          id: 'honest',
          label: 'channels.xt.xt_power.choice.honest.label',
          note: 'channels.xt.xt_power.choice.honest.note',
          say: 'channels.xt.xt_power.choice.honest.say',
          affinity: 6,
          effect: { setFlags: ['flag:xtReplied'] },
        },
        {
          id: 'lie',
          label: 'channels.xt.xt_power.choice.lie.label',
          note: 'channels.xt.xt_power.choice.lie.note',
          say: 'channels.xt.xt_power.choice.lie.say',
          affinity: 2,
          effect: { setFlags: ['flag:xtLied', 'flag:xtReplied'] },
        },
      ],
    },
    {
      id: 'xt_daily_a',
      at: 13,
      need: ['xt_hello'],
      out: [
        { from: 'peer', text: 'channels.xt.xt_daily_a.line.1' },
        { from: 'peer', text: 'channels.xt.xt_daily_a.line.2', onRead: { stats: { sanity: 2 }, tone: 'neutral' } },
      ],
    },
    {
      id: 'xt_share',
      at: 15,
      need: ['xt_hello'],
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.xt.xt_share.line.1' },
        { from: 'peer', text: 'channels.xt.xt_share.line.2' },
        { from: 'peer', text: 'channels.xt.xt_share.line.3' },
        { from: 'peer', text: 'channels.xt.xt_share.line.4' },
      ],
      choices: [
        {
          id: 'share',
          label: 'channels.xt.xt_share.choice.share.label',
          note: 'channels.xt.xt_share.choice.share.note',
          say: 'channels.xt.xt_share.choice.share.say',
          affinity: 12,
          effect: { stats: { sanity: 4 }, setFlags: ['flag:xtShared', 'flag:xtReplied'], tone: 'good' },
        },
        {
          id: 'brush',
          label: 'channels.xt.xt_share.choice.brush.label',
          note: 'channels.xt.xt_share.choice.brush.note',
          say: 'channels.xt.xt_share.choice.brush.say',
          affinity: 2,
          effect: { setFlags: ['flag:xtReplied'] },
        },
      ],
    },
    {
      id: 'xt_daily_b',
      at: 17,
      need: ['xt_hello'],
      out: [
        { from: 'peer', text: 'channels.xt.xt_daily_b.line.1' },
        { from: 'peer', text: 'channels.xt.xt_daily_b.line.2' },
      ],
    },
    {
      id: 'xt_daily_c',
      at: 19,
      need: ['xt_hello'],
      out: [
        { from: 'peer', text: 'channels.xt.xt_daily_c.line.1' },
        { from: 'peer', text: 'channels.xt.xt_daily_c.line.2', onRead: { stats: { sanity: 2 }, tone: 'neutral' } },
      ],
    },
    {
      id: 'xt_daily_d',
      at: 21,
      need: ['xt_hello'],
      out: [{ from: 'peer', text: 'channels.xt.xt_daily_d.line.1' }],
    },
    {
      id: 'xt_request',
      at: 23,
      need: ['xt_share'],
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.xt.xt_request.line.1' },
        { from: 'peer', text: 'channels.xt.xt_request.line.2' },
      ],
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
        },
        {
          id: 'refuse',
          label: 'channels.xt.xt_request.choice.refuse.label',
          note: 'channels.xt.xt_request.choice.refuse.note',
          say: 'channels.xt.xt_request.choice.refuse.say',
          affinity: -10,
          effect: { stats: { sanity: -4 }, setFlags: ['flag:xtRefused', 'flag:xtReplied'], tone: 'bad' },
        },
        {
          id: 'mute',
          label: 'channels.xt.xt_request.choice.mute.label',
          note: 'channels.xt.xt_request.choice.mute.note',
          affinity: -6,
          effect: { stats: { sanity: -3 }, setFlags: ['flag:xtReplied'], tone: 'grim' },
        },
      ],
    },
    {
      id: 'xt_gift',
      at: 25,
      need: ['xt_request'],
      out: [
        { from: 'peer', text: 'channels.xt.xt_gift.line.1' },
        { from: 'peer', text: 'channels.xt.xt_gift.line.2', onRead: { stats: { sanity: 3 }, tone: 'good' } },
      ],
    },
    {
      id: 'xt_reconnect',
      at: 26,
      need: ['xt_gift'],
      // 只有全程没回过话才会出现：她一个人把话说了下去
      require: { none: ['flag:xtReplied'] },
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.xt.xt_reconnect.line.1' },
        { from: 'peer', text: 'channels.xt.xt_reconnect.line.2' },
        { from: 'peer', text: 'channels.xt.xt_reconnect.line.3' },
        { from: 'peer', text: 'channels.xt.xt_reconnect.line.4' },
        { from: 'peer', text: 'channels.xt.xt_reconnect.line.5' },
      ],
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
          reply: 'xt_dead',
        },
      ],
    },
    {
      id: 'xt_afraid',
      at: 28,
      need: ['xt_gift'],
      out: [
        { from: 'peer', text: 'channels.xt.xt_afraid.line.1' },
        { from: 'peer', text: 'channels.xt.xt_afraid.line.2' },
        { from: 'peer', text: 'channels.xt.xt_afraid.line.3', onRead: { stats: { sanity: 2 }, tone: 'neutral' } },
      ],
    },
    {
      id: 'xt_ambush',
      at: 32,
      need: ['xt_share'],
      // 前置不够就不是求救，而是静默：事情照样发生，只是没有你的位置
      minAffinity: 40,
      elseBeat: 'xt_silent',
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.xt.xt_ambush.line.1' },
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
          reply: 'xt_go',
        },
        {
          id: 'soothe',
          label: 'channels.xt.xt_ambush.choice.soothe.label',
          note: 'channels.xt.xt_ambush.choice.soothe.note',
          say: 'channels.xt.xt_ambush.choice.soothe.say',
          affinity: 4,
          reply: 'xt_soothe',
        },
        {
          id: 'ignore',
          label: 'channels.xt.xt_ambush.choice.ignore.label',
          note: 'channels.xt.xt_ambush.choice.ignore.note',
          affinity: -10,
          reply: 'xt_dead',
        },
      ],
    },

    // ---------- 第 32 天之后的分支拍（无时间锚，只能被选项指定） ----------
    {
      id: 'xt_silent',
      silence: true,
      out: [
        { from: 'peer', text: 'channels.xt.xt_silent.line.1' },
        { from: 'peer', sys: 'narrate', text: 'channels.xt.xt_silent.line.2', onRead: { stats: { sanity: -6 }, tone: 'grim' } },
        { from: 'peer', sys: 'silent', text: 'channels.xt.sys.lost' },
      ],
    },
    {
      id: 'xt_go',
      expectReply: true,
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
          reply: 'xt_up',
        },
        {
          id: 'wait',
          label: 'channels.xt.xt_go.choice.wait.label',
          note: 'channels.xt.xt_go.choice.wait.note',
          say: 'channels.xt.xt_go.choice.wait.say',
          affinity: 2,
          reply: 'xt_wait',
        },
        {
          id: 'back',
          label: 'channels.xt.xt_go.choice.back.label',
          note: 'channels.xt.xt_go.choice.back.note',
          affinity: -12,
          reply: 'xt_dead',
        },
      ],
    },
    {
      id: 'xt_up',
      minAffinity: 55,
      elseBeat: 'xt_dead',
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
      id: 'xt_wait',
      minAffinity: 45,
      elseBeat: 'xt_dead',
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
      id: 'xt_soothe',
      minAffinity: 50,
      elseBeat: 'xt_dead',
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
    {
      id: 'xt_dead',
      silence: true,
      out: [
        { from: 'peer', sys: 'narrate', text: 'channels.xt.xt_dead.line.1', onRead: { stats: { sanity: -14 }, tone: 'grim' } },
        { from: 'peer', sys: 'narrate', text: 'channels.xt.xt_dead.line.2' },
        { from: 'peer', sys: 'silent', text: 'channels.xt.sys.lost' },
      ],
    },

    // ---------- 存活线：她活着才有的日常 ----------
    {
      id: 'xt_live_a',
      at: 36,
      require: { any: ['flag:xtAlive'] },
      out: [
        { from: 'peer', text: 'channels.xt.xt_live_a.line.1' },
        { from: 'peer', text: 'channels.xt.xt_live_a.line.2', onRead: { stats: { sanity: 3 }, tone: 'good' } },
      ],
    },
    {
      id: 'xt_live_b',
      at: 40,
      require: { any: ['flag:xtAlive'] },
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.xt.xt_live_b.line.1' },
        { from: 'peer', text: 'channels.xt.xt_live_b.line.2' },
      ],
      choices: [
        {
          id: 'hope',
          label: 'channels.xt.xt_live_b.choice.hope.label',
          note: 'channels.xt.xt_live_b.choice.hope.note',
          say: 'channels.xt.xt_live_b.choice.hope.say',
          affinity: 6,
          effect: { stats: { sanity: 3 }, setFlags: ['flag:xtHope'], tone: 'good' },
        },
        {
          id: 'plain',
          label: 'channels.xt.xt_live_b.choice.plain.label',
          note: 'channels.xt.xt_live_b.choice.plain.note',
          say: 'channels.xt.xt_live_b.choice.plain.say',
          affinity: 2,
          effect: { stats: { sanity: 1 }, tone: 'neutral' },
        },
        {
          id: 'silent',
          label: 'channels.xt.xt_live_b.choice.silent.label',
          note: 'channels.xt.xt_live_b.choice.silent.note',
          affinity: -6,
          effect: { stats: { sanity: -3 }, tone: 'grim' },
        },
      ],
    },
    {
      id: 'xt_live_c',
      at: 45,
      require: { any: ['flag:xtAlive'] },
      out: [{ from: 'peer', text: 'channels.xt.xt_live_c.line.1', onRead: { stats: { sanity: 2 }, tone: 'neutral' } }],
    },
    {
      id: 'xt_epilogue',
      at: 48,
      require: { any: ['flag:xtAlive'] },
      out: [
        { from: 'peer', text: 'channels.xt.xt_epilogue.line.1' },
        { from: 'peer', text: 'channels.xt.xt_epilogue.line.2', onRead: { stats: { sanity: 4 }, tone: 'good' } },
      ],
    },
  ],
};
