import type { ModuleDef, ModuleId } from '../types';
import { hydrateNamed } from '../copy/hydrate';
import { pickCopy, t } from '../copy/t';
import '../copy';

/**
 * 避难所模块。
 *
 * 三条建造路径共用同一份 spec：
 *   DIY  = materials + parts + labor（进工程队列，跨天）
 *   雇工 = hireCash（崩溃日后此路径关闭）
 *   成品 = buyCash + buyDays 到货延迟（买晚了钱付了货到不了）
 *
 * buildPenaltyTags 是关键：施工中的模块处于劣化状态，
 * 加固门施工到一半时门窗是拆开的，防御比不动工更低。
 */
export const MODULES: ModuleDef[] = [
  {
    id: 'fortify',
    name: '加固门',
    short: '门',
    desc: '门窗、承重、射击位。决定袭击能不能被挡在外面。',
    zero: '一道租房自带的防盗门，门框是旧木头，锁芯松松垮垮，猫眼后面那块玻璃一敲就碎。',
    buildPenaltyTags: ['building:fortify'],
    buildPenaltyDesc: '门窗已被拆开做框架，此时被袭击的损失会更大。',
    levels: [
      { materials: 10, parts: 2, labor: 8, hireCash: 2800, buyCash: 3600, buyDays: 1, desc: '门后顶上一根钢管顶杆，两端落点凿进地面与门框；窗框用角铁加固，外面钉死一层建筑模板。挡得住一脚，挡不住撬棍。' },
      { materials: 20, parts: 6, labor: 17, hireCash: 6800, buyCash: 8400, buyDays: 2, skill: { id: 'mechanics', level: 2 }, desc: '换成带钢骨架的防爆门，门框灌了水泥；一楼窗户外焊上螺纹钢花栏，栏后码沙袋。正面撞击只能让门嗡嗡响。' },
      { materials: 34, parts: 14, labor: 30, hireCash: 16000, buyCash: 19000, buyDays: 3, skill: { id: 'mechanics', level: 4 }, desc: '双层门斗：外门防爆、内门实心，中间只留侧身通过的过渡间；门上开观察孔与内侧射击位。撞不开，也围不透。' },
    ],
  },
  {
    id: 'conceal',
    name: '遮光帘',
    short: '帘',
    desc: '让别人根本不知道这里有人。降低每日暴露度累积。',
    zero: '一块旧床单挂在窗帘杆上，风一吹就掀开一角。',
    buildPenaltyTags: ['building:conceal'],
    buildPenaltyDesc: '脚手架和材料堆在门口，施工期间反而更显眼。',
    levels: [
      { materials: 6, parts: 2, labor: 6, hireCash: 1800, buyCash: 2400, buyDays: 1, desc: '遮光布封死主要窗缝，外面再压两层旧毛毯；灯只在里屋点。夜里从楼下看不出这户有人。' },
      { materials: 14, parts: 5, labor: 14, hireCash: 5200, buyCash: 6600, buyDays: 2, skill: { id: 'stealth', level: 2 }, desc: '窗户外侧贴了单向镀膜；门面做出「已搬空」的样子——门口堆杂物，贴断水断电的封条。白天看是个空屋。' },
      { materials: 26, parts: 10, labor: 26, hireCash: 12500, buyCash: 15000, buyDays: 3, skill: { id: 'stealth', level: 4 }, desc: '假入口与真入口分开：走廊那扇门永远锁着、积灰，真正的入口藏在储物间后面；烟道与热源也做了遮挡。' },
    ],
  },
  {
    id: 'cistern',
    name: '水箱',
    short: '水',
    desc: '决定你能囤几天的水。容量按日耗算，不是无限水箱。',
    zero: '几个空矿泉水瓶和一个浴缸。洗菜水留着冲厕所。',
    buildPenaltyTags: ['building:cistern'],
    // 曾经写的是「储水容量暂时归零」。真那么做的话，施工会让容量掉到 0 级，
    // clampResources 会把已经存下的水悄悄倒掉——玩家升级储水反而丢水，且没有提示。
    // 改用「净水暂停」：水箱在清洗，净化出来的水没处存。存量不受影响。
    buildPenaltyDesc: '水箱正在排空清洗，这段时间净化出来的水没处存。',
    levels: [
      { materials: 8, parts: 3, labor: 7, hireCash: 2200, buyCash: 2900, buyDays: 1, desc: '食品级储桶架在浴缸上方，接一根软管分流；桶盖打了孔通气，底下垫砖防潮。够撑一阵子。' },
      { materials: 16, parts: 8, labor: 15, hireCash: 5800, buyCash: 7200, buyDays: 2, desc: '不锈钢水塔架在阳台，装了浮球阀与雨水分流管，出水口前加一道粗滤。雨大的日子能存下不少。' },
      { materials: 28, parts: 16, labor: 26, hireCash: 13000, buyCash: 16000, buyDays: 3, skill: { id: 'mechanics', level: 3 }, desc: '大容量储罐分三层：沉淀、储水、循环；循环泵把末端的水抽回去重新过滤，罐体埋在阴面避光防藻。' },
    ],
  },
  {
    id: 'filter',
    name: '净水器',
    short: '滤',
    desc: '雨雪天把水接进桶；旱天靠回用少喝一点。升级提高雨日产量、减缓滤芯损耗。',
    zero: '一口烧水壶，一个搪瓷盆。泥沙靠沉淀，细菌靠煮沸。',
    buildPenaltyTags: ['building:filter'],
    buildPenaltyDesc: '管路断开，施工期间完全无法净水。',
    levels: [
      { materials: 5, parts: 5, labor: 6, hireCash: 2400, buyCash: 3100, buyDays: 1, power: 0, desc: '两只塑料桶架出落差，中间插一根重力式陶瓷滤芯，出水口再塞一包活性炭。不用电，靠水自己往下滴。' },
      { materials: 10, parts: 12, labor: 14, hireCash: 6600, buyCash: 8200, buyDays: 2, power: 0.8, requiresModules: { power: 1 }, skill: { id: 'mechanics', level: 2 }, desc: '增压泵把水顶过三级串联滤芯——沉棉、颗粒炭、压缩炭，末端一盏紫外灯。雨日接得满，旱天把用过的水回流再滤一遍。' },
      { materials: 18, parts: 22, labor: 25, hireCash: 15000, buyCash: 18500, buyDays: 3, power: 1.6, requiresModules: { power: 2 }, skill: { id: 'mechanics', level: 4 }, desc: '反渗透机组：膜前多介质过滤保护，膜后配压力罐；灰水从回用口抽回来重新过膜。黑雨落下来，也能滤出能喝的一截。' },
    ],
  },
  {
    id: 'power',
    name: '发电机',
    short: '机',
    desc: '一切电动模块的前提。也是最响的那个东西。',
    zero: '几节干电池和一支手电筒，外加一块快没电的充电宝。',
    buildPenaltyTags: ['building:power', 'power:blackout'],
    buildPenaltyDesc: '线路正在改接，施工期间全屋断电。',
    levels: [
      { materials: 4, parts: 8, labor: 7, hireCash: 3200, buyCash: 4200, buyDays: 2, desc: '两块 200W 单晶板斜架在窗外，线束顺窗框进屋，末端挂一块铅酸电池。够点灯、给手机充电，带不动大功率的东西。' },
      { materials: 8, parts: 18, labor: 16, hireCash: 8400, buyCash: 10500, buyDays: 2, skill: { id: 'mechanics', level: 2 }, desc: '组串式光伏铺满采光最好的一面，接 MPPT 控制器与磷酸铁锂储能柜。晴天有富余，能同时供净水、照明和冰箱。' },
      { materials: 14, parts: 30, labor: 28, hireCash: 19000, buyCash: 24000, buyDays: 3, skill: { id: 'mechanics', level: 4 }, desc: '光伏阵列扩到满负荷，储能柜加厚；旁边并一台柴油发电机组，接自动切换开关。要烧油、要排气、而且很响，但停电时你还亮着灯。' },
    ],
  },
  {
    id: 'insulate',
    name: '保温层',
    short: '温',
    desc: '决定屋里的热能留多久。漏得慢，炉子就不用通宵烧。',
    zero: '关紧窗户，一家人缩在一间屋里。热量从墙缝里往外走。',
    buildPenaltyTags: ['building:insulate'],
    buildPenaltyDesc: '墙体开了洞，保温效果暂时归零。',
    levels: [
      { materials: 10, parts: 2, labor: 8, hireCash: 2200, buyCash: 2800, buyDays: 1, desc: '窗缝贴密封条，门上挂厚棉帘；只留一间「核心房」取暖，其余房间关死。热量跑得慢了些。' },
      { materials: 20, parts: 5, labor: 16, hireCash: 5600, buyCash: 7000, buyDays: 2, desc: '内墙贴聚苯板，窗户改成双层中空，烟道包了保温棉。取暖器不再对着空气白烧。' },
      { materials: 32, parts: 12, labor: 27, hireCash: 13500, buyCash: 16500, buyDays: 3, skill: { id: 'mechanics', level: 3 }, desc: '全屋气密处理，换气走带热回收的机组，墙体与天花板做了隔汽层。屋里的热基本只从门缝走。' },
    ],
  },
  {
    id: 'airFilter',
    name: '空气过滤器',
    short: '气',
    desc: '挡灰、毒气、放射性微粒和飞沫。口罩不够用的时候靠它。',
    zero: '一包一次性口罩。',
    buildPenaltyTags: ['building:airFilter'],
    buildPenaltyDesc: '通风口敞开着，外面的空气正在直接进来。',
    levels: [
      { materials: 4, parts: 6, labor: 6, hireCash: 2600, buyCash: 3400, buyDays: 1, power: 0.6, desc: '一台 HEPA 净化器摆在里屋，门窗缝贴了密封条。落灰和一部分放射性微粒被挡在外面。' },
      { materials: 8, parts: 14, labor: 15, hireCash: 7200, buyCash: 9000, buyDays: 2, power: 1.2, requiresModules: { power: 1 }, skill: { id: 'mechanics', level: 2 }, desc: '正压送风：室外空气先过粗滤与活性炭箱再进屋，屋里压强略高于外面，脏空气进不来。' },
      { materials: 14, parts: 26, labor: 26, hireCash: 16500, buyCash: 20000, buyDays: 3, power: 2.0, requiresModules: { power: 2 }, skill: { id: 'mechanics', level: 4 }, desc: 'NBC 级过滤机组接管全屋新风，入口做了气密门斗与洗消段。放射性微粒大多被挡在门外。' },
    ],
  },
  {
    id: 'medbay',
    name: '医疗站',
    short: '医',
    desc: '减轻病情日损，提高自愈；重病需要更高等级才能用药。三级时主动休息能回一点生命。',
    zero: '一个家用急救箱，几卷纱布和半瓶碘伏。',
    buildPenaltyTags: ['building:medbay'],
    buildPenaltyDesc: '医疗物资全部打包着，急救效率大幅下降。',
    levels: [
      { materials: 5, parts: 3, labor: 6, hireCash: 2000, buyCash: 2600, buyDays: 1, power: 0.2, desc: '一张专用处置台，消毒区与生活区分开；药品按用途分类放进柜子，需要冷藏的单独隔出。' },
      { materials: 10, parts: 8, labor: 14, hireCash: 5400, buyCash: 6800, buyDays: 2, power: 0.5, skill: { id: 'medicine', level: 2 }, desc: '缝合与固定器械齐全，输液架、氧气袋、简易监护。有电时能做一些原本非要去医院的事。' },
      { materials: 16, parts: 16, labor: 24, hireCash: 12500, buyCash: 15500, buyDays: 3, power: 1.0, requiresModules: { power: 1 }, skill: { id: 'medicine', level: 4 }, desc: '可做小手术的隔离处置间：无影灯、器械台、器械消毒锅，还有一张术后观察床。' },
    ],
  },
  {
    id: 'garden',
    name: '菜圃',
    short: '菜',
    desc: '唯一能凭空产出食物的东西。慢，但它是通往长期生存的门。',
    zero: '窗台上两个花盆，种什么都不太活。',
    buildPenaltyTags: ['building:garden'],
    buildPenaltyDesc: '土全翻开了，本轮没有任何产出。',
    levels: [
      { materials: 6, parts: 2, labor: 7, hireCash: 1600, buyCash: 2200, buyDays: 1, power: 0, desc: '育苗盘加几个栽培箱，种短周期的叶菜与豆芽；白天搬到采光最好的窗边。' },
      { materials: 12, parts: 8, labor: 16, hireCash: 4800, buyCash: 6000, buyDays: 2, power: 0.4, desc: '立体水培架接上营养液循环，配一盏补光灯。阴面的屋子也能有一茬收成。' },
      { materials: 22, parts: 15, labor: 27, hireCash: 11000, buyCash: 13500, buyDays: 3, power: 0.9, skill: { id: 'fitness', level: 2 }, desc: '规模栽培：多层架、蘑菇房、种子库分开，产量稳定，阴天与污染天有备用光。' },
    ],
  },
  {
    id: 'radio',
    name: '电台',
    short: '讯',
    desc: '外面在发生什么。谁还活着。往哪走。',
    zero: '一支手摇收音机，信号靠运气。',
    buildPenaltyTags: ['building:radio'],
    buildPenaltyDesc: '天线拆下来了，收不到任何东西。',
    levels: [
      { materials: 3, parts: 4, labor: 5, hireCash: 1500, buyCash: 2000, buyDays: 1, power: 0.2, desc: '短波天线拉上阳台，手摇机换成电池供电。夜里能收到几个台。' },
      { materials: 6, parts: 10, labor: 13, hireCash: 4600, buyCash: 5800, buyDays: 2, power: 0.4, skill: { id: 'mechanics', level: 2 }, desc: '业余收发机接上定向天线，能听也能说；换台要手动调，但能摸到别人的动静。' },
      { materials: 12, parts: 20, labor: 24, hireCash: 11500, buyCash: 14000, buyDays: 3, power: 0.7, requiresModules: { power: 1 }, skill: { id: 'mechanics', level: 3 }, desc: '定向天线阵加频谱扫描，能连续盯着几个频段。情报与预报比谁都早一步。' },
    ],
  },
];

for (const m of MODULES) {
  Object.assign(m, hydrateNamed('world.module', m, ['name', 'short', 'desc', 'zero', 'buildPenaltyDesc']));
  m.levels.forEach((lv, i) => {
    lv.desc = pickCopy(`world.module.${m.id}.level.${i + 1}`, lv.desc);
  });
}

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

/** 当前级硬效果，给建造面板对照 */
/** 1/2/3 级 → 小幅/中幅/大幅。属性描述一律模糊分级（数值真源在 balance.ts，文案不复述算式）。 */
export function moduleTier(level: number): string {
  const lv = Math.max(0, Math.min(3, level));
  return t(lv <= 0 ? 'ledger.module.none' : `ledger.module.tier${lv}`);
}

export function moduleHardEffect(id: ModuleId, level: number): string {
  const lv = Math.max(0, Math.min(3, level));
  // 0 级没有"属性"可言——现状由构成描述（m.zero）说明，这里返回空串让调用方落到那一句
  if (lv <= 0) return '';
  const tier = moduleTier(lv);
  switch (id) {
    case 'cistern':
      return t('ledger.module.cistern', { tier });
    case 'filter':
      return t('ledger.module.filter', { tier });
    case 'power':
      return t('ledger.module.power', { tier }) + (lv >= 3 ? t('ledger.module.powerDiesel') : '');
    case 'insulate':
      return (
        t('ledger.module.insulate', { tier }) +
        t('ledger.module.insulateFuel') +
        (lv >= 2 ? t('ledger.module.insulateElec') : '')
      );
    case 'airFilter':
      return t('ledger.module.air', { tier });
    case 'radio':
      return t('ledger.module.radio', { tier });
    case 'garden':
      return t('ledger.module.garden', { tier });
    case 'medbay':
      return lv >= 3 ? t('ledger.module.medbay3') : t('ledger.module.medbay');
    case 'fortify':
      return t('ledger.module.fortify', { tier });
    case 'conceal':
      return t('ledger.module.conceal', { tier });
    default:
      return '';
  }
}
