# SOP 02: Verifying Source Code Links

## Trigger

- Before submitting a new pattern or updating Production Proof sections
- During weekly automated link verification (CI)
- When a broken-link Issue is opened

## Prerequisites

- `curl` available in the environment
- Network access to github.com

## Steps

### 1. Extract Links

Collect all GitHub URLs from the pattern document's Production Proof table.

### 2. Verify Each Link

For each URL:

```bash
curl -sI "https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberFlags.js#L18-L22" | head -1
```

Expected: `HTTP/2 200` or `HTTP/1.1 200`

### 3. Verify Content Accuracy

- Open the link in a browser
- Confirm the code at the specified lines matches what the pattern document describes
- Confirm the usage description in the Production Proof table is accurate

### 4. Check Branch Target

- [ ] Link targets `main` or `master` branch (not a feature branch)
- [ ] If using a commit SHA permalink, verify the commit is on the default branch

### 5. Link Format Validation

Valid format:
```
https://github.com/{org}/{repo}/blob/{branch}/{path}#L{start}-L{end}
```

Invalid:
- Directory links (`/tree/main/packages/`) — not precise enough
- Branch links to non-default branches — may be deleted
- Links without line numbers — not precise enough

## Automated Verification

Run the project script:
```bash
pnpm verify-links
```

This extracts all GitHub URLs from `docs/patterns/*.md` and checks HTTP status.

## When a Link is Broken

Follow SOP 06 (Broken Link Fix).
