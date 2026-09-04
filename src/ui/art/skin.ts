/** 由 art.html 的 <body data-skin="art"> 决定。经典入口不带这个标记。 */
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

function box(l: number, t: number, r: number, b: number) {
  return {
    left: `${l * 100}%`,
    top: `${t * 100}%`,
    width: `${(r - l) * 100}%`,
    height: `${(b - t) * 100}%`,
  };
}
