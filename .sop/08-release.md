# SOP 08: Release Process

## Trigger

When a content milestone is reached and ready for a version tag.

Use [semver](https://semver.org/): bump **minor** for new features/patterns, **patch** for fixes-only batches.

## Pre-Release Checklist

### 1. AI Agent Review (required before every tag)

Run two sub-agents locally via Claude Code:

**Contributor Agent** — simulates a first-time contributor:
```
Prompt: Walk through the contribution process as described in CONTRIBUTING.md
and .sop/01-new-pattern.md. Report friction points, unclear instructions,
and missing steps.
```

**Reviewer Agent** — audits content quality:
```
Prompt: Review all pattern documents for production proof precision,
code quality, exercise format consistency, Chinese translation parity,
and stale references. Rate each dimension 1-10.
```

- [ ] Both agents complete
- [ ] All critical findings (score < 7) addressed
- [ ] Fixes committed before tagging

### 2. Quality Gates

- [ ] `pnpm test` — all TypeScript tests pass
- [ ] `cargo test` — all Rust tests pass (in `exercises/rust/`)
- [ ] `pnpm lint` — no markdown lint errors
- [ ] `pnpm build` — docs site builds
- [ ] `pnpm verify-links` — all production proof links alive
- [ ] CI green on latest commit
- [ ] No `<!-- TODO -->` markers in completed pattern docs

### 3. Content Verification

- [ ] All patterns have complete sections (One Liner through When NOT to Use)
- [ ] All patterns have ≥ 2 production proofs with precise line numbers
- [ ] All patterns have exercises with passing tests
- [ ] All patterns have Chinese translations
- [ ] README pattern table matches actual patterns
- [ ] Homepage pattern table matches actual patterns
- [ ] Sidebar navigation includes all patterns (both locales)

### 4. Tag and Release

```bash
# Update CHANGELOG.md: change "## Unreleased" → "## vX.Y.Z"
# Update compare link: v(prev)...main → v(prev)...vX.Y.Z

git add CHANGELOG.md
git commit -m "chore: prepare release vX.Y.Z"

git tag vX.Y.Z
git push && git push --tags
```

`release.yml` will automatically create a GitHub Release via `changelogen`.

**Known issue:** `changelogen` generates a self-referencing diff range (`vX.Y.Z...vX.Y.Z`) because the tag already exists at generation time. After the release is created, manually update the release body:

```bash
gh release edit vX.Y.Z --notes "$(cat <<'EOF'
## vX.Y.Z

**N commits** since vPREV — one-line summary.

### Highlights
- ...

(paste categorized changes from CHANGELOG.md)

[Full changelog](https://github.com/Totoro-jam/battle-tested-patterns/compare/vPREV...vX.Y.Z)
EOF
)"
```

### 5. Post-Release

- [ ] Verify GitHub Release was created with correct content
- [ ] Verify docs site is deployed and accessible
- [ ] Update any external references (if applicable)
