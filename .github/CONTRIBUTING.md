# Contributing to Battle-Tested Patterns

Thank you for your interest in contributing! This project collects production-proven programming patterns with precise source links, multi-language implementations, and runnable exercises.

## Before You Start

1. Read the [SOPs](./../.sop/README.md) — especially [SOP 01: New Pattern](./../.sop/01-new-pattern.md)
2. Check existing [patterns](../docs/patterns/) to avoid duplicates
3. Open an Issue first to discuss new patterns before submitting a PR

## What Makes a Good Pattern?

- **Production-proven**: Used in ≥ 2 real-world projects (with verifiable source links)
- **Cross-language**: Applicable beyond a single language or framework
- **Code-level**: A concrete technique, not an abstract architecture concept
- **Teachable**: Can be explained with a diagram and practiced with exercises

## Adding a New Pattern

Follow [SOP 01: New Pattern](./../.sop/01-new-pattern.md). In short:

1. **Verify** the pattern exists in ≥ 2 production codebases
2. **Write** the pattern document following the [template](../CLAUDE.md#pattern-file-template)
3. **Implement** in TypeScript (required) + at least 1 other language
4. **Create** ≥ 2 exercise test files with difficulty labels
5. **Verify** all source links return HTTP 200
6. **Submit** PR with a filled-out checklist

## Source Link Requirements

This is our core differentiator — every claim must be verifiable:

```
✅ https://github.com/facebook/react/blob/main/.../ReactFiberFlags.js#L18-L22
❌ https://github.com/facebook/react/tree/main/packages/  (directory, not precise)
❌ Links to feature branches (may be deleted)
❌ Links not verified with curl -I
```

## Code Standards

- **TypeScript**: strict mode, no `any`, Vitest for tests
- **Rust**: idiomatic, `#[cfg(test)]` modules, `cargo test`
- **Go**: standard library preferred, table-driven tests, `go test`
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, etc.)

## Running Locally

```bash
pnpm install          # Install dependencies
pnpm dev              # Start VitePress dev server
pnpm test             # Run TypeScript exercises
pnpm lint             # Lint markdown
pnpm typecheck        # TypeScript type check
pnpm verify-links     # Verify source URLs
```

## PR Process

1. Fork and create a branch: `feat/add-<pattern-name>`
2. Follow the template and checklist in the PR template
3. Ensure CI is green
4. Wait for review (see [SOP 05](./../.sop/05-pr-review.md))

## Reporting Issues

- **Broken link**: Use the [broken-link template](ISSUE_TEMPLATE/broken-link.md)
- **New pattern idea**: Use the [new-pattern template](ISSUE_TEMPLATE/new-pattern.md)
- **Other**: Open a regular Issue with context

## Code of Conduct

Be respectful, constructive, and focused on quality. We value accuracy over speed.
