import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// `exact` because the polite live region repeats the title inside a longer sentence.
const operational = (page: Page) => page.getByText('All systems operational', { exact: true });

/** Wait for entrance animations (finite) so axe measures settled colors, not mid-fade blends. */
async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(finite.map((animation) => animation.finished));
  });
}

test.describe('home page', () => {
  test('shows brand heading and tagline', async ({ page }) => {
    await page.goto('/');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toContainText('FunFriday');
    await expect(h1).toContainText('Good teams work together. Great teams connect.');
    await expect(
      page.getByText('Connect Beyond Work. Play Together. Grow Together.'),
    ).toBeVisible();
  });

  test('status panel reaches operational against the real API', async ({ page }) => {
    await page.goto('/');
    await expect(operational(page)).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('list', { name: 'Dependency checks' }).getByRole('listitem'),
    ).toHaveCount(2);
  });

  test('Check again is keyboard reachable and activates with Enter and Space', async ({ page }) => {
    await page.goto('/');
    await expect(operational(page)).toBeVisible({ timeout: 15_000 });
    const button = page.getByRole('button', { name: 'Check again' });
    await expect(button).toBeEnabled();

    // First Tab stop is the skip link; Tab again until the button is focused.
    for (let i = 0; i < 5 && !(await button.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press('Tab');
    }
    await expect(button).toBeFocused();

    for (const key of ['Enter', 'Space']) {
      const refetch = page.waitForRequest('**/health/ready');
      await page.keyboard.press(key);
      await refetch;
      await expect(operational(page)).toBeVisible({ timeout: 15_000 });
      await expect(button).toBeEnabled();
      // Focus must survive the check (WCAG 2.4.3); the button is aria-disabled, never `disabled`.
      await expect(button).toBeFocused();
    }
  });

  test('has no serious or critical axe violations', async ({ page }) => {
    await page.goto('/');
    await expect(operational(page)).toBeVisible({ timeout: 15_000 });
    await settleAnimations(page);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    // Report every failing node so a regression is actionable from the CI log alone.
    const report = blocking.flatMap((v) =>
      v.nodes.map((n) => `${v.id} @ ${n.target.join(' ')}: ${n.failureSummary ?? ''}`),
    );
    expect(report).toEqual([]);
  });

  test('does not scroll horizontally at 320x640', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('shows the unreachable state when the API request fails', async ({ page }) => {
    await page.route('**/health/ready', (route) => route.abort('connectionrefused'));
    await page.goto('/');
    await expect(page.getByText('API unreachable', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Check again' })).toBeEnabled();
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('still renders the status', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'System status' })).toBeVisible();
      await expect(operational(page)).toBeVisible({ timeout: 15_000 });
    });
  });
});
