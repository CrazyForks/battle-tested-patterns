---
name: git-audit-before-commit
description: Always audit git status for unwanted files (pycache, build artifacts, etc.) BEFORE committing, not after
metadata:
  type: feedback
---

Audit `git status` and `git diff --cached` carefully before every commit. Catch unwanted files (__pycache__, .pytest_cache, node_modules, build artifacts, .pyc, .o, .so) BEFORE they enter the commit — don't commit first and clean up later.

**Why:** User was frustrated that __pycache__ was committed and had to be removed in a follow-up commit. Prevention > remediation. The follow-up commit is noise in git history.

**How to apply:** Before every `git add` + `git commit`:
1. Run `git status` and scan for files that shouldn't be tracked
2. Verify `.gitignore` covers common artifacts for the languages in use
3. Use specific file paths in `git add` instead of `git add .` or `git add -A`
4. If new language/tooling is added, update `.gitignore` FIRST before running tests
