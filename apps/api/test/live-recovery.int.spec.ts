import type { NestExpressApplication } from '@nestjs/platform-express';
import { LiveEvent, type RoomState } from '@funfriday/contracts';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/infra/database/prisma.service.js';
import { RedisService } from '../src/infra/redis/redis.service.js';
import { startApp } from './app-harness.js';
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

const round = (s: RoomState) => s.view.game!.round!;

async function poll<T>(fn: () => Promise<T | null>, timeoutMs = 5_000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await sleep(25);
  }
  throw new Error('poll timed out');
}

describe('server deadline, restart recovery and Redis outage', () => {
  let setup: NestExpressApplication;
  let org: LiveOrg;
  const opened: Client[] = [];
  const apps: NestExpressApplication[] = [];

  async function boot(
    overrides: Parameters<typeof startApp>[0] = {},
    clock?: TestClock,
  ): Promise<{ app: NestExpressApplication; url: string }> {
    const app = await startApp(overrides, { clock });
    apps.push(app);
    return { app, url: await listen(app) };
  }

  async function seat(url: string, user: { cookie: string }, sessionId: string): Promise<Client> {
    const result = await Client.open(url, user.cookie);
    if ('error' in result) throw new Error(result.error.message);
    opened.push(result.client);
    await result.client.joined(sessionId);
    return result.client;
  }

  beforeAll(async () => {
    setup = await startApp();
    org = await createLiveOrg(setup, 'rec', 2);
  }, 120_000);

  afterEach(async () => {
    for (const c of opened.splice(0)) c.close();
    for (const a of apps.splice(0)) await a.close();
  });

  afterAll(async () => {
    await setup.close();
  });

  it('closes the round at the server deadline with no host action and broadcasts the reveal', async () => {
    const clock = new TestClock(1_900_000_000_000);
    const { url } = await boot({}, clock);
    const session = await createSession(org, org.host);
    const host = await seat(url, org.host, session.id);
    const p1 = await seat(url, org.members[0]!.user, session.id);
    const p2 = await seat(url, org.members[1]!.user, session.id);
    await host.host(session.id, START_GAME);
    await p1.waitFor((s) => s.view.game?.phase === 'question', 3_000);
    const r = round(p1.latest);
    expect(r.deadlineAt).toBe(1_900_000_000_000 + 20_000);
    expect(p1.latest.serverNow).toBe(1_900_000_000_000);
    await p1.answer(session.id, r.id, 'A');
    await p2.waitFor((s) => s.view.game?.answeredCount === 1, 3_000);
    const before = p2.latest.revision;

    clock.advance(19_000);
    await sleep(150);
    expect(p2.latest.view.game!.phase).toBe('question');
    expect(p2.latest.revision).toBe(before);

    clock.advance(1_000);
    for (const c of [host, p1, p2])
      await c.waitFor((s) => s.view.game?.phase === 'reveal', 3_000, 'reveal at deadline');
    expect(p2.latest.revision).toBe(before + 1);
    expect(p2.latest.view.game!.reveal).toEqual({ a: 1, b: 0, pass: 0 });
    expect(p2.latest.view.game!.round!.deadlineAt).toBeNull();
    // Late answer after the server closed the round.
    expect(await p2.answer(session.id, r.id, 'B')).toMatchObject({
      status: 'rejected',
      code: 'ROUND_CLOSED',
    });
    // No second timer fires.
    clock.advance(60_000);
    await sleep(100);
    expect(p2.latest.revision).toBe(before + 1);
  });

  it('rejects an answer that arrives after the deadline even before the timer has fired', async () => {
    const clock = new TestClock(1_900_100_000_000);
    const { url } = await boot({}, clock);
    const session = await createSession(org, org.host);
    const host = await seat(url, org.host, session.id);
    const p1 = await seat(url, org.members[0]!.user, session.id);
    await host.host(session.id, START_GAME);
    await p1.waitFor((s) => s.view.game?.phase === 'question', 3_000);
    const r = round(p1.latest);
    // Move the clock past the deadline without firing timers (simulates a late packet vs a slow timer).
    (clock as unknown as { current: number }).current += 21_000;
    expect(await p1.answer(session.id, r.id, 'A')).toMatchObject({
      status: 'rejected',
      code: 'ROUND_CLOSED',
    });
  });

  it('pause stops the server timer and resume restarts it with the remaining time', async () => {
    const clock = new TestClock(1_900_200_000_000);
    const { url } = await boot({}, clock);
    const session = await createSession(org, org.host);
    const host = await seat(url, org.host, session.id);
    const p1 = await seat(url, org.members[0]!.user, session.id);
    await host.host(session.id, START_GAME);
    await p1.waitFor((s) => s.view.game?.phase === 'question', 3_000);
    clock.advance(5_000);
    expect((await host.host(session.id, { type: 'pause' })).status).toBe('accepted');
    await p1.waitFor((s) => s.view.game?.paused === true, 3_000);
    expect(round(p1.latest).remainingMs).toBe(15_000);
    clock.advance(120_000);
    await sleep(100);
    expect(p1.latest.view.game!.phase).toBe('question');
    expect((await host.host(session.id, { type: 'resume' })).status).toBe('accepted');
    await p1.waitFor((s) => s.view.game?.paused === false, 3_000);
    expect(round(p1.latest).deadlineAt).toBe(1_900_200_000_000 + 125_000 + 15_000);
    clock.advance(15_000);
    await p1.waitFor((s) => s.view.game?.phase === 'reveal', 3_000, 'reveal after resume');
  });

  it('recovers a mid-round room after an API restart: same round, answers and deadline', async () => {
    const a = await boot();
    const session = await createSession(org, org.host);
    const host = await seat(a.url, org.host, session.id);
    const p1 = await seat(a.url, org.members[0]!.user, session.id);
    const p2 = await seat(a.url, org.members[1]!.user, session.id);
    await host.host(session.id, START_GAME);
    await p1.waitFor((s) => s.view.game?.phase === 'question', 3_000);
    const r = round(p1.latest);
    await p1.answer(session.id, r.id, 'A');
    await p2.answer(session.id, r.id, 'pass');
    await host.waitFor((s) => s.view.game?.answeredCount === 2, 3_000);
    const revisionBefore = host.latest.revision;

    // Instance A goes away (graceful shutdown), instance B starts on the same Redis/Postgres.
    for (const c of [host, p1, p2]) c.close();
    await apps.pop()!.close();
    const b = await boot();

    const p1b = await seat(b.url, org.members[0]!.user, session.id);
    const state = p1b.latest;
    expect(round(p1b.latest).id).toBe(r.id);
    expect(round(p1b.latest).deadlineAt).toBe(r.deadlineAt);
    expect(state.view.game!.myChoice).toBe('A');
    expect(state.view.game!.answeredCount).toBe(2);
    expect(state.revision).toBeGreaterThanOrEqual(revisionBefore);
    expect(state.view.participants).toHaveLength(3);

    // The recovered room keeps working: the host returns and finishes the round.
    const hostB = await seat(b.url, org.host, session.id);
    expect((await hostB.host(session.id, { type: 'close_round' })).status).toBe('accepted');
    await p1b.waitFor((s) => s.view.game?.phase === 'reveal', 3_000);
    expect(p1b.latest.view.game!.reveal).toEqual({ a: 1, b: 0, pass: 1 });
    // The answer given before the restart is still refused as a duplicate.
    expect(await p1b.answer(session.id, r.id, 'B')).toMatchObject({ status: 'rejected' });
  });

  it('after a restart past the deadline, the first visitor triggers the missed round close', async () => {
    const a = await boot();
    const session = await createSession(org, org.host);
    const host = await seat(a.url, org.host, session.id);
    const p1 = await seat(a.url, org.members[0]!.user, session.id);
    await host.host(session.id, START_GAME);
    await p1.waitFor((s) => s.view.game?.phase === 'question', 3_000);
    const r = round(p1.latest);
    await p1.answer(session.id, r.id, 'B');
    for (const c of [host, p1]) c.close();
    await apps.pop()!.close();

    const later = new TestClock(r.deadlineAt! + 5_000);
    const b = await boot({}, later);
    const p1b = await seat(b.url, org.members[0]!.user, session.id);
    await p1b.waitFor((s) => s.view.game?.phase === 'reveal', 3_000, 'catch-up tick');
    expect(p1b.latest.view.game!.reveal).toEqual({ a: 0, b: 1, pass: 0 });
  });

  it('records started/finished/ended in Postgres exactly once even across a restart', async () => {
    const a = await boot();
    const session = await createSession(org, org.host);
    const host = await seat(a.url, org.host, session.id);
    await host.host(session.id, START_GAME);
    await host.waitFor((s) => s.view.game?.phase === 'question', 3_000);
    host.close();
    await apps.pop()!.close();
    const b = await boot();
    const hostB = await seat(b.url, org.host, session.id);
    await hostB.host(session.id, { type: 'end_session' });
    const prisma = setup.get(PrismaService);
    const row = await poll(async () => {
      const s = await prisma.liveSession.findUniqueOrThrow({ where: { id: session.id } });
      return s.status === 'ENDED' ? s : null;
    });
    expect(row.startedAt).not.toBeNull();
    expect(row.endedAt).not.toBeNull();
    await poll(async () =>
      (await prisma.gameResult.count({ where: { sessionId: session.id } })) === 1 ? true : null,
    );
    await sleep(200);
    expect(await prisma.gameResult.count({ where: { sessionId: session.id } })).toBe(1);
  });

  describe('Redis outage', () => {
    it('with Redis unreachable from the start, join is refused SERVICE_UNAVAILABLE and nothing is accepted', async () => {
      const { url } = await boot({ redisUrl: 'redis://127.0.0.1:6399' });
      const session = await createSession(org, org.host);
      const result = await Client.open(url, org.host.cookie);
      if ('error' in result) throw new Error(result.error.message);
      opened.push(result.client);
      expect(await result.client.join(session.id)).toEqual({
        status: 'rejected',
        code: 'SERVICE_UNAVAILABLE',
      });
      expect(await result.client.host(session.id, START_GAME)).toMatchObject({
        status: 'rejected',
        code: 'ROOM_NOT_FOUND',
      });
      expect(result.client.states).toHaveLength(0);
    });

    it('when Redis dies mid-game, actions are rejected SERVICE_UNAVAILABLE with no broadcast, and work again after recovery', async () => {
      const { app, url } = await boot();
      const session = await createSession(org, org.host);
      const host = await seat(url, org.host, session.id);
      const p1 = await seat(url, org.members[0]!.user, session.id);
      const p2 = await seat(url, org.members[1]!.user, session.id);
      await host.host(session.id, START_GAME);
      await p1.waitFor((s) => s.view.game?.phase === 'question', 3_000);
      const r = round(p1.latest);
      await host.waitFor((s) => s.view.participants.length === 3, 3_000);
      const revision = p2.latest.revision;
      const seen = [host, p1, p2].map((c) => c.states.length);

      const redis = app.get(RedisService).client;
      redis.disconnect();
      const ack = await p1.answer(session.id, r.id, 'A');
      expect(ack).toEqual({ status: 'rejected', revision, code: 'SERVICE_UNAVAILABLE' });
      expect(await host.host(session.id, { type: 'close_round' })).toMatchObject({
        status: 'rejected',
        code: 'SERVICE_UNAVAILABLE',
        revision,
      });
      await sleep(250);
      expect([host, p1, p2].map((c) => c.states.length)).toEqual(seen);
      // State is unchanged: p1 has no recorded choice, same revision.
      const res = await p2.emitAck<{ state: RoomState }>(LiveEvent.resync, {
        sessionId: session.id,
      });
      expect(res.state.revision).toBe(revision);
      expect(res.state.view.game!.answeredCount).toBe(0);

      await redis.connect();
      // The same action id is NOT burned by the failed attempt: it can be retried.
      const retry = await p1.answer(session.id, r.id, 'A');
      expect(retry.status).toBe('accepted');
      expect(retry.revision).toBe(revision + 1);
      await p2.waitFor((s) => s.view.game?.answeredCount === 1, 3_000);
    });
  });
});
