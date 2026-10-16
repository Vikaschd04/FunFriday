import type { NestExpressApplication } from '@nestjs/platform-express';
import { createApp } from '../src/app.factory.js';
import { type AppConfig, parseConfig } from '../src/config/app-config.js';
import type { Clock } from '../src/modules/live/clock.js';
import { resolveTestEnv } from './test-env.js';

/** Boots the real app (real Postgres test DB + Redis) with optional config overrides. */
export async function startApp(
  overrides: Partial<AppConfig> = {},
  options: { clock?: Clock } = {},
): Promise<NestExpressApplication> {
  // one trusted proxy hop lets each test agent present its own X-Forwarded-For so per-IP limits stay isolated.
  const config = { ...parseConfig(resolveTestEnv()), trustProxy: 1, ...overrides };
  const app = await createApp(config, { logger: false, clock: options.clock });
  await app.init();
  return app;
}
