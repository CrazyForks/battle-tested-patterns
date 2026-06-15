# SOP 07: CI/CD Verification

## Trigger

- After every push to remote
- When setting up the repository for the first time
- When CI workflows fail

## Active Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | push + PR | Lint (`pnpm lint` = markdown + ESLint + Stylelint, see [SOP 14](14-lint-toolchain.md)), typecheck, verify-code, verify-mermaid, tests (TS + Rust + Go + Python + Vue), docs build, content quality (`check-content`: structure, EN-ZH parity, exercises, relations) |
| `deploy.yml` | push to main | Build VitePress → deploy GitHub Pages |
| `verify-links.yml` | push (patterns changed) + weekly cron | HTTP check all production proof links |
| `release.yml` | push tag `v*` | Generate release notes, create GitHub Release |

## Required Repository Settings

### GitHub Pages

```text
Settings → Pages → Source → "GitHub Actions"
```

### Branch Protection (recommended)

```text
Settings → Branches → Add rule for "main"
  → Require status checks: "CI / CI Pass" (single gate job covers all 9 checks)
  → Block force pushes
```

### Permissions

All workflows declare their own `permissions` block — the repository default stays at "Read repository contents" (minimum privilege).

## Post-Push Verification

- [ ] Go to Actions tab — all triggered workflows green
- [ ] If any fails, click into it and read the error log
- [ ] Fix locally, commit, push again

## Common Failures

| Error | Cause | Fix |
|-------|-------|-----|
| `ERR_PNPM_TARBALL_INTEGRITY` | npm CDN served different tarball | `pnpm store prune`, delete lockfile, reinstall |
| `Pages not enabled` | GitHub Pages not configured | Settings → Pages → "GitHub Actions" |
| `Permission denied` pushing changelog | Workflow lacks write permission | Check `permissions: contents: write` in workflow |
| Markdown lint errors in `node_modules` | Lint command missing `--ignore` | Use `--ignore docs/node_modules` |
| `[vite:vue] Unterminated template` | Literal `"` inside backtick template in `:attr="..."` | See [SOP 09](09-vue-build-pitfalls.md) Rule 1 |
| `[vue-tsc] declared but never read` | Unused variable in `v-for` destructuring | Drop unused binding: `[key]` not `[key, val]` |
| `MD012 Multiple consecutive blank lines` | Extra blank lines in markdown (common in ZH translations) | Remove duplicate blank lines; run `pnpm lint` locally |
| `MD031 Fenced code blocks should be surrounded by blank lines` | Missing blank line before/after ` ``` ` fence | Add blank lines around all code fences |
| `verify-code` failures | TypeScript code blocks in markdown that don't compile | Ensure all `ts` code blocks are valid; see [SOP 09](09-vue-build-pitfalls.md) |
| `verify-mermaid` failures | Invalid Mermaid syntax in ` ```mermaid ` blocks | Fix diagram syntax; run `pnpm verify-mermaid` locally to see details |
| ESLint `no-unused-vars` (warn/error) | Unused import or binding | Prefix intentional ones with `_`, else remove; keep side-effect calls bare. See [SOP 14](14-lint-toolchain.md) |
| Stylelint `Unknown word (CssSyntaxError)` in `.vue` | `recommended-vue` not last in `extends` | Ensure `stylelint-config-recommended-vue` is the LAST entry. See [SOP 14](14-lint-toolchain.md) |
| Stylelint errors on VitePress classes / vendor prefixes | New rule conflicts with intent | Don't auto-fix blindly (`--fix` strips Safari prefixes); disable the rule with a comment. See [SOP 14](14-lint-toolchain.md) |
