import { defineConfig } from 'vitest/config';
import { swcPlugin } from './vitest.shared.js';

export default defineConfig({
  plugins: [swcPlugin],
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
});
