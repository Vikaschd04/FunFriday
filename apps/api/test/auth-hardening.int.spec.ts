import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { apiErrorSchema } from '@funfriday/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/infra/database/prisma.service.js';
import { startApp } from './app-harness.js';
import {
  TEST_PASSWORD,
  WEB_ORIGIN,
  newAgent,
  nextIp,
  signUp,
  uniqueEmail,
} from './identity-fixtures.js';

describe('auth route hardening', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  beforeAll(async () => {
    app = await startApp({ webOrigins: [WEB_ORIGIN] });
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await app.close();
  });

  describe('body size', () => {
    it('rejects a 1 MB sign-up with 413 in the standard envelope', async () => {
      const res = await newAgent(app)
        .post('/api/v1/auth/sign-up/email')
        .send({
          name: 'Big',
          email: uniqueEmail('big'),
          password: TEST_PASSWORD,
          pad: 'x'.repeat(1_000_000),
        });
      expect(res.status).toBe(413);
      expect(apiErrorSchema.parse(res.body).code).toBe('BAD_REQUEST');
    });

    it('rejects a chunked body without Content-Length with 411', async () => {
      const server = await startApp({ webOrigins: [WEB_ORIGIN] });
      await server.listen(0, '127.0.0.1');
      try {
        const port = (server.getHttpServer().address() as AddressInfo).port;
        const status = await new Promise<number>((resolve, reject) => {
          const req = http.request(
            {
              host: '127.0.0.1',
              port,
              path: '/api/v1/auth/sign-in/email',
              method: 'POST',
              headers: { 'content-type': 'application/json', 'transfer-encoding': 'chunked' },
            },
            (res) => {
              res.resume();
              resolve(res.statusCode ?? 0);
            },
          );
          req.on('error', reject);
          req.write('{"email":');
          req.end('"a@example.test","password":"x"}');
        });
        expect(status).toBe(411);
      } finally {
        await server.close();
      }
    });

    it('still accepts normal small auth bodies', async () => {
      await signUp(app, 'small-body');
    });
  });

  describe('over-posting', () => {
    it('rejects a 200-char name with 400 (not 500) and stores nothing', async () => {
      const email = uniqueEmail('longname');
      const res = await newAgent(app)
        .post('/api/v1/auth/sign-up/email')
        .send({ name: 'n'.repeat(200), email, password: TEST_PASSWORD });
      expect(res.status).toBe(400);
      expect(await prisma.user.count({ where: { email } })).toBe(0);
    });

    it('rejects an image field on sign-up and stores nothing', async () => {
      const email = uniqueEmail('image');
      await newAgent(app)
        .post('/api/v1/auth/sign-up/email')
        .send({ name: 'Img', email, password: TEST_PASSWORD, image: 'https://evil.example/x.png' })
        .expect(400);
      expect(await prisma.user.count({ where: { email } })).toBe(0);
    });

    it('update-user only accepts a valid name; image, emailVerified and long names are 400', async () => {
      const user = await signUp(app, 'updater');
      await user.agent
        .post('/api/v1/auth/update-user')
        .send({ image: 'https://evil.example/x.png' })
        .expect(400);
      await user.agent
        .post('/api/v1/auth/update-user')
        .send({ name: 'ok', emailVerified: true })
        .expect(400);
      await user.agent
        .post('/api/v1/auth/update-user')
        .send({ name: 'n'.repeat(200) })
        .expect(400);
      await user.agent.post('/api/v1/auth/update-user').send({ name: 'New Name' }).expect(200);
      const row = await prisma.user.findUniqueOrThrow({ where: { email: user.email } });
      expect(row).toMatchObject({ name: 'New Name', image: null, emailVerified: false });
    });
  });

  describe('rate limits and proxies', () => {
    it('limits send-verification-email to 3 per minute', async () => {
      const user = await signUp(app, 'resend');
      const ip = nextIp();
      const statuses: number[] = [];
      for (let i = 0; i < 4; i += 1) {
        statuses.push(
          (
            await newAgent(app, ip)
              .post('/api/v1/auth/send-verification-email')
              .send({ email: user.email })
          ).status,
        );
      }
      expect(statuses.slice(0, 3).every((s) => s !== 429)).toBe(true);
      expect(statuses[3]).toBe(429);
    });

    it('with one trusted hop, rate limiting keys on the proxy-appended address, not the spoofed one', async () => {
      const user = await signUp(app, 'hops');
      const real = nextIp();
      const statuses: number[] = [];
      for (let i = 0; i < 6; i += 1) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/sign-in/email')
          .set('Origin', WEB_ORIGIN)
          .set('X-Forwarded-For', `203.0.113.${i + 1}, ${real}`)
          .send({ email: user.email, password: 'wrong-password-wrong' });
        statuses.push(res.status);
      }
      expect(statuses[5]).toBe(429);
    });

    it('with zero trusted hops X-Forwarded-For is ignored entirely', async () => {
      const direct = await startApp({ webOrigins: [WEB_ORIGIN], trustProxy: 0 });
      try {
        const statuses: number[] = [];
        for (let i = 0; i < 6; i += 1) {
          const res = await request(direct.getHttpServer())
            .post('/api/v1/auth/sign-in/email')
            .set('X-Forwarded-For', `203.0.113.${i + 1}`)
            .send({ email: uniqueEmail('nobody'), password: 'wrong-password-wrong' });
          statuses.push(res.status);
        }
        expect(statuses[5]).toBe(429);
      } finally {
        await direct.close();
      }
    });
  });

  describe('origin guard fails closed', () => {
    it('requires an allow-listed Origin whenever any Cookie header is present', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set('Cookie', 'unrelated=1')
        .send({ name: 'Cookie Org' })
        .expect(403);
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set('Cookie', 'unrelated=1')
        .set('Origin', WEB_ORIGIN)
        .send({ name: 'Cookie Org' })
        .expect(401);
    });
  });

  describe('dev mailbox host check', () => {
    it('serves loopback hosts and 404s any other Host header (DNS rebinding)', async () => {
      for (const host of ['localhost:4000', '127.0.0.1:4000', '[::1]:4000']) {
        await request(app.getHttpServer()).get('/api/v1/dev/mailbox').set('Host', host).expect(200);
      }
      for (const host of ['evil.example', 'localhost.evil.example', 'evil.example:4000']) {
        await request(app.getHttpServer()).get('/api/v1/dev/mailbox').set('Host', host).expect(404);
      }
    });
  });
});
