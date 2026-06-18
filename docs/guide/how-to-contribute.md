---
title: "How to Contribute"
description: "How to contribute a new pattern: verification requirements, source link standards, multi-language implementation guidelines."
---

# How to Contribute

We welcome contributions! Here's how to get started.

## Quick Start

```bash
git clone https://github.com/Totoro-jam/battle-tested-patterns.git
cd battle-tested-patterns
pnpm install
pnpm dev        # Start docs dev server
pnpm test       # Run all tests (exercises + docs components)
```

## Types of Contributions

### Add a New Pattern

1. Open an [Issue](https://github.com/Totoro-jam/battle-tested-patterns/issues/new?template=new-pattern.md) to propose the pattern
2. Follow [SOP 01: New Pattern](https://github.com/Totoro-jam/battle-tested-patterns/blob/e758be266d38db94723be233863e6f3effbf46cc/.sop/01-new-pattern.md)
3. Submit a PR with the filled-out checklist

### Add a Language Implementation

- Pick a pattern that's missing your language
- Follow [SOP 03: Multi-Language Implementation](https://github.com/Totoro-jam/battle-tested-patterns/blob/e758be266d38db94723be233863e6f3effbf46cc/.sop/03-multi-lang-impl.md)
- Implementations must be **idiomatic** — not line-by-line translations

### Fix a Broken Link

- Follow [SOP 06: Broken Link Fix](https://github.com/Totoro-jam/battle-tested-patterns/blob/e758be266d38db94723be233863e6f3effbf46cc/.sop/06-broken-link-fix.md)

### Improve Documentation

- Fix typos, clarify explanations, improve diagrams
- Use commit type `docs:` for revising existing content; use `feat:` when you
  add a whole new content unit (a new pattern, case study, or guide page)

## Quality Bar

Every pattern must meet these minimums:

- ≥ 2 production proofs with precise GitHub links (to line numbers)
- TypeScript implementation + ≥ 1 other language (Rust/Go/Python)
- Exercise files in all 4 languages (TS, Rust, Go, Python) + answer files
- Chinese translation with identical code blocks
- All tests pass (`pnpm test` · `cargo test` · `go test ./...` · `pytest`), no lint errors

See the full checklist in the [PR template](https://github.com/Totoro-jam/battle-tested-patterns/blob/e758be266d38db94723be233863e6f3effbf46cc/.github/PULL_REQUEST_TEMPLATE.md).

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add cooperative-scheduling pattern
fix: update broken Linux source link in bitmask
docs: improve Core Idea diagram for double-buffering
test: add advanced exercise for min-heap
ci: add Go test step to CI workflow
chore: update dependencies
```

Pick the type by **reader-facing impact**, not by which files changed:

- **A whole new content unit** (pattern, case study, guide page) → `feat:`
  (this is what bumps the version and lands in the changelog as a milestone).
- **Revising existing content** (deepening, polishing, fixing wording) → `docs:`
  (shown in the changelog, but does not bump the version).
- **Internal-only changes** — `.sop/` updates, tooling, config → `chore:`
  (kept out of the reader-facing changelog).
