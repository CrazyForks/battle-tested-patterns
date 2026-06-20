# SOP 04: Exercise Design Standards

## Trigger

When creating runnable exercises for a pattern.

## Design Principles

1. **TODO-stub format** — functions have working implementations with `// TODO` markers; learners delete and rewrite
2. **Test-driven** — tests verify the functions; tests are immutable
3. **Self-contained** — each exercise file can run independently
4. **Progressive difficulty** — basic (01-) → intermediate (02-) → advanced (03-)

## File Structure

```text
exercises/typescript/<pattern-name>/
├── 01-basic.test.ts         # Required: core concept
└── 02-<scenario>.test.ts    # Optional: realistic application

exercises/rust/src/<pattern_name>/mod.rs            # impl + #[cfg(test)] in same file
exercises/go/<pattern_name>/<pattern_name>_test.go  # impl + Test functions in same file
exercises/python/<pattern_name>/test_<pattern_name>.py # impl + pytest functions in same file
```

Minimum: **≥ 1 exercise file** per pattern per language.

## Exercise File Format

```typescript
import { describe, it, expect } from 'vitest';

/**
 * <Pattern> - <Level>: <Title>
 *
 * TODO: Implement the functions below.
 * Run `pnpm test:ts` to check your work.
 */

/** Description of what this function should do */
function myFunction(input: number): number {
  return input * 2; // TODO: implement (hint: ...)
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('<Pattern> - <Level>: <Title>', () => {
  it('should <expected behavior>', () => {
    expect(myFunction(5)).toBe(10);
  });
});
```

Key rules:
- Functions above the separator contain working solutions (so CI passes)
- `// TODO` comments mark lines the learner should rewrite
- Tests below the separator are immutable
- Learners delete function bodies and implement from scratch

## Python Exercise Format

```python
"""Pattern Name — short description."""

class MyClass:
    def my_method(self):  # TODO: implement
        ...working implementation...

# ─── Tests (do not modify below this line) ───

def test_basic_behavior():
    assert MyClass().my_method() == expected
```

Key rules (Python-specific):
- `# TODO: implement` on method signature lines, not body lines
- Use pytest assertions (no unittest classes)
- Each file is self-contained — no cross-file imports

## Answer Files

Reference implementations live in `exercises/answers/<language>/`:
- Pure implementation code, no tests
- Extracted from `docs/patterns/<name>/index.md` Implementation section
- One file per pattern per language (4 languages)

## Cross-Language Consistency

When a pattern has exercises in multiple languages, ensure API consistency:

- **Method names**: use idiomatic naming per language (camelCase in TS, snake_case in Python/Rust, PascalCase in Go) but expose equivalent operations
- **API surface**: if TS has `subscribe` and `unsubscribe`, all other languages should too
- **Test coverage**: if TS tests `can()` transitions, Go/Rust/Python should have equivalent tests
- **TODO markers**: all languages use `// TODO: implement` (or `# TODO: implement` for Python) on method signatures

## Checklist

- [ ] ≥ 1 exercise file per pattern per language
- [ ] All tests pass: `pnpm test` (runs docs + all 4 exercise languages)
- [ ] TODO-stub format with separator line
- [ ] TODO markers on method signatures, not body lines
- [ ] Test descriptions clearly state expected behavior
- [ ] Answer files exist in `exercises/answers/` for all 4 languages
- [ ] Cross-language API consistency verified (subscribe/unsubscribe, can(), etc.)
- [ ] Go files have `// TODO: implement` on all implementation function signatures
