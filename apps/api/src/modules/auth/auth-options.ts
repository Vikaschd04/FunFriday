import { randomUUID } from 'node:crypto';
import { emailSchema, personNameSchema } from '@funfriday/contracts';
import { type BetterAuthOptions } from 'better-auth';
import type { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { createLimiter } from '../../common/concurrency/limiter.js';
import { CLIENT_IP_HEADER } from '../../common/http/request-context.js';
import type { AppConfig } from '../../config/app-config.js';

export const AUTH_BASE_PATH = '/api/v1/auth';
export const SESSION_COOKIE_PREFIX = 'funfriday';

/**
 * scrypt runs on the libuv thread pool, which the pg driver also needs (DNS, connects).
 * Capping concurrent hashes at 2 of the 4 default threads keeps connections from starving.
 */
const limitHashing = createLimiter(2);
const hashLimited = (password: string): Promise<string> =>
  limitHashing(() => hashPassword(password));
const verifyLimited = (data: { hash: string; password: string }): Promise<boolean> =>
  limitHashing(() => verifyPassword(data));

export interface AuthOptionsDeps {
  /** Better Auth database adapter factory result (Prisma adapter in production). */
  database: ReturnType<typeof prismaAdapter> | undefined;
  sendVerificationMail: (input: { to: string; link: string }) => Promise<void>;
  log: (level: string, message: string) => void;
}

/** The fixed post-verification landing page; client-supplied callbackURL values are ignored. */
export function verifiedCallbackUrl(config: AppConfig): string {
  return `${config.webOrigins[0]}/app?verified=1`;
}

/** Single source of truth for the auth library configuration (also used by the schema parity test). */
export function buildAuthOptions(config: AppConfig, deps: AuthOptionsDeps) {
  const secure = new URL(config.apiPublicUrl).protocol === 'https:';
  return {
    database: deps.database,
    secret: config.authSecret,
    baseURL: config.apiPublicUrl,
    basePath: AUTH_BASE_PATH,
    trustedOrigins: config.webOrigins,
    telemetry: { enabled: false },
    logger: {
      level: 'warn',
      // Message only: extra args can carry request data. Nothing is printed by the library itself.
      log: (level: string, message: string) => deps.log(level, message),
    },
    emailAndPassword: {
      enabled: true,
      password: { hash: hashLimited, verify: verifyLimited },
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: false,
      autoSignIn: true,
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const link = new URL(url);
        link.searchParams.set('callbackURL', verifiedCallbackUrl(config));
        await deps.sendVerificationMail({ to: user.email, link: link.toString() });
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    advanced: {
      cookiePrefix: SESSION_COOKIE_PREFIX,
      useSecureCookies: secure,
      // The library silently skips origin checks when NODE_ENV=test; pin them on everywhere.
      disableOriginCheck: false,
      disableCSRFCheck: false,
      database: { generateId: () => randomUUID() },
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },
    rateLimit: {
      // Off by default outside production, so it is switched on explicitly.
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
        '/send-verification-email': { window: 60, max: 3 },
      },
    },
    hooks: {
      // Shared contract schemas guard identity columns before they reach the database, and
      // unknown fields (notably `image`) are refused rather than silently stored.
      // eslint-disable-next-line @typescript-eslint/require-await -- the library expects an async hook
      before: createAuthMiddleware(async (ctx) => {
        const rules = BODY_RULES[ctx.path];
        if (!rules) return;
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        const unknown = Object.keys(body).filter((key) => !rules.allowed.has(key));
        if (unknown.length > 0) {
          throw new APIError('BAD_REQUEST', { message: 'Unsupported field.' });
        }
        if (
          (rules.nameRequired || 'name' in body) &&
          !personNameSchema.safeParse(body.name).success
        ) {
          throw new APIError('BAD_REQUEST', { message: 'Enter your name (1-80 characters).' });
        }
        if (rules.emailRequired && !emailSchema.safeParse(body.email).success) {
          throw new APIError('BAD_REQUEST', { message: 'Enter a valid email address.' });
        }
      }),
    },
  } satisfies BetterAuthOptions;
}

interface BodyRules {
  allowed: Set<string>;
  nameRequired: boolean;
  emailRequired: boolean;
}

const BODY_RULES: Record<string, BodyRules> = {
  '/sign-up/email': {
    allowed: new Set(['name', 'email', 'password', 'callbackURL', 'rememberMe']),
    nameRequired: true,
    emailRequired: true,
  },
  '/update-user': { allowed: new Set(['name']), nameRequired: false, emailRequired: false },
};
