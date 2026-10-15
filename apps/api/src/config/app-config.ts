import { readFileSync } from 'node:fs';
import { z } from 'zod';

export const APP_CONFIG = Symbol('APP_CONFIG');

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  /** Exact browser origins allowed by CORS. */
  webOrigins: string[];
  version: string;
}

const urlWithProtocol = (protocols: string[]) =>
  z.url().refine((value) => protocols.includes(new URL(value).protocol), {
    message: `must use ${protocols.join(' or ')}`,
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().min(1).default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: urlWithProtocol(['postgresql:', 'postgres:']),
  REDIS_URL: urlWithProtocol(['redis:', 'rediss:']),
  WEB_ORIGIN: z
    .string()
    .min(1)
    .transform((value) => value.split(',').map((origin) => origin.trim()))
    .pipe(z.array(z.url().transform((origin) => new URL(origin).origin)).min(1)),
  APP_VERSION: z.string().min(1).max(64).optional(),
});

export class ConfigError extends Error {
  constructor(readonly invalidKeys: string[]) {
    // Only key names are reported - never values, which may contain credentials.
    super(`Invalid or missing environment variables: ${invalidKeys.join(', ')}`);
    this.name = 'ConfigError';
  }
}

function packageVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version?: string;
  };
  return pkg.version ?? '0.0.0';
}

export function parseConfig(env: Record<string, string | undefined>): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new ConfigError(keys);
  }
  const parsed = result.data;
  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.API_HOST,
    port: parsed.API_PORT,
    databaseUrl: parsed.DATABASE_URL,
    redisUrl: parsed.REDIS_URL,
    webOrigins: parsed.WEB_ORIGIN,
    version: parsed.APP_VERSION ?? packageVersion(),
  };
}
