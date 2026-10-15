import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Loads the monorepo root `.env` for local development if it exists.
 * Variables already set in the process environment (CI, container runtime,
 * secret manager) always win; production deployments have no `.env` file.
 * Resolves identically from src/config (tests) and dist/config (runtime).
 */
export function loadRootEnvFile(): void {
  const path = fileURLToPath(new URL('../../../../.env', import.meta.url));
  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
}
