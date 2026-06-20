# SOP 08: Release Process

## Trigger

When a content milestone is reached and ready for a version tag.

Use [semver](https://semver.org/): bump **minor** for new features/patterns, **patch** for fixes-only batches.

## Pre-Release Checklist

### 1. AI Agent Review (required before every tag)

Run the following sub-agents locally via Claude Code. Each agent has a single,
well-scoped responsibility so findings are actionable and non-overlapping. Every
agent **rates each dimension 1–10** and lists concrete findings with file paths
and line numbers. Run agents in parallel where possible.

> **Gate rule:** any dimension scoring **< 7** is a blocker — fix and re-run that
> agent before tagging. Record the final scores in the release PR / commit body.

#### 1.1 Contributor Agent — onboarding friction

```text
Prompt: Walk through the contribution process as described in CONTRIBUTING.md
and .sop/01-new-pattern.md as a first-time contributor. Actually attempt the
steps. Report friction points, unclear instructions, missing prerequisites,
and any command that fails or behaves unexpectedly. Rate: clarity,
completeness, reproducibility.
```

#### 1.2 Content Reviewer Agent — pattern quality & structure

```text
Prompt: Review all pattern documents against the Pattern File Template in
CLAUDE.md. Check: all 11 required sections present, One Liner ≤ 30 words,
≥ 2 production proofs, ≥ 2 related patterns (bidirectional), challenge
questions use ::: details, difficulty labels present. Flag any stale or
placeholder (<!-- TODO -->) content. Rate: structural completeness,
explanation quality, exercise design.
```

#### 1.3 Source Proof Auditor Agent — link precision (RED LINE)

```text
Prompt: Audit every Production Proof link in docs/patterns/**. Verify each is
(a) a precise blob URL with #Lx-Ly line range, (b) SHA-pinned (not a branch),
(c) alive (HTTP 200), (d) the cited line range actually contains the claimed
code. Use scripts/verify-links.ts and scripts/verify-lines.ts as the source of
truth. NEVER accept a fabricated or directory-level link. Rate: precision,
liveness, content-match. Any fabricated/broken link is an automatic score 0.
```

#### 1.4 Multi-Language Idiom Agent — code quality across TS/Rust/Go/Python

```text
Prompt: For each pattern, review the TypeScript, Rust, Go, and Python
implementations. Verify each is idiomatic for its language (not a line-by-line
translation), compiles via `pnpm verify-code`, and the exercise answers pass
their native test runners. Flag non-idiomatic constructs, unsafe patterns, and
cross-language behavioral divergence. Rate per language: idiomaticity,
correctness, consistency.
```

#### 1.5 Bilingual Parity Agent — EN/ZH consistency

```text
Prompt: Compare every English pattern doc with its Chinese (zh-CN) counterpart.
Verify parity of: code blocks (identical), section structure, source links, and
Mermaid diagrams. Check the Chinese reads naturally (not machine-translated) and
technical terms are translated consistently across patterns. Use
`pnpm check:zh-parity` as the structural baseline. Rate: structural parity,
translation fluency, terminology consistency.
```

#### 1.6 Security Agent — scripts, dependencies, frontend

```text
Prompt: Audit for security issues. Scripts: no shell injection (execFile not
execSync, no string-interpolated commands), no unbounded recursion/timeouts,
all fetch calls have AbortSignal timeouts, no GitHub Actions annotation
injection. Frontend: Vue components handle errors without leaking internals, no
XSS via v-html/innerHTML, no secrets in source. Dependencies: check for known
CVEs in package.json / Cargo.toml / go.mod / requirements.txt. Rate: injection
safety, dependency hygiene, frontend safety. Any exploitable finding is a
blocker regardless of score.
```

#### 1.7 Frontend & A11y Agent — VitePress site quality

```text
Prompt: Review the built VitePress site. Check: `pnpm build` produces no
hydration warnings, no console errors on key pages, dark/light mode both render
correctly, interactive visualizations degrade gracefully (error boundaries),
images/diagrams have accessible text, and keyboard/screen-reader navigation
works on the homepage and a sample pattern page. Rate: build cleanliness,
runtime stability, accessibility.
```

#### Review completion checklist

- [ ] All 7 agents completed and scored
- [ ] All dimensions ≥ 7 (or blockers explicitly waived with rationale)
- [ ] Source Proof Auditor: zero fabricated/broken links (hard gate)
- [ ] Security Agent: zero exploitable findings (hard gate)
- [ ] Final scores recorded in the release commit/PR body
- [ ] All fixes committed before tagging

### 2. Quality Gates

- [ ] `pnpm test` — all tests pass (docs components + exercises in TS/Rust/Go/Python)
- [ ] `pnpm lint` — markdown + ESLint + Stylelint clean (see [SOP 14](14-lint-toolchain.md))
- [ ] `pnpm verify-code` — all code blocks compile
- [ ] `pnpm verify-mermaid` — all Mermaid diagrams valid
- [ ] `pnpm build` — docs site builds
- [ ] `pnpm check:content` — content quality checks pass (structure, parity, exercises, relations)
- [ ] `pnpm verify-links` — all production proof links alive
- [ ] `pnpm verify-lines` — line ranges valid and keywords match (requires network)
- [ ] `tsx scripts/convert-to-sha-links.ts --dry-run` — no unconverted branch links (convert if any found)
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
# Update package.json version field to match

git add CHANGELOG.md package.json
git commit -m "chore: prepare release vX.Y.Z"

git tag vX.Y.Z
git push && git push --tags
```

`release.yml` will automatically create a GitHub Release by extracting the corresponding version section from `CHANGELOG.md`. Ensure the CHANGELOG entry is complete before tagging.

### 5. Post-Release

- [ ] Verify GitHub Release was created with correct content
- [ ] Verify docs site is deployed and accessible
- [ ] Update any external references (if applicable)
