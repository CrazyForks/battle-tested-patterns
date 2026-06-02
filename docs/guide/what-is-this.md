# What is This?

**Battle-Tested Patterns** collects programming patterns that are:

1. **Production-proven** — used in top-tier projects like React, Linux kernel, Go runtime, and Chromium
2. **Cross-language** — applicable in TypeScript, Rust, Go, C, and beyond
3. **Code-level** — concrete techniques you can apply today, not abstract architecture concepts

## Why This Exists

There are plenty of "design patterns" books and "algorithms" repositories. But there's a gap:

| Existing Resources | What They Miss |
|---|---|
| Design Patterns (GoF) | Too abstract, too OOP-centric |
| Algorithm repositories | Disconnected from engineering practice |
| System Design guides | Architecture-level, not code-level |
| "Awesome" lists | Link collections, no teaching |

This project fills the gap: **code-level techniques extracted from production source code, with precise references you can verify yourself**.

## What Makes a Pattern "Battle-Tested"?

Every pattern in this collection must have:

- **≥ 2 production proofs** — precise GitHub links (to exact line numbers) showing the pattern in use
- **Multi-language implementations** — idiomatic code in TypeScript + at least one other language
- **Runnable exercises** — progressive difficulty levels with test suites

We never fabricate source links. If we can't find a verifiable reference, we don't include the pattern.

## How to Use This

- **Browse patterns** — read the concept, study the production proof, then try the exercises
- **Run exercises locally** — `pnpm test` for TypeScript, `cargo test` for Rust, `go test` for Go
- **Use the playground** — edit and run code directly in the browser
- **Contribute** — see [How to Contribute](./how-to-contribute)
