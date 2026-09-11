import { registerTree } from '../../t';

/** 无线电面板框架 + 引擎用的公共键。前缀 channels，避免与 ui.* / event.* 混在一起 */
export const data = {
  ui: {
    title: '无线电',
    subtitle: '{n} 个频段 · {unread} 条未读',
    search: '搜索频道',
    searchCost: '1 行动点 · 0.4 kWh',
    searchEmpty: '只有静电。',
    searchFound: '搜到一个新频段：{name}',
    empty: '还没有任何频段。守着电台等，或者主动搜一搜。',
    none: '这一头没有需要你回答的话。',
    silentTail: '已静默',
    lostTail: '永久静默',
    lastSeen: '最后在线 第 {n} 天',
    you: '你',
    dayN: '第 {n} 天',
    bond: {
      stranger: '陌生',
      familiar: '熟悉',
      close: '交心',
      reliant: '依赖',
    },
    hint: '对方在等你回话。',
    sending: '发送中',
  },
  err: {
    noChannel: '没有这个频段',
    noChoice: '这条已经回过了',
    lost: '这个频段已经永久静默，发送不出去',
    searchOnce: '今天已经搜过了，明天再来',
    noAp: '行动点不足',
    offline: '电台不在线，收不到东西',
    noPower: '蓄电不够。想听想发，就得把电台排到供电表前面',
    needRadio2: '1 级电台只能听。要说话，得有收发机。',
    noRadio: '你还没有无线电',
  },
  log: {
    arrived: '{name} 有新的消息',
    lost: '{name} 永久静默了',
    onAir: '{name} 开始广播',
  },
  sys: {
    timeout: '对方没有再等下去。这个频段安静了。',
  },
};

registerTree('channels', data);
