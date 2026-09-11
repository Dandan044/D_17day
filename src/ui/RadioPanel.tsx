/**
 * 无线电 · 频段网络。
 *
 * 灾后的收音机不是情报板，是一台还能听见别人的机器。
 * 左列频段、右侧会话，气泡逐字流出——模拟那头有人在慢慢打字。
 *
 * 流式的全部状态都留在这个文件里（useState），绝不写进 store 或 run：
 * withSession 每次都 structuredClone(run)，而本项目对整树重渲染极敏感。
 */
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { CHANNEL } from '../game/balance';
import { CHANNEL_BY_ID } from '../game/content/channels';
import { t } from '../game/copy/t';
import { bondOf, channelUnread } from '../game/engine/channels';
import { checkRequirement, deriveFacts, effectiveModule } from '../game/engine/tags';
import { WEATHER_NAME } from '../game/engine/world';
import { useGame } from '../game/store';
import type { ChannelDef, ChannelState, ChatLine, RunState, WeatherId } from '../game/types';
import { Modal } from './kit';

/** 流式与节奏常量，集中在这里方便调手感 */
const TYPING = {
  charMin: 25,
  charMax: 45,
  punctPause: 180,
  sameGapMin: 400,
  sameGapMax: 900,
  crossBreath: 1200,
} as const;

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * 动态消息的插值数据。目前只有一种：官方频道播报的未来两天天气。
 * 它报的就是 run.world.forecast——那份会随 threat 变差、会撒谎的预报，
 * 所以「官方在撒谎」不需要额外机制，数据本身就是谎。
 */
function forecastVars(forecast: WeatherId[] | undefined): Record<string, string> {
  const at = (i: number) => {
    const w = forecast?.[i];
    return w ? (WEATHER_NAME[w] ?? '——') : '——';
  };
  return { a: at(0), b: at(1) };
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ============================================================
// 面板
// ============================================================

/** 上次看过的频道 id。面板卸载后仍记得，重开时回到原来那一页 */
let lastChannelId: string | null = null;

export function RadioPanel({ run }: { run: RunState }) {
  const setOverlay = useGame((s) => s.setOverlay);
  const searchChannel = useGame((s) => s.searchChannel);
  const openChannel = useGame((s) => s.openChannel);
  const replyChannel = useGame((s) => s.replyChannel);

  // 模块级记住上次看的是哪个频道：面板关了会卸载，state 留不住
  const [sel, setSel] = useState<string | null>(lastChannelId);
  const [playFrom, setPlayFrom] = useState(0);
  const [playKey, setPlayKey] = useState(0);

  const channels = run.channels;
  const active = channels.find((c) => c.id === sel) ?? channels[0] ?? null;

  // 首次打开时落到「有未读的那个」频段——第一眼应该是有人在跟你说话。
  // 命中后就把选择钉住（sel 有效就不再改），否则读完未读会自己跳走。
  useEffect(() => {
    if (channels.length === 0) return;
    if (sel && channels.some((c) => c.id === sel)) {
      lastChannelId = sel;
      return;
    }
    // 没有历史选择才挑「有未读的那个」——第一眼应该是有人在跟你说话
    const withUnread = channels.find((c) => c.inbox.length > 0);
    const next = (withUnread ?? channels[0]!).id;
    lastChannelId = next;
    setSel(next);
  }, [sel, channels]);

  // 有新消息就搬进会话记录，并触发一次播放。
  // 依赖用 inbox.length：openChannel 之后它变成 0，不会再触发，无循环。
  const activeId = active?.id ?? null;
  const activeInbox = active?.inbox.length ?? 0;
  const activeSeen = Math.min(active?.seenLines ?? 0, active?.log.length ?? 0);
  useEffect(() => {
    if (!activeId) return;
    if (activeInbox === 0) {
      // 没有新消息：只把播放起点设到「已看过」的位置，不产生任何存档写入
      setPlayFrom(activeSeen);
      setPlayKey((k) => k + 1);
      return;
    }
    const r = openChannel(activeId);
    if (!r?.ok || !r.value) return;
    setPlayFrom(r.value.from);
    setPlayKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeInbox]);

  const onPick = (choiceId: string) => {
    if (!activeId || !active) return;
    const before = active.log.length;
    const r = replyChannel(activeId, choiceId);
    if (!r?.ok) return;
    const after = useGame.getState().run?.channels.find((c) => c.id === activeId)?.log.length ?? before;
    if (after > before) {
      setPlayFrom(before);
      setPlayKey((k) => k + 1);
    }
  };

  const onSearch = () => {
    const r = searchChannel();
    if (r?.ok && r.value?.found) setSel(r.value.found);
  };

  const unread = channels.reduce((n, c) => n + channelUnread(c), 0);

  return (
    <Modal
      title={t('channels.ui.title')}
      subtitle={t('channels.ui.subtitle', { n: channels.length, unread })}
      onClose={() => setOverlay(null)}
      width="max-w-5xl"
    >
      {/* 固定高度：对话再长也只让两侧各自滚动。
          不固定的话整个弹窗会被内容撑高，往下拉时左侧联系人会被拉出视野。 */}
      <div className="flex h-[min(72vh,620px)] gap-3">
        <ChannelList
          channels={channels}
          sel={activeId}
          onPick={(id) => setSel(id)}
          run={run}
          onSearch={onSearch}
        />
        {active ? (
          <ChatSession
            key={`${active.id}:${playKey}`}
            run={run}
            def={CHANNEL_BY_ID[active.id]!}
            st={active}
            playFrom={playFrom}
            onPick={onPick}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-[12.5px] leading-relaxed text-faint">
            {t('channels.ui.empty')}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ============================================================
// 左列：频段列表
// ============================================================

const ChannelList = memo(function ChannelList({
  channels,
  sel,
  onPick,
  run,
  onSearch,
}: {
  channels: ChannelState[];
  sel: string | null;
  onPick: (id: string) => void;
  run: RunState;
  onSearch: () => void;
}) {
  const radio = effectiveModule(run, 'radio');
  const notice =
    run.channelSearchDay === run.day
      ? t('channels.err.searchOnce')
      : radio <= 0
        ? t('channels.err.offline')
        : run.ap < CHANNEL.SEARCH_AP
          ? t('channels.err.noAp')
          : run.wear.batteryCharge < CHANNEL.SEARCH_KWH
            ? t('channels.err.noPower')
            : null;

  return (
    <div className="flex w-[236px] shrink-0 flex-col border border-line bg-ink">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {channels.length === 0 && (
          <div className="p-3 text-[12px] leading-relaxed text-faint">{t('channels.ui.empty')}</div>
        )}
        {channels.map((c) => (
          <ChannelRow key={c.id} st={c} def={CHANNEL_BY_ID[c.id]!} on={c.id === sel} onClick={() => onPick(c.id)} />
        ))}
      </div>
      <div className="border-t border-line p-2.5">
        <button className="btn btn-ghost w-full py-1.5 text-[12px]" disabled={notice !== null} onClick={onSearch}>
          {t('channels.ui.search')}
        </button>
        <div className="mt-1.5 text-center text-[10.5px] text-faint">{notice ?? t('channels.ui.searchCost')}</div>
      </div>
    </div>
  );
});

const ChannelRow = memo(function ChannelRow({
  st,
  def,
  on,
  onClick,
}: {
  st: ChannelState;
  def: ChannelDef;
  on: boolean;
  onClick: () => void;
}) {
  const unread = channelUnread(st);
  const dead = st.status === 'lost';
  const tail = dead
    ? t('channels.ui.lastSeen', { n: st.lastContactDay })
    : st.status === 'silent'
      ? t('channels.ui.silentTail')
      : t(`channels.ui.bond.${bondOf(st.affinity)}`);

  return (
    <div className={`ch-row${on ? ' on' : ''}${dead ? ' dead' : ''}`} onClick={onClick}>
      <div className={`ch-av ${def.kind === 'org' ? 'org' : 'per'}`}>{def.short}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          {unread > 0 && <span className="ch-dot" />}
          <span className="ch-name">{t(def.name)}</span>
        </div>
        <div className="ch-sub">{tail}</div>
      </div>
      {unread > 0 && <span className="ch-badge">{unread}</span>}
    </div>
  );
});

// ============================================================
// 右列：会话
// ============================================================

function ChatSession({
  run,
  def,
  st,
  playFrom,
  onPick,
}: {
  run: RunState;
  def: ChannelDef;
  st: ChannelState;
  playFrom: number;
  onPick: (choiceId: string) => void;
}) {
  const beat = st.awaitingBeat ? def.beats.find((b) => b.id === st.awaitingBeat) : undefined;
  const facts = useMemo(() => deriveFacts(run), [run]);
  // 引用必须稳定，否则 memo 化的气泡每帧都会重渲染
  const vars = useMemo(() => forecastVars(run.world.forecast), [run.world.forecast]);

  return (
    <div className="flex min-w-0 flex-1 flex-col border border-line bg-void">
      <div className="border-b border-line px-3.5 py-2">
        <div className="text-[12.5px] text-paper">
          {t(def.name)}
          <span className="ml-2 text-[11px] text-faint">{t(def.tagline)}</span>
        </div>
      </div>

      {st.log.length === 0 ? (
        <div className="min-h-0 flex-1 px-3.5 py-3 text-[12px] text-faint">{t('channels.ui.empty')}</div>
      ) : (
        <ChatLog lines={st.log} playFrom={playFrom} vars={vars} />
      )}

      <div className="border-t border-line px-3.5 py-2.5">
        {st.status === 'lost' ? (
          <div className="text-[11.5px] text-faint">{t('channels.err.lost')}</div>
        ) : beat?.choices?.length ? (
          <>
            <div className="mb-1.5 text-[10.5px] text-faint">{t('channels.ui.hint')}</div>
            {beat.choices.map((c) => {
              const req = checkRequirement(c.requires, run, facts);
              const sends = !!c.say;
              // requires.reason 在频道内容里是文案键（没走事件层 hydrate），要过 t()
              const reason = !req.ok
                ? t(req.reason ?? '')
                : sends && effectiveModule(run, 'radio') < 2
                  ? t('channels.err.needRadio2')
                  : sends && run.wear.batteryCharge < CHANNEL.SEND_KWH
                    ? t('channels.err.noPower')
                    : null;
              return (
                <button key={c.id} className="ch-opt" disabled={reason !== null} onClick={() => onPick(c.id)}>
                  <span>{t(c.label)}</span>
                  <span className="ch-opt-cost">{reason ?? (c.note ? t(c.note) : '')}</span>
                </button>
              );
            })}
          </>
        ) : (
          <div className="text-[11.5px] text-faint">{t('channels.ui.none')}</div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 会话记录 + 逐字流式
// ============================================================

function ChatLog({
  lines,
  playFrom,
  vars,
}: {
  lines: ChatLine[];
  playFrom: number;
  vars: Record<string, string>;
}) {
  const instant = prefersReducedMotion();
  const [done, setDone] = useState(() => (instant ? lines.length : Math.min(playFrom, lines.length)));
  const [partial, setPartial] = useState<{ i: number; text: string } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // 气泡是逐字长高的，必须跟着往下滚，否则正在说的那句会停在折叠线以下
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [partial, done]);

  useEffect(() => {
    if (instant) {
      setDone(lines.length);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      let i = Math.min(playFrom, lines.length);
      let prevSide: string | null = i > 0 ? lines[i - 1]!.from : null;
      while (i < lines.length && !cancelled) {
        const line = lines[i]!;
        if (prevSide) {
          await wait(prevSide === line.from ? rand(TYPING.sameGapMin, TYPING.sameGapMax) : TYPING.crossBreath);
          if (cancelled) return;
        }
        prevSide = line.from;

        if (line.sys) {
          setDone(i + 1);
          i++;
          continue;
        }

        const text = t(line.text, line.dynamic ? vars : undefined);
        const step = line.cps ?? rand(TYPING.charMin, TYPING.charMax);
        for (let n = 1; n <= text.length; n++) {
          if (cancelled) return;
          setPartial({ i, text: text.slice(0, n) });
          const ch = text[n - 1]!;
          const pause = '。！？'.includes(ch) ? TYPING.punctPause : step + Math.random() * 14;
          await new Promise<void>((r) => {
            timer = setTimeout(r, pause);
          });
        }
        if (cancelled) return;
        setPartial(null);
        setDone(i + 1);
        i++;
      }
    };
    void run();
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
    // 只在挂载时启动；lines 由 key 变化驱动重挂载，流式过程中不重启
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instant]);

  return (
    <div ref={boxRef} className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
      <StaticLog lines={lines.slice(0, done)} vars={vars} />
      {partial && <Bubble line={lines[partial.i]!} text={partial.text} typing />}
    </div>
  );
}

/** 已定稿的气泡。memo 化：流式每帧只重渲染那条正在打字的 */
const StaticLog = memo(function StaticLog({ lines, vars }: { lines: ChatLine[]; vars: Record<string, string> }) {
  const out: ReactNode[] = [];
  let lastDay = -1;
  lines.forEach((l, i) => {
    if (l.day !== undefined && l.day !== lastDay) {
      lastDay = l.day;
      out.push(
        <div key={`d${l.day}-${i}`} className="chat-day">
          {t('channels.ui.dayN', { n: l.day })}
        </div>,
      );
    }
    out.push(<Bubble key={i} line={l} text={t(l.text, l.dynamic ? vars : undefined)} />);
  });
  return <>{out}</>;
});

const Bubble = memo(function Bubble({ line, text, typing }: { line: ChatLine; text: string; typing?: boolean }) {
  if (line.sys) {
    return <div className={`chat-sys${line.sys === 'silent' ? ' silent' : line.sys === 'narrate' ? ' narrate' : ''}`}>{text}</div>;
  }
  const mine = line.from === 'you';
  return (
    <div className={`chat-row${mine ? ' you' : ''}`}>
      <div className={`chat-bub${mine ? ' you' : ''}${typing ? ' typing' : ''}`}>{text}</div>
    </div>
  );
});
