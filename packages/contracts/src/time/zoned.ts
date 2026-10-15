/**
 * Time-zone helpers built on Intl only (no tz library). Event times are entered
 * as a wall-clock time in the host's IANA zone and stored as UTC instants.
 */

const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const DAY_MS = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Wall-clock `YYYY-MM-DDTHH:mm` of an instant in a zone. */
export function wallTimeInZone(epochMs: number, timeZone: string): string {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(epochMs)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Zone offset (ms, east positive) at an instant, minute precision. */
function offsetAt(epochMs: number, timeZone: string): number {
  const match = LOCAL_DATETIME.exec(wallTimeInZone(epochMs, timeZone));
  if (!match) throw new Error('unexpected Intl output');
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  const minuteFloor = Math.floor(epochMs / 60_000) * 60_000;
  return Date.UTC(y, mo - 1, d, h, mi) - minuteFloor;
}

export type ZonedConversion =
  | { ok: true; utcMs: number; ambiguous: boolean }
  | {
      ok: false;
      reason: 'invalid_format' | 'invalid_date' | 'invalid_time_zone' | 'nonexistent_local_time';
    };

/**
 * Converts a wall-clock time in `timeZone` to a UTC instant.
 * - Times skipped by a DST jump (e.g. 02:30 on spring-forward day) are rejected.
 * - Times repeated by a DST fall-back resolve to the EARLIER instant, flagged ambiguous.
 */
export function zonedWallTimeToUtc(local: string, timeZone: string): ZonedConversion {
  const match = LOCAL_DATETIME.exec(local);
  if (!match) return { ok: false, reason: 'invalid_format' };
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(asUtc);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d ||
    h > 23 ||
    mi > 59
  ) {
    return { ok: false, reason: 'invalid_date' };
  }
  if (!isValidTimeZone(timeZone)) return { ok: false, reason: 'invalid_time_zone' };

  // Offsets a day either side bracket any single DST transition near this time.
  const candidates = [
    ...new Set([
      asUtc - offsetAt(asUtc - DAY_MS, timeZone),
      asUtc - offsetAt(asUtc + DAY_MS, timeZone),
    ]),
  ]
    .filter((candidate) => wallTimeInZone(candidate, timeZone) === local)
    .sort((a, b) => a - b);

  const [first] = candidates;
  if (first === undefined) return { ok: false, reason: 'nonexistent_local_time' };
  return { ok: true, utcMs: first, ambiguous: candidates.length > 1 };
}
