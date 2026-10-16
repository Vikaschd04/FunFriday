import type { NestExpressApplication } from '@nestjs/platform-express';
import { apiErrorSchema } from '@funfriday/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp } from './app-harness.js';
import { WEB_ORIGIN } from './identity-fixtures.js';

describe('global throttling', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await startApp({ webOrigins: [WEB_ORIGIN] });
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns 429 RATE_LIMITED after 300 requests/minute from one client, others unaffected', async () => {
    const server = app.getHttpServer();
    const hit = () => request(server).get('/api/v1/me').set('X-Forwarded-For', '198.51.100.7');
    const statuses: number[] = [];
    for (let i = 0; i < 302; i += 1) statuses.push((await hit()).status);
    expect(statuses.slice(0, 300).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(300)).toEqual([429, 429]);
    const limited = await hit();
    expect(apiErrorSchema.parse(limited.body).code).toBe('RATE_LIMITED');
    const other = await request(server).get('/api/v1/me').set('X-Forwarded-For', '198.51.100.8');
    expect(other.status).toBe(401);
  });

  it('never throttles health probes', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 350; i += 1) {
      const res = await request(server)
        .get('/api/v1/health/live')
        .set('X-Forwarded-For', '198.51.100.9');
      if (res.status !== 200) throw new Error(`health probe throttled at request ${i}`);
    }
  });
});
