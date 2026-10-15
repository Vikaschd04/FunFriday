import type { NestExpressApplication } from '@nestjs/platform-express';
import { createApp } from '../src/app.factory.js';
import { type AppConfig, parseConfig } from '../src/config/app-config.js';
import { resolveTestEnv } from './test-env.js';

/** Boots the real app (real Postgres test DB + Redis) with optional config overrides. */
export async function startApp(
  overrides: Partial<AppConfig> = {},
): Promise<NestExpressApplication> {
  const config = { ...parseConfig(resolveTestEnv()), ...overrides };
  const app = await createApp(config, { logger: false });
  await app.init();
  return app;
}
