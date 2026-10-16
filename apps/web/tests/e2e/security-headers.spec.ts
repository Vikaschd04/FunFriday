import { expect, test, type Page } from '@playwright/test';

// Owned by the lead (devops/security). Guards proxy.ts (nonce CSP, signed-out redirect)
// and the static headers in next.config.ts.

const nonceOf = (csp: string | undefined) => /'nonce-([^']+)'/.exec(csp ?? '')?.[1];

function collectCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy|Refused to/i.test(message.text())) {
      violations.push(message.text());
    }
  });
  return violations;
}

test('serves the baseline security headers', async ({ request }) => {
  const headers = (await request.get('/')).headers();
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['content-security-policy']).toContain("object-src 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['x-powered-by']).toBeUndefined();
});

test('scripts are nonce-gated: no inline-script allowance and a fresh nonce per request', async ({
  request,
}) => {
  const first = (await request.get('/')).headers()['content-security-policy'];
  const second = (await request.get('/')).headers()['content-security-policy'];
  const scriptSrc = /script-src ([^;]+)/.exec(first ?? '')?.[1] ?? '';
  expect(scriptSrc).toContain("'strict-dynamic'");
  expect(scriptSrc).not.toContain("'unsafe-inline'");
  expect(nonceOf(first)).toBeTruthy();
  expect(nonceOf(first)).not.toBe(nonceOf(second));
});

test('every server-rendered script carries the request nonce', async ({ request }) => {
  // Chunks that Next loads later at runtime are trusted via 'strict-dynamic', so the
  // guarantee to check is the server HTML - where injected markup would land.
  const res = await request.get('/status');
  const nonce = nonceOf(res.headers()['content-security-policy']);
  const scriptTags = (await res.text()).match(/<script\b[^>]*>/g) ?? [];
  expect(scriptTags.length).toBeGreaterThan(0);
  for (const tag of scriptTags) expect(tag).toContain(`nonce="${nonce}"`);
});

test('the page runs under its CSP without violations', async ({ page }) => {
  const violations = collectCspViolations(page);
  await page.goto('/status');
  // The status panel's API call is the cross-origin request most likely to be blocked.
  await expect(page.getByText('All systems operational', { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  expect(violations).toEqual([]);
});

test('signed-out visits to /app redirect to sign-in and keep the destination', async ({
  request,
}) => {
  const res = await request.get('/app/library?q=trivia', { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(res.status());
  const location = new URL(res.headers()['location'] ?? '', 'http://localhost');
  expect(location.pathname).toBe('/sign-in');
  expect(location.searchParams.get('next')).toBe('/app/library?q=trivia');
});
