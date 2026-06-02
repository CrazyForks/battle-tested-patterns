# SOP 06: Fixing Broken Source Links

## Trigger

- Weekly `verify-links.yml` CI job reports a dead link
- A `broken-link` Issue is filed
- Manual discovery during content review

## Steps

### 1. Diagnose the Failure

```bash
curl -sI "<broken-url>" | head -5
```

Common causes:
- **404**: File was moved, renamed, or deleted
- **301/302**: Repository was renamed or transferred
- **Timeout**: Temporary network issue (re-verify before acting)

### 2. Locate the New URL

If the file was **moved or renamed**:
- Search the project repo: `https://github.com/{org}/{repo}/search?q=<function-or-variable-name>`
- Check `git log --follow` on the original path in a local clone
- Use GitHub's blame view to trace history

If the file was **deleted**:
- Check if the functionality moved to a different file
- Search for the key identifiers (function names, constants) in the repo

If the **repository was renamed**:
- GitHub usually redirects — update the URL to the new canonical form

### 3. Verify the New URL

```bash
curl -sI "<new-url>" | head -1
# Must return HTTP 200
```

- Open in browser and confirm the code still demonstrates the pattern
- Update the line numbers if the code shifted

### 4. Update the Pattern Document

- Edit the Production Proof table in `docs/patterns/<pattern>.md`
- Update both the URL and the usage description if the code changed
- If the code changed significantly, update the Implementation section too

### 5. Submit Fix

```bash
git commit -m "fix: update broken source link in <pattern>"
```

### 6. If No Replacement Found

- If the code was completely removed and no equivalent exists:
  - Find an alternative project that uses the same pattern
  - Ensure the pattern still has ≥ 2 valid production proofs
  - If only 1 proof remains, add `<!-- TODO: find additional production proof -->` as a reminder

## Prevention

- Prefer `main`/`master` branch links (more stable than tags)
- Consider using commit SHA permalinks for critical references
- The weekly CI job catches issues early — respond within 1 week
