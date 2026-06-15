// ESLint flat config — code quality only.
// Formatting is owned by Prettier; eslint-config-prettier (last) disables any
// stylistic rules that would conflict. Markdown is handled by markdownlint
// (lint:md), so it is not linted here.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // Ignore generated / vendored output (flat config has no .eslintignore).
  {
    ignores: [
      '**/node_modules/**',
      'docs/.vitepress/dist/**',
      'docs/.vitepress/cache/**',
      'docs/.vitepress/.temp/**',
      'exercises/rust/target/**',
      'coverage/**',
      'tmp/**',
      '.tmp-code-verify/**',
    ],
  },

  // Base JS + TS recommended rules.
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Vue SFC support.
  ...vue.configs['flat/recommended'],

  // Make .vue <script> blocks parse with the TS parser.
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  // Project-wide language options + lightweight rule overrides.
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Teaching codebase: keep these low-noise.
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // Allow intentionally-unused args/vars prefixed with underscore.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // `vue/attributes-order` is classified by eslint-plugin-vue as a
      // "Layout & Formatting" rule — that is Prettier's job, not ESLint's.
      // eslint-config-prettier does NOT disable it, so we turn it off here to
      // keep the linter focused on code quality and avoid 100+ style-only
      // warnings drowning out real issues.
      'vue/attributes-order': 'off',
    },
  },

  // Inline helper components in tests / theme scaffolding are intentional;
  // one-component-per-file targets app SFCs, not test/utility files.
  {
    files: [
      '**/__tests__/**',
      '**/*.test.{ts,js}',
      'docs/.vitepress/theme/index.ts',
      'docs/.vitepress/theme/components/**/*.{ts,tsx}',
    ],
    rules: {
      'vue/one-component-per-file': 'off',
    },
  },

  // Exercise answer files are standalone, self-contained reference solutions
  // that are intentionally NOT exported (they are read by learners, not
  // imported by tests). Their top-level class/function is therefore "unused"
  // by design, so no-unused-vars is a false positive here — disable it for
  // this directory only.
  {
    files: ['exercises/answers/**/*.{ts,js}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // Config / script files run in Node.
  {
    files: ['**/*.{js,mjs,cjs}', 'scripts/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // MUST be last: turn off all formatting rules that conflict with Prettier.
  prettier,
);
