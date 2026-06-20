## What does this PR do?

<!-- Brief description of the changes -->

## Type of change

- [ ] `feat` — New pattern or language implementation
- [ ] `fix` — Fix incorrect content or broken link
- [ ] `docs` — Documentation improvement
- [ ] `ci` — Workflow change
- [ ] `chore` — Tooling, config, dependencies
- [ ] `test` — Exercise/test changes

## Quality Checklist

### Content Completeness
- [ ] All required sections present (One Liner / Core Idea / Production Proof / Implementation / Exercises / When to Use / When NOT to Use / More Production Uses / Related Patterns / Challenge Questions)
- [ ] One Liner ≤ 30 English words
- [ ] Core Idea has visual diagram + property table

### Production Proof
- [ ] ≥ 2 different projects with source links
- [ ] Links precise to line numbers (`#L18-L22`)
- [ ] Links verified HTTP 200 (`pnpm verify-links`)
- [ ] Links point to `main`/`master` branch

### Multi-Language
- [ ] TypeScript implementation present (required)
- [ ] ≥ 1 other language (Rust / Go / Python / C)
- [ ] Each implementation is idiomatic to its language
- [ ] Code blocks compile (`pnpm verify-code`)
- [ ] Mermaid diagrams valid (`pnpm verify-mermaid`)

### Exercises
- [ ] Exercise files in all 4 languages (TS, Rust, Go, Python)
- [ ] Answer files in `exercises/answers/` for all 4 languages
- [ ] Tests pass (`pnpm test` — runs docs + all 4 exercise languages)

### Related Patterns & Challenge Questions
- [ ] ≥ 2 related patterns with bidirectional links (EN + ZH)
- [ ] 3-4 scenario-based challenge questions with verified answers

### i18n
- [ ] Chinese translation exists with identical code blocks
- [ ] ZH section titles in Chinese, code-group tab order matches EN

### Code Quality
- [ ] No lint errors (`pnpm lint`)
- [ ] TypeScript strict mode passes (`pnpm typecheck`)
- [ ] Content quality checks pass (`pnpm check:content`)
- [ ] CI green

## Notes for reviewers

<!-- Any additional context, trade-offs, or things to pay attention to -->
