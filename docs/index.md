---
layout: home

hero:
  name: Battle-Tested Patterns
  text: Production-Proven Programming Patterns
  tagline: Extracted from React, Linux, Go, Chromium and more. Precise source links, multi-language examples, runnable exercises.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/what-is-this
    - theme: alt
      text: Browse Patterns
      link: /patterns/bitmask/

features:
  - icon: 🔗
    title: Production Proof
    details: Every pattern comes with precise GitHub source links (down to line numbers) proving it's used in real-world projects.
  - icon: 🌍
    title: Multi-Language
    details: Idiomatic implementations in TypeScript, Rust, Go, and C — not mechanical translations, but native expressions of each pattern.
  - icon: 🧪
    title: Runnable Exercises
    details: Progressive exercises (basic → intermediate → advanced) with test suites you can run locally.
  - icon: 🧠
    title: Challenge Questions
    details: Each pattern includes 3-4 scenario-based "guess what happens" questions to test real understanding, not just reading.
  - icon: 🔀
    title: Real System Case Studies
    details: See how React, Redis, Go runtime, Linux, PostgreSQL, and Kafka compose multiple patterns in production.
---

## Patterns

| Pattern | Key Insight | Source Projects |
|---------|------------|-----------------|
| [Bitmask](/patterns/bitmask/) | Pack multiple flags into a single integer | React, Linux, Chromium |
| [Double Buffering](/patterns/double-buffering/) | Swap between two copies for atomic updates | React Fiber, GPU, PostgreSQL |
| [Cooperative Scheduling](/patterns/cooperative-scheduling/) | Voluntarily yield control to stay responsive | React, Go Runtime |
| [Min Heap](/patterns/min-heap/) | O(1) access to the highest-priority item | React Scheduler, Linux CFS, Node.js |
| [Diff / Patch](/patterns/diff-patch/) | Compute minimal changes between two states | React Reconciler, Git |
| [Object Pool](/patterns/object-pool/) | Pre-allocate and reuse objects to avoid GC | Go sync.Pool, Godot Engine |
| [Ring Buffer](/patterns/ring-buffer/) | Fixed-size circular queue, zero allocation | LMAX Disruptor, Linux ftrace |
| [State Machine](/patterns/state-machine/) | Explicit states + transitions, impossible states unrepresentable | XState, Linux TCP |
| [Copy-on-Write](/patterns/copy-on-write/) | Share by reference, copy only on mutation | Git objects, Rust Cow |
| [Observer / Pub-Sub](/patterns/observer/) | Subscribe to events, get notified without coupling | Node EventEmitter, Redux |
| [Iterator / Lazy Eval](/patterns/iterator/) | Process sequences lazily, zero intermediate allocations | Rust Iterator, Python generators |
| [Semaphore](/patterns/semaphore/) | Limit concurrent operations with a counter | Linux kernel, Go x/sync |
| [Batch Processing](/patterns/batch-processing/) | Accumulate ops, execute as a group for throughput | Kafka RecordAccumulator, React batched setState |
| [Retry with Backoff](/patterns/retry-backoff/) | Retry with exponential delay + jitter | Kubernetes, gRPC |
| [Flyweight / Interning](/patterns/flyweight/) | Share identical objects, avoid duplicate allocations | Python int cache, V8 |
| [Bloom Filter](/patterns/bloom-filter/) | Probabilistic set membership — zero false negatives | LevelDB, Chromium Blink |
| [Circuit Breaker](/patterns/circuit-breaker/) | Stop calling failing services, fail fast | Netflix Hystrix, Sony gobreaker |
| [Arena Allocator](/patterns/arena-allocator/) | Bump-allocate in a region, free all at once | Rust bumpalo, jemalloc |
| [Backpressure](/patterns/backpressure/) | Slow producers when consumers can't keep up | Node.js Streams, Reactive Streams |
| [Write-Ahead Log](/patterns/write-ahead-log/) | Log mutations before applying for crash recovery | etcd, PostgreSQL |
| [LRU Cache](/patterns/lru-cache/) | Evict least recently used, O(1) get and put | Go groupcache, Linux kernel |
| [Consistent Hashing](/patterns/consistent-hashing/) | Add/remove nodes remaps only ~1/n keys | Go groupcache, HAProxy |
| [Trie (Prefix Tree)](/patterns/trie/) | O(k) lookup by key length, shared prefixes share nodes | Linux FIB, Redis rax |
| [Skip List](/patterns/skip-list/) | Probabilistic O(log n) sorted structure | Redis sorted sets, LevelDB |
| [Rate Limiter](/patterns/rate-limiter/) | Token bucket controls throughput with burst capacity | Go x/time/rate, Nginx |
| [Work Stealing](/patterns/work-stealing/) | Idle threads steal tasks from busy threads' queues | Go runtime, Tokio |
| [MVCC](/patterns/mvcc/) | Timestamped versions let readers never block writers | PostgreSQL, etcd |
| [Free List](/patterns/free-list/) | Linked list of freed slots for O(1) alloc/free | Go runtime, Linux SLUB |
| [Dependency Graph](/patterns/dependency-graph/) | DAG + topological sort for valid execution order | Cargo, pnpm |
| [Actor Model](/patterns/actor-model/) | Private state + mailbox, no shared state, just messages | Akka, Erlang/OTP |
| [Reference Counting](/patterns/reference-counting/) | Auto-cleanup at zero owners, deterministic lifetime | CPython, Rust Arc |
| [Logical Clock](/patterns/logical-clock/) | Monotonic counter orders events without wall-clock time | etcd, LevelDB |
| [Event Loop](/patterns/event-loop/) | Single-threaded I/O multiplexing via epoll/kqueue | libuv, Redis |
| [Middleware Chain](/patterns/middleware-chain/) | Composable handlers: pre-process, call next, post-process | gRPC, Koa.js |
