import { describe, expect, it } from 'vitest';
import { TimeoutError, summarizeReadiness, withTimeout } from './health.logic.js';

describe('summarizeReadiness', () => {
  it('is ready only when every dependency is up', () => {
    const up = { status: 'up' as const, latencyMs: 1 };
    const down = { status: 'down' as const, latencyMs: 2_000 };
    expect(summarizeReadiness({ database: up, redis: up })).toBe('ready');
    expect(summarizeReadiness({ database: up, redis: down })).toBe('not_ready');
    expect(summarizeReadiness({ database: down, redis: up })).toBe('not_ready');
  });
});

describe('withTimeout', () => {
  it('resolves with the work result when fast enough', async () => {
    await expect(withTimeout(Promise.resolve(42), 50)).resolves.toBe(42);
  });

  it('rejects with TimeoutError when the probe hangs', async () => {
    const never = new Promise<never>(() => undefined);
    await expect(withTimeout(never, 20)).rejects.toBeInstanceOf(TimeoutError);
  });
});
