---
name: verify-source
description: Verify all production proof source links in pattern documents. Run curl checks, report broken/invalid URLs, and suggest fixes.
---

# Verify Source Links

You are verifying production proof links in this repository. This is the most critical quality check — every pattern's credibility depends on accurate, live source links.

## Steps

### 1. Collect all links

Scan `docs/patterns/*.md` files for GitHub URLs in Production Proof tables. Extract every URL that matches `https://github.com/*/blob/*#L*`.

### 2. Validate format

For each link, check:
- Points to `main` or `master` branch (not a feature branch)
- Includes line numbers (`#L18` or `#L18-L22`)
- Is a file link (`/blob/`), not a directory link (`/tree/`)

Report any format violations.

### 3. Check HTTP status

Run `curl -sI <url> | head -1` for each link. Expected: `HTTP/2 200`.

### 4. Verify content accuracy

For links that are HTTP 200, open them and confirm:
- The code at the specified lines actually demonstrates the pattern described
- The usage description in the table is accurate

### 5. Report

Output a summary:
- ✅ Valid links (count)
- ⚠️ Format issues (list each)
- ❌ Broken links (list each with file location)

For broken links, suggest the fix per `.sop/06-broken-link-fix.md`.

## Rules

- Never fabricate a replacement URL — if you can't find the new location, leave a `<!-- TODO -->` marker
- Always verify with `curl` before claiming a link is valid
- Check the actual code content, not just HTTP status
