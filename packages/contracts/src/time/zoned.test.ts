import { describe, expect, it } from 'vitest';
import { isValidTimeZone, wallTimeInZone, zonedWallTimeToUtc } from './zoned.js';

const iso = (ms: number) => new Date(ms).toISOString();

describe('zonedWallTimeToUtc', () => {
  it('handles half-hour offsets (Asia/Kolkata, UTC+5:30)', () => {
    const result = zonedWallTimeToUtc('2026-10-16T16:00', 'Asia/Kolkata');
    expect(result.ok && iso(result.utcMs)).toBe('2026-10-16T10:30:00.000Z');
  });

  it('applies summer time (Europe/London BST)', () => {
    const result = zonedWallTimeToUtc('2026-07-01T09:00', 'Europe/London');
    expect(result.ok && iso(result.utcMs)).toBe('2026-07-01T08:00:00.000Z');
  });

  it('rejects a wall time skipped by spring-forward (New York, 2026-03-08 02:30)', () => {
    expect(zonedWallTimeToUtc('2026-03-08T02:30', 'America/New_York')).toEqual({
      ok: false,
      reason: 'nonexistent_local_time',
    });
  });

  it('resolves a repeated fall-back wall time to the earlier instant and flags it', () => {
    const result = zonedWallTimeToUtc('2026-11-01T01:30', 'America/New_York');
    expect(result).toEqual({
      ok: true,
      utcMs: Date.parse('2026-11-01T05:30:00Z'),
      ambiguous: true,
    });
  });

  it('round-trips an ordinary time with ambiguous=false', () => {
    const result = zonedWallTimeToUtc('2026-12-04T17:00', 'America/Los_Angeles');
    expect(result).toEqual({
      ok: true,
      utcMs: Date.parse('2026-12-05T01:00:00Z'),
      ambiguous: false,
    });
    if (result.ok)
      expect(wallTimeInZone(result.utcMs, 'America/Los_Angeles')).toBe('2026-12-04T17:00');
  });

  it.each([
    ['2026-02-30T10:00', 'invalid_date'],
    ['2026-13-01T10:00', 'invalid_date'],
    ['2026-01-01T24:00', 'invalid_date'],
    ['2026-01-01 10:00', 'invalid_format'],
    ['tomorrow', 'invalid_format'],
  ])('rejects %s as %s', (local, reason) => {
    expect(zonedWallTimeToUtc(local, 'UTC')).toEqual({ ok: false, reason });
  });

  it('rejects unknown time zones', () => {
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(zonedWallTimeToUtc('2026-01-01T10:00', 'Mars/Olympus_Mons')).toEqual({
      ok: false,
      reason: 'invalid_time_zone',
    });
  });
});
