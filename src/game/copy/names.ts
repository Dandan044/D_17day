/**
 * 玩家可见的短名表：资源、技能、天气、势力、来源等只允许这一份。
 */

import type {
  ActionHook,
  ApplianceId,
  BuildPath,
  Difficulty,
  EventKind,
  FactionId,
  ModuleId,
  PowerLoadId,
  ResourceId,
  SkillId,
  StatId,
  WeatherId,
} from '../types';
import { registerTree } from './t';

export const RES_NAME: Record<ResourceId, string> = {
  water: '饮用水',
  foodStaple: '耐储食物',
  foodFresh: '生鲜食物',
  meds: '药品',
  fuel: '燃料',
  materials: '建材',
  parts: '零件',
  ammo: '弹药',
  cash: '现金',
};

export const RES_UNIT: Record<ResourceId, string> = {
  water: 'L',
  foodStaple: '份',
  foodFresh: '份',
  meds: '组',
  fuel: 'L',
  materials: '件',
  parts: '件',
  ammo: '发',
  cash: '元',
};

export const SKILL_NAME: Record<SkillId, string> = {
  medicine: '医疗',
  mechanics: '机械',
  negotiation: '谈判',
  fitness: '体能',
  stealth: '隐蔽',
};

export const STAT_NAME: Record<StatId, string> = {
  hp: '生命',
  stamina: '体力',
  sanity: '理智',
  humanity: '人性',
  reputation: '名声',
};

export const WEATHER_NAME: Record<WeatherId, string> = {
  clear: '晴',
  overcast: '阴',
  rain: '雨',
  storm: '暴风雨',
  flooding: '内涝',
  snow: '雪',
  blizzard: '暴风雪',
  ashfall: '落灰',
  blackRain: '黑雨',
  fog: '浓雾',
  heatwave: '高温',
};

export const WEATHER_DESC: Record<WeatherId, string> = {
  clear: '天很干净。太阳能板今天能吃饱。',
  overcast: '低云压着，光线是均匀的灰。',
  rain: '雨不大但不停，屋檐在滴水。',
  storm: '风把东西刮得到处响，出门要冒险。',
  flooding: '水在往上走。低处的一切都不再安全。',
  snow: '雪落下来，盖住了所有脚印——包括你的。',
  blizzard: '风雪贴着地面横着走，能见度不到十米。',
  ashfall: '灰像脏雪一样落，吸进去会留在肺里。',
  blackRain: '雨是灰黑色的，落在皮肤上有细微的颗粒感。',
  fog: '雾很浓。你听得见远处的声音，但看不见来源。',
  heatwave: '闷热得反常，储水消耗得比预计快。',
};

export const THREAT_NAMES = ['备灾期', '恐慌期', '匮乏期', '掠夺期', '严冬期', '荒芜期', '死寂期'] as const;

export const THREAT_DESC = [
  '一切看起来还正常。',
  '秩序在崩解，超市已经被搬空，警笛整夜不停。',
  '货架彻底空了。人们开始为一箱水动手。',
  '有组织的武装团体控制了街区。他们收"税"。',
  '气温断崖下跌。冻死的人比饿死的多。',
  '街上几乎见不到活人。能烧的都烧了。',
  '只剩风声。你已经很久没听到别人的声音。',
] as const;

export const TIER_NAMES = ['无人注意', '被人看见', '被盯上了', '被标记了', '被猎捕'] as const;

export const TIER_DESC = [
  '外面没人知道这里住着人。',
  '有人注意到这栋楼还有活人。',
  '有人在观察你的作息。你出门的时间被记下来了。',
  '有组织的人已经把你列进了名单。他们会来要东西。',
  '他们不再要东西了，他们要这个地方。',
] as const;

export const MODULE_NAME: Record<ModuleId, string> = {
  fortify: '加固',
  conceal: '隐蔽',
  cistern: '储水',
  filter: '净水',
  power: '发电',
  insulate: '保温',
  airFilter: '空气过滤',
  medbay: '医疗站',
  garden: '农圃',
  radio: '无线电',
};

export const APPLIANCE_NAME: Record<ApplianceId, string> = {
  lights: '灯光照明',
  fridge: '冰箱',
  heater: '温控',
};

export const LOAD_NAME: Record<PowerLoadId, string> = {
  ...MODULE_NAME,
  ...APPLIANCE_NAME,
};

export const SOURCE_NAME: Record<'official' | 'social' | 'rumor' | 'shortwave', string> = {
  official: '官方通报',
  social: '社交媒体',
  rumor: '邻里传闻',
  shortwave: '短波电台',
};

export const FACTION_NAME: Record<FactionId, string> = {
  gov: '政府军',
  militia: '自治民兵',
  gang: '帮派',
  looter: '掠夺者',
  quarantine: '防疫队',
  cult: '邪教',
  refugee: '难民潮',
  rescue: '救援队',
  neighbors: '邻居',
  trader: '流浪商人',
};

export const KIND_NAME: Record<EventKind, string> = {
  threat: '威胁',
  opportunity: '机会',
  social: '人际',
  medical: '医疗',
  weather: '天候',
  moral: '抉择',
  story: '叙事',
  dream: '梦境',
};

export const TREE_NAMES: Record<'survival' | 'build' | 'social', string> = {
  survival: '生存',
  build: '建造',
  social: '人际',
};

export const BUILD_PATH_NAME: Record<BuildPath, string> = {
  diy: '自己动手',
  hire: '雇工',
  buy: '买成品',
  salvage: '拆解',
};

export const DIFFICULTY_NAME: Record<Difficulty, string> = {
  story: '叙事',
  normal: '标准',
  harsh: '严苛',
};

export const HOOK_NAME: Partial<Record<ActionHook, string>> = {
  endDay: '过完这一天',
  scavenge: '外出搜刮',
  scavengeNight: '夜间搜刮',
  buy: '采购',
  visitShop: '进店',
  rest: '休息',
  build: '施工',
  work: '动手干活',
  maintain: '保养',
  treat: '治疗',
  verifyIntel: '核实情报',
  setRation: '改口粮',
  setWaterUse: '改用水',
  setPowerMode: '改供电',
  setPowerPriority: '改供电优先级',
  setHeatMode: '改取暖',
  raid: '遭遇袭击',
};

export const SITE_TAG_NAME: Record<string, string> = {
  'site:urban': '市区',
  'site:highFloor': '高层',
  'site:groundLevel': '平地',
  'site:hasYard': '有院子',
  'site:underground': '地下',
  'site:noSunlight': '无日照',
  'site:floodRisk': '内涝风险',
  'site:isolated': '偏僻',
  'site:hasWell': '有井',
  'site:damp': '潮湿',
  'site:noSignal': '无信号',
  'site:elevated': '高处',
  'site:cramped': '狭窄',
  'site:drafty': '漏风',
};

registerTree('name', {
  res: RES_NAME,
  unit: RES_UNIT,
  skill: SKILL_NAME,
  stat: STAT_NAME,
  weather: WEATHER_NAME,
  weatherDesc: WEATHER_DESC,
  threat: [...THREAT_NAMES],
  threatDesc: [...THREAT_DESC],
  tier: [...TIER_NAMES],
  tierDesc: [...TIER_DESC],
  module: MODULE_NAME,
  appliance: APPLIANCE_NAME,
  load: LOAD_NAME,
  source: SOURCE_NAME,
  faction: FACTION_NAME,
  kind: KIND_NAME,
  tree: TREE_NAMES,
  buildPath: BUILD_PATH_NAME,
  difficulty: DIFFICULTY_NAME,
  hook: HOOK_NAME,
  siteTag: SITE_TAG_NAME,
});
