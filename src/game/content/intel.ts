import type { IntelItem } from '../types';
import { hydrateNamed } from '../copy/hydrate';
import '../copy';

export { SOURCE_NAME } from '../copy/names';

/**
 * 情报池。
 *
 * 一条情报的真伪不由内容作者指定，而由运行时决定：
 * points === 本局真实灾难 → 真情报，否则就是误导。
 * 同一条"化工园区起火"的推文，在化工局是救命线索，在核战局就是噪音。
 */
export const INTEL_POOL: IntelItem[] = [
  // ============ 核交火 ============
  { id: 'nuc_1', source: 'official', points: 'nuclear', text: '外交部就邻国边境军事集结发表严正声明，要求立即停止一切挑衅行为。' },
  { id: 'nuc_2', source: 'social', points: 'nuclear', text: '#碘片# 突然登上热搜第七。多家药店的碘化钾片显示"暂时缺货"。', minDay: 2 },
  { id: 'nuc_3', source: 'rumor', points: 'nuclear', text: '楼下老陈说他儿子在部队，前天开始全员取消休假，通讯设备上交。' },
  { id: 'nuc_4', source: 'shortwave', points: 'nuclear', text: '5410 kHz 上有一段重复的数字广播，间隔严格三分钟。有人说这是战备频段。', minDay: 3 },
  { id: 'nuc_5', source: 'official', points: 'nuclear', text: '民防部门通知：本周六将进行防空警报试鸣，请市民不必惊慌。', minDay: 3 },
  { id: 'nuc_6', source: 'social', points: 'nuclear', text: '有人拍到三个国家的大使馆同一天开始销毁文件。图片已被删除。', minDay: 4 },
  { id: 'nuc_7', source: 'rumor', points: 'nuclear', text: '在民航系统工作的表姐说，西北方向连续两天出现大范围临时禁飞区。', minDay: 4 },

  // ============ 超级流感 ============
  { id: 'pan_1', source: 'official', points: 'pandemic', text: '疾控中心通报：某市出现聚集性不明原因肺炎病例，正在开展流调。' },
  { id: 'pan_2', source: 'social', points: 'pandemic', text: '一个自称三甲医院呼吸科的账号发帖：我们科今天上了六台 ECMO。发帖十分钟后删号。', minDay: 2 },
  { id: 'pan_3', source: 'rumor', points: 'pandemic', text: '小区门口开始有人量体温了。物业说是"例行检查"，但他们戴的是双层防护。' },
  { id: 'pan_4', source: 'shortwave', points: 'pandemic', text: '业余电台里有个医生在念一份名单，都是同一家医院的科室，说是"需要替班"。', minDay: 3 },
  { id: 'pan_5', source: 'official', points: 'pandemic', text: '卫健委：请市民减少不必要聚集，公共场所佩戴口罩。目前疫情总体可控。', minDay: 3 },
  { id: 'pan_6', source: 'social', points: 'pandemic', text: 'N95 从 4 块涨到 38 块。有人在囤，而且囤得很专业——他们只买头戴式的。', minDay: 4 },
  { id: 'pan_7', source: 'rumor', points: 'pandemic', text: '殡仪馆最近在招临时工，日薪一千二，不问履历。', minDay: 5 },

  // ============ 电网崩溃 ============
  { id: 'grid_1', source: 'official', points: 'gridDown', text: '国家空间天气监测预警中心：预计未来数日将发生强地磁暴，可能影响电力与通信设施。' },
  { id: 'grid_2', source: 'social', points: 'gridDown', text: '有人发现全市三个 500 kV 变电站同时开始"计划外检修"。电力系统的朋友说这不正常。', minDay: 2 },
  { id: 'grid_3', source: 'rumor', points: 'gridDown', text: '加油站的老板说这两天来买桶装柴油的都是同一批人，一次买满后备箱。' },
  { id: 'grid_4', source: 'shortwave', points: 'gridDown', text: '短波里的信号今晚异常清晰，远处的电台都能听见。老玩家说这是电离层出事的前兆。', minDay: 3 },
  { id: 'grid_5', source: 'official', points: 'gridDown', text: '供电公司：为保障电网安全，今晚起部分区域将实施轮流限电。', minDay: 4 },
  { id: 'grid_6', source: 'social', points: 'gridDown', text: '发电机的价格三天涨了四倍，京东上所有型号显示"无货"。', minDay: 4 },
  { id: 'grid_7', source: 'rumor', points: 'gridDown', text: '银行的柜员偷偷说，系统昨天离线了四十分钟，全城的 ATM 都停了。', minDay: 5 },

  // ============ 火山冬天 ============
  { id: 'vol_1', source: 'official', points: 'volcanicWinter', text: '地震台网：西南某火山群三日内记录到 340 次微震，火山活动等级上调至橙色。' },
  { id: 'vol_2', source: 'social', points: 'volcanicWinter', text: '有人在高原拍到了整片天空发红的照片。评论区在争论是不是滤镜。', minDay: 2 },
  { id: 'vol_3', source: 'rumor', points: 'volcanicWinter', text: '楼上晒被子的阿姨说，昨天收回来发现被面上有一层灰，擦不掉，闻起来像火柴。' },
  { id: 'vol_4', source: 'shortwave', points: 'volcanicWinter', text: '航空气象频道整晚在播报同一条：大范围火山灰云，建议绕飞。', minDay: 3 },
  { id: 'vol_5', source: 'official', points: 'volcanicWinter', text: '气象台：受不明气溶胶影响，未来一周日照将显著减少，气温较常年偏低 6 到 9 度。', minDay: 4 },
  { id: 'vol_6', source: 'social', points: 'volcanicWinter', text: '本地花市的老板在清仓，他说"今年冬天不用进货了"。他家三代人做这个。', minDay: 4 },
  { id: 'vol_7', source: 'rumor', points: 'volcanicWinter', text: '开货车的邻居说，318 国道有一段路面被灰盖住了，铲雪车在作业。九月份。', minDay: 5 },

  // ============ 区域洪灾 ============
  { id: 'fld_1', source: 'official', points: 'flood', text: '水文局发布橙色预警：上游流域累计降雨量已达历史同期 2.7 倍。' },
  { id: 'fld_2', source: 'social', points: 'flood', text: '有人拍到水库泄洪闸全开的视频，配文只有四个字：往高处走。', minDay: 2 },
  { id: 'fld_3', source: 'rumor', points: 'flood', text: '住一楼的李姐今天把所有东西都搬到床上了。她说她妈六二年经历过一次。' },
  { id: 'fld_4', source: 'shortwave', points: 'flood', text: '应急频段上在反复通报几个乡镇的名字和坐标，语气很急。都在上游。', minDay: 3 },
  { id: 'fld_5', source: 'official', points: 'flood', text: '市防汛办：即日起关闭三座跨江桥梁，请市民避免前往低洼地带。', minDay: 4 },
  { id: 'fld_6', source: 'social', points: 'flood', text: '橡皮艇和救生衣在电商平台售罄。销量前十的收货地址都在本市。', minDay: 4 },
  { id: 'fld_7', source: 'rumor', points: 'flood', text: '下水道昨晚在响，那种从很深的地方传上来的咕噜声。修了二十年管道的师傅说他知道那是什么。', minDay: 5 },

  // ============ 化工泄漏 ============
  { id: 'chm_1', source: 'official', points: 'chemSpill', text: '生态环境部门通报：某化工园区在例行检查中被要求限期整改，涉及三处储罐区。' },
  { id: 'chm_2', source: 'social', points: 'chemSpill', text: '园区周边居民集体反映夜间刺鼻气味，官方回应为"正常工艺排放"。', minDay: 2 },
  { id: 'chm_3', source: 'rumor', points: 'chemSpill', text: '在园区上班的表弟这周请了长假，走之前把家里的鱼缸送人了。' },
  { id: 'chm_4', source: 'shortwave', points: 'chemSpill', text: '消防调度频道整晚不停，全是同一个方位的增援请求。没有一句提到"火"。', minDay: 3 },
  { id: 'chm_5', source: 'official', points: 'chemSpill', text: '街道办通知：本周将组织一次应急疏散演练，请各户配合登记人数。', minDay: 4 },
  { id: 'chm_6', source: 'social', points: 'chemSpill', text: '防毒面具的滤罐型号 A2B2E2K2 突然被搜爆。买的人都在同一个城市。', minDay: 4 },
  { id: 'chm_7', source: 'rumor', points: 'chemSpill', text: '养鸽子的老王说他今早在楼顶捡到七只死鸟，一只伤都没有。', minDay: 5 },

  // ============ 纯噪音：真实存在但与灾难无关 ============
  { id: 'noise_1', source: 'social', points: 'none', text: '#末日# 话题下有个博主在卖 998 元的"家庭应急包"，销量三万。里面主要是压缩饼干。' },
  { id: 'noise_2', source: 'official', points: 'none', text: '气象台：本周多云转阴，局部有阵雨，气温 12 到 21 度。' },
  { id: 'noise_3', source: 'rumor', points: 'none', text: '小区业主群在吵物业费的事，已经吵了四十九页。' },
  { id: 'noise_4', source: 'social', points: 'none', text: '某明星塌房占据了所有热搜前六位。第七位是碘片。' },
  { id: 'noise_5', source: 'shortwave', points: 'none', text: '有人在业余频段唱歌，唱得不好，但一直有人回他。' },
  { id: 'noise_6', source: 'rumor', points: 'none', text: '菜市场的猪肉又涨了。卖肉的说是饲料贵，跟别的没关系。' },
  { id: 'noise_7', source: 'official', points: 'none', text: '发改委：近期物价波动属于季节性因素，市场供应总体充足，请勿盲目囤积。' },
  { id: 'noise_8', source: 'social', points: 'none', text: '一条"某地已经开始戒严"的短视频被证实是三年前另一个国家的素材。' },
  { id: 'noise_9', source: 'rumor', points: 'none', text: '对门的年轻人昨天搬走了，说是去外地工作。他家的门没锁。' },
  { id: 'noise_10', source: 'shortwave', points: 'none', text: '一段自动循环的英文报时，中间夹着一串听不懂的字母。老玩家说那台机器坏了十年了。' },
  { id: 'noise_11', source: 'social', points: 'none', text: '有人整理了一份"末日必囤清单"，转发十万。第一条是卫生纸。' },
  { id: 'noise_12', source: 'official', points: 'none', text: '交警提示：受活动影响，本周末市中心部分路段将实施交通管制。' },
];

for (const item of INTEL_POOL) {
  Object.assign(item, hydrateNamed('intel', item, ['text']));
}

export const INTEL_BY_ID: Record<string, IntelItem> = Object.fromEntries(INTEL_POOL.map((i) => [i.id, i]));
