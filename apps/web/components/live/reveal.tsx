'use client';

import { Check, Lightbulb } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { RoomView, ThisOrThatView } from '@funfriday/contracts';
import { Card } from '@funfriday/ui';
import {
  barRows,
  facilitationPrompt,
  isSmallRoom,
  revealSentence,
  totalOf,
  type BarRow,
} from '@/lib/live/view-model';
import { RoundProgress } from './game';
import { RosterCard } from './roster';
import { prefersReducedMotion } from './use-now';

/** Counts up to `value` over 480ms; shows the final number at once under reduced motion. */
export function CountUp({ value, delayMs = 0 }: { value: number; delayMs?: number }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  useEffect(() => {
    if (prefersReducedMotion()) {
      const id = requestAnimationFrame(() => {
        setShown(value);
      });
      return () => {
        cancelAnimationFrame(id);
      };
    }
    let frame = 0;
    const startAt = performance.now() + delayMs;
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - startAt) / 480));
      setShown(Math.round(value * (1 - (1 - p) * (1 - p))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [value, delayMs]);
  return <span className="ff-tnum">{shown}</span>;
}

export function ResultRows({
  rows,
  total,
  mine,
}: {
  rows: BarRow[];
  total: number;
  mine: 'A' | 'B' | 'pass' | null;
}) {
  const mineKey = mine === 'A' ? 'a' : mine === 'B' ? 'b' : mine === 'pass' ? 'pass' : null;
  return (
    <ul className="flex flex-col gap-3" data-testid="results">
      {rows.map((row, i) => {
        const width = row.percent ?? (total > 0 ? Math.round((row.count / total) * 100) : 0);
        const isMine = mineKey === row.key;
        return (
          <li key={row.key} data-row={row.key} className="flex flex-col gap-1.5">
            <span className="sr-only">
              {row.spoken}
              {isMine ? '. Your pick.' : ''}
            </span>
            <div aria-hidden="true" className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex min-w-9 items-center justify-center rounded-full px-2 py-0.5 text-sm font-extrabold ${
                  row.key === 'a'
                    ? 'bg-ff-violet-700 text-white'
                    : row.key === 'b'
                      ? 'bg-ff-coral-700 text-white'
                      : 'border border-dashed border-ff-border-strong text-ff-ink'
                }`}
              >
                {row.badge}
              </span>
              <span className="font-semibold text-ff-ink">
                {row.key === 'pass' ? '' : row.label}
              </span>
              {isMine && (
                <span className="inline-flex items-center gap-1 rounded-full bg-ff-ink px-2 py-0.5 text-xs font-semibold text-white">
                  <Check className="size-3.5" /> Your pick
                </span>
              )}
              <span className="ff-tnum ml-auto font-bold text-ff-ink">
                <CountUp value={row.count} delayMs={i * 80} />
                {row.percent !== null && (
                  <>
                    {' - '}
                    <CountUp value={row.percent} delayMs={i * 80} />%
                  </>
                )}
              </span>
            </div>
            <div
              aria-hidden="true"
              className="h-10 overflow-hidden rounded-[12px] border border-ff-border-strong bg-ff-surface"
            >
              <div
                className={`ff-bar-fill h-full ${row.key === 'a' ? 'ff-bar-a' : row.key === 'b' ? 'ff-bar-b' : 'ff-bar-pass'}`}
                style={{ width: `${width}%`, ['--ff-i' as string]: i }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function RevealView({
  room,
  game,
  canHost,
  showRoster,
}: {
  room: RoomView;
  game: ThisOrThatView;
  canHost: boolean;
  showRoster: boolean;
}) {
  const round = game.round;
  const reveal = game.reveal;
  if (!round || !reveal) return null;
  const small = isSmallRoom(game.eligibleCount);
  const options = { optionA: round.optionA, optionB: round.optionB };
  const rows = barRows(reveal, options, small);
  const sentence = revealSentence(reveal, options);
  const last = round.number >= round.total;
  return (
    <div className="ff-phase grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5">
        <div>
          <RoundProgress number={round.number} total={round.total} />
          <p className="mt-1 text-sm font-semibold text-ff-muted">Results</p>
        </div>
        <h1 className="font-heading text-2xl leading-8 font-bold text-ff-ink">{round.question}</h1>
        <h2
          data-live-heading
          tabIndex={-1}
          className="ff-phase font-heading text-[28px] leading-9 font-extrabold text-ff-ink md:text-[34px] md:leading-[42px]"
        >
          {sentence}
        </h2>
        <Card>
          <ResultRows rows={rows} total={totalOf(reveal)} mine={game.myChoice} />
        </Card>
        {canHost ? (
          <div className="flex items-start gap-3 rounded-ff-card bg-ff-sun-50 p-4 text-ff-ink">
            <Lightbulb aria-hidden="true" className="mt-1 size-6 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Conversation starter (only you can see this)</p>
              <p className="font-heading text-lg font-bold">{facilitationPrompt(round.number)}</p>
              <p className="text-sm">Invite, don&apos;t call people out.</p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-ff-muted">Talk it over - speaking is always optional.</p>
            <p className="font-semibold text-ff-ink">
              {last
                ? 'Waiting for the host to wrap up.'
                : 'Waiting for the host to start the next round.'}
            </p>
          </>
        )}
      </div>
      {showRoster && (
        <div className="hidden md:block">
          <RosterCard participants={room.participants} meId={room.me.memberId} showReady={false} />
        </div>
      )}
    </div>
  );
}
