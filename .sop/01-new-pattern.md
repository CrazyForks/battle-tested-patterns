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
docs/patterns/bloom-filter/index.md                        # English pattern document
docs/zh/patterns/bloom-filter/index.md                     # Chinese translation
exercises/typescript/bloom-filter/01-basic.test.ts          # TS exercise (required)
exercises/typescript/bloom-filter/02-intermediate.test.ts   # TS exercise (required)
exercises/rust/src/bloom_filter/mod.rs                      # Rust exercise (required)
exercises/go/bloom_filter/bloom_filter_test.go              # Go exercise (required)
exercises/python/bloom_filter/test_bloom_filter.py          # Python exercise (required)
exercises/answers/typescript/bloom-filter/bloom-filter.ts   # TS answer file
exercises/answers/rust/bloom_filter/bloom_filter.rs         # Rust answer file
exercises/answers/go/bloom_filter/bloom_filter.go           # Go answer file
exercises/answers/python/bloom_filter/bloom_filter.py       # Python answer file
```

**Modify:**

```text
docs/.vitepress/config.ts    # Add to BOTH English and Chinese sidebar
docs/patterns/index.md       # Add to English catalog table (+ update the "N patterns" count in the heading)
docs/zh/patterns/index.md    # Add to Chinese catalog table (+ update the count)
docs/.vitepress/theme/components/PatternTimelineViz.vue  # Add a TimelineEntry (drives the homepage "All N Patterns" timeline + total count)
README.md                    # Add to pattern table
README.zh-CN.md              # Add to pattern table
exercises/rust/src/main.rs   # Add `mod bloom_filter;`
```

> Note: `docs/index.md` / `docs/zh/index.md` are hero pages — they render
> patterns via `<PatternTimelineViz />`, NOT a hand-written table. The catalog
> tables live in `docs/patterns/index.md` (+ ZH mirror). `pnpm check:relations`
> (rule R3) verifies both catalog pages list every pattern.

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
---
description: "≤ 1 sentence"
difficulty: "beginner | intermediate | advanced"
---
# Pattern: [Name]

<DifficultyBadge />        ← badge line: directly below title (future: add more badges here)

## One Liner          — ≤ 30 English words, capture WHY not just WHAT

<DemoBadge />               ← interactive demo link: after One Liner text

## Real-World Analogy — one everyday metaphor (parking lot, fuse, dishwasher, etc.)
## Core Idea          — concept + diagram (Mermaid, ASCII, or table — whichever fits best)
                        MUST include a `| Property | Value |` table summarizing key
                        complexity characteristics (e.g. O(1) insert, O(n) scan) placed
                        AFTER the diagram and BEFORE the "Try it yourself" line
## Production Proof   — table with ≥ 2 projects, precise GitHub URLs to line numbers
                        Description must be specific enough to learn WITHOUT clicking
## Implementation     — TypeScript (required) + ≥ 1 other (Rust / Go / Python / C)
## Exercises          — table linking to exercise files (basic + intermediate)
## When to Use        — ≥ 3 concrete scenarios
## When NOT to Use    — ≥ 2 concrete alternatives
## More Production Uses — bullet list with repo links
## Related Patterns   — table linking to ≥ 2 related patterns with relationship description
## Challenge Questions — 3-4 scenario-based Q&A using ::: details syntax
```

#### Difficulty Classification

- **beginner**: single core mechanism, minimal prerequisites (bitmask, ring-buffer, observer, semaphore)
- **intermediate**: combines 2-3 concepts, requires some background (LRU cache, circuit-breaker, trie, bloom-filter)
- **advanced**: complex multi-component systems, strong prerequisites (MVCC, LSM tree, B+ tree, work-stealing)

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
- [ ] Verify all tests pass locally: `pnpm test:exercises` (runs TS/Rust/Go/Python; `pnpm test:ts` for TypeScript only)
- [ ] Verify TypeScript strict mode: `pnpm typecheck`

### 5b. Write Challenge Questions

Add `## Challenge Questions` section at the end of the pattern doc:

- [ ] 3-4 scenario-based questions using VitePress `::: details` syntax
- [ ] Questions test UNDERSTANDING through real-world scenarios, not memorization
- [ ] Answers must be factually correct — verify claims about specific technologies
- [ ] Escape `|` characters in markdown tables (use `\|` or rephrase)
- [ ] Escape `*` in math expressions (use `×` instead)
- [ ] Translate questions and answers to Chinese in the ZH doc with header `## 挑战题` (code snippets in answers stay in English)

### 6. Create Chinese Translation

- [ ] Create `docs/zh/patterns/<pattern-name>/index.md`
- [ ] Translate structural content (headings, explanations, When to Use)
- [ ] **Code blocks must be byte-identical to EN** — copy-paste from EN, never re-type or translate
- [ ] **Code-group tab order must match EN** — e.g. if EN is `[TypeScript] [Rust] [Go] [Python]`, ZH must be the same
- [ ] Production Proof table must have **identical rows** in both languages (same links, same project count)
- [ ] Info/warning callout blocks (`::: info`, `::: tip`) must exist in both languages
- [ ] Include `运行练习：\`pnpm test:ts\`` after the exercise table (matching EN's `Run exercises: \`pnpm test:ts\``)
- [ ] If you cannot translate, add `<!-- TODO: translate -->` markers

### 7. Update Navigation

- [ ] Add to `docs/.vitepress/config.ts` — both English and Chinese sidebar sections
- [ ] Add to `docs/index.md` homepage pattern table
- [ ] Add to `docs/zh/index.md` homepage pattern table
- [ ] Add to `README.md` pattern table
- [ ] Add to `README.zh-CN.md` pattern table
- [ ] Update `docs/by-project/*.md` — add pattern to ALL relevant project pages with clickable GitHub source links (not plain file names)
- [ ] Update `docs/zh/by-project/*.md` — sync Chinese versions
- [ ] Update `README.md` cheat sheet table — add to correct category (Data Structures / Concurrency / Systems / Memory / Behavioral)
- [ ] Update `README.zh-CN.md` cheat sheet table — sync Chinese version
- [ ] Update `docs/guide/pattern-connections.md` — if pattern fits an existing system case study (React/Redis/Go/Linux/PostgreSQL/Kafka), add it to the relevant section and summary table
- [ ] Update `docs/zh/guide/pattern-connections.md` — sync Chinese version

### 8. Self-Review

- [ ] Run `pnpm test` — all tests pass
- [ ] Run `pnpm verify-code` — all code blocks compile (TS/Python/Rust/Go)
- [ ] Run `pnpm verify-mermaid` — all Mermaid diagrams have valid syntax
- [ ] Run `pnpm lint` — markdown + ESLint + Stylelint clean (see [SOP 14](14-lint-toolchain.md))
- [ ] Run `pnpm check:content` — content quality checks pass (structure, parity, exercises, relations)
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
- [ ] Mermaid diagrams: do NOT use `timeline` chart type — it causes global render errors with vitepress-plugin-mermaid. Use ASCII text instead.
- [ ] Production Proof: links precise to line numbers (`#L42-L80`), never `#L1`
- [ ] More Production Uses: use bullet list with verified URLs, not comma-separated text
- [ ] Chinese translation: section titles in Chinese (`## 更多生产案例` not `## More Production Uses`)
- [ ] ASCII diagrams: strictly monospaced-aligned, verify in a monospace font
- [ ] ASCII in ZH docs: use ENGLISH labels inside box-drawing diagrams (CJK causes misalignment); only translate text OUTSIDE diagrams
- [ ] ASCII box borders: │ must be vertically aligned on EVERY line of the same box
- [ ] Challenge questions: no unescaped `|` in table cells, no `*` for multiplication (use `×`)
- [ ] Challenge answers: factually verified — don't claim Go is cooperative-only (async preemption since 1.14)
- [ ] Challenge answers: verify version-specific claims (e.g. goroutine stack is 2KB since Go 1.4, not "2-4KB")
- [ ] Challenge answers: verify architecture claims (e.g. x86 TSO means Release and Relaxed RMW compile identically)
- [ ] Challenge answers: don't conflate similar systems (Redis Cluster uses hash slots, NOT consistent hashing)
- [ ] Challenge answers: check for outdated claims (React 18 auto-batches; Redis 6.0 has I/O threads)
- [ ] Challenge answers: distinguish Go runtime concepts correctly (P = logical processor, M = OS thread)
- [ ] Related Patterns bidirectionality: if this pattern lists pattern X, verify that X's Related Patterns table also lists this pattern back (EN + ZH)
- [ ] Pattern connections matrix: if pattern is used in React/Redis/Go/Linux/PostgreSQL/Kafka, verify the checkmark exists AND that the Viz component data in `PatternConnectionsViz.vue` is consistent
- [ ] Sidebar: updated in BOTH English and Chinese sections of `config.ts`
- [ ] README: updated in BOTH `README.md` and `README.zh-CN.md`
- [ ] README cheat sheet: add to the categorized table in README
- [ ] by-project pages: update `docs/by-project/more-projects.md` and ZH version
- [ ] How Patterns Connect: update if the pattern relates to an existing system case study
- [ ] Markdown tables: every row must have the same column count as the header (MD056) — don't merge cells or leave columns empty
- [ ] Fenced code blocks: always specify a language (`text` for ASCII art, `typescript`/`python`/etc. for code) — MD040
- [ ] Guide pages: if adding a new guide, add to BOTH EN/ZH sidebar AND README "learning guides" row
- [ ] Implementation correctness: code must actually implement the stated data structure/algorithm (e.g. a skip list must use forward pointers and levels, not a sorted Vec with binary search)
- [ ] Real-World Analogy: use only non-technical vocabulary — no "hash", "thread", "mutex" etc. in the metaphor (save those for Core Idea)
- [ ] ZH code sync: if editing EN code blocks, immediately update the corresponding ZH file with identical code
- [ ] ZH tab order: code-group tabs must appear in the same language order as EN
- [ ] ZH structural parity: every Production Proof row, info callout, and warning box in EN must also appear in ZH
- [ ] Core Idea property table: every pattern must have a `| Property | Value |` table with key complexity characteristics after the diagram
- [ ] ZH property table: must use `| 属性 | 值 |` headers with translated descriptions but keeping O() notation unchanged

### 9. Submit PR

- [ ] Use Conventional Commit: `feat: add <pattern-name> pattern` (a whole new
      content unit is always `feat:` — see Commit Convention in CLAUDE.md)
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

- [ ] **Tests**: `pnpm test` — all tests pass (exercises + docs components)
- [ ] **TypeScript**: `pnpm typecheck` — strict mode clean
- [ ] **Code blocks**: `pnpm verify-code` — all 4 languages compile
- [ ] **Mermaid**: `pnpm verify-mermaid` — all diagrams valid syntax
- [ ] **Lint**: `pnpm lint` — markdown + ESLint + Stylelint clean
- [ ] **Build**: `pnpm build` — VitePress builds, all pages in dist/
- [ ] **ASCII alignment**: spot-check new pattern diagrams in monospace font
- [ ] **ZH sync**: all new patterns have ZH docs with Chinese challenge questions
- [ ] **ZH code parity**: all ZH code blocks are byte-identical to EN, tab order matches
- [ ] **ZH structural parity**: every Production Proof row, info/tip callout in EN also exists in ZH
- [ ] **Implementation correctness**: each code block actually implements the stated data structure (not a simpler stand-in)
- [ ] **Property tables**: every Core Idea section has a `| Property | Value |` table; ZH uses `| 属性 | 值 |`
- [ ] **Analogy quality**: Real-World Analogy sections use only non-technical vocabulary
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
