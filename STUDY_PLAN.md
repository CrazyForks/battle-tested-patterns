# Study Plan

> **Fork this repo** and check off patterns as you complete them. Your progress is saved in your fork.
>
> For each pattern: read the doc → try the visualization → complete the exercise → answer the challenge questions.
>
> See the [Learning Paths](https://patterns.totorojam.com/guide/learning-paths) page for recommended order and study tips.

## Track 1: Data Structures Fundamentals

- [ ] [Bitmask](https://patterns.totorojam.com/patterns/bitmask/) — Pack N flags into one integer
- [ ] [Ring Buffer](https://patterns.totorojam.com/patterns/ring-buffer/) — Fixed-size FIFO with zero allocation
- [ ] [Tagged Union](https://patterns.totorojam.com/patterns/tagged-union/) — Type tag for safe dispatch
- [ ] [Min Heap](https://patterns.totorojam.com/patterns/min-heap/) — O(1) access to highest-priority item
- [ ] [Trie](https://patterns.totorojam.com/patterns/trie/) — O(k) lookup by key length
- [ ] [Bloom Filter](https://patterns.totorojam.com/patterns/bloom-filter/) — Probabilistic membership testing
- [ ] [LRU Cache](https://patterns.totorojam.com/patterns/lru-cache/) — Hash map + linked list combo
- [ ] [Skip List](https://patterns.totorojam.com/patterns/skip-list/) — Probabilistic sorted structure
- [ ] [B+ Tree](https://patterns.totorojam.com/patterns/b-plus-tree/) — Disk-optimized balanced tree
- [ ] [Merkle Tree](https://patterns.totorojam.com/patterns/merkle-tree/) — Hash chain for integrity proofs
- [ ] [Visitor](https://patterns.totorojam.com/patterns/visitor/) — Decouple traversal from operations

## Track 2: Concurrency & Scheduling

- [ ] [Semaphore](https://patterns.totorojam.com/patterns/semaphore/) — Counter-based concurrency limit
- [ ] [Double Buffering](https://patterns.totorojam.com/patterns/double-buffering/) — Atomic swap of two buffers
- [ ] [Observer](https://patterns.totorojam.com/patterns/observer/) — Subscribe/notify decoupling
- [ ] [Event Loop](https://patterns.totorojam.com/patterns/event-loop/) — Single-threaded I/O multiplexing
- [ ] [Backpressure](https://patterns.totorojam.com/patterns/backpressure/) — Flow control between producer/consumer
- [ ] [Copy-on-Write](https://patterns.totorojam.com/patterns/copy-on-write/) — Share until mutation
- [ ] [Cooperative Scheduling](https://patterns.totorojam.com/patterns/cooperative-scheduling/) — Yield points for responsiveness
- [ ] [MVCC](https://patterns.totorojam.com/patterns/mvcc/) — Versioned reads never block writers
- [ ] [Work Stealing](https://patterns.totorojam.com/patterns/work-stealing/) — Idle threads steal from busy queues
- [ ] [Actor Model](https://patterns.totorojam.com/patterns/actor-model/) — Isolated state + message passing

## Track 3: System Reliability

- [ ] [Retry with Backoff](https://patterns.totorojam.com/patterns/retry-backoff/) — Exponential delay + jitter
- [ ] [Batch Processing](https://patterns.totorojam.com/patterns/batch-processing/) — Amortize per-operation overhead
- [ ] [State Machine](https://patterns.totorojam.com/patterns/state-machine/) — Explicit states, impossible transitions blocked
- [ ] [Circuit Breaker](https://patterns.totorojam.com/patterns/circuit-breaker/) — Fail fast when service is down
- [ ] [Rate Limiter](https://patterns.totorojam.com/patterns/rate-limiter/) — Token bucket controls throughput
- [ ] [Middleware Chain](https://patterns.totorojam.com/patterns/middleware-chain/) — Composable request handlers
- [ ] [Dependency Graph](https://patterns.totorojam.com/patterns/dependency-graph/) — DAG + topological sort
- [ ] [Registry](https://patterns.totorojam.com/patterns/registry/) — Self-registration for plugin discovery
- [ ] [Consistent Hashing](https://patterns.totorojam.com/patterns/consistent-hashing/) — Minimal remapping on node change
- [ ] [Logical Clock](https://patterns.totorojam.com/patterns/logical-clock/) — Causal ordering without wall clocks

## Track 4: Storage Engine Internals

- [ ] [Tombstone](https://patterns.totorojam.com/patterns/tombstone/) — Mark deleted, compact later
- [ ] [Dirty Flag](https://patterns.totorojam.com/patterns/dirty-flag/) — Skip recomputation if unchanged
- [ ] [Iterator](https://patterns.totorojam.com/patterns/iterator/) — Lazy pull-based traversal
- [ ] [Write-Ahead Log](https://patterns.totorojam.com/patterns/write-ahead-log/) — Log before apply for crash safety
- [ ] [Checkpointing](https://patterns.totorojam.com/patterns/checkpointing/) — Periodic state snapshots
- [ ] [Diff / Patch](https://patterns.totorojam.com/patterns/diff-patch/) — Minimal change computation
- [ ] [LSM Tree](https://patterns.totorojam.com/patterns/lsm-tree/) — Write-optimized on-disk storage
- [ ] [Merge Iterator](https://patterns.totorojam.com/patterns/merge-iterator/) — K-way merge of sorted streams

## Bonus: Memory Management

- [ ] [Reference Counting](https://patterns.totorojam.com/patterns/reference-counting/) — Deterministic cleanup at rc=0
- [ ] [Object Pool](https://patterns.totorojam.com/patterns/object-pool/) — Pre-allocate and reuse
- [ ] [Flyweight](https://patterns.totorojam.com/patterns/flyweight/) — Share identical instances
- [ ] [Interning](https://patterns.totorojam.com/patterns/interning/) — Hash-based deduplication
- [ ] [Free List](https://patterns.totorojam.com/patterns/free-list/) — O(1) alloc from freed slots
- [ ] [Arena Allocator](https://patterns.totorojam.com/patterns/arena-allocator/) — Bump-allocate, bulk-free
- [ ] [Vtable](https://patterns.totorojam.com/patterns/vtable/) — Function pointers for runtime polymorphism

---

**Progress**: 0 / 46 patterns completed

> **Tip**: After completing all exercises in a track, revisit the [Pattern Connections](https://patterns.totorojam.com/guide/pattern-connections) page to see how the patterns you've learned compose together in production systems.
