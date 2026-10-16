import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  acceptInvitationResponseSchema,
  apiErrorSchema,
  auditListResponseSchema,
  invitationPreviewResponseSchema,
  meResponseSchema,
} from '@funfriday/contracts';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { hashInvitationToken } from '../src/modules/identity/domain/invitation-token.js';
import { PrismaService } from '../src/infra/database/prisma.service.js';
import { startApp } from './app-harness.js';
import {
  WEB_ORIGIN,
  createOrg,
  invitationTokenFor,
  newAgent,
  signUp,
  signUpVerified,
  uniqueEmail,
} from './identity-fixtures.js';

describe('invitation tokens (D026)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await startApp({ webOrigins: [WEB_ORIGIN] });
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const invite = async (adminLabel: string, inviteeLabel: string, role = 'host') => {
    const admin = await signUpVerified(app, adminLabel);
    const orgId = await createOrg(admin, `Org ${adminLabel}`);
    const invitee = await signUp(app, inviteeLabel); // account exists, email NOT verified
    await admin.agent
      .post(`/api/v1/organizations/${orgId}/members`)
      .send({ email: invitee.email, role })
      .expect(201);
    const token = await invitationTokenFor(app, invitee.email);
    return { admin, orgId, invitee, token };
  };

  const audit = async (admin: Awaited<ReturnType<typeof signUp>>, orgId: string) =>
    auditListResponseSchema.parse(
      (await admin.agent.get(`/api/v1/organizations/${orgId}/audit`).expect(200)).body,
    ).entries;

  it('happy path: link from the dev mailbox -> preview -> accept -> member, email verified, audited', async () => {
    const { admin, orgId, invitee } = await invite('hp-admin', 'hp-invitee', 'host');

    const mailbox = await request(app.getHttpServer()).get('/api/v1/dev/mailbox').expect(200);
    const mail = (mailbox.body.messages as { to: string; subject: string; links: string[] }[]).find(
      (m) => m.to === invitee.email && m.subject.startsWith("You're invited"),
    );
    expect(mail!.subject).toBe("You're invited to join Org hp-admin on FunFriday");
    const link = new URL(mail!.links[0]!);
    expect(`${link.origin}${link.pathname}`).toBe(`${WEB_ORIGIN}/invitations/accept`);
    const token = link.searchParams.get('token')!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // The database holds only a hash.
    const row = await prisma.membership.findFirstOrThrow({
      where: { organizationId: orgId, invitedEmail: invitee.email },
    });
    expect(row.inviteTokenHash).toBe(hashInvitationToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.inviteExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 13 * 24 * 3600 * 1000);
    expect(row.invitedByUserId).toBe(admin.userId);

    // Before accepting: /me never claims, and the org is invisible.
    const before = meResponseSchema.parse((await invitee.agent.get('/api/v1/me').expect(200)).body);
    expect(before.memberships).toEqual([]);
    expect(before.needsEmailVerification).toBe(true);
    await invitee.agent.get(`/api/v1/organizations/${orgId}`).expect(404);

    const preview = invitationPreviewResponseSchema.parse(
      (await invitee.agent.post('/api/v1/invitations/preview').send({ token }).expect(200)).body,
    );
    expect(preview).toMatchObject({ emailMatches: true, alreadyMember: false, role: 'host' });
    expect(preview.organization.id).toBe(orgId);
    expect(JSON.stringify(preview)).not.toContain(invitee.email);

    const accepted = acceptInvitationResponseSchema.parse(
      (await invitee.agent.post('/api/v1/invitations/accept').send({ token }).expect(200)).body,
    );
    expect(accepted).toMatchObject({ role: 'host', organization: { id: orgId } });

    const after = meResponseSchema.parse((await invitee.agent.get('/api/v1/me').expect(200)).body);
    expect(after.user.emailVerified).toBe(true);
    expect(after.needsEmailVerification).toBe(false);
    expect(after.memberships.map((m) => m.organization.id)).toEqual([orgId]);
    await invitee.agent.get(`/api/v1/organizations/${orgId}`).expect(200);

    const done = await prisma.membership.findUniqueOrThrow({ where: { id: row.id } });
    expect(done).toMatchObject({
      status: 'ACTIVE',
      userId: invitee.userId,
      inviteTokenHash: null,
      inviteExpiresAt: null,
    });

    const entries = await audit(admin, orgId);
    expect(entries.map((e) => e.action)).toEqual(
      expect.arrayContaining([
        'organization.created',
        'membership.added',
        'invitation.sent',
        'membership.claimed',
      ]),
    );
    expect(entries.find((e) => e.action === 'invitation.sent')!.metadata).toEqual({ role: 'host' });
    expect(JSON.stringify(entries)).not.toContain(token);
  });

  it('PRE-HIJACK: an attacker who pre-registered the victim email gets nothing from the victim verifying it', async () => {
    const admin = await signUpVerified(app, 'ph-admin');
    const orgId = await createOrg(admin, 'Pre-hijack Org');
    const victimEmail = uniqueEmail('victim');
    const attacker = await signUp(app, 'attacker', { email: victimEmail }); // unverified, attacker's password
    await admin.agent
      .post(`/api/v1/organizations/${orgId}/members`)
      .send({ email: victimEmail, role: 'admin' })
      .expect(201);

    // The victim clicks the verification mail the attacker's sign-up triggered.
    const verification = await prisma.notificationOutbox.findFirstOrThrow({
      where: { recipient: victimEmail, subject: { startsWith: 'Verify' } },
    });
    const link = new URL(/https?:\/\/\S+/.exec(verification.body)![0]);
    await request(app.getHttpServer())
      .get(`${link.pathname}${link.search}`)
      .redirects(0)
      .expect(302);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { email: victimEmail } })).emailVerified,
    ).toBe(true);

    // The attacker's account is now verified, yet /me grants nothing and the org stays invisible.
    const me = meResponseSchema.parse((await attacker.agent.get('/api/v1/me').expect(200)).body);
    expect(me.memberships).toEqual([]);
    await attacker.agent.get(`/api/v1/organizations/${orgId}`).expect(404);
    await attacker.agent.get(`/api/v1/organizations/${orgId}/members`).expect(404);

    // Without the emailed token (missing, malformed or forged) joining is impossible.
    await attacker.agent.post('/api/v1/invitations/accept').send({}).expect(400);
    await attacker.agent.post('/api/v1/invitations/accept').send({ token: 'short' }).expect(400);
    const forged = Buffer.alloc(32, 7).toString('base64url');
    await attacker.agent.post('/api/v1/invitations/accept').send({ token: forged }).expect(404);
    await attacker.agent.post('/api/v1/invitations/preview').send({ token: forged }).expect(404);
    await attacker.agent.get(`/api/v1/organizations/${orgId}`).expect(404);
    const row = await prisma.membership.findFirstOrThrow({
      where: { organizationId: orgId, invitedEmail: victimEmail },
    });
    expect(row.status).toBe('INVITED');
  });

  it('wrong-account accept is 403 INVITE_EMAIL_MISMATCH and changes nothing; the right account still succeeds', async () => {
    const { orgId, invitee, token } = await invite('wa-admin', 'wa-invitee');
    const other = await signUp(app, 'wa-other');
    const preview = await other.agent
      .post('/api/v1/invitations/preview')
      .send({ token })
      .expect(200);
    expect(preview.body.emailMatches).toBe(false);
    const res = await other.agent.post('/api/v1/invitations/accept').send({ token }).expect(403);
    expect(apiErrorSchema.parse(res.body).code).toBe('INVITE_EMAIL_MISMATCH');
    const row = await prisma.membership.findFirstOrThrow({
      where: { inviteTokenHash: hashInvitationToken(token) },
    });
    expect(row).toMatchObject({ status: 'INVITED', userId: null });
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { email: other.email } })).emailVerified,
    ).toBe(false);
    await invitee.agent.post('/api/v1/invitations/accept').send({ token }).expect(200);
    await invitee.agent.get(`/api/v1/organizations/${orgId}`).expect(200);
  });

  it('a used token is 404 on reuse', async () => {
    const { invitee, token } = await invite('ru-admin', 'ru-invitee');
    await invitee.agent.post('/api/v1/invitations/accept').send({ token }).expect(200);
    await invitee.agent.post('/api/v1/invitations/accept').send({ token }).expect(404);
    await invitee.agent.post('/api/v1/invitations/preview').send({ token }).expect(404);
  });

  it('an expired token is 410 INVITE_EXPIRED for preview and accept', async () => {
    const { invitee, token, orgId } = await invite('ex-admin', 'ex-invitee');
    await prisma.membership.update({
      where: { inviteTokenHash: hashInvitationToken(token) },
      data: { inviteExpiresAt: new Date(Date.now() - 1000) },
    });
    const preview = await invitee.agent
      .post('/api/v1/invitations/preview')
      .send({ token })
      .expect(410);
    expect(apiErrorSchema.parse(preview.body).code).toBe('INVITE_EXPIRED');
    await invitee.agent.post('/api/v1/invitations/accept').send({ token }).expect(410);
    await invitee.agent.get(`/api/v1/organizations/${orgId}`).expect(404);
  });

  it('concurrent double-accept yields exactly one success', async () => {
    const { invitee, token, orgId } = await invite('cc-admin', 'cc-invitee');
    const second = newAgent(app, invitee.ip).set('Cookie', invitee.cookie);
    const results = await Promise.all([
      invitee.agent.post('/api/v1/invitations/accept').send({ token }),
      second.post('/api/v1/invitations/accept').send({ token }),
      second.post('/api/v1/invitations/accept').send({ token }),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s !== 200).every((s) => s === 404 || s === 409)).toBe(true);
    expect(
      await prisma.membership.count({ where: { organizationId: orgId, userId: invitee.userId } }),
    ).toBe(1);
    const claims = await prisma.auditLog.findMany({
      where: { organizationId: orgId, action: 'membership.claimed' },
    });
    expect(claims).toHaveLength(1);
  });

  it('409 when the account is already an active member of that organisation', async () => {
    const { invitee, token, orgId } = await invite('am-admin', 'am-invitee');
    // Give the account an ACTIVE membership under a different invited address (DB-level setup).
    await prisma.membership.create({
      data: {
        organizationId: orgId,
        userId: invitee.userId,
        invitedEmail: uniqueEmail('old'),
        role: 'PARTICIPANT',
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });
    const preview = await invitee.agent
      .post('/api/v1/invitations/preview')
      .send({ token })
      .expect(200);
    expect(preview.body.alreadyMember).toBe(true);
    const res = await invitee.agent.post('/api/v1/invitations/accept').send({ token }).expect(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('requires a session and an allowed Origin; rejects malformed bodies', async () => {
    const { invitee, token } = await invite('au-admin', 'au-invitee');
    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .send({ token })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/invitations/preview')
      .send({ token })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Cookie', invitee.cookie)
      .set('Origin', 'https://evil.example')
      .send({ token })
      .expect(403);
    const row = await prisma.membership.findFirstOrThrow({
      where: { inviteTokenHash: hashInvitationToken(token) },
    });
    expect(row.status).toBe('INVITED');
  });

  it('throttles preview and accept to 10 per minute per client', async () => {
    const user = await signUp(app, 'thr-user');
    const forged = Buffer.alloc(32, 9).toString('base64url');
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      statuses.push(
        (await user.agent.post('/api/v1/invitations/preview').send({ token: forged })).status,
      );
    }
    expect(statuses.slice(0, 10).every((s) => s === 404)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('never logs the token or the invited address while inviting and accepting', async () => {
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
    const { invitee, token } = await invite('lg-admin', 'lg-invitee');
    await invitee.agent.post('/api/v1/invitations/preview').send({ token }).expect(200);
    await invitee.agent.post('/api/v1/invitations/accept').send({ token }).expect(200);
    await invitee.agent.post('/api/v1/invitations/accept').send({ token }).expect(404);
    const everything = captured.join('\n');
    expect(everything).toContain('dev mail queued');
    expect(everything).not.toContain(token);
    expect(everything).not.toContain(invitee.email);
  });

  it('DB refuses an ACTIVE membership that still carries a token hash', async () => {
    const { orgId, invitee, token } = await invite('db-admin', 'db-invitee');
    await expect(
      prisma.membership.update({
        where: { inviteTokenHash: hashInvitationToken(token) },
        data: { status: 'ACTIVE', userId: invitee.userId, joinedAt: new Date() },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.membership.create({
        data: {
          organizationId: orgId,
          invitedEmail: uniqueEmail('raw'),
          role: 'HOST',
          status: 'INVITED',
          inviteTokenHash: 'not-a-hash',
          inviteExpiresAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });
});
