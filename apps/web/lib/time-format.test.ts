import { describe, expect, it } from 'vitest';
import {
  buildAgenda,
  clockOf,
  formatCalendarDate,
  formatWallTime,
  nearClockChange,
} from './time-format';
import { zonedWallTimeToUtc } from '@funfriday/contracts';

describe('formatting', () => {
  it('formats calendar dates and wall times without zone conversion', () => {
    expect(formatCalendarDate('2026-10-23T15:00')).toBe('Fri 23 Oct 2026');
    expect(formatWallTime('2026-10-23T15:00')).toBe('Fri 23 Oct 2026, 15:00');
    expect(clockOf('2026-10-23T15:05')).toBe('15:05');
    expect(formatWallTime('')).toBe('');
    expect(formatCalendarDate('nope')).toBe('');
  });
});

describe('buildAgenda', () => {
  const base = {
    startsAtLocal: '2026-10-23T15:00',
    timeZone: 'Europe/London',
    durationMinutes: 45,
    activities: [
      { slug: 'a', minutes: 10 },
      { slug: 'b', minutes: 12 },
      { slug: 'c', minutes: 8 },
    ],
  };

  it('lays out activities with transitions between them', () => {
    const agenda = buildAgenda(base, null, 2);
    expect(agenda.ok).toBe(true);
    if (!agenda.ok) return;
    expect(agenda.rows.map((r) => `${r.kind}:${r.start.slice(11)}-${r.end.slice(11)}`)).toEqual([
      'activity:15:00-15:10',
      'transition:15:10-15:12',
      'activity:15:12-15:24',
      'transition:15:24-15:26',
      'activity:15:26-15:34',
    ]);
    expect(agenda.eventEnd.slice(11)).toBe('15:45');
    expect(agenda.viewerEventStart).toBeUndefined();
  });

  it('includes the viewer zone when it differs', () => {
    const agenda = buildAgenda(base, 'America/New_York', 2);
    if (!agenda.ok) throw new Error('expected ok');
    // BST ends 25 Oct 2026, so 23 Oct London = UTC+1; New York is UTC-4: 5 hours earlier.
    expect(agenda.viewerEventStart?.slice(11)).toBe('10:00');
    const same = buildAgenda(base, 'Europe/London', 2);
    if (!same.ok) throw new Error('expected ok');
    expect(same.viewerEventStart).toBeUndefined();
  });

  it('rejects skipped wall times', () => {
    expect(
      buildAgenda(
        { ...base, timeZone: 'America/New_York', startsAtLocal: '2026-03-08T02:30' },
        null,
        2,
      ),
    ).toEqual({
      ok: false,
    });
  });

  it('flags ambiguous fall-back times', () => {
    const agenda = buildAgenda(
      { ...base, timeZone: 'America/New_York', startsAtLocal: '2026-11-01T01:30' },
      null,
      2,
    );
    expect(agenda.ok && agenda.ambiguous).toBe(true);
  });
});

describe('nearClockChange', () => {
  it('is true within a day of a transition and false otherwise', () => {
    const start = (local: string, zone: string) => {
      const r = zonedWallTimeToUtc(local, zone);
      if (!r.ok) throw new Error('bad');
      return r.utcMs;
    };
    expect(
      nearClockChange(start('2026-03-07T20:00', 'America/New_York'), 120, 'America/New_York'),
    ).toBe(true);
    expect(nearClockChange(start('2026-10-23T15:00', 'Europe/London'), 45, 'Europe/London')).toBe(
      false,
    );
    expect(nearClockChange(start('2026-10-23T15:00', 'UTC'), 45, 'UTC')).toBe(false);
  });
});
