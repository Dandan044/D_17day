/**
 * 无 UI 的玩家动作层。就地修改 RunState，不 structuredClone。
 * store 在调用前自己 clone；无头模拟直接用同一份对象。
 */

import './copy';
import { HEALTH, RAD, STAMINA, TIME, WEAR } from './balance';
import { CHANNEL_BY_ID } from './content/channels';
import { FAMILY_BY_ID } from './content/events';
import { LOCATION_BY_ID } from './content/locations';
import { t } from './copy/t';
import { applyHeatWants } from './engine/climate';
import {
  cancelProject as engineCancelProject,
  completeReadyProjects,
  doMaintenance,
  doSalvage,
  investLabor as engineInvestLabor,
  startProject,
  type MaintenanceKind,
} from './engine/construction';
import { addLog, clampResources } from './engine/effects';
import {
  buyCartridge as engineBuyCartridge,
  buyCoAlarm as engineBuyCoAlarm,
  buyIodine as engineBuyIodine,
  carryCapacity,
  commitHaul,
  drainLocation,
  purchase as enginePurchase,
  rollHaul,
  travelCost,
  withdrawCash as engineWithdrawCash,
  type Haul,
  type HaulItem,
} from './engine/economy';
import {
  openChannel as engineOpenChannel,
  replyChannel as engineReplyChannel,
  searchChannel as engineSearchChannel,
} from './engine/channels';
import { applyScavengeDanger } from './engine/exposure';
import { medicateCondition } from './engine/health';
import { emitHook } from './engine/hooks';
import { heaterHeadroomKwh } from './engine/power';
import {
  activateIodineProtection,
  hasIodinePrep,
  iodineActive,
} from './engine/tags';
import {
  acknowledgeCollapse as engineAckCollapse,
  chooseSite as engineChooseSite,
  endDay as engineEndDay,
  resolveChoice as engineResolveChoice,
  verifyIntel as engineVerifyIntel,
  type NightReport,
  type ResolveChoiceResult,
} from './engine/run';
import { makeRng } from './rng';
import type {
  BuildPath,
  ChatLine,
  ConditionId,
  HeatMode,
  ModuleId,
  PowerLoadId,
  PowerMode,
  RationLevel,
  ResourceId,
  RunState,
  SiteId,
  WaterLevel,
} from './types';

export type { Haul, HaulItem, MaintenanceKind, NightReport, ResolveChoiceResult };

export type NoteTone = 'good' | 'bad' | 'neutral';

export interface SessionNote {
  text: string;
  tone: NoteTone;
}

export interface SessionResult<T = void> {
  ok: boolean;
  reason?: string;
  notes: SessionNote[];
  value?: T;
}

export interface Session {
  run: RunState;
  haul: Haul | null;
  openShop: string | null;
}

export function createSession(
  run: RunState,
  haul: Haul | null = null,
  openShop: string | null = null,
): Session {
  return { run, haul, openShop };
}

function ok<T>(value?: T, notes: SessionNote[] = []): SessionResult<T> {
  return { ok: true, notes, value };
}

function fail(reason: string, notes: SessionNote[] = []): SessionResult<never> {
  return { ok: false, reason, notes };
}

function hook(run: RunState, name: Parameters<typeof emitHook>[1]): void {
  const rng = makeRng(run.seed, run.rngCursor);
  emitHook(run, name, rng);
  run.rngCursor = rng.cursor();
}

export function pickGreedyHaul(run: RunState, haul: Haul): HaulItem[] {
  let cap = carryCapacity(run, run.abilities.includes('trucker_vehicle'));
  const picked: HaulItem[] = [];
  for (const it of [...haul.items].sort((a, b) => a.weight / Math.max(0.01, a.amount) - b.weight / Math.max(0.01, b.amount))) {
    const unitW = it.weight / Math.max(0.01, it.amount);
    const take = unitW > 0 ? Math.min(it.amount, cap / unitW) : it.amount;
    if (take <= 0) continue;
    picked.push({ res: it.res, item: it.item, amount: take, weight: take * unitW });
    cap -= take * unitW;
  }
  return picked;
}

export function chooseSite(s: Session, siteId: SiteId): SessionResult {
  const r = engineChooseSite(s.run, siteId);
  return r.ok ? ok() : fail(r.reason ?? t('ledger.toast.noSite'));
}

export function endDay(s: Session): SessionResult<NightReport> {
  if (s.run.queue.length > 0) return fail(t('ledger.toast.queue'));
  const report = engineEndDay(s.run);
  return ok(report);
}

export function acknowledgeCollapse(s: Session): SessionResult {
  engineAckCollapse(s.run);
  return ok();
}

export function resolveChoice(
  s: Session,
  familyId: string,
  variantId: string,
  choiceId: string,
): SessionResult<ResolveChoiceResult> {
  const family = FAMILY_BY_ID[familyId];
  const variant = family?.variants.find((v) => v.id === variantId);
  if (!family || !variant) {
    s.run.queue = s.run.queue.filter((q) => !(q.familyId === familyId && q.variantId === variantId));
    return fail(t('ledger.run.cannot'));
  }
  const result = engineResolveChoice(s.run, familyId, variantId, choiceId);
  return ok(result);
}

export function scavenge(s: Session, locationId: string, night: boolean): SessionResult<Haul> {
  const run = s.run;
  if (run.day < TIME.COLLAPSE_DAY) return fail(t('ledger.toast.shopOpen'));
  const loc = LOCATION_BY_ID[locationId];
  if (!loc) return fail(t('ledger.toast.empty'));
  // 隐藏地点（信号点）只有被坐标解锁后才存在；没写进 run.locations 就是还没找到
  if (loc.hidden && !run.locations.some((l) => l.id === locationId)) {
    return fail(t('ledger.toast.empty'));
  }
  if (run.ap < 1) return fail(t('ledger.toast.noAp'));
  if (loc.needsVehicle && !run.hasVehicle) return fail(t('ledger.toast.needCar'));
  const shelf = run.locations.find((l) => l.id === locationId)?.stock ?? loc.stock;
  if (shelf <= 0) return fail(t('ledger.toast.empty'));
  const cost = travelCost(run, loc);
  if (cost.fuel > 0 && run.res.fuel < cost.fuel) {
    return fail(t('ledger.toast.needFuel', { fuel: cost.fuel }));
  }
  if (run.stats.stamina < Math.min(12, cost.stamina * 0.5)) return fail(t('ledger.toast.tired'));

  const rng = makeRng(run.seed, run.rngCursor);
  run.ap -= 1;
  run.stats.stamina = Math.max(0, run.stats.stamina - cost.stamina);
  run.res.fuel = Math.max(0, run.res.fuel - cost.fuel);
  const haul = rollHaul(run, locationId, night, rng, run.difficulty);
  const risk = applyScavengeDanger(run, haul, rng);
  drainLocation(run, locationId);
  run.stats_meta.scavengeRuns += 1;
  if (!run.visitedToday.includes(locationId)) run.visitedToday.push(locationId);
  emitHook(run, 'scavenge', rng);
  emitHook(run, night ? 'scavengeNight' : 'scavengeDay', rng);
  run.rngCursor = rng.cursor();
  s.haul = haul;

  const notes: SessionNote[] = [];
  if (risk.exposure > 0) {
    notes.push({
      text: t('ledger.toast.exposure', { n: risk.exposure }),
      tone: risk.exposure >= 6 ? 'bad' : 'neutral',
    });
  }
  if (risk.hpLost > 0) notes.push({ text: t('ledger.toast.hurt', { n: risk.hpLost }), tone: 'bad' });
  if (risk.lostRes && risk.lostAmt) notes.push({ text: t('ledger.toast.droppedLoot'), tone: 'bad' });
  if (risk.scheduledRaid) notes.push({ text: t('ledger.toast.followed'), tone: 'bad' });
  return ok(haul, notes);
}

export function takeHaul(s: Session, picked: HaulItem[]): SessionResult {
  const haul = s.haul;
  if (!haul) return fail(t('ledger.toast.empty'));
  const haulNotes = commitHaul(s.run, picked);
  clampResources(s.run);
  hook(s.run, 'takeHaul');
  const total = picked.reduce((sum, p) => sum + p.amount, 0);
  const notes: SessionNote[] = haulNotes.notes.map((text) => ({ text, tone: 'bad' as const }));
  if (total > 0) {
    addLog(
      s.run,
      t('ledger.toast.haul', { name: LOCATION_BY_ID[haul.locationId]?.name ?? t('ledger.toast.haulOutside') }),
      'good',
    );
  }
  s.haul = null;
  return ok(undefined, notes);
}

export function discardHaul(s: Session): SessionResult {
  s.haul = null;
  return ok();
}

export function visitShop(s: Session, locationId: string): SessionResult {
  const run = s.run;
  if (run.visitedToday.includes(locationId)) {
    if (locationId === 'pharmacy' && !run.flags.includes('flag:sawIodineOffer')) {
      run.flags.push('flag:sawIodineOffer');
    }
    s.openShop = locationId;
    return ok();
  }
  if (run.ap < 1) return fail(t('ledger.toast.noAp'));
  run.ap -= 1;
  run.stats.stamina = Math.max(0, run.stats.stamina - STAMINA.CHORE);
  run.visitedToday.push(locationId);
  if (locationId === 'pharmacy' && !run.flags.includes('flag:sawIodineOffer')) {
    run.flags.push('flag:sawIodineOffer');
  }
  hook(run, 'visitShop');
  s.openShop = locationId;
  return ok();
}

export function closeShop(s: Session): SessionResult {
  s.openShop = null;
  return ok();
}

export function buy(s: Session, locationId: string, res: ResourceId, qty: number): SessionResult<{ got: number; spent: number; capped: boolean }> {
  const hasClerk = s.run.abilities.includes('clerk_network');
  const r = enginePurchase(s.run, locationId, res, qty, hasClerk);
  if (!r.ok) return fail(r.reason ?? t('ledger.toast.buyFail'));
  clampResources(s.run);
  hook(s.run, 'buy');
  const notes: SessionNote[] =
    r.capped && res === 'water'
      ? [{ text: t('ledger.toast.buyPartial', { got: r.got, spent: r.spent }), tone: 'neutral' }]
      : [{ text: t('ledger.toast.buyOk', { got: r.got, spent: r.spent }), tone: 'good' }];
  return ok({ got: r.got, spent: r.spent, capped: !!r.capped }, notes);
}

export function buyIodine(s: Session, locationId: string): SessionResult {
  const r = engineBuyIodine(s.run, locationId);
  if (!r.ok) return fail(r.reason ?? t('ledger.toast.iodineFail'));
  clampResources(s.run);
  hook(s.run, 'buy');
  return ok(undefined, [{ text: t('ledger.toast.iodineOk', { spent: r.spent }), tone: 'good' }]);
}

export function withdraw(s: Session, locationId: string, amount: number): SessionResult<{ got: number }> {
  if (locationId !== 'bank') return fail(t('ledger.atm.limit'));
  const r = engineWithdrawCash(s.run, amount);
  if (!r.ok) return fail(r.reason ?? t('ledger.atm.limit'));
  clampResources(s.run);
  return ok({ got: r.got }, [{ text: t('ledger.atm.ok', { got: r.got, left: s.run.savings }), tone: 'good' }]);
}

export function buyCoAlarm(s: Session, locationId: string): SessionResult {
  const r = engineBuyCoAlarm(s.run, locationId);
  if (!r.ok) return fail(r.reason ?? t('ledger.toast.coAlarmFail'));
  clampResources(s.run);
  hook(s.run, 'buy');
  return ok(undefined, [{ text: t('ledger.toast.coAlarmOk', { spent: r.spent }), tone: 'good' }]);
}

export function buyCartridge(s: Session, locationId: string): SessionResult {
  const r = engineBuyCartridge(s.run, locationId);
  if (!r.ok) return fail(r.reason ?? t('ledger.toast.filterFail'));
  clampResources(s.run);
  hook(s.run, 'buy');
  return ok(undefined, [{ text: t('ledger.toast.filterOk', { spent: r.spent }), tone: 'good' }]);
}

/** 物品栏「使用」：滤芯=整芯替换（随时可换，旧芯剩余耐久作废）；碘片=开启辐射保护窗 */
export function useItem(s: Session, id: 'filter' | 'iodine'): SessionResult {
  const run = s.run;
  if (id === 'filter') {
    if ((run.items?.filter ?? 0) < 1) return fail(t('ledger.toast.noCartridge'));
    run.items.filter -= 1;
    run.wear.filterLife = WEAR.FILTER_LIFE;
    hook(run, 'maintain');
    return ok(undefined, [{ text: t('ledger.toast.filterUsed', { n: WEAR.FILTER_LIFE }), tone: 'good' }]);
  }
  if (!hasIodinePrep(run)) return fail(t('ledger.toast.iodineNo'));
  if (iodineActive(run)) return fail(t('ledger.toast.iodineActive'));
  if (run.day < TIME.COLLAPSE_DAY) return fail(t('ledger.toast.iodinePrep'));
  activateIodineProtection(run);
  return ok(undefined, [{ text: t('ledger.toast.iodineUsed', { days: RAD.IODINE_DAYS }), tone: 'good' }]);
}

export function rest(s: Session): SessionResult {
  const run = s.run;
  if (run.ap < 1) return fail(t('ledger.toast.noAp'));
  run.ap -= 1;
  const medbay = run.modules.medbay ?? 0;
  const stamBonus = HEALTH.MEDBAY_REST_STAMINA[medbay] ?? 0;
  const sanBonus = HEALTH.MEDBAY_REST_SANITY[medbay] ?? 0;
  const hpBonus = HEALTH.MEDBAY_REST_HP[medbay] ?? 0;
  run.stats.stamina = Math.min(100, run.stats.stamina + STAMINA.REST_ACTION + stamBonus);
  run.stats.sanity = Math.min(100, run.stats.sanity + 4 + sanBonus);
  if (hpBonus > 0) run.stats.hp = Math.min(100, run.stats.hp + hpBonus);
  hook(run, 'rest');
  return ok(undefined, [{ text: hpBonus > 0 ? t('ledger.toast.restHeal') : t('ledger.toast.rest'), tone: 'good' }]);
}

export function build(s: Session, moduleId: ModuleId, path: BuildPath): SessionResult {
  const r = startProject(s.run, moduleId, path);
  if (!r.ok) return fail(r.reason ?? t('ledger.toast.noBuild'));
  hook(s.run, 'build');
  return ok();
}

export function work(s: Session, moduleId: ModuleId): SessionResult<{ done: string[] }> {
  const rng = makeRng(s.run.seed, s.run.rngCursor);
  const r = engineInvestLabor(s.run, moduleId, rng);
  s.run.rngCursor = rng.cursor();
  if (!r.ok) return fail(r.reason ?? t('ledger.toast.noWork'));
  const done = completeReadyProjects(s.run, rng);
  emitHook(s.run, 'work', rng);
  s.run.rngCursor = rng.cursor();
  const notes: SessionNote[] = [];
  if (r.note) {
    const bad = r.note.includes('浪费') || r.note.includes('划伤') || r.note.includes('伤口') || r.note.includes('做坏');
    notes.push({ text: r.note, tone: bad ? 'bad' : 'neutral' });
  }
  for (const d of done) notes.push({ text: d, tone: 'good' });
  return ok({ done }, notes);
}

export function cancelProject(s: Session, moduleId: ModuleId): SessionResult {
  engineCancelProject(s.run, moduleId);
  hook(s.run, 'cancelProject');
  return ok();
}

export function salvage(s: Session, targetId: string): SessionResult {
  const rng = makeRng(s.run.seed, s.run.rngCursor);
  const r = doSalvage(s.run, targetId, rng);
  s.run.rngCursor = rng.cursor();
  if (!r.ok) return fail(r.reason ?? t('ledger.toast.noSalvage'));
  emitHook(s.run, 'salvage', rng);
  s.run.rngCursor = rng.cursor();
  return ok(undefined, r.note ? [{ text: r.note, tone: 'neutral' }] : []);
}

export function maintain(s: Session, kind: MaintenanceKind): SessionResult {
  const r = doMaintenance(s.run, kind);
  if (!r.ok) return fail(r.reason ?? t('ledger.toast.noMaint'));
  hook(s.run, 'maintain');
  return ok(undefined, r.note ? [{ text: r.note, tone: 'good' }] : []);
}

export function medicate(s: Session, conditionId: ConditionId): SessionResult {
  const r = medicateCondition(s.run, conditionId);
  if (!r.ok) return fail(r.reason ?? t('ledger.toast.noTreat'));
  hook(s.run, 'treat');
  return ok(undefined, [{ text: t('ledger.toast.medicated'), tone: 'good' }]);
}

export function verifyIntel(s: Session, intelId: string): SessionResult {
  const r = engineVerifyIntel(s.run, intelId);
  if (!r.ok) return fail(r.reason ?? t('ledger.toast.noIntel'));
  hook(s.run, 'verifyIntel');
  return ok();
}

// ============================================================
// 无线电频道
// ============================================================

/** 搜索频道：1 AP + 蓄电，抽一个还没发现的频段 */
export function searchChannel(s: Session): SessionResult<{ found: string | null }> {
  const r = engineSearchChannel(s.run);
  if (!r.ok) return fail(r.reason ?? t('channels.err.searchOnce'));
  if (!r.found) return ok({ found: null }, [{ text: t('channels.ui.searchEmpty'), tone: 'neutral' }]);
  const name = t(CHANNEL_BY_ID[r.found]?.name ?? r.found);
  return ok({ found: r.found }, [{ text: t('channels.ui.searchFound', { name }), tone: 'good' }]);
}

/**
 * 打开频道：把未读搬进会话记录并结算 onRead。
 * 读不需要电——没电时玩家仍然能看到对方说过什么，只是回不了。
 */
export function openChannel(s: Session, id: string): SessionResult<{ lines: ChatLine[]; from: number }> {
  const r = engineOpenChannel(s.run, id);
  return ok({ lines: r.lines, from: r.from });
}

/** 回一条消息：耗电，不占 AP；1 级电台只能听 */
export function replyChannel(s: Session, id: string, choiceId: string): SessionResult {
  const r = engineReplyChannel(s.run, id, choiceId);
  if (!r.ok) return fail(r.reason ?? t('channels.err.noChoice'));
  // 回话本身不写日记（会话里已经有一条自己的气泡），只回报成功
  return ok();
}

export function setRation(s: Session, ration: RationLevel): SessionResult {
  s.run.ration = ration;
  hook(s.run, 'setRation');
  return ok();
}

export function setWaterUse(s: Session, waterUse: WaterLevel): SessionResult {
  s.run.waterUse = waterUse;
  hook(s.run, 'setWaterUse');
  return ok();
}

export function setPowerMode(s: Session, powerMode: PowerMode): SessionResult {
  s.run.powerMode = powerMode;
  hook(s.run, 'setPowerMode');
  hook(s.run, 'setPowerPriority');
  return ok();
}

export function setHeatMode(s: Session, heatMode: HeatMode): SessionResult {
  s.run.heatMode = heatMode;
  hook(s.run, 'setHeatMode');
  return ok();
}

export function setHeatTarget(s: Session, heatTarget: number): SessionResult {
  s.run.heatTarget = heatTarget;
  return ok();
}

export function setHeatMix(s: Session, elecKwh: number, fuelL: number): SessionResult {
  applyHeatWants(s.run, elecKwh, fuelL, heaterHeadroomKwh(s.run));
  if ((s.run.heatElecWant ?? 0) > 0) {
    if (!s.run.powerEnabled) s.run.powerEnabled = {};
    s.run.powerEnabled.heater = true;
  }
  return ok();
}

export function setPowerPriority(s: Session, order: PowerLoadId[]): SessionResult {
  s.run.powerPriority = order;
  hook(s.run, 'setPowerPriority');
  hook(s.run, 'setPowerMode');
  return ok();
}

export function togglePowerLoad(s: Session, id: PowerLoadId, on: boolean): SessionResult {
  if (!s.run.powerEnabled) s.run.powerEnabled = {};
  s.run.powerEnabled[id] = on;
  hook(s.run, 'setPowerPriority');
  hook(s.run, 'setPowerMode');
  return ok();
}
