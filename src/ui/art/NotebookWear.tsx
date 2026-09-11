import type { RunState } from '../../game/types';
import { ART } from './skin';

/**
 * 笔记本纸面的动态污损：**理智越低纸越皱、涂鸦越多、破损越重；人性越低血污越多**。
 * 两层互相独立，可以同时叠着出现（低理智 + 低人性）。
 *
 * 阈值刻意用 40 / 10 与 40 / 20 / 10 —— 这是**视觉**阈值，比引擎里 35 / 15 的机制阈值
 * 早一档：纸面该早一点开始变脏，但理智崩溃的判定不该跟着动。
 *
 * 贴图都是"白底 + 深色损伤"，一律走 `mix-blend-mode: multiply`
 * （白 = 不变，深色 = 压暗），所以纸张本身的肌理仍透得出来，也不需要抠透明。
 *
 * 变体按 `seed + day` 取模，**同一天内稳定**——否则每次重渲染都换一张会闪。
 * 层是 `pointer-events: none` 的：视觉上会遮住部分文字（这是预期效果），但不能挡住点击。
 */

const SANITY_MID = 40;
const SANITY_LOW = 10;
/** >=40 干净；<40 轻；<20 中；<10 重（并叠血手印） */
const BLOOD_STAGES = [40, 20, 10] as const;

const VARIANTS = 3;

export function sanityWearStage(sanity: number): 0 | 2 | 3 {
  if (sanity <= SANITY_LOW) return 3;
  if (sanity < SANITY_MID) return 2;
  return 0;
}

/** 0 = 干净，1/2/3 = 轻/中/重 */
export function bloodWearStage(humanity: number): 0 | 1 | 2 | 3 {
  if (humanity >= BLOOD_STAGES[0]) return 0;
  if (humanity >= BLOOD_STAGES[1]) return 1;
  if (humanity >= BLOOD_STAGES[2]) return 2;
  return 3;
}

function variantOf(seed: number, day: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + day * 78.233 + salt * 3.771) * 43758.5453;
  return Math.floor((x - Math.floor(x)) * VARIANTS) % VARIANTS;
}

export function NotebookWear({ run }: { run: RunState }) {
  const sanity = sanityWearStage(run.stats.sanity);
  const blood = bloodWearStage(run.stats.humanity);

  return (
    <span className="art-wear-layer" aria-hidden>
      {sanity !== 0 && (
        <i
          className={`art-wear is-sanity${sanity}`}
          style={{ backgroundImage: `url(${ART.wearSanity(sanity, variantOf(run.seed, run.day, sanity))})` }}
        />
      )}
      {blood >= 1 && (
        <i
          className={`art-wear is-blood is-b${blood}`}
          style={{ backgroundImage: `url(${ART.wearBlood(blood - 1)})` }}
        />
      )}
      {blood >= 3 && <i className="art-wear is-hand" style={{ backgroundImage: `url(${ART.wearHand})` }} />}
    </span>
  );
}
