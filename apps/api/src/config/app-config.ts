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
  /** Public base URL of this API (cookies, verification links). */
  apiPublicUrl: string;
  /** Secret used by the auth provider to sign cookies/tokens. Never log. */
  authSecret: string;
  /** Local-only mail stand-in; always false in production. */
  devMailboxEnabled: boolean;
  /** Number of trusted reverse-proxy hops (0 = none; X-Forwarded-For is ignored). */
  trustProxy: number;
  version: string;
}

const urlWithProtocol = (protocols: string[]) =>
  z.url().refine((value) => protocols.includes(new URL(value).protocol), {
    message: `must use ${protocols.join(' or ')}`,
  });

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

/** Hop count 0-5. 'false' -> 0 and 'true' -> 1 are accepted for compatibility. */
const proxyHops = z
  .enum(['false', 'true', '0', '1', '2', '3', '4', '5'])
  .transform((value) => (value === 'false' ? 0 : value === 'true' ? 1 : Number(value)));

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', '[::1]', 'localhost']);
const SECRET_PLACEHOLDER = /replace|changeme|example|placeholder/i;

/** Rejects documentation placeholders and low-entropy secrets; stricter in production. */
export function isAcceptableAuthSecret(secret: string, nodeEnv: string): boolean {
  if (secret.length < (nodeEnv === 'production' ? 43 : 32)) return false;
  if (SECRET_PLACEHOLDER.test(secret)) return false;
  if (new Set(secret).size < 2) return false;
  return true;
}

const envSchema = z
  .object({
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
    AUTH_SECRET: z.string().min(32),
    API_PUBLIC_URL: urlWithProtocol(['http:', 'https:']).default('http://localhost:4000'),
    DEV_MAILBOX_ENABLED: booleanString.default(false),
    TRUST_PROXY: proxyHops.default(0),
  })
  .superRefine((env, ctx) => {
    if (!isAcceptableAuthSecret(env.AUTH_SECRET, env.NODE_ENV)) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_SECRET'],
        message: 'weak or placeholder secret',
      });
    }
    if (env.DEV_MAILBOX_ENABLED && !LOOPBACK_HOSTS.has(env.API_HOST)) {
      ctx.addIssue({
        code: 'custom',
        path: ['API_HOST'],
        message: 'must be a loopback address while the dev mailbox is enabled',
      });
    }
    if (env.DEV_MAILBOX_ENABLED && env.NODE_ENV === 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['DEV_MAILBOX_ENABLED'],
        message: 'must be false in production',
      });
    }
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
    apiPublicUrl: new URL(parsed.API_PUBLIC_URL).origin,
    authSecret: parsed.AUTH_SECRET,
    devMailboxEnabled: parsed.DEV_MAILBOX_ENABLED,
    trustProxy: parsed.TRUST_PROXY,
    version: parsed.APP_VERSION ?? packageVersion(),
  };
}
