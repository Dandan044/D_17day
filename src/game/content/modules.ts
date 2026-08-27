import type { ModuleDef, ModuleId } from '../types';

/**
 * 避难所模块。
 *
 * 三条建造路径共用同一份 spec：
 *   DIY  = materials + parts + labor（进工程队列，跨天）
 *   雇工 = hireCash（崩溃日后此路径关闭）
 *   成品 = buyCash + buyDays 到货延迟（买晚了钱付了货到不了）
 *
 * buildPenaltyTags 是关键：施工中的模块处于劣化状态，
 * 加固施工到一半时门窗是拆开的，防御比不动工更低。
 */
export const MODULES: ModuleDef[] = [
  {
    id: 'fortify',
    name: '加固',
    short: '防',
    desc: '门窗、承重、射击位。决定袭击能不能被挡在外面。',
    zero: '一扇租房自带的防盗门，和几片玻璃。',
    buildPenaltyTags: ['building:fortify'],
    buildPenaltyDesc: '门窗已被拆开做框架，此时被袭击的损失会更大。',
    levels: [
      { materials: 10, parts: 2, labor: 8, hireCash: 2800, buyCash: 3600, buyDays: 1, desc: '门后加顶杆，窗户钉上木板与角铁。' },
      { materials: 20, parts: 6, labor: 17, hireCash: 6800, buyCash: 8400, buyDays: 2, skill: { id: 'mechanics', level: 2 }, desc: '换装防爆门，一楼窗全部焊上花栏，堆沙袋。' },
      { materials: 34, parts: 14, labor: 30, hireCash: 16000, buyCash: 19000, buyDays: 3, skill: { id: 'mechanics', level: 4 }, desc: '双层门斗、观察孔、内侧射击位。撞不开，只能围。' },
    ],
  },
  {
    id: 'conceal',
    name: '隐蔽',
    short: '隐',
    desc: '让别人根本不知道这里有人。降低每日暴露度累积。',
    zero: '窗帘拉着，但晚上灯一亮，整栋楼都知道你在家。',
    buildPenaltyTags: ['building:conceal'],
    buildPenaltyDesc: '脚手架和材料堆在门口，施工期间反而更显眼。',
    levels: [
      { materials: 6, parts: 2, labor: 6, hireCash: 1800, buyCash: 2400, buyDays: 1, desc: '遮光布封死所有窗缝，门外做出"早已被搬空"的样子。' },
      { materials: 14, parts: 5, labor: 14, hireCash: 5200, buyCash: 6600, buyDays: 2, skill: { id: 'stealth', level: 2 }, desc: '伪装门面：撬痕、封条、喷漆的"此处已清"。声音全部做隔音。' },
      { materials: 26, parts: 10, labor: 26, hireCash: 12500, buyCash: 15000, buyDays: 3, skill: { id: 'stealth', level: 4 }, desc: '假入口与真入口分离，热源与气味都做了处理。你在地图上不存在。' },
    ],
  },
  {
    id: 'cistern',
    name: '储水',
    short: '储',
    desc: '决定你能存多少水。水比食物先要命。',
    zero: '几个空矿泉水瓶和浴缸。',
    buildPenaltyTags: ['building:cistern'],
    buildPenaltyDesc: '水箱正在排空清洗，储水容量暂时归零。',
    levels: [
      { materials: 8, parts: 3, labor: 7, hireCash: 2200, buyCash: 2900, buyDays: 1, desc: '两个 120 L 食品级塑料桶，浴缸铺内衬蓄满。' },
      { materials: 16, parts: 8, labor: 15, hireCash: 5800, buyCash: 7200, buyDays: 2, desc: '不锈钢水塔加浮球阀，接了雨水导流。' },
      { materials: 28, parts: 16, labor: 26, hireCash: 13000, buyCash: 16000, buyDays: 3, skill: { id: 'mechanics', level: 3 }, desc: '大容量储罐 + 循环泵 + 沉淀分层。半个月不下雨也不慌。' },
    ],
  },
  {
    id: 'filter',
    name: '净水',
    short: '净',
    desc: '把脏水变成能喝的水。没有它，喝下去的每一口都是赌博。',
    zero: '烧开而已。对付得了细菌，对付不了重金属和落灰。',
    buildPenaltyTags: ['building:filter'],
    buildPenaltyDesc: '管路断开，施工期间完全无法净水。',
    levels: [
      { materials: 5, parts: 5, labor: 6, hireCash: 2400, buyCash: 3100, buyDays: 1, power: 0, desc: '重力式陶瓷滤芯 + 活性炭。慢，但不用电。' },
      { materials: 10, parts: 12, labor: 14, hireCash: 6600, buyCash: 8200, buyDays: 2, power: 0.8, requiresModules: { power: 1 }, skill: { id: 'mechanics', level: 2 }, desc: '增压泵 + 三级滤芯 + 紫外灯。需要电。' },
      { materials: 18, parts: 22, labor: 25, hireCash: 15000, buyCash: 18500, buyDays: 3, power: 1.6, requiresModules: { power: 2 }, skill: { id: 'mechanics', level: 4 }, desc: '反渗透机组。连黑雨都能处理，代价是耗电和滤芯。' },
    ],
  },
  {
    id: 'power',
    name: '发电',
    short: '电',
    desc: '一切电动模块的前提。也是最响的那个东西。',
    zero: '手电筒和几节干电池。',
    buildPenaltyTags: ['building:power', 'power:blackout'],
    buildPenaltyDesc: '线路正在改接，施工期间全屋断电。',
    levels: [
      { materials: 4, parts: 8, labor: 7, hireCash: 3200, buyCash: 4200, buyDays: 2, desc: '两块 200 W 太阳板 + 一块铅酸电池。够点灯和充电。' },
      { materials: 8, parts: 18, labor: 16, hireCash: 8400, buyCash: 10500, buyDays: 2, skill: { id: 'mechanics', level: 2 }, desc: '组串式光伏 + 磷酸铁锂储能。晴天有富余。' },
      { materials: 14, parts: 30, labor: 28, hireCash: 19000, buyCash: 24000, buyDays: 3, skill: { id: 'mechanics', level: 4 }, desc: '加装柴油发电机组。产量翻倍，但要烧油、要排气、而且很响。' },
    ],
  },
  {
    id: 'insulate',
    name: '保温',
    short: '温',
    desc: '决定你能扛住多低的温度。严冬期它比加固更重要。',
    zero: '一层单薄的墙和会漏风的窗框。',
    buildPenaltyTags: ['building:insulate'],
    buildPenaltyDesc: '墙体开了洞，保温效果暂时归零。',
    levels: [
      { materials: 10, parts: 2, labor: 8, hireCash: 2200, buyCash: 2800, buyDays: 1, desc: '门窗贴密封条，墙面挂厚毯，做出一间"保温核心房"。' },
      { materials: 20, parts: 5, labor: 16, hireCash: 5600, buyCash: 7000, buyDays: 2, desc: '内墙加聚苯板，双层窗，柴火炉接了烟道。' },
      { materials: 32, parts: 12, labor: 27, hireCash: 13500, buyCash: 16500, buyDays: 3, skill: { id: 'mechanics', level: 3 }, desc: '全屋气密改造 + 热回收换气。零下十八度也活得下去。' },
    ],
  },
  {
    id: 'airFilter',
    name: '空气过滤',
    short: '气',
    desc: '尘、毒气、放射性微粒、飞沫。看不见的那部分威胁。',
    zero: '一包一次性口罩。',
    buildPenaltyTags: ['building:airFilter'],
    buildPenaltyDesc: '通风口敞开着，外面的空气正在直接进来。',
    levels: [
      { materials: 4, parts: 6, labor: 6, hireCash: 2600, buyCash: 3400, buyDays: 1, power: 0.6, desc: 'HEPA 净化器 + 门窗密封。挡得住大颗粒。' },
      { materials: 8, parts: 14, labor: 15, hireCash: 7200, buyCash: 9000, buyDays: 2, power: 1.2, requiresModules: { power: 1 }, skill: { id: 'mechanics', level: 2 }, desc: '正压送风 + 活性炭箱。屋里气压高于室外，脏空气进不来。' },
      { materials: 14, parts: 26, labor: 26, hireCash: 16500, buyCash: 20000, buyDays: 3, power: 2.0, requiresModules: { power: 2 }, skill: { id: 'mechanics', level: 4 }, desc: 'NBC 级过滤机组 + 气密门斗。核生化都能挡一阵。' },
    ],
  },
  {
    id: 'medbay',
    name: '医疗站',
    short: '医',
    desc: '决定同一份药能救回多少命。',
    zero: '一个家用医药箱，里面有过期的感冒药。',
    buildPenaltyTags: ['building:medbay'],
    buildPenaltyDesc: '医疗物资全部打包着，急救效率大幅下降。',
    levels: [
      { materials: 5, parts: 3, labor: 6, hireCash: 2000, buyCash: 2600, buyDays: 1, power: 0.2, desc: '固定的处置台、消毒区、分类药柜。' },
      { materials: 10, parts: 8, labor: 14, hireCash: 5400, buyCash: 6800, buyDays: 2, power: 0.5, skill: { id: 'medicine', level: 2 }, desc: '缝合与固定器械齐备，输液架，冷藏药品。' },
      { materials: 16, parts: 16, labor: 24, hireCash: 12500, buyCash: 15500, buyDays: 3, power: 1.0, requiresModules: { power: 1 }, skill: { id: 'medicine', level: 4 }, desc: '可做小手术的隔离处置间。感染不再等于死刑。' },
    ],
  },
  {
    id: 'garden',
    name: '农圃',
    short: '农',
    desc: '唯一能凭空产出食物的东西。慢，但它是通往长期生存的门。',
    zero: '窗台上一盆快死的绿萝。',
    buildPenaltyTags: ['building:garden'],
    buildPenaltyDesc: '土全翻开了，本轮没有任何产出。',
    levels: [
      { materials: 6, parts: 2, labor: 7, hireCash: 1600, buyCash: 2200, buyDays: 1, power: 0, desc: '育苗盘与栽培箱，种生长期最短的叶菜和豆芽。' },
      { materials: 12, parts: 8, labor: 16, hireCash: 4800, buyCash: 6000, buyDays: 2, power: 0.4, desc: '立体水培架 + 营养液循环。无光站点需要补光灯。' },
      { materials: 22, parts: 15, labor: 27, hireCash: 11000, buyCash: 13500, buyDays: 3, power: 0.9, skill: { id: 'fitness', level: 2 }, desc: '成规模的栽培区 + 蘑菇房 + 种子库。开始有富余。' },
    ],
  },
  {
    id: 'radio',
    name: '无线电',
    short: '讯',
    desc: '外面在发生什么。谁还活着。往哪走。',
    zero: '一部没有信号的手机。',
    buildPenaltyTags: ['building:radio'],
    buildPenaltyDesc: '天线拆下来了，收不到任何东西。',
    levels: [
      { materials: 3, parts: 4, labor: 5, hireCash: 1500, buyCash: 2000, buyDays: 1, power: 0.2, desc: '手摇收音机 + 短波天线。能听，不能说。' },
      { materials: 6, parts: 10, labor: 13, hireCash: 4600, buyCash: 5800, buyDays: 2, power: 0.4, skill: { id: 'mechanics', level: 2 }, desc: '业余电台收发机。可以呼叫，也会被人测向。' },
      { materials: 12, parts: 20, labor: 24, hireCash: 11500, buyCash: 14000, buyDays: 3, power: 0.7, requiresModules: { power: 1 }, skill: { id: 'mechanics', level: 3 }, desc: '定向天线阵 + 频谱扫描。你能听到不想让你听到的频段。' },
    ],
  },
];

export const MODULE_BY_ID: Record<ModuleId, ModuleDef> = Object.fromEntries(
  MODULES.map((m) => [m.id, m]),
) as Record<ModuleId, ModuleDef>;

export const MODULE_IDS: ModuleId[] = MODULES.map((m) => m.id);

/** 等级 1..3 的 spec；0 级没有 spec */
export function moduleSpec(id: ModuleId, level: number) {
  const def = MODULE_BY_ID[id];
  if (level < 1 || level > 3) return null;
  return def.levels[level - 1] ?? null;
}
