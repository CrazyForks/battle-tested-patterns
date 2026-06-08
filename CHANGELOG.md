# Changelog

All notable changes to this project will be documented in this file.

See [commit history](https://github.com/Totoro-jam/battle-tested-patterns/commits/main) for detailed changes.

## Unreleased

[compare changes](https://github.com/Totoro-jam/battle-tested-patterns/compare/v1.9.0...main)

### Fixes

- Correct stale test counts across READMEs and exercise guides (TS 553→491, Go 173→176)
- Add retry logic to verify-source-links for transient 5xx errors (avoids false-positive issues)

### CI

- Extract release notes from CHANGELOG.md instead of changelogen (fixes empty release notes)

### Chores

- Remove unused `changelogen` dependency and `changelog` script
- Sync package.json version from 1.5.0 to 1.9.0
- Add package.json version bump step to SOP 08 release process

### Documentation

- Update SOPs 01/05/08 to match current 4-language exercise and release workflow
- Add missing commands to CLAUDE.md (verify-code, Rust, Go)
- Update CONTRIBUTING guides with 4-language exercise requirement and full command set
- Update Contributing quality bar in READMEs (EN+ZH) to match current standards
- Update PR template with complete quality checklist (exercises, i18n, related patterns)
- Update issue templates for 4-language standard (Python replaces C, add Rust/Go/Python env fields)

## v1.9.0

[compare changes](https://github.com/Totoro-jam/battle-tested-patterns/compare/v1.8.0...v1.9.0)

### Features

- Add Go implementation for diff-patch pattern
- Add Rust implementation for batch-processing pattern
- Add complexity cheat sheet and pattern comparison pages (EN+ZH)
- Add difficulty labels, learning paths, study plan, and real-world analogies
- Replace ASCII composition diagrams with interactive CompositionFlow Vue component
- Add DecisionTree interactive component for guide pages
- Add VizLog universal log panel with visual design upgrade to all 48 Viz components
- Add 3rd preset scenario + highlight logs to BPlusTree, MinHeap, SkipList
- Revamp homepage with value-focused tagline, live Viz demo, and PatternTimelineViz
- Add JSON-LD structured data for search engine rich results (WebSite, BreadcrumbList, TechArticle)
- Add dedicated skeleton loading for homepage MinHeap and Timeline components
- Add CJK word segmentation for VitePress local search using `Intl.Segmenter`

### Fixes

- Fix broken Erlang/BEAM VM source link (file moved to `emu/` subdirectory)
- Sync 23 missing When to Use / When NOT to Use entries in ZH patterns
- Restore missing arrow in ZH flyweight mermaid diagram
- Add property tables to 14 patterns + fix ZH diagram structural issues
- Remove technical terms from Real-World Analogy sections
- Add source links to 29 More Production Uses entries across 15 patterns
- Replace 3 imprecise Production Proof links with correct line numbers
- Correct pattern-connections matrix (remove 2 false positives, add 2 missing)
- Standardize em dashes in One Liner sections
- Add 37 missing bidirectional Related Patterns back-links (EN+ZH)
- Add precise line numbers to production proof links (EN+ZH)
- Correct 8 factual errors in challenge question answers (EN+ZH)
- Comprehensive quality audit: sync ZH code, fix implementations, improve SEO
- Address multi-role exercise audit findings
- Align Rust/Go exercises with TS/Python API coverage
- Add focus-visible styles and dark mode color overrides to viz CSS
- Replace `*` with `×` for multiplication in challenge answers and state-machine
- Normalize `--` to em dash (—) in prose text across EN+ZH patterns
- Add 11 missing patterns to pattern-connections page (EN+ZH)
- Add ARIA attributes to all 49 Viz components
- Add keyboard support to interactive non-button elements
- Add missing `isAborted()` checks after delay in preset scenarios
- Translate hardcoded English strings in VizLog and VizSkeleton
- Add mobile responsive styles for viz components on small screens

### Internationalization

- Translate "Exercise files:" to "练习文件：" across all 46 ZH pattern pages
- Translate "Production Proof" to "生产验证" in ZH interview guide
- Sync ZH code block text with EN in interning and visitor patterns
- Sync ZH/EN sidebar titles with page titles across 10 patterns
- Replace "Interview Guide" hero button with "Learning Paths" (EN+ZH)
- Add Chinese translations for VitePress UI elements
- Add 404 page and footer translations for both locales
- Add outline level [2,3] to ZH config to show h3 in page navigation
- Rename 归并迭代器 → 合并迭代器 in merge-iterator pattern page
- Translate all English pattern names to Chinese in use-cases.md

### SEO

- Add x-default hreflang for international search engines
- Add theme-color meta tag for mobile browser chrome

### Documentation

- Add 5 pattern comparison pairs: Backpressure vs Rate Limiter, Tombstone vs Dirty Flag, Interning vs Flyweight, Event Loop vs Work Stealing, Visitor vs Middleware Chain (EN+ZH)
- Add B+ Tree and Registry to more-projects by-project page (EN+ZH)
- Correct Go test count from ~170 to 173 in README
- Add SOP 12 (Related Patterns bidirectionality), SOP 13 (content quality audit)
- Add missing patterns to learning paths (Registry, Visitor, Vtable)
- Update stale test counts and sync STUDY_PLAN with learning paths
- Add game frame composition diagram to game-engines by-project page (EN+ZH)
- Add composition diagrams to ZH by-project pages
- Add exercise getting-started guide (EN+ZH)
- Add Rust/Go/Python exercise file paths to all 92 pattern docs
- Update READMEs with 4-language exercise stats and guide links
- Add learning guides row to README pattern tables (EN+ZH)
- Reorganize guide sidebar into 4 logical groups (EN+ZH)

### CI

- Add EN-ZH code parity check to content-quality workflow
- Expand exercise file check from TypeScript-only to all 4 languages (Rust/Go/Python)
- Use requirements.txt for pytest version in Python CI test step
- Increase Rust verify-code timeout to 30s for CI runner stability
- Upgrade GitHub Actions: setup-node v6, setup-python v6, deploy-pages v5, github-script v9
- Add cargo, gomod, pip ecosystems to dependabot config
- Bump pytest requirement to >=9.0.3

## v1.8.0

[compare changes](https://github.com/Totoro-jam/battle-tested-patterns/compare/v1.7.0...v1.8.0)

### Fixes

- Resolve broken source links flagged by CI (#11)

### Documentation

- Add narrative composition walkthroughs to React and Linux by-project pages
- Add goroutine scheduling composition walkthrough to Go page
- Add distributed write composition walkthrough
- Add git commit composition walkthrough
- Address multi-agent audit findings across exercises, CI, and docs

## v1.7.0

[compare changes](https://github.com/Totoro-jam/battle-tested-patterns/compare/v1.6.0...v1.7.0)

### Features

- Add Go and Rust exercises for final 8 patterns (batch 6) — full 4-language exercise coverage
- Add Go and Rust exercises for 8 more patterns (batch 5)
- Add Go and Rust exercises for 8 more patterns (batch 4)

## v1.6.0

[compare changes](https://github.com/Totoro-jam/battle-tested-patterns/compare/v1.5.1...v1.6.0)

### Features

- Add Go and Rust exercises for 20 patterns (batches 1-3) — first multi-language exercise expansion
- Add `DemoBadge` component for interactive demo discovery on all 92 pattern pages
- Add skeleton screen loading state for lazy-loaded viz components

### Fixes

- Replace eager Go `Filter` with lazy `iter.Seq` in iterator pattern (Go 1.23)
- Upgrade Go to 1.23 for `iter.Seq` support in CI and verify script
- Unify iterator pattern diagram with interactive component
- Align ZH LSM tree ASCII diagram box-top widths
- Correct 11 viz component bugs from comprehensive audit
- Adjust homepage feature icon size to 100×100

### Documentation

- Add recommended learning paths to getting-started guide (EN+ZH)
- Add pattern timeline entry to homepage pattern table area
- Add SOP 10 for interactive viz component audit checklist

## v1.5.1

[compare changes](https://github.com/Totoro-jam/battle-tested-patterns/compare/v1.5.0...v1.5.1)

### Features

- Add composition chains and expand cross-system pattern table in pattern-connections guide (React Reconciler, PostgreSQL, Kafka Broker, Go Runtime)

### Fixes

- Add Skip List coverage to use-cases guide and correct interview pattern mappings (cycle detection, read-write lock)
- Crop homepage feature icon whitespace and increase display size to 120×120

### Documentation

- Write proper CHANGELOG entries for v1.5.0

## v1.5.0

[compare changes](https://github.com/Totoro-jam/battle-tested-patterns/compare/v1.4.0...v1.5.0)

### Features

- Add 46 interactive SVG visualizations — 100% pattern coverage (Ring Buffer, LRU Cache, Bloom Filter, Min Heap, Skip List, Trie, State Machine, Circuit Breaker, Consistent Hashing, Event Loop, Rate Limiter, Merkle Tree, B+ Tree, Dependency Graph, Observer, Backpressure, Copy-on-Write, and more)
- Upgrade all 46 viz components with `useVizTimers` composable, scenario presets, and speed controls
- Add i18n composable with full bilingual support for all 46 visualizations
- Replace stacked mermaid charts with interactive components
- Add Pattern Timeline page — 80 years of computing history (EN+ZH)
- Add Cheat Sheet, Use Cases, Interview Guide pages (EN+ZH)
- Add homepage PNG icons for feature cards
- Add sitemap.xml generation and robots.txt for SEO
- Add description frontmatter to all 92 pattern pages and guide pages

### Fixes

- Add `onUnmounted` cleanup to all viz components with timers
- Move viz-status hints to top of visualization area
- Align LSM tree and Interning ASCII diagram box widths
- Add missing abort guards to animation loops
- Fix CJK double-width character alignment in Chinese README
- Add precise line numbers to gRPC-Go middleware-chain source link
- Fix mermaid timeline chart type causing global render errors

### Documentation

- Add SOP 09 for Vue component build pitfalls
- Add Related Patterns cross-references to all 92 pattern pages
- Add 4th challenge question to 7 patterns (EN+ZH)
- Complete timeline with 15 missing patterns, enrich by-project pages
- Update README pattern count, exercise counts, and test case counts
- Add missing intro paragraphs and Further Reading to ZH by-project pages
- Sync missing code blocks from EN to 14 ZH pattern pages

### Performance

- Lazy-load all 46 visualizer components via `defineAsyncComponent`
- Increase Node.js heap size for 46-component VitePress build
- Skip SSR for interactive visualizer components

## v1.4.0

[compare changes](https://github.com/Totoro-jam/battle-tested-patterns/compare/v1.3.0...v1.4.0)

### Features

- Add 4 new patterns: Tagged Union, Interning, Vtable, Visitor (Batch 3)
- Add final 4 patterns: Merkle Tree, Merge Iterator, LSM Tree, Checkpointing (Batch 4) — total reaches **46 patterns**
- Upgrade GitHub Actions to latest major versions

### Fixes

- Merkle Tree: remove external deps (crypto/sha2 → FNV hash, fully self-contained)
- Fix 10 ASCII alignment issues + ZH challenge translations
- Replace `x` with checkmark in pattern-connections summary table (EN+ZH)

### Documentation

- Add Batch 2 patterns to homepage and README cheat sheet (EN+ZH)
- Update all navigation for 46 patterns + fix lint
- SOP updates: pre-tag full audit, pattern-connections sync, by-project sync, accessibility verification

## v1.3.0

[compare changes](https://github.com/Totoro-jam/battle-tested-patterns/compare/v1.2.0...v1.3.0)

### Features

- Add 4 new patterns: Reference Counting, Logical Clock, Event Loop, Middleware Chain
- Add 4 new patterns: B+ Tree, Tombstone, Registry, Dirty Flag (Batch 2)
- Definitive OG social preview image — 35+ real project icons across full canvas
- Add Open Graph and Twitter Card meta tags for SEO

### Fixes

- OG image iteration: SVG → AI-generated PNG → compressed (643KB), correct dimensions (1200×630)
- Strict typecheck errors in free-list and WAL exercises
- Sync PostgreSQL visibility map fix to ZH pattern-connections
- ASCII alignment fixes: work-stealing STEAL box, skip-list level connectors

### Documentation

- Add 30-pattern cheat sheet to README + improve CONTRIBUTING
- Translate pattern-connections to Chinese (6 system case studies)
- Add 4 new patterns to sidebar and homepage tables (EN+ZH)
- Polish homepage, README, exercise tables
- SOP updates: tag release step, OG metadata iteration

## v1.2.0

[compare changes](https://github.com/Totoro-jam/battle-tested-patterns/compare/v1.1.1...v1.2.0)

### Features

- Exercises depth expansion: additional test scenarios for existing patterns
- ZH challenge question translations for all 30 patterns
- System case studies: cross-pattern composition walkthroughs

## v1.1.1

[compare changes](https://github.com/Totoro-jam/battle-tested-patterns/compare/v1.1.0...v1.1.1)

### Fixes

- Correct 6 factual errors in challenge questions across patterns

## v1.1.0

[compare changes](https://github.com/Totoro-jam/battle-tested-patterns/compare/v1.0.1...v1.1.0)

### Features

- Add challenge questions (3-4 scenario-based Q&A) to all 30 patterns
- Add 10 intermediate exercises with real-world scenarios

## v1.0.1

[compare changes](https://github.com/Totoro-jam/battle-tested-patterns/compare/v1.0.0...v1.0.1)

### Fixes

- Escape pipe character in bitmask Production Proof table

## v1.0.0

**First stable release** — 30 production-proven patterns with bilingual documentation.

### Highlights

- 30 patterns across 5 categories: Bit Manipulation, Scheduling & Concurrency, Data Structures, Resilience, and Memory Management
- Full bilingual support (English + 简体中文) with VitePress i18n
- TypeScript + Python exercises with Vitest and pytest
- Every pattern includes: One Liner, Core Idea with ASCII diagram, Production Proof with precise GitHub source links, multi-language implementations (TypeScript + Rust/Go/Python/C), exercises, When to Use / When NOT to Use, and Related Patterns
- All production proof links verified (277 unique GitHub URLs)
- GitHub Pages deployment with CI/CD

## v0.3.0

[compare changes](https://github.com/Totoro-jam/battle-tested-patterns/compare/v0.2.1...v0.3.0)

### Features

- Add Python exercises for all patterns (232 tests) + answer files for all 4 languages

### Chores

- Add `__pycache__` and `.pytest_cache` to `.gitignore`

## v0.2.1

[compare changes](https://github.com/Totoro-jam/battle-tested-patterns/compare/v0.2.0...v0.2.1)

See [commit history](https://github.com/Totoro-jam/battle-tested-patterns/commits/v0.2.1) for changes.

## v0.2.0

[compare changes](https://github.com/Totoro-jam/battle-tested-patterns/compare/v0.1.0...v0.2.0)

See [commit history](https://github.com/Totoro-jam/battle-tested-patterns/commits/v0.2.0) for changes.

## v0.1.0

**Initial release** — project scaffolding and first patterns.
