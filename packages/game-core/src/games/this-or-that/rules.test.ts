import { thisOrThatConfigSchema, thisOrThatViewSchema } from '@funfriday/contracts';
import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../../common/random.js';
import type { GameParticipant } from '../../engine/types.js';
import { type ThisOrThatState, thisOrThatGame as game } from './rules.js';

const T0 = 1_760_000_000_000;
const people = (ids: string[], disconnected: string[] = []): GameParticipant[] =>
  ids.map((id) => ({ id, connected: !disconnected.includes(id) }));
const trio = people(['ana', 'ben', 'cy']);
const config = thisOrThatConfigSchema.parse({
  rounds: 3,
  roundSeconds: 30,
  allowAnswerChange: false,
});

function start(seed = 7, participants = trio, overrides = {}): ThisOrThatState {
  return game.init(thisOrThatConfigSchema.parse({ ...config, ...overrides }), {
    now: T0,
    participants,
    random: createSeededRandom(seed),
  });
}

function answer(
  state: ThisOrThatState,
  who: string,
  choice: 'A' | 'B' | 'pass',
  now = T0 + 1_000,
  participants = trio,
) {
  const roundId = state.rounds[state.roundIndex]!.id;
  return game.act(state, who, { type: 'answer', roundId, choice }, { now, participants });
}

const ok = <S>(result: { ok: true; state: S } | { ok: false; code: string }): S => {
  if (!result.ok) throw new Error(`expected ok, got ${result.code}`);
  return result.state;
};

describe('This or That - setup', () => {
  it('is deterministic for a seed and draws distinct prompts', () => {
    expect(start(42).rounds.map((r) => r.promptId)).toEqual(
      start(42).rounds.map((r) => r.promptId),
    );
    expect(start(42).rounds.map((r) => r.promptId)).not.toEqual(
      start(43).rounds.map((r) => r.promptId),
    );
    const ids = start(42, trio, { rounds: 10 }).rounds.map((r) => r.promptId);
    expect(new Set(ids).size).toBe(10);
  });

  it('opens round 1 with a server deadline', () => {
    const s = start();
    expect(s.phase).toBe('question');
    expect(s.rounds[0]!.deadlineAt).toBe(T0 + 30_000);
    expect(game.nextDeadline(s)).toBe(T0 + 30_000);
  });
});

describe('This or That - answering', () => {
  it('accepts one answer per person per round', () => {
    const s = ok(answer(start(), 'ana', 'A'));
    expect(answer(s, 'ana', 'B')).toEqual({ ok: false, code: 'DUPLICATE_ACTION' });
  });

  it('lets people change their answer before the deadline only when configured', () => {
    const s = ok(answer(start(7, trio, { allowAnswerChange: true }), 'ana', 'A'));
    const changed = ok(answer(s, 'ana', 'B'));
    expect(changed.rounds[0]!.answers.ana).toBe('B');
  });

  it('rejects answers at or after the deadline, for another round, or malformed', () => {
    const s = start();
    expect(answer(s, 'ana', 'A', T0 + 30_000)).toEqual({ ok: false, code: 'ROUND_CLOSED' });
    expect(
      game.act(
        s,
        'ana',
        { type: 'answer', roundId: 'r9-zzzz', choice: 'A' },
        { now: T0, participants: trio },
      ),
    ).toEqual({ ok: false, code: 'ROUND_CLOSED' });
    expect(
      game.act(
        s,
        'ana',
        { type: 'answer', roundId: s.rounds[0]!.id, choice: 'C' },
        { now: T0, participants: trio },
      ),
    ).toEqual({ ok: false, code: 'INVALID_ACTION' });
    expect(game.act(s, 'ana', 'A', { now: T0, participants: trio })).toEqual({
      ok: false,
      code: 'INVALID_ACTION',
    });
  });

  it('counts a pass and reveals early once everyone connected has answered', () => {
    let s = ok(answer(start(), 'ana', 'A'));
    s = ok(answer(s, 'ben', 'pass'));
    expect(s.phase).toBe('question');
    s = ok(answer(s, 'cy', 'B'));
    expect(s.phase).toBe('reveal');
    expect(game.view(s, 'ana', { now: T0, participants: trio }).reveal).toEqual({
      a: 1,
      b: 1,
      pass: 1,
    });
  });

  it('does not wait for disconnected people', () => {
    const present = people(['ana', 'ben', 'cy'], ['cy']);
    let s = ok(answer(start(7, present), 'ana', 'A', T0 + 1, present));
    s = ok(answer(s, 'ben', 'B', T0 + 2, present));
    expect(s.phase).toBe('reveal');
  });
});

describe('This or That - time and host controls', () => {
  it('reveals exactly at the deadline on tick', () => {
    const s = start();
    expect(game.tick(s, { now: T0 + 29_999, participants: trio })).toBe(s);
    expect(game.tick(s, { now: T0 + 30_000, participants: trio }).phase).toBe('reveal');
  });

  it('pause freezes the remaining time and resume restores it', () => {
    const paused = ok(game.control(start(), 'pause', { now: T0 + 10_000, participants: trio }));
    expect(paused.paused).toBe(true);
    expect(game.nextDeadline(paused)).toBeNull();
    expect(answer(paused, 'ana', 'A', T0 + 11_000)).toEqual({ ok: false, code: 'INVALID_ACTION' });
    expect(game.tick(paused, { now: T0 + 999_999, participants: trio })).toBe(paused);
    const resumed = ok(game.control(paused, 'resume', { now: T0 + 60_000, participants: trio }));
    expect(resumed.rounds[0]!.deadlineAt).toBe(T0 + 60_000 + 20_000);
  });

  it('close, next and finish; skipped rounds are left out of the summary', () => {
    let s = ok(answer(start(), 'ana', 'A'));
    s = ok(answer(s, 'ben', 'A'));
    s = ok(game.control(s, 'close_round', { now: T0 + 5_000, participants: trio }));
    expect(s.phase).toBe('reveal');
    s = ok(game.control(s, 'next_round', { now: T0 + 6_000, participants: trio }));
    expect(s.roundIndex).toBe(1);
    expect(s.rounds[1]!.deadlineAt).toBe(T0 + 36_000);
    s = ok(game.control(s, 'next_round', { now: T0 + 7_000, participants: trio })); // skip round 2
    s = ok(game.control(s, 'end_game', { now: T0 + 8_000, participants: trio }));
    expect(game.isFinished(s)).toBe(true);
    const summary = game.summarize(s);
    expect(summary.rounds.map((r) => r.number)).toEqual([1]);
    expect(game.control(s, 'next_round', { now: T0, participants: trio })).toEqual({
      ok: false,
      code: 'INVALID_ACTION',
    });
  });

  it('rejects controls that make no sense in the current phase', () => {
    const s = start();
    expect(game.control(s, 'resume', { now: T0, participants: trio })).toEqual({
      ok: false,
      code: 'INVALID_ACTION',
    });
    const revealed = ok(game.control(s, 'close_round', { now: T0, participants: trio }));
    expect(game.control(revealed, 'close_round', { now: T0, participants: trio })).toEqual({
      ok: false,
      code: 'INVALID_ACTION',
    });
    expect(game.control(revealed, 'pause', { now: T0, participants: trio })).toEqual({
      ok: false,
      code: 'INVALID_ACTION',
    });
  });
});

describe('This or That - timing fairness', () => {
  it('enforces at least 20 s per round and lets answers change by default', () => {
    expect(thisOrThatConfigSchema.safeParse({ roundSeconds: 15 }).success).toBe(false);
    expect(thisOrThatConfigSchema.parse({}).allowAnswerChange).toBe(true);
  });

  it('extend_round adds 15 s to a running question, to a paused one, and reopens an expired one', () => {
    const s = start();
    const extended = ok(game.control(s, 'extend_round', { now: T0 + 1_000, participants: trio }));
    expect(extended.rounds[0]!.deadlineAt).toBe(T0 + 30_000 + 15_000);
    const paused = ok(game.control(s, 'pause', { now: T0 + 10_000, participants: trio }));
    const pausedPlus = ok(
      game.control(paused, 'extend_round', { now: T0 + 11_000, participants: trio }),
    );
    expect(pausedPlus.rounds[0]!.remainingMs).toBe(20_000 + 15_000);
    const late = ok(game.control(s, 'extend_round', { now: T0 + 30_500, participants: trio }));
    expect(late.rounds[0]!.deadlineAt).toBe(T0 + 30_500 + 15_000);
    expect(ok(answer(late, 'ana', 'A', T0 + 31_000)).rounds[0]!.answers.ana).toBe('A');
  });

  it('cannot extend outside the question phase', () => {
    const revealed = ok(game.control(start(), 'close_round', { now: T0, participants: trio }));
    expect(game.control(revealed, 'extend_round', { now: T0, participants: trio })).toEqual({
      ok: false,
      code: 'INVALID_ACTION',
    });
  });
});

describe('This or That - privacy and views', () => {
  it('never tells anyone who chose what - only their own choice and counts', () => {
    let s = ok(answer(start(), 'ana', 'A'));
    s = ok(answer(s, 'ben', 'B'));
    for (const viewer of ['ana', 'ben', 'cy']) {
      const view = thisOrThatViewSchema.parse(
        game.view(s, viewer, { now: T0, participants: trio }),
      );
      const others = ['ana', 'ben', 'cy'].filter((id) => id !== viewer);
      const json = JSON.stringify(view);
      for (const other of others) expect(json).not.toContain(`"${other}"`);
      expect(view.answeredCount).toBe(2);
      expect(view.reveal).toBeNull();
    }
    expect(game.view(s, 'ana', { now: T0, participants: trio }).myChoice).toBe('A');
    expect(game.view(s, 'cy', { now: T0, participants: trio }).myChoice).toBeNull();
  });

  it('hides the deadline once the round is closed', () => {
    const revealed = ok(game.control(start(), 'close_round', { now: T0, participants: trio }));
    expect(
      game.view(revealed, 'ana', { now: T0, participants: trio }).round?.deadlineAt,
    ).toBeNull();
  });

  it('summary highlights the most united moment and the closest split', () => {
    const crowd = people(['p1', 'p2', 'p3', 'p4']);
    let s = start(3, crowd);
    // round 1: 4 x A (united)
    for (const id of ['p1', 'p2', 'p3', 'p4']) s = ok(answer(s, id, 'A', T0 + 1, crowd));
    s = ok(game.control(s, 'next_round', { now: T0 + 2, participants: crowd }));
    // round 2: 2 A / 2 B (closest split)
    for (const [id, c] of [
      ['p1', 'A'],
      ['p2', 'B'],
      ['p3', 'A'],
      ['p4', 'B'],
    ] as const)
      s = ok(answer(s, id, c, T0 + 3, crowd));
    s = ok(game.control(s, 'end_game', { now: T0 + 4, participants: crowd }));
    const summary = game.summarize(s);
    expect(summary.mostUnited).toMatchObject({ roundNumber: 1, count: 4, answered: 4 });
    expect(summary.closestSplit).toMatchObject({ roundNumber: 2, a: 2, b: 2 });
  });

  it('states survive a JSON round trip (Redis snapshots)', () => {
    const s = ok(answer(start(), 'ana', 'A'));
    const restored = JSON.parse(JSON.stringify(s)) as ThisOrThatState;
    expect(ok(answer(restored, 'ben', 'B'))).toEqual(ok(answer(s, 'ben', 'B')));
  });
});
