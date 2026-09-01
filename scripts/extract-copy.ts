/**
 * 从现有内容对象抽出中文，写入 src/game/copy/zh/。
 * 用法：npx tsx scripts/extract-copy.ts
 */

import '../src/game/copy';

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CLASSES, PERK_TEXT, SUPPLY_PACKS } from '../src/game/content/classes';
import { CONDITIONS } from '../src/game/content/conditions';
import { DISASTERS } from '../src/game/content/disasters';
import { ENDINGS } from '../src/game/content/endings';
import { DAILY_EVENTS } from '../src/game/content/events/daily';
import { ECHO_SLICE_EVENTS } from '../src/game/content/events/echo_flags';
import { FILTER_BEAT_EVENTS } from '../src/game/content/events/filter_beats';
import { HOOK_ARC_EVENTS } from '../src/game/content/events/hook_arcs';
import { MED_PROGRESS_EVENTS } from '../src/game/content/events/med_progress';
import { NUKE_APT_CHAIN_EVENTS } from '../src/game/content/events/nuke_apt_chains';
import { NUKE_ARC_EVENTS } from '../src/game/content/events/nuke_arcs';
import { NUKE_BUILD_CHECK_EVENTS } from '../src/game/content/events/nuke_build_checks';
import { PREP_EVENTS } from '../src/game/content/events/prep';
import { PREP_SLICE_EVENTS } from '../src/game/content/events/prep_slice';
import { STAT_ARC_EVENTS } from '../src/game/content/events/stat_arcs';
import { SURV_BEAT_EVENTS } from '../src/game/content/events/surv_beats';
import { SURVIVAL_EVENTS } from '../src/game/content/events/survival';
import { INTEL_POOL } from '../src/game/content/intel';
import { LOCATIONS } from '../src/game/content/locations';
import { MODULES } from '../src/game/content/modules';
import { PERKS, UNLOCK_NAMES } from '../src/game/content/perks';
import { SITES } from '../src/game/content/sites';
import { SURVIVORS } from '../src/game/content/survivors';
import type { Choice, Effect, EventFamily } from '../src/game/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function emit(rel: string, prefix: string, data: unknown): void {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  const importPath = rel.includes('/events/') ? '../../t' : '../t';
  const src = `import { registerTree } from '${importPath}';\n\nexport const data = ${JSON.stringify(data, null, 2)};\n\nregisterTree('${prefix}', data);\n`;
  writeFileSync(path, src, 'utf8');
  console.log('wrote', rel);
}

function effectCopy(e: Effect | undefined): Record<string, string> | undefined {
  if (!e?.log) return undefined;
  return { log: e.log };
}

function choiceCopy(c: Choice): Record<string, unknown> {
  const o: Record<string, unknown> = { label: c.label };
  if (c.note) o.note = c.note;
  if (c.requires?.reason) o.reason = c.requires.reason;
  if (c.check) {
    o.ok = effectCopy(c.check.ok);
    o.bad = effectCopy(c.check.bad);
  } else if (c.effect?.log) {
    o.log = c.effect.log;
  }
  const blocked = c.effect?.locations?.map((l) => l.blocked).filter(Boolean);
  if (blocked?.length) o.blocked = blocked;
  return o;
}

function familyCopy(f: EventFamily): Record<string, unknown> {
  const variants: Record<string, unknown> = {};
  const packed: Array<{ title: string; body: string; choices: string }> = [];
  for (const v of f.variants) {
    const choice: Record<string, unknown> = {};
    for (const c of v.choices) choice[c.id] = choiceCopy(c);
    const rec = { title: v.title, body: v.body, choice };
    variants[v.id] = rec;
    packed.push({ title: v.title, body: v.body, choices: JSON.stringify(choice) });
  }
  const same =
    packed.length > 1 && packed.every((p) => p.title === packed[0]!.title && p.body === packed[0]!.body && p.choices === packed[0]!.choices);
  if (same) {
    return { _shared: variants[f.variants[0]!.id] };
  }
  return variants;
}

const eventBundles: Array<[string, EventFamily[]]> = [
  ['daily', DAILY_EVENTS],
  ['echo_flags', ECHO_SLICE_EVENTS],
  ['filter_beats', FILTER_BEAT_EVENTS],
  ['hook_arcs', HOOK_ARC_EVENTS],
  ['med_progress', MED_PROGRESS_EVENTS],
  ['nuke_apt_chains', NUKE_APT_CHAIN_EVENTS],
  ['nuke_arcs', NUKE_ARC_EVENTS],
  ['nuke_build_checks', NUKE_BUILD_CHECK_EVENTS],
  ['prep', PREP_EVENTS],
  ['prep_slice', PREP_SLICE_EVENTS],
  ['stat_arcs', STAT_ARC_EVENTS],
  ['surv_beats', SURV_BEAT_EVENTS],
  ['survival', SURVIVAL_EVENTS],
];

const eventTree: Record<string, unknown> = {};
for (const [file, list] of eventBundles) {
  const chunk: Record<string, unknown> = {};
  for (const f of list) {
    chunk[f.id] = familyCopy(f);
    eventTree[f.id] = chunk[f.id];
  }
  emit(`src/game/copy/zh/events/${file}.ts`, 'event', chunk);
}

const eventImports = eventBundles.map(([file]) => `import './${file}';`).join('\n');
writeFileSync(
  join(root, 'src/game/copy/zh/events/index.ts'),
  `${eventImports}\n`,
  'utf8',
);
console.log('wrote src/game/copy/zh/events/index.ts');

const disasters: Record<string, unknown> = {};
for (const d of DISASTERS) {
  disasters[d.id] = {
    name: d.name,
    codename: d.codename,
    revealTitle: d.revealTitle,
    reveal: d.reveal,
    thesis: d.thesis,
    keySupplies: d.keySupplies,
    clueTopics: d.clueTopics,
  };
}
emit('src/game/copy/zh/disasters.ts', 'disaster', disasters);

const endings: Record<string, unknown> = {};
for (const e of ENDINGS) {
  endings[e.id] = {
    name: e.name,
    subtitle: e.subtitle,
    text: e.text,
    ...(e.require?.reason ? { reason: e.require.reason } : {}),
  };
}
emit('src/game/copy/zh/endings.ts', 'ending', endings);

const intel: Record<string, unknown> = {};
for (const i of INTEL_POOL) intel[i.id] = { text: i.text };
emit('src/game/copy/zh/intel.ts', 'intel', intel);

const world = {
  site: Object.fromEntries(
    SITES.map((s) => [
      s.id,
      {
        name: s.name,
        codename: s.codename,
        desc: s.desc,
        pros: s.pros,
        cons: s.cons,
        ...(s.cost.requires?.reason ? { reason: s.cost.requires.reason } : {}),
      },
    ]),
  ),
  module: Object.fromEntries(
    MODULES.map((m) => [
      m.id,
      {
        name: m.name,
        short: m.short,
        desc: m.desc,
        zero: m.zero,
        buildPenaltyDesc: m.buildPenaltyDesc,
        level: Object.fromEntries(m.levels.map((lv, i) => [String(i + 1), lv.desc])),
      },
    ]),
  ),
  condition: Object.fromEntries(CONDITIONS.map((c) => [c.id, { name: c.name, desc: c.desc }])),
  class: Object.fromEntries(CLASSES.map((c) => [c.id, { name: c.name, title: c.title, desc: c.desc }])),
  classPerk: PERK_TEXT,
  pack: Object.fromEntries(SUPPLY_PACKS.map((p) => [p.id, { name: p.name, desc: p.desc }])),
  perk: Object.fromEntries(PERKS.map((p) => [p.id, { name: p.name, desc: p.desc }])),
  unlock: UNLOCK_NAMES,
  survivor: Object.fromEntries(
    SURVIVORS.map((s) => [
      s.id,
      { name: s.name, bio: s.bio, ...(s.secret?.text ? { secret: s.secret.text } : {}) },
    ]),
  ),
  location: Object.fromEntries(
    LOCATIONS.map((l) => [l.id, { name: l.name, desc: l.desc, descSurvival: l.descSurvival }]),
  ),
};
emit('src/game/copy/zh/world.ts', 'world', world);

console.log('done. event families', Object.keys(eventTree).length);
