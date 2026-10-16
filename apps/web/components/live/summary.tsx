'use client';

import { Heart, Lock, Scale } from 'lucide-react';
import type { ThisOrThatSummary } from '@funfriday/contracts';
import { Card, EmptyState } from '@funfriday/ui';
import {
  barRows,
  isSmallRoom,
  roundSummarySentence,
  summaryHighlights,
  totalOf,
} from '@/lib/live/view-model';
import { AppLinkButton } from '../app-link-button';
import { ResultRows } from './reveal';

const COLORS = [
  'var(--ff-violet-600)',
  'var(--ff-coral-500)',
  'var(--ff-mint-500)',
  'var(--ff-sun-400)',
];

function Burst() {
  return (
    <div
      aria-hidden="true"
      className="ff-confetti pointer-events-none absolute inset-x-0 top-0 h-64"
    >
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        return (
          <span
            key={i}
            style={{
              ['--i' as string]: i,
              ['--dx' as string]: `${Math.round(Math.cos(angle) * 140)}px`,
              ['--dy' as string]: `${Math.round(Math.sin(angle) * 90)}px`,
              background: COLORS[i % COLORS.length],
            }}
          />
        );
      })}
    </div>
  );
}

export function SummaryView({
  summary,
  canHost,
  readOnly,
}: {
  summary: ThisOrThatSummary;
  canHost: boolean;
  readOnly: boolean;
}) {
  const { mostUnited, closestSplit } = summaryHighlights(summary);
  const hostActions = canHost && !readOnly;
  return (
    <div className="ff-phase relative mx-auto flex w-full max-w-3xl flex-col gap-6">
      {!readOnly && <Burst />}
      <header className="relative">
        <h1
          data-live-heading
          tabIndex={-1}
          className="font-heading text-[30px] leading-9 font-extrabold tracking-tight text-ff-ink md:text-[40px] md:leading-[46px]"
        >
          That was a good one
        </h1>
        <p className="text-ff-muted">Here&apos;s how the room moved together.</p>
      </header>

      {summary.rounds.length === 0 ? (
        <EmptyState
          title="No rounds were played"
          body="The game ended before the first round finished."
        />
      ) : (
        <>
          {(mostUnited || closestSplit) && (
            <div className="grid gap-4 md:grid-cols-2">
              {mostUnited && (
                <section
                  aria-labelledby="united-h"
                  className="rounded-ff-card bg-ff-mint-50 p-5 text-ff-ink"
                >
                  <h2
                    id="united-h"
                    className="flex items-center gap-2 font-heading text-lg font-bold"
                  >
                    <Heart aria-hidden="true" className="size-5" /> Most united moment
                  </h2>
                  <p className="mt-2 text-xl font-bold">{mostUnited.text}</p>
                  <p className="text-sm">{mostUnited.detail}</p>
                  <p className="text-sm font-semibold">Round {mostUnited.round}</p>
                </section>
              )}
              {closestSplit && (
                <section
                  aria-labelledby="split-h"
                  className="rounded-ff-card bg-ff-sun-50 p-5 text-ff-ink"
                >
                  <h2
                    id="split-h"
                    className="flex items-center gap-2 font-heading text-lg font-bold"
                  >
                    <Scale aria-hidden="true" className="size-5" /> Closest split
                  </h2>
                  <p className="mt-2 text-xl font-bold">{closestSplit.text}</p>
                  <p className="text-sm">{closestSplit.detail}</p>
                </section>
              )}
            </div>
          )}
          <section aria-labelledby="rounds-h" className="flex flex-col gap-3">
            <h2
              id="rounds-h"
              className="font-heading text-[22px] leading-[30px] font-bold text-ff-ink"
            >
              Round by round
            </h2>
            <ol className="flex flex-col gap-3">
              {summary.rounds.map((round) => {
                const counts = { a: round.a, b: round.b, pass: round.pass };
                const small = isSmallRoom(totalOf(counts));
                return (
                  <li key={round.number}>
                    <Card as="article">
                      <h3 className="font-heading text-lg font-bold text-ff-ink">
                        Round {round.number}: {round.question}
                      </h3>
                      <p className="text-ff-ink">{roundSummarySentence(round)}</p>
                      <ResultRows
                        rows={barRows(counts, round, small)}
                        total={totalOf(counts)}
                        mine={null}
                      />
                    </Card>
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      )}

      <p className="flex items-center gap-2 text-sm text-ff-muted">
        <Lock aria-hidden="true" className="size-4 shrink-0" />
        Individual answers aren&apos;t saved. Only these totals are kept.
      </p>

      {!hostActions && !readOnly && (
        <div className="flex flex-col items-start gap-2">
          <AppLinkButton href="/app">Back to dashboard</AppLinkButton>
          <p className="text-sm text-ff-muted">
            The host may start another game - stay if you&apos;d like to play again.
          </p>
        </div>
      )}
    </div>
  );
}
