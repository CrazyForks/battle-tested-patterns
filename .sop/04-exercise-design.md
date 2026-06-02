# SOP 04: Exercise Design Standards

## Trigger

When creating runnable exercises for a pattern.

## Design Principles

1. **Progressive difficulty** — basic → intermediate → advanced
2. **Test-driven** — every exercise is a test file with assertions
3. **Self-contained** — each exercise file can run independently
4. **Clear intent** — test names describe what the learner should implement

## Difficulty Levels

### Basic (01-*)
- Time: ~10 minutes
- Goal: Verify understanding of the core concept
- Example: "Implement basic flag operations using bitwise OR and AND"

### Intermediate (02-*)
- Time: ~30 minutes
- Goal: Apply the pattern to a realistic problem
- Example: "Build a permission system using bitmask"

### Advanced (03-*)
- Time: ~60 minutes
- Goal: Study and replicate the pattern as used in a real project
- Example: "Implement React-style fiber flags with side-effect tracking"

## File Structure

```
exercises/typescript/<pattern-name>/
├── 01-basic.test.ts
├── 02-<scenario>.test.ts
└── 03-<project-reference>.test.ts
```

## Exercise File Template

```typescript
import { describe, it, expect } from 'vitest';

describe('<Pattern> - <Level>: <Title>', () => {
  it('should <expected behavior>', () => {
    // Arrange
    // Act
    // Assert
    expect(result).toBe(expected);
  });
});
```

## Checklist

- [ ] ≥ 2 exercise files per pattern
- [ ] Each file has difficulty label in filename (01-, 02-, 03-)
- [ ] All tests pass with `pnpm test`
- [ ] Test descriptions clearly state what to implement
- [ ] No external dependencies beyond the test framework
- [ ] Exercises build on each other (basic concepts used in intermediate)
