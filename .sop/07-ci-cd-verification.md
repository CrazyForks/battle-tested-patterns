# SOP 07: CI/CD Verification & Secrets Configuration

## Trigger

- After every commit + push to remote
- When setting up the repository for the first time
- When CI/CD workflows fail

## Required GitHub Repository Settings

### 1. GitHub Pages

Go to **Settings → Pages**:
- Source: **GitHub Actions** (not "Deploy from a branch")
- This is required for `deploy.yml` to work

### 2. Repository Permissions

Go to **Settings → Actions → General**:
- Workflow permissions: **Read and write permissions**
- Allow GitHub Actions to create and approve pull requests: **checked**
- This is required for `changelog.yml` to commit back to the repo

### 3. Secrets & Variables

Currently no custom secrets are required. All workflows use `GITHUB_TOKEN` which is automatically provided.

If you add workflows that need custom secrets in the future:

| Secret Name | Where to Configure | Used By |
|-------------|-------------------|---------|
| `GITHUB_TOKEN` | Auto-provided | All workflows |

> **Security Note**: Never add secrets that grant write access to external systems
> unless absolutely necessary. Prefer read-only tokens where possible.

## Post-Push Verification Checklist

After every push, verify:

- [ ] Go to **Actions** tab on GitHub
- [ ] Check all triggered workflows are green:
  - `CI` — lint, typecheck, tests pass
  - `Deploy to GitHub Pages` — docs site builds and deploys (main branch only)
  - `Update Changelog` — CHANGELOG.md updated (main branch only)
- [ ] If any workflow fails, click into it to read the error log
- [ ] Fix the issue locally, commit, and push again

## Common CI Failures & Fixes

### "Permission denied" in changelog.yml
**Cause**: Repository doesn't allow Actions to push commits.
**Fix**: Settings → Actions → General → Workflow permissions → "Read and write permissions"

### deploy.yml fails with "Pages not enabled"
**Cause**: GitHub Pages not configured.
**Fix**: Settings → Pages → Source → "GitHub Actions"

### test-rust or test-go fails with "no files found"
**Cause**: Rust/Go exercise directories are empty or missing Cargo.toml/go.mod.
**Fix**: Ensure `exercises/rust/Cargo.toml` and `exercises/go/go.mod` exist with valid content.

### verify-links.yml can't create Issues
**Cause**: Workflow lacks `issues: write` permission.
**Fix**: Already configured in the workflow file. If still failing, check repository Actions permissions.

## Security Audit Checklist

- [ ] No secrets stored in code (no `.env` files committed)
- [ ] `GITHUB_TOKEN` permissions are minimal (scoped per workflow)
- [ ] No third-party Actions with `write` permissions to secrets
- [ ] Workflows use pinned Action versions (`@v4`, not `@main`)
- [ ] No `pull_request_target` trigger (prevents fork-based attacks)
- [ ] Dependabot or similar enabled for Action version updates
- [ ] Branch protection rules on `main`:
  - Require PR reviews before merging
  - Require status checks to pass
  - No force pushes allowed

## First-Time Setup Checklist

After creating the remote repository and pushing the first commit:

1. [ ] **GitHub Pages**: Settings → Pages → Source → "GitHub Actions"
2. [ ] **Actions permissions**: Settings → Actions → General → "Read and write permissions"
3. [ ] **Branch protection**: Settings → Branches → Add rule for `main`
   - Require status checks: `Lint & Typecheck`, `Test (TypeScript)`, `Build Docs`
   - Require PR reviews (optional for solo projects)
4. [ ] **Verify first deploy**: Push to main → check Actions → verify site at `https://<user>.github.io/battle-tested-patterns/`
5. [ ] **Verify link checker**: Manually trigger `Verify Source Links` workflow → confirm it runs
