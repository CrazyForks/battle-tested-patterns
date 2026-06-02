---
name: new-pattern
description: Guided workflow to create a new pattern following the project template and quality standards. Walks through topic validation, source verification, implementation, and exercises.
---

# Create a New Pattern

You are creating a new pattern for battle-tested-patterns. Follow each step in order. Do NOT skip source verification.

## Step 1: Topic Validation

Ask these questions before proceeding:
1. What is the pattern name?
2. Can you name ≥ 2 production projects that use it?
3. Is it cross-language (not specific to one language/framework)?
4. Is it a code-level technique (not purely architectural)?

If any answer is "no", stop and explain why this pattern doesn't fit.

## Step 2: Source Code Location

For each production project:
1. Search the project repo for the exact usage
2. Get the GitHub URL with line numbers: `https://github.com/{org}/{repo}/blob/main/{path}#L{start}-L{end}`
3. Verify with `curl -sI <url> | head -1` — must return HTTP 200
4. Read the code to confirm your understanding

**CRITICAL: Never fabricate a URL. If you cannot verify a link, write `<!-- TODO: verify source link -->` instead.**

## Step 3: Write the Document

Create `docs/patterns/<pattern-name>.md` with ALL required sections:

```
# Pattern: [Name]
## One Liner          ← ≤ 30 English words
## Core Idea          ← concept + ASCII diagram
## Production Proof   ← table with ≥ 2 verified URLs
## Implementation     ← TypeScript (required) + ≥ 1 other language
## Exercises          ← links to exercise files
## When to Use
## When NOT to Use
```

## Step 4: Implement

- TypeScript: `exercises/typescript/<pattern>/01-basic.test.ts` (required)
- At least one other language (Rust in `exercises/rust/src/`, Go in `exercises/go/`)
- Each implementation must be idiomatic, not a line-by-line translation

## Step 5: Verify

Run all checks:
```bash
pnpm test          # TypeScript exercises pass
pnpm build         # Docs site builds
pnpm verify-links  # Source links alive
```

## Step 6: Self-Review Checklist

Before committing, verify:
- [ ] All required sections present
- [ ] One Liner ≤ 30 words
- [ ] ≥ 2 production proofs with verified URLs
- [ ] TypeScript + ≥ 1 other language
- [ ] ≥ 2 exercise test files, all passing
- [ ] Commit message: `feat: add <pattern-name> pattern`
