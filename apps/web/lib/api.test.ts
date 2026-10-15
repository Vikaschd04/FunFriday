import { describe, expect, it } from 'vitest';
import { fetchReadiness } from './api';

const body = (status: 'ready' | 'not_ready', redis: 'up' | 'down' = 'up') => ({
  status,
  service: 'funfriday-api',
  version: '0.0.0',
  time: '2026-01-01T00:00:00.000Z',
  checks: {
    database: { status: 'up', latencyMs: 3 },
    redis: { status: redis, latencyMs: 1 },
  },
});

const json = (data: unknown, status: number) =>
  Promise.resolve(
    new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } }),
  );

const base = 'http://api.test/api/v1/';

describe('fetchReadiness', () => {
  it('returns ready for 200 with a valid body and calls the readiness URL', async () => {
    let calledUrl = '';
    const result = await fetchReadiness(base, {
      fetchImpl: ((url: string) => {
        calledUrl = url;
        return json(body('ready'), 200);
      }) as unknown as typeof fetch,
    });
    expect(calledUrl).toBe('http://api.test/api/v1/health/ready');
    expect(result.kind).toBe('ready');
  });

  it('returns not_ready with data for a 503 body', async () => {
    const result = await fetchReadiness(base, {
      fetchImpl: (() => json(body('not_ready', 'down'), 503)) as unknown as typeof fetch,
    });
    expect(result.kind).toBe('not_ready');
    if (result.kind === 'not_ready') expect(result.data.checks.redis.status).toBe('down');
  });

  it('returns unreachable on network failure', async () => {
    const result = await fetchReadiness(base, {
      fetchImpl: (() =>
        Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch,
    });
    expect(result).toEqual({ kind: 'unreachable' });
  });

  it('returns unreachable when the request times out', async () => {
    const result = await fetchReadiness(base, {
      timeoutMs: 20,
      fetchImpl: ((_u: string, init: RequestInit) =>
        new Promise((_res, rej) => {
          init.signal?.addEventListener('abort', () =>
            rej(new DOMException('aborted', 'AbortError')),
          );
        })) as unknown as typeof fetch,
    });
    expect(result).toEqual({ kind: 'unreachable' });
  });

  it('returns invalid_response for malformed JSON, schema mismatch, unexpected status or contradictory status', async () => {
    const run = (f: () => Promise<Response>) =>
      fetchReadiness(base, { fetchImpl: f as unknown as typeof fetch });
    expect(await run(() => Promise.resolve(new Response('<html>', { status: 200 })))).toEqual({
      kind: 'invalid_response',
    });
    expect(await run(() => json({ status: 'ready' }, 200))).toEqual({ kind: 'invalid_response' });
    expect(await run(() => json(body('ready'), 500))).toEqual({ kind: 'invalid_response' });
    expect(await run(() => json(body('ready'), 503))).toEqual({ kind: 'invalid_response' });
  });
});
