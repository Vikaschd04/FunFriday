import { randomUUID } from 'node:crypto';
import {
  expect,
  test as playwrightTest,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';

export const WEB_ORIGIN = 'http://localhost:3000';
export const API_BASE = 'http://localhost:4000/api/v1';
export const PASSWORD = 'correct-horse-battery-1';

export interface TestUser {
  name: string;
  email: string;
  password: string;
}

export function newUser(name = 'Test User'): TestUser {
  return { name, email: `user-${randomUUID()}@example.test`, password: PASSWORD };
}

/**
 * The API rate-limits per client IP (5 sign-ups and 5 sign-ins a minute, 300 requests overall).
 * E2E starts the API with TRUST_PROXY=true so each test can present its own client IP; real
 * limits are unchanged and are covered by the API's integration tests plus one UI test below.
 */
export function randomIp(): string {
  const bytes = randomUUID().replaceAll('-', '');
  return `10.${parseInt(bytes.slice(0, 2), 16)}.${parseInt(bytes.slice(2, 4), 16)}.${parseInt(bytes.slice(4, 6), 16)}`;
}

/** Makes every browser request to the API in this context come from one synthetic client IP. */
export async function spoofClientIp(context: BrowserContext, ip = randomIp()): Promise<string> {
  await context.route(`${API_BASE}/**`, (route) =>
    route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': ip } }),
  );
  return ip;
}

export async function newSpoofedContext(
  browser: Browser,
  baseURL: string,
): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL });
  await spoofClientIp(context);
  return context;
}

const apiHeaders = () => ({ Origin: WEB_ORIGIN, 'X-Forwarded-For': randomIp() });

/** Signs the user up through the real API; the session cookie lands in the context's jar. */
export async function signUpViaApi(request: APIRequestContext, user: TestUser): Promise<void> {
  const response = await request.post(`${API_BASE}/auth/sign-up/email`, {
    headers: apiHeaders(),
    data: { name: user.name, email: user.email, password: user.password },
  });
  expect(response.status(), await response.text()).toBe(200);
}

export async function signInViaApi(request: APIRequestContext, user: TestUser): Promise<void> {
  const response = await request.post(`${API_BASE}/auth/sign-in/email`, {
    headers: apiHeaders(),
    data: { email: user.email, password: user.password },
  });
  expect(response.status(), await response.text()).toBe(200);
}

export async function createOrgViaApi(
  request: APIRequestContext,
  name: string,
): Promise<{ id: string; name: string }> {
  const response = await request.post(`${API_BASE}/organizations`, {
    headers: apiHeaders(),
    data: { name },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as { id: string; name: string };
}

/** Test with a synthetic client IP but no session: for sign-up / sign-in flows. */
export const anonTest = playwrightTest.extend<object>({
  context: async ({ context }, provide) => {
    await spoofClientIp(context);
    await provide(context);
  },
});

/** Test whose browser context already holds a fresh signed-up user's session. */
export const test = anonTest.extend<{ user: TestUser }>({
  user: [
    async ({ context }, provide) => {
      const user = newUser();
      await signUpViaApi(context.request, user);
      await provide(user);
    },
    { auto: true },
  ],
});

export { expect };

/** Opens the dev mailbox UI and clicks `linkName` on the newest message addressed to `email`. */
async function openMailboxLink(page: Page, email: string, linkName: RegExp): Promise<void> {
  await page.goto('/dev/mailbox');
  // Newest first. The invitation and verification emails are separate messages.
  const message = page
    .getByRole('article')
    .filter({ hasText: email })
    .filter({ has: page.getByRole('link', { name: linkName }) })
    .first();
  await expect(async () => {
    if ((await message.count()) === 0) {
      await page.getByRole('button', { name: 'Refresh' }).click();
    }
    await expect(message).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await message.getByRole('link', { name: linkName }).click();
}

/** Opens the dev mailbox UI and follows the verification link addressed to `email`. */
export async function verifyEmailViaMailbox(page: Page, email: string): Promise<void> {
  await openMailboxLink(page, email, /Verify email/);
  await page.waitForURL(/\/app\?verified=1/);
}

/** Opens the invitation link addressed to `email` from the dev mailbox UI. */
export async function openInvitationFromMailbox(page: Page, email: string): Promise<void> {
  await openMailboxLink(page, email, /Open invitation/);
}

/**
 * The step where an invited person becomes a member: signed in as the invitee, open the
 * invitation link from the dev mailbox, press Join. (Accepting also verifies their email.)
 */
export async function joinOrganizationAs(page: Page, user: TestUser): Promise<void> {
  await openInvitationFromMailbox(page, user.email);
  await page.getByRole('button', { name: /^Join / }).click();
  await page.waitForURL(/\/app\?joined=1/);
}

/** Fast-path verification for set-up steps that are not the thing under test. */
export async function verifyEmailViaApi(request: APIRequestContext, email: string): Promise<void> {
  let link: string | undefined;
  await expect(async () => {
    const response = await request.get(`${API_BASE}/dev/mailbox`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      messages: { to: string; links: string[] }[];
    };
    link = body.messages.find((m) => m.to === email)?.links[0];
    expect(link).toBeTruthy();
  }).toPass({ timeout: 15_000 });
  // Following the link verifies the address and redirects to the web app; the cookie is set.
  await request.get(link ?? '');
}

export interface Actor {
  user: TestUser;
  context: BrowserContext;
  page: Page;
}

export async function newActor(browser: Browser, baseURL: string, name: string): Promise<Actor> {
  const context = await newSpoofedContext(browser, baseURL);
  const user = newUser(name);
  await signUpViaApi(context.request, user);
  return { user, context, page: await context.newPage() };
}

/**
 * Admin creates an organisation and adds `memberName` (a participant) through the real UI-less
 * API path; the member verifies and ends up active. Returns both actors, signed in.
 */
export async function seedOrgWithMember(
  browser: Browser,
  baseURL: string,
  orgName = 'Acme (fictional)',
): Promise<{ admin: Actor; member: Actor; orgId: string }> {
  const admin = await newActor(browser, baseURL, 'Admin Ana');
  await verifyEmailViaApi(admin.context.request, admin.user.email);
  const org = await createOrgViaApi(admin.context.request, orgName);
  const member = await newActor(browser, baseURL, 'Member Mia');
  const added = await admin.context.request.post(`${API_BASE}/organizations/${org.id}/members`, {
    headers: apiHeaders(),
    data: { email: member.user.email, role: 'participant' },
  });
  expect(added.status(), await added.text()).toBeLessThan(300);
  await joinOrganizationViaApi(member, org.id);
  return { admin, member, orgId: org.id };
}

/** API twin of joinOrganizationAs, for set-up: reads the emailed token and accepts it. */
export async function joinOrganizationViaApi(member: Actor, _orgId: string): Promise<void> {
  let token = '';
  await expect(async () => {
    const response = await member.context.request.get(`${API_BASE}/dev/mailbox`);
    const body = (await response.json()) as { messages: { to: string; links: string[] }[] };
    const link = body.messages
      .filter((m) => m.to === member.user.email)
      .flatMap((m) => m.links)
      .find((l) => l.includes('/invitations/accept'));
    token = link ? (new URL(link).searchParams.get('token') ?? '') : '';
    expect(token).toHaveLength(43);
  }).toPass({ timeout: 15_000 });
  const accepted = await member.context.request.post(`${API_BASE}/invitations/accept`, {
    headers: apiHeaders(),
    data: { token },
  });
  expect(accepted.status(), await accepted.text()).toBe(200);
}
