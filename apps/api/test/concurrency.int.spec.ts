import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp } from './app-harness.js';
import { TEST_PASSWORD, WEB_ORIGIN, newAgent, nextIp, uniqueEmail } from './identity-fixtures.js';

/**
 * Regression for E2E 500s ("Connection terminated due to connection timeout"): scrypt password
 * hashing occupies the libuv thread pool, which the pg driver also needs (DNS) to open connections.
 */
describe('parallel sign-ups do not exhaust database connections', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await startApp({ webOrigins: [WEB_ORIGIN] });
  });
  afterAll(async () => {
    await app.close();
  });

  it('30 parallel sign-ups plus /me calls all succeed', async () => {
    const results = await Promise.all(
      Array.from({ length: 30 }, async (_, i) => {
        const agent = newAgent(app, nextIp());
        const signUp = await agent
          .post('/api/v1/auth/sign-up/email')
          .send({ name: `Parallel ${i}`, email: uniqueEmail('par'), password: TEST_PASSWORD });
        const me = await agent.get('/api/v1/me');
        return [signUp.status, me.status] as const;
      }),
    );
    expect(results.filter(([a, b]) => a !== 200 || b !== 200)).toEqual([]);
  });
});
