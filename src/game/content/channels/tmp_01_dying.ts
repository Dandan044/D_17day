import type { ChannelDef } from '../../types';

/**
 * 临时频道 01 · 求救的男人。
 *
 * 全系统的模板拍：两次抉择（回不回 / 去不去），每个选择都有代价，
 * **包括什么都不做**。频道名本身不给信息，玩家只看到一个频率号。
 *
 * 事件制：整条线是**一个事件**——从 `d_open` 开场，两次抉择都发生在同一场对话里，
 * 只是拒绝/答应之后他要隔几天才有下文，那几天落在轮级 `delayDays`。
 */
export const TMP_DYING: ChannelDef = {
  id: 'tmp_dying',
  kind: 'person',
  name: 'channels.tmp_dying.name',
  short: '4',
  tagline: 'channels.tmp_dying.tagline',
  discover: 'search',
  replyWindowDays: 3,
  events: [
    {
      id: 'd_open',
      kind: 'request',
      opening: [
        { from: 'peer', text: 'channels.tmp_dying.d_open.line.1' },
        { from: 'peer', text: 'channels.tmp_dying.d_open.line.2' },
        { from: 'peer', text: 'channels.tmp_dying.d_open.line.3' },
      ],
      first: 'd_open',
      rounds: [
        {
          id: 'd_open',
          // 开场白已经在 opening 里，这一轮不重复播
          out: [],
          choices: [
            {
              id: 'reply',
              label: 'channels.tmp_dying.d_open.choice.reply.label',
              note: 'channels.tmp_dying.d_open.choice.reply.note',
              say: 'channels.tmp_dying.d_open.choice.reply.say',
              affinity: 4,
              next: 'd_ask',
            },
            {
              id: 'off',
              label: 'channels.tmp_dying.d_open.choice.off.label',
              note: 'channels.tmp_dying.d_open.choice.off.note',
              affinity: -10,
              next: 'd_off',
            },
          ],
        },
        {
          id: 'd_ask',
          out: [
            { from: 'peer', text: 'channels.tmp_dying.d_ask.line.1' },
            { from: 'peer', text: 'channels.tmp_dying.d_ask.line.2' },
            { from: 'peer', text: 'channels.tmp_dying.d_ask.line.3' },
          ],
          choices: [
            {
              id: 'go',
              label: 'channels.tmp_dying.d_ask.choice.go.label',
              note: 'channels.tmp_dying.d_ask.choice.go.note',
              say: 'channels.tmp_dying.d_ask.choice.go.say',
              requires: { ap: 2, reason: 'channels.tmp_dying.d_ask.choice.go.reason' },
              // 立刻出门：两个行动点、一趟体力、夜里被人看见；
              // 人是救不回来的，但那个地下室留下了东西——一次性信号点
              effect: {
                ap: -2,
                stats: { stamina: -12, sanity: -8 },
                world: { exposure: 8 },
                locations: [{ id: 'sig_basement', stock: 80 }],
              },
              affinity: 10,
              next: 'd_go_true',
            },
            {
              id: 'note',
              label: 'channels.tmp_dying.d_ask.choice.note.label',
              note: 'channels.tmp_dying.d_ask.choice.note.note',
              say: 'channels.tmp_dying.d_ask.choice.note.say',
              affinity: 4,
              next: 'd_note_after',
            },
            {
              id: 'stop',
              label: 'channels.tmp_dying.d_ask.choice.stop.label',
              note: 'channels.tmp_dying.d_ask.choice.stop.note',
              affinity: -10,
              next: 'd_stop_after',
            },
          ],
        },
        {
          id: 'd_go_true',
          out: [
            { from: 'peer', sys: 'narrate', text: 'channels.tmp_dying.d_go_true.line.1' },
            { from: 'peer', sys: 'narrate', text: 'channels.tmp_dying.d_go_true.line.2' },
            { from: 'peer', sys: 'silent', text: 'channels.tmp_dying.sys.lost' },
          ],
          silence: true,
        },
        {
          id: 'd_note_after',
          out: [
            { from: 'peer', text: 'channels.tmp_dying.d_note_after.line.1' },
            { from: 'peer', sys: 'narrate', text: 'channels.tmp_dying.d_note_after.line.2', onRead: { stats: { sanity: -4 }, tone: 'grim' } },
            { from: 'peer', sys: 'silent', text: 'channels.tmp_dying.sys.lost' },
          ],
          delayDays: 3,
          silence: true,
        },
        {
          id: 'd_stop_after',
          out: [
            { from: 'peer', sys: 'narrate', text: 'channels.tmp_dying.d_stop_after.line.1', onRead: { stats: { sanity: -6 }, tone: 'grim' } },
            { from: 'peer', sys: 'silent', text: 'channels.tmp_dying.sys.lost' },
          ],
          delayDays: 4,
          silence: true,
        },
        {
          id: 'd_off',
          out: [
            { from: 'peer', sys: 'narrate', text: 'channels.tmp_dying.d_off.line.1', onRead: { stats: { sanity: -3 }, tone: 'grim' } },
            { from: 'peer', sys: 'silent', text: 'channels.tmp_dying.sys.lost' },
          ],
          delayDays: 3,
          silence: true,
        },
      ],
    },
  ],
};
