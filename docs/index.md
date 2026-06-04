---
layout: home
description: "46 battle-tested programming patterns from React, Linux, Go, and Chromium — interactive visualizations, precise source links, multi-language implementations, and runnable exercises."

hero:
  name: Battle-Tested Patterns
  text: Production-Proven Programming Patterns
  tagline: Extracted from React, Linux, Go, Chromium and more. Interactive visualizations, precise source links, multi-language implementations.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/what-is-this
    - theme: alt
      text: Browse Patterns
      link: /patterns/
    - theme: alt
      text: Interview Guide
      link: /guide/interview

features:
  - icon:
      src: /images/interactive_visualizations.png
      width: 80
      height: 80
    title: Interactive Visualizations
    details: Every pattern has a hands-on SVG visualization. Click, drag, and experiment to build intuition — not just read about it.
  - icon:
      src: /images/production_proof.png
      width: 80
      height: 80
    title: Production Proof
    details: Every pattern comes with precise GitHub source links (down to line numbers) proving it's used in real-world projects.
  - icon:
      src: /images/multi-language.png
      width: 80
      height: 80
    title: Multi-Language
    details: Idiomatic implementations in TypeScript, Rust, Go, and Python — not mechanical translations, but native expressions of each pattern.
  - icon:
      src: /images/runnable_exercises.png
      width: 80
      height: 80
    title: Runnable Exercises
    details: Progressive exercises (basic → intermediate → advanced) with test suites you can run locally.
  - icon:
      src: /images/challengequestions.png
      width: 80
      height: 80
    title: Challenge Questions
    details: Each pattern includes 3-4 scenario-based "guess what happens" questions to test real understanding, not just reading.
  - icon:
      src: /images/real_system_case.png
      width: 80
      height: 80
    title: Real System Case Studies
    details: See how React, Redis, Go runtime, Linux, PostgreSQL, and Kafka compose multiple patterns in production.
---

## 46 Patterns in 5 Categories

### Data Structures

| Pattern | Key Insight | Source Projects |
|---------|------------|-----------------|
| [Bitmask](/patterns/bitmask/) | Pack multiple flags into a single integer | React, Linux, Chromium |
| [Min Heap](/patterns/min-heap/) | O(1) access to the highest-priority item | React Scheduler, Linux CFS |
| [Ring Buffer](/patterns/ring-buffer/) | Fixed-size circular queue, zero allocation | LMAX Disruptor, Linux |
| [Trie](/patterns/trie/) | O(k) lookup by key length, shared prefixes | Linux FIB, Redis rax |
| [Skip List](/patterns/skip-list/) | Probabilistic O(log n) sorted structure | Redis, LevelDB |
| [Bloom Filter](/patterns/bloom-filter/) | Probabilistic membership — zero false negatives | LevelDB, Chromium |
| [LRU Cache](/patterns/lru-cache/) | Evict least recently used, O(1) get/put | Go groupcache, Linux |
| [B+ Tree](/patterns/b-plus-tree/) | Leaf-linked balanced tree for range scans | PostgreSQL, SQLite |
| [Tagged Union](/patterns/tagged-union/) | Type tag + union for safe dispatch | Godot, PyTorch |
| [Merkle Tree](/patterns/merkle-tree/) | Hash upward for O(log n) integrity proof | Git, ZFS |
| [Merge Iterator](/patterns/merge-iterator/) | K-way merge of sorted streams via min-heap | LevelDB, RocksDB |

### Concurrency

| Pattern | Key Insight | Source Projects |
|---------|------------|-----------------|
| [Semaphore](/patterns/semaphore/) | Limit concurrent operations with a counter | Linux, Go x/sync |
| [Actor Model](/patterns/actor-model/) | Private state + mailbox, no shared state | Akka, Erlang/OTP |
| [Work Stealing](/patterns/work-stealing/) | Idle threads steal from busy queues | Go runtime, Tokio |
| [MVCC](/patterns/mvcc/) | Versioned reads never block writers | PostgreSQL, etcd |
| [Cooperative Scheduling](/patterns/cooperative-scheduling/) | Yield control to stay responsive | React, Go Runtime |
| [Double Buffering](/patterns/double-buffering/) | Swap two copies for atomic updates | React Fiber, GPU |
| [Backpressure](/patterns/backpressure/) | Slow producers when consumers lag | Node.js Streams, Reactive Streams |
| [Event Loop](/patterns/event-loop/) | Single-threaded I/O multiplexing | libuv, Redis |
| [Logical Clock](/patterns/logical-clock/) | Order events without wall-clock time | etcd, LevelDB |

### System

| Pattern | Key Insight | Source Projects |
|---------|------------|-----------------|
| [Circuit Breaker](/patterns/circuit-breaker/) | Stop calling failing services, fail fast | Netflix Hystrix, gobreaker |
| [Rate Limiter](/patterns/rate-limiter/) | Token bucket controls throughput | Go x/time/rate, Nginx |
| [Retry with Backoff](/patterns/retry-backoff/) | Exponential delay + jitter | Kubernetes, gRPC |
| [Write-Ahead Log](/patterns/write-ahead-log/) | Log before applying for crash recovery | etcd, PostgreSQL |
| [Batch Processing](/patterns/batch-processing/) | Accumulate ops, execute as group | Kafka, React |
| [Consistent Hashing](/patterns/consistent-hashing/) | Add/remove nodes remaps only ~1/n keys | Go groupcache, HAProxy |
| [Dependency Graph](/patterns/dependency-graph/) | DAG + topological sort | Cargo, pnpm |
| [Middleware Chain](/patterns/middleware-chain/) | Composable pre/post handlers | gRPC, Koa.js |
| [Registry](/patterns/registry/) | Self-register by name, discover at runtime | TensorFlow, gRPC |
| [Dirty Flag](/patterns/dirty-flag/) | Recompute only when marked dirty | Chromium, React |
| [LSM Tree](/patterns/lsm-tree/) | Buffer writes, flush to sorted files | LevelDB, RocksDB |
| [Checkpointing](/patterns/checkpointing/) | Snapshot state, recover from checkpoint | PostgreSQL, Redis |

### Memory

| Pattern | Key Insight | Source Projects |
|---------|------------|-----------------|
| [Object Pool](/patterns/object-pool/) | Pre-allocate and reuse to avoid GC | Go sync.Pool, Godot |
| [Flyweight](/patterns/flyweight/) | Share identical objects across users | Python int cache, V8 |
| [Arena Allocator](/patterns/arena-allocator/) | Bump-allocate in region, free all at once | Rust bumpalo, Go |
| [Free List](/patterns/free-list/) | O(1) alloc/free via linked freed slots | Go runtime, Linux SLUB |
| [Copy-on-Write](/patterns/copy-on-write/) | Share by reference, copy on mutation | Git, Rust Cow |
| [Reference Counting](/patterns/reference-counting/) | Auto-cleanup at zero owners | CPython, Rust Arc |
| [Tombstone](/patterns/tombstone/) | Mark deleted, reclaim later | LevelDB, Cassandra |
| [Interning](/patterns/interning/) | Deduplicate values, O(1) equality | Rust compiler, CPython |

### Behavioral

| Pattern | Key Insight | Source Projects |
|---------|------------|-----------------|
| [State Machine](/patterns/state-machine/) | Explicit states, impossible transitions unrepresentable | XState, Linux TCP |
| [Observer](/patterns/observer/) | Subscribe to events, decouple producers | Node EventEmitter, Redux |
| [Iterator](/patterns/iterator/) | Lazy sequences, zero intermediate allocations | Rust Iterator, Python |
| [Diff / Patch](/patterns/diff-patch/) | Compute minimal changes between states | React Reconciler, Git |
| [Vtable](/patterns/vtable/) | Function pointer struct for polymorphism | Linux kernel, CPython |
| [Visitor](/patterns/visitor/) | Dispatch type-specific callbacks on trees | LLVM, Vue compiler |
