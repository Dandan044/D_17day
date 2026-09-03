/**
 * 四项 bug 修复的行为验证（临时脚本）：
 *   1. 低库存货架：stock=10 时买 1 件不再报「货架空了」
 *   2. 银行取款：存款/每日限额/崩溃日禁用
 *   3. 袭击掠夺后资源只保留一位小数
 */

import { BANK } from '../src/game/balance';
import { purchase, withdrawCash } from '../src/game/engine/economy';
import { resolveRaid } from '../src/game/engine/exposure';
import { acknowledgeCollapse, chooseSite, createRun, endDay } from '../src/game/engine/run';
import { makeRng } from '../src/game/rng';

// --- Bug 1：低库存采购 ---
{
  const run = createRun({ seed: 1, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
  chooseSite(run, 'apartment');
  run.locations = run.locations.map((l) => (l.id === 'supermarket' ? { ...l, stock: 10 } : l));
  const r = purchase(run, 'supermarket', 'foodStaple', 1, false);
  console.log(`[Bug1] 货架 stock=10 买 1 件 → ok=${r.ok} got=${r.got}（修复前: ok=false「货架空了」）`);
}

// --- Bug 2：银行取款 ---
{
  const run = createRun({ seed: 1, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
  chooseSite(run, 'apartment');
  const w1 = withdrawCash(run, 1500);
  const w2 = withdrawCash(run, 1500); // 超出当日限额 2000，只取到 500
  console.log(`[Bug2] 取 1500 → ok=${w1.ok} got=${w1.got} | 再取 1500 → got=${w2.got}（当日限额 ${BANK.DAILY_LIMIT}）| 存款余 ${run.savings} 手持现金 ${run.res.cash}`);
  // 推进到崩溃日：取款应被拒绝
  while (run.day < 9 && run.phase !== 'ended') endDay(run);
  acknowledgeCollapse(run);
  const w3 = withdrawCash(run, 500);
  console.log(`[Bug2] 崩溃日后取款 → ok=${w3.ok} reason=${w3.reason}`);
}

// --- Bug 4：掠夺精度 ---
{
  const run = createRun({ seed: 7, classId: 'clerk', packId: 'none', difficulty: 'normal', metaPerks: [] });
  chooseSite(run, 'apartment');
  run.res.ammo = 12;
  run.res.foodStaple = 30;
  run.threat = 4;
  const rng = makeRng(99, 0);
  for (let i = 0; i < 8; i++) {
    run.res.ammo = Math.max(run.res.ammo, 5);
    run.res.foodStaple = Math.max(run.res.foodStaple, 10);
    resolveRaid(run, rng, 1, false);
  }
  const decA = (String(run.res.ammo).split('.')[1] ?? '').length;
  const decF = (String(run.res.foodStaple).split('.')[1] ?? '').length;
  console.log(`[Bug4] 8 次袭击后 ammo=${run.res.ammo}（小数 ${decA} 位） foodStaple=${run.res.foodStaple}（小数 ${decF} 位）`);
}
