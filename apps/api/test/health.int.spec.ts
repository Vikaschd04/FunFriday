import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  apiErrorSchema,
  livenessResponseSchema,
  readinessResponseSchema,
} from '@funfriday/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp } from './app-harness.js';

describe('health endpoints against real Postgres + Redis', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await startApp({ webOrigins: ['http://localhost:3000'] });
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health/live returns the liveness contract with hardening headers', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    expect(livenessResponseSchema.parse(res.body).status).toBe('ok');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-request-id']).toMatch(/^[A-Za-z0-9._-]{1,64}$/);
  });

  it('GET /api/v1/health/ready reports ready when both dependencies respond', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    const body = readinessResponseSchema.parse(res.body);
    expect(body.status).toBe('ready');
    expect(body.checks.database.status).toBe('up');
    expect(body.checks.redis.status).toBe('up');
  });

  it('does not leak connection details in the readiness body', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready');
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/postgres|redis:\/\/|password|localhost|5432|6379/i);
  });

  it('returns the standard error envelope for unknown routes', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/does-not-exist').expect(404);
    const body = apiErrorSchema.parse(res.body);
    expect(body.code).toBe('NOT_FOUND');
    expect(body.requestId).toBe(res.headers['x-request-id']);
    expect(body.message).not.toContain('does-not-exist');
  });

  it('echoes a safe caller request id and replaces an unsafe one', async () => {
    const safe = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('x-request-id', 'trace-abc.123');
    expect(safe.headers['x-request-id']).toBe('trace-abc.123');

    const unsafe = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('x-request-id', '<script>alert(1)</script>');
    expect(unsafe.headers['x-request-id']).not.toContain('<');
  });

  it('allows CORS only for configured web origins', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('Origin', 'http://localhost:3000');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');

    const denied = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers malformed and oversized JSON with the standard envelope (400 / 413, not 500)', async () => {
    const malformed = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Content-Type', 'application/json')
      .send('{"name": oops');
    expect(malformed.status).toBe(400);
    expect(apiErrorSchema.parse(malformed.body).code).toBe('BAD_REQUEST');

    const oversized = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ name: 'x'.repeat(200_000) }));
    expect(oversized.status).toBe(413);
    expect(apiErrorSchema.parse(oversized.body).code).toBe('BAD_REQUEST');
  });

  it('does not serve routes outside the /api/v1 prefix', async () => {
    await request(app.getHttpServer()).get('/health/live').expect(404);
  });
});

describe('readiness when a dependency is unreachable', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    // Nothing listens on this port; ioredis fails fast (no offline queue).
    app = await startApp({ redisUrl: 'redis://127.0.0.1:6390' });
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns 503 not_ready, naming Redis as down while Postgres stays up', async () => {
    const started = Date.now();
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(503);
    const body = readinessResponseSchema.parse(res.body);
    expect(body.status).toBe('not_ready');
    expect(body.checks.redis.status).toBe('down');
    expect(body.checks.database.status).toBe('up');
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('keeps liveness green so orchestrators do not restart a healthy process', async () => {
    await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
  });
});
