import type { ChannelDef } from '../../types';

/**
 * 临时频道 02 · 找孩子的母亲。
 *
 * 和她说话能回一点理智，但帮不上任何忙——她只是还在找。
 * 全程没有一次选择能改变结果，这正是这条线要说的东西。
 */
export const TMP_MOTHER: ChannelDef = {
  id: 'tmp_mother',
  kind: 'person',
  name: 'channels.tmp_mother.name',
  short: '5',
  tagline: 'channels.tmp_mother.tagline',
  discover: 'search',
  minRadio: 1,
  replyWindowDays: 4,
  beats: [
    {
      id: 'm_open',
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.tmp_mother.m_open.line.1' },
        { from: 'peer', text: 'channels.tmp_mother.m_open.line.2' },
        { from: 'peer', text: 'channels.tmp_mother.m_open.line.3' },
      ],
      choices: [
        {
          id: 'ask',
          label: 'channels.tmp_mother.m_open.choice.ask.label',
          note: 'channels.tmp_mother.m_open.choice.ask.note',
          say: 'channels.tmp_mother.m_open.choice.ask.say',
          affinity: 4,
          reply: 'm_reply',
        },
        {
          id: 'no',
          label: 'channels.tmp_mother.m_open.choice.no.label',
          note: 'channels.tmp_mother.m_open.choice.no.note',
          affinity: -10,
          reply: 'm_left',
        },
      ],
    },
    {
      id: 'm_reply',
      out: [
        { from: 'peer', text: 'channels.tmp_mother.m_reply.line.1', onRead: { stats: { sanity: 4 }, tone: 'neutral' } },
        { from: 'peer', text: 'channels.tmp_mother.m_reply.line.2' },
      ],
    },
    {
      id: 'm_mid',
      afterDays: 5,
      out: [
        { from: 'peer', text: 'channels.tmp_mother.m_mid.line.1' },
        { from: 'peer', text: 'channels.tmp_mother.m_mid.line.2' },
      ],
    },
    {
      id: 'm_end',
      afterDays: 6,
      silence: true,
      out: [
        { from: 'peer', text: 'channels.tmp_mother.m_end.line.1' },
        { from: 'peer', sys: 'narrate', text: 'channels.tmp_mother.m_end.line.2', onRead: { stats: { sanity: -3 }, tone: 'grim' } },
        { from: 'peer', sys: 'silent', text: 'channels.tmp_mother.sys.lost' },
      ],
    },
    {
      id: 'm_left',
      afterDays: 4,
      silence: true,
      out: [
        { from: 'peer', text: 'channels.tmp_mother.m_left.line.1' },
        { from: 'peer', sys: 'narrate', text: 'channels.tmp_mother.m_left.line.2', onRead: { stats: { sanity: -3 }, tone: 'grim' } },
        { from: 'peer', sys: 'silent', text: 'channels.tmp_mother.sys.lost' },
      ],
    },
  ],
};
