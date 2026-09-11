import type { ChannelDef } from '../../types';

/**
 * 核心频道 · 战时官方频道。
 *
 * 自称民防指挥部转播台。真实身份全程不明——可能是残部、可能是复读机、
 * 也可能是掠夺者在用一台没坏的机器。
 *
 * 这条线承担三件事：
 *   1. **承接被删掉的天气预报卡片**：它在 10/17 两天播报 run.world.forecast，
 *      而那份预报本来就随 threat 变差、本来就是会撒谎的。官方在撒谎这件事
 *      不需要额外机制，数据本身就是谎。
 *   2. **坐标 → 一次性搜刮点**：12 天给出坐标，调频接收要耗 0.5 kWh。
 *      L3 多一个「先比对载波」的选项，能看出这是圈套——但也就拿不到东西。
 *   3. **第 28 天被攻陷**：掠夺期一到，这个频率换了人。要求幸存者上报坐标，
 *      上报就触发 raid_attempt。L2 能报假坐标把祸水引走，L3 能提前识破。
 *
 * 累计上报用两个 flag 表达（ogReported / ogSoldOut），第 40 天据此分叉三条结局。
 */
export const CORE_OG: ChannelDef = {
  id: 'og',
  kind: 'org',
  name: 'channels.og.name',
  short: '民',
  tagline: 'channels.og.tagline',
  discover: 'auto',
  discoverDay: 8,
  replyWindowDays: 4,
  core: true,
  beats: [
    {
      id: 'og_open',
      at: 8,
      out: [
        { from: 'peer', text: 'channels.og.og_open.line.1' },
        { from: 'peer', text: 'channels.og.og_open.line.2' },
        { from: 'peer', text: 'channels.og.og_open.line.3' },
      ],
    },
    {
      id: 'og_weather',
      at: 10,
      need: ['og_open'],
      out: [
        { from: 'peer', text: 'channels.og.og_weather.line.1' },
        { from: 'peer', text: 'channels.og.og_weather.line.2', dynamic: 'forecast' },
        { from: 'peer', text: 'channels.og.og_weather.line.3' },
      ],
    },
    {
      id: 'og_rules',
      at: 11,
      need: ['og_open'],
      out: [
        { from: 'peer', text: 'channels.og.og_rules.line.1' },
        { from: 'peer', text: 'channels.og.og_rules.line.2' },
      ],
    },
    {
      id: 'og_coord',
      at: 12,
      need: ['og_open'],
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.og.og_coord.line.1' },
        { from: 'peer', text: 'channels.og.og_coord.line.2' },
        { from: 'peer', text: 'channels.og.og_coord.line.3' },
      ],
      choices: [
        {
          id: 'tune',
          label: 'channels.og.og_coord.choice.tune.label',
          note: 'channels.og.og_coord.choice.tune.note',
          affinity: 4,
          effect: {
            wear: { batteryCharge: -0.5 },
            locations: [{ id: 'sig_depot', stock: 80 }],
            setFlags: ['flag:ogSite'],
            tone: 'good',
          },
          reply: 'og_tuned',
        },
        {
          id: 'scan',
          label: 'channels.og.og_coord.choice.scan.label',
          note: 'channels.og.og_coord.choice.scan.note',
          requires: { modules: { radio: 3 } },
          affinity: 6,
          effect: { wear: { batteryCharge: -0.5 }, setFlags: ['flag:ogRealized'], tone: 'grim' },
          reply: 'og_sniffed',
        },
        {
          id: 'skip',
          label: 'channels.og.og_coord.choice.skip.label',
          note: 'channels.og.og_coord.choice.skip.note',
          affinity: -4,
        },
      ],
    },
    {
      id: 'og_daily_a',
      at: 15,
      need: ['og_open'],
      out: [
        { from: 'peer', text: 'channels.og.og_daily_a.line.1' },
        { from: 'peer', text: 'channels.og.og_daily_a.line.2' },
      ],
    },
    {
      id: 'og_daily_b',
      at: 17,
      need: ['og_open'],
      out: [
        { from: 'peer', text: 'channels.og.og_daily_b.line.1' },
        { from: 'peer', text: 'channels.og.og_daily_b.line.2', dynamic: 'forecast' },
      ],
    },
    {
      id: 'og_census',
      at: 18,
      need: ['og_open'],
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.og.og_census.line.1' },
        { from: 'peer', text: 'channels.og.og_census.line.2' },
      ],
      choices: [
        {
          id: 'report',
          label: 'channels.og.og_census.choice.report.label',
          note: 'channels.og.og_census.choice.report.note',
          affinity: 8,
          effect: {
            world: { exposure: 12 },
            setFlags: ['flag:ogReported'],
            tone: 'grim',
          },
          reply: 'og_registered',
        },
        {
          id: 'fake',
          label: 'channels.og.og_census.choice.fake.label',
          note: 'channels.og.og_census.choice.fake.note',
          requires: { modules: { radio: 2 } },
          affinity: 4,
          effect: { world: { exposure: 4 }, setFlags: ['flag:ogFaked'], tone: 'neutral' },
          reply: 'og_registered',
        },
        {
          id: 'ignore',
          label: 'channels.og.og_census.choice.ignore.label',
          note: 'channels.og.og_census.choice.ignore.note',
          affinity: -6,
        },
      ],
    },
    {
      id: 'og_daily_c',
      at: 19,
      need: ['og_open'],
      out: [
        { from: 'peer', text: 'channels.og.og_daily_c.line.1' },
        { from: 'peer', text: 'channels.og.og_daily_c.line.2' },
      ],
    },
    {
      id: 'og_leak',
      at: 21,
      need: ['og_census'],
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.og.og_leak.line.1' },
        { from: 'peer', text: 'channels.og.og_leak.line.2' },
        { from: 'peer', text: 'channels.og.og_leak.line.3' },
      ],
      choices: [
        {
          id: 'copy',
          label: 'channels.og.og_leak.choice.copy.label',
          note: 'channels.og.og_leak.choice.copy.note',
          affinity: 6,
          effect: { stats: { sanity: -3 }, setFlags: ['flag:ogLeak'], tone: 'grim' },
        },
        {
          id: 'off',
          label: 'channels.og.og_leak.choice.off.label',
          note: 'channels.og.og_leak.choice.off.note',
          affinity: -2,
          effect: { stats: { sanity: -1 }, tone: 'neutral' },
        },
      ],
    },
    {
      id: 'og_daily_d',
      at: 23,
      need: ['og_open'],
      out: [
        { from: 'peer', text: 'channels.og.og_daily_d.line.1' },
        { from: 'peer', text: 'channels.og.og_daily_d.line.2' },
      ],
    },
    {
      id: 'og_crack',
      at: 25,
      need: ['og_open'],
      out: [
        { from: 'peer', text: 'channels.og.og_crack.line.1' },
        { from: 'peer', text: 'channels.og.og_crack.line.2', onRead: { stats: { sanity: -2 }, tone: 'grim' } },
      ],
    },
    {
      id: 'og_daily_e',
      at: 26,
      need: ['og_open'],
      out: [{ from: 'peer', text: 'channels.og.og_daily_e.line.1' }],
    },
    {
      id: 'og_seized',
      at: 28,
      need: ['og_open'],
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.og.og_seized.line.1' },
        { from: 'peer', text: 'channels.og.og_seized.line.2' },
        { from: 'peer', text: 'channels.og.og_seized.line.3' },
      ],
      choices: [
        {
          id: 'report',
          label: 'channels.og.og_seized.choice.report.label',
          note: 'channels.og.og_seized.choice.report.note',
          affinity: 10,
          effect: {
            world: { exposure: 14 },
            stats: { humanity: -8 },
            setFlags: ['flag:ogReported', 'flag:ogSoldOut'],
            // 上报坐标的直接后果：第二天有人循着坐标来找你
            schedule: [{ familyId: 'raid_attempt', inDays: 1 }],
            tone: 'grim',
          },
        },
        {
          id: 'fake',
          label: 'channels.og.og_seized.choice.fake.label',
          note: 'channels.og.og_seized.choice.fake.note',
          requires: { modules: { radio: 2 } },
          affinity: 6,
          effect: {
            world: { exposure: 6 },
            stance: { looter: -12, gang: -12 },
            setFlags: ['flag:ogReported', 'flag:ogFaked'],
            tone: 'neutral',
          },
        },
        {
          id: 'scan',
          label: 'channels.og.og_seized.choice.scan.label',
          note: 'channels.og.og_seized.choice.scan.note',
          requires: { modules: { radio: 3 } },
          affinity: 8,
          effect: {
            world: { exposure: -6 },
            setFlags: ['flag:ogApplied'],
            stats: { sanity: 4 },
            tone: 'good',
          },
        },
        {
          id: 'silent',
          label: 'channels.og.og_seized.choice.silent.label',
          note: 'channels.og.og_seized.choice.silent.note',
          affinity: -10,
        },
      ],
    },
    {
      id: 'og_aftermath',
      at: 33,
      need: ['og_seized'],
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.og.og_aftermath.line.1' },
        { from: 'peer', text: 'channels.og.og_aftermath.line.2' },
      ],
      choices: [
        {
          id: 'reply',
          label: 'channels.og.og_aftermath.choice.reply.label',
          note: 'channels.og.og_aftermath.choice.reply.note',
          affinity: 6,
          effect: { stats: { sanity: -2 }, setFlags: ['flag:ogAnswered'], tone: 'grim' },
        },
        {
          id: 'quiet',
          label: 'channels.og.og_aftermath.choice.quiet.label',
          note: 'channels.og.og_aftermath.choice.quiet.note',
          affinity: -4,
        },
      ],
    },
    {
      id: 'og_after2',
      at: 36,
      need: ['og_aftermath'],
      out: [
        { from: 'peer', text: 'channels.og.og_after2.line.1' },
        { from: 'peer', text: 'channels.og.og_after2.line.2' },
      ],
    },
    {
      id: 'og_endgame',
      at: 40,
      need: ['og_after2'],
      // 三次合作过：你已经是他们那套系统里的一环
      require: { all: ['flag:ogSoldOut'] },
      elseBeat: 'og_suspect',
      out: [
        { from: 'peer', text: 'channels.og.og_endgame.line.1' },
        { from: 'peer', text: 'channels.og.og_endgame.line.2' },
      ],
    },
    {
      id: 'og_suspect',
      at: 41,
      need: ['og_after2'],
      // 报过片区但没卖过人：可疑但不重要
      require: { all: ['flag:ogReported'], none: ['flag:ogSoldOut'] },
      elseBeat: 'og_ignored',
      out: [
        { from: 'peer', text: 'channels.og.og_suspect.line.1' },
        { from: 'peer', text: 'channels.og.og_suspect.line.2' },
      ],
    },
    {
      id: 'og_ignored',
      at: 42,
      need: ['og_after2'],
      // 链尾兜底：既没合作也没上报过
      require: { none: ['flag:ogReported'] },
      out: [
        { from: 'peer', text: 'channels.og.og_ignored.line.1' },
        { from: 'peer', text: 'channels.og.og_ignored.line.2' },
      ],
    },
    {
      id: 'og_epilogue',
      at: 45,
      out: [{ from: 'peer', text: 'channels.og.og_epilogue.line.1', onRead: { stats: { sanity: -2 }, tone: 'grim' } }],
    },

    // ---------- 分支拍（无时间锚，只能被选项指定） ----------
    {
      id: 'og_tuned',
      out: [
        { from: 'peer', sys: 'narrate', text: 'channels.og.og_tuned.line.1' },
        { from: 'peer', sys: 'narrate', text: 'channels.og.og_tuned.line.2', onRead: { stats: { sanity: 3 }, tone: 'good' } },
      ],
    },
    {
      id: 'og_sniffed',
      out: [
        { from: 'peer', sys: 'narrate', text: 'channels.og.og_sniffed.line.1' },
        { from: 'peer', sys: 'narrate', text: 'channels.og.og_sniffed.line.2', onRead: { stats: { sanity: -2 }, tone: 'grim' } },
      ],
    },
    {
      id: 'og_registered',
      out: [{ from: 'peer', text: 'channels.og.og_registered.line.1' }],
    },
  ],
};
