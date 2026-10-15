// Shared ESLint flat config for the Next.js web app (adds React, hooks, a11y, Next rules).
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import { createBaseConfig } from './base.js';

/**
 * @param {{ tsconfigRootDir: string }} options
 */
export function createNextConfig({ tsconfigRootDir }) {
  return [...nextCoreWebVitals, ...nextTypescript, ...createBaseConfig({ tsconfigRootDir })];
}
