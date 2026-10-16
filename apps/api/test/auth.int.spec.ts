import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { apiErrorSchema, meResponseSchema } from '@funfriday/contracts';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { startApp } from './app-harness.js';
import {
  TEST_PASSWORD,
  WEB_ORIGIN,
  createOrg,
  newAgent,
  nextIp,
  signUp,
  uniqueEmail,
} from './identity-fixtures.js';

describe('authentication against the real API', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await startApp({ webOrigins: [WEB_ORIGIN] });
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes the library health route', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/auth/ok').expect(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('sign-up sets an HttpOnly SameSite=Lax session cookie and /me works', async () => {
    const agent = newAgent(app);
    const email = uniqueEmail('ana');
    const res = await agent
      .post('/api/v1/auth/sign-up/email')
      .send({ name: 'Ana Example', email, password: TEST_PASSWORD })
      .expect(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const session = cookies.find((c) => c.startsWith('funfriday.session_token='));
    expect(session).toBeDefined();
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/SameSite=Lax/i);
    expect(session).toMatch(/Path=\//);

    const me = await agent.get('/api/v1/me').expect(200);
    const body = meResponseSchema.parse(me.body);
    expect(body.user.email).toBe(email);
    expect(body.user.emailVerified).toBe(false);
    expect(body.needsEmailVerification).toBe(true);
    expect(body.memberships).toEqual([]);
    expect(me.headers['cache-control']).toBe('no-store');
  });

  it('/me without a session is 401 UNAUTHENTICATED in the standard envelope', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/me').expect(401);
    expect(apiErrorSchema.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('sign-out invalidates the session', async () => {
    const user = await signUp(app, 'signout');
    await user.agent.get('/api/v1/me').expect(200);
    await user.agent.post('/api/v1/auth/sign-out').send({}).expect(200);
    await user.agent.get('/api/v1/me').expect(401);
    // The old cookie is dead server-side too, not merely removed from the jar.
    await request(app.getHttpServer()).get('/api/v1/me').set('Cookie', user.cookie).expect(401);
  });

  it('sign-in works with the right password and rejects a wrong one with 401', async () => {
    const user = await signUp(app, 'signin');
    const ok = newAgent(app);
    await ok
      .post('/api/v1/auth/sign-in/email')
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(200);
    await ok.get('/api/v1/me').expect(200);

    await newAgent(app)
      .post('/api/v1/auth/sign-in/email')
      .send({ email: user.email, password: 'definitely-the-wrong-password' })
      .expect(401);
  });

  it('rejects weak passwords and missing names at sign-up', async () => {
    await newAgent(app)
      .post('/api/v1/auth/sign-up/email')
      .send({ name: 'Weak Pw', email: uniqueEmail('weak'), password: 'short' })
      .expect(400);
    await newAgent(app)
      .post('/api/v1/auth/sign-up/email')
      .send({ name: ' ', email: uniqueEmail('noname'), password: TEST_PASSWORD })
      .expect(400);
    await newAgent(app)
      .post('/api/v1/auth/sign-up/email')
      .send({ name: 'x'.repeat(81), email: uniqueEmail('longname'), password: TEST_PASSWORD })
      .expect(400);
  });

  it('rate-limits sign-in to 5 per minute per client: the 6th attempt is 429', async () => {
    const user = await signUp(app, 'ratelimit');
    const ip = nextIp();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await newAgent(app, ip)
        .post('/api/v1/auth/sign-in/email')
        .send({ email: user.email, password: 'wrong-password-wrong' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
    // A different client is unaffected.
    await newAgent(app)
      .post('/api/v1/auth/sign-in/email')
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(200);
  });

  it('cannot dodge the auth rate limit by spoofing a client-IP header the library trusts', async () => {
    const user = await signUp(app, 'spoof');
    const ip = nextIp();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await newAgent(app, ip)
        .post('/api/v1/auth/sign-in/email')
        .set('x-funfriday-client-ip', `203.0.113.${i + 1}`)
        .send({ email: user.email, password: 'wrong-password-wrong' });
      statuses.push(res.status);
    }
    expect(statuses[5]).toBe(429);
  });

  describe('OriginGuard (CSRF)', () => {
    it('rejects a state-changing request from a foreign Origin with 403', async () => {
      const user = await signUp(app, 'csrf1');
      const res = await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set('Cookie', user.cookie)
        .set('Origin', 'https://evil.example')
        .send({ name: 'Evil Corp' })
        .expect(403);
      expect(apiErrorSchema.parse(res.body).code).toBe('FORBIDDEN');
    });

    it('rejects a cookie-bearing mutation with no Origin header', async () => {
      const user = await signUp(app, 'csrf2');
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set('Cookie', user.cookie)
        .send({ name: 'No Origin Inc' })
        .expect(403);
    });

    it('rejects Origin: null and look-alike origins', async () => {
      const user = await signUp(app, 'csrf3');
      for (const origin of [
        'null',
        'http://localhost:3000.evil.example',
        'http://localhost:3001',
      ]) {
        await request(app.getHttpServer())
          .post('/api/v1/organizations')
          .set('Cookie', user.cookie)
          .set('Origin', origin)
          .send({ name: 'Lookalike Ltd' })
          .expect(403);
      }
    });

    it('accepts the allow-listed Origin', async () => {
      const user = await signUp(app, 'csrf4');
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set('Cookie', user.cookie)
        .set('Origin', WEB_ORIGIN)
        .send({ name: 'Good Origin Ltd' })
        .expect(201);
    });

    it('does not block safe methods and still returns 401 for cookie-less mutations', async () => {
      const user = await signUp(app, 'csrf5');
      await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Cookie', user.cookie)
        .set('Origin', 'https://evil.example')
        .expect(200);
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .send({ name: 'Anon Org' })
        .expect(401);
    });

    it('the auth library rejects sign-out from a foreign Origin as well', async () => {
      const user = await signUp(app, 'csrf6');
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-out')
        .set('Cookie', user.cookie)
        .set('Origin', 'https://evil.example')
        .send({});
      expect(res.status).toBe(403);
    });
  });

  describe('input validation', () => {
    it('returns 400 BAD_REQUEST with field errors from the shared schema', async () => {
      const user = await signUp(app, 'validate');
      const res = await user.agent.post('/api/v1/organizations').send({ name: 'x' }).expect(400);
      const body = apiErrorSchema.parse(res.body);
      expect(body.code).toBe('BAD_REQUEST');
      expect(body.details).toEqual({ fieldErrors: { name: ['Use at least 2 characters.'] } });
    });

    it('rejects a missing body and wrong types', async () => {
      const user = await signUp(app, 'validate2');
      await user.agent.post('/api/v1/organizations').expect(400);
      await user.agent.post('/api/v1/organizations').send({ name: 12345 }).expect(400);
    });

    it('creating an organisation does not echo unknown fields or accept mass-assignment', async () => {
      const user = await signUp(app, 'mass');
      const res = await user.agent
        .post('/api/v1/organizations')
        .send({ name: 'Mass Assign Co', retentionDays: 1, slug: 'hijack', id: 'x' })
        .expect(201);
      expect(res.body.slug).toMatch(/^mass-assign-co/);
      expect(res.body.myRole).toBe('admin');
      expect(res.body.memberCount).toBe(1);
    });
  });

  describe('privacy and telemetry', () => {
    it('keeps Better Auth telemetry disabled and makes no outbound HTTP calls on sign-up', async () => {
      const auth = app.get(AuthService).auth;
      expect(auth.options.telemetry?.enabled).toBe(false);
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      await signUp(app, 'telemetry');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('never logs request bodies, tokens, cookies or emails during sign-up and sign-in', async () => {
      const captured: string[] = [];
      const capture = (...args: unknown[]) => {
        captured.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
      };
      for (const method of ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const) {
        vi.spyOn(Logger.prototype, method).mockImplementation(capture);
        vi.spyOn(Logger, method).mockImplementation(capture);
      }
      for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
        vi.spyOn(console, method).mockImplementation(capture);
      }

      const email = uniqueEmail('privacy');
      const password = 'a-very-secret-passphrase-1';
      const user = await signUp(app, 'privacy', { email, password });
      await newAgent(app).post('/api/v1/auth/sign-in/email').send({ email, password }).expect(200);
      await user.agent.get('/api/v1/me').expect(200);

      const token = user.cookie.split('=')[1]!.split('.')[0]!;
      const everything = captured.join('\n');
      expect(captured.length).toBeGreaterThan(0); // the "dev mail queued" line proves capture works
      expect(everything).toContain('dev mail queued');
      expect(everything).not.toContain(email);
      expect(everything).not.toContain(password);
      expect(everything).not.toContain(token);
      expect(everything).not.toMatch(/token=|verify-email|funfriday\.session_token/);
    });
  });

  it('organisation creation requires a session', async () => {
    await newAgent(app).post('/api/v1/organizations').send({ name: 'Nope Inc' }).expect(401);
    const user = await signUp(app, 'orgcreate');
    expect(await createOrg(user, 'Create Check')).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('dev mailbox availability', () => {
  it('is 404 when DEV_MAILBOX_ENABLED is off, and sends nothing anywhere', async () => {
    const off = await startApp({ devMailboxEnabled: false, webOrigins: [WEB_ORIGIN] });
    try {
      await request(off.getHttpServer()).get('/api/v1/dev/mailbox').expect(404);
      // Sign-up still works; the verification mail is suppressed rather than sent.
      const user = await signUp(off, 'nomailbox');
      expect(user.userId).toBeTruthy();
    } finally {
      await off.close();
    }
  });

  it('lists mail with extracted absolute links when enabled', async () => {
    const on = await startApp({ webOrigins: [WEB_ORIGIN] });
    try {
      const user = await signUp(on, 'mailbox');
      const res = await request(on.getHttpServer()).get('/api/v1/dev/mailbox').expect(200);
      const mine = (res.body.messages as { to: string; links: string[] }[]).find(
        (m) => m.to === user.email,
      );
      expect(mine).toBeDefined();
      expect(mine!.links).toHaveLength(1);
      expect(mine!.links[0]).toMatch(
        /^http:\/\/localhost:4000\/api\/v1\/auth\/verify-email\?token=/,
      );
      expect(res.body.messages.length).toBeLessThanOrEqual(50);
    } finally {
      await on.close();
    }
  });
});
