import type { ChannelDef } from '../../types';

/**
 * 剩下的八个临时频道（**事件制**）。
 *
 * 它们的共同点：短、不给解法、大多以静默收尾。
 * 全部靠「搜索频道」得到，不特殊标注——玩家只会看到一个频率号。
 * 集中放一个文件，是因为它们每个只有 2–5 拍，拆成八个文件反而不好找。
 *
 * 每个拍都是单轮事件：这些频道从头到尾没有分叉（没有一个 `reply`），
 * 所以一个拍 = 一个事件 = 一个轮。
 */

/** 03 · 放歌的人：纯粹的陪伴，直到歌停了 */
export const TMP_SINGER: ChannelDef = {
  id: 'tmp_singer',
  kind: 'person',
  name: 'channels.tmp_singer.name',
  short: '♪',
  tagline: 'channels.tmp_singer.tagline',
  discover: 'search',
  replyWindowDays: 4,
  events: [
    {
      id: 'sg_open',
      kind: 'open',
      opening: [{ from: 'peer', text: 'channels.tmp_singer.sg_open.line.1', onRead: { stats: { sanity: 5 }, tone: 'good' } }],
      first: 'sg_open',
      rounds: [{ id: 'sg_open', out: [] }],
    },
    {
      id: 'sg_again',
      afterDays: 2,
      kind: 'daily',
      opening: [{ from: 'peer', text: 'channels.tmp_singer.sg_again.line.1' }],
      first: 'sg_again',
      rounds: [{ id: 'sg_again', out: [] }],
    },
    {
      id: 'sg_cut',
      afterDays: 3,
      kind: 'daily',
      opening: [
        { from: 'peer', text: 'channels.tmp_singer.sg_cut.line.1' },
        { from: 'peer', sys: 'narrate', text: 'channels.tmp_singer.sg_cut.line.2', onRead: { stats: { sanity: -3 }, tone: 'grim' } },
      ],
      first: 'sg_cut',
      rounds: [{ id: 'sg_cut', out: [] }],
    },
    {
      id: 'sg_end',
      afterDays: 3,
      silence: true,
      kind: 'end',
      opening: [
        { from: 'peer', text: 'channels.tmp_singer.sg_end.line.1' },
        { from: 'peer', sys: 'silent', text: 'channels.tmp_singer.sys.lost' },
      ],
      first: 'sg_end',
      rounds: [{ id: 'sg_end', out: [], silence: true }],
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
  replyWindowDays: 4,
  events: [
    {
      id: 'dr_open',
      kind: 'request',
      opening: [
        { from: 'peer', text: 'channels.tmp_doctor.dr_open.line.1' },
        { from: 'peer', text: 'channels.tmp_doctor.dr_open.line.2' },
      ],
      first: 'dr_open',
      rounds: [
        {
          id: 'dr_open',
          out: [],
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
      ],
    },
    {
      id: 'dr_truth',
      afterDays: 3,
      kind: 'daily',
      opening: [
        { from: 'peer', text: 'channels.tmp_doctor.dr_truth.line.1' },
        { from: 'peer', text: 'channels.tmp_doctor.dr_truth.line.2', onRead: { stats: { sanity: -2 }, tone: 'grim' } },
      ],
      first: 'dr_truth',
      rounds: [{ id: 'dr_truth', out: [] }],
    },
    {
      id: 'dr_end',
      afterDays: 4,
      silence: true,
      kind: 'end',
      opening: [
        { from: 'peer', sys: 'narrate', text: 'channels.tmp_doctor.dr_end.line.1' },
        { from: 'peer', sys: 'silent', text: 'channels.tmp_doctor.sys.lost' },
      ],
      first: 'dr_end',
      rounds: [{ id: 'dr_end', out: [], silence: true }],
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
  replyWindowDays: 4,
  events: [
    {
      id: 'ch_open',
      kind: 'open',
      opening: [
        { from: 'peer', text: 'channels.tmp_child.ch_open.line.1' },
        { from: 'peer', text: 'channels.tmp_child.ch_open.line.2' },
      ],
      first: 'ch_open',
      rounds: [{ id: 'ch_open', out: [] }],
    },
    {
      id: 'ch_more',
      afterDays: 2,
      kind: 'daily',
      opening: [{ from: 'peer', text: 'channels.tmp_child.ch_more.line.1' }],
      first: 'ch_more',
      rounds: [{ id: 'ch_more', out: [] }],
    },
    {
      id: 'ch_end',
      afterDays: 3,
      silence: true,
      kind: 'end',
      opening: [
        { from: 'peer', sys: 'narrate', text: 'channels.tmp_child.ch_end.line.1', onRead: { stats: { sanity: -4 }, tone: 'grim' } },
        { from: 'peer', sys: 'silent', text: 'channels.tmp_child.sys.lost' },
      ],
      first: 'ch_end',
      rounds: [{ id: 'ch_end', out: [], silence: true }],
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
  replyWindowDays: 4,
  events: [
    {
      id: 'ct_open',
      kind: 'open',
      opening: [{ from: 'peer', text: 'channels.tmp_counter.ct_open.line.1' }],
      first: 'ct_open',
      rounds: [{ id: 'ct_open', out: [] }],
    },
    {
      id: 'ct_end',
      afterDays: 4,
      silence: true,
      kind: 'end',
      opening: [
        { from: 'peer', text: 'channels.tmp_counter.ct_end.line.1' },
        { from: 'peer', sys: 'narrate', text: 'channels.tmp_counter.ct_end.line.2', onRead: { res: { meds: 3 }, stats: { sanity: -2 }, tone: 'grim' } },
        { from: 'peer', sys: 'silent', text: 'channels.tmp_counter.sys.lost' },
      ],
      first: 'ct_end',
      rounds: [{ id: 'ct_end', out: [], silence: true }],
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
  replyWindowDays: 4,
  events: [
    {
      id: 'tk_open',
      kind: 'request',
      opening: [
        { from: 'peer', text: 'channels.tmp_trucker.tk_open.line.1' },
        { from: 'peer', text: 'channels.tmp_trucker.tk_open.line.2' },
      ],
      first: 'tk_open',
      rounds: [
        {
          id: 'tk_open',
          out: [],
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
      ],
    },
    {
      id: 'tk_route',
      afterDays: 2,
      require: { all: ['flag:tkTraded'] },
      kind: 'daily',
      opening: [
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
      first: 'tk_route',
      rounds: [{ id: 'tk_route', out: [] }],
    },
    {
      id: 'tk_warn',
      afterDays: 3,
      kind: 'daily',
      opening: [{ from: 'peer', text: 'channels.tmp_trucker.tk_warn.line.1' }],
      first: 'tk_warn',
      rounds: [{ id: 'tk_warn', out: [] }],
    },
    {
      id: 'tk_end',
      afterDays: 3,
      silence: true,
      kind: 'end',
      opening: [
        { from: 'peer', sys: 'narrate', text: 'channels.tmp_trucker.tk_end.line.1', onRead: { stats: { sanity: -3 }, tone: 'grim' } },
        { from: 'peer', sys: 'silent', text: 'channels.tmp_trucker.sys.lost' },
      ],
      first: 'tk_end',
      rounds: [{ id: 'tk_end', out: [], silence: true }],
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
  replyWindowDays: 4,
  events: [
    {
      id: 'fg_open',
      kind: 'open',
      opening: [{ from: 'peer', text: 'channels.tmp_foreigner.fg_open.line.1' }],
      first: 'fg_open',
      rounds: [{ id: 'fg_open', out: [] }],
    },
    {
      id: 'fg_number',
      afterDays: 2,
      kind: 'request',
      opening: [
        { from: 'peer', text: 'channels.tmp_foreigner.fg_number.line.1' },
        { from: 'peer', text: 'channels.tmp_foreigner.fg_number.line.2' },
      ],
      first: 'fg_number',
      rounds: [
        {
          id: 'fg_number',
          out: [],
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
      ],
    },
    {
      id: 'fg_end',
      afterDays: 4,
      silence: true,
      kind: 'end',
      opening: [
        { from: 'peer', sys: 'narrate', text: 'channels.tmp_foreigner.fg_end.line.1', onRead: { stats: { sanity: -3 }, tone: 'grim' } },
        { from: 'peer', sys: 'silent', text: 'channels.tmp_foreigner.sys.lost' },
      ],
      first: 'fg_end',
      rounds: [{ id: 'fg_end', out: [], silence: true }],
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
  replyWindowDays: 3,
  events: [
    {
      id: 'sc_open',
      kind: 'crisis',
      opening: [
        { from: 'peer', text: 'channels.tmp_scammer.sc_open.line.1' },
        { from: 'peer', text: 'channels.tmp_scammer.sc_open.line.2' },
        { from: 'peer', text: 'channels.tmp_scammer.sc_open.line.3' },
      ],
      first: 'sc_open',
      rounds: [
        {
          id: 'sc_open',
          out: [],
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
      ],
    },
    {
      id: 'sc_again',
      afterDays: 2,
      kind: 'daily',
      opening: [{ from: 'peer', text: 'channels.tmp_scammer.sc_again.line.1' }],
      first: 'sc_again',
      rounds: [{ id: 'sc_again', out: [] }],
    },
    {
      id: 'sc_end',
      afterDays: 3,
      silence: true,
      kind: 'end',
      opening: [
        { from: 'peer', sys: 'narrate', text: 'channels.tmp_scammer.sc_end.line.1' },
        { from: 'peer', sys: 'silent', text: 'channels.tmp_scammer.sys.lost' },
      ],
      first: 'sc_end',
      rounds: [{ id: 'sc_end', out: [], silence: true }],
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
  replyWindowDays: 4,
  events: [
    {
      id: 'nb_open',
      kind: 'request',
      opening: [
        { from: 'peer', text: 'channels.tmp_neighbor.nb_open.line.1' },
        { from: 'peer', text: 'channels.tmp_neighbor.nb_open.line.2' },
      ],
      first: 'nb_open',
      rounds: [
        {
          id: 'nb_open',
          out: [],
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
      ],
    },
    {
      id: 'nb_check1',
      afterDays: 2,
      kind: 'daily',
      opening: [
        { from: 'peer', text: 'channels.tmp_neighbor.nb_check1.line.1' },
        { from: 'peer', text: 'channels.tmp_neighbor.nb_check1.line.2', onRead: { stats: { sanity: 2 }, tone: 'neutral' } },
      ],
      first: 'nb_check1',
      rounds: [{ id: 'nb_check1', out: [] }],
    },
    {
      id: 'nb_check2',
      afterDays: 4,
      kind: 'daily',
      opening: [{ from: 'peer', text: 'channels.tmp_neighbor.nb_check2.line.1' }],
      first: 'nb_check2',
      rounds: [{ id: 'nb_check2', out: [] }],
    },
    {
      id: 'nb_check3',
      afterDays: 5,
      kind: 'daily',
      opening: [
        { from: 'peer', text: 'channels.tmp_neighbor.nb_check3.line.1' },
        { from: 'peer', text: 'channels.tmp_neighbor.nb_check3.line.2' },
      ],
      first: 'nb_check3',
      rounds: [{ id: 'nb_check3', out: [] }],
    },
    {
      id: 'nb_last',
      afterDays: 5,
      kind: 'request',
      opening: [
        { from: 'peer', text: 'channels.tmp_neighbor.nb_last.line.1' },
        { from: 'peer', text: 'channels.tmp_neighbor.nb_last.line.2' },
      ],
      first: 'nb_last',
      rounds: [
        {
          id: 'nb_last',
          out: [],
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
    },
  ],
};
