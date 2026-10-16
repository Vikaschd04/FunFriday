import { defineConfig, devices } from '@playwright/test';

const webPort = 3000;
const apiPort = Number(process.env.API_PORT ?? 4000);
const reuse = !process.env.CI;

/**
 * Browser E2E runs against the REAL API (which needs Postgres + Redis up:
 * `pnpm db:up && pnpm db:migrate`). Nothing is mocked.
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Sign-up hashes passwords and E2E runs three browsers against one API: allow headroom.
  timeout: 60_000,
  fullyParallel: true,
  // The API shares one small DB pool with password hashing; 3 workers keep E2E free of
  // connection-timeout flakes on a laptop-class machine.
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 3,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${webPort}`,
    trace: 'retain-on-failure',
  },
  // Cross-browser from P1 (docs/QUALITY_STRATEGY.md): Chromium, Firefox, WebKit.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @funfriday/api start',
      url: `http://localhost:${apiPort}/api/v1/health/live`,
      reuseExistingServer: reuse,
      timeout: 60_000,
      // Lets each test present its own client IP (X-Forwarded-For) so per-IP rate limits
      // don't couple unrelated tests. Local-only test setup; never a production value.
      env: { TRUST_PROXY: '1' },
    },
    {
      command: 'pnpm --filter @funfriday/web start',
      url: `http://localhost:${webPort}`,
      reuseExistingServer: reuse,
      timeout: 60_000,
    },
  ],
});
