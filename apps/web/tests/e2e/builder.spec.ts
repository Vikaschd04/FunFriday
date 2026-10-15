import { expect, test, type Page } from '@playwright/test';
import {
  expectNoHorizontalScroll,
  expectNoSeriousAxeViolations,
  fillBasics,
  openBuilder,
} from './helpers';

// A viewer zone that differs from the event zone, so the review shows both.
test.use({ timezoneId: 'Asia/Tokyo', viewport: { width: 1440, height: 900 } });

const next = (page: Page) => page.getByRole('button', { name: 'Next' });
const playlist = (page: Page) => page.getByRole('list', { name: 'Playlist' });

test.describe('event builder', () => {
  test('full journey: validation, DST, activities, reorder, review, save, continue, delete', async ({
    page,
  }) => {
    await openBuilder(page);
    await expect(page).toHaveTitle('Plan a FunFriday - FunFriday');
    await expect(page.getByLabel(/^Time zone/)).toHaveValue('Asia/Tokyo');
    await expect(page.locator('#field-timezone option[value="America/New_York"]')).toContainText(
      'New York (America/New_York) - GMT-',
    );
    await expect(
      page.getByText('This is a draft planner. Nothing is sent, shared or scheduled.', {
        exact: false,
      }),
    ).toBeVisible();

    // --- Basics: empty Next shows an error summary that takes focus.
    await next(page).click();
    const summary = page.getByRole('region', { name: /Please fix/ });
    await expect(summary).toBeFocused();
    await expect(
      summary.getByRole('heading', { level: 2, name: 'Please fix 2 things' }),
    ).toBeVisible();
    const title = page.getByLabel(/^Event title/);
    await expect(title).toHaveAttribute('aria-invalid', 'true');
    await expect(title).toHaveAccessibleDescription(/at least 3 characters/);
    await expectNoSeriousAxeViolations(page);
    await summary.getByRole('link', { name: /name of at least 3/ }).click();
    await expect(title).toBeFocused();

    // --- Basics: the DST gap is rejected with the contract message.
    await fillBasics(page, {
      title: 'Friday Reset',
      date: '2026-03-08',
      time: '02:30',
      timeZone: 'America/New_York',
    });
    await next(page).click();
    await expect(
      page
        .getByRole('region', { name: /Please fix/ })
        .getByText('That time is skipped when clocks change in this time zone. Pick another time.'),
    ).toBeVisible();
    await expect(page.getByLabel(/^Start time/)).toHaveAccessibleDescription(
      /skipped when clocks change/,
    );
    await page.getByLabel(/^Start time/).fill('15:00');
    await next(page).click();

    // --- Participants
    const heading2 = (name: string) => page.getByRole('heading', { level: 2, name });
    await expect(heading2('Who is it for?')).toBeFocused();
    await expect(
      page.getByText('We never ask for names or email addresses in this preview.'),
    ).toBeVisible();
    await page.getByLabel(/^Expected group size/).fill('1');
    await next(page).click();
    await expect(page.getByLabel(/^Expected group size/)).toHaveAccessibleDescription(
      /at least 2 people/,
    );
    await page.getByLabel(/^Expected group size/).fill('20');
    await next(page).click();

    // --- Activities from the real catalog
    await expect(heading2('Choose activities')).toBeFocused();
    await page.getByRole('button', { name: 'Add Trivia Rush' }).click();
    await page.getByRole('button', { name: 'Add This or That' }).click();
    await page.getByRole('button', { name: 'Add Sketch & Guess' }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Your playlist (3)' })).toBeVisible();
    await expect(playlist(page).locator(':scope > li')).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Remove Trivia Rush' }).first()).toBeVisible();

    // Over budget: meter text states it (not colour alone).
    await page.getByLabel('Minutes for Trivia Rush').fill('60');
    await expect(
      page.getByRole('img', { name: /\d+ of 45 minutes planned, \d+ minutes over/ }),
    ).toBeVisible();
    await expect(
      page.getByText(/your activities run \d+ minutes over the event length/),
    ).toBeVisible();
    await page.getByLabel('Minutes for Trivia Rush').fill('12');
    await expect(page.getByRole('img', { name: /minutes of buffer/ })).toBeVisible();

    // Capacity notice for the chosen group size is shown only here (20 > Sketch's 12).
    await expect(page.getByText(/Sketch & Guess is built for up to 12 people/)).toBeVisible();
    await expect(
      page.getByText(
        "Trivia Rush, This or That and Sketch & Guess are still in development, so they can't run yet. You can keep them in your plan.",
      ),
    ).toBeVisible();
    await expect(page.getByText(/Good to know: Trivia Rush is still/)).toHaveCount(0);
    await expect(playlist(page).getByText('In development')).toHaveCount(3);
    await expectNoSeriousAxeViolations(page);

    // Keyboard reorder: move "This or That" (position 2) up; focus stays on the same button.
    const up = page.getByRole('button', { name: 'Move This or That up (position 2 of 3)' });
    await up.focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('status').filter({ hasText: 'This or That moved to position 1 of 3.' }),
    ).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: 'Move This or That up (position 1 of 3)' }),
    ).toBeFocused();
    await expect(
      page.getByRole('button', { name: 'Move This or That up (position 1 of 3)' }),
    ).toHaveAttribute('aria-disabled', 'true');
    await expect(playlist(page).locator(':scope > li').first()).toContainText('This or That');

    // Remove (keyboard): focus goes to the next row's first control, then previous, then the heading.
    await playlist(page).getByRole('button', { name: 'Remove This or That' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Minutes for Trivia Rush')).toBeFocused();
    await playlist(page).getByRole('button', { name: 'Remove Sketch & Guess' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Minutes for Trivia Rush')).toBeFocused();
    await playlist(page).getByRole('button', { name: 'Remove Trivia Rush' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 3, name: 'Your playlist (0)' })).toBeFocused();

    // Empty playlist blocks Next with the contract message.
    await next(page).click();
    await expect(
      page.getByRole('region', { name: /Please fix/ }).getByText('Pick at least one activity.'),
    ).toBeVisible();

    // Re-add two and continue to review.
    await page.getByRole('button', { name: 'Add This or That' }).click();
    await page.getByRole('button', { name: 'Add Trivia Rush' }).click();
    await page.getByLabel('Minutes for This or That').fill('10');
    await page.getByLabel('Minutes for Trivia Rush').fill('12');
    await next(page).click();

    // --- Review
    await expect(heading2('Review your plan')).toBeFocused();
    await expect(page.getByRole('heading', { level: 3, name: 'Friday Reset' })).toBeVisible();
    await expect(page.getByText('Sun 8 Mar 2026, 15:00-15:45')).toBeVisible();
    await expect(page.getByText('15:00 America/New_York')).toBeVisible();
    // 15:00 EDT (UTC-4) is 04:00 the next day in Asia/Tokyo (UTC+9).
    await expect(page.getByText('04:00 Asia/Tokyo')).toBeVisible();
    await expect(page.getByText(/clocks change in this time zone around that time/)).toBeVisible();
    const agenda = page
      .getByRole('heading', { name: 'Agenda' })
      .locator('xpath=following-sibling::ol');
    await expect(agenda.getByRole('listitem')).toHaveCount(3);
    await expect(agenda.getByRole('listitem').first()).toContainText('This or That');
    await expect(agenda.getByRole('listitem').first()).toContainText('15:00-15:10');
    await expect(agenda.getByRole('listitem').nth(1)).toContainText('Transition');
    await expect(agenda.getByRole('listitem').nth(1)).toContainText('15:10-15:12');
    await expect(agenda.getByRole('listitem').nth(2)).toContainText('15:12-15:24');
    await expect(
      page.getByText('Next steps like invitations arrive in a later phase.'),
    ).toBeVisible();
    // The side panel no longer repeats the title/when/group shown in the main column.
    const side = page.getByRole('complementary', { name: 'Plan summary' });
    await expect(side.getByRole('heading', { name: 'Time budget' })).toBeVisible();
    await expect(side.getByText('Friday Reset')).toHaveCount(0);
    await expect(side.getByText('This or That').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /create event|send invite/i })).toHaveCount(0);
    await expectNoSeriousAxeViolations(page);

    // --- Save
    await expect(page.getByText('Unsaved changes')).toBeVisible();
    await page.getByRole('button', { name: 'Save draft on this device' }).click();
    await expect(page.getByText(/Draft saved on this device at \d\d:\d\d/)).toBeVisible();
    await expect(page).toHaveURL(/\/app\/events\/new\?draft=/);
    await expect(page.getByRole('status').filter({ hasText: /^Draft saved\u200B?$/ })).toHaveCount(
      1,
    );

    // --- Dashboard lists it
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Dashboard' })
      .click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Drafts on this device (1)' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Friday Reset' })).toBeVisible();
    await expect(page.getByText('Sun 8 Mar 2026, 15:00 (America/New_York)').first()).toBeVisible();
    await expect(page.getByText('22 min of 45', { exact: true })).toBeVisible();
    await expect(page.getByText('Up next')).toBeVisible();
    await expectNoSeriousAxeViolations(page);

    // --- Continue editing restores values
    await page.getByRole('link', { name: 'Continue editing Friday Reset' }).first().click();
    await expect(page.getByLabel(/^Event title/)).toHaveValue('Friday Reset');
    await expect(page.getByLabel(/^Date/)).toHaveValue('2026-03-08');
    await expect(page.getByLabel(/^Start time/)).toHaveValue('15:00');
    await expect(page.getByLabel(/^Time zone/)).toHaveValue('America/New_York');
    await expect(page.getByText(/Draft saved on this device at/)).toBeVisible();
    await next(page).click();
    await next(page).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Your playlist (2)' })).toBeVisible();

    // --- Delete via dialog: Escape cancels and returns focus; confirm deletes.
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Dashboard' })
      .click();
    const del = page.getByRole('button', { name: 'Delete draft Friday Reset' });
    await del.click();
    const dialog = page.getByRole('dialog', { name: 'Delete this draft?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(del).toBeFocused();
    await del.click();
    await dialog.getByRole('button', { name: 'Delete draft' }).click();
    await expect(
      page.getByRole('heading', {
        name: "No plans yet. Let's make Friday worth looking forward to.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: /^Draft deleted\u200B?$/ }),
    ).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: 'Your Fridays' })).toBeFocused();
  });

  test('unsaved-changes guard: keep editing, leave, and save from the dialog', async ({ page }) => {
    await openBuilder(page);
    await page.getByLabel(/^Event title/).fill('Guarded plan');
    await expect(page).toHaveTitle('* Plan a FunFriday - FunFriday');
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Activities' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Leave without saving?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Keep editing' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/app\/events\/new/);

    // Save from the dialog is refused while Basics are invalid: the builder shows what to fix.
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Activities' })
      .click();
    await dialog.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText("Can't save yet. Fix the highlighted fields.")).toBeVisible();
    await expect(page).toHaveURL(/\/app\/events\/new/);

    await fillBasics(page, { title: 'Guarded plan', date: '2026-10-23', time: '15:00' });
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Activities' })
      .click();
    await dialog.getByRole('button', { name: 'Save draft' }).click();
    await expect(page).toHaveURL(/\/app\/library/);
    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 3, name: 'Guarded plan' })).toBeVisible();
    await page.getByRole('link', { name: 'Plan a FunFriday' }).first().click();
    await page.getByLabel(/^Event title/).fill('Another');
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Dashboard' })
      .click();
    await dialog.getByRole('button', { name: 'Leave without saving' }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Drafts on this device (1)' }),
    ).toBeVisible();
  });

  test('partial draft saves once Basics are valid and reopens', async ({ page }) => {
    await openBuilder(page);
    await fillBasics(page, { title: 'Partial', date: '2026-10-23', time: '15:00' });
    await page.getByRole('button', { name: 'Save draft on this device' }).click();
    await expect(page.getByText(/Draft saved on this device at/)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(/^Event title/)).toHaveValue('Partial');
  });

  test('unknown and corrupt drafts show the right states', async ({ page }) => {
    await page.goto('/app/events/new?draft=nope');
    await expect(page.getByRole('heading', { name: "We couldn't find that draft" })).toBeVisible();
    await page.getByRole('link', { name: 'Start a new plan' }).click();
    await expect(page.getByLabel(/^Event title/)).toBeVisible();

    await page.evaluate(() => {
      localStorage.setItem(
        'funfriday:drafts:v1',
        JSON.stringify({ version: 1, drafts: [{ id: 'bad', updatedAt: 'x', title: 7 }] }),
      );
    });
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: "This draft can't be opened" })).toBeVisible();
    await expect(page.getByRole('link', { name: /Continue editing/ })).toHaveCount(0);
    await page.getByRole('button', { name: /^Delete/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete draft' }).click();
    await expect(page.getByRole('heading', { name: /No plans yet/ })).toBeVisible();
  });

  test('a broken storage envelope shows the dashboard error state with retry', async ({ page }) => {
    await page.goto('/app');
    await page.evaluate(() => {
      localStorage.setItem('funfriday:drafts:v1', '{not json');
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: "We couldn't read your drafts" })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Plan a FunFriday' }).first()).toBeVisible();
    await expectNoSeriousAxeViolations(page);
  });

  test('every step passes axe and has no horizontal scroll at 320', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await openBuilder(page);
    await expectNoHorizontalScroll(page);
    await expectNoSeriousAxeViolations(page);
    await fillBasics(page, {
      title: 'Small screen',
      date: '2026-10-23',
      time: '15:00',
      timeZone: 'Europe/London',
    });
    await next(page).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Who is it for?' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousAxeViolations(page);
    await next(page).click();
    await page.getByRole('button', { name: 'Add Trivia Rush' }).click();
    await page.getByRole('button', { name: 'Add Who Am I?' }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Your playlist (2)' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousAxeViolations(page);
    await next(page).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Review your plan' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousAxeViolations(page);
    // Summary is a collapsed <details> on small screens.
    await page.getByText('Plan summary').click();
    await expect(page.getByText('Small screen').first()).toBeVisible();
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('stepper still moves focus to the step heading', async ({ page }) => {
      await openBuilder(page);
      await fillBasics(page, { title: 'Calm plan', date: '2026-10-23', time: '15:00' });
      await next(page).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Who is it for?' })).toBeFocused();
    });
  });

  test('invalid save from a later step focuses the error summary (button and leave dialog)', async ({
    page,
  }) => {
    await openBuilder(page);
    await fillBasics(page, { title: 'Will be cleared', date: '2026-10-23', time: '15:00' });
    await next(page).click();
    await next(page).click();
    await page.getByRole('button', { name: 'Add Trivia Rush' }).click();
    await next(page).click();
    // Go back to Basics through the stepper, break the title, return to step 3.
    const stepper = page.getByRole('navigation', { name: 'Event steps' });
    await stepper.getByRole('button', { name: /Basics/ }).click();
    await page.getByLabel(/^Event title/).fill('');
    await stepper.getByRole('button', { name: /Activities/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Choose activities' })).toBeFocused();

    await page.getByRole('button', { name: 'Save draft on this device' }).click();
    const summary = page.getByRole('region', { name: /Please fix/ });
    await expect(summary).toBeFocused();
    await expect(page.getByText("Can't save yet. Fix the highlighted fields.")).toBeVisible();

    // Same through the unsaved-changes dialog.
    await stepper.getByRole('button', { name: /Activities/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Choose activities' })).toBeFocused();
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Activities' })
      .click();
    await page
      .getByRole('dialog', { name: 'Leave without saving?' })
      .getByRole('button', { name: 'Save draft' })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('region', { name: /Please fix/ })).toBeFocused();
  });

  test('leaving through the dialog does not return focus to the old link', async ({ page }) => {
    await openBuilder(page);
    await page.getByLabel(/^Event title/).fill('Leaving');
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Activities' })
      .click();
    await page
      .getByRole('dialog', { name: 'Leave without saving?' })
      .getByRole('button', { name: 'Leave without saving' })
      .click();
    await expect(page).toHaveURL(/\/app\/library/);
    await expect(page.getByRole('heading', { level: 1, name: 'Activities' })).toBeFocused();
  });

  for (const size of [
    { width: 320, height: 800 },
    { width: 640, height: 360 },
  ]) {
    test(`step 3 rows stack and notices stay wide at ${size.width}x${size.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.goto('/app/events/new?activity=sketch-and-guess');
      await fillBasics(page, { title: 'Narrow rows', date: '2026-10-23', time: '15:00' });
      await next(page).click();
      await next(page).click();
      const notice = page
        .getByText(/Sketch & Guess is built for up to 12 people/)
        .locator('xpath=ancestor::div[contains(@class,"rounded-ff-button")][1]');
      await expect(notice).toBeVisible();
      const box = await notice.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(240);
      for (const name of [
        /^Move Sketch & Guess up/,
        /^Move Sketch & Guess down/,
        /^Remove Sketch & Guess/,
      ]) {
        const b = await playlist(page).getByRole('button', { name }).boundingBox();
        expect(b?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect(b?.width ?? 0).toBeGreaterThanOrEqual(44);
      }
      // Actions sit below the content on narrow screens, right-aligned.
      const field = await page.getByLabel('Minutes for Sketch & Guess').boundingBox();
      const remove = await playlist(page)
        .getByRole('button', { name: /^Remove Sketch & Guess/ })
        .boundingBox();
      if (size.width < 640)
        expect(remove?.y ?? 0).toBeGreaterThan((field?.y ?? 0) + (field?.height ?? 0));
      await expectNoHorizontalScroll(page);
    });
  }

  test('the sticky action bar does not cover the focused field at 640x360', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 360 });
    await openBuilder(page);
    await page.locator('#field-meeting-url').focus();
    await page.waitForTimeout(300);
    const field = await page.locator('#field-meeting-url').boundingBox();
    const bar = await page.getByTestId('builder-actions').boundingBox();
    expect((field?.y ?? 0) + (field?.height ?? 0)).toBeLessThanOrEqual((bar?.y ?? 0) + 1);
    const tabs = await page.locator('[data-app-nav]').boundingBox();
    expect((field?.y ?? 0) + (field?.height ?? 0)).toBeLessThanOrEqual((tabs?.y ?? 0) + 1);
  });
});
