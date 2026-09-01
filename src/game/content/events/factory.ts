import type { Choice, Effect, EventFamily, EventKind, EventVariant, TagQuery } from '../../types';

/** 无条件退路：仍改体力/理智，避免「假选择」 */
export function skip(log: string, extra?: Partial<Omit<Effect, 'log'>>): Choice {
  return {
    id: 'skip',
    label: '什么都不做',
    effect: { stats: { stamina: 4, sanity: -2 }, tone: 'neutral', ...extra, log },
  };
}

export function ch(id: string, label: string, effect: Effect, extra?: Partial<Choice>): Choice {
  return { id, label, effect, ...extra };
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
  /** 单变体时必填；传入 variants 时可省略 */
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
        title: opts.title ?? opts.id,
        body: opts.body ?? '',
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
