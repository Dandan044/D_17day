import { registerTree } from '../../t';

/** 无线电面板框架 + 引擎用的公共键。前缀 channels，避免与 ui.* / event.* 混在一起 */
export const data = {
  ui: {
    title: '无线电',
    /** 机身上的型号铭牌 */
    model: 'R-7',
    /** 电源开关（关掉面板） */
    powerOff: '关机',
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
    /** 事件的开场在等你先开口 */
    hintOpen: '他在听。你先说。',
    /** 事件里的轮次进度，跟在 hint 后面 */
    roundN: '第 {n} 轮',
    sending: '发送中',
    /** 你说完话之后的状态提示：让玩家分得清"等回音 / 不会有回音"，而不是一片沉默 */
    awaitingReply: '已发出。对方还没接话。',
    awaitingOrg: '已提交。广播要等明天才有下文。',
    noAnswerPerson: '对方没有回话。',
    noAnswerOrg: '单向广播：这里不会有回音。',
    /** 这一轮被 delayDays 压着（他过几天才回） */
    holding: '他在那一头没有马上开口。',
  },
  err: {
    noChannel: '没有这个频段',
    noChoice: '这条已经回过了',
    lost: '这个频段已经永久静默，发送不出去',
    searchOnce: '今天已经搜过了，明天再来',
    noAp: '行动点不足',
    offline: '电台不在线，收不到东西',
    noPower: '蓄电不够。想听想发，就得把电台排到供电表前面',
    // 1 级已能收发，这两个键现在只用于「高等级才解锁的选项」的门槛原因
    needRadio2: '需要 2 级电台（收发机）才能这样做。',
    needRadio3: '需要 3 级电台（定向天线阵）才能这样做。',
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
