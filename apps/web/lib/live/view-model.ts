import type { RoomParticipant, ThisOrThatChoice, ThisOrThatSummary } from '@funfriday/contracts';

/** Rooms with fewer than this many people show counts only (docs/games/this-or-that.md). */
export const SMALL_ROOM_LIMIT = 5;

export interface Counts {
  a: number;
  b: number;
  pass: number;
}

export function totalOf(counts: Counts): number {
  return counts.a + counts.b + counts.pass;
}

export function isSmallRoom(people: number): boolean {
  return people < SMALL_ROOM_LIMIT;
}

/** Largest-remainder rounding so the shown percentages always add up to 100 (0 when empty). */
export function percentages(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((v) => (v / total) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((sum, v) => sum + v, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((x, y) => y.remainder - x.remainder || x.index - y.index);
  for (const { index } of order) {
    if (left <= 0) break;
    floors[index] = (floors[index] ?? 0) + 1;
    left -= 1;
  }
  return floors;
}

export function people(count: number): string {
  return `${count} ${count === 1 ? 'person' : 'people'}`;
}

/**
 * The text sentence for a reveal (and each summary round). Never "majority"/"minority".
 * Small rooms get the same factual sentence: the counts are visible anyway, so claiming that
 * picks "stay private" would be untrue. Small rooms only drop percentages (see barRows).
 */
export function revealSentence(
  counts: Counts,
  options: { optionA: string; optionB: string },
): string {
  const total = totalOf(counts);
  if (total === 0) return 'Nobody answered this round.';
  if (counts.a === 0 && counts.b === 0) return "Everyone passed - and that's fine.";
  const passText = counts.pass > 0 ? `${counts.pass} passed` : null;
  if (counts.a === counts.b) {
    const base = `The room split evenly: ${counts.a} and ${counts.b}.`;
    return passText ? `${base} ${counts.pass} passed.` : base;
  }
  const parts: string[] = [];
  if (counts.a > 0) parts.push(`${counts.a} picked ${options.optionA}`);
  if (counts.b > 0) parts.push(`${counts.b} picked ${options.optionB}`);
  if (passText) parts.push(passText);
  return `${parts.join(', ')}.`;
}

export interface BarRow {
  key: 'a' | 'b' | 'pass';
  badge: 'A' | 'B' | 'Pass';
  label: string;
  count: number;
  /** null when percentages are suppressed (small rooms). */
  percent: number | null;
  /** Text read by assistive tech for this row. */
  spoken: string;
}

export function barRows(
  counts: Counts,
  options: { optionA: string; optionB: string },
  small: boolean,
): BarRow[] {
  const pct = percentages([counts.a, counts.b, counts.pass]);
  const raw: Array<Pick<BarRow, 'key' | 'badge' | 'label' | 'count'>> = [
    { key: 'a', badge: 'A', label: options.optionA, count: counts.a },
    { key: 'b', badge: 'B', label: options.optionB, count: counts.b },
    { key: 'pass', badge: 'Pass', label: 'Pass', count: counts.pass },
  ];
  return raw.map((row, index) => {
    const percent = small ? null : (pct[index] ?? 0);
    return {
      ...row,
      percent,
      spoken:
        percent === null
          ? `${row.label}, ${people(row.count)}`
          : `${row.label}, ${people(row.count)}, ${percent} percent`,
    };
  });
}

/** "A, Sunrise" / "B, Sunset" / "Pass". */
export function choiceLabel(
  choice: ThisOrThatChoice,
  options: { optionA: string; optionB: string },
): string {
  if (choice === 'A') return `A, ${options.optionA}`;
  if (choice === 'B') return `B, ${options.optionB}`;
  return 'Pass';
}

export type AnswerStatus =
  | { kind: 'none'; text: string }
  | { kind: 'pending'; text: string }
  | { kind: 'locked'; text: string }
  | { kind: 'changeable'; text: string };

export function answerStatus(input: {
  myChoice: ThisOrThatChoice | null;
  pendingChoice: ThisOrThatChoice | null;
  allowAnswerChange: boolean;
  optionA: string;
  optionB: string;
}): AnswerStatus {
  if (input.pendingChoice) return { kind: 'pending', text: 'Saving your answer...' };
  if (!input.myChoice)
    return { kind: 'none', text: 'Pick one, or pass. Your answer stays private.' };
  const label = choiceLabel(input.myChoice, input);
  return input.allowAnswerChange
    ? {
        kind: 'changeable',
        text: `Your pick: ${label}. You can change it until time is up.`,
      }
    : { kind: 'locked', text: `Locked in: ${label}. Waiting for everyone else.` };
}

/** Persistent announcer text for non-timer phases. */
export function phaseAnnouncement(phase: 'lobby' | 'reveal' | 'finished'): string {
  if (phase === 'reveal') return 'Results are in';
  if (phase === 'finished') return 'Game finished';
  return '';
}

/** Document title per phase (the layout template appends " - FunFriday"). */
export function phaseTitle(
  phase: 'joining' | 'lobby' | 'question' | 'reveal' | 'finished' | 'ended',
  round?: { number: number; total: number } | null,
): string {
  switch (phase) {
    case 'lobby':
      return 'Lobby - FunFriday';
    case 'question':
      return round ? `Round ${round.number} of ${round.total} - FunFriday` : 'Live - FunFriday';
    case 'reveal':
      return 'Results - FunFriday';
    case 'finished':
      return 'Summary - FunFriday';
    case 'ended':
      return 'Session ended - FunFriday';
    default:
      return 'Live - FunFriday';
  }
}

export function answeredText(answered: number, eligible: number): string {
  return eligible === 0 ? 'Waiting for people to join' : `${answered} of ${eligible} answered`;
}

const PROMPTS = [
  'Ask: anyone want to share why?',
  'Ask: what would change your pick?',
  'Ask: who has a favourite story about this?',
];

/** Static facilitation list cycled by round number (host only; never calls people out). */
export function facilitationPrompt(roundNumber: number): string {
  return PROMPTS[(Math.max(1, roundNumber) - 1) % PROMPTS.length] ?? PROMPTS[0] ?? '';
}

export function teammateName(name: string | null): string {
  return name?.trim() ? name.trim() : 'Teammate';
}

/** Host first, me second, then alphabetical. Stable: presence/ready never reorder rows. */
export function sortRoster(participants: RoomParticipant[], meId: string): RoomParticipant[] {
  const rank = (p: RoomParticipant): number => (p.isHost ? 0 : p.memberId === meId ? 1 : 2);
  return [...participants].sort(
    (x, y) =>
      rank(x) - rank(y) ||
      teammateName(x.name).localeCompare(teammateName(y.name)) ||
      x.memberId.localeCompare(y.memberId),
  );
}

export function rosterCounts(participants: RoomParticipant[]): {
  total: number;
  connected: number;
  ready: number;
} {
  return {
    total: participants.length,
    connected: participants.filter((p) => p.connected).length,
    ready: participants.filter((p) => p.ready).length,
  };
}

/** "About 4 minutes" = rounds x (seconds + 15), rounded, at least one minute. */
export function estimateMinutes(rounds: number, roundSeconds: number): number {
  return Math.max(1, Math.round((rounds * (roundSeconds + 15)) / 60));
}

// ---- room codes ----

export function normalizeRoomCode(raw: string): string {
  return raw.replace(/[\s-]+/g, '').toUpperCase();
}

const CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

export type CodeCheck =
  { ok: true; code: string } | { ok: false; message: string; ambiguousHint: boolean };

export function checkRoomCode(raw: string): CodeCheck {
  const code = normalizeRoomCode(raw);
  if (CODE_PATTERN.test(code)) return { ok: true, code };
  return {
    ok: false,
    message: 'Enter the 6-character code.',
    ambiguousHint: /[01OIL]/.test(code),
  };
}

/** "K7P2QM" -> "K, 7, P, 2, Q, M" for assistive tech. */
export function spellCode(code: string): string {
  return code.split('').join(', ');
}

// ---- copy for failures ----

export type ActionFailureCode = string;

export function actionErrorText(code: ActionFailureCode): string {
  switch (code) {
    case 'NOT_HOST':
      return 'Only the host can do that.';
    case 'ROUND_CLOSED':
      return "This round just closed, so that answer wasn't counted.";
    case 'INVALID_ACTION':
    case 'BAD_REQUEST':
      return "That answer isn't available.";
    case 'CONFLICT':
    case 'DUPLICATE_ACTION':
      return 'Your first answer is final this round.';
    case 'RATE_LIMITED':
      return 'Slow down a little and try again.';
    case 'offline':
      return 'Waiting to reconnect. Try again in a moment.';
    default:
      return "We couldn't save that - try again.";
  }
}

export function hostErrorText(code: ActionFailureCode): string {
  switch (code) {
    case 'NOT_HOST':
      return 'Only the host can do that.';
    case 'CONFLICT':
    case 'ROUND_CLOSED':
    case 'OUT_OF_SYNC':
    case 'INVALID_ACTION':
      return 'That already happened - the room is up to date.';
    case 'RATE_LIMITED':
      return 'One moment, then try again.';
    case 'offline':
      return 'Waiting to reconnect. Try again in a moment.';
    default:
      return "We couldn't save that - try again.";
  }
}

// ---- summary ----

export interface SummaryHighlights {
  mostUnited: { text: string; detail: string; round: number } | null;
  closestSplit: { text: string; detail: string; round: number } | null;
}

export function summaryHighlights(summary: ThisOrThatSummary): SummaryHighlights {
  const united = summary.mostUnited;
  const split = summary.closestSplit;
  return {
    mostUnited: united
      ? {
          round: united.roundNumber,
          detail: united.question,
          text: isSmallRoom(united.answered)
            ? `Round ${united.roundNumber} was where the room agreed most`
            : `${united.count} of ${united.answered} picked ${united.option}`,
        }
      : null,
    closestSplit: split
      ? {
          round: split.roundNumber,
          detail: split.question,
          text: isSmallRoom(split.a + split.b)
            ? `Round ${split.roundNumber} was the closest split`
            : `Round ${split.roundNumber} was ${split.a} to ${split.b}`,
        }
      : null,
  };
}

export function roundSummarySentence(round: ThisOrThatSummary['rounds'][number]): string {
  const counts = { a: round.a, b: round.b, pass: round.pass };
  return revealSentence(counts, round);
}
