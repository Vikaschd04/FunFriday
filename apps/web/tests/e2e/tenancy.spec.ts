import {
  anonTest as test,
  createOrgViaApi,
  expect,
  joinOrganizationAs,
  newActor,
  verifyEmailViaApi,
} from './fixtures';

test.describe('two users, two browser contexts', () => {
  test('admin adds a member who joins; roles gate what each can see and do', async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(150_000); // two browser contexts, ~40 steps
    const origin = baseURL ?? 'http://localhost:3000';
    const admin = await newActor(browser, origin, 'Admin Ana');
    await verifyEmailViaApi(admin.context.request, admin.user.email);
    const ap = admin.page;

    // Admin creates the organisation through onboarding and adds a participant by email.
    await ap.goto('/app');
    await ap.getByLabel(/^Organisation name/).fill('Acme (fictional)');
    await ap.getByRole('button', { name: 'Create organisation' }).click();
    await expect(ap.getByText('Acme (fictional)').first()).toBeVisible();
    await ap.goto('/app/settings/members');
    await expect(ap).toHaveTitle('Members - FunFriday');

    const member = await newActor(browser, origin, 'Member Mia');
    await ap.getByLabel(/^Email/).fill(member.user.email);
    await ap.getByRole('button', { name: 'Add member' }).click();
    // Same wording whatever the account state of that email.
    await expect(
      ap
        .locator('#main')
        .getByText(`Invitation sent to ${member.user.email}. They'll join after accepting it.`),
    ).toBeVisible();

    // Member verifies through the dev mailbox UI and sees the organisation.
    const mp = member.page;
    await mp.goto('/app');
    await joinOrganizationAs(mp, member.user);
    await expect(mp.getByText('Acme (fictional)').first()).toBeVisible();

    // Participant: read-only members and teams, no emails, no controls.
    await mp.goto('/app/settings/members');
    await expect(mp.getByRole('heading', { level: 3, name: 'Admin Ana' })).toBeVisible();
    await expect(mp.getByRole('heading', { level: 3, name: /Member Mia/ })).toBeVisible();
    await expect(mp.getByText(admin.user.email)).toHaveCount(0);
    await expect(mp.getByText(member.user.email)).toHaveCount(0);
    await expect(mp.getByRole('button', { name: /Add member|Remove/ })).toHaveCount(0);
    await expect(mp.getByRole('combobox')).toHaveCount(0);
    await mp.goto('/app/settings/teams');
    await expect(mp.getByRole('heading', { level: 1, name: 'Teams' })).toBeVisible();
    await expect(mp.getByRole('button', { name: 'Create team' })).toHaveCount(0);
    await expect(mp.getByRole('link', { name: 'Audit log' })).toHaveCount(0);

    // Audit log: the nav hides it and the API's 403 becomes a denied state.
    await mp.goto('/app/settings/audit');
    await expect(mp.getByRole('heading', { name: "You don't have access to this" })).toBeVisible();
    await expect(mp.getByText('Admin Ana added')).toHaveCount(0);

    // Admin promotes the member to Host; the Host can now create a team.
    await ap.goto('/app/settings/members');
    await expect(ap.getByText(member.user.email)).toBeVisible();
    await expect(ap.getByText('Active').first()).toBeVisible();
    await ap.getByLabel('Role for Member Mia').selectOption('host');
    await expect(ap.getByLabel('Role for Member Mia')).toHaveValue('host');

    await mp.goto('/app/settings/teams');
    await mp.getByLabel(/^Team name/).fill('Design Crew');
    await mp.getByRole('button', { name: 'Create team' }).click();
    await expect(mp.getByRole('heading', { level: 3, name: 'Design Crew' })).toBeVisible();
    // Duplicate names are refused with a clear message.
    await mp.getByLabel(/^Team name/).fill('Design Crew');
    await mp.getByRole('button', { name: 'Create team' }).click();
    await expect(mp.getByText(/A team with that name already exists/)).toBeVisible();
    // Hosts still cannot see the audit log or manage members.
    await mp.goto('/app/settings/members');
    await expect(mp.getByRole('button', { name: /Add member/ })).toHaveCount(0);
    await mp.goto('/app/settings/audit');
    await expect(mp.getByRole('heading', { name: "You don't have access to this" })).toBeVisible();

    // Admin: team membership add / remove / delete.
    await ap.goto('/app/settings/teams');
    const add = ap.getByLabel('Add a member to Design Crew');
    await add.selectOption({ label: 'Member Mia' });
    await ap.getByRole('button', { name: 'Add to Design Crew' }).click();
    await expect(
      ap.getByRole('button', { name: 'Remove Member Mia from Design Crew' }),
    ).toBeVisible();
    await ap.getByRole('button', { name: 'Remove Member Mia from Design Crew' }).click();
    await expect(
      ap.getByRole('button', { name: 'Remove Member Mia from Design Crew' }),
    ).toHaveCount(0);
    await ap.getByRole('button', { name: 'Delete team Design Crew' }).click();
    await expect(ap.getByRole('dialog')).toBeVisible();
    await ap.getByRole('button', { name: 'Delete team', exact: true }).click();
    await expect(ap.getByRole('heading', { level: 3, name: 'Design Crew' })).toHaveCount(0);

    // Admin cannot demote the last Admin (themself): the API refuses, the page explains.
    await ap.goto('/app/settings/members');
    await ap.getByLabel('Role for Admin Ana').selectOption('participant');
    const dialog = ap.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Change role' }).click();
    await expect(ap.getByRole('alert').filter({ hasText: 'last Admin' })).toBeVisible();
    await expect(ap.getByLabel('Role for Admin Ana')).toHaveValue('admin');

    // The audit log reads as sentences, never ids.
    await ap.goto('/app/settings/audit');
    await expect(ap).toHaveTitle('Audit log - FunFriday');
    await expect(
      ap.getByText("Admin Ana changed Member Mia's role from Participant to Host"),
    ).toBeVisible();
    await expect(ap.getByText(/created the team "Design Crew"/)).toBeVisible();
    await expect(ap.getByText(/[0-9a-f]{8}-[0-9a-f]{4}-/)).toHaveCount(0);

    // Remove the member: confirm dialog, then they lose access (404 -> no organisation).
    await ap.goto('/app/settings/members');
    await ap.getByRole('button', { name: 'Remove Member Mia' }).click();
    await ap.getByRole('dialog').getByRole('button', { name: 'Remove member' }).click();
    await expect(ap.getByRole('heading', { level: 3, name: /Member Mia/ })).toHaveCount(0);
    await mp.goto('/app/settings/members');
    await expect(mp.getByText("You're not in an organisation yet")).toBeVisible();

    await admin.context.close();
    await member.context.close();
  });

  test('a user from org A sees not-found, never data, for org B', async ({ browser, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:3000';
    const a = await newActor(browser, origin, 'Alice Alpha');
    await verifyEmailViaApi(a.context.request, a.user.email);
    await createOrgViaApi(a.context.request, 'Org Alpha (fictional)');
    const b = await newActor(browser, origin, 'Bob Beta');
    await verifyEmailViaApi(b.context.request, b.user.email);
    const orgB = await createOrgViaApi(b.context.request, 'Org Beta (fictional)');

    const page = a.page;
    // By URL: the API answers 404, the page says so and shows nothing of org B.
    for (const path of ['members', 'teams', 'audit']) {
      await page.goto(`/app/settings/${path}?org=${orgB.id}`);
      await expect(
        page.getByRole('heading', { name: "We can't find that organisation" }),
      ).toBeVisible();
      await expect(page.getByText('Bob Beta')).toHaveCount(0);
      await expect(page.getByText('Org Beta (fictional)')).toHaveCount(0);
    }
    // By localStorage: validated against /me, so it can only select one of A's own organisations.
    await page.goto('/app');
    await page.evaluate((id) => {
      window.localStorage.setItem('funfriday:current-org', id);
    }, orgB.id);
    await page.goto('/app/settings/members');
    await expect(page.getByRole('heading', { level: 3, name: 'Alice Alpha' })).toBeVisible();
    await expect(page.getByText('Bob Beta')).toHaveCount(0);
    await expect(page.getByText('Org Beta (fictional)')).toHaveCount(0);

    await a.context.close();
    await b.context.close();
  });

  test('an organisation switcher appears only with several organisations', async ({
    browser,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://localhost:3000';
    const a = await newActor(browser, origin, 'Switch Sam');
    await verifyEmailViaApi(a.context.request, a.user.email);
    await createOrgViaApi(a.context.request, 'First Org (fictional)');
    const page = a.page;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page
      .getByRole('button', { name: 'Account and workspace menu' })
      .filter({ visible: true })
      .click();
    await expect(page.getByLabel('Organisation')).toHaveCount(0);
    await page.keyboard.press('Escape');

    await createOrgViaApi(a.context.request, 'Second Org (fictional)');
    await page.goto('/app');
    await page
      .getByRole('button', { name: 'Account and workspace menu' })
      .filter({ visible: true })
      .click();
    await page.getByLabel('Organisation').selectOption({ label: 'Second Org (fictional)' });
    await expect(
      page.getByRole('status').filter({ hasText: 'Switched to Second Org (fictional)' }),
    ).toHaveCount(1);
    await page.goto('/app/settings/members');
    await expect(page.getByText(/People in Second Org \(fictional\)/)).toBeVisible();
    expect(
      await page.evaluate(() => window.localStorage.getItem('funfriday:current-org')),
    ).toBeTruthy();
    await a.context.close();
  });
});
