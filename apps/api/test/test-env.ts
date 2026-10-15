import { loadRootEnvFile } from '../src/config/load-env-file.js';

/**
 * Integration tests run against real Postgres + Redis but NEVER the dev
 * database: DATABASE_URL is replaced by TEST_DATABASE_URL.
 */
export function resolveTestEnv(): Record<string, string | undefined> {
  loadRootEnvFile();
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL must be set for integration tests (see .env.example)');
  }
  if (testDatabaseUrl === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL');
  }
  return { ...process.env, NODE_ENV: 'test', DATABASE_URL: testDatabaseUrl };
}
