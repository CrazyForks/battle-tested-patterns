# SOP 01: Adding a New Pattern

## Trigger

When proposing or implementing a new programming pattern for the project.

## Prerequisites

- The pattern is used in ≥ 2 different production projects (verifiable via source code)
- The pattern is cross-language (not specific to one language or framework)
- The pattern is a code-level technique (not purely architectural)

## Complete File Checklist

Adding a new pattern (e.g. `bloom-filter`) requires creating and modifying these files:

**Create:**

```text
docs/patterns/bloom-filter/index.md          # English pattern document
docs/zh/patterns/bloom-filter/index.md       # Chinese translation
exercises/typescript/bloom-filter/01-basic.test.ts   # Exercise (required)
exercises/typescript/bloom-filter/02-*.test.ts       # More exercises (optional)
```

**Modify:**

```text
docs/.vitepress/config.ts    # Add to BOTH English and Chinese sidebar
docs/index.md                # Add to English homepage pattern table
docs/zh/index.md             # Add to Chinese homepage pattern table
README.md                    # Add to pattern table
README.zh-CN.md              # Add to pattern table
```

**Optional (if adding Rust exercises):**

```text
exercises/rust/src/bloom_filter.rs    # Create the Rust file
exercises/rust/src/main.rs            # Add `mod bloom_filter;`
```

## Steps

### 1. Topic Validation

- [ ] Confirm ≥ 2 top-tier projects use this pattern
- [ ] Confirm it is cross-domain (not limited to one language/platform)
- [ ] Confirm it is a distinct code-level technique (not just an architecture concept)
- [ ] Check it does not duplicate an existing pattern in `docs/patterns/`

### 2. Source Code Location

- [ ] Locate the exact usage in each target project
- [ ] Obtain GitHub permanent links (`main`/`master` branch + line numbers)
- [ ] Verify each link returns HTTP 200: `curl -sI <url> | head -1`
- [ ] Links must be precise to line numbers (`#L42-L80`), not file-level (`#L1`)
- [ ] Read surrounding context to confirm your understanding is correct

### 3. Write the Pattern Document

Create `docs/patterns/<pattern-name>/index.md` following the template:

```markdown
# Pattern: [Name]
## One Liner          — ≤ 30 English words
## Core Idea          — concept + diagram (Mermaid, ASCII, or table — whichever fits best)
## Production Proof   — table with ≥ 2 projects, precise GitHub URLs to line numbers
## Implementation     — TypeScript (required) + ≥ 1 other (Rust / Go / Python / C)
## Exercises          — table linking to exercise files
## When to Use        — applicable scenarios
## When NOT to Use    — limitations and alternatives
```

### 4. Write Multi-Language Implementations

Include implementations in the `:::code-group` block:

- [ ] TypeScript (required)
- [ ] At least one of: Rust / Go / Python / C
- [ ] Each implementation is idiomatic to its language (follow SOP 03)
- [ ] Verify all code blocks compile: `pnpm verify-code`

### 5. Design Exercises

Create files in `exercises/typescript/<pattern-name>/`:

- [ ] ≥ 1 exercise file with difficulty label in filename (`01-basic`, `02-*`)
- [ ] Use the TODO-stub format: functions with `// TODO: implement` comments containing the working solution (so CI passes), with a `// ─── Tests (do not modify) ───` separator
- [ ] Learners are expected to delete the implementations and rewrite them to pass the tests
- [ ] Verify all tests pass locally: `pnpm test`

### 6. Create Chinese Translation

- [ ] Create `docs/zh/patterns/<pattern-name>/index.md`
- [ ] Translate structural content (headings, explanations, When to Use)
- [ ] Keep code blocks identical to English (code is not translated)
- [ ] Production Proof links are the same in both languages
- [ ] If you cannot translate, add `<!-- TODO: translate -->` markers

### 7. Update Navigation

- [ ] Add to `docs/.vitepress/config.ts` — both English and Chinese sidebar sections
- [ ] Add to `docs/index.md` homepage pattern table
- [ ] Add to `docs/zh/index.md` homepage pattern table
- [ ] Add to `README.md` pattern table
- [ ] Add to `README.zh-CN.md` pattern table

### 8. Self-Review

- [ ] Run `pnpm test` — all tests pass
- [ ] Run `pnpm verify-code` — all code blocks compile (TS/Python/Rust/Go)
- [ ] Run `pnpm lint` — no markdown lint errors
- [ ] Run `pnpm build` — docs site builds
- [ ] Run `pnpm verify-links` — source links alive

### Common Mistakes Checklist

- [ ] Go code: no `:=` at package level (must be inside `func`)
- [ ] Go code: all called functions exist (add stubs like `func process(s string) {}`)
- [ ] Rust code: top-level `let`/`assert!` wrapped in `fn main()`
- [ ] Mermaid diagrams: use `×` not `*` for multiplication (Mermaid treats `*` as special)
- [ ] Production Proof: links precise to line numbers (`#L42-L80`), never `#L1`
- [ ] More Production Uses: use bullet list with verified URLs, not comma-separated text
- [ ] Chinese translation: section titles in Chinese (`## 更多生产案例` not `## More Production Uses`)
- [ ] Sidebar: updated in BOTH English and Chinese sections of `config.ts`
- [ ] README: updated in BOTH `README.md` and `README.zh-CN.md`

### 9. Submit PR

- [ ] Use Conventional Commit: `feat: add <pattern-name> pattern`
- [ ] Fill in the PR template checklist
- [ ] Ensure CI is green
