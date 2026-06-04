# SOP 02: Verifying Source Code Links

## Trigger

- Before submitting a new pattern or updating Production Proof sections
- During automated link verification (CI on push + weekly cron)
- When a broken-link Issue is opened

## Quick Method

```bash
pnpm verify-links
```

This scans all `docs/` markdown files, extracts GitHub URLs, checks HTTP status, and distinguishes Production Proof links (require line numbers) from other links.

## Manual Verification Steps

### 1. Check HTTP Status

```bash
curl -sI "<url>" | head -1
```

Expected: `HTTP/2 200`

### 2. Verify Precision

Production Proof links must include line numbers:

```text
✅ https://github.com/org/repo/blob/main/path/file.ext#L42-L80
❌ https://github.com/org/repo/blob/main/path/file.ext#L1  (file-level)
❌ https://github.com/org/repo/blob/main/path/file.ext     (no line number)
❌ https://github.com/org/repo/tree/main/path/              (directory)
```

This applies to ALL GitHub links in the Production Proof table — including supplementary references in the Usage column. If a Usage cell references another file (e.g. `object.h`), that link also needs `#L` line numbers.

### 3. Verify Content

- Open the link in browser
- Confirm the code at the specified lines actually demonstrates the pattern
- Confirm the usage description in the table is accurate

### 4. Check Branch

- Must target `main` or `master` (not a feature branch)
- Consider commit SHA permalinks for stability

## When a Link is Broken

Follow SOP 06 (Broken Link Fix).
