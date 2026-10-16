import { anonTest as test, expect, newUser, signUpViaApi, verifyEmailViaMailbox } from './fixtures';
import { expectNoHorizontalScroll, expectNoSeriousAxeViolations } from './helpers';

test.describe('sign-up, verification and onboarding', () => {
  test('sign up, verify through the dev mailbox, create an organisation', async ({ page }) => {
    const user = newUser('Pat Newcomer');
    await page.goto('/sign-up');
    await expect(page).toHaveTitle('Create account - FunFriday');
    await page.getByLabel(/^Your name/).fill(user.name);
    await page.getByLabel(/^Work email/).fill(user.email);
    await page.getByLabel(/^Password/).fill(user.password);
    await page.getByRole('button', { name: 'Create account' }).click();

    // Signed in and unverified: dashboard says so, and offers first-run onboarding.
    await page.waitForURL(/\/app$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Your Fridays' })).toBeVisible();
    await expect(page.getByText('Verify your email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resend email' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create your organisation' })).toBeVisible();
    await expect(page.getByText(/not shared with your organisation yet/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open the dev mailbox' })).toBeVisible();

    await page.getByRole('button', { name: 'Resend email' }).click();
    await expect(
      page.getByText(`Verification email sent to ${user.email}.`, { exact: true }).first(),
    ).toBeVisible();

    await verifyEmailViaMailbox(page, user.email);
    await expect(page.getByRole('status').filter({ hasText: 'Email verified' })).toBeVisible();
    await expect(page.getByText('Verify your email address')).toHaveCount(0);

    // Onboarding: validation, then success.
    await page.getByRole('button', { name: 'Create organisation' }).click();
    await expect(page.getByText('Use at least 2 characters.')).toBeVisible();
    await page.getByLabel(/^Organisation name/).fill('Pat Fictional Co');
    await page.getByRole('button', { name: 'Create organisation' }).click();
    await expect(page.getByRole('heading', { name: 'Create your organisation' })).toHaveCount(0);
    await expect(page.getByText('Pat Fictional Co').first()).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Workspace' }).filter({ visible: true }),
    ).toBeVisible();
  });

  test('sign-up form: field errors, password toggle, generic failure for an existing account', async ({
    page,
    context,
  }) => {
    await page.goto('/sign-up');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Enter your name.')).toBeVisible();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(page.getByLabel(/^Your name/)).toBeFocused();

    await page.getByLabel(/^Password/).fill('short');
    await expect(page.getByText(/Use 12-128 characters/)).toBeVisible();
    const toggle = page.getByRole('button', { name: 'Show password' });
    await expect(page.getByLabel(/^Password/)).toHaveAttribute('type', 'password');
    await toggle.click();
    await expect(page.getByLabel(/^Password/)).toHaveAttribute('type', 'text');
    // One stable name; the pressed state carries the toggle.
    await expect(page.getByRole('button', { name: 'Show password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: /Hide password/ })).toHaveCount(0);

    const existing = newUser('Existing Eve');
    await signUpViaApi(context.request, existing);
    await context.clearCookies();
    await page.getByLabel(/^Your name/).fill('Someone Else');
    await page.getByLabel(/^Work email/).fill(existing.email);
    await page.getByLabel(/^Password/).fill(existing.password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(
      page.getByRole('alert').filter({
        hasText: "We couldn't create that account. If you already have one, sign in instead.",
      }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/sign-up/);
  });
});

test.describe('password fields allow paste and password managers (WCAG 3.3.8)', () => {
  for (const [path, autocomplete] of [
    ['/sign-in', 'current-password'],
    ['/sign-up', 'new-password'],
  ] as const) {
    test(`${path}: autocomplete=${autocomplete} and paste is not blocked`, async ({ page }) => {
      await page.goto(path);
      const field = page.getByLabel(/^Password/);
      await expect(field).toHaveAttribute('autocomplete', autocomplete);
      const prevented = await field.evaluate((el) => {
        const data = new DataTransfer();
        data.setData('text/plain', 'pasted-secret-value');
        const event = new ClipboardEvent('paste', {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        });
        el.dispatchEvent(event);
        return event.defaultPrevented;
      });
      expect(prevented).toBe(false);
      await field.fill('pasted-secret-value');
      await expect(field).toHaveValue('pasted-secret-value');
    });
  }
});

test.describe('sign-in and sign-out', () => {
  test('wrong password is generic; success honours next; sign-out ends the session', async ({
    page,
    context,
  }) => {
    const user = newUser('Sign In Sam');
    await signUpViaApi(context.request, user);
    await context.clearCookies();

    await page.goto('/app/account');
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp%2Faccount$/);
    await expect(page).toHaveTitle('Sign in - FunFriday');
    await expect(page.getByRole('link', { name: 'Create an account' })).toBeVisible();
    await expect(page.getByText(/forgot/i)).toHaveCount(0);

    await page.getByLabel(/^Email/).fill(user.email);
    await page.getByLabel(/^Password/).fill('not-the-right-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Email or password is incorrect.' }),
    ).toBeVisible();
    // Keyboard users land on the failure message.
    await expect(page.locator(':focus')).toContainText('Email or password is incorrect.');

    await page.getByLabel(/^Password/).fill(user.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/app\/account$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Account' })).toBeVisible();

    await page
      .getByRole('button', { name: 'Account and workspace menu' })
      .filter({ visible: true })
      .click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in\?signedout=1$/);
    await expect(page.getByText("You've been signed out.")).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeFocused();

    await page.goto('/app');
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp$/);
    await page.goto('/app/settings/members');
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp%2Fsettings%2Fmembers$/);
  });

  test('an unsafe next target is ignored', async ({ page, context }) => {
    const user = newUser('Safe Sally');
    await signUpViaApi(context.request, user);
    await context.clearCookies();
    await page.goto('/sign-in?next=%2F%2Fevil.test%2Fphish');
    await page.getByLabel(/^Email/).fill(user.email);
    await page.getByLabel(/^Password/).fill(user.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/localhost:3000\/app$/);
  });

  test('the API rate limit shows a clear message', async ({ page }) => {
    await page.goto('/sign-in');
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await page.getByLabel(/^Email/).fill(`nobody-${String(attempt)}@example.test`);
      await page.getByLabel(/^Password/).fill('whatever-password');
      const answered = page.waitForResponse((r) => r.url().includes('/auth/sign-in/email'));
      await page.getByRole('button', { name: 'Sign in' }).click();
      expect((await answered).status()).toBe(attempt < 5 ? 401 : 429);
    }
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'Too many attempts. Wait a minute, then try again.' }),
    ).toBeVisible();
  });

  test('public screens: 320px reflow and axe', async ({ page }) => {
    for (const path of ['/sign-in', '/sign-up']) {
      for (const width of [320, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expectNoHorizontalScroll(page);
        await expectNoSeriousAxeViolations(page);
      }
    }
  });
});
