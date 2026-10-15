import { createBaseConfig } from '@funfriday/config/eslint/base';

export default [
  ...createBaseConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // Nest resolves constructor dependencies from emitted decorator metadata,
    // which requires value (not type-only) imports of injected classes.
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
