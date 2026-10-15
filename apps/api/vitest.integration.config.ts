import { defineConfig } from 'vitest/config';
import { swcPlugin } from './vitest.shared.js';

export default defineConfig({
  plugins: [swcPlugin],
  test: {
    include: ['test/**/*.int.spec.ts'],
    environment: 'node',
    globalSetup: ['test/global-setup.ts'],
    // Tests share one database; run files sequentially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
