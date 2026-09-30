/**
 * 墙上的地图：图钉坐标表。
 *
 * ## 为什么是「角度」而不是直接写 x/y
 *
 * 这屏要同时成立两件事：
 *   1. 图钉落在 `map-board.jpg` 上说得通的地方（城里的超市、郊外的仓、山口的货场）；
 *   2. 图上那三圈**等距线**正好穿过对应距离的钉子（`distance` 1/2/3 → 内/中/外圈）。
 *
 * 若两件事各标一遍坐标，迟早会走岔 —— 挪一枚钉子它就离开自己的圈了。
 * 所以这里只标**角度**，半径由 `distance` 定（`RING_R`），坐标现算：
 * 圈与钉子共用同一组常量，挪圈就是挪所有钉子，结构上不可能错位。
 *
 * ## 坐标系
 *
 * `map-board.jpg` 是一张斜着摊在桌上的等距插画，所以「等距圆」在画面上压成椭圆：
 * 竖向乘 `RING_SQUASH` 压扁。坐标一律用**归一化分数**（含图的宽/高），
 * 与画布尺寸无关；换算成像素时才乘 `MAP_CANVAS`。
 */

/** `map-board.jpg` 的像素尺寸。SVG 视框与归一化坐标都按它换算。 */
export const MAP_CANVAS = { w: 1664, h: 928 } as const;

/** 家（避难所）在图上的位置：画中那片灰色高楼的中心。三圈都以此为圆心。 */
export const MAP_HOME = { x: 0.5, y: 0.47 } as const;

/**
 * 三圈的像素半径（下标＝ distance）。
 *
 * 这一组数不是随手定的，是**按贴到画上的位置反推**的：画布只有图片宽度的 ~47%
 * （左栏宽 788px ÷ 图片 1664px），所以半径要比「看上去的像素数」大一倍。
 * 内圈 140 换算到屏上 rx≈66px、ry≈27px，六个钉子的间距约 47px —— 刚好一眼分清
 * 而不会散成一个星座。外圈 450 会在画面的顶端越出纸边（纸的上沿在 y≈0.29），
 * 所以收到 400，让最北那枚钉子正好落在山脚。
 */
export const RING_R: Record<1 | 2 | 3, number> = { 1: 140, 2: 270, 3: 400 };

/**
 * 竖向压扁系数：把「等距圆」画成椭圆，贴合纸张的透视。
 * 0.4 是按纸的纵深压出来的 —— 太大（≥0.5）外圈会顶出纸的上沿。
 */
export const RING_SQUASH = 0.4;

/**
 * 每个地点的方位角（度）。0° = 正东，90° = 正南（y 轴向下），顺时针。
 *
 * 角度是挑过的：让同类地点落在画里说得通的区域 ——
 * 超市/五金/药店/银行/七号楼挤在市中心内圈（`home` 就是那一片楼），
 * 加油站与旧货市场压在中圈的东西两侧干道上，医院在正北（画面上方那排高楼），
 * 仓储中心甩到东边、服务区甩到南边农田、绕城货场顶到北面山脚。
 *
 * `sig_xt_building` 与 `sig_basement` 是**同一栋楼**的楼道与地下室（小桃家），
 * 所以只差 34°，落在同一个街区里；两枚钉子几乎挨着正是要的读法。
 * 另一处相邻：`school` 与 `sig_depot` 都在西北—东北一带，各占各的角度不重叠。
 *
 * 没标到的地点（新增地点忘了登记）会在 `ArtMapPanel` 里落到家钉的位置并被
 * `audit` 提示——宁可看见一枚钉子叠在家上，也不要静默消失。
 */
export const LOC_DEG: Record<string, number> = {
  // —— 内圈（distance 1）——
  supermarket: 180,
  hardware: 240,
  pharmacy: 300,
  bank: 0,
  sig_xt_building: 62,
  sig_basement: 96,
  // —— 中圈（distance 2）——
  gasstation: 30,
  outdoor: 90,
  blackmarket: 150,
  school: 210,
  hospital: 270,
  sig_depot: 330,
  // —— 外圈（distance 3）——
  warehouse: 20,
  servicearea: 140,
  sig_route: 260,
};

export interface PinXY {
  /** 归一化坐标（0–1），相对整张 `map-board.jpg` 的像素尺寸 */
  x: number;
  y: number;
}

/**
 * 地点 → 归一化坐标。半径取自 `RING_R[distance]`，所以钉子必然落在自己那圈上。
 * 角度缺登记时回落到正东 —— 叠在家钉上，一眼就能看出漏了。
 */
export function locPinXY(id: string, distance: 1 | 2 | 3): PinXY {
  const deg = LOC_DEG[id] ?? 0;
  const a = (deg * Math.PI) / 180;
  const r = RING_R[distance];
  return {
    x: MAP_HOME.x + (r * Math.cos(a)) / MAP_CANVAS.w,
    y: MAP_HOME.y + (r * RING_SQUASH * Math.sin(a)) / MAP_CANVAS.h,
  };
}

/** 三圈的 SVG 几何（视框单位＝ `MAP_CANVAS` 的像素）。 */
export function ringGeometry() {
  return ([1, 2, 3] as const).map((d) => ({
    d,
    cx: MAP_HOME.x * MAP_CANVAS.w,
    cy: MAP_HOME.y * MAP_CANVAS.h,
    rx: RING_R[d],
    ry: RING_R[d] * RING_SQUASH,
  }));
}
