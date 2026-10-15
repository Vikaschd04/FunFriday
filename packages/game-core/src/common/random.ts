/**
 * Seeded pseudo-random generator for game rules.
 *
 * Game transitions must be reproducible from (state, action, seed) so that the
 * server can replay rounds, tests can assert exact outcomes, and two servers
 * given the same inputs agree. Never use Math.random() inside game-core.
 *
 * Algorithm: mulberry32 (32-bit state). Not cryptographically secure - do not
 * use for tokens, invite codes or anything security-sensitive.
 */
export interface SeededRandom {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Returns a new array; the input is not mutated. */
  shuffle<T>(items: readonly T[]): T[];
}

export function createSeededRandom(seed: number): SeededRandom {
  if (!Number.isInteger(seed)) {
    throw new RangeError('seed must be an integer');
  }
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError('int(min, max) requires integers with min <= max');
    }
    return min + Math.floor(next() * (max - min + 1));
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = int(0, i);
      [result[i], result[j]] = [result[j] as T, result[i] as T];
    }
    return result;
  };

  return { next, int, shuffle };
}
