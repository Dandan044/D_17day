import { t } from '../../copy/t';
import '../../copy/zh/ui';
import type { Choice, Effect, EventFamily, EventKind, EventVariant, TagQuery } from '../../types';

/** 无条件退路：仍改体力/理智，避免「假选择」 */
export function skip(extra?: Partial<Omit<Effect, 'log'>>): Choice {
  return {
    id: 'skip',
    label: t('ui.choice.skip'),
    effect: { stats: { stamina: 4, sanity: -2 }, tone: 'neutral', log: '', ...extra },
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
