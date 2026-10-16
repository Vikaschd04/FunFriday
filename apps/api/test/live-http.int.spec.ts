import type { NestExpressApplication } from '@nestjs/platform-express';
import { liveSessionListResponseSchema, liveSessionSummarySchema } from '@funfriday/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/infra/database/prisma.service.js';
import { RoomCodes } from '../src/modules/live/sessions.service.js';
import { startApp } from './app-harness.js';
import { createOrg, newAgent, signUpVerified } from './identity-fixtures.js';
import { type LiveOrg, createLiveOrg, createSession } from './live-helpers.js';

describe('live sessions HTTP', () => {
  let app: NestExpressApplication;
  let org: LiveOrg;

  beforeAll(async () => {
    app = await startApp();
    org = await createLiveOrg(app, 'http', 1);
  });
  afterAll(async () => {
    await app.close();
  });

  it('lets a HOST create a session; the response matches the contract', async () => {
    const res = await org.host.agent
      .post(`/api/v1/organizations/${org.orgId}/sessions`)
      .send({ title: 'Friday social' })
      .expect(201);
    const summary = liveSessionSummarySchema.parse(res.body);
    expect(summary.status).toBe('lobby');
    expect(summary.roomCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(summary.host?.memberId).toBe(org.hostMembershipId);
    expect(summary.organizationId).toBe(org.orgId);
  });

  it('lets an ADMIN create one and defaults the title', async () => {
    const res = await org.admin.agent
      .post(`/api/v1/organizations/${org.orgId}/sessions`)
      .send({})
      .expect(201);
    expect(liveSessionSummarySchema.parse(res.body).title).toContain("'s session");
  });

  it('rejects an invalid title with 400', async () => {
    await org.host.agent
      .post(`/api/v1/organizations/${org.orgId}/sessions`)
      .send({ title: 'x' })
      .expect(400);
  });

  it('403 for a participant, 404 for a non-member, 401 without a session', async () => {
    const [p] = org.members;
    await p!.user.agent.post(`/api/v1/organizations/${org.orgId}/sessions`).send({}).expect(403);
    const outsider = await signUpVerified(app, 'http-outsider');
    await outsider.agent.post(`/api/v1/organizations/${org.orgId}/sessions`).send({}).expect(404);
    await outsider.agent.get(`/api/v1/organizations/${org.orgId}/sessions`).expect(404);
    await newAgent(app).post(`/api/v1/organizations/${org.orgId}/sessions`).send({}).expect(401);
  });

  it('lists not-ended sessions for any member, newest first, and hides ended ones', async () => {
    const ended = await createSession(org, org.host, 'Old one');
    await app.get(PrismaService).liveSession.update({
      where: { id: ended.id },
      data: { status: 'ENDED', endedAt: new Date() },
    });
    const open = await createSession(org, org.host, 'Still open');
    const res = await org.members[0]!.user.agent.get(
      `/api/v1/organizations/${org.orgId}/sessions`,
    ).expect(200);
    const list = liveSessionListResponseSchema.parse(res.body);
    const ids = list.sessions.map((s) => s.id);
    expect(ids).toContain(open.id);
    expect(ids).not.toContain(ended.id);
    expect(ids[0]).toBe(open.id);
  });

  it('only lists sessions of the requested organisation', async () => {
    const other = await signUpVerified(app, 'http-otherorg');
    const otherOrg = await createOrg(other, 'Other org');
    await createSession({ orgId: otherOrg }, other, 'Other session');
    const res = await org.host.agent.get(`/api/v1/organizations/${org.orgId}/sessions`).expect(200);
    expect(
      res.body.sessions.every((s: { organizationId: string }) => s.organizationId === org.orgId),
    ).toBe(true);
  });

  it('joins by code (lowercase accepted) for a member; the same code is 404 for non-members and unknown codes', async () => {
    const session = await createSession(org, org.host, 'Code room');
    const member = org.members[0]!.user;
    const ok = await member.agent
      .post('/api/v1/sessions/join-by-code')
      .send({ code: session.roomCode.toLowerCase() })
      .expect(200);
    expect(ok.body).toEqual({ sessionId: session.id, organizationId: org.orgId });

    const outsider = await signUpVerified(app, 'http-codeoutsider');
    const foreign = await outsider.agent
      .post('/api/v1/sessions/join-by-code')
      .send({ code: session.roomCode })
      .expect(404);
    const unknown = await outsider.agent
      .post('/api/v1/sessions/join-by-code')
      .send({ code: 'ZZZZZZ' })
      .expect(404);
    expect(foreign.body.code).toBe(unknown.body.code);
    expect(foreign.body.message).toBe(unknown.body.message);

    await member.agent.post('/api/v1/sessions/join-by-code').send({ code: '0OIl1!' }).expect(400);
    await newAgent(app)
      .post('/api/v1/sessions/join-by-code')
      .send({ code: session.roomCode })
      .expect(401);
  });

  it('a code stops resolving once the session has ended and can then be reused', async () => {
    const session = await createSession(org, org.host, 'Short lived');
    await app.get(PrismaService).liveSession.update({
      where: { id: session.id },
      data: { status: 'ENDED', endedAt: new Date() },
    });
    await org.host.agent
      .post('/api/v1/sessions/join-by-code')
      .send({ code: session.roomCode })
      .expect(404);
    const reused = await app.get(PrismaService).liveSession.create({
      data: {
        organizationId: org.orgId,
        hostMembershipId: org.hostMembershipId,
        title: 'Reuse',
        roomCode: session.roomCode,
      },
    });
    expect(reused.roomCode).toBe(session.roomCode);
  });

  it('retries on a room-code collision', async () => {
    const taken = await createSession(org, org.host, 'Collision victim');
    const codes = app.get(RoomCodes);
    const original = codes.next.bind(codes);
    const queue = [taken.roomCode, taken.roomCode];
    codes.next = () => queue.shift() ?? original();
    try {
      const created = await createSession(org, org.host, 'Collision winner');
      expect(created.roomCode).not.toBe(taken.roomCode);
      expect(queue).toHaveLength(0);
    } finally {
      codes.next = original;
    }
  });

  it('the database refuses a duplicate open code, a bad alphabet and a cross-org host', async () => {
    const prisma = app.get(PrismaService);
    const session = await createSession(org, org.host, 'DB rules');
    const base = {
      organizationId: org.orgId,
      hostMembershipId: org.hostMembershipId,
      title: 'Dup',
    };
    await expect(
      prisma.liveSession.create({ data: { ...base, roomCode: session.roomCode } }),
    ).rejects.toThrow();
    await expect(
      prisma.liveSession.create({ data: { ...base, roomCode: 'AAAAA0' } }),
    ).rejects.toThrow();
    const other = await signUpVerified(app, 'http-dbother');
    const otherOrg = await createOrg(other, 'DB other org');
    await expect(
      prisma.liveSession.create({
        data: { ...base, organizationId: otherOrg, roomCode: 'BBBBBB' },
      }),
    ).rejects.toThrow();
  });

  it('throttles join-by-code to 10 attempts per minute', async () => {
    const outsider = await signUpVerified(app, 'http-throttle');
    const statuses: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      const res = await outsider.agent
        .post('/api/v1/sessions/join-by-code')
        .send({ code: 'ZZZZZZ' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 404)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });
});
