# SOP 14: Lint & Format Toolchain

## Trigger

- When adding/changing lint, format, or commit-hook config
- When `pnpm lint` or the pre-commit hook fails
- When deciding whether a rule should be fixed in code or disabled in config
- When onboarding to the repo's code-quality conventions

## Overview

The toolchain separates **code quality** (linters) from **formatting** (Prettier).
Each tool owns one concern; rules that overlap are disabled so they never fight.

| Tool | Owns | Targets | Config |
|------|------|---------|--------|
| **ESLint** (flat) | JS/TS/Vue code quality | `.ts .js .mjs .cjs .vue` | `eslint.config.mjs` |
| **Stylelint** | CSS / Vue `<style>` quality | `custom.css`, `docs/.vitepress/**/*.vue` | `stylelint.config.mjs` |
| **markdownlint** | Markdown structure | `docs/**/*.md` | `.markdownlint.json` |
| **Prettier** | Formatting (all of the above) | everything | `.prettierrc.json` |
| **commitlint** | Commit message format | commit msg | `commitlint.config.ts` |
| **husky + lint-staged** | Run the above on staged files | git pre-commit / commit-msg | `.husky/`, `package.json` |

**Golden rule:** Prettier owns whitespace, quotes, semicolons, line width.
Linters own everything else. `eslint-config-prettier` (last in ESLint config) and
`stylelint-config-standard` (v36+, no stylistic rules) guarantee zero conflict.

## Commands

```bash
pnpm lint           # lint:md + lint:code + lint:css (the full gate; CI runs this)
pnpm lint:md        # markdownlint docs/**/*.md
pnpm lint:code      # eslint .
pnpm lint:css       # stylelint custom.css + Vue SFCs
pnpm lint:fix       # eslint . --fix
pnpm lint:css:fix   # stylelint --fix
pnpm format         # prettier --write .
pnpm format:check   # prettier --check .
```

`pnpm lint` is aggregated, so CI (`ci.yml` → `pnpm lint`) and the PR checklist
(`pnpm lint`) automatically cover every linter — no extra CI step is needed when
a new sub-linter is wired into `lint`.

## Pre-Commit Hook (lint-staged)

`.husky/pre-commit` runs `lint-staged`, which fixes only staged files:

| Pattern | Pipeline |
|---------|----------|
| `*.{ts,js,mjs,cjs}` | `eslint --fix` → `prettier --write` |
| `*.vue` | `eslint --fix` → `stylelint --fix` → `prettier --write` |
| `*.css` | `stylelint --fix` → `prettier --write` |
| `*.{json,yaml,yml}` | `prettier --write` |
| `*.md` | `markdownlint` |

**Order matters:** linters run before Prettier so Prettier has the last word on
formatting. `.husky/commit-msg` runs commitlint (Conventional Commits).

## Rule-Disable Decisions

When a lint rule fires, prefer fixing the code. Disable a rule **only** when it
conflicts with deliberate intent — and always leave a comment explaining why.

### ESLint (`eslint.config.mjs`)

| Rule | State | Why |
|------|-------|-----|
| `no-console` | off | Teaching codebase logs to demonstrate behavior |
| `@typescript-eslint/no-explicit-any` | off | Teaching examples use `any` for brevity |
| `@typescript-eslint/no-unused-vars` | warn, `^_` ignored | Prefix intentionally-unused with `_` |
| `vue/attributes-order` | off | Layout-only rule — Prettier's job |
| `vue/one-component-per-file` | off (tests/theme) | Inline helper components are intentional |
| `no-unused-vars` | off (`exercises/answers/**`) | Answer files are read, not imported |

### Stylelint (`stylelint.config.mjs`)

| Rule | State | Why |
|------|-------|-----|
| `selector-class-pattern` | null | VitePress ships PascalCase classes (`.VPNav`) we cannot rename |
| `property-no-vendor-prefix` | null | `-webkit-backdrop-filter` / `-webkit-user-select` required for Safari |
| `declaration-property-value-keyword-no-deprecated` | null | `word-break: break-word` is intentional |
| `no-descending-specificity` | null (`*.vue` only) | Scoped CSS `[data-v-*]` makes ordering moot |
| `selector-pseudo-class-no-unknown` | ignore `deep/global/slotted` | Vue scoped pseudo-classes |

For a one-off exception inside a file, use an inline
`/* stylelint-disable-next-line <rule> */` with a comment, not a global off.

## Pitfalls

- **`stylelint --fix` strips vendor prefixes.** The default `--fix` will delete
  `-webkit-backdrop-filter` / `-webkit-user-select`, breaking Safari. We keep
  `property-no-vendor-prefix: null` to prevent this — do not re-enable it.
- **`stylelint-config-recommended-vue` must be LAST in `extends`.** It sets the
  `postcss-html` custom syntax; if another config follows it, `.vue` parsing
  breaks with `Unknown word (CssSyntaxError)`.
- **Stylelint ignores dot-directories.** `docs/.vitepress/**` is matched only via
  an explicit path in the `lint:css` glob, not a bare `docs/**`.
- **commitlint `body-max-line-length: 100`.** Long commit bodies must be split
  into multiple short `-m` lines.
- **Side-effect calls vs unused vars.** When removing an unused `const x = fn()`
  whose call has a side effect, keep the bare call `fn();` — do not delete it.

## Adding a New Linter

1. Install the linter + its shared config as a `-Dw` devDependency.
2. Create its config at repo root; disable rules that conflict with Prettier.
3. Add a `lint:<x>` script and chain it into `lint`.
4. Add a lint-staged entry (linter `--fix` **before** `prettier --write`).
5. Clear all existing warnings to zero, then `pnpm lint` + `pnpm build` to verify.
6. Document any rule-disable decisions in the table above.
