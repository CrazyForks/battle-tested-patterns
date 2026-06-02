---
name: diagnose
description: Structured debugging loop for exercise tests or build failures. Reproduce → isolate → hypothesize → fix → verify.
---

# Diagnose a Failure

You are debugging a test failure or build error in this project. Follow the structured loop — do NOT jump to a fix without reproducing first.

## Loop

### 1. Reproduce

Run the failing command and capture the exact error:
```bash
pnpm test          # TypeScript
cargo test         # Rust (in exercises/rust/)
go test ./...      # Go (in exercises/go/)
pnpm build         # VitePress
```

### 2. Isolate

Narrow down to the smallest failing unit:
- Which test file?
- Which test case?
- Which assertion?

### 3. Hypothesize

State your hypothesis in one sentence before changing any code.

### 4. Instrument

Add minimal logging or assertions to confirm/deny your hypothesis. Do NOT change production code yet.

### 5. Fix

Apply the minimal fix. Change as little as possible.

### 6. Verify

Run the full test suite, not just the failing test:
```bash
pnpm test && pnpm build
```

If it still fails, return to step 1 with what you learned.

### 7. Regression Test

If the bug was non-trivial, add a test that would have caught it.
