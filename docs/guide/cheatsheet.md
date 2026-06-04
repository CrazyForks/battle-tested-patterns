---
description: "Quick reference card for all 46 battle-tested patterns — complexity, when to use, and pick-by-problem guide."
---

# Cheat Sheet

A single-page reference for all 46 patterns. Print it, bookmark it, or ctrl-F your way through it.

## Pick by Problem

Not sure which pattern you need? Start here.

| I need to... | Reach for | Why |
|---|---|---|
| Limit concurrent access | [Semaphore](/patterns/semaphore/) | Counter-based, proven in OS kernels |
| Handle slow consumers | [Backpressure](/patterns/backpressure/) | Don't drop — push back |
| Cache with eviction | [LRU Cache](/patterns/lru-cache/) | O(1) get/put, auto-evict coldest |
| Fast prefix lookup | [Trie](/patterns/trie/) | O(k) by key length, not collection size |
| Probably-in-set check | [Bloom Filter](/patterns/bloom-filter/) | Zero false negatives, tiny memory |
| Sorted range queries | [B+ Tree](/patterns/b-plus-tree/) or [Skip List](/patterns/skip-list/) | B+ Tree for disk, Skip List for memory |
| Crash-safe writes | [WAL](/patterns/write-ahead-log/) + [Checkpointing](/patterns/checkpointing/) | Log-then-apply + periodic snapshots |
| Stop cascading failure | [Circuit Breaker](/patterns/circuit-breaker/) | Fail fast, recover gradually |
| Retry failed calls | [Retry with Backoff](/patterns/retry-backoff/) | Exponential delay + jitter |
| Control throughput | [Rate Limiter](/patterns/rate-limiter/) | Token bucket, constant refill |
| Verify data integrity | [Merkle Tree](/patterns/merkle-tree/) | O(log n) proof with hash chain |
| Reduce memory via sharing | [Flyweight](/patterns/flyweight/) or [Interning](/patterns/interning/) | Share immutable values |
| Avoid GC pressure | [Object Pool](/patterns/object-pool/) or [Arena](/patterns/arena-allocator/) | Reuse or bulk-free |
| Detect changes cheaply | [Dirty Flag](/patterns/dirty-flag/) | Skip recomputation if clean |
| Order distributed events | [Logical Clock](/patterns/logical-clock/) | Lamport or vector clocks |
| Lazy evaluation | [Iterator](/patterns/iterator/) | Pull-based, zero intermediate alloc |
| Handle multiple types | [Tagged Union](/patterns/tagged-union/) or [Vtable](/patterns/vtable/) | Tag for closed set, vtable for open set |
| Write-heavy workload | [LSM Tree](/patterns/lsm-tree/) | Buffer → flush → merge |
| Compose middleware | [Middleware Chain](/patterns/middleware-chain/) | Onion model, each handler wraps next |
| Balance work across threads | [Work Stealing](/patterns/work-stealing/) | Idle steals from busy |
| Track multiple flags | [Bitmask](/patterns/bitmask/) | N flags in one integer |
| Schedule by priority | [Min Heap](/patterns/min-heap/) | O(1) peek, O(log n) push/pop |
| Fixed-size FIFO | [Ring Buffer](/patterns/ring-buffer/) | Wraps around, zero alloc |
| Minimal diff between states | [Diff / Patch](/patterns/diff-patch/) | Compute + apply changes |
| Decouple producers/consumers | [Observer](/patterns/observer/) | Subscribe model |
| Distribute keys across nodes | [Consistent Hashing](/patterns/consistent-hashing/) | Add/remove node remaps ~1/n |
| Build order from dependencies | [Dependency Graph](/patterns/dependency-graph/) | DAG + topological sort |
| Atomic state transitions | [State Machine](/patterns/state-machine/) | Explicit states, impossible transitions unrepresentable |
| Soft-delete with later cleanup | [Tombstone](/patterns/tombstone/) | Mark deleted, compact later |
| Copy-on-mutation sharing | [Copy-on-Write](/patterns/copy-on-write/) | Share until someone writes |
| Deterministic cleanup | [Reference Counting](/patterns/reference-counting/) | Free at rc=0, no GC pause |
| Register/discover services | [Registry](/patterns/registry/) | Name → handler map |
| Atomic swap of state | [Double Buffering](/patterns/double-buffering/) | Write to back, swap to front |
| Non-blocking reads | [MVCC](/patterns/mvcc/) | Versioned snapshots |
| Responsive main thread | [Cooperative Scheduling](/patterns/cooperative-scheduling/) | Yield between chunks |
| Single-thread I/O | [Event Loop](/patterns/event-loop/) | Multiplex without threads |
| Accumulate then flush | [Batch Processing](/patterns/batch-processing/) | Amortize per-op overhead |
| Actor-style isolation | [Actor Model](/patterns/actor-model/) | Private state + message passing |
| Tree traversal dispatch | [Visitor](/patterns/visitor/) | Type-specific callbacks |
| O(1) alloc from freed slots | [Free List](/patterns/free-list/) | Linked list of free blocks |
| Merge sorted streams | [Merge Iterator](/patterns/merge-iterator/) | K-way merge via min-heap |

## Complexity Reference

### Data Structures

| Pattern | Insert | Lookup | Delete | Space | Key Tradeoff |
|---|---|---|---|---|---|
| [Bitmask](/patterns/bitmask/) | O(1) | O(1) | O(1) | O(1) | Limited to word-size flags |
| [Min Heap](/patterns/min-heap/) | O(log n) | O(1) peek | O(log n) | O(n) | Only peek-min is fast |
| [Ring Buffer](/patterns/ring-buffer/) | O(1) | O(1) | O(1) | O(n) fixed | Fixed capacity |
| [Trie](/patterns/trie/) | O(k) | O(k) | O(k) | O(SIGMA * n) | Memory-hungry for sparse keys |
| [Skip List](/patterns/skip-list/) | O(log n) avg | O(log n) avg | O(log n) avg | O(n) avg | Probabilistic, simpler than trees |
| [Bloom Filter](/patterns/bloom-filter/) | O(k) | O(k) | N/A | O(m) bits | False positives possible |
| [LRU Cache](/patterns/lru-cache/) | O(1) | O(1) | O(1) | O(n) | Evicts on capacity |
| [B+ Tree](/patterns/b-plus-tree/) | O(log n) | O(log n) | O(log n) | O(n) | Disk-optimized, high fan-out |
| [Tagged Union](/patterns/tagged-union/) | N/A | O(1) dispatch | N/A | O(max variant) | Closed set of types |
| [Merkle Tree](/patterns/merkle-tree/) | O(log n) | O(log n) | O(log n) | O(n) | Verification, not search |
| [Merge Iterator](/patterns/merge-iterator/) | N/A | O(log k) next | N/A | O(k) | k = number of streams |

### System Patterns

| Pattern | Throughput | Latency | Failure Mode |
|---|---|---|---|
| [Circuit Breaker](/patterns/circuit-breaker/) | Normal when closed | +0 closed, fail-fast open | Blocks all calls when open |
| [Rate Limiter](/patterns/rate-limiter/) | Capped at token rate | +0 if tokens available | Rejects excess (429) |
| [Retry with Backoff](/patterns/retry-backoff/) | Reduced during retries | Exponential increase | Amplifies if no jitter |
| [WAL](/patterns/write-ahead-log/) | Sequential write speed | +1 write (log first) | Safe — replay from log |
| [Batch Processing](/patterns/batch-processing/) | Higher (amortized) | Higher (waits for batch) | Loses batch on crash |
| [Consistent Hashing](/patterns/consistent-hashing/) | Same as underlying | +hash computation | ~1/n keys remap on node change |

### Memory Patterns

| Pattern | Alloc | Free | Overhead | Best For |
|---|---|---|---|---|
| [Object Pool](/patterns/object-pool/) | O(1) amortized | O(1) return | Pool size | High-churn same-type objects |
| [Arena Allocator](/patterns/arena-allocator/) | O(1) bump | O(1) bulk free | Alignment waste | Phase-based lifetimes |
| [Free List](/patterns/free-list/) | O(1) | O(1) | Per-slot next pointer | Fixed-size blocks |
| [Flyweight](/patterns/flyweight/) | O(1) lookup | Shared, not freed | Lookup table | Many identical small objects |
| [Copy-on-Write](/patterns/copy-on-write/) | O(1) share | O(n) on first write | Ref count per page | Read-heavy shared data |
| [Reference Counting](/patterns/reference-counting/) | O(1) clone | O(1) at rc=0 | Per-object counter | Deterministic cleanup |
| [Interning](/patterns/interning/) | O(k) first, O(1) after | Pooled | Hash table | String/symbol deduplication |

## Pattern Combos

Patterns rarely appear alone. These are the most common production combos:

| Combo | Used In | Why Together |
|---|---|---|
| WAL + Checkpointing | PostgreSQL, etcd | WAL for safety, checkpoint to bound replay |
| Bloom Filter + LSM Tree | LevelDB, RocksDB | Skip unnecessary disk reads |
| Min Heap + Merge Iterator | LevelDB compaction | Efficiently merge K sorted runs |
| Circuit Breaker + Retry | gRPC, Hystrix | Retry transient failures, break on persistent |
| Rate Limiter + Backpressure | API gateways | Limit ingress, signal overload |
| Ring Buffer + Event Loop | libuv, io_uring | Fixed-size queue for I/O events |
| Object Pool + Free List | Go runtime | Pool manages slabs, free list tracks slots |
| MVCC + B+ Tree | PostgreSQL | Versioned rows in disk-optimized index |
| Dirty Flag + Double Buffering | React Fiber | Mark dirty, batch into next frame |
| Bitmask + State Machine | React reconciler | Flags encode state, transitions via bitwise ops |
| Consistent Hashing + Registry | Service mesh | Hash to locate, registry to discover |
| Trie + Interning | Compilers | Intern strings, look up by prefix |

## Decision Trees

### "Which cache?"

```text
Need eviction?
├── Yes → Need O(1) ops?
│         ├── Yes → LRU Cache
│         └── No  → B+ Tree with TTL
└── No  → Need probabilistic filter?
          ├── Yes → Bloom Filter (not a cache, but saves cache misses)
          └── No  → Hash map is fine
```

### "Which memory strategy?"

```text
All objects same size?
├── Yes → Object Pool or Free List
└── No  → Phase-based lifetime?
          ├── Yes → Arena Allocator
          └── No  → Shared immutable?
                    ├── Yes → Flyweight / Interning
                    └── No  → Copy-on-Write or Reference Counting
```

### "Which concurrency model?"

```text
Shared state?
├── No  → Actor Model (message passing)
└── Yes → Read-heavy?
          ├── Yes → MVCC (readers never block)
          └── No  → Need limit on concurrency?
                    ├── Yes → Semaphore
                    └── No  → Need to split work?
                              ├── Yes → Work Stealing
                              └── No  → Event Loop (single-thread I/O)
```
