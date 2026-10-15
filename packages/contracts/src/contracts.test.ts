import { describe, expect, it } from 'vitest';
import {
  apiErrorSchema,
  errorCodeSchema,
  livenessResponseSchema,
  readinessResponseSchema,
} from './index.js';

const ready = {
  status: 'ready',
  service: 'funfriday-api',
  version: '0.0.0',
  time: '2026-10-15T12:00:00.000Z',
  checks: {
    database: { status: 'up', latencyMs: 3 },
    redis: { status: 'up', latencyMs: 1 },
  },
};

describe('health contracts', () => {
  it('accepts a well-formed readiness body', () => {
    expect(readinessResponseSchema.parse(ready)).toEqual(ready);
  });

  it('rejects unknown dependency states and negative latency', () => {
    expect(
      readinessResponseSchema.safeParse({
        ...ready,
        checks: { ...ready.checks, redis: { status: 'flaky', latencyMs: 1 } },
      }).success,
    ).toBe(false);
    expect(
      readinessResponseSchema.safeParse({
        ...ready,
        checks: { ...ready.checks, database: { status: 'up', latencyMs: -1 } },
      }).success,
    ).toBe(false);
  });

  it('rejects a body from a different service', () => {
    expect(readinessResponseSchema.safeParse({ ...ready, service: 'other' }).success).toBe(false);
  });

  it('requires an ISO timestamp on liveness', () => {
    expect(
      livenessResponseSchema.safeParse({ status: 'ok', service: 'funfriday-api', time: 'now' })
        .success,
    ).toBe(false);
  });
});

describe('error envelope', () => {
  it('accepts canonical codes only', () => {
    expect(errorCodeSchema.safeParse('NOT_HOST').success).toBe(true);
    expect(errorCodeSchema.safeParse('TEAPOT').success).toBe(false);
  });

  it('requires requestId and a bounded message', () => {
    expect(
      apiErrorSchema.safeParse({ code: 'NOT_FOUND', message: 'Not found', requestId: 'r-1' })
        .success,
    ).toBe(true);
    expect(apiErrorSchema.safeParse({ code: 'NOT_FOUND', message: 'Not found' }).success).toBe(
      false,
    );
    expect(
      apiErrorSchema.safeParse({ code: 'NOT_FOUND', message: 'x'.repeat(501), requestId: 'r' })
        .success,
    ).toBe(false);
  });
});
