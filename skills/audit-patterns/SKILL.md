---
name: audit-patterns
description: >-
  Use when reviewing or auditing an existing codebase against production-proven
  implementation patterns — checking whether the patterns it already implements
  (actor model, rate limiter, circuit breaker, LRU cache, write-ahead log,
  semaphore, ...) actually honor the canonical invariants, whether any are
  mislabeled (a "semaphore" that is really a mutex; an "MVCC" that keeps one
  version), whether any diverge from the reference, and which catalog patterns
  are absent. Triggers on "audit our architecture against best practices", "do
  we implement X correctly", "are our patterns right", "pattern conformance",
  "is this really a <pattern>?". This grades patterns already present; its
  companion adopt-pattern adds new ones.
---

# Audit Patterns

## Overview

Grade a codebase against the Battle-Tested Patterns catalog: for each pattern it
implements, fetch the canonical doc page and check the implementation against
that doc's invariants — **not against the name the codebase gave it.** The most
valuable output of an audit is not a score; it is the **mislabel** — code called
a "semaphore" that is actually a mutex, an "MVCC" that keeps a single version.
Those are the claims that mislead developers into expecting guarantees the code
does not provide.

**Companion skill:** Inventory using the `adopt-pattern` skill's catalog, or the
published index at <https://totoro-jam.github.io/battle-tested-patterns/patterns/>.
This skill is the inverse of `adopt-pattern`: that one runs the catalog forward
(add a pattern); this one runs it backward (grade patterns already there).

## When to use

- A reviewer asks whether a codebase's patterns are implemented correctly.
- Someone asks "is this really a `<pattern>`?" or "do we honor X's invariants?".
- A periodic conformance check after a release, to catch new mislabels/drift.

**When NOT to use:** adding a new pattern (use `adopt-pattern`), or general code
review with no pattern claim in play.

## Workflow

### 1. Inventory

List the catalog patterns the codebase implements. Match by **shape, not name** —
a class named `RateLimiter` may be a different pattern, and a circuit breaker may
exist unnamed. Hunt by shape: retry/backoff loops, lock or lease primitives,
caches with eviction, state enums with transition switches, ring/circular
buffers, breaker/trip counters, subscriber lists. Record the file(s) for each
candidate. Only inventory patterns the codebase actually engages; do not pad the
audit with absent ones.

### 2. Conformance — fetch the doc, never grade from memory

For each candidate, fetch the canonical doc page and read `Core Idea` (the
invariant), `When NOT to Use`, and `Production Proof` (the reference shape). Then
read the actual implementation. Grade against the doc's **headline invariant**.

### 3. Gap analysis — classify the deviation

Assign a verdict (scale below). The judgment is distinguishing _faithful_ from
_divergent_ from _mislabeled_:

- Meets the invariant faithfully → ✅
- Meets the _intent_ a different way (different algorithm/model) → 🟡
- The developer/framework enables it but does not provide it → 🔵
- It is actually a _different_ catalog pattern → 🔁 (the mislabel — flag loudly)
- Not present → ⚪ (absence is N/A, not a failure, unless the pattern is clearly needed)

### 4. Evidence — cite code + doc

Every verdict cites a `file:line` in the codebase and the doc invariant it was
graded against. A verdict without a citation is an opinion, not an audit.

## Verdict scale

| Symbol | Meaning                                                              |
| ------ | ------------------------------------------------------------------- |
| ✅     | Faithful — honors the doc's headline invariant.                     |
| 🟡     | Intent met, model/algorithm diverges from the reference.            |
| 🔵     | Enabled, not provided — the developer brings it.                    |
| 🔁     | Mislabeled — it is actually a different catalog pattern.            |
| ⚪     | Absent / N-A — not present (only a gap if the pattern is needed).   |

## Scorecard format (the output)

Produce one table, optionally grouped by catalog category:

| Pattern | Verdict | Evidence & note                                              |
| ------- | ------- | ------------------------------------------------------------ |
| _name_  | _sym_   | `path:line` — one-line check against the doc's invariant     |

Then **2–4 headline findings**, leading with the mislabels (🔁) and real gaps —
those are what the audit is for. Faithful rows are reassurance, not the point.

## Common mistakes

- **Grading from memory** instead of fetching the doc — invents invariants. Fetch
  every candidate's doc page.
- **Accepting the code's own label** — you will rubber-stamp a mutex called
  "Semaphore." Grade against the doc, not the class name.
- **Treating absence as a bug** — a pattern not present is ⚪/N-A unless the
  codebase clearly needs it.
- **Verdicts without `file:line`** — an audit is evidence, not vibes.
- **Auditing all 46** — grade only the patterns the codebase engages.

## Example (compressed)

Auditing an HTTP/MCP framework:

| Pattern        | Verdict | Evidence & note                                                                                            |
| -------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| Actor Model    | ✅      | `in-memory-runtime.ts:144,156` — per-identity serialized turns; handler gets a clone, rollback on throw.  |
| Semaphore      | 🔁      | `redis-actor-runtime.ts:18` — the lease is `SET NX` (count=1) = **mutex**; the doc routes max=1 → mutex.   |
| MVCC           | 🟡      | `in-memory-runtime.ts:113` — lease-free reads never block writers, but only one version is kept (snapshot read, not multi-version). |
| Circuit Breaker| ⚪      | Absent across all packages — a real gap for an outbound-heavy framework.                                   |

Headline: two over-claims (Semaphore→mutex, MVCC→single-version) that would
mislead a developer expecting counting-semaphore or multi-version guarantees;
one genuine gap (no circuit breaker).
