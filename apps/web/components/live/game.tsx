'use client';

import {
  AlarmClock,
  Check,
  CircleCheck,
  Clock,
  Loader2,
  MinusCircle,
  Pause,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import type { RoomView, ThisOrThatChoice, ThisOrThatView } from '@funfriday/contracts';
import { Notice } from '@funfriday/ui';
import { formatClock, isOverdue, remainingMs, timerFraction } from '@/lib/live/clock';
import type { RoundTiming } from '@/lib/live/state';
import { actionErrorText, answerStatus, answeredText } from '@/lib/live/view-model';
import { answerForKey, isTypingTarget } from '@/lib/live/shortcuts';
import { RosterCard } from './roster';
import { ShortcutsSwitch, useShortcutsEnabled } from './use-shortcuts';
import type { LiveRoomApi } from './use-live-room';

type RoundView = NonNullable<ThisOrThatView['round']>;

export function RoundProgress({ number, total }: { number: number; total: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-heading text-lg font-bold text-ff-ink">
        Round {number} of {total}
      </p>
      <ol aria-hidden="true" className="flex gap-1">
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          return (
            <li
              key={n}
              className={`flex h-3 min-w-3 flex-1 items-center justify-center rounded-full border ${
                n < number
                  ? 'border-ff-mint-700 bg-ff-mint-700 text-white'
                  : n === number
                    ? 'border-ff-ink bg-ff-ink'
                    : 'border-ff-border-strong bg-ff-surface'
              }`}
            >
              {n < number ? <Check className="size-2.5" strokeWidth={4} /> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Timer({ remaining, paused }: { remaining: number; paused: boolean }) {
  const urgent = !paused && remaining > 0 && remaining <= 5000;
  const Icon = urgent ? AlarmClock : Clock;
  const text = formatClock(remaining);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="size-6 shrink-0 text-ff-ink" />
        <span
          aria-hidden="true"
          data-testid="timer"
          className={`ff-timer-numeral text-ff-ink ${urgent ? 'ff-urgent-num' : ''}`}
        >
          {text}
        </span>
        <span className="sr-only">Time left: {text}</span>
      </div>
      {paused && <span className="sr-only">Timer paused</span>}
    </div>
  );
}

function ChoiceCard({
  choice,
  badge,
  text,
  hint,
  shortcuts,
  selected,
  pending,
  disabled,
  focusable,
  onPick,
  index,
}: {
  choice: ThisOrThatChoice;
  badge: string;
  text: string;
  hint: string;
  shortcuts: boolean;
  selected: boolean;
  pending: boolean;
  disabled: boolean;
  focusable: boolean;
  onPick: (choice: ThisOrThatChoice) => void;
  index: number;
}) {
  const isPass = choice === 'pass';
  const tone = isPass
    ? 'border-dashed border-ff-border-strong bg-ff-surface'
    : choice === 'A'
      ? 'border-ff-violet-700 bg-ff-violet-50'
      : 'border-ff-coral-700 bg-ff-coral-50';
  const badgeTone = choice === 'A' ? 'bg-ff-violet-700' : 'bg-ff-coral-700';
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      aria-keyshortcuts={shortcuts ? hint.replace('Press ', '') : undefined}
      data-choice={choice}
      data-index={index}
      tabIndex={focusable ? 0 : -1}
      onClick={() => {
        if (!disabled) onPick(choice);
      }}
      className={`ff-press relative flex w-full text-left text-ff-ink ${
        isPass
          ? 'min-h-12 items-center justify-center gap-2 rounded-ff-button px-4 py-2'
          : 'min-h-24 items-center gap-4 rounded-ff-card px-4 py-4 md:min-h-[120px] lg:min-h-[240px] lg:flex-col lg:justify-center lg:gap-6 lg:text-center'
      } ${tone} ${selected ? (pending ? 'border-[4px] border-dashed' : 'border-[4px]') : 'border-2'} ${
        disabled ? 'cursor-not-allowed' : 'hover:-translate-y-0.5 hover:shadow-ff-md'
      }`}
    >
      {isPass ? (
        <>
          <MinusCircle aria-hidden="true" className="size-5" />
          <span className="font-semibold">Pass</span>
        </>
      ) : (
        <>
          <span
            className={`${selected ? 'ff-pop' : ''} flex size-10 shrink-0 items-center justify-center rounded-full font-heading text-lg font-extrabold text-white ${badgeTone}`}
          >
            {badge}
          </span>
          <span className="flex-1 text-xl leading-7 lg:flex-none font-semibold lg:text-[28px] lg:leading-[34px]">
            {text}
          </span>
        </>
      )}
      {shortcuts && (
        <span
          aria-hidden="true"
          className="hidden text-sm text-ff-muted [@media(pointer:fine)]:inline"
        >
          {hint}
        </span>
      )}
      {selected && (
        <span
          aria-hidden="true"
          className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-ff-ink px-2 py-0.5 text-xs font-semibold text-white"
        >
          {pending ? (
            <>
              <Loader2 className="ff-spin size-3.5" /> Saving...
            </>
          ) : (
            <>
              <CircleCheck className="size-3.5" /> Your pick
            </>
          )}
        </span>
      )}
    </button>
  );
}

export function GameView({
  room,
  game,
  round,
  live,
  now,
  timing,
  offline,
  showRoster,
}: {
  room: RoomView;
  game: ThisOrThatView;
  round: RoundView;
  live: LiveRoomApi;
  now: number;
  timing: RoundTiming | null;
  offline: boolean;
  showRoster: boolean;
}) {
  const skew = live.state.skew;
  const paused = game.paused;
  const remaining =
    !paused && round.deadlineAt !== null
      ? remainingMs(round.deadlineAt, now, skew)
      : (round.remainingMs ?? 0);
  const overdue = !paused && round.deadlineAt !== null && isOverdue(remaining);
  const timeUp = !paused && round.deadlineAt !== null && remaining <= 0;

  const [pending, setPending] = useState<{ roundId: string; choice: ThisOrThatChoice } | null>(
    null,
  );
  const [notice, setNotice] = useState<{ roundId: string; text: string; closed: boolean } | null>(
    null,
  );
  const pendingNow = pending && pending.roundId === round.id ? pending : null;
  const noticeNow = notice && notice.roundId === round.id ? notice : null;

  const locked = game.myChoice !== null && !game.allowAnswerChange;
  const canAnswer = !paused && !timeUp && !offline && !pendingNow && !locked;

  const pick = async (choice: ThisOrThatChoice) => {
    if (!canAnswer || choice === game.myChoice) return;
    setNotice(null);
    setPending({ roundId: round.id, choice });
    const outcome = await live.answer(round.id, choice);
    setPending(null);
    if (!outcome.ok) {
      setNotice({
        roundId: round.id,
        text: actionErrorText(outcome.code),
        closed: outcome.code === 'ROUND_CLOSED',
      });
    }
  };
  const [shortcuts] = useShortcutsEnabled();
  // 1 = A, 2 = B, 0 = Pass: only while focus is inside this panel (WCAG 2.1.4), never in
  // fields, and not at all when the player switched shortcuts off.
  const onPanelKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!shortcuts || isTypingTarget(event.target)) return;
    const choice = answerForKey(event.nativeEvent);
    if (!choice) return;
    event.preventDefault();
    void pick(choice);
  };

  const shown = pendingNow?.choice ?? game.myChoice;
  const status = answerStatus({
    myChoice: game.myChoice,
    pendingChoice: pendingNow?.choice ?? null,
    allowAnswerChange: game.allowAnswerChange,
    optionA: round.optionA,
    optionB: round.optionB,
  });
  const inertReason = paused
    ? 'Answers reopen when the host resumes.'
    : offline
      ? 'Waiting to reconnect.'
      : null;
  const choices: Array<{ choice: ThisOrThatChoice; badge: string; text: string; hint: string }> = [
    { choice: 'A', badge: 'A', text: round.optionA, hint: 'Press 1' },
    { choice: 'B', badge: 'B', text: round.optionB, hint: 'Press 2' },
    { choice: 'pass', badge: 'Pass', text: 'Pass', hint: 'Press 0' },
  ];
  const tabStop = shown ?? 'A';
  const fraction = timerFraction(remaining, timing?.totalMs ?? 0);

  const onRadioKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
    if (!keys.includes(event.key)) return;
    const radios = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
    const at = radios.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    radios[(at + step + radios.length) % radios.length]?.focus();
  };

  return (
    <div className="ff-phase grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
      <div
        data-testid="game-panel"
        onKeyDown={onPanelKey}
        className="mx-auto flex w-full max-w-[960px] flex-col gap-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-[10rem] flex-1">
            <RoundProgress number={round.number} total={round.total} />
          </div>
          <p className="ff-tnum flex items-center gap-2 font-semibold text-ff-ink order-3 w-full sm:order-none sm:w-auto sm:pt-1">
            <Users aria-hidden="true" className="size-5" />
            <span data-testid="answered-count">
              {answeredText(game.answeredCount, game.eligibleCount)}
            </span>
          </p>
          <Timer remaining={remaining} paused={paused} />
        </div>
        <div
          aria-hidden="true"
          className="motion-reduce:hidden h-1.5 w-full overflow-hidden rounded-full bg-ff-border"
        >
          <div
            className={`ff-timer-bar h-full rounded-full ${remaining <= 5000 && !paused ? 'bg-ff-coral-700' : 'bg-ff-violet-700'}`}
            style={{ width: `${Math.round(fraction * 100)}%` }}
          />
        </div>

        {paused && (
          <div className="flex items-start gap-3 rounded-ff-card border-2 border-ff-ink bg-ff-sun-50 p-4 text-ff-ink">
            <Pause aria-hidden="true" className="mt-1 size-6 shrink-0" />
            <div>
              <p className="font-heading text-lg font-bold">Host paused the game</p>
              <p>Timer stopped at {formatClock(remaining)}. Your answer is saved.</p>
            </div>
          </div>
        )}

        <h1
          data-live-heading
          tabIndex={-1}
          className="font-heading text-2xl leading-8 font-extrabold text-ff-ink md:text-center md:text-[30px] md:leading-[38px] lg:text-[40px] lg:leading-[46px]"
        >
          {round.question}
        </h1>

        <div
          role="radiogroup"
          aria-label="Your answer"
          onKeyDown={onRadioKey}
          className="flex flex-col gap-3"
        >
          <div className="grid gap-3 md:grid-cols-2">
            {choices.slice(0, 2).map((c, i) => (
              <ChoiceCard
                key={c.choice}
                {...c}
                index={i}
                shortcuts={shortcuts}
                selected={shown === c.choice}
                pending={pendingNow?.choice === c.choice}
                disabled={!canAnswer}
                focusable={tabStop === c.choice}
                onPick={(choice) => void pick(choice)}
              />
            ))}
          </div>
          <div className="md:mx-auto md:w-80">
            {choices.slice(2).map((c, i) => (
              <ChoiceCard
                key={c.choice}
                {...c}
                index={i + 2}
                shortcuts={shortcuts}
                selected={shown === c.choice}
                pending={pendingNow?.choice === c.choice}
                disabled={!canAnswer}
                focusable={tabStop === c.choice}
                onPick={(choice) => void pick(choice)}
              />
            ))}
            <p className="mt-1 text-center text-sm text-ff-muted">Passing is always fine.</p>
          </div>
        </div>
        {inertReason && (
          <p className="text-center text-sm font-semibold text-ff-ink">{inertReason}</p>
        )}

        <p
          role="status"
          aria-live="polite"
          data-testid="answer-status"
          className="flex items-center justify-center gap-2 text-center font-semibold text-ff-ink"
        >
          {status.kind === 'pending' && (
            <Loader2 aria-hidden="true" className="ff-spin size-5 shrink-0" />
          )}
          {(status.kind === 'locked' || status.kind === 'changeable') && (
            <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-ff-mint-700" />
          )}
          <span>{status.text}</span>
        </p>
        {overdue && (
          <p className="text-center font-semibold text-ff-ink">
            Time&apos;s up. Getting the results...
          </p>
        )}
        {noticeNow && (
          <Notice tone={noticeNow.closed ? 'info' : 'danger'} announce>
            {noticeNow.text}
          </Notice>
        )}
        <div className="flex flex-col items-center gap-1 text-center text-sm text-ff-muted">
          <p>Arrow keys move between choices. Space or Enter picks the focused choice.</p>
          {shortcuts && (
            <p className="hidden [@media(pointer:fine)]:block">
              Shortcuts while focus is here: 1 = A, 2 = B, 0 = Pass
            </p>
          )}
          <ShortcutsSwitch />
        </div>
      </div>
      {showRoster && (
        <div className="hidden md:block">
          <RosterCard participants={room.participants} meId={room.me.memberId} showReady={false} />
        </div>
      )}
    </div>
  );
}
