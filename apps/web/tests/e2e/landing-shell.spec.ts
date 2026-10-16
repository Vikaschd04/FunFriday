import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoHorizontalScroll, expectNoSeriousAxeViolations } from './helpers';

const operational = (page: Page) => page.getByText('All systems operational', { exact: true });

test.describe('landing', () => {
  test('renders the hero and honest preview framing', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('FunFriday - Connect Beyond Work');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Good teams work together. Great teams connect.',
    );
    await expect(page.getByText('Preview build - nothing is sent or shared')).toBeVisible();
    await expect(
      page.getByText('Illustration of the planner. Sample plan is fictional.'),
    ).toBeVisible();
    // P2: a real sign-in link exists; joining with a code is still not offered.
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    await expect(page.getByRole('link', { name: /join with a code/i })).toHaveCount(0);
  });

  test('CTAs navigate', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('main').getByRole('link', { name: 'Plan a FunFriday' }).click();
    await expect(page).toHaveURL(/\/app\/events\/new$/);
    // Let each screen finish loading before a full navigation interrupts it.
    await expect(page.getByRole('heading', { level: 1, name: 'Plan a FunFriday' })).toBeVisible();
    await page.goto('/');
    await page.getByRole('link', { name: 'Explore activities' }).first().click();
    await expect(page).toHaveURL(/\/app\/library$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Activities' })).toBeVisible();
    await page.goto('/');
    await page.getByRole('link', { name: 'System status' }).click();
    await expect(page).toHaveURL(/\/status$/);
    await expect(page.getByRole('heading', { level: 1, name: 'System status' })).toBeVisible();
  });

  test('every internal link resolves with HTTP 200', async ({ page, request }) => {
    const pages = ['/', '/status', '/app', '/app/library', '/app/events/new'];
    const hrefs = new Set<string>();
    for (const path of pages) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const found = await page
        .locator('a[href^="/"]')
        .evaluateAll((anchors) =>
          anchors.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''),
        );
      for (const href of found) hrefs.add(href.split('#')[0] ?? '');
    }
    expect(hrefs.size).toBeGreaterThan(4);
    for (const href of hrefs) {
      const response = await request.get(href === '' ? '/' : href);
      expect(response.status(), href).toBe(200);
    }
  });
});

test.describe('status page', () => {
  test('reaches operational against the real API and has no axe issues', async ({ page }) => {
    await page.goto('/status');
    await expect(page).toHaveTitle('System status - FunFriday');
    await expect(operational(page)).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('list', { name: 'Dependency checks' }).getByRole('listitem'),
    ).toHaveCount(2);
    await expectNoSeriousAxeViolations(page);
  });

  test('Check again works from the keyboard and keeps focus', async ({ page }) => {
    await page.goto('/status');
    await expect(operational(page)).toBeVisible({ timeout: 15_000 });
    const button = page.getByRole('button', { name: 'Check again' });
    await button.focus();
    for (const key of ['Enter', 'Space']) {
      const refetch = page.waitForRequest('**/health/ready');
      await page.keyboard.press(key);
      await refetch;
      await expect(operational(page)).toBeVisible({ timeout: 15_000 });
      await expect(button).toBeFocused();
    }
  });

  test('shows the unreachable state when the API request fails', async ({ page }) => {
    await page.route('**/health/ready', (route) => route.abort('connectionrefused'));
    await page.goto('/status');
    await expect(page.getByText('API unreachable', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Check again' })).toBeEnabled();
  });
});

test.describe('app shell', () => {
  const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary' });

  test('sidebar at 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    const box = await page.locator('[data-app-nav]').boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(264);
    await expect(nav(page).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav(page).getByRole('link', { name: 'Activities' })).not.toHaveAttribute(
      'aria-current',
    );
    await expect(page.getByRole('link', { name: 'Plan a FunFriday' }).first()).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Account and workspace menu' }).filter({ visible: true }),
    ).toHaveCount(1);
  });

  test('rail with visible labels at 900', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('/app/library');
    const box = await page.locator('[data-app-nav]').boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(96);
    await expect(nav(page).getByRole('link', { name: 'Activities' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    for (const label of ['Dashboard', 'Activities', 'Plan event']) {
      await expect(
        nav(page).getByText(label, { exact: true }).filter({ visible: true }),
      ).toBeVisible();
    }
  });

  test('bottom tab bar at 390', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/app/events/new');
    const aside = page.locator('[data-app-nav]');
    const box = await aside.boundingBox();
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(800);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);
    expect(Math.round(box?.width ?? 0)).toBe(390);
    await expect(nav(page).getByRole('link', { name: 'Plan', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const links = nav(page).getByRole('link');
    for (let i = 0; i < (await links.count()); i++) {
      const b = await links.nth(i).boundingBox();
      expect(b?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(b?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test('route changes move focus to the new page heading', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 1, name: 'Your Fridays' })).toBeVisible();
    await nav(page).getByRole('link', { name: 'Activities' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Activities' })).toBeFocused();
    await nav(page).getByRole('link', { name: 'Plan event' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Plan a FunFriday' })).toBeFocused();
    await nav(page).getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Your Fridays' })).toBeFocused();
  });

  test('primary navigation is not wrapped in a complementary landmark', async ({ page }) => {
    await page.goto('/app');
    await expect(nav(page)).toBeVisible();
    await expect(page.getByRole('complementary')).toHaveCount(0);
  });

  test('skip link is the first tab stop and moves focus to main', async ({ page, browserName }) => {
    await page.goto('/app');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    if (browserName === 'webkit') {
      // Safari leaves links out of the Tab order unless Option+Tab is used, so focus it directly.
      await skip.focus();
    } else {
      await page.keyboard.press('Tab');
    }
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
  });
});

test.describe('404', () => {
  test('shows the not-found page with working actions', async ({ page }) => {
    const response = await page.goto('/definitely-not-a-page');
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { level: 1, name: "We can't find that page" }),
    ).toBeVisible();
    await expect(page.getByText('The link may be old or mistyped.')).toBeVisible();
    await expectNoSeriousAxeViolations(page);
    await page.getByRole('link', { name: 'Go to dashboard' }).click();
    await expect(page).toHaveURL(/\/app$/);
  });
});

test.describe('320px and axe on static screens', () => {
  for (const path of ['/', '/status', '/app', '/definitely-not-a-page']) {
    test(`${path}: no horizontal scroll at 320 and no serious axe issues`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (path === '/status') await expect(operational(page)).toBeVisible({ timeout: 15_000 });
      await expectNoHorizontalScroll(page);
      await expectNoSeriousAxeViolations(page);
    });
  }

  test('landing and dashboard axe at desktop width', async ({ page }) => {
    for (const path of ['/', '/app']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoSeriousAxeViolations(page);
    }
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('landing renders and entrance animation is off', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const name = await page
      .locator('.ff-enter')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe('none');
  });
  test('app screens render', async ({ page }) => {
    await page.goto('/app/library');
    await expect(page.getByRole('article').first()).toBeVisible();
    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 1, name: 'Your Fridays' })).toBeVisible();
  });
});
