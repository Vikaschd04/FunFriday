import { describe, expect, it } from 'vitest';
import { describeStatus } from './status-model';

const data = (redis: 'up' | 'down') => ({
  status: redis === 'up' ? ('ready' as const) : ('not_ready' as const),
  service: 'funfriday-api' as const,
  version: '1.2.3',
  time: '2026-01-01T00:00:00.000Z',
  checks: {
    database: { status: 'up' as const, latencyMs: 4 },
    redis: { status: redis, latencyMs: 9 },
  },
});

describe('describeStatus', () => {
  it('maps every outcome to a distinct tone', () => {
    expect(describeStatus(null).tone).toBe('loading');
    expect(describeStatus({ kind: 'ready', data: data('up') }).tone).toBe('ok');
    expect(describeStatus({ kind: 'not_ready', data: data('down') }).tone).toBe('degraded');
    expect(describeStatus({ kind: 'unreachable' }).tone).toBe('unreachable');
    expect(describeStatus({ kind: 'invalid_response' }).tone).toBe('invalid');
  });

  it('names the failing dependency and exposes version and latency', () => {
    const v = describeStatus({ kind: 'not_ready', data: data('down') });
    expect(v.detail).toContain('Realtime service');
    expect(v.detail).not.toContain('Database');
    expect(v.version).toBe('1.2.3');
    expect(v.dependencies.map((d) => d.latencyMs)).toEqual([4, 9]);
  });
});
