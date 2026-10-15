import { execFileSync } from 'node:child_process';
import { resolveTestEnv } from './test-env.js';

/** Applies committed migrations to the test database before any test file runs. */
export default function setup(): void {
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: resolveTestEnv(),
    stdio: 'inherit',
  });
}
