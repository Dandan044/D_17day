import type { ChannelDef } from '../../types';

/**
 * 剩下的八个临时频道。
 *
 * 它们的共同点：短、不给解法、大多以静默收尾。
 * 全部靠「搜索频道」得到，不特殊标注——玩家只会看到一个频率号。
 * 集中放一个文件，是因为它们每个只有 2–5 拍，拆成八个文件反而不好找。
 */

/** 03 · 放歌的人：纯粹的陪伴，直到歌停了 */
export const TMP_SINGER: ChannelDef = {
  id: 'tmp_singer',
  kind: 'person',
  name: 'channels.tmp_singer.name',
  short: '♪',
  tagline: 'channels.tmp_singer.tagline',
  discover: 'search',
  minRadio: 1,
  replyWindowDays: 4,
  beats: [
    {
      id: 'sg_open',
      out: [{ from: 'peer', text: 'channels.tmp_singer.sg_open.line.1', onRead: { stats: { sanity: 5 }, tone: 'good' } }],
    },
    {
      id: 'sg_again',
      afterDays: 2,
      out: [{ from: 'peer', text: 'channels.tmp_singer.sg_again.line.1' }],
    },
    {
      id: 'sg_cut',
      afterDays: 3,
      out: [
        { from: 'peer', text: 'channels.tmp_singer.sg_cut.line.1' },
        { from: 'peer', sys: 'narrate', text: 'channels.tmp_singer.sg_cut.line.2', onRead: { stats: { sanity: -3 }, tone: 'grim' } },
      ],
    },
    {
      id: 'sg_end',
      afterDays: 3,
      silence: true,
      out: [
        { from: 'peer', text: 'channels.tmp_singer.sg_end.line.1' },
        { from: 'peer', sys: 'silent', text: 'channels.tmp_singer.sys.lost' },
      ],
    },
  ],
};

/** 04 · 自称医生的女人：能换药，但她不是医生 */
export const TMP_DOCTOR: ChannelDef = {
  id: 'tmp_doctor',
  kind: 'person',
  name: 'channels.tmp_doctor.name',
  short: '医',
  tagline: 'channels.tmp_doctor.tagline',
  discover: 'search',
  minRadio: 1,
  replyWindowDays: 4,
  beats: [
    {
      id: 'dr_open',
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.tmp_doctor.dr_open.line.1' },
        { from: 'peer', text: 'channels.tmp_doctor.dr_open.line.2' },
      ],
      choices: [
        {
          id: 'trade',
          label: 'channels.tmp_doctor.dr_open.choice.trade.label',
          note: 'channels.tmp_doctor.dr_open.choice.trade.note',
          requires: { res: { foodStaple: 3 } },
          say: 'channels.tmp_doctor.dr_open.choice.trade.say',
          affinity: 8,
          effect: { res: { foodStaple: -3, meds: 6 }, setFlags: ['flag:drTraded'], tone: 'good' },
        },
        {
          id: 'no',
          label: 'channels.tmp_doctor.dr_open.choice.no.label',
          note: 'channels.tmp_doctor.dr_open.choice.no.note',
          affinity: -6,
        },
      ],
    },
    {
      id: 'dr_truth',
      afterDays: 3,
      out: [
        { from: 'peer', text: 'channels.tmp_doctor.dr_truth.line.1' },
        { from: 'peer', text: 'channels.tmp_doctor.dr_truth.line.2', onRead: { stats: { sanity: -2 }, tone: 'grim' } },
      ],
    },
    {
      id: 'dr_end',
      afterDays: 4,
      silence: true,
      out: [
        { from: 'peer', sys: 'narrate', text: 'channels.tmp_doctor.dr_end.line.1' },
        { from: 'peer', sys: 'silent', text: 'channels.tmp_doctor.sys.lost' },
      ],
    },
  ],
};

/** 05 · 一个孩子：你回不了话 */
export const TMP_CHILD: ChannelDef = {
  id: 'tmp_child',
  kind: 'person',
  name: 'channels.tmp_child.name',
  short: '童',
  tagline: 'channels.tmp_child.tagline',
  discover: 'search',
  minRadio: 1,
  replyWindowDays: 4,
  beats: [
    {
      id: 'ch_open',
      out: [
        { from: 'peer', text: 'channels.tmp_child.ch_open.line.1' },
        { from: 'peer', text: 'channels.tmp_child.ch_open.line.2' },
      ],
    },
    {
      id: 'ch_more',
      afterDays: 2,
      out: [{ from: 'peer', text: 'channels.tmp_child.ch_more.line.1' }],
    },
    {
      id: 'ch_end',
      afterDays: 3,
      silence: true,
      out: [
        { from: 'peer', sys: 'narrate', text: 'channels.tmp_child.ch_end.line.1', onRead: { stats: { sanity: -4 }, tone: 'grim' } },
        { from: 'peer', sys: 'silent', text: 'channels.tmp_child.sys.lost' },
      ],
    },
  ],
};

/** 06 · 在数数的人：数字是门牌号 */
export const TMP_COUNTER: ChannelDef = {
  id: 'tmp_counter',
  kind: 'person',
  name: 'channels.tmp_counter.name',
  short: '数',
  tagline: 'channels.tmp_counter.tagline',
  discover: 'search',
  minRadio: 1,
  replyWindowDays: 4,
  beats: [
    {
      id: 'ct_open',
      out: [{ from: 'peer', text: 'channels.tmp_counter.ct_open.line.1' }],
    },
    {
      id: 'ct_end',
      afterDays: 4,
      silence: true,
      out: [
        { from: 'peer', text: 'channels.tmp_counter.ct_end.line.1' },
        { from: 'peer', sys: 'narrate', text: 'channels.tmp_counter.ct_end.line.2', onRead: { res: { meds: 3 }, stats: { sanity: -2 }, tone: 'grim' } },
        { from: 'peer', sys: 'silent', text: 'channels.tmp_counter.sys.lost' },
      ],
    },
  ],
};

/** 07 · 货运司机：有路线，但要油换 */
export const TMP_TRUCKER: ChannelDef = {
  id: 'tmp_trucker',
  kind: 'person',
  name: 'channels.tmp_trucker.name',
  short: '货',
  tagline: 'channels.tmp_trucker.tagline',
  discover: 'search',
  minRadio: 1,
  replyWindowDays: 4,
  beats: [
    {
      id: 'tk_open',
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.tmp_trucker.tk_open.line.1' },
        { from: 'peer', text: 'channels.tmp_trucker.tk_open.line.2' },
      ],
      choices: [
        {
          id: 'trade',
          label: 'channels.tmp_trucker.tk_open.choice.trade.label',
          note: 'channels.tmp_trucker.tk_open.choice.trade.note',
          requires: { res: { fuel: 5 } },
          say: 'channels.tmp_trucker.tk_open.choice.trade.say',
          affinity: 8,
          effect: { res: { fuel: -5 }, setFlags: ['flag:tkTraded'], tone: 'good' },
        },
        {
          id: 'no',
          label: 'channels.tmp_trucker.tk_open.choice.no.label',
          note: 'channels.tmp_trucker.tk_open.choice.no.note',
          affinity: -6,
        },
      ],
    },
    {
      id: 'tk_route',
      afterDays: 2,
      require: { all: ['flag:tkTraded'] },
      out: [
        { from: 'peer', text: 'channels.tmp_trucker.tk_route.line.1' },
        {
          from: 'peer',
          text: 'channels.tmp_trucker.tk_route.line.2',
          onRead: {
            locations: [{ id: 'sig_route', stock: 80 }],
            stats: { sanity: 2 },
            tone: 'good',
          },
        },
      ],
    },
    {
      id: 'tk_warn',
      afterDays: 3,
      out: [{ from: 'peer', text: 'channels.tmp_trucker.tk_warn.line.1' }],
    },
    {
      id: 'tk_end',
      afterDays: 3,
      silence: true,
      out: [
        { from: 'peer', sys: 'narrate', text: 'channels.tmp_trucker.tk_end.line.1', onRead: { stats: { sanity: -3 }, tone: 'grim' } },
        { from: 'peer', sys: 'silent', text: 'channels.tmp_trucker.sys.lost' },
      ],
    },
  ],
};

/** 08 · 说外语的人：只能靠数字交流 */
export const TMP_FOREIGNER: ChannelDef = {
  id: 'tmp_foreigner',
  kind: 'person',
  name: 'channels.tmp_foreigner.name',
  short: '外',
  tagline: 'channels.tmp_foreigner.tagline',
  discover: 'search',
  minRadio: 1,
  replyWindowDays: 4,
  beats: [
    {
      id: 'fg_open',
      out: [{ from: 'peer', text: 'channels.tmp_foreigner.fg_open.line.1' }],
    },
    {
      id: 'fg_number',
      afterDays: 2,
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.tmp_foreigner.fg_number.line.1' },
        { from: 'peer', text: 'channels.tmp_foreigner.fg_number.line.2' },
      ],
      choices: [
        {
          id: 'go',
          label: 'channels.tmp_foreigner.fg_number.choice.go.label',
          note: 'channels.tmp_foreigner.fg_number.choice.go.note',
          say: 'channels.tmp_foreigner.fg_number.choice.go.say',
          affinity: 6,
          effect: { stats: { stamina: -8 }, res: { foodStaple: 6 }, setFlags: ['flag:fgFound'], tone: 'good' },
        },
        {
          id: 'skip',
          label: 'channels.tmp_foreigner.fg_number.choice.skip.label',
          note: 'channels.tmp_foreigner.fg_number.choice.skip.note',
          affinity: -4,
        },
      ],
    },
    {
      id: 'fg_end',
      afterDays: 4,
      silence: true,
      out: [
        { from: 'peer', sys: 'narrate', text: 'channels.tmp_foreigner.fg_end.line.1', onRead: { stats: { sanity: -3 }, tone: 'grim' } },
        { from: 'peer', sys: 'silent', text: 'channels.tmp_foreigner.sys.lost' },
      ],
    },
  ],
};

/** 09 · 骗子：去了就是给袭击开门 */
export const TMP_SCAMMER: ChannelDef = {
  id: 'tmp_scammer',
  kind: 'person',
  name: 'channels.tmp_scammer.name',
  short: '诈',
  tagline: 'channels.tmp_scammer.tagline',
  discover: 'search',
  minRadio: 1,
  replyWindowDays: 3,
  beats: [
    {
      id: 'sc_open',
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.tmp_scammer.sc_open.line.1' },
        { from: 'peer', text: 'channels.tmp_scammer.sc_open.line.2' },
        { from: 'peer', text: 'channels.tmp_scammer.sc_open.line.3' },
      ],
      choices: [
        {
          id: 'go',
          label: 'channels.tmp_scammer.sc_open.choice.go.label',
          note: 'channels.tmp_scammer.sc_open.choice.go.note',
          say: 'channels.tmp_scammer.sc_open.choice.go.say',
          affinity: 4,
          effect: {
            stats: { stamina: -10 },
            world: { exposure: 10 },
            // 去了才知道：那个坐标是个等人上门的地址
            schedule: [{ familyId: 'raid_attempt', inDays: 1 }],
            setFlags: ['flag:scWalkedIn'],
            tone: 'grim',
          },
        },
        {
          id: 'spot',
          label: 'channels.tmp_scammer.sc_open.choice.spot.label',
          note: 'channels.tmp_scammer.sc_open.choice.spot.note',
          requires: { modules: { radio: 2 } },
          affinity: 2,
          effect: { stats: { sanity: -2 }, setFlags: ['flag:scSpotted'], tone: 'grim' },
        },
        {
          id: 'skip',
          label: 'channels.tmp_scammer.sc_open.choice.skip.label',
          note: 'channels.tmp_scammer.sc_open.choice.skip.note',
          affinity: -2,
        },
      ],
    },
    {
      id: 'sc_again',
      afterDays: 2,
      out: [{ from: 'peer', text: 'channels.tmp_scammer.sc_again.line.1' }],
    },
    {
      id: 'sc_end',
      afterDays: 3,
      silence: true,
      out: [
        { from: 'peer', sys: 'narrate', text: 'channels.tmp_scammer.sc_end.line.1' },
        { from: 'peer', sys: 'silent', text: 'channels.tmp_scammer.sys.lost' },
      ],
    },
  ],
};

/** 10 · 同栋楼的人：到死都没见过面 */
export const TMP_NEIGHBOR: ChannelDef = {
  id: 'tmp_neighbor',
  kind: 'person',
  name: 'channels.tmp_neighbor.name',
  short: '邻',
  tagline: 'channels.tmp_neighbor.tagline',
  discover: 'search',
  minRadio: 1,
  replyWindowDays: 4,
  beats: [
    {
      id: 'nb_open',
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.tmp_neighbor.nb_open.line.1' },
        { from: 'peer', text: 'channels.tmp_neighbor.nb_open.line.2' },
      ],
      choices: [
        {
          id: 'hi',
          label: 'channels.tmp_neighbor.nb_open.choice.hi.label',
          note: 'channels.tmp_neighbor.nb_open.choice.hi.note',
          say: 'channels.tmp_neighbor.nb_open.choice.hi.say',
          affinity: 6,
          effect: { stats: { sanity: 3 }, setFlags: ['flag:nbSaidHi'], tone: 'good' },
        },
        {
          id: 'quiet',
          label: 'channels.tmp_neighbor.nb_open.choice.quiet.label',
          note: 'channels.tmp_neighbor.nb_open.choice.quiet.note',
          affinity: -4,
        },
      ],
    },
    {
      id: 'nb_check1',
      afterDays: 2,
      out: [
        { from: 'peer', text: 'channels.tmp_neighbor.nb_check1.line.1' },
        { from: 'peer', text: 'channels.tmp_neighbor.nb_check1.line.2', onRead: { stats: { sanity: 2 }, tone: 'neutral' } },
      ],
    },
    {
      id: 'nb_check2',
      afterDays: 4,
      out: [{ from: 'peer', text: 'channels.tmp_neighbor.nb_check2.line.1' }],
    },
    {
      id: 'nb_check3',
      afterDays: 5,
      out: [
        { from: 'peer', text: 'channels.tmp_neighbor.nb_check3.line.1' },
        { from: 'peer', text: 'channels.tmp_neighbor.nb_check3.line.2' },
      ],
    },
    {
      id: 'nb_last',
      afterDays: 5,
      expectReply: true,
      out: [
        { from: 'peer', text: 'channels.tmp_neighbor.nb_last.line.1' },
        { from: 'peer', text: 'channels.tmp_neighbor.nb_last.line.2' },
      ],
      choices: [
        {
          id: 'tell',
          label: 'channels.tmp_neighbor.nb_last.choice.tell.label',
          note: 'channels.tmp_neighbor.nb_last.choice.tell.note',
          say: 'channels.tmp_neighbor.nb_last.choice.tell.say',
          affinity: 6,
          effect: { stats: { sanity: 3 }, setFlags: ['flag:nbTold'], tone: 'good' },
        },
        {
          id: 'hold',
          label: 'channels.tmp_neighbor.nb_last.choice.hold.label',
          note: 'channels.tmp_neighbor.nb_last.choice.hold.note',
          affinity: -2,
          effect: { stats: { sanity: -3 }, tone: 'grim' },
        },
      ],
    },
  ],
};
