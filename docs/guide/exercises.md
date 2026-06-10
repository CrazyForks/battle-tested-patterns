---
title: "Exercise Guide"
description: "Step-by-step setup for TypeScript, Rust, Go, and Python exercises — prerequisites, how to run tests, and troubleshooting."
---

# Exercise Guide

This project includes **exercises in 4 languages** — TypeScript, Rust, Go, and Python. Each pattern has at least one exercise per language with working implementations and `TODO` markers for you to rewrite.

## Prerequisites

| Language | Required Version | Install |
|----------|-----------------|---------|
| Node.js | v22 LTS | [nvm](https://github.com/nvm-sh/nvm) or [nodejs.org](https://nodejs.org/) |
| Rust | stable (latest) | [rustup.rs](https://rustup.rs/) |
| Go | 1.21+ | [go.dev/dl](https://go.dev/dl/) |
| Python | 3.10+ | [python.org](https://www.python.org/downloads/) or system package manager |

## Quick Start

```bash
# Clone the repository
git clone https://github.com/Totoro-jam/battle-tested-patterns.git
cd battle-tested-patterns

# Use the correct Node.js version
nvm use   # reads .nvmrc → Node 22
```

## Setup by Language

### TypeScript

```bash
# Install dependencies (one time)
pnpm install

# Run all TypeScript exercises
pnpm test

# Run a specific pattern
pnpm test bitmask

# Watch mode — re-runs on file save
pnpm test -- --watch
```

**File location:** `exercises/typescript/<pattern-name>/01-basic.test.ts`

Each pattern has 1–3 exercise files by difficulty level (01-basic, 02-intermediate, 03-advanced).

### Rust

```bash
# No extra install needed — Cargo handles everything

# Run all Rust exercises
cd exercises/rust
cargo test

# Run a specific pattern
cargo test bitmask

# Run with output visible
cargo test bitmask -- --nocapture
```

**File location:** `exercises/rust/src/<pattern_name>/mod.rs`

Each file contains the implementation and tests in a single module with `#[cfg(test)]`.

### Go

```bash
# No extra install needed — Go modules handle dependencies

# Run all Go exercises
cd exercises/go
go test ./...

# Run a specific pattern
go test -run Bitmask -v ./...

# Run with verbose output
go test -v ./...
```

**File location:** `exercises/go/<pattern_name>/<pattern_name>_test.go`

Each file contains both the implementation and test functions in the same package.

### Python

```bash
# Install pytest (one time)
pip install pytest

# Run all Python exercises
cd exercises/python
pytest

# Run a specific pattern
pytest bitmask/test_bitmask.py

# Run with verbose output
pytest -v
```

**File location:** `exercises/python/<pattern_name>/test_<pattern_name>.py`

Each file is self-contained — no cross-file imports.

## How Exercises Work

Every exercise follows the **TODO-stub format**:

1. Functions have **working implementations** (so CI always passes)
2. `// TODO: implement` markers indicate lines for you to rewrite
3. Tests below the separator line are **immutable** — don't modify them
4. Delete the function body, implement from scratch, run the tests

### Example workflow

```bash
# 1. Pick a pattern — say, ring-buffer
# 2. Open the exercise file in your editor
# 3. Find the TODO markers
# 4. Delete the implementation, keep the function signature
# 5. Write your own implementation
# 6. Run the test to check your work:
pnpm test ring-buffer     # TypeScript
cargo test ring_buffer     # Rust
go test -run RingBuffer    # Go
pytest ring_buffer/test_ring_buffer.py # Python
```

### Separator line

```text
// ─── Tests (do not modify below this line) ───────────────────────
```

Everything above this line is your playground. Everything below is the test suite.

### What success / failure looks like

When your implementation is correct:

```text
✓ Ring Buffer - Basic: should enqueue and dequeue in FIFO order (2ms)
✓ Ring Buffer - Basic: should reject enqueue when full
```

When something is wrong:

```text
✗ Ring Buffer - Basic: should enqueue and dequeue in FIFO order
  → expected 1, got undefined
```

## Answer Files

Reference implementations live in `exercises/answers/<language>/<pattern>/`:

```text
exercises/answers/
├── typescript/   # 46 directories, one .ts each
├── rust/         # 46 directories, one .rs each
├── go/           # 46 directories, one .go each
└── python/       # 46 directories, one .py each
```

These contain pure implementation code (no tests). Use them to check your work or study alternative approaches.

## Running All Languages at Once

```bash
# From the project root:
pnpm test                                  # TypeScript (491 tests)
(cd exercises/rust && cargo test)          # Rust (173 tests)
(cd exercises/go && go test ./...)         # Go (176 tests)
(cd exercises/python && pytest)            # Python (233 tests)
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `nvm: command not found` | Install nvm: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh \| bash` |
| `pnpm: command not found` | Install pnpm: `npm install -g pnpm` |
| `rustup: command not found` | Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| `go: command not found` | Download from [go.dev/dl](https://go.dev/dl/) and add to PATH |
| `pytest: command not found` | `pip install pytest` (or `pip3 install pytest`) |
| TypeScript tests fail with import errors | Run `pnpm install` first |
| Rust tests fail to compile | Run `rustup update` to get latest stable |
| Go tests show module errors | Run `go mod tidy` in `exercises/go/` |
| Python `ModuleNotFoundError` | Each file is self-contained — no imports needed |
