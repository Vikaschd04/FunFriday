import { expect, test } from '@playwright/test';

// Owned by the lead (devops/security). Guards the baseline CSP and headers from next.config.ts.

test('serves the baseline security headers', async ({ request }) => {
  const res = await request.get('/');
  const headers = res.headers();
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['content-security-policy']).toContain("object-src 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['x-powered-by']).toBeUndefined();
});

test('the page runs under its CSP without violations', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy|Refused to/i.test(message.text())) {
      violations.push(message.text());
    }
  });
  await page.goto('/status');
  // The status panel's API call is the cross-origin request most likely to be blocked.
  await expect(page.getByText('All systems operational', { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  expect(violations).toEqual([]);
});
