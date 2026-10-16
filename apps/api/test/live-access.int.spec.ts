import type { NestExpressApplication } from '@nestjs/platform-express';
import { liveSessionListResponseSchema } from '@funfriday/contracts';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/infra/database/prisma.service.js';
import { startApp } from './app-harness.js';
import { joinOrg, signUpVerified } from './identity-fixtures.js';
import {
  LiveClient as Client,
  type LiveOrg,
  START_GAME,
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

describe('live access follows membership changes', () => {
  let app: NestExpressApplication;
  let url: string;
  let org: LiveOrg;
  const opened: Client[] = [];

  async function seat(user: { cookie: string }, sessionId: string): Promise<Client> {
    const result = await Client.open(url, user.cookie);
    if ('error' in result) throw new Error(result.error.message);
    opened.push(result.client);
    await result.client.joined(sessionId);
    return result.client;
  }

  const removeMember = (id: string) =>
    org.admin.agent.delete(`/api/v1/organizations/${org.orgId}/members/${id}`).expect(204);
  const setRole = (id: string, role: string) =>
    org.admin.agent
      .patch(`/api/v1/organizations/${org.orgId}/members/${id}`)
      .send({ role })
      .expect(200);

  beforeAll(async () => {
    app = await startApp();
    url = await listen(app);
    org = await createLiveOrg(app, 'acc', 3);
  }, 120_000);
  afterEach(() => {
    for (const c of opened.splice(0)) c.close();
  });
  afterAll(async () => {
    await app.close();
  });

  it('removing the host keeps the session and its GameResult (host null); an Admin can still end it', async () => {
    // A dedicated host so removal does not disturb the other tests.
    const tempHost = await signUpVerified(app, 'acc-temphost');
    const tempHostId = await joinOrg(app, org.admin, org.orgId, tempHost, 'host');
    const session = await createSession(org, tempHost, 'Orphan me');
    const host = await seat(tempHost, session.id);
    await host.host(session.id, START_GAME);
    expect((await host.host(session.id, { type: 'end_game' })).status).toBe('accepted');
    const prisma = app.get(PrismaService);
    await poll(async () =>
      (await prisma.gameResult.count({ where: { sessionId: session.id } })) === 1 ? true : null,
    );

    await removeMember(tempHostId);

    const row = await prisma.liveSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(row.hostMembershipId).toBeNull();
    expect(row.organizationId).toBe(org.orgId);
    expect(await prisma.gameResult.count({ where: { sessionId: session.id } })).toBe(1);
    const list = await org.admin.agent
      .get(`/api/v1/organizations/${org.orgId}/sessions`)
      .expect(200);
    const parsed = liveSessionListResponseSchema.parse(list.body);
    expect(parsed.sessions.find((s) => s.id === session.id)?.host).toBeNull();

    const admin = await seat(org.admin, session.id);
    expect(admin.latest.view.me.isHost).toBe(true);
    expect((await admin.host(session.id, { type: 'end_session' })).status).toBe('accepted');
    await poll(async () => {
      const s = await prisma.liveSession.findUniqueOrThrow({ where: { id: session.id } });
      return s.status === 'ENDED' ? s : null;
    });
  });

  it('disconnects a removed member immediately, marks the seat away and sends them nothing more', async () => {
    const victimUser = await signUpVerified(app, 'acc-victim');
    const victimId = await joinOrg(app, org.admin, org.orgId, victimUser, 'participant');
    const session = await createSession(org, org.host);
    const host = await seat(org.host, session.id);
    const victim = await seat(victimUser, session.id);
    await host.waitFor((s) => s.view.participants.length === 2, 3_000);
    const dropped = new Promise<string>((resolve) => victim.socket.once('disconnect', resolve));

    await removeMember(victimId);

    expect(await Promise.race([dropped, sleep(3_000).then(() => 'still-connected')])).not.toBe(
      'still-connected',
    );
    await host.waitFor(
      (s) => s.view.participants.find((p) => p.memberId === victimId)?.connected === false,
      3_000,
      'victim seat away',
    );
    const seen = victim.states.length;
    await host.host(session.id, START_GAME);
    await host.waitFor((s) => s.view.game?.phase === 'question', 3_000);
    await sleep(150);
    expect(victim.states.length).toBe(seen);
    expect(victim.socket.connected).toBe(false);
    // They cannot come back: the membership is gone.
    const again = await Client.open(url, victimUser.cookie);
    if ('client' in again) {
      opened.push(again.client);
      expect(await again.client.join(session.id)).toEqual({
        status: 'rejected',
        code: 'ROOM_NOT_FOUND',
      });
    }
  });

  it('demoting an Admin updates isHost live; host commands become NOT_HOST without reconnecting', async () => {
    const second = await signUpVerified(app, 'acc-admin2');
    const secondId = await joinOrg(app, org.admin, org.orgId, second, 'admin');
    const session = await createSession(org, org.host);
    const host = await seat(org.host, session.id);
    const c = await seat(second, session.id);
    expect(c.latest.view.me.isHost).toBe(true);

    await setRole(secondId, 'participant');

    await c.waitFor((s) => s.view.me.isHost === false, 3_000, 'own isHost false');
    await host.waitFor(
      (s) => s.view.participants.find((p) => p.memberId === secondId)?.isHost === false,
      3_000,
      'others see demotion',
    );
    expect(c.socket.connected).toBe(true);
    expect(await c.host(session.id, START_GAME)).toMatchObject({
      status: 'rejected',
      code: 'NOT_HOST',
    });
  });

  it('promoting a participant makes them host live', async () => {
    const session = await createSession(org, org.host);
    const target = org.members[0]!;
    const host = await seat(org.host, session.id);
    const c = await seat(target.user, session.id);
    expect(c.latest.view.me.isHost).toBe(false);
    expect(await c.host(session.id, START_GAME)).toMatchObject({ code: 'NOT_HOST' });

    await setRole(target.membershipId, 'admin');

    await c.waitFor((s) => s.view.me.isHost === true, 3_000, 'promoted');
    expect((await c.host(session.id, START_GAME)).status).toBe('accepted');
    await host.waitFor((s) => s.view.game?.phase === 'question', 3_000);
    await setRole(target.membershipId, 'participant');
  });
});
