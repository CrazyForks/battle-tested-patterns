# SOP 03: Multi-Language Implementation Standards

## Trigger

When writing or reviewing pattern implementations in multiple languages.

## Core Principle

Each language implementation must be **idiomatic** — not a line-by-line translation.
The algorithm/pattern is the same; the expression should feel native to each language.

## Language-Specific Guidelines

### TypeScript

- Use strict mode (`strict: true` in tsconfig)
- Prefer `const` and immutable patterns where natural
- Use proper TypeScript types (no `any`)
- Use bitwise operators directly (no wrapper classes unless the pattern requires it)
- Export functions/classes for use in tests
- Follow standard TS naming: `camelCase` for functions, `PascalCase` for types

### Rust

- Use idiomatic Rust: ownership, borrowing, pattern matching
- Implement standard traits where applicable (`Display`, `Iterator`, `From`)
- Use `#[cfg(test)]` module for tests
- Prefer `enum` + `match` over boolean flags
- Use `Result<T, E>` for error handling (not panics in library code)
- Follow Rust naming: `snake_case` for functions, `PascalCase` for types

### Go

- Use standard library as much as possible
- Write table-driven tests
- Follow Go conventions: exported names `PascalCase`, internal `camelCase`
- Use interfaces for abstraction
- Keep it simple — Go favors explicit over clever
- Use `go vet` and `gofmt`

### C

- Use C11 or later
- Header + implementation file separation
- Use `static` for internal functions
- Document memory ownership in comments
- Avoid undefined behavior

## Verification Checklist

- [ ] Each implementation compiles and runs independently
- [ ] Tests pass in each language's native test framework
- [ ] Code reads naturally to a developer of that language
- [ ] No unnecessary abstraction copied from another language's idioms
