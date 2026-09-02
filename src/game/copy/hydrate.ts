import type { Choice, Effect, EventFamily, EventVariant } from '../types';
import { hasCopy, pickCopy, tList } from './t';

function eventBase(familyId: string, variantId: string, copyKey?: string): string[] {
  const bases: string[] = [];
  if (copyKey) bases.push(`event.${familyId}.${copyKey}`);
  bases.push(`event.${familyId}.${variantId}`, `event.${familyId}._shared`);
  return bases;
}

function firstKey(bases: string[], suffix: string): string {
  for (const b of bases) {
    const k = `${b}.${suffix}`;
    if (hasCopy(k)) return k;
  }
  return `${bases[0]}.${suffix}`;
}

function hydrateEffect(bases: string[], choiceId: string, branch: string | null, e: Effect | undefined): Effect | undefined {
  if (!e) return e;
  const suffix = branch ? `choice.${choiceId}.${branch}.log` : `choice.${choiceId}.log`;
  return { ...e, log: pickCopy(firstKey(bases, suffix), e.log) };
}

function hydrateChoice(bases: string[], c: Choice): Choice {
  const label = pickCopy(firstKey(bases, `choice.${c.id}.label`), c.label);
  const noteKey = firstKey(bases, `choice.${c.id}.note`);
  const note = hasCopy(noteKey) ? pickCopy(noteKey, c.note) : c.note;
  const reasonKey = firstKey(bases, `choice.${c.id}.reason`);
  let requires = c.requires;
  if (requires && (hasCopy(reasonKey) || requires.reason)) {
    requires = { ...requires, reason: pickCopy(reasonKey, requires.reason) };
  }
  if (c.check) {
    return {
      ...c,
      label,
      note,
      requires,
      check: {
        ...c.check,
        ok: hydrateEffect(bases, c.id, 'ok', c.check.ok)!,
        bad: hydrateEffect(bases, c.id, 'bad', c.check.bad)!,
      },
    };
  }
  return {
    ...c,
    label,
    note,
    requires,
    effect: hydrateEffect(bases, c.id, null, c.effect),
  };
}

function hydrateVariant(familyId: string, v: EventVariant): EventVariant {
  const bases = eventBase(familyId, v.id, v.copyKey);
  return {
    ...v,
    title: pickCopy(firstKey(bases, 'title'), v.title),
    body: pickCopy(firstKey(bases, 'body'), v.body),
    choices: v.choices.map((c) => hydrateChoice(bases, c)),
  };
}

export function hydrateFamily(f: EventFamily): EventFamily {
  return { ...f, variants: f.variants.map((v) => hydrateVariant(f.id, v)) };
}

export function hydrateFamilies(list: EventFamily[]): EventFamily[] {
  return list.map(hydrateFamily);
}

export function hydrateNamed<T extends { id: string }>(
  prefix: string,
  item: T,
  fields: Array<keyof T & string>,
  lists: Array<keyof T & string> = [],
): T {
  const next = { ...item };
  for (const field of fields) {
    const key = `${prefix}.${item.id}.${field}`;
    const cur = next[field];
    if (typeof cur === 'string') {
      (next as Record<string, unknown>)[field] = pickCopy(key, cur);
    }
  }
  for (const field of lists) {
    const key = `${prefix}.${item.id}.${field}`;
    const got = tList(key);
    if (got.length) (next as Record<string, unknown>)[field] = got;
  }
  return next;
}
