import type { DisasterId, FactionId, ModuleId, WeatherId, WorldState } from '../types';
import { hydrateNamed } from '../copy/hydrate';
import '../copy';

export interface DisasterDef {
  id: DisasterId;
  name: string;
  codename: string;
  revealTitle: string;
  reveal: string;
  /** 一句话概括这场灾难真正考验什么 */
  thesis: string;
  keySupplies: string[];
  keyModules: ModuleId[];
  factions: FactionId[];
  /** 崩溃日一次性施加的世界状态 */
  onset: Partial<Pick<WorldState, 'airPollution' | 'radiation' | 'contagion' | 'lawOrder' | 'scarcity' | 'waterTable' | 'powerGrid'>>;
  /** 每日演化增量 */
  daily: (day: number, threat: number) => {
    airPollution?: number;
    radiation?: number;
    contagion?: number;
    lawOrder?: number;
    scarcity?: number;
  };
  /** 天气抽取权重 */
  weather: Partial<Record<WeatherId, number>>;
  /** 气温偏移，随末世等级放大 */
  tempBias: number;
  /** 情报里会出现的关键词，用于生成线索 */
  clueTopics: string[];
}

export const DISASTERS: DisasterDef[] = [
  {
    id: 'nuclear',
    name: '核交火',
    codename: 'FALLOUT',
    revealTitle: '西北方向的天空亮了两次',
    reveal:
      '西北方向的天空亮了两次。第一下你当闪电，数到三，第二下把窗玻璃映成白纸。杯子在桌上自己挪了半寸。\n几秒后震波才到。整栋楼像被谁从侧面推了一把，防盗门嗡嗡响，楼道里的声控灯同时亮了。\n三小时后手机没信号。电闸跳了，合不上。收音机里只剩沙沙声。\n傍晚下雨。雨是灰黑色的，打在空调外机上有细砂声。窗台上积了一层，用手指一抹是湿的。\n没有新闻。没有人来解释。居委会的喇叭没响。有人在楼道里喊核爆了，有人只是把门反锁，把缝用胶带贴死。',
    thesis: '沉降物看不见。封窗、躲厚墙后面，最初三天把碘片按说明书吃掉。',
    keySupplies: ['碘片', '密封胶带', '盖革计数器', '瓶装水'],
    keyModules: ['airFilter', 'insulate', 'filter', 'fortify'],
    factions: ['gov', 'looter', 'militia'],
    onset: { radiation: 48, airPollution: 40, lawOrder: 46, scarcity: 55, powerGrid: 'off', waterTable: 'polluted' },
    daily: (_day, threat) => ({
      radiation: -2 + threat * 0.16,
      airPollution: -0.5,
      lawOrder: -1.6,
      scarcity: 1.2,
    }),
    weather: { blackRain: 3, overcast: 4, ashfall: 2, clear: 2, rain: 2, fog: 2, snow: 2 },
    tempBias: -4,
    clueTopics: ['边境', '战备', '碘片', '防空警报', '大使馆撤离'],
  },
  {
    id: 'pandemic',
    name: '超级流感',
    codename: 'VECTOR',
    revealTitle: '医院不再收人了',
    reveal:
      '早上七点，小区门口贴了一张 A4 纸：即日起封闭管理。八点，你看见穿白色连体服的人抬走了三楼的老太太。\n新闻里那个词从"局部聚集性病例"变成了"社区传播"，再变成"请勿外出"。\n它的可怕之处不是致死率，是潜伏期——你不知道谁已经带上了它。包括你自己。',
    thesis: '病从人身上来。每次开门都可能染上，但药和消息还是得跟人换。',
    keySupplies: ['药品', 'N95 口罩', '消毒液', '体温计'],
    keyModules: ['medbay', 'airFilter', 'garden', 'conceal'],
    factions: ['quarantine', 'cult', 'neighbors', 'gang'],
    onset: { contagion: 46, lawOrder: 62, scarcity: 48, powerGrid: 'rolling' },
    daily: (_day, threat) => ({
      contagion: 1.8 - threat * 0.12,
      lawOrder: -1.3,
      scarcity: 1.3,
    }),
    weather: { clear: 4, overcast: 4, rain: 3, fog: 2, snow: 2, storm: 1, heatwave: 2 },
    tempBias: 0,
    clueTopics: ['不明肺炎', '疾控中心', '封控', '口罩涨价', '医护感染'],
  },
  {
    id: 'gridDown',
    name: '电网崩溃',
    codename: 'BLACKSTART',
    revealTitle: '这一次没有再亮起来',
    reveal:
      '凌晨两点十七分，整座城市同时熄灭。你等着几分钟后那熟悉的嗡鸣回来，它没有来。\n有人说变压器烧了，有人说太阳风暴，有人说是人为的。没有官方说法。\n加油站的泵不转了，超市收银机黑着，水厂加压泵停了。第三天，路口已经没有交警。',
    thesis: '电没了。泵、收银、水厂一起停，汽油从此按升论价。',
    keySupplies: ['汽油', '柴油', '机械零件', '现金与硬通货'],
    keyModules: ['power', 'filter', 'fortify', 'cistern'],
    factions: ['gang', 'militia', 'looter', 'trader'],
    onset: { lawOrder: 36, scarcity: 62, powerGrid: 'off' },
    daily: (_day, threat) => ({
      lawOrder: -2.3 + threat * 0.1,
      scarcity: 1.6,
    }),
    weather: { clear: 4, overcast: 3, rain: 3, snow: 3, storm: 2, blizzard: 1, fog: 2, heatwave: 1 },
    tempBias: -2,
    clueTopics: ['地磁暴', '变电站', '电网检修', '柴油抢购', '通信中断'],
  },
  {
    id: 'volcanicWinter',
    name: '火山冬天',
    codename: 'ASHFALL',
    revealTitle: '第三天开始，太阳只是一个灰色的圆点',
    reveal:
      '灰是从西南方向来的。起初像脏雪，落在车顶上薄薄一层，人们还拍照。\n第二天早上，那层灰厚到能踩出脚印，而气温比昨天低了九度。\n植物在两周内会死。太阳变成一个灰色的圆点，一直不走。',
    thesis: '天黑、低温、灰往肺里走。要烧的、要封的，还得在屋里种出东西。',
    keySupplies: ['燃料', '厚衣物与睡袋', 'HEPA 滤芯', '耐储粮'],
    keyModules: ['insulate', 'airFilter', 'garden', 'power'],
    factions: ['refugee', 'gov', 'gang'],
    onset: { airPollution: 52, lawOrder: 56, scarcity: 54, powerGrid: 'rolling' },
    daily: (_day, threat) => ({
      airPollution: 0.8 - threat * 0.05,
      lawOrder: -1.4,
      scarcity: 1.5,
    }),
    weather: { ashfall: 6, overcast: 4, snow: 3, fog: 2, blizzard: 2, rain: 1 },
    tempBias: -9,
    clueTopics: ['火山活动', '地震群', '航班停飞', '硫味', '气温异常'],
  },
  {
    id: 'flood',
    name: '区域洪灾',
    codename: 'HIGHWATER',
    revealTitle: '水从下水道里往上涌',
    reveal:
      '上游的水库在夜里泄了洪，而雨已经连着下了十一天。\n你听见的第一个声音不是水，是汽车报警器——几十辆一起，因为它们都在往下沉。\n水会退。退之前，一楼以下泡着的东西都没了，包括能喝的水。',
    thesis: '低处会淹。地下站不住，自来水不能喝，出门只能走水路。',
    keySupplies: ['净水滤芯', '瓶装水', '防水袋', '橡皮艇或救生衣'],
    keyModules: ['filter', 'cistern', 'radio', 'medbay'],
    factions: ['rescue', 'looter', 'neighbors'],
    onset: { lawOrder: 52, scarcity: 50, powerGrid: 'off', waterTable: 'flooded', contagion: 18 },
    daily: (_day, threat) => ({
      lawOrder: -1.5,
      scarcity: 1.4,
      contagion: 0.9 - threat * 0.05,
    }),
    weather: { flooding: 5, rain: 5, storm: 3, overcast: 3, fog: 2 },
    tempBias: -2,
    clueTopics: ['持续降雨', '水库泄洪', '地质预警', '内涝', '桥梁封闭'],
  },
  {
    id: 'chemSpill',
    name: '化工泄漏',
    codename: 'DRIFT',
    revealTitle: '风向决定今天你能不能出门',
    reveal:
      '化工园区的三号罐区在凌晨四点起火，然后是爆炸。上风向的两个镇被清空了。\n那团淡黄色的东西贴着地面走，跟着风。它经过的地方，鸟从树上掉下来。\n云往哪飘，哪边今天就不能出门。',
    thesis: '毒云跟着风走。封窗、换滤芯，每天早上先看它往哪飘。',
    keySupplies: ['活性炭滤芯', '防毒面具', '密封胶带', '瓶装水'],
    keyModules: ['airFilter', 'insulate', 'filter', 'conceal'],
    factions: ['gov', 'quarantine', 'trader'],
    onset: { airPollution: 70, lawOrder: 58, scarcity: 44, waterTable: 'polluted' },
    daily: (day, _threat) => ({
      // 毒云随风来回，不是单调衰减
      airPollution: Math.sin(day * 0.7) * 7 - 0.4,
      lawOrder: -1.2,
      scarcity: 1.1,
    }),
    weather: { fog: 4, overcast: 4, clear: 3, rain: 3, storm: 1, snow: 2, heatwave: 2 },
    tempBias: -1,
    clueTopics: ['化工园区', '环保督查', '刺鼻气味', '疏散演练', '风向预警'],
  },
];

for (const d of DISASTERS) {
  Object.assign(
    d,
    hydrateNamed('disaster', d, ['name', 'codename', 'revealTitle', 'reveal', 'thesis'], ['keySupplies', 'clueTopics']),
  );
}

export const DISASTER_BY_ID: Record<DisasterId, DisasterDef> = Object.fromEntries(
  DISASTERS.map((d) => [d.id, d]),
) as Record<DisasterId, DisasterDef>;
