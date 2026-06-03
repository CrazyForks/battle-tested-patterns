# SOP 01: Adding a New Pattern

## Trigger

When proposing or implementing a new programming pattern for the project.

## Prerequisites

- The pattern is used in ≥ 2 different production projects (verifiable via source code)
- The pattern is cross-language (not specific to one language or framework)
- The pattern is a code-level technique (not purely architectural)
- **Open an Issue first** ([new-pattern template](https://github.com/Totoro-jam/battle-tested-patterns/issues/new?template=new-pattern.md)) to discuss before starting work

## Complete File Checklist

Adding a new pattern (e.g. `bloom-filter`) requires creating and modifying these files:

**Create:**

```text
docs/patterns/bloom-filter/index.md          # English pattern document
docs/zh/patterns/bloom-filter/index.md       # Chinese translation
exercises/typescript/bloom-filter/01-basic.test.ts   # Basic exercise (required)
exercises/typescript/bloom-filter/02-intermediate.test.ts  # Intermediate exercise (required)
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
## One Liner          — ≤ 30 English words, capture WHY not just WHAT
## Core Idea          — concept + diagram (Mermaid, ASCII, or table — whichever fits best)
## Production Proof   — table with ≥ 2 projects, precise GitHub URLs to line numbers
                        Description must be specific enough to learn WITHOUT clicking
## Implementation     — TypeScript (required) + ≥ 1 other (Rust / Go / Python / C)
## Exercises          — table linking to exercise files (basic + intermediate)
## When to Use        — ≥ 3 concrete scenarios
## When NOT to Use    — ≥ 2 concrete alternatives
## More Production Uses — bullet list with repo links
## Challenge Questions — 3-4 scenario-based Q&A using ::: details syntax
```

### 4. Write Multi-Language Implementations

Include implementations in the `:::code-group` block:

- [ ] TypeScript (required)
- [ ] At least one of: Rust / Go / Python / C
- [ ] Each implementation is idiomatic to its language (follow SOP 03)
- [ ] Verify all code blocks compile: `pnpm verify-code`

### 5. Design Exercises

Create files in `exercises/typescript/<pattern-name>/`:

- [ ] `01-basic.test.ts` — basic mechanics of the pattern (required)
- [ ] `02-intermediate.test.ts` — real-world application scenario (required)
- [ ] Use the TODO-stub format: functions with `// TODO: implement` comments containing the working solution (so CI passes), with a `// ─── Tests (do not modify) ───` separator
- [ ] Learners are expected to delete the implementations and rewrite them to pass the tests
- [ ] Each exercise: 4-5 meaningful test cases covering edge cases
- [ ] Verify all tests pass locally: `pnpm test`
- [ ] Verify TypeScript strict mode: `pnpm typecheck`

### 5b. Write Challenge Questions

Add `## Challenge Questions` section at the end of the pattern doc:

- [ ] 3-4 scenario-based questions using VitePress `::: details` syntax
- [ ] Questions test UNDERSTANDING through real-world scenarios, not memorization
- [ ] Answers must be factually correct — verify claims about specific technologies
- [ ] Escape `|` characters in markdown tables (use `\|` or rephrase)
- [ ] Escape `*` in math expressions (use `×` instead)
- [ ] Copy the same section to the ZH doc with header `## 挑战题` (content stays in English)

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
- [ ] Update `docs/by-project/*.md` — add pattern to ALL relevant project pages (React, Linux, Go, etc.) and `more-projects.md`
- [ ] Update `docs/zh/by-project/*.md` — sync Chinese versions
- [ ] Update `README.md` cheat sheet table — add to correct category (Data Structures / Concurrency / Systems / Memory / Behavioral)
- [ ] Update `README.zh-CN.md` cheat sheet table — sync Chinese version
- [ ] Update `docs/guide/pattern-connections.md` — if pattern fits an existing system case study (React/Redis/Go/Linux/PostgreSQL/Kafka), add it to the relevant section and summary table
- [ ] Update `docs/zh/guide/pattern-connections.md` — sync Chinese version

### 8. Self-Review

- [ ] Run `pnpm test` — all tests pass
- [ ] Run `pnpm verify-code` — all code blocks compile (TS/Python/Rust/Go)
- [ ] Run `pnpm lint` — no markdown lint errors
- [ ] Run `pnpm build` — docs site builds
- [ ] Run `pnpm verify-links` — source links alive

### Common Mistakes Checklist

- [ ] Go code: no `:=` at package level (must be inside `func`)
- [ ] Go code: do NOT add `import` blocks — verify-code auto-detects and adds imports
- [ ] Python code: do NOT use `match` statement (3.10+) — use `if/elif` chains instead
- [ ] Rust code: do NOT use external crates (`sha2`, `serde`, etc.) — only `std` library
- [ ] TypeScript code: do NOT import Node.js built-in modules (`crypto`, `fs`, `path`) — use pure JS
- [ ] Go code: all called functions exist (add stubs like `func process(s string) {}`)
- [ ] Rust code: top-level `let`/`assert!` wrapped in `fn main()`
- [ ] Mermaid diagrams: use `×` not `*` for multiplication (Mermaid treats `*` as special)
- [ ] Production Proof: links precise to line numbers (`#L42-L80`), never `#L1`
- [ ] More Production Uses: use bullet list with verified URLs, not comma-separated text
- [ ] Chinese translation: section titles in Chinese (`## 更多生产案例` not `## More Production Uses`)
- [ ] ASCII diagrams: strictly monospaced-aligned, verify in a monospace font
- [ ] ASCII in ZH docs: use ENGLISH labels inside box-drawing diagrams (CJK causes misalignment); only translate text OUTSIDE diagrams
- [ ] ASCII box borders: │ must be vertically aligned on EVERY line of the same box
- [ ] Challenge questions: no unescaped `|` in table cells, no `*` for multiplication (use `×`)
- [ ] Challenge answers: factually verified — don't claim Go is cooperative-only (async preemption since 1.14)
- [ ] Sidebar: updated in BOTH English and Chinese sections of `config.ts`
- [ ] README: updated in BOTH `README.md` and `README.zh-CN.md`
- [ ] README cheat sheet: add to the categorized table in README
- [ ] by-project pages: update `docs/by-project/more-projects.md` and ZH version
- [ ] How Patterns Connect: update if the pattern relates to an existing system case study

### 9. Submit PR

- [ ] Use Conventional Commit: `feat: add <pattern-name> pattern`
- [ ] Fill in the PR template checklist
- [ ] Ensure CI is green

### 10. Site Accessibility Verification

After pushing, verify all pages are reachable:

- [ ] Run `pnpm build` — confirm new pattern pages appear in `docs/.vitepress/dist/`
- [ ] Verify EN page exists: `ls docs/.vitepress/dist/patterns/<name>/index.html`
- [ ] Verify ZH page exists: `ls docs/.vitepress/dist/zh/patterns/<name>/index.html`
- [ ] After deploy completes, spot-check live URLs:
  - `https://totoro-jam.github.io/battle-tested-patterns/patterns/<name>/`
  - `https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/<name>/`
- [ ] Check sidebar links navigate correctly in both languages

### 11. Pre-Tag Full Audit

Before tagging a release, run a comprehensive multi-dimensional audit:

- [ ] **Tests**: `pnpm test` — all exercises pass
- [ ] **TypeScript**: `pnpm typecheck` — strict mode clean
- [ ] **Code blocks**: `pnpm verify-code` — all 4 languages compile
- [ ] **Lint**: `pnpm lint` — markdown clean
- [ ] **Build**: `pnpm build` — VitePress builds, all pages in dist/
- [ ] **ASCII alignment**: spot-check new pattern diagrams in monospace font
- [ ] **ZH sync**: all new patterns have ZH docs with Chinese challenge questions
- [ ] **by-project**: new patterns added to ALL relevant project pages (EN+ZH)
- [ ] **pattern-connections**: summary table updated if pattern fits a system case study (EN+ZH)
- [ ] **Homepage/README**: pattern tables and cheat sheet updated (EN+ZH)
- [ ] **Source links**: `pnpm verify-links` or manual curl check on new links
- [ ] **CI**: all workflows green on latest commit

### 12. Tag Release

After audit passes:

- [ ] Tag with semantic version: `git tag -a v1.X.0 -m "vX.X.0: add N new patterns"`
- [ ] Push tag: `git push origin v1.X.0`
- [ ] Verify Release workflow creates GitHub Release
- [ ] Minor version bump for new patterns (feat:), patch for fixes (fix:)
