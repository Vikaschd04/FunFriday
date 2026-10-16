import {
  anonTest as test,
  API_BASE,
  createOrgViaApi,
  expect,
  joinOrganizationAs,
  newActor,
  newSpoofedContext,
  newUser,
  openInvitationFromMailbox,
  randomIp,
  signUpViaApi,
  verifyEmailViaApi,
  WEB_ORIGIN,
} from './fixtures';
import { expectNoHorizontalScroll, expectNoSeriousAxeViolations } from './helpers';

async function adminInvites(
  browser: import('@playwright/test').Browser,
  baseURL: string,
  email: string,
) {
  const admin = await newActor(browser, baseURL, 'Admin Ana');
  await verifyEmailViaApi(admin.context.request, admin.user.email);
  const org = await createOrgViaApi(admin.context.request, 'Acme (fictional)');
  const added = await admin.context.request.post(`${API_BASE}/organizations/${org.id}/members`, {
    headers: { Origin: WEB_ORIGIN, 'X-Forwarded-For': randomIp() },
    data: { email, role: 'participant' },
  });
  expect(added.status(), await added.text()).toBeLessThan(300);
  return admin;
}

test.describe('invitation links', () => {
  test('signed-out invitee: sign up, come back, join - no separate verification', async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const origin = baseURL ?? WEB_ORIGIN;
    const invitee = newUser('Ivy Invitee');
    const admin = await adminInvites(browser, origin, invitee.email);
    const context = await newSpoofedContext(browser, origin);
    const page = await context.newPage();

    await openInvitationFromMailbox(page, invitee.email);
    // The token is taken out of the URL at once.
    await expect(page).toHaveURL(`${origin}/invitations/accept`);
    await expect(page).toHaveTitle('Join an organisation - FunFriday');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Join your organisation' }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Sign in or create an account using the email address this invitation was sent to.',
      ),
    ).toBeVisible();
    await expect(page.getByText(invitee.email)).toHaveCount(0);
    await expectNoSeriousAxeViolations(page);
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await expectNoHorizontalScroll(page);
    }

    await page.getByRole('link', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/sign-up\?next=%2Finvitations%2Faccept$/);
    // Plain fills: auth forms keep anything typed before hydration (see hydration-safety.spec.ts).
    await page.getByLabel(/^Your name/).fill(invitee.name);
    await page.getByLabel(/^Work email/).fill(invitee.email);
    await page.getByLabel(/^Password/).fill(invitee.password);
    await page.getByRole('button', { name: 'Create account' }).click();

    // Sign-up hashes a password, which is slow when three browsers share the API.
    await expect(page).toHaveURL(`${origin}/invitations/accept`, { timeout: 20_000 });
    await expect(
      page.getByRole('heading', { level: 1, name: 'Join Acme (fictional)' }),
    ).toBeVisible();
    await expect(page.getByText('as Participant')).toBeVisible();
    await expectNoSeriousAxeViolations(page);
    await page.getByRole('button', { name: 'Join Acme (fictional)' }).click();

    await page.waitForURL(/\/app\?joined=1$/);
    await expect(
      page.getByRole('status').filter({ hasText: 'You joined Acme (fictional)' }),
    ).toBeVisible();
    // Accepting verified the email: no verification prompt.
    await expect(page.getByText('Verify your email address')).toHaveCount(0);
    await page.goto('/app/settings/members');
    await expect(page.getByRole('heading', { level: 3, name: /Admin Ana/ })).toBeVisible();

    await admin.context.close();
    await context.close();
  });

  test('wrong account sees a mismatch and nothing joins; a used link is invalid', async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const origin = baseURL ?? WEB_ORIGIN;
    const invitee = newUser('Ivy Invitee');
    const admin = await adminInvites(browser, origin, invitee.email);

    const wrong = await newActor(browser, origin, 'Wanda Wrong');
    await openInvitationFromMailbox(wrong.page, invitee.email);
    await expect(wrong.page).toHaveURL(`${origin}/invitations/accept`);
    await expect(
      wrong.page.getByText(
        'This invitation was sent to a different email address. Sign out and use the right account.',
      ),
    ).toBeVisible();
    await expect(wrong.page.getByRole('button', { name: /^Join/ })).toHaveCount(0);
    await expect(wrong.page.getByText(invitee.email)).toHaveCount(0);
    await expectNoSeriousAxeViolations(wrong.page);
    await wrong.page.goto('/app/settings/members');
    await expect(wrong.page.getByText("You're not in an organisation yet")).toBeVisible();

    // The right account joins through the same link.
    const rightContext = await newSpoofedContext(browser, origin);
    await signUpViaApi(rightContext.request, invitee);
    const right = await rightContext.newPage();
    await joinOrganizationAs(right, invitee);
    await expect(right.getByText('Acme (fictional)').first()).toBeVisible();

    // Reusing the link: not valid any more.
    await openInvitationFromMailbox(right, invitee.email);
    await expect(
      right.getByText("This invitation link isn't valid or has already been used."),
    ).toBeVisible();
    await expectNoSeriousAxeViolations(right);

    // A malformed or missing token never reaches the join step.
    await right.goto('/invitations/accept?token=nope');
    await expect(right).toHaveURL(`${origin}/invitations/accept`);
    await expect(
      right.getByText("This invitation link isn't valid or has already been used."),
    ).toBeVisible();

    await admin.context.close();
    await wrong.context.close();
    await rightContext.close();
  });
});
