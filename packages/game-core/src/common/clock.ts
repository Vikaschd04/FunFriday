/**
 * Time source injected into game rules. Rules read time only through a Clock so
 * that deadlines are server-authoritative and tests can control time exactly.
 */
export interface Clock {
  /** Milliseconds since the Unix epoch. */
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export interface ManualClock extends Clock {
  advance(ms: number): void;
  set(epochMs: number): void;
}

/** Deterministic clock for tests and replays. */
export function createManualClock(startEpochMs: number): ManualClock {
  let current = startEpochMs;
  return {
    now: () => current,
    advance: (ms) => {
      if (ms < 0) throw new RangeError('cannot move a clock backwards with advance()');
      current += ms;
    },
    set: (epochMs) => {
      current = epochMs;
    },
  };
}

/** True once the server clock has reached or passed the deadline. */
export function isDeadlinePassed(clock: Clock, deadlineEpochMs: number): boolean {
  return clock.now() >= deadlineEpochMs;
}
