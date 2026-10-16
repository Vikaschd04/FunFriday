/**
 * Countdown maths. The server owns deadlines (absolute epoch ms); the browser only renders.
 * Remaining time is always recomputed from the absolute deadline, never decremented.
 */

export function remainingMs(deadlineAt: number, localNow: number, skew: number): number {
  return deadlineAt - (localNow + skew);
}

/** Whole seconds shown on screen (rounded up so "0:01" lasts until the deadline). */
export function secondsLeft(ms: number): number {
  return Math.max(0, Math.ceil(ms / 1000));
}

export function formatClock(ms: number): string {
  const total = secondsLeft(ms);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** The only moments announced to screen readers; never per second. */
export type TimerBucket = 'start' | 'ten' | 'five' | 'closed';

export function timerBucket(ms: number): TimerBucket {
  if (ms <= 0) return 'closed';
  if (ms <= 5000) return 'five';
  if (ms <= 10_000) return 'ten';
  return 'start';
}

export interface AnnouncementInput {
  roundNumber: number;
  roundTotal: number;
  totalMs: number;
  resumedAtSec: number | null;
  paused: boolean;
  bucket: TimerBucket;
}

/**
 * Pure text for the polite live region. The string only changes when the bucket, the round
 * or the pause state changes, so a screen reader hears 10s, 5s and close - nothing per tick.
 */
export function timerAnnouncement(input: AnnouncementInput): string {
  if (input.paused) return 'Game paused';
  switch (input.bucket) {
    case 'ten':
      return '10 seconds left';
    case 'five':
      return '5 seconds left';
    case 'closed':
      return "Time's up.";
    case 'start':
      return input.resumedAtSec !== null
        ? `Game resumed. ${input.resumedAtSec} seconds left.`
        : `Round ${input.roundNumber} of ${input.roundTotal}. ${Math.max(1, Math.round(input.totalMs / 1000))} seconds.`;
  }
}

/** Share of the round left, 0..1, for the cosmetic bar/ring. */
export function timerFraction(remaining: number, totalMs: number): number {
  if (totalMs <= 0) return 0;
  return Math.min(1, Math.max(0, remaining / totalMs));
}

/** True once local time is well past the deadline but the server has not moved on. */
export function isOverdue(remaining: number, graceMs = 1500): boolean {
  return remaining <= -graceMs;
}
