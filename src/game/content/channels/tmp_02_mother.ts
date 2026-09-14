import type { ChannelDef } from '../../types';

/**
 * 临时频道 02 · 找孩子的母亲。
 *
 * 和她说话能回一点理智，但帮不上任何忙——她只是还在找。
 * 全程没有一次选择能改变结果，这正是这条线要说的东西。
 *
 * 事件制：`m_open`（第一次搭话，两个选项各有下文）、`m_mid`、`m_end` 是**三个事件**，
 * 后两个没有任何选项指向它们，各自从日历（`afterDays`）到场。
 */
export const TMP_MOTHER: ChannelDef = {
  id: 'tmp_mother',
  kind: 'person',
  name: 'channels.tmp_mother.name',
  short: '5',
  tagline: 'channels.tmp_mother.tagline',
  discover: 'search',
  replyWindowDays: 4,
  events: [
    {
      id: 'm_open',
      kind: 'request',
      opening: [
        { from: 'peer', text: 'channels.tmp_mother.m_open.line.1' },
        { from: 'peer', text: 'channels.tmp_mother.m_open.line.2' },
        { from: 'peer', text: 'channels.tmp_mother.m_open.line.3' },
      ],
      first: 'm_open',
      rounds: [
        {
          id: 'm_open',
          // 开场白已经在 opening 里，这一轮不重复播
          out: [],
          choices: [
            {
              id: 'ask',
              label: 'channels.tmp_mother.m_open.choice.ask.label',
              note: 'channels.tmp_mother.m_open.choice.ask.note',
              say: 'channels.tmp_mother.m_open.choice.ask.say',
              affinity: 4,
              next: 'm_reply',
            },
            {
              id: 'no',
              label: 'channels.tmp_mother.m_open.choice.no.label',
              note: 'channels.tmp_mother.m_open.choice.no.note',
              affinity: -10,
              next: 'm_left',
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
          id: 'm_left',
          out: [
            { from: 'peer', text: 'channels.tmp_mother.m_left.line.1' },
            { from: 'peer', sys: 'narrate', text: 'channels.tmp_mother.m_left.line.2', onRead: { stats: { sanity: -3 }, tone: 'grim' } },
            { from: 'peer', sys: 'silent', text: 'channels.tmp_mother.sys.lost' },
          ],
          delayDays: 4,
          silence: true,
        },
      ],
    },
    {
      id: 'm_mid',
      afterDays: 5,
      kind: 'daily',
      opening: [
        { from: 'peer', text: 'channels.tmp_mother.m_mid.line.1' },
        { from: 'peer', text: 'channels.tmp_mother.m_mid.line.2' },
      ],
      first: 'm_mid',
      rounds: [
        {
          id: 'm_mid',
          // 开场白已经在 opening 里，这一轮不播任何话（没有 choices＝事件到此结束）
          out: [],
        },
      ],
    },
    {
      id: 'm_end',
      afterDays: 6,
      kind: 'end',
      silence: true,
      opening: [
        { from: 'peer', text: 'channels.tmp_mother.m_end.line.1' },
        { from: 'peer', sys: 'narrate', text: 'channels.tmp_mother.m_end.line.2', onRead: { stats: { sanity: -3 }, tone: 'grim' } },
        { from: 'peer', sys: 'silent', text: 'channels.tmp_mother.sys.lost' },
      ],
      first: 'm_end',
      rounds: [
        {
          id: 'm_end',
          // 开场白已经在 opening 里，这一轮不重复播
          out: [],
          silence: true,
        },
      ],
    },
  ],
};
