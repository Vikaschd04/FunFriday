import { getAuthTables } from 'better-auth/db';
import { describe, expect, it } from 'vitest';
import { buildAuthOptions } from '../src/modules/auth/auth-options.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { parseConfig } from '../src/config/app-config.js';
import { resolveTestEnv } from './test-env.js';

/**
 * Better Auth owns its table shape. If a library upgrade or an option change adds a
 * field our Prisma models lack, the Prisma adapter would fail at runtime - fail here instead.
 */
describe('Better Auth <-> Prisma schema parity', () => {
  const config = parseConfig(resolveTestEnv());
  const options = buildAuthOptions(config, {
    database: undefined,
    sendVerificationMail: () => Promise.resolve(),
    log: () => undefined,
  });
  const expected = getAuthTables(options);
  // Public, generated list of scalar field names per Prisma model.
  const prismaFields: Record<string, readonly string[]> = {
    user: Object.keys(Prisma.UserScalarFieldEnum),
    session: Object.keys(Prisma.SessionScalarFieldEnum),
    account: Object.keys(Prisma.AccountScalarFieldEnum),
    verification: Object.keys(Prisma.VerificationScalarFieldEnum),
  };

  const tableNames = Object.values(expected)
    .filter((table) => table.modelName !== 'rateLimit')
    .map((table) => table.modelName);

  it('covers the four core tables', () => {
    expect(tableNames.sort()).toEqual(['account', 'session', 'user', 'verification']);
  });

  it('keeps rate limiting in memory so no rate_limit table is expected', () => {
    expect(options.rateLimit.enabled).toBe(true);
    expect(Object.values(expected).some((t) => t.modelName === 'rateLimit')).toBe(false);
  });

  for (const table of Object.values(expected).filter((t) => t.modelName !== 'rateLimit')) {
    it(`Prisma model for "${table.modelName}" has every field Better Auth expects`, () => {
      const have = new Set(prismaFields[table.modelName] ?? []);
      const missing = [
        'id',
        ...Object.entries(table.fields).map(([key, attr]) => attr.fieldName ?? key),
      ].filter((name) => !have.has(name));
      expect(missing).toEqual([]);
    });
  }
});
