import { expect, test } from '@playwright/test';
import {
  CATALOG_ORDER,
  expectNoHorizontalScroll,
  expectNoSeriousAxeViolations,
  fillBasics,
} from './helpers';

const cards = (page: import('@playwright/test').Page) => page.getByRole('article');

test.describe('library on real data', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/library');
    await expect(cards(page)).toHaveCount(6);
  });

  test('shows six cards in display order with honest availability', async ({ page }) => {
    await expect(page).toHaveTitle('Activities - FunFriday');
    await expect(page.getByRole('heading', { level: 3 })).toHaveText(CATALOG_ORDER);
    await expect(page.getByText('In development')).toHaveCount(6);
    await expect(page.getByText('Showing 6 of 6 activities').first()).toBeVisible();
    // The initial result count is shown but not announced.
    await expect(page.getByRole('status').filter({ hasText: 'Showing 6 of 6' })).toHaveCount(0);
    // Cards are not interactive; the one action is a labelled link.
    await expect(page.getByRole('link', { name: /^Plan with this activity/ })).toHaveCount(6);
  });

  test('search narrows results and announces the count', async ({ page }) => {
    await page.getByRole('searchbox', { name: 'Search activities' }).fill('trivia');
    await expect(cards(page)).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Trivia Rush']);
    await expect(
      page.getByRole('status').filter({ hasText: 'Showing 1 of 6 activities' }),
    ).toHaveCount(1);
    await page.getByRole('searchbox', { name: 'Search activities' }).fill('zzzz');
    await expect(page.getByRole('heading', { name: 'No activities match' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).first().click();
    await expect(cards(page)).toHaveCount(6);
    await expect(page.getByRole('searchbox', { name: 'Search activities' })).toBeFocused();
  });

  test('category chip toggles aria-pressed', async ({ page }) => {
    const chip = page
      .getByRole('group', { name: 'Category' })
      .getByRole('button', { name: 'Quizzes' });
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(cards(page)).toHaveCount(1);
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await expect(cards(page)).toHaveCount(6);
  });

  test('group size 21-50 hides Sketch & Guess and explains why', async ({ page }) => {
    await page.getByLabel('Group size').selectOption('21-50');
    await expect(cards(page)).toHaveCount(5);
    await expect(page.getByRole('heading', { name: 'Sketch & Guess' })).toHaveCount(0);
    await expect(
      page.getByText("Some activities are hidden because they don't fit a group of this size."),
    ).toBeVisible();
    await expect(page.getByText('Works best for 4-30 people')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(cards(page)).toHaveCount(6);
    await expect(page.getByRole('button', { name: 'Clear filters' })).toHaveCount(0);
    // The Clear button disappeared: focus moves to the search field.
    await expect(page.getByRole('searchbox', { name: 'Search activities' })).toBeFocused();
  });

  test('duration filter works', async ({ page }) => {
    await page.getByLabel('Duration').selectOption('15+');
    await expect(page.getByRole('heading', { level: 3 })).toHaveText([
      'Trivia Rush',
      'Sketch & Guess',
    ]);
  });

  test('filters live in the URL and survive reload', async ({ page }) => {
    await page.getByRole('searchbox', { name: 'Search activities' }).fill('guess');
    await page
      .getByRole('group', { name: 'Category' })
      .getByRole('button', { name: 'Creative' })
      .click();
    await page.getByLabel('Group size').selectOption('6-10');
    await expect(page).toHaveURL(/q=guess/);
    await expect(page).toHaveURL(/cat=creative/);
    await expect(page).toHaveURL(/size=6-10/);
    await page.reload();
    await expect(page.getByRole('searchbox', { name: 'Search activities' })).toHaveValue('guess');
    await expect(
      page.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Creative' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Group size')).toHaveValue('6-10');
    await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Sketch & Guess']);
  });

  test('"Plan with this activity" opens the builder on Basics with the activity pre-added', async ({
    page,
  }) => {
    await page.getByRole('link', { name: 'Plan with this activity for Trivia Rush' }).click();
    await expect(page).toHaveURL(/\/app\/events\/new\?activity=trivia-rush$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Set the basics' })).toBeVisible();
    await fillBasics(page, { title: 'Quiz break', date: '2026-10-23', time: '15:00' });
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Your playlist (1)' })).toBeVisible();
    await expect(page.getByLabel('Minutes for Trivia Rush')).toBeVisible();
    await page.getByRole('link', { name: 'Dashboard' }).first().click();
    // Typing the basics made the form dirty, so leaving asks first.
    await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toBeVisible();
  });

  test('pre-added activity alone is not an unsaved change', async ({ page }) => {
    await page.getByRole('link', { name: 'Plan with this activity for Who Am I?' }).click();
    await expect(page.getByLabel(/^Event title/)).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Dashboard' })
      .click();
    await expect(page).toHaveURL(/\/app$/);
  });

  test('axe and 320px', async ({ page }) => {
    await expectNoSeriousAxeViolations(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await expect(cards(page)).toHaveCount(6);
    await expectNoHorizontalScroll(page);
    await expectNoSeriousAxeViolations(page);
  });
});

test.describe('library API error state (the only tests that intercept the API)', () => {
  test('shows an error with retry, keeps filters, and recovers', async ({ page }) => {
    await page.route('**/api/v1/activities', (route) => route.abort('connectionrefused'));
    await page.goto('/app/library?q=trivia');
    await expect(
      page.getByRole('heading', { name: "We couldn't load the activities" }),
    ).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search activities' })).toHaveValue('trivia');
    await expectNoSeriousAxeViolations(page);
    await page.unroute('**/api/v1/activities');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(cards(page)).toHaveCount(1);
  });

  test('builder step 3 shows an error while steps 1-2 stay usable', async ({ page }) => {
    await page.route('**/api/v1/activities', (route) => route.abort('connectionrefused'));
    await page.goto('/app/events/new');
    await fillBasics(page, { title: 'Offline plan', date: '2026-10-23', time: '15:00' });
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(
      page.getByRole('heading', { name: "We couldn't load the activities" }),
    ).toBeVisible();
    await page.unroute('**/api/v1/activities');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('button', { name: 'Add Trivia Rush' })).toBeVisible();
  });
});
