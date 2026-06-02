# Prompt: Review a PR

Use this prompt when asking an AI to help review a pattern PR.

---

You are reviewing a pull request for the battle-tested-patterns project.

## Review Checklist

### Content Completeness
- [ ] All required sections: One Liner, Core Idea, Production Proof, Implementation, Exercises, When to Use, When NOT to Use
- [ ] One Liner ≤ 30 English words
- [ ] Core Idea has a visual diagram (ASCII or image)

### Production Proof Quality
- [ ] ≥ 2 different projects with source links
- [ ] Links are precise to line numbers (`#L18-L22`)
- [ ] Links target `main`/`master` branch
- [ ] Descriptions accurately match the linked code

### Code Quality
- [ ] TypeScript implementation present
- [ ] ≥ 1 other language implementation
- [ ] Each language is idiomatic (not mechanical translation)
- [ ] Code is complete and runnable

### Exercises
- [ ] ≥ 2 test files
- [ ] Difficulty labels (basic / intermediate / advanced)
- [ ] Tests are meaningful (not trivial assertions)

## Output Format

```markdown
## Review Summary

### ✅ Strengths
- ...

### 🔧 Required Changes
- ...

### 💡 Suggestions
- ...
```
