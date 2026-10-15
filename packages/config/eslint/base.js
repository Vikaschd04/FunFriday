// Shared ESLint flat config for TypeScript packages and services.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export const ignores = {
  ignores: [
    '**/dist/**',
    '**/.next/**',
    '**/coverage/**',
    '**/generated/**',
    '**/playwright-report/**',
    '**/test-results/**',
    '**/next-env.d.ts',
  ],
};

/**
 * @param {{ tsconfigRootDir: string }} options
 */
export function createBaseConfig({ tsconfigRootDir }) {
  return tseslint.config(
    ignores,
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
      languageOptions: {
        globals: { ...globals.node },
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      rules: {
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/no-floating-promises': 'error',
        'no-console': ['warn', { allow: ['warn', 'error'] }],
      },
    },
    {
      files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
      ...tseslint.configs.disableTypeChecked,
    },
  );
}
