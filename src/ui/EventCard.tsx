import { FAMILY_BY_ID } from '../game/content/events';
import { RES_NAME, SKILL_NAME } from '../game/copy/names';
import { t } from '../game/copy/t';
import { SITE_BY_ID } from '../game/content/sites';
import { kindName } from '../game/engine/director';
import { checkRequirement, deriveFacts } from '../game/engine/tags';
import { useGame } from '../game/store';
import type { Choice, RunState } from '../game/types';
import { Chip } from './kit';
import { scrambleText } from './scramble';

const KIND_TONE: Record<string, 'bad' | 'good' | 'info' | 'warn' | 'psyche' | 'default'> = {
  threat: 'bad',
  opportunity: 'good',
  social: 'info',
  medical: 'warn',
  weather: 'info',
  moral: 'warn',
  story: 'default',
  dream: 'psyche',
};

/** d20 + 技能 >= dc 的成功率 */
function successChance(dc: number, skill: number): number {
  const need = dc - skill;
  if (need <= 1) return 1;
  if (need > 20) return 0;
  return (21 - need) / 20;
}

function requirementCost(c: Choice): string {
  if (!c.requires?.res) return '';
  return Object.entries(c.requires.res)
    .map(([k, v]) => `${v} ${RES_NAME[k as keyof typeof RES_NAME] ?? k}`)
    .join(' · ');
}

export default function EventCard({ run }: { run: RunState }) {
  const { resolveChoice } = useGame();
  const item = run.queue[0];
  if (!item) return null;

  const family = FAMILY_BY_ID[item.familyId];
  const variant = family?.variants.find((v) => v.id === item.variantId);
  if (!family || !variant) return null;

  const facts = deriveFacts(run);
  const unreliable = run.stats.sanity < 35;
  const hideRecruit = (SITE_BY_ID[run.siteId ?? 'apartment']?.companionCap ?? 0) <= 0;
  const visibleChoices = variant.choices.filter((c) => {
    if (!hideRecruit) return true;
    const rec =
      c.effect?.survivor?.recruit ?? c.check?.ok?.survivor?.recruit ?? c.check?.bad?.survivor?.recruit;
    return !rec;
  });

  return (
    <div className="panel corner-mark anim-rise">
      <div className="panel-head">
        <div className="flex items-center gap-2">
          <Chip tone={KIND_TONE[family.kind] ?? 'default'}>{kindName(family.kind)}</Chip>
          <span className="text-faint">{t('ui.event.intensity', { bars: '▍'.repeat(family.intensity) })}</span>
        </div>
        {run.queue.length > 1 && <span className="text-faint">{t('ui.event.more', { n: run.queue.length - 1 })}</span>}
      </div>

      <div className="p-4 sm:p-5">
        <h3 className="mb-3 text-[17px] font-medium leading-snug text-paper">
          {scrambleText(variant.title ?? '', run, `${item.familyId}-t`)}
        </h3>
        <div className={`mb-5 space-y-2.5 ${unreliable ? 'text-psyche/85' : 'text-dim'}`}>
          {(variant.body ?? '').split('\n').map((p, i) => (
            <p key={i} className="text-[13.5px] leading-relaxed">
              {scrambleText(p, run, `${item.familyId}-b${i}`)}
            </p>
          ))}
        </div>

        {unreliable && (
          <div className="mb-4 border-l-2 border-psyche/60 bg-psyche/5 px-3 py-2 text-[12px] leading-snug text-psyche">
            {t('ui.event.scramble')}
          </div>
        )}

        <div className="space-y-2">
          {visibleChoices.map((c) => {
            const req = checkRequirement(c.requires, run, facts);
            const chance = c.check ? successChance(c.check.dc, run.skills[c.check.skill]) : null;
            const cost = requirementCost(c);
            return (
              <button
                key={c.id}
                disabled={!req.ok}
                className="choice group"
                onClick={() => resolveChoice(item.familyId, item.variantId, c.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex-1">{scrambleText(c.label ?? '', run, `${item.familyId}-${c.id}`)}</span>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {!req.ok && <Chip tone="bad">{req.reason}</Chip>}
                    {req.ok && chance !== null && c.check && (
                      <Chip tone={chance >= 0.7 ? 'good' : chance >= 0.4 ? 'warn' : 'bad'}>
                        {SKILL_NAME[c.check.skill]} · {Math.round(chance * 100)}%
                      </Chip>
                    )}
                    {req.ok && cost && !c.check && <Chip tone="warn">{cost}</Chip>}
                  </div>
                </div>
                {c.note && <div className="mt-1 text-[11.5px] text-faint">{c.note}</div>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
