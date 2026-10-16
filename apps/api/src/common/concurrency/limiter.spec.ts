import { describe, expect, it } from 'vitest';
import { createLimiter } from './limiter.js';

describe('createLimiter', () => {
  it('never runs more than max tasks at once and finishes them all in order', async () => {
    const limit = createLimiter(2);
    let running = 0;
    let peak = 0;
    const order: number[] = [];
    await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        limit(async () => {
          running += 1;
          peak = Math.max(peak, running);
          await new Promise((resolve) => setTimeout(resolve, 5));
          running -= 1;
          order.push(i);
        }),
      ),
    );
    expect(peak).toBe(2);
    expect(order).toHaveLength(6);
  });

  it('releases the slot when a task throws', async () => {
    const limit = createLimiter(1);
    await expect(limit(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(limit(() => Promise.resolve('ok'))).resolves.toBe('ok');
  });
});
