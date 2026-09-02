import { t } from '../../copy/t';
import '../../copy/zh/ui';
import type { Choice, Effect, EventFamily, EventKind, EventVariant, TagQuery } from '../../types';

/**
 * 事件数值尺度（以中文 log 事实为准，改数不改声音）
 *
 * 生命：无外伤/无病程 = 0。轻伤/轻症 −2~−6，中伤 −8~−12，重伤 −14~−18。
 * 体力：拧旋钮/看一眼 = 0 或 −2。下楼问话/一趟搬运 −4~−6。
 *       搬一夜/排队两小时/开车 −8~−12。没睡且还干活 −12~−18。日常不要 −20~−28。
 * 理智：惊吓/被盯 −2~−6。目睹尸体/对峙/拒人 −6~−8。道德创伤最多 −8。
 * 暴露：被看见/被记住脸 +6~+14。开一枪 +14。给了水还被记下门牌，不该减暴露。
 * 物资：「一瓶」= 2 L。log 写了菜/药/油/热水必须入账。「开了一枪」扣 1 发。
 * 状态：CO 中毒只给燃烧取暖/密闭烟气，不给「透不过气」或「咳了两声」。
 *
 * skip() 默认只 sanity −2，不送体力。坐下歇着才用 rest()。
 * extra.stats 整表覆盖，生病/挨冻/走动必须手写负值。
 */

/** 无条件退路：路过/没买，不白送体力 */
export function skip(extra?: Partial<Omit<Effect, 'log'>>): Choice {
  return {
    id: 'skip',
    label: t('ui.choice.skip'),
    effect: { stats: { sanity: -2 }, tone: 'neutral', log: '', ...extra },
  };
}

/** 真的坐下歇着 */
export function rest(extra?: Partial<Omit<Effect, 'log'>>): Choice {
  return {
    id: 'skip',
    label: t('ui.choice.skip'),
    effect: { stats: { stamina: 4 }, tone: 'neutral', log: '', ...extra },
  };
}

export function ch(id: string, effect: Effect, extra?: Partial<Choice>): Choice {
  return { id, label: '', effect, ...extra };
}

export function beat(opts: {
  id: string;
  kind?: EventKind;
  intensity?: number;
  phase: EventFamily['phase'];
  weight?: number;
  once?: boolean;
  cooldown?: number;
  require?: TagQuery;
  forbid?: TagQuery;
  minThreat?: number;
  maxThreat?: number;
  title?: string;
  body?: string;
  choices?: Choice[];
  variants?: EventVariant[];
}): EventFamily {
  const weight = opts.weight ?? 8;
  const variants =
    opts.variants ??
    [
      {
        id: 'main',
        title: opts.title,
        body: opts.body,
        choices: opts.choices ?? [],
      },
    ];
  return {
    id: opts.id,
    kind: opts.kind ?? 'social',
    intensity: opts.intensity ?? 2,
    phase: opts.phase,
    baseWeight: weight,
    once: opts.once,
    cooldown: opts.once || weight === 0 ? opts.cooldown : (opts.cooldown ?? 14),
    require: opts.require,
    forbid: opts.forbid,
    minThreat: opts.minThreat,
    maxThreat: opts.maxThreat,
    variants,
  };
}
