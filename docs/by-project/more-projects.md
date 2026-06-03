# More Projects

Patterns from databases, JVM ecosystem, browsers, and other notable open-source projects.

## Databases & Storage

| Pattern | Project | Where | What It Does |
|---------|---------|-------|--------------|
| [MVCC](/patterns/mvcc/) | PostgreSQL | `heapam_visibility.c` | `HeapTupleSatisfiesMVCC` — snapshot isolation visibility check |
| [Write-Ahead Log](/patterns/write-ahead-log/) | PostgreSQL | `xlog.c` | Transaction WAL for crash recovery, replication, PITR |
| [MVCC](/patterns/mvcc/) | etcd | `kvstore.go` | Multi-version KV store powering Kubernetes config |
| [Write-Ahead Log](/patterns/write-ahead-log/) | etcd | `wal.go` | Raft consensus WAL for distributed state |
| [LRU Cache](/patterns/lru-cache/) | Redis | `evict.c` | Approximated LRU with sampling-based eviction pool |
| [Trie](/patterns/trie/) | Redis | `rax.c` / `rax.h` | RAX radix tree for Streams and sorted key ranges |
| [Skip List](/patterns/skip-list/) | Redis | `t_zset.c` | Sorted set implementation with probabilistic balancing |
| [Bloom Filter](/patterns/bloom-filter/) | LevelDB | `bloom.cc` | Block-level bloom filter to skip unnecessary disk reads |
| [Skip List](/patterns/skip-list/) | LevelDB | `skiplist.h` | Lock-free memtable with atomic next pointers |
| [Arena Allocator](/patterns/arena-allocator/) | LevelDB | `arena.cc` | Block-based arena for memtable allocations |
| [Merge Iterator](/patterns/merge-iterator/) | LevelDB | `merger.cc` | `MergingIterator` merges sorted iterators (memtable + SSTable levels) into single sorted view |
| [LSM Tree](/patterns/lsm-tree/) | LevelDB | `db_impl.cc` | `DBImpl::Write` — batch writes to WAL, insert into memtable, flush to SST on threshold |
| [Merge Iterator](/patterns/merge-iterator/) | RocksDB | `merge_helper.cc` | `TimedFullMerge` combines multiple versions of the same key during compaction |
| [LSM Tree](/patterns/lsm-tree/) | RocksDB | `memtable.cc` | `MemTable::Add` — skip-list backed memtable, flush to L0 SST when full |
| [Merkle Tree](/patterns/merkle-tree/) | ZFS (OpenZFS) | `blkptr.c` | Block pointer checksums form a Merkle tree from data blocks to uberblock for silent corruption detection |
| [Checkpointing](/patterns/checkpointing/) | PostgreSQL | `checkpointer.c` | `CheckpointerMain` — flush dirty buffers, write checkpoint WAL record, update `pg_control` |
| [Checkpointing](/patterns/checkpointing/) | Redis | `rdb.c` | `rdbSaveRio` — fork child process to write point-in-time RDB snapshot without blocking main thread |

## JVM Ecosystem

| Pattern | Project | Where | What It Does |
|---------|---------|-------|--------------|
| [Actor Model](/patterns/actor-model/) | Akka | `Actor.scala` | `trait Actor` — message-driven concurrency for JVM |
| [Circuit Breaker](/patterns/circuit-breaker/) | Netflix Hystrix | `HystrixCircuitBreaker.java` | Three-state circuit breaker for microservice resilience |
| [Batch Processing](/patterns/batch-processing/) | Apache Kafka | `RecordAccumulator.java` | Accumulate records into batches per partition |
| [Work Stealing](/patterns/work-stealing/) | OpenJDK | `ForkJoinPool.java` | `scan` method with randomized work stealing |
| [LRU Cache](/patterns/lru-cache/) | Guava | `CacheBuilder` | `maximumSize()` with LRU eviction |
| [Rate Limiter](/patterns/rate-limiter/) | Guava | `RateLimiter` | Smooth bursty / warm-up token bucket |
| [Consistent Hashing](/patterns/consistent-hashing/) | groupcache | `consistenthash.go` | Hash ring with virtual replicas (by Brad Fitzpatrick) |

## Erlang / BEAM VM

| Pattern | Project | Where | What It Does |
|---------|---------|-------|--------------|
| [Actor Model](/patterns/actor-model/) | Erlang/OTP | `erl_process.h` | BEAM VM process struct — lightweight actor with mailbox |
| [Cooperative Scheduling](/patterns/cooperative-scheduling/) | Erlang/OTP | BEAM scheduler | Reduction-based preemption for millions of processes |
| [Semaphore](/patterns/semaphore/) | Erlang/OTP | `erl_process_lock.c` | Process locks for safe concurrent access |

## Browsers & Web

| Pattern | Project | Where | What It Does |
|---------|---------|-------|--------------|
| [Bloom Filter](/patterns/bloom-filter/) | Chromium | `selector_filter.h` | CSS selector bloom filter — skip 60-70% of rules |
| [Bitmask](/patterns/bitmask/) | React | `ReactFiberFlags.js` | Fiber effect flags — `Placement`, `Update`, `Deletion` |
| [Double Buffering](/patterns/double-buffering/) | React | Fiber architecture | Current tree vs work-in-progress tree swap on commit |
| [Diff / Patch](/patterns/diff-patch/) | React | `ReactChildFiber.js` | List reconciliation with key-based matching |

## Infrastructure & Cloud

| Pattern | Project | Where | What It Does |
|---------|---------|-------|--------------|
| [Retry Backoff](/patterns/retry-backoff/) | Kubernetes | `backoff.go` | Pod restart backoff, API server retries |
| [Retry Backoff](/patterns/retry-backoff/) | gRPC-Go | `internal/backoff/backoff.go` | Exponential connection backoff with jitter |
| [Dependency Graph](/patterns/dependency-graph/) | Terraform | Resource graph | Parallel resource apply with DAG ordering |
| [Dependency Graph](/patterns/dependency-graph/) | Bazel | Action graph | Topological execution of build targets |
| [Consistent Hashing](/patterns/consistent-hashing/) | Nginx | `ngx_http_upstream_hash` | Upstream load balancing with ketama hashing |

## Compilers & Language Runtimes

| Pattern | Project | Where | What It Does |
|---------|---------|-------|--------------|
| [Visitor](/patterns/visitor/) | LLVM | `InstVisitor.h` | CRTP visitor dispatches on IR instruction opcode for optimization passes |
| [Visitor](/patterns/visitor/) | Vue.js | `transforms/vIf.ts` | `transformIf` is a `NodeTransform` visitor that walks the template AST |
| [Vtable](/patterns/vtable/) | CPython | `object.h` | `PyTypeObject` vtable — `tp_repr`, `tp_hash`, `tp_call`, protocol suites |
| [Interning](/patterns/interning/) | CPython | `unicodeobject.c` | `PyUnicode_InternInPlace` — intern identifier strings for O(1) dict lookups |
| [Interning](/patterns/interning/) | Rust (rustc) | `symbol.rs` | `Symbol` is a `u32` index into global interner — all identifiers interned |
| [Tagged Union](/patterns/tagged-union/) | Godot Engine | `variant.h` | `Variant::Type` enum + union — every GDScript value is a `Variant` |
| [Tagged Union](/patterns/tagged-union/) | PyTorch | `ivalue.h` | `IValue` holds a `Tag` enum + `Payload` union for TorchScript interpreter |

## Further Reading

- [PostgreSQL (GitHub)](https://github.com/postgres/postgres) · [Redis (GitHub)](https://github.com/redis/redis) · [LevelDB (GitHub)](https://github.com/google/leveldb)
- [Akka (GitHub)](https://github.com/akka/akka) · [Erlang/OTP (GitHub)](https://github.com/erlang/otp)
- [Kubernetes (GitHub)](https://github.com/kubernetes/kubernetes) · [gRPC (GitHub)](https://github.com/grpc/grpc-go)
