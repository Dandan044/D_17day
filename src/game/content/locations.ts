import type { Location, ResourceId } from '../types';
import { hydrateNamed } from '../copy/hydrate';
import '../copy';

export { RES_NAME, RES_UNIT } from '../copy/names';

/** 每单位重量 (kg)，用于背包负重取舍 */
export const RES_WEIGHT: Record<ResourceId, number> = {
  water: 1,
  foodStaple: 0.5,
  foodFresh: 0.4,
  meds: 0.1,
  fuel: 0.85,
  materials: 2.5,
  parts: 0.6,
  ammo: 0.03,
  cash: 0,
};

/** 准备期基准单价（会乘以物价指数） */
export const BASE_PRICE: Record<ResourceId, number> = {
  water: 6,
  foodStaple: 22,
  foodFresh: 14,
  meds: 90,
  fuel: 12,
  materials: 55,
  parts: 45,
  ammo: 40,
  cash: 1,
};

export const LOCATIONS: Location[] = [
  {
    id: 'supermarket',
    name: '连锁超市',
    desc: '你每周都来的那家。生鲜区在最里面，水和米面在二号通道。它会是最先被搬空的地方。',
    descSurvival: '卷帘门歪着。生鲜区的味道已经不是食物。货架被推倒，矿泉水只剩标签。有人在里面过夜。',
    distance: 1,
    prepShop: true,
    danger: 10,
    stock: 100,
    tags: ['loc:crowded', 'loc:food'],
    loot: [
      { res: 'water', min: 6, max: 20, chance: 0.9, weight: RES_WEIGHT.water },
      { res: 'foodStaple', min: 3, max: 12, chance: 0.9, weight: RES_WEIGHT.foodStaple },
      { res: 'foodFresh', min: 2, max: 8, chance: 0.7, weight: RES_WEIGHT.foodFresh },
      { res: 'meds', min: 0, max: 1, chance: 0.25, weight: RES_WEIGHT.meds },
    ],
    prices: { water: 1, foodStaple: 1, foodFresh: 1 },
  },
  {
    id: 'hardware',
    name: '五金建材店',
    desc: '老板姓王，认得你。木板、螺纹管、防水布、发电机配件——这里的东西没人抢，直到所有人同时想起它们。',
    descSurvival: '玻璃碎了一地。木板被人拆走了大半，剩下的钉子扎在门口当路障。王老板不在。',
    distance: 1,
    prepShop: true,
    danger: 8,
    stock: 100,
    tags: ['loc:build'],
    loot: [
      { res: 'materials', min: 3, max: 10, chance: 0.9, weight: RES_WEIGHT.materials },
      { res: 'parts', min: 2, max: 8, chance: 0.85, weight: RES_WEIGHT.parts },
      { res: 'fuel', min: 0, max: 4, chance: 0.3, weight: RES_WEIGHT.fuel },
    ],
    prices: { materials: 1, parts: 1 },
  },
  {
    id: 'pharmacy',
    name: '社区药店',
    desc: '玻璃门上贴着降压药的广告。处方药柜锁着，但柜台后那个年轻店员今天看起来很紧张。',
    descSurvival: '广告还在，人走了。药柜被撬开又被铁丝重新绕上。碘片的价签掉在地上，字已经看不清。',
    distance: 1,
    prepShop: true,
    danger: 12,
    stock: 100,
    tags: ['loc:medical'],
    loot: [
      { res: 'meds', min: 2, max: 7, chance: 0.9, weight: RES_WEIGHT.meds },
      { res: 'water', min: 0, max: 3, chance: 0.3, weight: RES_WEIGHT.water },
    ],
    prices: { meds: 1 },
  },
  {
    id: 'gasstation',
    name: '加油站',
    desc: '排队的车已经绕了两圈。便利店里的打火机和方便面卖光了，但柴油还有。',
    descSurvival: '车还在，人已经不排队。油枪垂着，地下罐不知道还剩多少。便利店的门被焊死过一次，又被撬开。',
    distance: 2,
    prepShop: true,
    danger: 22,
    stock: 100,
    tags: ['loc:fuel', 'loc:crowded'],
    loot: [
      { res: 'fuel', min: 5, max: 18, chance: 0.9, weight: RES_WEIGHT.fuel },
      { res: 'foodStaple', min: 0, max: 3, chance: 0.4, weight: RES_WEIGHT.foodStaple },
    ],
    prices: { fuel: 1 },
  },
  {
    id: 'outdoor',
    name: '户外用品店',
    desc: '睡袋、滤水器、冻干食品、煤油炉。价格贵得离谱，但每一样都是为了活下去设计的。',
    descSurvival: '橱窗空了。还挂着的睡袋被灰盖住。有人在试冲锋衣的口袋里找打火机。',
    distance: 2,
    prepShop: true,
    danger: 14,
    stock: 100,
    tags: ['loc:build', 'loc:gear'],
    loot: [
      { res: 'parts', min: 2, max: 7, chance: 0.8, weight: RES_WEIGHT.parts },
      { res: 'foodStaple', min: 2, max: 6, chance: 0.75, weight: RES_WEIGHT.foodStaple },
      { res: 'materials', min: 1, max: 4, chance: 0.6, weight: RES_WEIGHT.materials },
      { res: 'meds', min: 0, max: 2, chance: 0.4, weight: RES_WEIGHT.meds },
    ],
    prices: { parts: 1.3, foodStaple: 1.5, materials: 1.2, meds: 1.2 },
  },
  {
    id: 'blackmarket',
    name: '旧货市场',
    desc: '铁皮棚子后面那几家，什么都能弄到，只要你不问来路。这里的价格是唯一诚实的东西——它准确反映了世界还剩多少时间。',
    descSurvival: '棚子还在，货换成了子弹和滤芯。问价的人比卖货的多。有人带着秤，有人带着刀。',
    distance: 2,
    prepShop: true,
    danger: 34,
    stock: 100,
    tags: ['loc:market', 'loc:shady'],
    loot: [
      { res: 'ammo', min: 2, max: 10, chance: 0.7, weight: RES_WEIGHT.ammo },
      { res: 'parts', min: 1, max: 5, chance: 0.6, weight: RES_WEIGHT.parts },
      { res: 'meds', min: 1, max: 4, chance: 0.55, weight: RES_WEIGHT.meds },
      { res: 'fuel', min: 0, max: 6, chance: 0.4, weight: RES_WEIGHT.fuel },
    ],
    prices: { ammo: 1, parts: 1.6, meds: 1.8, fuel: 1.5 },
  },
  {
    id: 'bank',
    name: '银行网点',
    desc: 'ATM 前排着队，每台都限额。柜台的姑娘说系统很忙，请您理解。现在取出来的每一张纸，三天后可能一文不值，也可能救你一命。',
    descSurvival: 'ATM 黑着，屏幕上还留着最后一次限额的字。大厅玻璃碎了，纸币被人踩进灰里。没有人再排队。',
    distance: 1,
    prepShop: true,
    danger: 16,
    stock: 100,
    tags: ['loc:cash', 'loc:crowded'],
    loot: [{ res: 'cash', min: 500, max: 2500, chance: 0.85, weight: 0 }],
  },
  {
    id: 'school',
    name: '废弃小学',
    desc: '搬迁了三年，铁门用铁丝拧着。操场的塑胶跑道翻起来了，但食堂的不锈钢水箱还在，教具室里有木板。',
    descSurvival: '铁丝被人剪开又重新拧上。操场停过车。食堂的水箱盖开着，里面有灰。',
    distance: 2,
    danger: 20,
    stock: 100,
    tags: ['loc:ruin', 'loc:build'],
    loot: [
      { res: 'materials', min: 3, max: 9, chance: 0.85, weight: RES_WEIGHT.materials },
      { res: 'water', min: 2, max: 10, chance: 0.5, weight: RES_WEIGHT.water },
      { res: 'parts', min: 1, max: 4, chance: 0.5, weight: RES_WEIGHT.parts },
    ],
  },
  {
    id: 'hospital',
    name: '市第二医院',
    desc: '急诊门口的地上还有担架轮子压出的痕迹。药房在地下一层，但走廊里的味道会告诉你这里发生过什么。',
    descSurvival: '担架轮子的印子被灰盖住。药房的门开着，货架空了。走廊尽头有人用过火。',
    distance: 2,
    danger: 46,
    stock: 100,
    tags: ['loc:medical', 'loc:contagion', 'loc:ruin'],
    loot: [
      { res: 'meds', min: 4, max: 14, chance: 0.85, weight: RES_WEIGHT.meds },
      { res: 'parts', min: 0, max: 3, chance: 0.35, weight: RES_WEIGHT.parts },
      { res: 'water', min: 0, max: 6, chance: 0.4, weight: RES_WEIGHT.water },
    ],
  },
  {
    id: 'warehouse',
    name: '城郊仓储中心',
    desc: '电商的区域仓，卷帘门有二十扇。如果还没被清空，这里的存量足够一个家庭活过整个冬天。前提是你能把东西运回来。',
    descSurvival: '二十扇门有几扇开着。纸箱被撕开，泡沫满地。里面可能还有货，也可能有人等你先走进去。',
    distance: 3,
    needsVehicle: true,
    danger: 38,
    stock: 100,
    tags: ['loc:bulk', 'loc:ruin'],
    loot: [
      { res: 'foodStaple', min: 6, max: 22, chance: 0.8, weight: RES_WEIGHT.foodStaple },
      { res: 'water', min: 8, max: 28, chance: 0.75, weight: RES_WEIGHT.water },
      { res: 'materials', min: 3, max: 12, chance: 0.6, weight: RES_WEIGHT.materials },
      { res: 'parts', min: 2, max: 8, chance: 0.55, weight: RES_WEIGHT.parts },
    ],
  },
  {
    id: 'servicearea',
    name: '高速服务区',
    desc: '出城四十公里。加油站的地下储罐里通常还剩几百升——如果你有泵，有软管，有胆子。',
    descSurvival: '服务区的灯早灭了。地下罐的井盖被人撬过。路上有车壳，没有人给你加油。',
    distance: 3,
    needsVehicle: true,
    danger: 42,
    stock: 100,
    tags: ['loc:fuel', 'loc:ruin'],
    loot: [
      { res: 'fuel', min: 8, max: 30, chance: 0.8, weight: RES_WEIGHT.fuel },
      { res: 'foodStaple', min: 2, max: 8, chance: 0.6, weight: RES_WEIGHT.foodStaple },
      { res: 'ammo', min: 0, max: 4, chance: 0.3, weight: RES_WEIGHT.ammo },
    ],
  },
];

for (const loc of LOCATIONS) {
  Object.assign(loc, hydrateNamed('world.location', loc, ['name', 'desc', 'descSurvival']));
}

export const LOCATION_BY_ID: Record<string, Location> = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]));
