---
name: new-pattern
description: Guided workflow to create a new pattern following the project template and quality standards. Walks through topic validation, source verification, implementation, exercises, challenge questions, and bilingual docs.
---

# Create a New Pattern

You are creating a new pattern for battle-tested-patterns. Follow each step in order. Do NOT skip source verification. Reference SOP 01 for the full checklist.

## Step 1: Topic Validation

Ask these questions before proceeding:
1. What is the pattern name?
2. Can you name ≥ 2 production projects that use it (with source links)?
3. Is it cross-language (not specific to one language/framework)?
4. Is it a code-level technique (not purely architectural)?
5. Does it NOT duplicate an existing pattern in `docs/patterns/`?

If any answer is "no", stop and explain why this pattern doesn't fit.

## Step 2: Source Code Location

For each production project:
1. Search the project repo for the exact usage
2. Get the GitHub URL with line numbers: `https://github.com/{org}/{repo}/blob/main/{path}#L{start}-L{end}`
3. Verify with `curl -sI <url> | head -1` — must return HTTP 200
4. Read the code to confirm your understanding
5. Write a Production Proof description specific enough to learn WITHOUT clicking the link

**CRITICAL: Never fabricate a URL. If you cannot verify a link, write `<!-- TODO: verify source link -->` instead.**

## Step 3: Write the Document

Create `docs/patterns/<pattern-name>/index.md` with ALL required sections:

```
# Pattern: [Name]
## One Liner          ← ≤ 30 English words, capture WHY not just WHAT
## Core Idea          ← concept + diagram (choose best representation for this pattern)
## Production Proof   ← table with ≥ 2 verified URLs, descriptions show HOW not just WHAT
## Implementation     ← TypeScript (required) + ≥ 1 other language in ::: code-group
## Exercises          ← table with basic + intermediate exercise links
## When to Use        ← ≥ 3 concrete scenarios
## When NOT to Use    ← ≥ 2 concrete alternatives
## More Production Uses ← bullet list with repo links
## Challenge Questions ← 3-4 scenario Q&A using ::: details syntax
```

### Diagram Guidelines
- Choose the representation that best matches the pattern's nature:
  - Ring/circular → for hash rings, ring buffers
  - Timeline → for temporal patterns (WAL, MVCC, retry)
  - State diagram → for state machines, circuit breakers (use mermaid)
  - Tree → for tries, heaps, B-trees
  - Box-and-arrow → for data structures (LRU, skip list)
- ASCII `text` blocks: every box border must be vertically aligned
- ZH docs: CJK characters = 2 display columns; compensate with fewer spaces
- Verify alignment in a monospace font before committing

## Step 4: Implement

In the `::: code-group` block:
- TypeScript (required) — idiomatic, strict types, no `any`
- At least one of: Rust / Go / Python
- Each implementation must be idiomatic, not a line-by-line translation
- Go: do NOT add `import` blocks — the verify-code script auto-detects imports
- Rust: wrap standalone code in `fn main()` or use `pub struct`/`pub fn`
- Verify: `pnpm verify-code`

## Step 5: Design Exercises

Create in `exercises/typescript/<pattern>/`:
- `01-basic.test.ts` — basic pattern mechanics (required)
- `02-intermediate.test.ts` — real-world application scenario (required)
- Use TODO-stub format with `// TODO: implement` markers
- Include working implementations so CI passes
- Separator: `// ─── Tests (do not modify below this line) ───────────────────────`
- 4-5 meaningful test cases per exercise
- Verify: `pnpm test` AND `pnpm typecheck`

## Step 6: Write Challenge Questions

Add `## Challenge Questions` at the end of the EN doc:
- 3-4 questions using `::: details Q1: [question]` ... `:::` syntax
- Questions test understanding through production scenarios
- Verify factual accuracy of all answers
- Escape `|` in table cells, use `×` instead of `*` for multiplication
- Copy to ZH doc with header `## 挑战题`, translate Q&A to Chinese (keep technical terms and code in English)

## Step 7: Create Chinese Translation

Create `docs/zh/patterns/<pattern-name>/index.md`:
- Translate structural content (headings, explanations, When to Use)
- Keep code blocks identical to English
- Keep Production Proof links identical
- Challenge Questions: translate questions + answers to Chinese, keep technical terms/code in English
- ASCII diagrams: use English labels inside box-drawing diagrams (no CJK in diagrams)

## Step 8: Update Navigation

All of these must be updated:
- [ ] `docs/.vitepress/config.ts` — BOTH English and Chinese sidebar
- [ ] `docs/index.md` — English homepage pattern table
- [ ] `docs/zh/index.md` — Chinese homepage pattern table
- [ ] `README.md` — pattern table + cheat sheet table
- [ ] `README.zh-CN.md` — pattern table + cheat sheet table
- [ ] `docs/by-project/*.md` — add to ALL relevant project pages (React, Linux, Go, Redis, etc.)
- [ ] `docs/by-project/more-projects.md` — add if project not covered by specific pages
- [ ] `docs/zh/by-project/*.md` — sync Chinese versions
- [ ] `README.md` cheat sheet — add to correct category table
- [ ] `README.zh-CN.md` cheat sheet — sync Chinese version
- [ ] `docs/guide/pattern-connections.md` + ZH — update if pattern fits a system case study

## Step 9: Full Verification

Run ALL checks before committing:
```bash
pnpm test          # All exercises pass
pnpm typecheck     # TypeScript strict mode
pnpm verify-code   # All code blocks compile (TS/Python/Rust/Go)
pnpm lint          # Markdown lint clean
pnpm build         # VitePress builds
```

## Step 10: Site Accessibility Verification

After build, verify all new pages are reachable:
- `ls docs/.vitepress/dist/patterns/<name>/index.html` — EN page exists
- `ls docs/.vitepress/dist/zh/patterns/<name>/index.html` — ZH page exists
- After deploy, spot-check live URLs in both languages

## Step 11: Commit and Tag

- Commit message: `feat: add <pattern-name> pattern`
- If adding multiple patterns: one commit per batch with list
- Push and verify CI is green before tagging
- Tag: `git tag -a v1.X.0 -m "description"` + `git push origin v1.X.0`
