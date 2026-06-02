# How to Contribute

We welcome contributions! Here's how to get started.

## Quick Start

```bash
git clone https://github.com/Totoro-jam/battle-tested-patterns.git
cd battle-tested-patterns
pnpm install
pnpm dev        # Start docs dev server
pnpm test       # Run exercises
```

## Types of Contributions

### Add a New Pattern

1. Open an [Issue](https://github.com/Totoro-jam/battle-tested-patterns/issues/new?template=new-pattern.md) to propose the pattern
2. Follow [SOP 01: New Pattern](https://github.com/Totoro-jam/battle-tested-patterns/blob/main/.sop/01-new-pattern.md)
3. Submit a PR with the filled-out checklist

### Add a Language Implementation

- Pick a pattern that's missing your language
- Follow [SOP 03: Multi-Language Implementation](https://github.com/Totoro-jam/battle-tested-patterns/blob/main/.sop/03-multi-lang-impl.md)
- Implementations must be **idiomatic** — not line-by-line translations

### Fix a Broken Link

- Follow [SOP 06: Broken Link Fix](https://github.com/Totoro-jam/battle-tested-patterns/blob/main/.sop/06-broken-link-fix.md)

### Improve Documentation

- Fix typos, clarify explanations, improve diagrams
- Use commit type `docs:`

## Quality Bar

Every pattern must meet these minimums:

- ≥ 2 production proofs with precise GitHub links (to line numbers)
- TypeScript implementation + ≥ 1 other language
- ≥ 2 exercise test files with difficulty labels
- All tests pass, no lint errors

See the full checklist in the [PR template](https://github.com/Totoro-jam/battle-tested-patterns/blob/main/.github/PULL_REQUEST_TEMPLATE.md).

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add cooperative-scheduling pattern
fix: update broken Linux source link in bitmask
docs: improve Core Idea diagram for double-buffering
test: add advanced exercise for min-heap
ci: add Go test step to CI workflow
chore: update dependencies
```
