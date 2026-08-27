import { useGame } from '../game/store';
import { formatSeed } from '../game/rng';
import { Chip, Panel } from './kit';

export default function MainMenu() {
  const { run, meta, goSetup, setOverlay, toast } = useGame();

  return (
    <div className="relative flex h-full items-center justify-center overflow-y-auto p-6">
      <div className="relative z-10 w-full max-w-3xl">
        {/* ---------- 标题 ---------- */}
        <div className="mb-10 text-center">
          <div className="label mb-3 text-amberdim">民防档案 · 个人生存记录</div>
          <h1
            className="title-stamp text-5xl font-bold text-paper sm:text-6xl"
            style={{ textShadow: '0 0 28px rgba(224,161,18,0.18)' }}
          >
            七日之前
          </h1>
          <div className="mt-3 flex items-center justify-center gap-3">
            <div className="h-px w-12 bg-line2" />
            <span className="title-stamp text-[11px] text-amber">SEVEN DAYS BEFORE</span>
            <div className="h-px w-12 bg-line2" />
          </div>
          <p className="mx-auto mt-6 max-w-lg text-[13.5px] leading-relaxed text-dim">
            你有七天。
            <br />
            七天之后会发生什么，没有人能确定——而你必须在不知道答案的情况下，
            <br />
            把钱、时间和这栋楼里的人情，全部押出去。
          </p>
        </div>

        {/* ---------- 按钮 ---------- */}
        <div className="mx-auto max-w-md space-y-2.5">
          {run && run.phase !== 'ended' && (
            <button
              className="btn btn-primary w-full py-3 text-[13px]"
              onClick={() => useGame.setState({ screen: 'game' })}
            >
              继续 · 第 {run.day} 天
            </button>
          )}
          <button className="btn w-full py-3 text-[13px]" onClick={goSetup}>
            {run && run.phase !== 'ended' ? '放弃当前进度，重新开始' : '开始新的一局'}
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <button className="btn btn-ghost py-2.5" onClick={() => setOverlay('meta')}>
              局外成长
            </button>
            <button className="btn btn-ghost py-2.5" onClick={() => setOverlay('codex')}>
              档案馆
            </button>
          </div>
        </div>

        {/* ---------- 存档摘要 ---------- */}
        <div className="mx-auto mt-8 max-w-md">
          <Panel title="累计记录" mark>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="num text-2xl text-amberhi">{meta.relics}</div>
                <div className="label mt-1">遗物</div>
              </div>
              <div>
                <div className="num text-2xl text-paper">{meta.runsPlayed}</div>
                <div className="label mt-1">游玩局数</div>
              </div>
              <div>
                <div className="num text-2xl text-paper">{meta.bestDays}</div>
                <div className="label mt-1">最长存活</div>
              </div>
            </div>
            {(meta.seenEndings.length > 0 || meta.seenDisasters.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                <Chip tone="info">已见结局 {meta.seenEndings.length}/16</Chip>
                <Chip tone="warn">已见灾难 {meta.seenDisasters.length}/6</Chip>
                <Chip>已见事件 {meta.seenFamilies.length}</Chip>
              </div>
            )}
          </Panel>
        </div>

        {run && run.phase !== 'ended' && (
          <div className="mt-4 text-center text-[11px] text-faint">
            当前存档种子 <span className="num text-amberdim">{formatSeed(run.seed)}</span>
            <button
              className="ml-2 underline decoration-dotted hover:text-dim"
              onClick={() => {
                navigator.clipboard?.writeText(formatSeed(run.seed));
                toast('种子已复制', 'good');
              }}
            >
              复制
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
