# SOP 01: Adding a New Pattern

## Trigger

When proposing or implementing a new programming pattern for the project.

## Prerequisites

- The pattern is used in ≥ 2 different production projects (verifiable via source code)
- The pattern is cross-language (not specific to one language or framework)
- The pattern is a code-level technique (not purely architectural)

## Steps

### 1. Topic Validation

- [ ] Confirm ≥ 2 top-tier projects use this pattern
- [ ] Confirm it is cross-domain (not limited to one language/platform)
- [ ] Confirm it is a distinct code-level technique (not just an architecture concept)
- [ ] Check it does not duplicate an existing pattern in `docs/patterns/`

### 2. Source Code Location

- [ ] Locate the exact usage in each target project
- [ ] Obtain GitHub permanent links (use `main`/`master` branch + line numbers)
- [ ] Verify each link returns HTTP 200: `curl -sI <url> | head -1`
- [ ] Read surrounding context to confirm your understanding is correct

### 3. Write the Pattern Document

Create `docs/patterns/<pattern-name>.md` following the template:

```
# Pattern: [Name]
## One Liner          — ≤ 30 English words
## Core Idea          — concept + ASCII diagram or Excalidraw
## Production Proof   — table with ≥ 2 projects, precise URLs
## Implementation     — TypeScript (required) + ≥ 1 other language
## Exercises          — links to exercise files
## When to Use        — applicable scenarios
## When NOT to Use    — limitations and alternatives
```

### 4. Write Multi-Language Implementations

- [ ] TypeScript implementation (required)
- [ ] At least one other language (Rust / Go / C)
- [ ] Each implementation is idiomatic to its language (follow SOP 03)

### 5. Design Exercises

- [ ] Create ≥ 2 runnable test files (follow SOP 04)
- [ ] Label difficulty: basic / intermediate / advanced
- [ ] Verify all tests pass locally

### 6. Self-Review

- [ ] Run full CI checks locally (`pnpm test`, `pnpm lint`, `pnpm typecheck`)
- [ ] Walk through the Quality Checklist (see below)
- [ ] Verify all source links with `pnpm verify-links`

### 7. Submit PR

- [ ] Use Conventional Commit: `feat: add <pattern-name> pattern`
- [ ] Fill in the PR template checklist
- [ ] Ensure CI is green

## Quality Checklist

### Content Completeness
- [ ] All required sections present
- [ ] One Liner ≤ 30 English words
- [ ] Core Idea has visual diagram

### Production Proof
- [ ] ≥ 2 different projects with source links
- [ ] Links precise to line numbers
- [ ] Links verified HTTP 200
- [ ] Links point to main/master branch

### Multi-Language
- [ ] TypeScript implementation (required)
- [ ] ≥ 1 other language implementation
- [ ] Each language follows its own conventions

### Exercises
- [ ] ≥ 2 runnable test cases
- [ ] Tests pass (`pnpm test` / `cargo test` / `go test`)
- [ ] Difficulty labels present

### Code Quality
- [ ] No lint errors
- [ ] TypeScript strict mode passes
