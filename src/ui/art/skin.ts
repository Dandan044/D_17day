import type { WeatherId } from '../../game/types';
import winGeo from './windowPanes.json';
import artLayout from './artLayout.json';

/** 由首页 / art.html 的 <body data-skin="art"> 决定。经典入口 classic.html 不带这个标记。 */
export function isArtSkin(): boolean {
  return document.body.dataset.skin === 'art';
}

/** 命中多边形：相对各 PNG 画布的归一化坐标；一个物品 = 多个环（clipPath 并集）。 */
export type ArtRing = readonly (readonly [number, number])[];
export type ArtPoly = readonly ArtRing[];

type BoxStyle = { left: string; top: string; width: string; height: string };

type LayoutItem = {
  box: [number, number, number, number];
  poly: [number, number][][] | null;
  hud: [number, number, number, number] | null;
};

/** artLayout.json 由 cut-art-home.py / cut-art-objects.py 写入，是摆放框唯一来源。 */
const item = (key: string): LayoutItem => {
  const it = (artLayout.items as unknown as Record<string, LayoutItem>)[key];
  if (!it) throw new Error(`artLayout.json missing "${key}" — run scripts/cut-art-*.py first`);
  return it;
};

const boxLTWH = (b: readonly number[]): BoxStyle => ({
  left: `${b[0] * 100}%`,
  top: `${b[1] * 100}%`,
  width: `${b[2] * 100}%`,
  height: `${b[3] * 100}%`,
});

const polyOf = (key: string): ArtPoly | undefined =>
  (item(key).poly as unknown as ArtPoly | null) ?? undefined;

/** 图挂了就藏掉（避免出现浏览器默认的破图标）。开发模式下留一条日志——
 *  静默隐藏会让"整块图没了"无从查起，把失败的 URL 打出来就能一眼定位。 */
export function hideBrokenImg(e: { currentTarget: HTMLImageElement }) {
  const img = e.currentTarget;
  if (import.meta.env.DEV) {
    console.warn('[art] 图片加载失败，已隐藏：', img.currentSrc || img.src);
  }
  img.style.visibility = 'hidden';
}

export const ART = {
  menuBg: './art/menu-bg.jpg',
  setupBg: './art/setup-bg.jpg',
  siteBg: './art/site-bg.jpg',
  menuStage: './art/menu-stage.jpg',
  sceneRoom: './art/scene-room.jpg',
  sceneDesk: './art/scene-desk.jpg',
  cutTable: './art/cut-table.png',
  cutShelves: './art/cut-shelves.png',
  cutVending: './art/cut-vending.png',
  cutNotebook: './art/cut-notebook.png',
  cutJournal: './art/cut-journal.png',
  cutStamp: './art/cut-stamp.png',
  notebook: './art/obj-notebook.jpg',
  journal: './art/obj-journal.jpg',
  vending: './art/obj-vending.jpg',
  cabinet: './art/obj-cabinet.jpg',
  stamp: './art/obj-stamp.jpg',
  mapBoard: './art/map-board.jpg',
  pack: (id: string) => `./art/pack-${id}.jpg`,
  diff: (id: string) => `./art/diff-${id}.jpg`,
  class: (id: string) => `./art/class-${id}.jpg`,
  site: (id: string) => `./art/site-${id}.jpg`,
  model: (id: string) => `./art/model-${id}.jpg`,
  modelCut: (id: string) => `./art/cut-model-${id}.png`,
  /** 避难所家电配图：mod-<id>-<lv>.png（rembg 抠出的透明底主体），lv 夹到 1..3。 */
  module: (id: string, lv: number) => `./art/mod-${id}-${Math.min(3, Math.max(1, lv))}.png`,
  sceneHomeDesk: './art/scene-home-desk.jpg',
  sceneHomeSide: './art/scene-home-side.jpg',
  /** 避难所工程图纸面板的纸面底（ImageGen 生成，scripts/make-shelter-paper.py 裁切）。 */
  shelterPaper: './art/paper-shelter.jpg',
  /** 今日待办：笔记本内页的冷米白纸底（make-todo-paper.py）。 */
  todoPaper: './art/paper-todo.jpg',
  /** 今日计划：计划表纸的暖卡其纸底（make-plan-paper.py）。 */
  planPaper: './art/paper-plan.jpg',
  /** 今日计划三栅的手绘线稿（make-art-linefig.py 生成）。线稿与其 -mask 成对使用：
   *  线稿内部透明、压在填充层之上；掩膜把填充色裁进形状内部（否则颜色会从轮廓外渗出）。 */
  linePower: './art/line-power.png',
  linePowerMask: './art/line-power-mask.png',
  lineRation: './art/line-ration.png',
  lineRationMask: './art/line-ration-mask.png',
  lineWater: './art/line-water.png',
  lineWaterMask: './art/line-water-mask.png',
  lineThermo: './art/line-thermo.png',
  lineThermoMask: './art/line-thermo-mask.png',
  /** 笔记本纸面的动态污损（make-notebook-wear.py）：理智降档出皱与涂鸦，人性降档出血污。 */
  wearSanity: (stage: 2 | 3, i: number) => `./art/wear-sanity${stage}-${'abc'[i] ?? 'a'}.jpg`,
  wearBlood: (i: number) => `./art/wear-blood-${i + 1}.jpg`,
  wearHand: './art/wear-hand.jpg',
  cutHNotebook: './art/cut-h-notebook.png',
  cutHPlan: './art/cut-h-plan.png',
  cutHClock: './art/cut-h-clock.png',
  cutHRadio: './art/cut-h-radio.png',
  cutHBlueprint: './art/cut-h-blueprint.png',
  cutHWindow: './art/cut-h-window.png',
  cutHWindowGlass: './art/cut-h-window-glass.png',
  cutHBed: './art/cut-h-bed.png',
  cutHDoor: './art/cut-h-door.png',
  cutHShelf: './art/cut-h-shelf.png',
  cutHMedkit: './art/cut-h-medkit.png',
  winPreClear: './art/win-pre-clear.jpg',
  winPreOvercast: './art/win-pre-overcast.jpg',
  winPreRain: './art/win-pre-rain.jpg',
  winPreFog: './art/win-pre-fog.jpg',
  winEarlyClear: './art/win-early-clear.jpg',
  winEarlyOvercast: './art/win-early-overcast.jpg',
  winEarlyRain: './art/win-early-rain.jpg',
  winEarlyFog: './art/win-early-fog.jpg',
  winEarlySnow: './art/win-early-snow.jpg',
  winEarlyAshfall: './art/win-early-ashfall.jpg',
  winEarlyBlackrain: './art/win-early-blackrain.jpg',
  winWinterClear: './art/win-winter-clear.jpg',
  winWinterOvercast: './art/win-winter-overcast.jpg',
  winWinterRain: './art/win-winter-rain.jpg',
  winWinterFog: './art/win-winter-fog.jpg',
  winWinterSnow: './art/win-winter-snow.jpg',
  winWinterAshfall: './art/win-winter-ashfall.jpg',
  winWinterBlackrain: './art/win-winter-blackrain.jpg',
} as const;

/** 主菜单物件：摆放框来自 artLayout.json（cut-art-objects.py 收紧后的最终框）。 */
export const CUT: Record<string, BoxStyle> = {
  table: boxLTWH(item('cut-table').box),
  shelves: boxLTWH(item('cut-shelves').box),
  vending: boxLTWH(item('cut-vending').box),
  notebook: boxLTWH(item('cut-notebook').box),
  journal: boxLTWH(item('cut-journal').box),
  stamp: boxLTWH(item('cut-stamp').box),
};

/** 局内物件：摆放框来自 artLayout.json（cut-art-home.py 收紧后的最终框）；
 * 窗几何仍以 windowPanes.json 为准（玻璃掏洞依赖精确框，豁免收紧）。 */
export const CUT_HOME: Record<string, BoxStyle> = {
  window: box(winGeo.window[0], winGeo.window[1], winGeo.window[2], winGeo.window[3]),
  blueprint: boxLTWH(item('cut-h-blueprint').box),
  notebook: boxLTWH(item('cut-h-notebook').box),
  plan: boxLTWH(item('cut-h-plan').box),
  clock: boxLTWH(item('cut-h-clock').box),
  radio: boxLTWH(item('cut-h-radio').box),
  bed: boxLTWH(item('cut-h-bed').box),
  medkit: boxLTWH(item('cut-h-medkit').box),
  door: boxLTWH(item('cut-h-door').box),
  shelf: boxLTWH(item('cut-h-shelf').box),
};

/** HUD 锚点：art-hud-clock / art-hud-mark 历史上按旧松框定位，与摆放框收紧无关。 */
export const HUD_BOX: Record<string, BoxStyle> = {
  clock: boxLTWH(item('cut-h-clock').hud ?? item('cut-h-clock').box),
  blueprint: boxLTWH(item('cut-h-blueprint').hud ?? item('cut-h-blueprint').box),
};

/** 天气/末世等级一串数值的锚点：窗右侧的空墙（避开窗、幕布与全部物件）。 */
export const HUD_SILL = { left: '71.5%', top: '8.5%', width: '27%' };

/** 命中多边形；undefined（window / 提取失败兜底）→ 保持矩形命中。 */
export const HOME_POLY: Record<string, ArtPoly | undefined> = {
  blueprint: polyOf('cut-h-blueprint'),
  notebook: polyOf('cut-h-notebook'),
  plan: polyOf('cut-h-plan'),
  clock: polyOf('cut-h-clock'),
  radio: polyOf('cut-h-radio'),
  bed: polyOf('cut-h-bed'),
  medkit: polyOf('cut-h-medkit'),
  door: polyOf('cut-h-door'),
  shelf: polyOf('cut-h-shelf'),
};

export const MENU_POLY: Record<string, ArtPoly | undefined> = {
  table: polyOf('cut-table'),
  shelves: polyOf('cut-shelves'),
  vending: polyOf('cut-vending'),
  notebook: polyOf('cut-notebook'),
  journal: polyOf('cut-journal'),
  stamp: polyOf('cut-stamp'),
};

/** 天气洞：掏洞（windowPanes.json）每边外扩 HOLE_BLEED，伸到不透明窗框底下挡溢边。 */
const HOLE_BLEED = 0.012;
export const WIN_PANES: { l: number; t: number; r: number; b: number }[] = winGeo.panes.map(
  ([l, t, r, b]) => ({
    l: Math.max(0, (l ?? 0) - HOLE_BLEED),
    t: Math.max(0, (t ?? 0) - HOLE_BLEED),
    r: Math.min(1, (r ?? 1) + HOLE_BLEED),
    b: Math.min(1, (b ?? 1) + HOLE_BLEED),
  }),
);

/** 窗景阶段：灾前 / 灾变早期（threat 1-3，城市还立着但已死）/ 核冬天（threat ≥4）。 */
export type WindowStage = 'prep' | 'early' | 'winter';

/** 窗外景色：同一城市峡谷（公寓六楼机位）× 阶段 × 天气。核交火专用。 */
export function windowArt(weather: WeatherId, stage: WindowStage): string {
  if (stage === 'prep') {
    if (weather === 'clear') return ART.winPreClear;
    if (weather === 'rain' || weather === 'storm' || weather === 'flooding') return ART.winPreRain;
    if (weather === 'fog') return ART.winPreFog;
    return ART.winPreOvercast;
  }
  if (stage === 'winter') {
    if (weather === 'rain' || weather === 'storm' || weather === 'flooding') return ART.winWinterRain;
    if (weather === 'snow' || weather === 'blizzard') return ART.winWinterSnow;
    if (weather === 'ashfall') return ART.winWinterAshfall;
    if (weather === 'blackRain') return ART.winWinterBlackrain;
    if (weather === 'fog') return ART.winWinterFog;
    if (weather === 'heatwave' || weather === 'clear') return ART.winWinterClear;
    return ART.winWinterOvercast;
  }
  if (weather === 'rain' || weather === 'storm' || weather === 'flooding') return ART.winEarlyRain;
  if (weather === 'snow' || weather === 'blizzard') return ART.winEarlySnow;
  if (weather === 'ashfall') return ART.winEarlyAshfall;
  if (weather === 'blackRain') return ART.winEarlyBlackrain;
  if (weather === 'fog') return ART.winEarlyFog;
  if (weather === 'heatwave' || weather === 'clear') return ART.winEarlyClear;
  return ART.winEarlyOvercast;
}

function box(l: number, t: number, r: number, b: number) {
  return {
    left: `${l * 100}%`,
    top: `${t * 100}%`,
    width: `${(r - l) * 100}%`,
    height: `${(b - t) * 100}%`,
  };
}
