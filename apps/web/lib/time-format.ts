import { wallTimeInZone, zonedWallTimeToUtc } from '@funfriday/contracts';

/** "Fri 24 Oct 2026" for a calendar date given as `YYYY-MM-DD...` (no zone conversion). */
export function formatCalendarDate(local: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(local);
  if (!match) return '';
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
    .format(Date.UTC(y, m - 1, d))
    .replace(',', '');
}

/** "15:00" from a `YYYY-MM-DDTHH:mm` wall time. */
export function clockOf(local: string): string {
  return local.slice(11, 16);
}

/** "Fri 24 Oct 2026, 15:00" from a wall time; empty when incomplete. */
export function formatWallTime(local: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return '';
  return `${formatCalendarDate(local)}, ${clockOf(local)}`;
}

function offsetMinutes(epochMs: number, timeZone: string): number {
  const wall = wallTimeInZone(epochMs, timeZone);
  const [y, mo, d, h, mi] = wall.split(/[-T:]/).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  return Math.round(
    (Date.UTC(y, mo - 1, d, h, mi) - Math.floor(epochMs / 60_000) * 60_000) / 60_000,
  );
}

const DAY = 86_400_000;

/** True when a UTC offset change falls within 24h before the start or after the end. */
export function nearClockChange(
  startMs: number,
  durationMinutes: number,
  timeZone: string,
): boolean {
  const endMs = startMs + durationMinutes * 60_000;
  const offsets = [startMs - DAY, startMs, endMs, endMs + DAY].map((t) =>
    offsetMinutes(t, timeZone),
  );
  return new Set(offsets).size > 1;
}

export interface AgendaRow {
  kind: 'activity' | 'transition';
  slug?: string;
  minutes: number;
  /** Wall time `YYYY-MM-DDTHH:mm` in the event zone. */
  start: string;
  end: string;
  /** Same instants in the viewer's zone, only when it differs from the event zone. */
  viewerStart?: string;
  viewerEnd?: string;
}

export interface AgendaResult {
  ok: true;
  rows: AgendaRow[];
  eventStart: string;
  eventEnd: string;
  viewerEventStart?: string;
  viewerEventEnd?: string;
  ambiguous: boolean;
  nearClockChange: boolean;
}

export function buildAgenda(
  input: {
    startsAtLocal: string;
    timeZone: string;
    durationMinutes: number;
    activities: ReadonlyArray<{ slug: string; minutes: number }>;
  },
  viewerZone: string | null,
  transitionMinutes: number,
): AgendaResult | { ok: false } {
  const converted = zonedWallTimeToUtc(input.startsAtLocal, input.timeZone);
  if (!converted.ok) return { ok: false };
  const differs = viewerZone !== null && viewerZone !== input.timeZone;
  const at = (ms: number, zone: string) => wallTimeInZone(ms, zone);
  const stamp = (
    startMs: number,
    endMs: number,
    row: Omit<AgendaRow, 'start' | 'end'>,
  ): AgendaRow => ({
    ...row,
    start: at(startMs, input.timeZone),
    end: at(endMs, input.timeZone),
    ...(differs ? { viewerStart: at(startMs, viewerZone), viewerEnd: at(endMs, viewerZone) } : {}),
  });

  const rows: AgendaRow[] = [];
  let cursor = converted.utcMs;
  input.activities.forEach((activity, index) => {
    const end = cursor + activity.minutes * 60_000;
    rows.push(
      stamp(cursor, end, { kind: 'activity', slug: activity.slug, minutes: activity.minutes }),
    );
    cursor = end;
    if (index < input.activities.length - 1) {
      const next = cursor + transitionMinutes * 60_000;
      rows.push(stamp(cursor, next, { kind: 'transition', minutes: transitionMinutes }));
      cursor = next;
    }
  });
  const eventEndMs = converted.utcMs + input.durationMinutes * 60_000;
  return {
    ok: true,
    rows,
    eventStart: at(converted.utcMs, input.timeZone),
    eventEnd: at(eventEndMs, input.timeZone),
    ...(differs
      ? {
          viewerEventStart: at(converted.utcMs, viewerZone),
          viewerEventEnd: at(eventEndMs, viewerZone),
        }
      : {}),
    ambiguous: converted.ambiguous,
    nearClockChange: nearClockChange(converted.utcMs, input.durationMinutes, input.timeZone),
  };
}
