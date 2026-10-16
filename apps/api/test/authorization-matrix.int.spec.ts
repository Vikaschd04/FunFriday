import type { NestExpressApplication } from '@nestjs/platform-express';
import { apiErrorSchema } from '@funfriday/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp } from './app-harness.js';
import {
  type TestUser,
  WEB_ORIGIN,
  createOrg,
  joinOrg,
  signUpVerified,
  uniqueEmail,
} from './identity-fixtures.js';

type Method = 'get' | 'post' | 'patch' | 'delete';
interface Fixture {
  orgId: string;
  otherOrgId: string;
  admin: TestUser;
  host: TestUser;
  participant: TestUser;
  outsider: TestUser;
  participantMembershipId: string;
  /** Fresh resources created through the API, so every case starts from a known state. */
  newTeam: () => Promise<string>;
  newInvitedMember: () => Promise<string>;
}
interface Prepared {
  path: string;
  body?: Record<string, unknown>;
}
interface Case {
  name: string;
  method: Method;
  prepare: (f: Fixture) => Prepared | Promise<Prepared>;
  /** Expected status for participant, host, admin. */
  expected: [number, number, number];
}

const base = (f: Fixture) => `/api/v1/organizations/${f.orgId}`;

const cases: Case[] = [
  {
    name: 'GET organization',
    method: 'get',
    prepare: (f) => ({ path: base(f) }),
    expected: [200, 200, 200],
  },
  {
    name: 'GET members',
    method: 'get',
    prepare: (f) => ({ path: `${base(f)}/members` }),
    expected: [200, 200, 200],
  },
  {
    name: 'POST members',
    method: 'post',
    prepare: (f) => ({
      path: `${base(f)}/members`,
      body: { email: uniqueEmail('matrix'), role: 'participant' },
    }),
    expected: [403, 403, 201],
  },
  {
    name: 'PATCH members/:id',
    method: 'patch',
    prepare: async (f) => ({
      path: `${base(f)}/members/${await f.newInvitedMember()}`,
      body: { role: 'host' },
    }),
    expected: [403, 403, 200],
  },
  {
    name: 'DELETE members/:id',
    method: 'delete',
    prepare: async (f) => ({ path: `${base(f)}/members/${await f.newInvitedMember()}` }),
    expected: [403, 403, 204],
  },
  {
    name: 'GET teams',
    method: 'get',
    prepare: (f) => ({ path: `${base(f)}/teams` }),
    expected: [200, 200, 200],
  },
  {
    name: 'POST teams',
    method: 'post',
    prepare: (f) => ({
      path: `${base(f)}/teams`,
      body: { name: `Team ${uniqueEmail('t')}` },
    }),
    expected: [403, 201, 201],
  },
  {
    name: 'DELETE teams/:id',
    method: 'delete',
    prepare: async (f) => ({ path: `${base(f)}/teams/${await f.newTeam()}` }),
    expected: [403, 204, 204],
  },
  {
    name: 'POST teams/:id/members',
    method: 'post',
    prepare: async (f) => ({
      path: `${base(f)}/teams/${await f.newTeam()}/members`,
      body: { memberId: f.participantMembershipId },
    }),
    expected: [403, 200, 200],
  },
  {
    name: 'DELETE teams/:id/members/:memberId',
    method: 'delete',
    prepare: async (f) => {
      const teamId = await f.newTeam();
      await f.admin.agent
        .post(`${base(f)}/teams/${teamId}/members`)
        .send({ memberId: f.participantMembershipId })
        .expect(200);
      return { path: `${base(f)}/teams/${teamId}/members/${f.participantMembershipId}` };
    },
    expected: [403, 204, 204],
  },
  {
    name: 'GET audit',
    method: 'get',
    prepare: (f) => ({ path: `${base(f)}/audit` }),
    expected: [403, 403, 200],
  },
];

describe('authorization matrix for every org-scoped route', () => {
  let app: NestExpressApplication;
  let f: Fixture;

  beforeAll(async () => {
    app = await startApp({ webOrigins: [WEB_ORIGIN] });
    const admin = await signUpVerified(app, 'mx-admin');
    const host = await signUpVerified(app, 'mx-host');
    const participant = await signUpVerified(app, 'mx-part');
    const outsider = await signUpVerified(app, 'mx-out');
    const orgId = await createOrg(admin, 'Matrix Org A');
    const otherOrgId = await createOrg(outsider, 'Matrix Org B');
    await joinOrg(app, admin, orgId, host, 'host');
    const participantMembershipId = await joinOrg(app, admin, orgId, participant, 'participant');
    f = {
      orgId,
      otherOrgId,
      admin,
      host,
      participant,
      outsider,
      participantMembershipId,
      newTeam: async () => {
        const res = await admin.agent
          .post(`/api/v1/organizations/${orgId}/teams`)
          .send({ name: `Fixture ${uniqueEmail('team')}` })
          .expect(201);
        return res.body.id as string;
      },
      newInvitedMember: async () => {
        const res = await admin.agent
          .post(`/api/v1/organizations/${orgId}/members`)
          .send({ email: uniqueEmail('spare'), role: 'participant' })
          .expect(201);
        return res.body.member.id as string;
      },
    };
  });
  afterAll(async () => {
    await app.close();
  });

  const send = (agent: TestUser['agent'], method: Method, p: Prepared) => {
    const req = agent[method](p.path);
    return p.body ? req.send(p.body) : req;
  };

  describe.each(cases)('$name', (c) => {
    it('unauthenticated -> 401 UNAUTHENTICATED', async () => {
      const prepared = await c.prepare(f);
      const res = await send(request.agent(app.getHttpServer()), c.method, prepared);
      expect(res.status).toBe(401);
      expect(apiErrorSchema.parse(res.body).code).toBe('UNAUTHENTICATED');
    });

    it('member of another organisation -> 404 NOT_FOUND (no existence leak)', async () => {
      const prepared = await c.prepare(f);
      const res = await send(f.outsider.agent, c.method, prepared);
      expect(res.status).toBe(404);
      expect(apiErrorSchema.parse(res.body).code).toBe('NOT_FOUND');
    });

    it('malformed or unknown organisation id -> 404 for a signed-in user', async () => {
      const prepared = await c.prepare(f);
      for (const fake of ['not-a-uuid', '00000000-0000-4000-8000-000000000000']) {
        const res = await send(f.admin.agent, c.method, {
          ...prepared,
          path: prepared.path.replace(f.orgId, fake),
        });
        expect(res.status).toBe(404);
      }
    });

    it.each([
      ['participant', 0],
      ['host', 1],
      ['admin', 2],
    ] as const)('%s -> expected status', async (role, index) => {
      const prepared = await c.prepare(f);
      const res = await send(f[role].agent, c.method, prepared);
      expect(res.status).toBe(c.expected[index]);
      if (res.status === 403) {
        expect(apiErrorSchema.parse(res.body).code).toBe('FORBIDDEN');
      }
    });
  });

  describe('cross-tenant resource ids', () => {
    it("a foreign organisation's team id is 404 inside my own organisation", async () => {
      const foreignTeam = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${f.otherOrgId}/teams`)
        .set('Cookie', f.outsider.cookie)
        .set('Origin', WEB_ORIGIN)
        .send({ name: 'Foreign Team' })
        .expect(201);
      const foreignTeamId = foreignTeam.body.id as string;
      await f.admin.agent.delete(`${base(f)}/teams/${foreignTeamId}`).expect(404);
      await f.admin.agent
        .post(`${base(f)}/teams/${foreignTeamId}/members`)
        .send({ memberId: f.participantMembershipId })
        .expect(404);
      // The foreign team is untouched.
      const list = await f.outsider.agent
        .get(`/api/v1/organizations/${f.otherOrgId}/teams`)
        .expect(200);
      expect(list.body.teams.map((t: { id: string }) => t.id)).toContain(foreignTeamId);
    });

    it("a foreign organisation's membership id is 404 for PATCH, DELETE and team adds", async () => {
      const foreign = await f.outsider.agent
        .get(`/api/v1/organizations/${f.otherOrgId}/members`)
        .expect(200);
      const foreignMemberId = foreign.body.members[0].id as string;
      await f.admin.agent
        .patch(`${base(f)}/members/${foreignMemberId}`)
        .send({ role: 'host' })
        .expect(404);
      await f.admin.agent.delete(`${base(f)}/members/${foreignMemberId}`).expect(404);
      const teamId = await f.newTeam();
      await f.admin.agent
        .post(`${base(f)}/teams/${teamId}/members`)
        .send({ memberId: foreignMemberId })
        .expect(404);
      const still = await f.outsider.agent
        .get(`/api/v1/organizations/${f.otherOrgId}/members`)
        .expect(200);
      expect(still.body.members[0].role).toBe('admin');
    });

    it('a malformed member or team id inside my organisation is 404, not 400/500', async () => {
      await f.admin.agent
        .patch(`${base(f)}/members/xyz`)
        .send({ role: 'host' })
        .expect(404);
      await f.admin.agent.delete(`${base(f)}/teams/xyz`).expect(404);
    });
  });

  it('forged role escalation: a participant cannot promote itself', async () => {
    await f.participant.agent
      .patch(`${base(f)}/members/${f.participantMembershipId}`)
      .send({ role: 'admin' })
      .expect(403);
    const me = await f.participant.agent.get(`${base(f)}`).expect(200);
    expect(me.body.myRole).toBe('participant');
  });
});
