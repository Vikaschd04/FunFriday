import { describe, expect, it } from 'vitest';
import { TokenBucket } from './token-bucket.js';

describe('TokenBucket', () => {
  it('allows a burst up to capacity, then limits', () => {
    let t = 0;
    const bucket = new TokenBucket(20, 10, () => t);
    const results = Array.from({ length: 25 }, () => bucket.take());
    expect(results.filter(Boolean)).toHaveLength(20);
    expect(results.slice(20).every((ok) => !ok)).toBe(true);
    t += 1000; // 10 tokens refill per second
    expect(Array.from({ length: 12 }, () => bucket.take()).filter(Boolean)).toHaveLength(10);
  });

  it('never refills above capacity', () => {
    let t = 0;
    const bucket = new TokenBucket(3, 10, () => t);
    t += 60_000;
    expect(Array.from({ length: 5 }, () => bucket.take()).filter(Boolean)).toHaveLength(3);
  });
});
