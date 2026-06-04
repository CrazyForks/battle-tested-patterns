---
description: "Find the right pattern by scenario — web APIs, databases, distributed systems, frontend, compilers, and more."
---

# Use Cases

Find patterns by the kind of system you're building.

## Web APIs & Microservices

Building a REST/gRPC service? These patterns keep it reliable under load.

| Scenario | Patterns | Real Example |
|---|---|---|
| Protect against downstream outages | [Circuit Breaker](/patterns/circuit-breaker/) + [Retry with Backoff](/patterns/retry-backoff/) | Netflix Hystrix wraps every HTTP client call |
| API rate limiting | [Rate Limiter](/patterns/rate-limiter/) | Stripe allows burst of 25, refills at 25/sec |
| Request middleware (auth, logging, tracing) | [Middleware Chain](/patterns/middleware-chain/) | gRPC interceptors, Koa.js onion model |
| Service discovery | [Registry](/patterns/registry/) | Consul, etcd service registration |
| Load distribution across nodes | [Consistent Hashing](/patterns/consistent-hashing/) | HAProxy, groupcache key distribution |
| Prevent overload | [Backpressure](/patterns/backpressure/) + [Batch Processing](/patterns/batch-processing/) | Node.js stream piping, Kafka consumer groups |

## Databases & Storage

The patterns behind PostgreSQL, Redis, LevelDB, and every serious storage engine.

| Scenario | Patterns | Real Example |
|---|---|---|
| Crash recovery | [WAL](/patterns/write-ahead-log/) + [Checkpointing](/patterns/checkpointing/) | PostgreSQL: WAL + periodic checkpoint |
| Write-heavy workload | [LSM Tree](/patterns/lsm-tree/) + [Bloom Filter](/patterns/bloom-filter/) | LevelDB/RocksDB: memtable → SSTable + bloom skip |
| Range queries on disk | [B+ Tree](/patterns/b-plus-tree/) | PostgreSQL btree index, SQLite |
| Concurrent reads/writes | [MVCC](/patterns/mvcc/) | PostgreSQL tuple versioning, etcd revisions |
| Data integrity verification | [Merkle Tree](/patterns/merkle-tree/) | ZFS block checksums, Git object store |
| Sorted key merge | [Merge Iterator](/patterns/merge-iterator/) + [Min Heap](/patterns/min-heap/) | LevelDB compaction |
| Delete without immediate removal | [Tombstone](/patterns/tombstone/) | Cassandra tombstones, LevelDB deletion markers |
| In-memory cache | [LRU Cache](/patterns/lru-cache/) | Redis LRU eviction, Go groupcache |
| Event ordering without clocks | [Logical Clock](/patterns/logical-clock/) | etcd Raft log, DynamoDB version vectors |

## Frontend & UI Frameworks

React, Vue, and browser engines use these patterns every frame.

| Scenario | Patterns | Real Example |
|---|---|---|
| Virtual DOM diffing | [Diff / Patch](/patterns/diff-patch/) + [Bitmask](/patterns/bitmask/) | React reconciler: diff tree, apply minimal patches |
| Responsive rendering | [Cooperative Scheduling](/patterns/cooperative-scheduling/) | React Scheduler: yield every 5ms to stay under 16ms |
| Frame-safe state updates | [Double Buffering](/patterns/double-buffering/) | React Fiber: workInProgress ↔ current tree swap |
| Avoid unnecessary re-renders | [Dirty Flag](/patterns/dirty-flag/) | React shouldComponentUpdate, Chromium layout |
| State management | [Observer](/patterns/observer/) + [State Machine](/patterns/state-machine/) | Redux subscribe, XState finite states |
| Priority-based task scheduling | [Min Heap](/patterns/min-heap/) | React Scheduler priority queue |

## Distributed Systems

Patterns for systems that span multiple machines.

| Scenario | Patterns | Real Example |
|---|---|---|
| Consensus log | [WAL](/patterns/write-ahead-log/) + [Logical Clock](/patterns/logical-clock/) | etcd Raft: append-only log with term/index |
| Partition-tolerant routing | [Consistent Hashing](/patterns/consistent-hashing/) | Amazon DynamoDB, Cassandra ring |
| Replicated state | [State Machine](/patterns/state-machine/) + [WAL](/patterns/write-ahead-log/) | Raft: replicated state machine via log |
| Conflict-free replication | [Logical Clock](/patterns/logical-clock/) + [Tombstone](/patterns/tombstone/) | CRDTs, Dynamo-style last-write-wins |
| Data synchronization | [Merkle Tree](/patterns/merkle-tree/) | Cassandra anti-entropy repair |
| Message-driven architecture | [Actor Model](/patterns/actor-model/) + [Backpressure](/patterns/backpressure/) | Akka cluster, Erlang/OTP |
| Build/deploy pipelines | [Dependency Graph](/patterns/dependency-graph/) + [Batch Processing](/patterns/batch-processing/) | Cargo build graph, pnpm workspace |

## Runtime & Memory Management

How Go, CPython, V8, and game engines manage memory and execution.

| Scenario | Patterns | Real Example |
|---|---|---|
| Reduce GC pressure | [Object Pool](/patterns/object-pool/) + [Free List](/patterns/free-list/) | Go sync.Pool, Linux SLUB allocator |
| Phase-based allocation | [Arena Allocator](/patterns/arena-allocator/) | Rust bumpalo, Go arena (experimental) |
| Deterministic cleanup | [Reference Counting](/patterns/reference-counting/) | CPython refcount, Rust Rc/Arc |
| String deduplication | [Interning](/patterns/interning/) + [Flyweight](/patterns/flyweight/) | Rust compiler symbol interning, Python small int cache |
| Efficient cloning | [Copy-on-Write](/patterns/copy-on-write/) | Linux fork(), Rust `Cow<T>` |
| Work distribution across cores | [Work Stealing](/patterns/work-stealing/) | Go runtime P/M/G scheduler, Tokio |
| I/O multiplexing | [Event Loop](/patterns/event-loop/) + [Ring Buffer](/patterns/ring-buffer/) | libuv (Node.js), Redis single-thread |
| Thread-safe counters | [Semaphore](/patterns/semaphore/) | Linux kernel semaphores, Go x/sync |

## Compilers & Language Tools

Patterns used in LLVM, V8, rustc, and the Vue/React compilers.

| Scenario | Patterns | Real Example |
|---|---|---|
| AST traversal | [Visitor](/patterns/visitor/) | LLVM InstVisitor, Vue compiler transforms |
| Dynamic dispatch | [Vtable](/patterns/vtable/) | CPython tp_* slots, Rust dyn Trait |
| Symbol tables | [Interning](/patterns/interning/) + [Trie](/patterns/trie/) | rustc Symbol interning |
| IR transformations | [Iterator](/patterns/iterator/) + [Diff / Patch](/patterns/diff-patch/) | Rust Iterator adapters, tree-sitter edits |
| Type representation | [Tagged Union](/patterns/tagged-union/) | V8 tagged pointers, PyTorch TensorImpl |
| Plugin systems | [Registry](/patterns/registry/) + [Middleware Chain](/patterns/middleware-chain/) | Babel plugins, webpack loaders |

## Networking & Protocols

| Scenario | Patterns | Real Example |
|---|---|---|
| Connection state tracking | [State Machine](/patterns/state-machine/) | Linux TCP state machine (SYN_SENT → ESTABLISHED → ...) |
| IP routing | [Trie](/patterns/trie/) | Linux LC-trie for IPv4 FIB |
| Packet buffering | [Ring Buffer](/patterns/ring-buffer/) | Linux sk_buff, DPDK ring |
| Flow control | [Backpressure](/patterns/backpressure/) + [Rate Limiter](/patterns/rate-limiter/) | TCP flow control, Nginx limit_req |
| DNS resolution | [Trie](/patterns/trie/) + [LRU Cache](/patterns/lru-cache/) | Domain name lookup + response cache |
