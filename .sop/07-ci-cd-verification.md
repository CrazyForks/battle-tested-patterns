# SOP 07: CI/CD Verification

## Trigger

- After every push to remote
- When setting up the repository for the first time
- When CI workflows fail

## Active Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | push + PR | Lint, typecheck, tests (TS + Rust + Go + Python), docs build |
| `deploy.yml` | push to main | Build VitePress → deploy GitHub Pages |
| `content-quality.yml` | push + PR (patterns/exercises changed) | Template completeness, #L1 link detection, EN-ZH code parity, 4-language exercise verification |
| `verify-links.yml` | push (patterns changed) + weekly cron | HTTP check all production proof links |
| `release.yml` | push tag `v*` | Generate release notes, create GitHub Release |

## Required Repository Settings

### GitHub Pages
```
Settings → Pages → Source → "GitHub Actions"
```

### Branch Protection (recommended)
```
Settings → Branches → Add rule for "main"
  → Require status checks: CI, Content Quality Check
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
