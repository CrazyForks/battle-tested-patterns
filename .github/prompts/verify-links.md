# Prompt: Verify Source Links

Use this prompt when asking an AI to help verify production proof links.

---

You are verifying source code links in the battle-tested-patterns project.

## Task

For each URL in the Production Proof table of **[PATTERN_FILE]**:

1. Check if the URL follows the correct format: `https://github.com/{org}/{repo}/blob/{branch}/{path}#L{start}-L{end}`
2. Verify the URL targets `main` or `master` branch (not a feature branch)
3. Verify the URL includes line numbers
4. Check if the linked code actually demonstrates the pattern as described

## Format Issues to Report

- Missing line numbers in URL
- URL points to a directory instead of a file
- URL targets a non-default branch
- Description doesn't match what the code actually does

## Output

For each link, report:
- ✅ Valid — link format correct, branch correct, line numbers present
- ⚠️ Warning — [describe the issue]
- ❌ Invalid — [describe the problem]
