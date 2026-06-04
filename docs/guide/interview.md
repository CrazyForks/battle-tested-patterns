---
description: "Ace system design and coding interviews — 46 patterns mapped to interview topics with sample questions and what interviewers look for."
---

# Interview Guide

These patterns show up constantly in system design and coding interviews. This page maps them to the questions you'll actually get asked.

## How to Use This Page

1. **Find the interview topic** you're preparing for
2. **Read the pattern pages** linked in each section (understand the mechanism, not just the name)
3. **Run the interactive visualizations** — interviewers love candidates who can draw and explain
4. **Try the exercises** — they're structured like coding interview problems

## System Design Interviews

### "Design a Rate Limiter"

This is the single most common system design question. You need:

| Concept | Pattern | What to Say |
|---|---|---|
| Token bucket algorithm | [Rate Limiter](/patterns/rate-limiter/) | "I'd use a token bucket — it handles bursts up to capacity while maintaining a steady refill rate" |
| Distributed rate limiting | [Consistent Hashing](/patterns/consistent-hashing/) | "For multi-node, I'd hash client IPs to specific rate limiter instances to avoid cross-node coordination" |
| Sliding window fallback | [Ring Buffer](/patterns/ring-buffer/) | "A ring buffer can track request timestamps in the sliding window variant" |

### "Design a Cache"

| Concept | Pattern | What to Say |
|---|---|---|
| Eviction policy | [LRU Cache](/patterns/lru-cache/) | "LRU with a doubly-linked list + hash map gives O(1) get/put/evict" |
| Cache stampede prevention | [Semaphore](/patterns/semaphore/) | "Use a semaphore so only one request computes the value, others wait" |
| Distributed cache routing | [Consistent Hashing](/patterns/consistent-hashing/) | "Consistent hashing lets me add/remove cache nodes without full redistribution" |
| Negative cache | [Bloom Filter](/patterns/bloom-filter/) | "A Bloom filter in front avoids cache lookups for keys that definitely don't exist" |

### "Design a Key-Value Store"

| Concept | Pattern | What to Say |
|---|---|---|
| Write path | [LSM Tree](/patterns/lsm-tree/) | "Write to WAL, then memtable. When memtable is full, flush to sorted SSTable on disk" |
| Read optimization | [Bloom Filter](/patterns/bloom-filter/) | "Each SSTable has a Bloom filter — skip files that definitely don't contain the key" |
| Crash recovery | [WAL](/patterns/write-ahead-log/) + [Checkpointing](/patterns/checkpointing/) | "WAL ensures durability. Periodic checkpoints bound recovery time" |
| Compaction | [Merge Iterator](/patterns/merge-iterator/) | "K-way merge of sorted SSTables using a min-heap" |
| Deletion | [Tombstone](/patterns/tombstone/) | "Can't remove from immutable SSTables — write a tombstone marker, compact later" |

### "Design a Distributed Database"

| Concept | Pattern | What to Say |
|---|---|---|
| Replication | [WAL](/patterns/write-ahead-log/) + [State Machine](/patterns/state-machine/) | "Raft: replicate WAL entries, apply to state machine in order" |
| Consistency | [Logical Clock](/patterns/logical-clock/) | "Lamport timestamps for total order, vector clocks for causal consistency" |
| Partitioning | [Consistent Hashing](/patterns/consistent-hashing/) | "Consistent hashing with virtual nodes for even distribution" |
| Anti-entropy | [Merkle Tree](/patterns/merkle-tree/) | "Compare Merkle roots between replicas to find divergence in O(log n)" |
| Concurrent reads | [MVCC](/patterns/mvcc/) | "Each transaction sees a consistent snapshot — readers never block writers" |
| Conflict resolution | [Tombstone](/patterns/tombstone/) + [Logical Clock](/patterns/logical-clock/) | "Last-write-wins using vector clock comparison, tombstones for deletes" |

### "Design a Task Scheduler"

| Concept | Pattern | What to Say |
|---|---|---|
| Priority queue | [Min Heap](/patterns/min-heap/) | "Min-heap by deadline/priority — O(1) peek, O(log n) insert" |
| Fair scheduling | [Work Stealing](/patterns/work-stealing/) | "Idle workers steal from busy queues — Go runtime does exactly this" |
| Time slicing | [Cooperative Scheduling](/patterns/cooperative-scheduling/) | "Each task yields after a time slice — React Scheduler does this to stay under 16ms" |
| Concurrency limit | [Semaphore](/patterns/semaphore/) | "Semaphore with N permits limits concurrent task execution" |
| Task dependency | [Dependency Graph](/patterns/dependency-graph/) | "DAG of tasks, execute in topological order" |

### "Design a Message Queue"

| Concept | Pattern | What to Say |
|---|---|---|
| Producer buffering | [Ring Buffer](/patterns/ring-buffer/) | "Fixed-size ring buffer for zero-allocation enqueue/dequeue" |
| Consumer flow control | [Backpressure](/patterns/backpressure/) | "If consumer is slow, signal producer to slow down — don't drop messages" |
| Ordered delivery | [Logical Clock](/patterns/logical-clock/) | "Lamport timestamps ensure causal ordering across partitions" |
| Batched writes | [Batch Processing](/patterns/batch-processing/) | "Accumulate messages, fsync as a batch — Kafka does this for throughput" |
| Durability | [WAL](/patterns/write-ahead-log/) | "Append-only log on disk — replay for recovery" |

### "Design an API Gateway"

| Concept | Pattern | What to Say |
|---|---|---|
| Rate limiting | [Rate Limiter](/patterns/rate-limiter/) | "Token bucket per client, per endpoint" |
| Circuit breaking | [Circuit Breaker](/patterns/circuit-breaker/) | "If backend error rate exceeds threshold, open circuit and fail fast" |
| Retry policy | [Retry with Backoff](/patterns/retry-backoff/) | "Exponential backoff with jitter to avoid thundering herd" |
| Request pipeline | [Middleware Chain](/patterns/middleware-chain/) | "Auth → rate limit → transform → route → response — composable handlers" |
| Service discovery | [Registry](/patterns/registry/) | "Services self-register, gateway looks up by name" |

## Coding Interviews

### Data Structure Design

| Question | Core Pattern | Key Insight |
|---|---|---|
| "Implement an LRU cache" | [LRU Cache](/patterns/lru-cache/) | Hash map + doubly-linked list, O(1) everything |
| "Design a trie with insert/search/startsWith" | [Trie](/patterns/trie/) | Recursive children map, isEnd flag |
| "Implement a min-heap" | [Min Heap](/patterns/min-heap/) | Array-based, siftUp on insert, siftDown on extract |
| "Design a skip list" | [Skip List](/patterns/skip-list/) | Randomized levels, search by descending levels |
| "Implement a Bloom filter" | [Bloom Filter](/patterns/bloom-filter/) | k hash functions, bit array, no false negatives |
| "Design a thread-safe object pool" | [Object Pool](/patterns/object-pool/) | Acquire/release with mutex or CAS |

### Algorithm Problems

| Question | Core Pattern | Key Insight |
|---|---|---|
| "Merge K sorted lists" | [Merge Iterator](/patterns/merge-iterator/) | Min-heap of k heads, extract-min and advance |
| "Find the median in a stream" | [Min Heap](/patterns/min-heap/) | Two heaps: max-heap for lower half, min-heap for upper |
| "Implement an iterator that flattens nested lists" | [Iterator](/patterns/iterator/) | Stack-based lazy traversal |
| "Detect cycle in linked list" | [Reference Counting](/patterns/reference-counting/) | Or use Floyd's — but ref counting explains why cycles are problematic |
| "Serialize/deserialize a tree" | [Visitor](/patterns/visitor/) | Pre-order visit for serialize, recursive rebuild for deserialize |
| "Compute minimum edit distance" | [Diff / Patch](/patterns/diff-patch/) | Dynamic programming on two sequences |

### Concurrency Problems

| Question | Core Pattern | Key Insight |
|---|---|---|
| "Implement a semaphore" | [Semaphore](/patterns/semaphore/) | Counter + mutex + condition variable |
| "Design a thread pool" | [Work Stealing](/patterns/work-stealing/) | Per-thread deque, steal from tail |
| "Implement a read-write lock" | [MVCC](/patterns/mvcc/) | Multiple concurrent readers, exclusive writer |
| "Producer-consumer problem" | [Ring Buffer](/patterns/ring-buffer/) + [Backpressure](/patterns/backpressure/) | Bounded buffer with wait/signal |
| "Dining philosophers" | [Semaphore](/patterns/semaphore/) | Resource ordering prevents deadlock |

## What Interviewers Actually Look For

It's not about memorizing patterns. Here's what distinguishes strong candidates:

### 1. Tradeoff Awareness

Don't just say "I'd use a Bloom filter." Say:

> "A Bloom filter gives us O(k) lookups in O(m) bits of space, with tunable false positive rate. The tradeoff is we can't delete — for that we'd need a counting Bloom filter, which uses 4x the space."

Every pattern in this book has a **When NOT to Use** section — read those.

### 2. Production Context

Don't say "I'd use a queue." Say:

> "I'd use a ring buffer like LMAX Disruptor — fixed size, no allocation, and the producer/consumer can be on different cores without cache-line contention because they access different indices."

The **Production Proof** section of each pattern gives you these references.

### 3. Composition

Real systems combine patterns. When designing a KV store, don't just say "LSM tree." Walk through the full stack:

> "Writes go to a WAL for durability, then a memtable (sorted in-memory). When full, flush to an SSTable. Each SSTable has a Bloom filter for read optimization. Compaction uses a merge iterator to combine SSTables. Deletes use tombstones."

The [Cheat Sheet](/guide/cheatsheet) has a **Pattern Combos** section for this.

### 4. Drawing

If you can sketch a pattern's mechanism on a whiteboard, you understand it. If you can't, you've only memorized the name. Every pattern's interactive visualization teaches you what to draw.

## Study Plan

### 1 Week Sprint

| Day | Focus | Patterns |
|---|---|---|
| 1 | Caching & Lookup | LRU Cache, Bloom Filter, Trie |
| 2 | Storage Engine | WAL, LSM Tree, B+ Tree, Checkpointing |
| 3 | Reliability | Circuit Breaker, Rate Limiter, Retry with Backoff |
| 4 | Concurrency | Semaphore, MVCC, Work Stealing |
| 5 | Distributed | Consistent Hashing, Logical Clock, Merkle Tree |
| 6 | Memory & Runtime | Object Pool, Arena, Reference Counting, Copy-on-Write |
| 7 | Review | Run all exercises, practice drawing mechanisms |

### Weekend Crash Course

Focus on the 10 patterns that cover 80% of system design interviews:

1. [LRU Cache](/patterns/lru-cache/) — every cache question
2. [Rate Limiter](/patterns/rate-limiter/) — dedicated interview question + used in API gateway
3. [Consistent Hashing](/patterns/consistent-hashing/) — every distributed question
4. [WAL](/patterns/write-ahead-log/) — every storage/database question
5. [LSM Tree](/patterns/lsm-tree/) — KV store design
6. [Bloom Filter](/patterns/bloom-filter/) — read optimization, set membership
7. [Circuit Breaker](/patterns/circuit-breaker/) — API gateway, microservices
8. [MVCC](/patterns/mvcc/) — database concurrency
9. [Min Heap](/patterns/min-heap/) — scheduler, merge-k, median
10. [Merkle Tree](/patterns/merkle-tree/) — data integrity, anti-entropy
