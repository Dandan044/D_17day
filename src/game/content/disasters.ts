import type { DisasterId, FactionId, ModuleId, WeatherId, WorldState } from '../types';

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
      '第一下你以为是闪电。第二下之后，玻璃开始嗡嗡地响，然后是那种从地底传来的、不像声音的声音。\n三小时后，手机彻底没了信号，电网跳闸再没恢复。傍晚开始下雨——雨是灰黑色的，落在窗台上留下细小的颗粒。\n没有人宣布任何事情。但所有人都明白了。',
    thesis: '你要对抗的是看不见的沉降物：屏蔽、密封、以及在正确的三天里吃对药。',
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
    thesis: '你要对抗的是人：每一次接触都是赌博，而你终究需要别人。',
    keySupplies: ['药品', 'N95 口罩', '消毒液', '体温计'],
    keyModules: ['medbay', 'airFilter', 'garden', 'conceal'],
    factions: ['quarantine', 'cult', 'neighbors', 'gang'],
    onset: { contagion: 46, lawOrder: 62, scarcity: 48, powerGrid: 'rolling' },
    daily: (_day, threat) => ({
      contagion: 1.8 - threat * 0.12,
      lawOrder: -1.3,
      scarcity: 1.3,
    }),
    weather: { clear: 4, overcast: 4, rain: 3, fog: 2, snow: 2, storm: 1 },
    tempBias: 0,
    clueTopics: ['不明肺炎', '疾控中心', '封控', '口罩涨价', '医护感染'],
  },
  {
    id: 'gridDown',
    name: '电网崩溃',
    codename: 'BLACKSTART',
    revealTitle: '这一次没有再亮起来',
    reveal:
      '凌晨两点十七分，整座城市同时熄灭。你等着那种熟悉的、几分钟后就恢复的嗡鸣，但它没有来。\n后来有人说是变压器全烧了，有人说是太阳风暴，有人说是有意为之。都不重要。\n重要的是：加油站的泵不转了，超市的收银机不响了，水厂的加压泵停了。三天后，秩序就是这么没的。',
    thesis: '你要对抗的是文明的断电：所有依赖电的东西同时失效，而燃料是新的货币。',
    keySupplies: ['汽油', '柴油', '机械零件', '现金与硬通货'],
    keyModules: ['power', 'filter', 'fortify', 'cistern'],
    factions: ['gang', 'militia', 'looter', 'trader'],
    onset: { lawOrder: 36, scarcity: 62, powerGrid: 'off' },
    daily: (_day, threat) => ({
      lawOrder: -2.3 + threat * 0.1,
      scarcity: 1.6,
    }),
    weather: { clear: 4, overcast: 3, rain: 3, snow: 3, storm: 2, blizzard: 1, fog: 2 },
    tempBias: -2,
    clueTopics: ['地磁暴', '变电站', '电网检修', '柴油抢购', '通信中断'],
  },
  {
    id: 'volcanicWinter',
    name: '火山冬天',
    codename: 'ASHFALL',
    revealTitle: '第三天开始，太阳只是一个灰色的圆点',
    reveal:
      '灰是从西南方向来的。起初像脏雪，落在车顶上薄薄一层，人们还拍照。\n第二天早上，那层灰厚到能踩出脚印，而气温比昨天低了九度。\n植物在两周内会死。这不是一场天气，这是一个季节的死亡。',
    thesis: '你要对抗的是漫长的低温与无光：燃料、密封、以及在黑暗里种出东西。',
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
      '上游的水库在夜里泄了洪，而雨已经连着下了十一天。\n你听见的第一个声音不是水，是汽车报警器——几十辆一起，因为它们都在往下沉。\n水会退。但在它退之前，一切在低处的东西都不再属于你，包括干净的饮用水。',
    thesis: '你要对抗的是水本身：地下必死，饮用水全被污染，而外面只能靠船走。',
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
      '化工园区的三号罐区在凌晨四点起火，然后是爆炸。上风向的两个镇被清空了。\n那团东西是淡黄色的，贴着地面走，跟着风。它经过的地方，鸟从树上掉下来。\n这场灾难有个特点：它不是均匀的。它只是一片云，而你唯一需要知道的是它今天往哪飘。',
    thesis: '你要对抗的是一团会移动的毒云：密封、滤芯，以及每天早上先看风向。',
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
    weather: { fog: 4, overcast: 4, clear: 3, rain: 3, storm: 1, snow: 2 },
    tempBias: -1,
    clueTopics: ['化工园区', '环保督查', '刺鼻气味', '疏散演练', '风向预警'],
  },
];

export const DISASTER_BY_ID: Record<DisasterId, DisasterDef> = Object.fromEntries(
  DISASTERS.map((d) => [d.id, d]),
) as Record<DisasterId, DisasterDef>;
