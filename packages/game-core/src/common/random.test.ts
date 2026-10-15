import { describe, expect, it } from 'vitest';
import { createSeededRandom } from './random.js';

describe('createSeededRandom', () => {
  it('produces an identical sequence for the same seed', () => {
    const a = createSeededRandom(2026);
    const b = createSeededRandom(2026);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    expect(Array.from({ length: 5 }, () => a.next())).not.toEqual(
      Array.from({ length: 5 }, () => b.next()),
    );
  });

  it('keeps next() within [0, 1)', () => {
    const rng = createSeededRandom(7);
    for (let i = 0; i < 10_000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('keeps int() within inclusive bounds and reaches both ends', () => {
    const rng = createSeededRandom(42);
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i += 1) {
      const value = rng.int(1, 6);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('shuffles deterministically without mutating the input', () => {
    const input = Object.freeze(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    const first = createSeededRandom(99).shuffle(input);
    const second = createSeededRandom(99).shuffle(input);
    expect(first).toEqual(second);
    expect([...first].sort()).toEqual([...input]);
    expect(input).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  });

  it('rejects invalid arguments', () => {
    expect(() => createSeededRandom(1.5)).toThrow(RangeError);
    expect(() => createSeededRandom(1).int(5, 1)).toThrow(RangeError);
  });
});
