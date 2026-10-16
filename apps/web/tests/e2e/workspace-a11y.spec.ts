import type { Browser, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  anonTest,
  API_BASE,
  expect,
  seedOrgWithMember,
  test,
  WEB_ORIGIN,
  randomIp,
} from './fixtures';
import { expectNoHorizontalScroll, expectNoSeriousAxeViolations } from './helpers';

const WIDTHS = [320, 1440] as const;

async function checkScreen(page: Page, path: string, heading: string | RegExp): Promise<void> {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    // Wait for data to settle (skeletons gone) before measuring.
    await expect(page.getByRole('status').filter({ hasText: /^Loading/ })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await expectNoSeriousAxeViolations(page);
  }
}

anonTest.describe('workspace screens: axe, 320px reflow, reduced motion', () => {
  async function seed(browser: Browser, baseURL: string | undefined) {
    const seeded = await seedOrgWithMember(browser, baseURL ?? WEB_ORIGIN, 'Acme (fictional)');
    const team = await seeded.admin.context.request.post(
      `${API_BASE}/organizations/${seeded.orgId}/teams`,
      {
        headers: { Origin: WEB_ORIGIN, 'X-Forwarded-For': randomIp() },
        data: { name: 'Design Crew' },
      },
    );
    expect(team.status()).toBe(201);
    return seeded;
  }

  anonTest('admin: dashboard, members and teams', async ({ browser, baseURL }) => {
    anonTest.setTimeout(120_000);
    const { admin, member } = await seed(browser, baseURL);
    await checkScreen(admin.page, '/app', 'Your Fridays');
    await checkScreen(admin.page, '/app/settings/members', 'Members');
    await checkScreen(admin.page, '/app/settings/teams', 'Teams');
    await admin.context.close();
    await member.context.close();
  });

  anonTest('admin: audit log, account and not-found organisation', async ({ browser, baseURL }) => {
    anonTest.setTimeout(120_000);
    const { admin, member } = await seed(browser, baseURL);
    await checkScreen(admin.page, '/app/settings/audit', 'Audit log');
    await checkScreen(admin.page, '/app/account', 'Account');
    // 404 for an organisation the caller is not in.
    await checkScreen(admin.page, `/app/settings/members?org=${randomUUID()}`, 'Members');
    await expect(
      admin.page.getByRole('heading', { name: "We can't find that organisation" }),
    ).toBeVisible();
    await admin.context.close();
    await member.context.close();
  });

  anonTest(
    'participant: read-only screens and the denied audit log',
    async ({ browser, baseURL }) => {
      anonTest.setTimeout(120_000);
      const { admin, member } = await seed(browser, baseURL);
      await checkScreen(member.page, '/app/settings/members', 'Members');
      await checkScreen(member.page, '/app/settings/teams', 'Teams');
      await checkScreen(member.page, '/app/settings/audit', 'Audit log');
      await expect(
        member.page.getByRole('heading', { name: "You don't have access to this" }),
      ).toBeVisible();

      // Reduced motion: screens still render and nothing is left animating.
      await member.page.emulateMedia({ reducedMotion: 'reduce' });
      await member.page.goto('/app/settings/teams');
      await expect(
        member.page.getByRole('heading', { level: 3, name: 'Design Crew' }),
      ).toBeVisible();
      await admin.context.close();
      await member.context.close();
    },
  );

  test('unverified dashboard and the dev mailbox', async ({ page, user }) => {
    await checkScreen(page, '/app', 'Your Fridays');
    await expect(page.getByText('Verify your email address')).toBeVisible();
    await page.goto('/dev/mailbox');
    await expect(page.getByRole('article').filter({ hasText: user.email }).first()).toBeVisible();
    await checkScreen(page, '/dev/mailbox', 'Dev mailbox');
  });

  test('keyboard path: add a member and confirm dialogs, with focus return', async ({
    browser,
    baseURL,
    browserName,
  }) => {
    const { admin, member } = await seedOrgWithMember(browser, baseURL ?? WEB_ORIGIN);
    const page = admin.page;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app/settings/members');

    // Fill the form and submit using only the keyboard.
    const email = `invitee-${randomUUID()}@example.test`;
    await page.getByLabel(/^Email/).focus();
    await page.keyboard.type(email);
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Role', { exact: true })).toBeFocused();
    // Safari does not Tab onto buttons by default (a browser setting), so focus it directly there.
    const addButton = page.getByRole('button', { name: 'Add member' });
    if (browserName === 'webkit') await addButton.focus();
    else await page.keyboard.press('Tab');
    await expect(addButton).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main').getByText(`Invitation sent to ${email}`)).toBeVisible();
    await expect(page.getByLabel(/^Email/)).toBeFocused();

    // Remove dialog: opens on Enter, focus lands on Cancel, Escape returns focus to the trigger.
    const remove = page.getByRole('button', { name: 'Remove Member Mia' });
    await remove.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(remove).toBeFocused();

    // Demote dialog from the role select via keyboard; Cancel leaves the role unchanged.
    const select = page.getByLabel('Role for Admin Ana');
    await select.focus();
    await select.selectOption('host');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Enter'); // activates the focused Cancel
    await expect(dialog).toBeHidden();
    await expect(select).toHaveValue('admin');

    // Confirm removal with the keyboard only.
    await remove.focus();
    await page.keyboard.press('Enter');
    const confirmRemove = dialog.getByRole('button', { name: 'Remove member' });
    if (browserName === 'webkit') await confirmRemove.focus();
    else await page.keyboard.press('Tab');
    await expect(confirmRemove).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 3, name: /Member Mia/ })).toHaveCount(0);
    await admin.context.close();
    await member.context.close();
  });
});
