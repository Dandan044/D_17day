import type { WeatherId } from '../../game/types';

/** 由首页 / art.html 的 <body data-skin="art"> 决定。经典入口 classic.html 不带这个标记。 */
export function isArtSkin(): boolean {
  return document.body.dataset.skin === 'art';
}

export function hideBrokenImg(e: { currentTarget: HTMLImageElement }) {
  e.currentTarget.style.visibility = 'hidden';
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
  sceneHomeDesk: './art/scene-home-desk.jpg',
  sceneHomeSide: './art/scene-home-side.jpg',
  cutHNotebook: './art/cut-h-notebook.png',
  cutHPlan: './art/cut-h-plan.png',
  cutHClock: './art/cut-h-clock.png',
  cutHRadio: './art/cut-h-radio.png',
  cutHBlueprint: './art/cut-h-blueprint.png',
  cutHWindow: './art/cut-h-window.png',
  cutHBed: './art/cut-h-bed.png',
  cutHDoor: './art/cut-h-door.png',
  cutHShelf: './art/cut-h-shelf.png',
  cutHMedkit: './art/cut-h-medkit.png',
  winPreClear: './art/win-pre-clear.jpg',
  winPreOvercast: './art/win-pre-overcast.jpg',
  winPreRain: './art/win-pre-rain.jpg',
  winPreFog: './art/win-pre-fog.jpg',
  winRainstorm: './art/win-rainstorm.jpg',
  winSnow: './art/win-snow.jpg',
  winAshfall: './art/win-ashfall.jpg',
  winBlackrain: './art/win-blackrain.jpg',
  winHeatwave: './art/win-heatwave.jpg',
  winSmog: './art/win-smog.jpg',
} as const;

/** 与 scripts/cut-art-objects.py 的裁切框一致，扣图叠回原位。 */
export const CUT: Record<string, { left: string; top: string; width: string; height: string }> = {
  table: box(0.0, 0.08, 0.36, 0.98),
  shelves: box(0.38, 0.12, 0.7, 0.9),
  vending: box(0.7, 0.08, 1.0, 0.99),
  notebook: box(0.04, 0.32, 0.32, 0.74),
  journal: box(0.34, 0.3, 0.66, 0.76),
  stamp: box(0.7, 0.26, 0.96, 0.74),
};

/** 与 scripts/cut-art-home.py 的 CROPS 同一套分数。改框必须双写。 */
export const CUT_HOME: Record<string, { left: string; top: string; width: string; height: string }> = {
  window: box(0.3, 0.12, 0.7, 0.46),
  blueprint: box(0.02, 0.1, 0.26, 0.5),
  notebook: box(0.16, 0.58, 0.33, 0.84),
  plan: box(0.33, 0.6, 0.5, 0.88),
  clock: box(0.5, 0.48, 0.64, 0.76),
  radio: box(0.64, 0.5, 0.88, 0.84),
  bed: box(0.0, 0.22, 0.32, 0.98),
  medkit: box(0.32, 0.5, 0.46, 0.82),
  door: box(0.5, 0.08, 0.7, 0.96),
  shelf: box(0.72, 0.1, 0.99, 0.94),
};

/** 窗玻璃内沿：窗景 jpg 叠在这里，比 window 框略小，让窗帘留在场景里。 */
export const WIN_GLASS = box(0.32, 0.16, 0.68, 0.44);

export function windowArt(weather: WeatherId, prep: boolean): string {
  if (prep) {
    if (weather === 'clear') return ART.winPreClear;
    if (weather === 'rain' || weather === 'storm' || weather === 'flooding') return ART.winPreRain;
    if (weather === 'fog') return ART.winPreFog;
    return ART.winPreOvercast;
  }
  if (weather === 'rain' || weather === 'storm' || weather === 'flooding') return ART.winRainstorm;
  if (weather === 'snow' || weather === 'blizzard') return ART.winSnow;
  if (weather === 'ashfall') return ART.winAshfall;
  if (weather === 'blackRain') return ART.winBlackrain;
  if (weather === 'heatwave' || weather === 'clear') return ART.winHeatwave;
  return ART.winSmog;
}

function box(l: number, t: number, r: number, b: number) {
  return {
    left: `${l * 100}%`,
    top: `${t * 100}%`,
    width: `${(r - l) * 100}%`,
    height: `${(b - t) * 100}%`,
  };
}
