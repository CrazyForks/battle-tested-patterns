# Study Plan

> **Fork this repo** and check off patterns as you complete them. Your progress is saved in your fork.
>
> For each pattern: read the doc → try the visualization → complete the exercise → answer the challenge questions.
>
> See the [Learning Paths](https://totoro-jam.github.io/battle-tested-patterns/guide/learning-paths) page for recommended order and study tips.

## Track 1: Data Structures Fundamentals

- [ ] Bitmask — Pack N flags into one integer
- [ ] Ring Buffer — Fixed-size FIFO with zero allocation
- [ ] Tagged Union — Type tag for safe dispatch
- [ ] Min Heap — O(1) access to highest-priority item
- [ ] Trie — O(k) lookup by key length
- [ ] Bloom Filter — Probabilistic membership testing
- [ ] LRU Cache — Hash map + linked list combo
- [ ] Skip List — Probabilistic sorted structure
- [ ] B+ Tree — Disk-optimized balanced tree
- [ ] Merkle Tree — Hash chain for integrity proofs
- [ ] Visitor — Decouple traversal from operations

## Track 2: Concurrency & Scheduling

- [ ] Semaphore — Counter-based concurrency limit
- [ ] Double Buffering — Atomic swap of two buffers
- [ ] Observer — Subscribe/notify decoupling
- [ ] Event Loop — Single-threaded I/O multiplexing
- [ ] Backpressure — Flow control between producer/consumer
- [ ] Copy-on-Write — Share until mutation
- [ ] Cooperative Scheduling — Yield points for responsiveness
- [ ] MVCC — Versioned reads never block writers
- [ ] Work Stealing — Idle threads steal from busy queues
- [ ] Actor Model — Isolated state + message passing

## Track 3: System Reliability

- [ ] Retry with Backoff — Exponential delay + jitter
- [ ] Batch Processing — Amortize per-operation overhead
- [ ] State Machine — Explicit states, impossible transitions blocked
- [ ] Circuit Breaker — Fail fast when service is down
- [ ] Rate Limiter — Token bucket controls throughput
- [ ] Middleware Chain — Composable request handlers
- [ ] Dependency Graph — DAG + topological sort
- [ ] Registry — Self-registration for plugin discovery
- [ ] Consistent Hashing — Minimal remapping on node change
- [ ] Logical Clock — Causal ordering without wall clocks

## Track 4: Storage Engine Internals

- [ ] Tombstone — Mark deleted, compact later
- [ ] Dirty Flag — Skip recomputation if unchanged
- [ ] Iterator — Lazy pull-based traversal
- [ ] Write-Ahead Log — Log before apply for crash safety
- [ ] Checkpointing — Periodic state snapshots
- [ ] Diff / Patch — Minimal change computation
- [ ] LSM Tree — Write-optimized on-disk storage
- [ ] Merge Iterator — K-way merge of sorted streams

## Bonus: Memory Management

- [ ] Reference Counting — Deterministic cleanup at rc=0
- [ ] Object Pool — Pre-allocate and reuse
- [ ] Flyweight — Share identical instances
- [ ] Interning — Hash-based deduplication
- [ ] Free List — O(1) alloc from freed slots
- [ ] Arena Allocator — Bump-allocate, bulk-free
- [ ] Vtable — Function pointers for runtime polymorphism

---

**Progress**: 0 / 46 patterns completed

> **Tip**: After completing all exercises in a track, revisit the [Pattern Connections](https://totoro-jam.github.io/battle-tested-patterns/guide/pattern-connections) page to see how the patterns you've learned compose together in production systems.
