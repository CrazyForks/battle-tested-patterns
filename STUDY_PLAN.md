# Study Plan

> **Fork this repo** and check off patterns as you complete them. Your progress is saved in your fork.
>
> For each pattern: read the doc → try the visualization → complete the exercise → answer the challenge questions.
>
> See the [Learning Paths](https://totoro-jam.github.io/battle-tested-patterns/guide/learning-paths) page for recommended order and study tips.

## Track 1: Data Structures Fundamentals

- [ ] [Bitmask](https://totoro-jam.github.io/battle-tested-patterns/patterns/bitmask/) — Pack N flags into one integer
- [ ] [Ring Buffer](https://totoro-jam.github.io/battle-tested-patterns/patterns/ring-buffer/) — Fixed-size FIFO with zero allocation
- [ ] [Tagged Union](https://totoro-jam.github.io/battle-tested-patterns/patterns/tagged-union/) — Type tag for safe dispatch
- [ ] [Min Heap](https://totoro-jam.github.io/battle-tested-patterns/patterns/min-heap/) — O(1) access to highest-priority item
- [ ] [Trie](https://totoro-jam.github.io/battle-tested-patterns/patterns/trie/) — O(k) lookup by key length
- [ ] [Bloom Filter](https://totoro-jam.github.io/battle-tested-patterns/patterns/bloom-filter/) — Probabilistic membership testing
- [ ] [LRU Cache](https://totoro-jam.github.io/battle-tested-patterns/patterns/lru-cache/) — Hash map + linked list combo
- [ ] [Skip List](https://totoro-jam.github.io/battle-tested-patterns/patterns/skip-list/) — Probabilistic sorted structure
- [ ] [B+ Tree](https://totoro-jam.github.io/battle-tested-patterns/patterns/b-plus-tree/) — Disk-optimized balanced tree
- [ ] [Merkle Tree](https://totoro-jam.github.io/battle-tested-patterns/patterns/merkle-tree/) — Hash chain for integrity proofs
- [ ] [Visitor](https://totoro-jam.github.io/battle-tested-patterns/patterns/visitor/) — Decouple traversal from operations

## Track 2: Concurrency & Scheduling

- [ ] [Semaphore](https://totoro-jam.github.io/battle-tested-patterns/patterns/semaphore/) — Counter-based concurrency limit
- [ ] [Double Buffering](https://totoro-jam.github.io/battle-tested-patterns/patterns/double-buffering/) — Atomic swap of two buffers
- [ ] [Observer](https://totoro-jam.github.io/battle-tested-patterns/patterns/observer/) — Subscribe/notify decoupling
- [ ] [Event Loop](https://totoro-jam.github.io/battle-tested-patterns/patterns/event-loop/) — Single-threaded I/O multiplexing
- [ ] [Backpressure](https://totoro-jam.github.io/battle-tested-patterns/patterns/backpressure/) — Flow control between producer/consumer
- [ ] [Copy-on-Write](https://totoro-jam.github.io/battle-tested-patterns/patterns/copy-on-write/) — Share until mutation
- [ ] [Cooperative Scheduling](https://totoro-jam.github.io/battle-tested-patterns/patterns/cooperative-scheduling/) — Yield points for responsiveness
- [ ] [MVCC](https://totoro-jam.github.io/battle-tested-patterns/patterns/mvcc/) — Versioned reads never block writers
- [ ] [Work Stealing](https://totoro-jam.github.io/battle-tested-patterns/patterns/work-stealing/) — Idle threads steal from busy queues
- [ ] [Actor Model](https://totoro-jam.github.io/battle-tested-patterns/patterns/actor-model/) — Isolated state + message passing

## Track 3: System Reliability

- [ ] [Retry with Backoff](https://totoro-jam.github.io/battle-tested-patterns/patterns/retry-backoff/) — Exponential delay + jitter
- [ ] [Batch Processing](https://totoro-jam.github.io/battle-tested-patterns/patterns/batch-processing/) — Amortize per-operation overhead
- [ ] [State Machine](https://totoro-jam.github.io/battle-tested-patterns/patterns/state-machine/) — Explicit states, impossible transitions blocked
- [ ] [Circuit Breaker](https://totoro-jam.github.io/battle-tested-patterns/patterns/circuit-breaker/) — Fail fast when service is down
- [ ] [Rate Limiter](https://totoro-jam.github.io/battle-tested-patterns/patterns/rate-limiter/) — Token bucket controls throughput
- [ ] [Middleware Chain](https://totoro-jam.github.io/battle-tested-patterns/patterns/middleware-chain/) — Composable request handlers
- [ ] [Dependency Graph](https://totoro-jam.github.io/battle-tested-patterns/patterns/dependency-graph/) — DAG + topological sort
- [ ] [Registry](https://totoro-jam.github.io/battle-tested-patterns/patterns/registry/) — Self-registration for plugin discovery
- [ ] [Consistent Hashing](https://totoro-jam.github.io/battle-tested-patterns/patterns/consistent-hashing/) — Minimal remapping on node change
- [ ] [Logical Clock](https://totoro-jam.github.io/battle-tested-patterns/patterns/logical-clock/) — Causal ordering without wall clocks

## Track 4: Storage Engine Internals

- [ ] [Tombstone](https://totoro-jam.github.io/battle-tested-patterns/patterns/tombstone/) — Mark deleted, compact later
- [ ] [Dirty Flag](https://totoro-jam.github.io/battle-tested-patterns/patterns/dirty-flag/) — Skip recomputation if unchanged
- [ ] [Iterator](https://totoro-jam.github.io/battle-tested-patterns/patterns/iterator/) — Lazy pull-based traversal
- [ ] [Write-Ahead Log](https://totoro-jam.github.io/battle-tested-patterns/patterns/write-ahead-log/) — Log before apply for crash safety
- [ ] [Checkpointing](https://totoro-jam.github.io/battle-tested-patterns/patterns/checkpointing/) — Periodic state snapshots
- [ ] [Diff / Patch](https://totoro-jam.github.io/battle-tested-patterns/patterns/diff-patch/) — Minimal change computation
- [ ] [LSM Tree](https://totoro-jam.github.io/battle-tested-patterns/patterns/lsm-tree/) — Write-optimized on-disk storage
- [ ] [Merge Iterator](https://totoro-jam.github.io/battle-tested-patterns/patterns/merge-iterator/) — K-way merge of sorted streams

## Bonus: Memory Management

- [ ] [Reference Counting](https://totoro-jam.github.io/battle-tested-patterns/patterns/reference-counting/) — Deterministic cleanup at rc=0
- [ ] [Object Pool](https://totoro-jam.github.io/battle-tested-patterns/patterns/object-pool/) — Pre-allocate and reuse
- [ ] [Flyweight](https://totoro-jam.github.io/battle-tested-patterns/patterns/flyweight/) — Share identical instances
- [ ] [Interning](https://totoro-jam.github.io/battle-tested-patterns/patterns/interning/) — Hash-based deduplication
- [ ] [Free List](https://totoro-jam.github.io/battle-tested-patterns/patterns/free-list/) — O(1) alloc from freed slots
- [ ] [Arena Allocator](https://totoro-jam.github.io/battle-tested-patterns/patterns/arena-allocator/) — Bump-allocate, bulk-free
- [ ] [Vtable](https://totoro-jam.github.io/battle-tested-patterns/patterns/vtable/) — Function pointers for runtime polymorphism

---

**Progress**: 0 / 46 patterns completed

> **Tip**: After completing all exercises in a track, revisit the [Pattern Connections](https://totoro-jam.github.io/battle-tested-patterns/guide/pattern-connections) page to see how the patterns you've learned compose together in production systems.
