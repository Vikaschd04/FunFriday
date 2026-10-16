import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { auditListResponseSchema, teamListResponseSchema } from '@funfriday/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/infra/database/prisma.service.js';
import { startApp } from './app-harness.js';
import {
  WEB_ORIGIN,
  createOrg,
  joinOrg,
  signUpVerified,
  uniqueEmail,
} from './identity-fixtures.js';

describe('teams, tenant integrity and audit log', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await startApp({ webOrigins: [WEB_ORIGIN] });
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await app.close();
  });

  it('creates, lists, fills and deletes teams; duplicate names are 409', async () => {
    const admin = await signUpVerified(app, 'team-admin');
    const member = await signUpVerified(app, 'team-member');
    const orgId = await createOrg(admin, 'Team Org');
    const memberId = await joinOrg(app, admin, orgId, member, 'participant');
    const base = `/api/v1/organizations/${orgId}/teams`;

    const created = await admin.agent.post(base).send({ name: '  Design  ' }).expect(201);
    expect(created.body).toMatchObject({ name: 'Design', members: [] });
    const dup = await admin.agent.post(base).send({ name: 'Design' }).expect(409);
    expect(dup.body.code).toBe('CONFLICT');
    await admin.agent.post(base).send({ name: 'D' }).expect(400);

    const added = await admin.agent
      .post(`${base}/${created.body.id}/members`)
      .send({ memberId })
      .expect(200);
    expect(added.body.members).toEqual([{ memberId, name: member.name }]);
    // Idempotent re-add.
    await admin.agent.post(`${base}/${created.body.id}/members`).send({ memberId }).expect(200);

    const list = teamListResponseSchema.parse((await member.agent.get(base).expect(200)).body);
    expect(list.teams).toHaveLength(1);

    await admin.agent.delete(`${base}/${created.body.id}/members/${memberId}`).expect(204);
    await admin.agent.delete(`${base}/${created.body.id}/members/${memberId}`).expect(404);
    await admin.agent.delete(`${base}/${created.body.id}`).expect(204);
    await admin.agent.delete(`${base}/${created.body.id}`).expect(404);

    const entries = auditListResponseSchema.parse(
      (await admin.agent.get(`/api/v1/organizations/${orgId}/audit`).expect(200)).body,
    ).entries;
    const actions = entries.map((e) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'team.created',
        'team.member_added',
        'team.member_removed',
        'team.deleted',
      ]),
    );
    // Idempotent re-add wrote exactly one team.member_added row.
    expect(actions.filter((a) => a === 'team.member_added')).toHaveLength(1);
    expect(entries.find((e) => e.action === 'team.member_added')!.metadata).toEqual({
      teamName: 'Design',
      memberId,
    });
    expect(entries.find((e) => e.action === 'team.member_removed')!.metadata).toEqual({
      teamName: 'Design',
      memberId,
    });
    expect(entries.find((e) => e.action === 'team.created')!.metadata).toEqual({ name: 'Design' });
  });

  it('API refuses a member who is still only INVITED, and a member from another organisation', async () => {
    const admin = await signUpVerified(app, 'team2-admin');
    const other = await signUpVerified(app, 'team2-other');
    const orgId = await createOrg(admin, 'Team Org Two');
    const otherOrgId = await createOrg(other, 'Other Org Two');
    const team = await admin.agent
      .post(`/api/v1/organizations/${orgId}/teams`)
      .send({ name: 'Ops' })
      .expect(201);
    const invited = await admin.agent
      .post(`/api/v1/organizations/${orgId}/members`)
      .send({ email: uniqueEmail('invited'), role: 'participant' })
      .expect(201);
    const conflict = await admin.agent
      .post(`/api/v1/organizations/${orgId}/teams/${team.body.id}/members`)
      .send({ memberId: invited.body.member.id })
      .expect(409);
    expect(conflict.body.code).toBe('CONFLICT');

    const foreign = await other.agent
      .get(`/api/v1/organizations/${otherOrgId}/members`)
      .expect(200);
    await admin.agent
      .post(`/api/v1/organizations/${orgId}/teams/${team.body.id}/members`)
      .send({ memberId: foreign.body.members[0].id })
      .expect(404);
    await admin.agent
      .post(`/api/v1/organizations/${orgId}/teams/${team.body.id}/members`)
      .send({ memberId: 'nope' })
      .expect(400);
  });

  it('the database itself rejects a cross-organisation TeamMember (composite FK)', async () => {
    const adminA = await signUpVerified(app, 'fk-a');
    const adminB = await signUpVerified(app, 'fk-b');
    const orgA = await createOrg(adminA, 'FK Org A');
    const orgB = await createOrg(adminB, 'FK Org B');
    const team = await adminA.agent
      .post(`/api/v1/organizations/${orgA}/teams`)
      .send({ name: 'FK Team' })
      .expect(201);
    const bMembership = await prisma.membership.findFirstOrThrow({
      where: { organizationId: orgB },
    });

    // Same-organisation insert works...
    const aMembership = await prisma.membership.findFirstOrThrow({
      where: { organizationId: orgA },
    });
    await prisma.teamMember.create({
      data: { organizationId: orgA, teamId: team.body.id, membershipId: aMembership.id },
    });
    // ...but a membership of organisation B cannot join organisation A's team, whichever
    // organisation id the row claims.
    for (const organizationId of [orgA, orgB]) {
      await expect(
        prisma.teamMember.create({
          data: { organizationId, teamId: team.body.id, membershipId: bMembership.id },
        }),
      ).rejects.toThrow();
    }
    await expect(
      prisma.$executeRaw`INSERT INTO team_members (organization_id, team_id, membership_id)
        VALUES (${orgA}::uuid, ${team.body.id}::uuid, ${bMembership.id}::uuid)`,
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it('database CHECK constraints reject inconsistent memberships and upper-case invites', async () => {
    const admin = await signUpVerified(app, 'check-admin');
    const orgId = await createOrg(admin, 'Check Org');
    await expect(
      prisma.membership.create({
        data: {
          organizationId: orgId,
          invitedEmail: 'x@example.test',
          role: 'HOST',
          status: 'ACTIVE',
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.membership.create({
        data: {
          organizationId: orgId,
          invitedEmail: 'UPPER@example.test',
          role: 'HOST',
          status: 'INVITED',
        },
      }),
    ).rejects.toThrow();
  });

  describe('audit log', () => {
    it('is admin-only, newest first, paged by an opaque cursor at 50 per page', async () => {
      const admin = await signUpVerified(app, 'audit-admin');
      const host = await signUpVerified(app, 'audit-host');
      const orgId = await createOrg(admin, 'Audit Org');
      await joinOrg(app, admin, orgId, host, 'host');
      const base = `/api/v1/organizations/${orgId}`;
      // 1 (org created) + added + invitation.sent + claimed + 55 teams = 59 entries.
      for (let i = 0; i < 55; i += 1) {
        await admin.agent
          .post(`${base}/teams`)
          .send({ name: `Team ${String(i).padStart(2, '0')}` })
          .expect(201);
      }
      await host.agent.get(`${base}/audit`).expect(403);

      const page1 = auditListResponseSchema.parse(
        (await admin.agent.get(`${base}/audit`).expect(200)).body,
      );
      expect(page1.entries).toHaveLength(50);
      expect(page1.nextCursor).toEqual(expect.any(String));
      expect(page1.entries[0]!.action).toBe('team.created');
      expect(page1.entries[0]!.metadata).toEqual({ name: 'Team 54' });
      expect(page1.entries[0]!.actor.name).toBe(admin.name);

      const page2 = auditListResponseSchema.parse(
        (await admin.agent.get(`${base}/audit`).query({ cursor: page1.nextCursor! }).expect(200))
          .body,
      );
      expect(page2.entries).toHaveLength(9);
      expect(page2.nextCursor).toBeNull();
      expect(page2.entries.at(-1)!.action).toBe('organization.created');
      const ids = [...page1.entries, ...page2.entries].map((e) => e.id);
      expect(new Set(ids).size).toBe(59);
      const times = [...page1.entries, ...page2.entries].map((e) => e.createdAt);
      expect([...times].sort().reverse()).toEqual(times);
    });

    it('rejects garbage cursors with 400 and cannot read another organisation through a cursor', async () => {
      const admin = await signUpVerified(app, 'cursor-admin');
      const orgId = await createOrg(admin, 'Cursor Org');
      const res = await admin.agent
        .get(`/api/v1/organizations/${orgId}/audit`)
        .query({ cursor: 'not-a-cursor' })
        .expect(400);
      expect(res.body.details.fieldErrors.cursor).toEqual(['Invalid cursor.']);
      const forged = Buffer.from(
        JSON.stringify({ t: new Date().toISOString(), i: randomUUID() }),
      ).toString('base64url');
      const page = await admin.agent
        .get(`/api/v1/organizations/${orgId}/audit`)
        .query({ cursor: forged })
        .expect(200);
      expect(page.body.entries.every((e: { targetId: string }) => e.targetId === orgId)).toBe(true);
    });
  });
});
