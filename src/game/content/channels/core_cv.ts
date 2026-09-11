import type { ChannelDef } from '../../types';

/**
 * 核心频道 · 居民自治委员会。
 *
 * 几个小区的幸存者凑起来的自治组织。它和第 8 天那个官方频道正好一头一尾：
 * 官方是自上而下的谎言，委员会是自下而上的暴力——两边用的都是同一套话术。
 *
 * 机制上它是唯一带**专属动作**的频道：表决（调频 + 发一个音，耗 0.3 kWh，需 2 级电台）。
 * 其余两个核心频道只能回话，它要你投票。
 *
 * 也是唯一一处跨线耦合：如果你在第 21 天的官方频道里录下了那段内部通话，
 * 第 30 天可以把它公布给委员会——这是整份设计里刻意只做一处的东西。
 */
export const CORE_CV: ChannelDef = {
  id: 'cv',
  kind: 'org',
  name: 'channels.cv.name',
  short: '治',
  tagline: 'channels.cv.tagline',
  discover: 'auto',
  discoverDay: 15,
  replyWindowDays: 5,
  core: true,
  beats: [
    {
      id: 'cv_invite',
      at: 15,
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.cv.cv_invite.line.1' },
        { from: 'peer', text: 'channels.cv.cv_invite.line.2' },
        { from: 'peer', text: 'channels.cv.cv_invite.line.3' },
      ],
      choices: [
        {
          id: 'join',
          label: 'channels.cv.cv_invite.choice.join.label',
          note: 'channels.cv.cv_invite.choice.join.note',
          say: 'channels.cv.cv_invite.choice.join.say',
          affinity: 8,
          effect: { setFlags: ['flag:cvJoined'], stats: { humanity: 2 }, tone: 'good' },
        },
        {
          id: 'decline',
          label: 'channels.cv.cv_invite.choice.decline.label',
          note: 'channels.cv.cv_invite.choice.decline.note',
          affinity: -6,
        },
      ],
    },
    {
      id: 'cv_rules',
      at: 17,
      need: ['cv_invite'],
      out: [
        { from: 'peer', text: 'channels.cv.cv_rules.line.1' },
        { from: 'peer', text: 'channels.cv.cv_rules.line.2' },
      ],
    },
    {
      id: 'cv_ration',
      at: 19,
      need: ['cv_invite'],
      out: [
        { from: 'peer', text: 'channels.cv.cv_ration.line.1' },
        { from: 'peer', text: 'channels.cv.cv_ration.line.2' },
      ],
      choices: [
        {
          id: 'pay',
          label: 'channels.cv.cv_ration.choice.pay.label',
          note: 'channels.cv.cv_ration.choice.pay.note',
          requires: { res: { foodStaple: 4 } },
          say: 'channels.cv.cv_ration.choice.pay.say',
          affinity: 12,
          effect: {
            res: { foodStaple: -4 },
            stats: { reputation: 6 },
            setFlags: ['flag:cvPaidUp'],
            tone: 'good',
          },
        },
        {
          id: 'short',
          label: 'channels.cv.cv_ration.choice.short.label',
          note: 'channels.cv.cv_ration.choice.short.note',
          say: 'channels.cv.cv_ration.choice.short.say',
          affinity: 2,
          effect: { res: { foodStaple: -2 }, world: { exposure: 4 }, stats: { reputation: -4 }, setFlags: ['flag:cvShort'] },
        },
        {
          id: 'refuse',
          label: 'channels.cv.cv_ration.choice.refuse.label',
          note: 'channels.cv.cv_ration.choice.refuse.note',
          say: 'channels.cv.cv_ration.choice.refuse.say',
          affinity: -10,
          effect: { world: { exposure: 6 }, stats: { reputation: -8 }, setFlags: ['flag:cvRefused'], tone: 'bad' },
        },
      ],
    },
    {
      id: 'cv_daily_e',
      at: 21,
      need: ['cv_ration'],
      out: [{ from: 'peer', text: 'channels.cv.cv_daily_e.line.1' }],
    },
    {
      id: 'cv_vote_virus',
      at: 22,
      need: ['cv_ration'],
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.cv.cv_vote_virus.line.1' },
        { from: 'peer', text: 'channels.cv.cv_vote_virus.line.2' },
        { from: 'peer', text: 'channels.cv.cv_vote_virus.line.3' },
      ],
      choices: [
        {
          id: 'yes',
          label: 'channels.cv.cv_vote_virus.choice.yes.label',
          note: 'channels.cv.cv_vote_virus.choice.yes.note',
          requires: { modules: { radio: 2 } },
          affinity: 10,
          effect: {
            wear: { batteryCharge: -0.3 },
            stats: { humanity: -10 },
            res: { foodStaple: 8, meds: 2 },
            setFlags: ['flag:cvVotedYes', 'flag:cvVoted'],
            tone: 'grim',
          },
        },
        {
          id: 'no',
          label: 'channels.cv.cv_vote_virus.choice.no.label',
          note: 'channels.cv.cv_vote_virus.choice.no.note',
          requires: { modules: { radio: 2 } },
          affinity: 4,
          effect: {
            wear: { batteryCharge: -0.3 },
            stats: { reputation: -6 },
            setFlags: ['flag:cvVotedNo', 'flag:cvVoted'],
          },
        },
        {
          id: 'abstain',
          label: 'channels.cv.cv_vote_virus.choice.abstain.label',
          note: 'channels.cv.cv_vote_virus.choice.abstain.note',
          requires: { modules: { radio: 2 } },
          affinity: -2,
          effect: {
            wear: { batteryCharge: -0.3 },
            stats: { sanity: -6 },
            setFlags: ['flag:cvAbstained', 'flag:cvVoted'],
            tone: 'grim',
          },
        },
      ],
    },
    {
      id: 'cv_daily_a',
      at: 24,
      need: ['cv_vote_virus'],
      out: [
        { from: 'peer', text: 'channels.cv.cv_daily_a.line.1' },
        { from: 'peer', text: 'channels.cv.cv_daily_a.line.2' },
      ],
    },
    {
      id: 'cv_list',
      at: 26,
      need: ['cv_vote_virus'],
      out: [
        { from: 'peer', text: 'channels.cv.cv_list.line.1' },
        { from: 'peer', text: 'channels.cv.cv_list.line.2', onRead: { stats: { sanity: -3 }, tone: 'grim' } },
      ],
    },
    {
      id: 'cv_daily_b',
      at: 28,
      need: ['cv_vote_virus'],
      out: [{ from: 'peer', text: 'channels.cv.cv_daily_b.line.1' }],
    },
    {
      id: 'cv_leak',
      at: 30,
      need: ['cv_vote_virus'],
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.cv.cv_leak.line.1' },
        { from: 'peer', text: 'channels.cv.cv_leak.line.2' },
      ],
      choices: [
        {
          id: 'publish',
          label: 'channels.cv.cv_leak.choice.publish.label',
          note: 'channels.cv.cv_leak.choice.publish.note',
          // 唯一的跨线耦合：得先在官方频道录下那段内部通话
          requires: { tags: { all: ['flag:ogLeak'] }, reason: 'channels.cv.cv_leak.choice.publish.reason' },
          say: 'channels.cv.cv_leak.choice.publish.say',
          affinity: 6,
          effect: {
            setFlags: ['flag:cvPublished'],
            stats: { reputation: 8, humanity: 4 },
            faction: { gov: -10 },
            tone: 'grim',
          },
        },
        {
          id: 'keep',
          label: 'channels.cv.cv_leak.choice.keep.label',
          note: 'channels.cv.cv_leak.choice.keep.note',
          say: 'channels.cv.cv_leak.choice.keep.say',
          affinity: 0,
          effect: { stats: { sanity: -2 } },
        },
      ],
    },
    {
      id: 'cv_notice',
      at: 31,
      need: ['cv_vote_virus'],
      out: [{ from: 'peer', text: 'channels.cv.cv_notice.line.1' }],
    },
    {
      id: 'cv_daily_c',
      at: 32,
      need: ['cv_vote_virus'],
      out: [{ from: 'peer', text: 'channels.cv.cv_daily_c.line.1' }],
    },
    {
      id: 'cv_trial',
      at: 34,
      need: ['cv_vote_virus'],
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.cv.cv_trial.line.1' },
        { from: 'peer', text: 'channels.cv.cv_trial.line.2' },
        { from: 'peer', text: 'channels.cv.cv_trial.line.3' },
      ],
      choices: [
        {
          id: 'witness',
          label: 'channels.cv.cv_trial.choice.witness.label',
          note: 'channels.cv.cv_trial.choice.witness.note',
          say: 'channels.cv.cv_trial.choice.witness.say',
          affinity: 6,
          effect: { stats: { humanity: -6, reputation: 4 }, setFlags: ['flag:cvWitnessed'], tone: 'grim' },
        },
        {
          id: 'silent',
          label: 'channels.cv.cv_trial.choice.silent.label',
          note: 'channels.cv.cv_trial.choice.silent.note',
          affinity: -2,
          effect: { stats: { reputation: -5 }, setFlags: ['flag:cvQuiet'] },
        },
        {
          id: 'defend',
          label: 'channels.cv.cv_trial.choice.defend.label',
          note: 'channels.cv.cv_trial.choice.defend.note',
          say: 'channels.cv.cv_trial.choice.defend.say',
          affinity: -6,
          effect: {
            stats: { humanity: 6, reputation: -8 },
            world: { exposure: 8 },
            setFlags: ['flag:cvDefended'],
          },
        },
      ],
    },
    {
      id: 'cv_daily_d',
      at: 36,
      need: ['cv_trial'],
      out: [{ from: 'peer', text: 'channels.cv.cv_daily_d.line.1' }],
    },
    {
      id: 'cv_quota',
      at: 38,
      need: ['cv_trial'],
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.cv.cv_quota.line.1' },
        { from: 'peer', text: 'channels.cv.cv_quota.line.2' },
      ],
      choices: [
        {
          id: 'pay',
          label: 'channels.cv.cv_quota.choice.pay.label',
          note: 'channels.cv.cv_quota.choice.pay.note',
          requires: { res: { foodStaple: 6 } },
          say: 'channels.cv.cv_quota.choice.pay.say',
          affinity: 10,
          effect: { res: { foodStaple: -6 }, stats: { reputation: 5 }, setFlags: ['flag:cvPaidUp'] },
        },
        {
          id: 'refuse',
          label: 'channels.cv.cv_quota.choice.refuse.label',
          note: 'channels.cv.cv_quota.choice.refuse.note',
          say: 'channels.cv.cv_quota.choice.refuse.say',
          affinity: -10,
          effect: {
            world: { exposure: 10 },
            stats: { reputation: -10 },
            setFlags: ['flag:cvRefusedQuota'],
            tone: 'bad',
          },
        },
      ],
    },
    {
      id: 'cv_after',
      at: 41,
      need: ['cv_quota'],
      out: [
        { from: 'peer', text: 'channels.cv.cv_after.line.1' },
        { from: 'peer', text: 'channels.cv.cv_after.line.2' },
      ],
    },
    {
      id: 'cv_end_order',
      at: 44,
      need: ['cv_after'],
      require: { all: ['flag:cvPaidUp'], none: ['flag:cvPublished'] },
      elseBeat: 'cv_end_tyranny',
      out: [
        { from: 'peer', text: 'channels.cv.cv_end_order.line.1' },
        { from: 'peer', text: 'channels.cv.cv_end_order.line.2', onRead: { stats: { sanity: 3 }, tone: 'neutral' } },
      ],
    },
    {
      id: 'cv_end_tyranny',
      at: 45,
      need: ['cv_after'],
      require: { all: ['flag:cvPublished'] },
      elseBeat: 'cv_end_dissolve',
      out: [
        { from: 'peer', text: 'channels.cv.cv_end_tyranny.line.1' },
        { from: 'peer', text: 'channels.cv.cv_end_tyranny.line.2', onRead: { stats: { sanity: -4 }, tone: 'grim' } },
      ],
    },
    {
      id: 'cv_end_dissolve',
      at: 46,
      need: ['cv_after'],
      require: { none: ['flag:cvPublished'] },
      out: [
        { from: 'peer', text: 'channels.cv.cv_end_dissolve.line.1' },
        { from: 'peer', text: 'channels.cv.cv_end_dissolve.line.2', onRead: { stats: { sanity: -2 }, tone: 'grim' } },
      ],
    },
    {
      id: 'cv_epilogue',
      at: 48,
      out: [{ from: 'peer', text: 'channels.cv.cv_epilogue.line.1' }],
    },
  ],
};
