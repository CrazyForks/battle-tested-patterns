---
description: "How the 46 patterns connect: composition chains, shared building blocks, and real-world pattern combinations."
---

# How Patterns Connect

These patterns don't exist in isolation. The most interesting insight is how production systems **compose** them together.

**Explore interactively** — click any system to see which patterns it uses and why:

<PatternConnectionsViz />

## Composition Chains

The most powerful insight isn't which patterns exist — it's how they **chain together** in real systems.

### React Reconciler: From Flag to Frame

```text
Bitmask          → flags encode which work is needed
    ↓
Dirty Flag       → skip subtrees that haven't changed
    ↓
Min Heap         → pick highest-priority work first
    ↓
Cooperative Scheduling → yield every 5ms to avoid jank
    ↓
Diff / Patch     → compute minimal tree changes
    ↓
Double Buffering → build workInProgress tree, swap atomically
    ↓
Batch Processing → flush all state updates in one commit
```

### PostgreSQL: From Write to Recovery

```text
Write-Ahead Log  → every mutation logged before applying
    ↓
Checkpointing    → periodic snapshot bounds replay on crash
    ↓
B+ Tree          → disk-optimized index for range queries
    ↓
MVCC             → readers see consistent snapshot, never block writers
    ↓
LRU Cache        → buffer pool keeps hot pages in memory
    ↓
Bloom Filter     → skip index lookups for absent keys
```

### Kafka Broker: From Producer to Consumer

```text
Batch Processing → accumulate messages, fsync as a group
    ↓
Write-Ahead Log  → append-only log segments on disk
    ↓
Ring Buffer      → fixed-size I/O event queue
    ↓
Backpressure     → slow consumers signal producers to throttle
    ↓
Consistent Hashing → partition assignment across brokers
    ↓
Tombstone        → log compaction removes obsolete records
```

### Go Runtime: Scheduling + Memory

```text
Work Stealing    → idle P steals goroutines from busy P's queue
    ↓
Semaphore        → GOMAXPROCS limits concurrent OS threads
    ↓
Object Pool      → sync.Pool recycles frequently allocated objects
    ↓
Free List        → mspan tracks free slots in size classes
    ↓
Arena Allocator  → stack frames allocated as bump pointer
    ↓
Copy-on-Write    → slice append copies only when capacity exceeded
```

## The Bigger Picture

Understanding individual patterns is useful. Understanding how they **compose** is what separates a senior engineer from a junior one.

When you see a performance problem, you don't think "I need a bitmask." You think "I need to track multiple states cheaply (bitmask), skip work that hasn't changed (subtree flags), process work incrementally (cooperative scheduling), prioritize urgent work (min heap), and avoid allocation on the hot path (double buffering)."

That's what React's team built. That's what Redis, Go, Linux, PostgreSQL, and Kafka all demonstrate. The same patterns recombine in different configurations to solve different problems.

## Summary: Patterns Across Systems

| Pattern | React | Redis | Go Runtime | Linux | PostgreSQL | Kafka |
|---------|:-----:|:-----:|:----------:|:-----:|:----------:|:-----:|
| **Bitmask** | ✅ | | ✅ | ✅ | | |
| **Min Heap** | ✅ | | ✅ | ✅ | | |
| **Cooperative Scheduling** | ✅ | | ✅ | | | |
| **Diff / Patch** | ✅ | | | | | |
| **Double Buffering** | ✅ | | | | | |
| **Batch Processing** | ✅ | ✅ | | ✅ | | ✅ |
| **Dirty Flag** | ✅ | | | | | |
| **Observer** | ✅ | | | | | |
| **Skip List** | | ✅ | | | | |
| **LRU Cache** | | ✅ | ✅ | | ✅ | |
| **Trie** | | ✅ | | ✅ | | |
| **Bloom Filter** | | ✅ | | | ✅ | |
| **Work Stealing** | | | ✅ | | | |
| **Free List** | | | ✅ | ✅ | | |
| **Semaphore** | | | ✅ | ✅ | | |
| **Object Pool** | | | ✅ | | | |
| **Rate Limiter** | | | ✅ | ✅ | | |
| **Arena Allocator** | | | ✅ | | | |
| **State Machine** | | | | ✅ | | |
| **Ring Buffer** | | | | ✅ | | ✅ |
| **Backpressure** | | | | ✅ | | ✅ |
| **Vtable** | | | | ✅ | | |
| **Reference Counting** | | | | ✅ | | |
| **Copy-on-Write** | | ✅ | ✅ | ✅ | | |
| **Tombstone** | | ✅ | | | | ✅ |
| **MVCC** | | | | | ✅ | |
| **Write-Ahead Log** | | | | | ✅ | ✅ |
| **B+ Tree** | | | | ✅ | ✅ | |
| **Checkpointing** | | | | | ✅ | |
| **Event Loop** | | ✅ | ✅ | ✅ | | |
| **Iterator** | ✅ | | ✅ | | | |
| **Tagged Union** | ✅ | | ✅ | | | |
| **Retry Backoff** | | | | | | ✅ |
| **Consistent Hashing** | | | ✅ | | | ✅ |
