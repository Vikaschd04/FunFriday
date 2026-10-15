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
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${webPort}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @funfriday/api start',
      url: `http://localhost:${apiPort}/api/v1/health/live`,
      reuseExistingServer: reuse,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @funfriday/web start',
      url: `http://localhost:${webPort}`,
      reuseExistingServer: reuse,
      timeout: 60_000,
    },
  ],
});
