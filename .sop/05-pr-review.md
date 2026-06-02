# SOP 05: PR Review Process

## Trigger

When reviewing a pull request that adds or modifies patterns, exercises, or documentation.

## Review Dimensions

### 1. Content Accuracy

- [ ] Production Proof links are valid (click each one)
- [ ] Code descriptions match what the linked source code actually does
- [ ] No fabricated claims about project usage
- [ ] Technical explanations are correct

### 2. Template Compliance

- [ ] All required sections present (One Liner, Core Idea, Production Proof, Implementation, Exercises, When to Use, When NOT to Use)
- [ ] One Liner ≤ 30 English words
- [ ] Core Idea includes a visual diagram
- [ ] Production Proof has ≥ 2 projects with line-number-precise links

### 3. Code Quality

- [ ] TypeScript implementation present (required)
- [ ] ≥ 1 other language implementation
- [ ] Each language is idiomatic (not mechanical translation)
- [ ] Code compiles and runs
- [ ] No lint errors
- [ ] TypeScript strict mode passes

### 4. Exercises

- [ ] ≥ 2 test files with difficulty labels
- [ ] All tests pass
- [ ] Test descriptions are clear

### 5. CI Status

- [ ] All CI checks pass
- [ ] No new warnings introduced

## Review Response Template

```markdown
## Review Summary

### ✅ Strengths
- ...

### 🔧 Required Changes
- ...

### 💡 Suggestions (optional)
- ...

### Checklist
- [ ] Content accuracy verified
- [ ] Template compliance checked
- [ ] Code quality reviewed
- [ ] Exercises tested
- [ ] CI green
```
