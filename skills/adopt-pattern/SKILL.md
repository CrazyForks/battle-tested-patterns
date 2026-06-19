---
name: adopt-pattern
description: >-
  Use when a developer wants to apply a low-level, systems, or concurrency
  design pattern in their own code, drawing on the Battle-Tested Patterns
  catalog of 46 production-proven patterns.
  Triggers three ways: they name a pattern (ring buffer, circuit breaker,
  actor model, LRU cache, rate limiter, trie, bloom filter, WAL, semaphore,
  ...); they describe a problem one solves without naming it (fixed-size
  buffer that overwrites the oldest entry, cascading failures across
  services, throttling requests, deduplicating identical strings, ordering
  events without wall-clock time, snapshot isolation, prefix search, set
  membership without storing every key, ...); or they ask which pattern fits
  a problem or how two related patterns differ.
---

# Adopt a Pattern

## Overview

The Battle-Tested Patterns catalog documents 46 patterns, each on a public doc
page (URLs in the catalog below) with a `When to Use` / `When NOT to Use` /
`Related Patterns` decision guide, a `Production Proof` table of real source
links, and a multi-language `Implementation`. **Those doc pages are the source
of truth** — fetch the relevant one rather than relying on memory. This skill
routes a developer's problem to the right pattern and then drives a disciplined
adoption into _their_ codebase; it does not reproduce the pattern content here.

Two principles do the work:

1. **A pattern is only worth adopting if it fits** — the common failure is
   reaching for a named pattern that doesn't match the problem; the fit-gate
   catches that before any code is written.
2. **A pattern adopted without a durable test for its invariant is not done** —
   a correct-looking implementation that leaves no regression test lets the
   invariant rot on the next edit. The verify step leaves that test behind.

## When to use

- A developer names a pattern and wants it in their code.
- A developer describes a problem (see the catalog cues) without naming a pattern.
- A developer asks "which pattern fits?" or "X vs Y — which?".

**When NOT to use:** general feature work with no pattern in play, or a problem
no catalog entry matches (say so plainly rather than forcing a fit).

## Workflow

Work the four steps in order. Do not skip the fit-gate.

### 1. Match

Map the problem to candidate patterns using the catalog below. If the developer
named a pattern, still confirm it against the cue. If a problem matches several
(e.g. "throttle requests" → Rate Limiter, Semaphore, Backpressure), keep 2–3
candidates for the fit-gate.

### 2. Fit-gate

Fetch **only the candidate patterns'** doc pages (the Doc URL in the catalog)
and focus on `When to Use`, `When NOT to Use`, and `Related Patterns`.

- If the pattern fits, continue to step 3.
- If `When NOT to Use` describes the developer's situation, **stop and steer**
  to the better-fit pattern named in `Related Patterns`. Explain why in one or
  two sentences.
- If nothing fits, say so. Do not adopt a pattern to satisfy the request.

Do not fetch all 46 docs. Fetch the 1–3 you are actually deciding between.

### 3. Adapt

Read the chosen doc's `Implementation` (in the developer's language) and skim
`Production Proof` for how real systems shape it. Then write it **into their
codebase** — match their naming, types, error handling, and module boundaries.

- Adapt, do not copy-paste. The reference impl is a teaching version; production
  code needs the project's conventions and edge-case handling.
- Carry over the invariants the doc calls out (e.g. a ring buffer's overwrite-on-
  full rule, a circuit breaker's half-open probe). Those are the point.

### 4. Verify — leave a durable invariant test

This is where adoption is won or lost: a capable agent will usually pick the
right pattern and implement it correctly, then "confirm it works" with a
throwaway check and move on — leaving nothing that protects the invariant on the
next edit.

Write a focused test **as a committed file** in the developer's own project and
runner that exercises the pattern's defining behavior — use the doc's `Exercises`
and `Challenge Questions` as a checklist of cases (the boundary conditions, not
the happy path). Run it. An inline or throwaway check does not count. A pattern
adopted without a durable test for its invariant is not done.

## Pattern catalog

Each row links to the pattern's public doc page — fetch it during the fit-gate.
(Maintainers: this block is generated; see the skill's source repo.)

<!-- CATALOG:START -->

_46 patterns. Match the developer's problem to a row, then fetch only that pattern's doc URL._

### 🧠 Data Structures

| Pattern | Reach for it when | Level | Doc URL |
| --- | --- | --- | --- |
| **Bitmask** | flags in one int — Pack multiple boolean flags into a single integer and manipulate them with bitwise operators for constant-time set operations. | beginner | <https://totoro-jam.github.io/battle-tested-patterns/patterns/bitmask/> |
| **Min Heap** | priority queue — A binary tree stored in an array where the smallest element is always at the root, enabling O(1) peek and O(log n) insert/remove. | intermediate | <https://totoro-jam.github.io/battle-tested-patterns/patterns/min-heap/> |
| **Ring Buffer** | fixed-size FIFO — A fixed-size buffer that wraps around using modular arithmetic, enabling constant-time enqueue and dequeue without memory allocation. | beginner | <https://totoro-jam.github.io/battle-tested-patterns/patterns/ring-buffer/> |
| **Trie** | prefix search — Store strings in a tree where each edge represents a character — shared prefixes share nodes, enabling O(k) lookup by key length. | intermediate | <https://totoro-jam.github.io/battle-tested-patterns/patterns/trie/> |
| **Skip List** | probabilistic order — A probabilistic sorted data structure with O(log n) search, insert, and delete — simpler to implement than balanced trees with comparable performance. | advanced | <https://totoro-jam.github.io/battle-tested-patterns/patterns/skip-list/> |
| **Bloom Filter** | set membership — Test set membership in O(k) time with zero false negatives — at the cost of a tunable false positive rate. | intermediate | <https://totoro-jam.github.io/battle-tested-patterns/patterns/bloom-filter/> |
| **LRU Cache** | eviction policy — Evict the least recently used entry when the cache is full — O(1) get and put using a hash map plus a doubly linked list. | intermediate | <https://totoro-jam.github.io/battle-tested-patterns/patterns/lru-cache/> |
| **B+ Tree** | disk-optimized index — Self-balancing tree with high branching factor — internal nodes guide, leaf nodes store, all leaves linked for efficient range scans. | advanced | <https://totoro-jam.github.io/battle-tested-patterns/patterns/b-plus-tree/> |
| **Tagged Union** | type-safe dispatch — Store a type tag alongside a value union so one variable safely holds different types, dispatching behavior via the tag. | beginner | <https://totoro-jam.github.io/battle-tested-patterns/patterns/tagged-union/> |
| **Merkle Tree** | integrity proof — Hash leaves, then hash pairs upward to a root — verify any leaf's integrity in O(log n) without re-hashing the entire dataset. | advanced | <https://totoro-jam.github.io/battle-tested-patterns/patterns/merkle-tree/> |
| **Merge Iterator** | k-way merge — Combine K sorted streams into one sorted output using a min-heap — the universal "unified view" over multiple data sources. | advanced | <https://totoro-jam.github.io/battle-tested-patterns/patterns/merge-iterator/> |

### ⚡ Concurrency

| Pattern | Reach for it when | Level | Doc URL |
| --- | --- | --- | --- |
| **Semaphore** | bounded access — Limit the number of concurrent operations by maintaining a counter — acquire before work, release after, block when the limit is reached. | beginner | <https://totoro-jam.github.io/battle-tested-patterns/patterns/semaphore/> |
| **Actor Model** | message passing — Each actor has a mailbox and processes messages sequentially — no shared state, no locks, just message passing for safe concurrency. | advanced | <https://totoro-jam.github.io/battle-tested-patterns/patterns/actor-model/> |
| **Work Stealing** | load balance — Idle threads steal tasks from busy threads' queues — balancing load dynamically without central coordination. | advanced | <https://totoro-jam.github.io/battle-tested-patterns/patterns/work-stealing/> |
| **MVCC** | snapshot isolation — Keep multiple timestamped versions of each value so readers never block writers — each transaction sees a consistent snapshot without locks. | advanced | <https://totoro-jam.github.io/battle-tested-patterns/patterns/mvcc/> |
| **Cooperative Scheduling** | yield control — Break long-running work into small chunks, yielding control back to the host between each chunk to keep the system responsive. | advanced | <https://totoro-jam.github.io/battle-tested-patterns/patterns/cooperative-scheduling/> |
| **Double Buffering** | atomic swap — Maintain two copies of state and atomically swap between them so readers always see a consistent snapshot. | beginner | <https://totoro-jam.github.io/battle-tested-patterns/patterns/double-buffering/> |
| **Backpressure** | flow control — Slow down producers when consumers can't keep up — use bounded buffers and demand signals to prevent resource exhaustion. | intermediate | <https://totoro-jam.github.io/battle-tested-patterns/patterns/backpressure/> |
| **Event Loop** | I/O multiplexing — A single-threaded loop that multiplexes I/O via epoll/kqueue, dispatching ready events to callbacks — thousands of connections without threads. | intermediate | <https://totoro-jam.github.io/battle-tested-patterns/patterns/event-loop/> |
| **Logical Clock** | event ordering — A monotonically increasing counter that orders events without wall-clock time — enabling consistent snapshots and staleness detection. | advanced | <https://totoro-jam.github.io/battle-tested-patterns/patterns/logical-clock/> |

### 🏗️ Systems

| Pattern | Reach for it when | Level | Doc URL |
| --- | --- | --- | --- |
| **Circuit Breaker** | fault tolerance — Stop calling a failing service by tracking errors and tripping open — fail fast instead of piling up timeouts. | intermediate | <https://totoro-jam.github.io/battle-tested-patterns/patterns/circuit-breaker/> |
| **Rate Limiter** | throttle — Protect services from overload by draining tokens from a bucket that refills at a fixed rate — reject requests when empty. | intermediate | <https://totoro-jam.github.io/battle-tested-patterns/patterns/rate-limiter/> |
| **Retry Backoff** | resilience — When an operation fails, retry it with progressively longer delays plus random jitter to avoid thundering herd. | beginner | <https://totoro-jam.github.io/battle-tested-patterns/patterns/retry-backoff/> |
| **Write-Ahead Log** | durability — Log every mutation to durable storage before applying it — replay the log to recover from crashes without data loss. | intermediate | <https://totoro-jam.github.io/battle-tested-patterns/patterns/write-ahead-log/> |
| **Batch Processing** | throughput — Accumulate individual operations and execute them together as a group, amortizing per-operation overhead across the batch. | beginner | <https://totoro-jam.github.io/battle-tested-patterns/patterns/batch-processing/> |
| **Consistent Hashing** | distribution — Distribute keys across nodes on a virtual ring so that adding or removing a node only remaps ~1/n of the keys. | advanced | <https://totoro-jam.github.io/battle-tested-patterns/patterns/consistent-hashing/> |
| **Dependency Graph** | ordering — Model dependencies as a directed acyclic graph and topologically sort to determine a valid execution order — detecting cycles before they deadlock. | intermediate | <https://totoro-jam.github.io/battle-tested-patterns/patterns/dependency-graph/> |
| **Middleware Chain** | pipeline — Compose handlers where each wraps the next — pre-process, call next, post-process — forming a bidirectional pipeline. | intermediate | <https://totoro-jam.github.io/battle-tested-patterns/patterns/middleware-chain/> |
| **Registry** | self-register — Components register themselves into a global lookup table by name — consumers discover implementations at runtime without hardcoded dependencies. | beginner | <https://totoro-jam.github.io/battle-tested-patterns/patterns/registry/> |
| **Dirty Flag** | deferred recompute — Mark objects as "dirty" on mutation, defer expensive recomputation until the value is actually needed, then clear the flag. | beginner | <https://totoro-jam.github.io/battle-tested-patterns/patterns/dirty-flag/> |
| **LSM Tree** | write-optimized store — Buffer writes in memory, flush to sorted files on disk, merge files in background — trading read amplification for fast writes. | advanced | <https://totoro-jam.github.io/battle-tested-patterns/patterns/lsm-tree/> |
| **Checkpointing** | snapshot recovery — Periodically snapshot consistent state so recovery replays only from the checkpoint — not from the beginning of time. | intermediate | <https://totoro-jam.github.io/battle-tested-patterns/patterns/checkpointing/> |

### ♻️ Memory

| Pattern | Reach for it when | Level | Doc URL |
| --- | --- | --- | --- |
| **Object Pool** | reuse instances — Pre-allocate a set of reusable objects to avoid the cost of repeated allocation and garbage collection on hot paths. | beginner | <https://totoro-jam.github.io/battle-tested-patterns/patterns/object-pool/> |
| **Flyweight** | share immutables — Share identical immutable objects instead of creating duplicates, trading a lookup cost for massive memory savings when many instances have the same value. | beginner | <https://totoro-jam.github.io/battle-tested-patterns/patterns/flyweight/> |
| **Arena Allocator** | bump alloc — Allocate objects by bumping a pointer in a pre-allocated region — free everything at once when the region is no longer needed. | intermediate | <https://totoro-jam.github.io/battle-tested-patterns/patterns/arena-allocator/> |
| **Free List** | O(1) alloc/free — Maintain a linked list of freed slots so allocation and deallocation are O(1) — reuse memory without calling the system allocator. | intermediate | <https://totoro-jam.github.io/battle-tested-patterns/patterns/free-list/> |
| **Copy-on-Write** | defer copy — Share data by reference until someone modifies it — only then make a private copy, saving memory and allocation cost for read-heavy workloads. | intermediate | <https://totoro-jam.github.io/battle-tested-patterns/patterns/copy-on-write/> |
| **Reference Counting** | auto-cleanup — Track owners via atomic counter, auto-cleanup at zero — deterministic resource lifetime without garbage collection. | beginner | <https://totoro-jam.github.io/battle-tested-patterns/patterns/reference-counting/> |
| **Tombstone** | deferred deletion — Mark deleted entries with a tombstone marker instead of removing them — a background process reclaims space later. | beginner | <https://totoro-jam.github.io/battle-tested-patterns/patterns/tombstone/> |
| **Interning** | deduplicate values — Deduplicate immutable values through a canonical lookup table — O(1) equality by pointer comparison instead of O(n) content comparison. | intermediate | <https://totoro-jam.github.io/battle-tested-patterns/patterns/interning/> |

### 🔄 Behavioral

| Pattern | Reach for it when | Level | Doc URL |
| --- | --- | --- | --- |
| **State Machine** | transitions — Model an entity's lifecycle as a set of states with explicit transitions, making impossible states unrepresentable and every state change auditable. | beginner | <https://totoro-jam.github.io/battle-tested-patterns/patterns/state-machine/> |
| **Observer** | pub/sub — Decouple producers from consumers by letting objects subscribe to events and get notified when something happens, without the source knowing who's listening. | beginner | <https://totoro-jam.github.io/battle-tested-patterns/patterns/observer/> |
| **Iterator** | lazy eval — Process sequences one element at a time without materializing the entire collection, enabling composable transformations with zero intermediate allocations. | beginner | <https://totoro-jam.github.io/battle-tested-patterns/patterns/iterator/> |
| **Diff / Patch** | minimal edits — Compare two sequences to compute the minimal set of operations (insert, delete, move) needed to transform one into the other. | intermediate | <https://totoro-jam.github.io/battle-tested-patterns/patterns/diff-patch/> |
| **Vtable** | manual polymorphism — Group function pointers into a struct to achieve runtime polymorphism — the manual foundation behind interfaces, traits, and virtual methods. | advanced | <https://totoro-jam.github.io/battle-tested-patterns/patterns/vtable/> |
| **Visitor** | tree traversal dispatch — Decouple tree traversal from operations by dispatching to type-specific callbacks — enabling new operations without modifying the tree. | advanced | <https://totoro-jam.github.io/battle-tested-patterns/patterns/visitor/> |

<!-- CATALOG:END -->

## Common mistakes

- **Skipping the fit-gate** because the developer named a pattern. Named ≠ correct
  — confirm against `When NOT to Use` first.
- **Copy-pasting the reference implementation** verbatim. It teaches the shape; it
  is not drop-in production code.
- **Loading many pattern docs at once.** Match from the catalog cues, then open
  only the 1–3 candidates.
- **Choosing by familiarity** ("I know LRU") instead of fit. Check `Related
  Patterns` — the better tool is often one row away.
- **Declaring done without a test** for the pattern's invariant.

## Example

> Developer: "Downloads are hammering the API — I want to cap it at 5 in flight."

1. **Match** — "cap concurrent access" → candidates: Semaphore, Rate Limiter,
   Backpressure.
2. **Fit-gate** — the Semaphore doc's `When to Use` directly lists "control
   access to a fixed number of resources" and "limit concurrent network
   requests" — a _concurrency cap_, which is what the developer asked for. Rate
   Limiter's `When to Use` governs _rate over time_ (API rate limiting, traffic
   shaping), a different axis. → **Semaphore**.
3. **Adapt** — port the doc's TypeScript semaphore into their download module,
   wrapping the fetch call in `acquire()/release()` with their existing
   error/cleanup handling so a failed download always releases its permit.
4. **Verify** — test that with the cap at 5 and 20 queued downloads, no more than
   5 run concurrently and all 20 eventually complete.
