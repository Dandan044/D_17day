import type { EndingDef } from '../types';
import { hydrateNamed } from '../copy/hydrate';
import { pickCopy } from '../copy/t';
import '../copy';

/**
 * 结局。priority 高的先判，所以特殊结局会盖过通用的"活下来了"。
 */
export const ENDINGS: EndingDef[] = [
  // ============ 胜利 ============
  {
    id: 'self_sufficient',
    name: '不再需要外面',
    subtitle: '自给自足',
    kind: 'win',
    priority: 60,
    require: { modules: { garden: 3, power: 3, filter: 3 } },
    text: '第四十九天早上，你在栽培架上摘了三根黄瓜。\n蓄电池是满的，储水罐是满的，滤芯还能用二十天。你算过一遍：从今天起，这个地方每天产出的东西刚好超过消耗掉的东西。\n差很小，但够你不用再出门。\n窗外还是那个世界。你把窗帘拉上，去洗黄瓜。',
    relics: 160,
    unlock: ['class_engineer', 'site_bunker', 'blueprint_hydroponics'],
  },
  {
    id: 'north_route',
    name: '往北的那条路',
    subtitle: '迁徙',
    kind: 'win',
    priority: 58,
    require: {
      tags: { all: ['flag:knowsNorthRoute', 'hasVehicle'] },
      res: { fuel: 30 },
      reason: '需要北上路线、车辆与 30 L 燃料',
    },
    text: '无线电里那个坐标你听了十九遍，终于对上了地图。\n第四十九天凌晨四点，你把最后一桶油灌进油箱，把该带的都绑在车顶。发动机响了两次才起来。\n后视镜里，你守了七周的那个地方越来越小。你没有回头看第二次。\n三百公里外有一片还亮着灯的地方。你不知道那是不是真的，但你有整整一箱油可以去证实。',
    relics: 180,
    unlock: ['class_trucker', 'site_watertower', 'pack_cash'],
  },
  {
    id: 'community',
    name: '这栋楼还有人',
    subtitle: '社区',
    kind: 'win',
    wip: true,
    priority: 55,
    require: {
      stats: { humanity: 65 },
      tags: { all: ['crew:some'] },
      reason: '需要高人性与至少两名同伴',
    },
    text: '第四十九天，楼道里的灯又亮了——不是电，是十几支蜡烛，一层一层摆上去的。\n老陈修好了公共水泵，李姐组织了轮流值夜，二楼那家的孩子已经能跑了。你们把七户人家的物资凑在一起管，账记在一个练习本上。\n没有人再单独做决定。\n你回想起第一天你差点没给她那八升水。',
    relics: 175,
    unlock: ['class_nurse', 'pack_medical', 'perk_leader'],
  },
  {
    id: 'lone_wolf',
    name: '一个人，四十九天',
    subtitle: '独狼',
    kind: 'win',
    wip: true,
    priority: 50,
    require: { tags: { all: ['crew:none'] }, reason: '需要全程没有同伴' },
    text: '你没有让任何人进来过。\n四十九天里你说过的话总共不超过一百句，其中大部分是对自己说的。没有同伴，没有额外的嘴，也没有人知道这扇门后面住着人。\n第四十九天，你在本子上画完最后一格。门口从来没有别人的脚印。\n你活下来了。屋子里只有你的呼吸。',
    relics: 150,
    unlock: ['class_hoarder', 'perk_ghost'],
  },
  {
    id: 'survived',
    name: '第五十天的太阳',
    subtitle: '生还',
    kind: 'win',
    priority: 10,
    text: '第四十九天的夜里，无线电在一个从没用过的频段上突然清晰起来。\n是国际救援频道。他们在报一串安置点，其中一个离这里十四公里。播报重复了三遍，每一遍都念了一句"仍有幸存者请回应"。\n你按下发射键，说出了自己的名字和门牌号。\n对面停了两秒，然后说：收到。请在原地等待。',
    relics: 120,
    unlock: ['class_hacker', 'pack_basic'],
  },

  // ============ 死亡 ============
  {
    id: 'death_hunger',
    name: '算错了',
    subtitle: '饿死',
    kind: 'lose',
    priority: 90,
    cause: ['饥饿', '营养不良'],
    text: '你一直在算：每天两份，还能撑十四天。然后是每天一份，还能撑二十天。然后是隔天一份。\n数学一直是对的。只有身体不认这套算法。\n最后几天你已经不觉得饿了，只是很困。你坐下来想歇一会儿。',
    relics: 0,
  },
  {
    id: 'death_thirst',
    name: '三天',
    subtitle: '脱水',
    kind: 'lose',
    priority: 90,
    cause: ['脱水'],
    text: '人可以不吃三周，但不能不喝三天。这个数字你早就知道。\n你只是没想到雨会停这么久，也没想到那个储水罐的接口会在最不该的时候裂开。\n最后一天你舔了窗户上的霜。',
    relics: 0,
  },
  {
    id: 'death_illness',
    name: '一道红线',
    subtitle: '病死',
    kind: 'lose',
    priority: 90,
    cause: ['伤口感染', '痢疾', '流感', '霉菌性肺病', '骨折'],
    text: '在有医院的时代，这是一周的假、两百块的药。\n现在它是一条沿着手臂往上走的红线，每天两厘米，不快，但从不停。\n你数着它走过肘窝，走到肩膀。之后你就没再数了。',
    relics: 0,
  },
  {
    id: 'death_cold',
    name: '不觉得冷了',
    subtitle: '失温',
    kind: 'lose',
    priority: 90,
    cause: ['失温'],
    text: '发抖停了。那天夜里你觉得暖和了，甚至想把外套脱掉。\n你在自己搭的那个"保温核心房"里睡着了，外面是零下十九度。\n人停止发抖的时候，往往已经来不及了。',
    relics: 0,
  },
  {
    id: 'death_radiation',
    name: '那两个小时',
    subtitle: '辐射病',
    kind: 'lose',
    priority: 90,
    cause: ['辐射'],
    text: '你做对了很多事：封了窗，屏了墙，屋里的空气是干净的。\n但你在第三天出去过一趟，只有两个小时，而那两个小时是黑雨落得最大的时候。\n那之后有一段虚假的好转期。你以为自己躲过去了。',
    relics: 0,
  },
  {
    id: 'death_raid',
    name: '门开了',
    subtitle: '袭击',
    kind: 'lose',
    priority: 92,
    cause: ['袭击'],
    text: '门没挡住。他们有六个人和一把液压剪。整个过程不到四分钟。\n你最后想起的事很奇怪——是你在第二天犹豫过要不要把那笔钱花在加固上。',
    relics: 0,
  },
  {
    id: 'death_air',
    name: '你数过自己的呼吸',
    subtitle: '吸入性中毒',
    kind: 'lose',
    priority: 91,
    cause: ['吸入污染物'],
    text: '外面的空气有颜色。你封了门窗，用湿毛巾堵了每一道缝，但一间屋子不是一个滤罐。\n最后几天你走两步就要停下来，胸口像有人坐在上面。\n你算过：一个 HEPA 机组三千四，你当时觉得太贵了。',
    relics: 5,
    unlock: ['blueprint_ventilation'],
  },
  {
    id: 'death_sanity',
    name: '不再有理由',
    subtitle: '精神崩溃',
    kind: 'lose',
    priority: 88,
    cause: ['精神崩溃', '绝望'],
    text: '物资还够，门还锁着，屋里也不冷。\n但你已经连续十一天没有跟任何人说过一句话，而你昨天开始听见楼道里有人叫你的名字——那里没有人。\n第四十天早上，你没有从床上起来。腿还听使唤。',
    relics: 0,
  },
  {
    id: 'death_co',
    name: '六十八块',
    subtitle: '一氧化碳中毒',
    kind: 'lose',
    priority: 94,
    cause: ['一氧化碳中毒'],
    text: '你把门窗封死后，屋里几乎不进风。你为此很自豪。\n那天夜里你在屋里点了炉子取暖，睡得特别沉，头一点也不疼——不，其实疼过，凌晨两点你翻了个身，觉得有点闷。\n五金店的王老板曾经从柜台底下摸出一个白色的小圆盘。六十八块。',
    relics: 5,
    unlock: ['blueprint_ventilation'],
  },
  {
    id: 'death_generic',
    name: '第 {day} 天',
    subtitle: '死亡',
    kind: 'lose',
    priority: 1,
    text: '你没能撑到第五十天。\n这个城市里还有很多人也没有。他们中的大多数，甚至没有你准备得这么充分。',
    relics: 0,
  },
];

for (const e of ENDINGS) {
  Object.assign(e, hydrateNamed('ending', e, ['name', 'subtitle', 'text']));
  if (e.require?.reason) e.require = { ...e.require, reason: pickCopy(`ending.${e.id}.reason`, e.require.reason) };
}

export const ENDING_BY_ID: Record<string, EndingDef> = Object.fromEntries(ENDINGS.map((e) => [e.id, e]));
