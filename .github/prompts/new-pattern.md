# Prompt: Create a New Pattern

Use this prompt when asking an AI to help write a new pattern document.

---

You are writing a pattern document for the battle-tested-patterns project.

## Task

Create a complete pattern document for **[PATTERN_NAME]** following this exact structure:

1. `# Pattern: [Name]`
2. `## One Liner` — describe the pattern in ≤ 30 English words
3. `## Core Idea` — explain the concept with an ASCII diagram
4. `## Production Proof` — table with ≥ 2 projects, each with a precise GitHub URL to line numbers
5. `## Implementation` — provide TypeScript and at least one of: Rust, Go, C
6. `## Exercises` — describe 3 levels: basic, intermediate, advanced
7. `## When to Use` — list applicable scenarios
8. `## When NOT to Use` — list limitations and alternatives

## Rules

- Source links MUST be real, verified URLs pointing to specific lines in source code
- Use `main` or `master` branch links, not feature branches
- If you cannot find a real source link, write `<!-- TODO: verify source link -->` instead
- Code must be complete and runnable (not pseudocode)
- Multi-language implementations must be idiomatic to each language
- One Liner must be ≤ 30 English words

## Output

Return the complete markdown document ready to save as `docs/patterns/[pattern-name].md`.
