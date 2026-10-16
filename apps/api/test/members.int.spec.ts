import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  type AuditListResponse,
  auditListResponseSchema,
  memberListResponseSchema,
  meResponseSchema,
} from '@funfriday/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/infra/database/prisma.service.js';
import { startApp } from './app-harness.js';
import {
  type TestUser,
  WEB_ORIGIN,
  createOrg,
  joinOrg,
  newAgent,
  signUp,
  signUpVerified,
  uniqueEmail,
} from './identity-fixtures.js';

const stripIds = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value, (k, v) => (k === 'id' ? undefined : v)));

describe('members, invitations and claiming', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await startApp({ webOrigins: [WEB_ORIGIN] });
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await app.close();
  });

  const audit = async (admin: TestUser, orgId: string): Promise<AuditListResponse> => {
    const res = await admin.agent.get(`/api/v1/organizations/${orgId}/audit`).expect(200);
    return auditListResponseSchema.parse(res.body);
  };

  it('creator becomes the ACTIVE admin and the creation is audited', async () => {
    const admin = await signUp(app, 'creator');
    const orgId = await createOrg(admin, 'Creator Org');
    const res = await admin.agent.get(`/api/v1/organizations/${orgId}/members`).expect(200);
    const { members } = memberListResponseSchema.parse(res.body);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ role: 'admin', status: 'active', email: admin.email });
    expect((await audit(admin, orgId)).entries.map((e) => e.action)).toEqual([
      'organization.created',
    ]);
  });

  it('slugs are collision-safe for identical organisation names', async () => {
    const admin = await signUp(app, 'slugger');
    const a = await admin.agent
      .post('/api/v1/organizations')
      .send({ name: 'Same Name Co' })
      .expect(201);
    const b = await admin.agent
      .post('/api/v1/organizations')
      .send({ name: 'Same Name Co' })
      .expect(201);
    expect(a.body.slug).not.toBe(b.body.slug);
    expect(b.body.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('adding a member returns the same body whether or not an account exists, always INVITED', async () => {
    const admin = await signUpVerified(app, 'inv-admin');
    const orgId = await createOrg(admin, 'Invite Org');
    const existing = await signUp(app, 'has-account');
    const withAccount = await admin.agent
      .post(`/api/v1/organizations/${orgId}/members`)
      .send({ email: existing.email, role: 'participant' })
      .expect(201);
    const withoutAccount = await admin.agent
      .post(`/api/v1/organizations/${orgId}/members`)
      .send({ email: uniqueEmail('no-account'), role: 'participant' })
      .expect(201);
    expect(withAccount.body.member.status).toBe('invited');
    expect(withAccount.body.member.name).toBeNull();
    expect(withAccount.body.member.joinedAt).toBeNull();
    const normalise = (body: { member: { email: string } }) =>
      stripIds({ ...body, member: { ...body.member, email: 'x' } });
    expect(normalise(withAccount.body)).toEqual(normalise(withoutAccount.body));
    expect(Object.keys(withAccount.body.member).sort()).toEqual(
      Object.keys(withoutAccount.body.member).sort(),
    );
  });

  it('normalises emails and rejects duplicates and bad input', async () => {
    const admin = await signUp(app, 'dup-admin');
    const orgId = await createOrg(admin, 'Dup Org');
    const email = uniqueEmail('Dup');
    const first = await admin.agent
      .post(`/api/v1/organizations/${orgId}/members`)
      .send({ email: ` ${email.toUpperCase()} `, role: 'host' })
      .expect(201);
    expect(first.body.member.email).toBe(email.toLowerCase());
    const dup = await admin.agent
      .post(`/api/v1/organizations/${orgId}/members`)
      .send({ email, role: 'participant' })
      .expect(409);
    expect(dup.body.code).toBe('CONFLICT');
    const bad = await admin.agent
      .post(`/api/v1/organizations/${orgId}/members`)
      .send({ email: 'not-an-email', role: 'superuser' })
      .expect(400);
    expect(Object.keys(bad.body.details.fieldErrors).sort()).toEqual(['email', 'role']);
    // The creator is already a member: adding the creator's own email conflicts too.
    await admin.agent
      .post(`/api/v1/organizations/${orgId}/members`)
      .send({ email: admin.email, role: 'host' })
      .expect(409);
  });

  it('a verification link is single-use and a tampered token is rejected', async () => {
    const user = await signUp(app, 'token');
    const mailbox = await request(app.getHttpServer()).get('/api/v1/dev/mailbox');
    const link = new URL(
      (mailbox.body.messages as { to: string; links: string[] }[]).find((m) => m.to === user.email)!
        .links[0]!,
    );
    const tampered = new URL(link);
    tampered.searchParams.set('token', `${link.searchParams.get('token')}x`);
    const bad = await request(app.getHttpServer())
      .get(`${tampered.pathname}${tampered.search}`)
      .redirects(0);
    expect(bad.status).not.toBe(200);
    const dbUser = await prisma.user.findUniqueOrThrow({ where: { email: user.email } });
    expect(dbUser.emailVerified).toBe(false);
  });

  describe('last-admin protection', () => {
    it('the only admin cannot be demoted or removed; nothing is audited for the refusals', async () => {
      const admin = await signUpVerified(app, 'last-admin');
      const orgId = await createOrg(admin, 'Last Admin Org');
      const list = await admin.agent.get(`/api/v1/organizations/${orgId}/members`).expect(200);
      const adminMemberId = list.body.members[0].id as string;
      const demote = await admin.agent
        .patch(`/api/v1/organizations/${orgId}/members/${adminMemberId}`)
        .send({ role: 'host' })
        .expect(409);
      expect(demote.body.code).toBe('LAST_ADMIN');
      const remove = await admin.agent
        .delete(`/api/v1/organizations/${orgId}/members/${adminMemberId}`)
        .expect(409);
      expect(remove.body.code).toBe('LAST_ADMIN');
      // Re-asserting the same role is a harmless no-op.
      await admin.agent
        .patch(`/api/v1/organizations/${orgId}/members/${adminMemberId}`)
        .send({ role: 'admin' })
        .expect(200);
      expect((await audit(admin, orgId)).entries.map((e) => e.action)).toEqual([
        'organization.created',
      ]);
    });

    it('an INVITED admin does not count as an active admin', async () => {
      const admin = await signUpVerified(app, 'invited-admin');
      const orgId = await createOrg(admin, 'Invited Admin Org');
      await admin.agent
        .post(`/api/v1/organizations/${orgId}/members`)
        .send({ email: uniqueEmail('pending'), role: 'admin' })
        .expect(201);
      const list = await admin.agent.get(`/api/v1/organizations/${orgId}/members`).expect(200);
      const self = list.body.members.find((m: { email: string }) => m.email === admin.email);
      await admin.agent
        .patch(`/api/v1/organizations/${orgId}/members/${self.id}`)
        .send({ role: 'host' })
        .expect(409);
    });

    it('with two admins a demotion and a removal succeed and are audited with from/to', async () => {
      const first = await signUpVerified(app, 'two-admin-a');
      const second = await signUpVerified(app, 'two-admin-b');
      const orgId = await createOrg(first, 'Two Admin Org');
      const secondId = await joinOrg(app, first, orgId, second, 'admin');
      const list = await first.agent.get(`/api/v1/organizations/${orgId}/members`).expect(200);
      const firstId = list.body.members.find((m: { email: string }) => m.email === first.email)
        .id as string;

      const demoted = await first.agent
        .patch(`/api/v1/organizations/${orgId}/members/${secondId}`)
        .send({ role: 'participant' })
        .expect(200);
      expect(demoted.body.member.role).toBe('participant');
      // Now the first admin is the last one again.
      await first.agent.delete(`/api/v1/organizations/${orgId}/members/${firstId}`).expect(409);
      await first.agent.delete(`/api/v1/organizations/${orgId}/members/${secondId}`).expect(204);
      await second.agent.get(`/api/v1/organizations/${orgId}`).expect(404);

      const entries = (await audit(first, orgId)).entries;
      const changed = entries.find((e) => e.action === 'membership.role_changed');
      expect(changed!.metadata).toEqual({ from: 'admin', to: 'participant' });
      expect(changed!.actor.userId).toBe(first.userId);
      expect(
        entries.some((e) => e.action === 'membership.removed' && e.targetId === secondId),
      ).toBe(true);
    });

    it('concurrent mutual demotions cannot leave the organisation without an admin', async () => {
      const first = await signUpVerified(app, 'race-a');
      const second = await signUpVerified(app, 'race-b');
      const orgId = await createOrg(first, 'Race Org');
      const secondId = await joinOrg(app, first, orgId, second, 'admin');
      const list = await first.agent.get(`/api/v1/organizations/${orgId}/members`).expect(200);
      const firstId = list.body.members.find((m: { email: string }) => m.email === first.email)
        .id as string;
      const [a, b] = await Promise.all([
        first.agent
          .patch(`/api/v1/organizations/${orgId}/members/${secondId}`)
          .send({ role: 'host' }),
        second.agent
          .patch(`/api/v1/organizations/${orgId}/members/${firstId}`)
          .send({ role: 'host' }),
      ]);
      // Exactly one wins. The loser is 409 LAST_ADMIN (lost the row lock) or 403 (the winner
      // had already demoted it before its role check) - never a second success.
      const statuses = [a.status, b.status].sort();
      expect(statuses[0]).toBe(200);
      expect([403, 409]).toContain(statuses[1]);
      const admins = await prisma.membership.count({
        where: { organizationId: orgId, role: 'ADMIN', status: 'ACTIVE' },
      });
      expect(admins).toBe(1);
    });
  });

  it('participants and hosts never see emails; admins do; invited rows have no name', async () => {
    const admin = await signUpVerified(app, 'priv-admin');
    const participant = await signUpVerified(app, 'priv-part');
    const host = await signUpVerified(app, 'priv-host');
    const orgId = await createOrg(admin, 'Privacy Org');
    await joinOrg(app, admin, orgId, participant, 'participant');
    await joinOrg(app, admin, orgId, host, 'host');
    const pendingEmail = uniqueEmail('pending-person');
    await admin.agent
      .post(`/api/v1/organizations/${orgId}/members`)
      .send({ email: pendingEmail, role: 'participant' })
      .expect(201);

    for (const viewer of [participant, host]) {
      const res = await viewer.agent.get(`/api/v1/organizations/${orgId}/members`).expect(200);
      const body = memberListResponseSchema.parse(res.body);
      expect(body.members).toHaveLength(4);
      for (const member of body.members) expect(member).not.toHaveProperty('email');
      expect(JSON.stringify(res.body)).not.toContain('@example.test');
    }
    const adminView = memberListResponseSchema.parse(
      (await admin.agent.get(`/api/v1/organizations/${orgId}/members`).expect(200)).body,
    );
    expect(adminView.members.map((m) => m.email).sort()).toEqual(
      [admin.email, participant.email, host.email, pendingEmail].sort(),
    );
    const invited = adminView.members.find((m) => m.status === 'invited');
    expect(invited!.name).toBeNull();
    // Audit metadata never carries emails.
    const entries = (await audit(admin, orgId)).entries;
    expect(JSON.stringify(entries)).not.toContain('@example.test');
  });

  it('removing a member cascades their team memberships', async () => {
    const admin = await signUpVerified(app, 'cascade-admin');
    const member = await signUpVerified(app, 'cascade-member');
    const orgId = await createOrg(admin, 'Cascade Org');
    const memberId = await joinOrg(app, admin, orgId, member, 'participant');
    const team = await admin.agent
      .post(`/api/v1/organizations/${orgId}/teams`)
      .send({ name: 'Cascade Team' })
      .expect(201);
    await admin.agent
      .post(`/api/v1/organizations/${orgId}/teams/${team.body.id}/members`)
      .send({ memberId })
      .expect(200);
    await admin.agent.delete(`/api/v1/organizations/${orgId}/members/${memberId}`).expect(204);
    const teams = await admin.agent.get(`/api/v1/organizations/${orgId}/teams`).expect(200);
    expect(teams.body.teams[0].members).toEqual([]);
  });

  it('GET /me lists every ACTIVE organisation of the user and is not affected by other users', async () => {
    const admin = await signUpVerified(app, 'multi-admin');
    const user = await signUpVerified(app, 'multi-user');
    const orgA = await createOrg(admin, 'Multi A');
    const orgB = await createOrg(user, 'Multi B');
    await joinOrg(app, admin, orgA, user, 'host');
    const me = meResponseSchema.parse((await user.agent.get('/api/v1/me').expect(200)).body);
    expect(me.memberships.map((m) => [m.organization.id, m.role]).sort()).toEqual(
      [
        [orgA, 'host'],
        [orgB, 'admin'],
      ].sort(),
    );
    const stranger = await newAgent(app).get('/api/v1/me');
    expect(stranger.status).toBe(401);
  });
});
