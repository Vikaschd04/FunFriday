import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { MeResponse, OrgRole } from '@funfriday/contracts';
import request from 'supertest';
import { PrismaService } from '../src/infra/database/prisma.service.js';

export const WEB_ORIGIN = 'http://localhost:3000';
export const TEST_PASSWORD = 'correct-horse-battery-staple';

let ipCounter = 0;
/** Unique synthetic client IP per agent so rate limits never bleed between tests. */
export function nextIp(): string {
  ipCounter += 1;
  return `10.${Math.floor(ipCounter / 250) % 250}.${ipCounter % 250}.${Math.floor(Math.random() * 200) + 1}`;
}

export type Agent = ReturnType<typeof request.agent>;

export function newAgent(app: NestExpressApplication, ip = nextIp()): Agent {
  return request.agent(app.getHttpServer()).set('X-Forwarded-For', ip).set('Origin', WEB_ORIGIN);
}

export interface TestUser {
  agent: Agent;
  ip: string;
  email: string;
  name: string;
  userId: string;
  /** Raw Cookie header value for hand-built requests. */
  cookie: string;
}

export const uniqueEmail = (label: string): string =>
  `${label}-${randomUUID().slice(0, 8)}@example.test`;

/** Signs up a synthetic user (auto sign-in), returning an agent holding the session cookie. */
export async function signUp(
  app: NestExpressApplication,
  label: string,
  overrides: { email?: string; password?: string; ip?: string } = {},
): Promise<TestUser> {
  const ip = overrides.ip ?? nextIp();
  const email = overrides.email ?? uniqueEmail(label);
  const agent = newAgent(app, ip);
  const name = `Test ${label}`;
  const res = await agent
    .post('/api/v1/auth/sign-up/email')
    .send({ name, email, password: overrides.password ?? TEST_PASSWORD })
    .expect(200);
  const cookies = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  const cookie = cookies.map((c) => c.split(';')[0]).join('; ');
  return { agent, ip, email, name, userId: res.body.user.id as string, cookie };
}

/** Marks an email verified directly in the DB (fast path; the link flow has its own test). */
export async function markVerified(app: NestExpressApplication, email: string): Promise<void> {
  await app.get(PrismaService).user.update({ where: { email }, data: { emailVerified: true } });
}

export async function signUpVerified(
  app: NestExpressApplication,
  label: string,
): Promise<TestUser> {
  const user = await signUp(app, label);
  await markVerified(app, user.email);
  return user;
}

export async function createOrg(user: TestUser, name: string): Promise<string> {
  const res = await user.agent.post('/api/v1/organizations').send({ name }).expect(201);
  return res.body.id as string;
}

/** Reads the one-time invitation token from the latest invitation mail (what the invitee's link carries). */
export async function invitationTokenFor(
  app: NestExpressApplication,
  email: string,
): Promise<string> {
  const mail = await app.get(PrismaService).notificationOutbox.findFirstOrThrow({
    where: { recipient: email, subject: { startsWith: "You're invited" } },
    orderBy: { createdAt: 'desc' },
  });
  const link = /https?:\/\/\S+/.exec(mail.body)![0];
  return new URL(link).searchParams.get('token')!;
}

/** Admin invites `member` by email; the member (signed in) accepts with the emailed token. Returns membership id. */
export async function joinOrg(
  app: NestExpressApplication,
  admin: TestUser,
  orgId: string,
  member: TestUser,
  role: OrgRole,
): Promise<string> {
  const added = await admin.agent
    .post(`/api/v1/organizations/${orgId}/members`)
    .send({ email: member.email, role })
    .expect(201);
  const token = await invitationTokenFor(app, member.email);
  await member.agent.post('/api/v1/invitations/accept').send({ token }).expect(200);
  const me = await member.agent.get('/api/v1/me').expect(200);
  const memberships = (me.body as MeResponse).memberships;
  if (!memberships.some((m) => m.organization.id === orgId)) {
    throw new Error('invitation was not accepted');
  }
  return added.body.member.id as string;
}
