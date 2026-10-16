import { expect, test, type Page } from '@playwright/test';

// Lead-owned regression tests (found 2026-10-16). Auth pages render their forms on the
// server, so they are visible before JavaScript runs. Two failures existed in that window:
// typed values were discarded at submit, and pressing Enter submitted natively with GET,
// putting the password in the URL. JS chunks are delayed here to hold that window open.

async function delayScripts(page: Page, ms: number): Promise<void> {
  await page.route('**/_next/static/chunks/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue();
  });
}

test('values typed before hydration are kept and submitted', async ({ page }) => {
  await delayScripts(page, 2_500);
  await page.goto('/sign-up', { waitUntil: 'commit' });
  await page.getByLabel(/^Your name/).fill('Early Typist');
  await page.getByLabel(/^Work email/).fill('not-an-email');
  await page.waitForLoadState('networkidle');

  await page.getByLabel(/^Password/).fill('a-perfectly-long-password');
  await page.getByRole('button', { name: 'Create account' }).click();

  // The early-typed name is kept and valid; the early-typed email is what got validated.
  await expect(page.getByLabel(/^Your name/)).toHaveValue('Early Typist');
  await expect(page.getByLabel(/^Your name/)).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel(/^Work email/)).toHaveAttribute('aria-invalid', 'true');
});

for (const path of ['/sign-in', '/sign-up']) {
  test(`pressing Enter before hydration on ${path} never puts credentials in the URL`, async ({
    page,
  }) => {
    await delayScripts(page, 4_000);
    await page.goto(path, { waitUntil: 'commit' });
    const password = page.getByLabel(/^Password/);
    await password.fill('secret-before-hydration');
    await password.press('Enter');
    await page.waitForTimeout(1_000);
    expect(page.url()).not.toContain('secret-before-hydration');
    expect(new URL(page.url()).search).toBe('');
  });
}
