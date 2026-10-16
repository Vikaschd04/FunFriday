import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { LiveEvent, type RoomState } from '@funfriday/contracts';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/infra/database/prisma.service.js';
import { RedisService } from '../src/infra/redis/redis.service.js';
import { RoomManager } from '../src/modules/live/room-manager.js';
import { SessionEffects } from '../src/modules/live/session-effects.js';
import { startApp } from './app-harness.js';
import { WEB_ORIGIN, joinOrg, nextIp, signUpVerified } from './identity-fixtures.js';
import {
  LiveClient as Client,
  type LiveOrg,
  START_GAME,
  TestClock,
  createLiveOrg,
  createSession,
  listen,
  sleep,
} from './live-helpers.js';

async function poll<T>(fn: () => Promise<T | null>, timeoutMs = 5_000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await sleep(25);
  }
  throw new Error('poll timed out');
}

describe('realtime hardening', () => {
  let app: NestExpressApplication;
  let url: string;
  let org: LiveOrg;
  const opened: Client[] = [];
  const extraApps: NestExpressApplication[] = [];

  async function seat(
    target: string,
    user: { cookie: string },
    sessionId: string,
  ): Promise<Client> {
    const result = await Client.open(target, user.cookie);
    if ('error' in result) throw new Error(result.error.message);
    opened.push(result.client);
    await result.client.joined(sessionId);
    return result.client;
  }
  async function connect(user: { cookie: string }) {
    const result = await Client.open(url, user.cookie);
    if ('client' in result) opened.push(result.client);
    return result;
  }
  const round = (s: RoomState) => s.view.game!.round!;

  beforeAll(async () => {
    app = await startApp();
    url = await listen(app);
    org = await createLiveOrg(app, 'hard', 3);
  }, 120_000);
  afterEach(async () => {
    for (const c of opened.splice(0)) c.close();
    for (const a of extraApps.splice(0)) await a.close();
    app.get(SessionEffects).retryDelayMs = 250;
  });
  afterAll(async () => {
    await app.close();
  });

  it('serialises concurrent joins on one socket: disconnect leaves no ghost in either room', async () => {
    const a = await createSession(org, org.host, 'Race A');
    const b = await createSession(org, org.host, 'Race B');
    const watchA = await seat(url, org.admin, a.id);
    const watchB = await seat(url, org.admin, b.id);
    const user = org.members[0]!;
    const socket = await connect(user.user);
    if (!('client' in socket)) throw new Error('connect');
    const [ackA, ackB] = await Promise.all([socket.client.join(a.id), socket.client.join(b.id)]);
    expect(ackA.status).toBe('joined');
    expect(ackB.status).toBe('joined');

    socket.client.close();
    const manager = app.get(RoomManager);
    const seatOf = (s: RoomState) =>
      s.view.participants.find((p) => p.memberId === user.membershipId);
    await watchA.waitFor((s) => seatOf(s)?.connected === false, 3_000, 'away in A');
    await watchB.waitFor((s) => seatOf(s)?.connected === false, 3_000, 'away in B');
    // Only the two admin watchers remain attached.
    expect(manager.peek(a.id)!.connectionCount).toBe(1);
    expect(manager.peek(b.id)!.connectionCount).toBe(1);
  });

  describe('snapshot trust (Redis is a trust boundary)', () => {
    async function snapshotAfterJoin(sessionId: string): Promise<Record<string, unknown>> {
      const host = await seat(url, org.host, sessionId);
      await host.host(sessionId, START_GAME);
      await host.waitFor((s) => s.view.game?.phase === 'question', 3_000);
      const raw = await app.get(RedisService).client.get(`room:${sessionId}`);
      return JSON.parse(raw!) as Record<string, unknown>;
    }

    async function restartAndJoin() {
      for (const c of opened.splice(0)) c.close();
      await app.close();
      app = await startApp();
      url = await listen(app);
    }

    it('refuses a tampered organizationId, malformed JSON and unknown keys, rebuilding a clean lobby from Postgres', async () => {
      for (const tamper of ['org', 'json', 'extra-key'] as const) {
        const session = await createSession(org, org.host, `Tamper ${tamper}`);
        const snap = await snapshotAfterJoin(session.id);
        const redis = app.get(RedisService).client;
        const value =
          tamper === 'org'
            ? JSON.stringify({ ...snap, organizationId: randomUUID() })
            : tamper === 'json'
              ? '{"version":1,'
              : JSON.stringify({ ...snap, evil: true });
        await restartAndJoin();
        await app.get(RedisService).client.set(`room:${session.id}`, value);
        void redis;
        const member = await seat(url, org.members[0]!.user, session.id);
        expect(member.latest.view.game).toBeNull();
        expect(member.latest.view.status).toBe('lobby');
        expect(member.latest.view.participants).toHaveLength(1);
      }
    });

    it('a mid-round room recovered after a crash is not blocked by ghost connections', async () => {
      const session = await createSession(org, org.host, 'Ghosts');
      const host = await seat(url, org.host, session.id);
      const p1 = await seat(url, org.members[0]!.user, session.id);
      const p2 = await seat(url, org.members[1]!.user, session.id);
      await host.host(session.id, START_GAME);
      await p1.waitFor((s) => s.view.game?.phase === 'question', 3_000);
      const roundId = round(p1.latest).id;
      // The snapshot a crashed process would leave behind: everyone still marked connected.
      const crashed = (await app.get(RedisService).client.get(`room:${session.id}`))!;
      expect(
        Object.values(JSON.parse(crashed).members as Record<string, { connected: boolean }>).every(
          (m) => m.connected,
        ),
      ).toBe(true);
      void p2;
      for (const c of opened.splice(0)) c.close();
      await app.close();
      app = await startApp();
      url = await listen(app);
      await app.get(RedisService).client.set(`room:${session.id}`, crashed);

      const only = await seat(url, org.members[0]!.user, session.id);
      expect(only.latest.view.participants.filter((p) => p.connected)).toHaveLength(1);
      expect((await only.answer(session.id, roundId, 'A')).status).toBe('accepted');
      await only.waitFor((s) => s.view.game?.phase === 'reveal', 3_000, 'reveal without ghosts');
    });
  });

  describe('session re-validation', () => {
    it('after sign-out, the next action past the 60 s window is UNAUTHENTICATED and the socket is dropped', async () => {
      const clock = new TestClock(1_900_300_000_000);
      const clocked = await startApp({}, { clock });
      extraApps.push(clocked);
      const target = await listen(clocked);
      const user = await signUpVerified(app, 'hard-signout');
      await joinOrg(app, org.admin, org.orgId, user, 'participant');
      const session = await createSession(org, org.host);
      const c = await seat(target, user, session.id);
      const dropped = new Promise<string>((resolve) => c.socket.once('disconnect', resolve));

      await user.agent.post('/api/v1/auth/sign-out').send({}).expect(200);
      // Inside the window the socket is not re-checked.
      expect(
        (await c.emitAck<{ status: string }>(LiveEvent.resync, { sessionId: session.id })).status,
      ).toBe('joined');
      clock.advance(61_000);
      const ack = await c.emitAck<{ status: string; code?: string }>(LiveEvent.resync, {
        sessionId: session.id,
      });
      expect(ack).toEqual({ status: 'rejected', code: 'UNAUTHENTICATED' });
      expect(await Promise.race([dropped, sleep(3_000).then(() => 'still-open')])).not.toBe(
        'still-open',
      );
    });

    it('re-checks the session on every host command, no waiting', async () => {
      const second = await signUpVerified(app, 'hard-signout-admin');
      await joinOrg(app, org.admin, org.orgId, second, 'admin');
      const session = await createSession(org, org.host);
      const c = await seat(url, second, session.id);
      await second.agent.post('/api/v1/auth/sign-out').send({}).expect(200);
      expect(await c.host(session.id, START_GAME)).toMatchObject({
        status: 'rejected',
        code: 'UNAUTHENTICATED',
      });
    });
  });

  describe('effects are idempotent and reconciled', () => {
    it('catches Postgres up exactly once after effect failures and a rehydrate', async () => {
      const effects = app.get(SessionEffects);
      effects.retryDelayMs = 10;
      const prisma = app.get(PrismaService);
      const manager = app.get(RoomManager);
      const session = await createSession(org, org.host, 'Lossy effects');
      const original = effects.apply.bind(effects);
      effects.apply = () => Promise.reject(new Error('postgres hiccup'));
      try {
        const host = await seat(url, org.host, session.id);
        await host.host(session.id, START_GAME);
        await host.host(session.id, { type: 'end_game' });
        await host.host(session.id, { type: 'end_session' });
        await host.waitFor((s) => s.view.status === 'ended', 3_000);
        await manager.peek(session.id)!.drain();
        expect(await prisma.gameResult.count({ where: { sessionId: session.id } })).toBe(0);
        expect(
          (await prisma.liveSession.findUniqueOrThrow({ where: { id: session.id } })).status,
        ).not.toBe('ENDED');
      } finally {
        effects.apply = original;
      }
      for (const c of opened.splice(0)) c.close();
      await poll(() =>
        Promise.resolve(manager.peek(session.id)?.connectionCount === 0 ? true : null),
      );
      await sleep(50);
      manager.idleEvictionMs = 0;
      manager.sweep(Date.now() + 1);
      manager.idleEvictionMs = 10 * 60 * 1000;
      expect(manager.peek(session.id)).toBeUndefined();

      const seed = {
        id: session.id,
        organizationId: org.orgId,
        title: 'x',
        roomCode: session.roomCode,
      };
      await manager.acquire(seed);
      const row = await poll(async () => {
        const s = await prisma.liveSession.findUniqueOrThrow({ where: { id: session.id } });
        return s.status === 'ENDED' ? s : null;
      });
      expect(row.startedAt).not.toBeNull();
      expect(row.endedAt).not.toBeNull();
      await poll(async () =>
        (await prisma.gameResult.count({ where: { sessionId: session.id } })) === 1 ? true : null,
      );

      // A second rehydrate re-applies everything again: still exactly one result.
      manager.idleEvictionMs = 0;
      manager.sweep(Date.now() + 1);
      manager.idleEvictionMs = 10 * 60 * 1000;
      await manager.acquire(seed);
      await sleep(300);
      expect(await prisma.gameResult.count({ where: { sessionId: session.id } })).toBe(1);
    });

    it('the database refuses a second result for the same game run', async () => {
      const prisma = app.get(PrismaService);
      const session = await createSession(org, org.host);
      const startedAt = new Date();
      const data = {
        organizationId: org.orgId,
        sessionId: session.id,
        gameSlug: 'this-or-that',
        startedAt,
        endedAt: startedAt,
        summary: { rounds: [] },
      };
      await prisma.gameResult.create({ data });
      await expect(prisma.gameResult.create({ data })).rejects.toThrow();
    });
  });

  describe('socket caps', () => {
    it('refuses a 6th socket per user with RATE_LIMITED and frees the slot on disconnect', async () => {
      const user = org.members[1]!.user;
      const first = [];
      for (let i = 0; i < 5; i += 1) {
        const r = await connect(user);
        expect('client' in r).toBe(true);
        first.push(r);
      }
      const sixth = await connect(user);
      expect(sixth).toEqual({ error: expect.objectContaining({ code: 'RATE_LIMITED' }) });
      (first[0] as { client: Client }).client.close();
      await sleep(150);
      expect('client' in (await connect(user))).toBe(true);
    });

    it('allows at most 3 sockets per user in one session', async () => {
      const session = await createSession(org, org.host);
      const user = org.members[2]!.user;
      for (let i = 0; i < 3; i += 1) await seat(url, user, session.id);
      const fourth = await connect(user);
      if (!('client' in fourth)) throw new Error('connect');
      expect(await fourth.client.join(session.id)).toEqual({
        status: 'rejected',
        code: 'RATE_LIMITED',
      });
    });

    it('shares one event bucket across all sockets of a user', async () => {
      const user = await signUpVerified(app, 'hard-bucket');
      await joinOrg(app, org.admin, org.orgId, user, 'participant');
      const session = await createSession(org, org.host);
      const sockets = await Promise.all([1, 2, 3].map(() => seat(url, user, session.id)));
      // 3 joins used 3 tokens; each socket alone stays far below its own burst of 20.
      const acks = await Promise.all(
        sockets.flatMap((c) =>
          Array.from({ length: 10 }, () =>
            c.emitAck<{ status: string; code?: string }>(LiveEvent.resync, {
              sessionId: session.id,
            }),
          ),
        ),
      );
      expect(acks.filter((a) => a.code === 'RATE_LIMITED').length).toBeGreaterThanOrEqual(8);
      expect(acks.filter((a) => a.status === 'joined').length).toBeLessThanOrEqual(17);
    });
  });

  it('limits join-by-code per USER across different IPs', async () => {
    const user = await signUpVerified(app, 'hard-codes');
    const statuses: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/sessions/join-by-code')
        .set('Cookie', user.cookie)
        .set('Origin', WEB_ORIGIN)
        .set('X-Forwarded-For', nextIp())
        .send({ code: 'ZZZZZZ' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 404)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });

  it('re-checks host status inside the room queue: a demotion that lands while the command waits wins', async () => {
    const second = await signUpVerified(app, 'hard-toctou');
    const membershipId = await joinOrg(app, org.admin, org.orgId, second, 'admin');
    const session = await createSession(org, org.host);
    const c = await seat(url, second, session.id);
    const actor = app.get(RoomManager).peek(session.id)!;
    // A slow command holds the queue; the host command queues behind it.
    const slow = actor.command(
      { type: 'ready', memberId: membershipId, ready: true, clientActionId: randomUUID() },
      async () => {
        await sleep(250);
        return null;
      },
    );
    const pending = c.host(session.id, START_GAME);
    await sleep(60);
    await app
      .get(PrismaService)
      .membership.update({ where: { id: membershipId }, data: { role: 'PARTICIPANT' } });
    expect(await slow).toMatchObject({ status: 'accepted' });
    expect(await pending).toMatchObject({ status: 'rejected', code: 'NOT_HOST' });
  });
});
