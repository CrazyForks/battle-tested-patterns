# Copilot Instructions for Battle-Tested Patterns

## Project Context

This repository collects cross-language programming patterns extracted from production
codebases like React, Linux kernel, Go runtime, and Chromium. Each pattern includes
precise GitHub source links, multi-language implementations, and runnable exercises.

## Key Rules

1. Never fabricate source links — leave TODO rather than invent URLs
2. Never claim a project uses a pattern without a verifiable GitHub link
3. Code must be runnable, not pseudocode
4. Multi-language implementations must be idiomatic (not line-by-line translation)
5. Source links must be precise to line numbers on main/master branch

## Pattern Template

Every pattern document must include: One Liner (≤30 words), Core Idea (with diagram),
Production Proof (≥2 projects with precise URLs), Implementation (TypeScript + ≥1 other),
Exercises (≥2 tests with difficulty labels), When to Use, When NOT to Use,
More Production Uses, Related Patterns, Challenge Questions (3-4 scenario Q&A).

## Tech Stack

- Monorepo: pnpm workspace (docs/, exercises/)
- Docs: VitePress
- Tests: Vitest (TS), cargo test (Rust), go test (Go), pytest (Python)
- Commits: Conventional Commits
