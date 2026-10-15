import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Wait for finite entrance animations so axe measures settled colours, not mid-fade blends. */
export async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
    // A cancelled animation (element re-mounted) rejects `finished`; that still means settled.
    await Promise.allSettled(finite.map((animation) => animation.finished));
  });
}

export async function expectNoSeriousAxeViolations(page: Page): Promise<void> {
  await settleAnimations(page);
  // Sticky bars cover the lower part of a long mobile page; axe target-size would flag fields
  // under them, so measure from the bottom where the bar sits in normal flow.
  if ((page.viewportSize()?.width ?? 1000) < 768) {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
  }
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  const report = blocking.flatMap((v) =>
    v.nodes.map((n) => `${v.id} @ ${n.target.join(' ')}: ${n.failureSummary ?? ''}`),
  );
  expect(report).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

export async function fillBasics(
  page: Page,
  basics: { title: string; date: string; time: string; timeZone?: string },
): Promise<void> {
  await page.getByLabel(/^Event title/).fill(basics.title);
  await page.getByLabel(/^Date/).fill(basics.date);
  await page.getByLabel(/^Start time/).fill(basics.time);
  if (basics.timeZone) await page.getByLabel(/^Time zone/).selectOption(basics.timeZone);
}

export async function openBuilder(page: Page, query = ''): Promise<void> {
  await page.goto(`/app/events/new${query}`);
  await expect(page.getByLabel(/^Event title/)).toBeVisible();
}

export const CATALOG_ORDER = [
  'This or That',
  'Emoji Check-In',
  'Trivia Rush',
  'Who Am I?',
  'Caption Clash',
  'Sketch & Guess',
];
