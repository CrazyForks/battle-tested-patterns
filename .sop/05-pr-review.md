# SOP 05: PR Review Process

## Trigger

When reviewing a pull request that adds or modifies patterns, exercises, or documentation.

## Review Dimensions

### 1. Content Accuracy

- [ ] Production Proof links are valid (click each one)
- [ ] Links are precise to line numbers (not `#L1`)
- [ ] Code descriptions match what the linked source actually does
- [ ] No fabricated claims about project usage

### 2. Template Compliance

- [ ] All required sections present (One Liner → Core Idea → Production Proof → Implementation → Exercises → When to Use → When NOT to Use → More Production Uses → Related Patterns → Challenge Questions)
- [ ] One Liner ≤ 30 English words
- [ ] Core Idea includes a diagram + property table
- [ ] Production Proof has ≥ 2 projects with line-precise links
- [ ] More Production Uses has ≥ 3 entries with verified URLs

### 3. Multi-Language

- [ ] TypeScript implementation present (required)
- [ ] ≥ 1 other language (Rust / Go / Python / C)
- [ ] Each implementation is idiomatic (not mechanical translation)
- [ ] Code uses `::: code-group` format in the document

### 4. Exercises

- [ ] Exercise files in all 4 languages (TS, Rust, Go, Python)
- [ ] Answer files in `exercises/answers/` for all 4 languages
- [ ] Tests pass: `pnpm test` · `cargo test` · `go test ./...` · `pytest`
- [ ] TODO-stub format with separator line

### 5. Navigation & Sync

- [ ] Sidebar updated in `config.ts` (both English and Chinese)
- [ ] Homepage pattern table updated (`docs/index.md` + `docs/zh/index.md`)
- [ ] README pattern table updated (`README.md` + `README.zh-CN.md`)
- [ ] Chinese translation exists (`docs/zh/patterns/<name>/index.md`)
- [ ] By-project pages updated if new source project

### 6. Challenge Questions

- [ ] 3-4 scenario-based Q&A with `::: details` syntax
- [ ] Answers factually verified (version numbers, architecture claims)
- [ ] No unescaped `|` in tables, no `*` for multiplication (use `×`)

### 7. Related Patterns

- [ ] ≥ 2 related patterns with meaningful relationship descriptions
- [ ] Bidirectional: if A lists B, then B lists A (both EN and ZH)

### 8. CI Status

- [ ] All CI checks pass (CI, Content Quality, Verify Links, Deploy)
