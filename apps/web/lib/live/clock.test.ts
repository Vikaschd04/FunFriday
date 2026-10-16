import { describe, expect, it } from 'vitest';
import {
  formatClock,
  isOverdue,
  remainingMs,
  secondsLeft,
  timerAnnouncement,
  timerBucket,
  timerFraction,
} from './clock';
import { IntentIds, isRetryable } from './intents';

describe('countdown', () => {
  it('uses the absolute deadline corrected by skew', () => {
    // Server is 2s ahead of this browser.
    expect(remainingMs(100_000, 90_000, 2_000)).toBe(8_000);
    expect(remainingMs(100_000, 90_000, -2_000)).toBe(12_000);
  });
  it('rounds up for display and never goes negative', () => {
    expect(secondsLeft(24_001)).toBe(25);
    expect(secondsLeft(-5)).toBe(0);
    expect(formatClock(24_000)).toBe('0:24');
    expect(formatClock(61_000)).toBe('1:01');
    expect(formatClock(0)).toBe('0:00');
  });
  it('buckets only at 10s, 5s and close', () => {
    expect(timerBucket(30_000)).toBe('start');
    expect(timerBucket(10_001)).toBe('start');
    expect(timerBucket(10_000)).toBe('ten');
    expect(timerBucket(5_000)).toBe('five');
    expect(timerBucket(1)).toBe('five');
    expect(timerBucket(0)).toBe('closed');
    expect(timerBucket(-400)).toBe('closed');
  });
  it('announcement text is stable within a bucket', () => {
    const base = {
      roundNumber: 3,
      roundTotal: 5,
      totalMs: 30_000,
      resumedAtSec: null,
      paused: false,
    };
    expect(timerAnnouncement({ ...base, bucket: 'start' })).toBe('Round 3 of 5. 30 seconds.');
    expect(timerAnnouncement({ ...base, bucket: 'ten' })).toBe('10 seconds left');
    expect(timerAnnouncement({ ...base, bucket: 'five' })).toBe('5 seconds left');
    expect(timerAnnouncement({ ...base, bucket: 'closed' })).toBe("Time's up.");
    expect(timerAnnouncement({ ...base, paused: true, bucket: 'start' })).toBe('Game paused');
    expect(timerAnnouncement({ ...base, resumedAtSec: 17, bucket: 'start' })).toBe(
      'Game resumed. 17 seconds left.',
    );
  });
  it('fraction and overdue helpers', () => {
    expect(timerFraction(15_000, 30_000)).toBe(0.5);
    expect(timerFraction(40_000, 30_000)).toBe(1);
    expect(timerFraction(5, 0)).toBe(0);
    expect(isOverdue(-1_499)).toBe(false);
    expect(isOverdue(-1_500)).toBe(true);
  });
});

describe('IntentIds', () => {
  it('reuses an id until the intent is settled', () => {
    let n = 0;
    const ids = new IntentIds(() => `id-${++n}`);
    const first = ids.idFor('answer:r1:A');
    expect(ids.idFor('answer:r1:A')).toBe(first);
    expect(ids.idFor('answer:r1:B')).not.toBe(first);
    ids.settle('answer:r1:A');
    expect(ids.idFor('answer:r1:A')).not.toBe(first);
  });
  it('knows which failures are worth retrying with the same id', () => {
    expect(isRetryable('SERVICE_UNAVAILABLE')).toBe(true);
    expect(isRetryable('timeout')).toBe(true);
    expect(isRetryable('ROUND_CLOSED')).toBe(false);
    expect(isRetryable('NOT_HOST')).toBe(false);
  });
});
