import { describe, expect, it } from 'vitest';
import {
  answerStatus,
  barRows,
  checkRoomCode,
  estimateMinutes,
  facilitationPrompt,
  normalizeRoomCode,
  phaseAnnouncement,
  phaseTitle,
  percentages,
  revealSentence,
  roundSummarySentence,
  sortRoster,
  spellCode,
  summaryHighlights,
} from './view-model';
import { uuid } from './fixtures';

const opts = { optionA: 'Sunrise', optionB: 'Sunset' };

describe('percentages', () => {
  it('always totals 100 (largest remainder)', () => {
    expect(percentages([1, 1, 1])).toEqual([34, 33, 33]);
    expect(percentages([11, 6, 1])).toEqual([61, 33, 6]);
    expect(percentages([0, 0, 0])).toEqual([0, 0, 0]);
    expect(percentages([5, 0, 0])).toEqual([100, 0, 0]);
  });
});

describe('revealSentence', () => {
  it('formats the spec examples', () => {
    expect(revealSentence({ a: 11, b: 6, pass: 1 }, opts)).toBe(
      '11 picked Sunrise, 6 picked Sunset, 1 passed.',
    );
    expect(revealSentence({ a: 7, b: 7, pass: 0 }, opts)).toBe('The room split evenly: 7 and 7.');
    expect(revealSentence({ a: 7, b: 0, pass: 0 }, opts)).toBe('7 picked Sunrise.');
    expect(revealSentence({ a: 0, b: 0, pass: 4 }, opts)).toBe(
      "Everyone passed - and that's fine.",
    );
    expect(revealSentence({ a: 0, b: 0, pass: 0 }, opts)).toBe('Nobody answered this round.');
  });
  it('states small-room results plainly - no false privacy claim', () => {
    expect(revealSentence({ a: 1, b: 1, pass: 0 }, opts)).not.toMatch(/private/i);
    expect(revealSentence({ a: 2, b: 1, pass: 0 }, opts)).toBe(
      '2 picked Sunrise, 1 picked Sunset.',
    );
  });
});

describe('barRows', () => {
  it('shows counts only for small rooms', () => {
    const rows = barRows({ a: 2, b: 1, pass: 0 }, opts, true);
    expect(rows.map((r) => r.percent)).toEqual([null, null, null]);
    expect(rows[0]?.spoken).toBe('Sunrise, 2 people');
    expect(rows[1]?.spoken).toBe('Sunset, 1 person');
  });
  it('adds percentages for larger rooms', () => {
    const rows = barRows({ a: 11, b: 6, pass: 1 }, opts, false);
    expect(rows[0]?.spoken).toBe('Sunrise, 11 people, 61 percent');
    expect(rows.reduce((s, r) => s + (r.percent ?? 0), 0)).toBe(100);
  });
});

describe('answerStatus', () => {
  const base = { optionA: 'Sunrise', optionB: 'Sunset', allowAnswerChange: false };
  it('covers none, pending, locked and changeable', () => {
    expect(answerStatus({ ...base, myChoice: null, pendingChoice: null }).text).toBe(
      'Pick one, or pass. Your answer stays private.',
    );
    expect(answerStatus({ ...base, myChoice: null, pendingChoice: 'A' }).kind).toBe('pending');
    expect(answerStatus({ ...base, myChoice: 'A', pendingChoice: null }).text).toBe(
      'Locked in: A, Sunrise. Waiting for everyone else.',
    );
    expect(answerStatus({ ...base, myChoice: 'pass', pendingChoice: null }).text).toBe(
      'Locked in: Pass. Waiting for everyone else.',
    );
    expect(
      answerStatus({ ...base, allowAnswerChange: true, myChoice: 'B', pendingChoice: null }).text,
    ).toBe('Your pick: B, Sunset. You can change it until time is up.');
  });
});

describe('room codes', () => {
  it('normalises pasted codes', () => {
    expect(normalizeRoomCode(' k7p 2qm ')).toBe('K7P2QM');
    expect(normalizeRoomCode('k7p-2qm')).toBe('K7P2QM');
  });
  it('validates against the unambiguous alphabet', () => {
    expect(checkRoomCode('k7p 2qm')).toEqual({ ok: true, code: 'K7P2QM' });
    expect(checkRoomCode('K7P2Q')).toMatchObject({ ok: false, ambiguousHint: false });
    expect(checkRoomCode('K7P2Q0')).toMatchObject({ ok: false, ambiguousHint: true });
  });
  it('spells the code for screen readers', () => {
    expect(spellCode('K7P2QM')).toBe('K, 7, P, 2, Q, M');
  });
});

describe('roster order', () => {
  it('puts the host first, me second, then alphabetical, regardless of presence', () => {
    const p = (n: number, name: string | null, isHost = false, connected = true) => ({
      memberId: uuid(n),
      name,
      isHost,
      connected,
      ready: false,
    });
    const sorted = sortRoster(
      [p(1, 'Zed'), p(2, 'Amy', false, false), p(3, 'Host', true), p(4, 'Me')],
      uuid(4),
    );
    expect(sorted.map((x) => x.name)).toEqual(['Host', 'Me', 'Amy', 'Zed']);
  });
});

describe('summary', () => {
  const summary = {
    rounds: [
      { number: 1, question: 'Q', optionA: 'Sunrise', optionB: 'Sunset', a: 18, b: 2, pass: 0 },
    ],
    mostUnited: { roundNumber: 1, question: 'Q', option: 'Sunrise', count: 18, answered: 20 },
    closestSplit: { roundNumber: 3, question: 'Q3', a: 10, b: 10 },
  };
  it('words the highlights from the spec', () => {
    const h = summaryHighlights(summary);
    expect(h.mostUnited?.text).toBe('18 of 20 picked Sunrise');
    expect(h.closestSplit?.text).toBe('Round 3 was 10 to 10');
  });
  it('suppresses counts in small rooms', () => {
    const h = summaryHighlights({
      ...summary,
      mostUnited: { roundNumber: 1, question: 'Q', option: 'Sunrise', count: 3, answered: 3 },
      closestSplit: { roundNumber: 2, question: 'Q', a: 2, b: 1 },
    });
    expect(h.mostUnited?.text).not.toMatch(/\d+ of/);
    expect(h.closestSplit?.text).toBe('Round 2 was the closest split');
    expect(roundSummarySentence({ ...summary.rounds[0]!, a: 2, b: 1 })).not.toMatch(/private/i);
  });
  it('returns null highlights when absent', () => {
    expect(summaryHighlights({ ...summary, mostUnited: null, closestSplit: null })).toEqual({
      mostUnited: null,
      closestSplit: null,
    });
  });
});

describe('misc', () => {
  it('estimates minutes and cycles facilitation prompts', () => {
    expect(estimateMinutes(6, 30)).toBe(5);
    expect(estimateMinutes(3, 15)).toBe(2);
    expect(facilitationPrompt(1)).toBe('Ask: anyone want to share why?');
    expect(facilitationPrompt(4)).toBe(facilitationPrompt(1));
  });
});

describe('phase copy', () => {
  it('has per-phase titles and announcements', () => {
    expect(phaseTitle('question', { number: 2, total: 5 })).toBe('Round 2 of 5 - FunFriday');
    expect(phaseTitle('reveal')).toBe('Results - FunFriday');
    expect(phaseTitle('finished')).toBe('Summary - FunFriday');
    expect(phaseAnnouncement('reveal')).toBe('Results are in');
    expect(phaseAnnouncement('finished')).toBe('Game finished');
  });
});
