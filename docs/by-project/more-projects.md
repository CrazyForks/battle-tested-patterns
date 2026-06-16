---
title: "More Projects"
description: "Additional patterns from PostgreSQL, Redis, Kafka, LLVM, Chromium, V8, and other open-source projects."
---

# More Projects

Patterns from databases, JVM ecosystem, browsers, and other notable open-source projects.

## Databases & Storage

| Pattern | Project | Where | What It Does |
|---------|---------|-------|--------------|
| [MVCC](/patterns/mvcc/) | PostgreSQL | [`heapam_visibility.c`](https://github.com/postgres/postgres/blob/e18b0cb7344cb4bd28468f6c0aeeb9b9241d30aa/src/backend/access/heap/heapam_visibility.c#L917-L1096) | `HeapTupleSatisfiesMVCC` — snapshot isolation visibility check |
| [Write-Ahead Log](/patterns/write-ahead-log/) | PostgreSQL | [`xlog.c`](https://github.com/postgres/postgres/blob/e18b0cb7344cb4bd28468f6c0aeeb9b9241d30aa/src/backend/access/transam/xlog.c#L783-L1128) | Transaction WAL for crash recovery, replication, PITR |
| [MVCC](/patterns/mvcc/) | etcd | [`kvstore.go`](https://github.com/etcd-io/etcd/blob/e9b62f804766edf77cfa918d600cb6fb2c56b401/server/storage/mvcc/kvstore.go#L53-L135) | Multi-version KV store powering Kubernetes config |
| [Write-Ahead Log](/patterns/write-ahead-log/) | etcd | [`wal.go`](https://github.com/etcd-io/etcd/blob/e9b62f804766edf77cfa918d600cb6fb2c56b401/server/storage/wal/wal.go#L72-L95) | Raft consensus WAL for distributed state |
| [LRU Cache](/patterns/lru-cache/) | Redis | [`evict.c`](https://github.com/redis/redis/blob/df63a65d4d4ee33ae67e9f101885074febe0bccb/src/evict.c#L55-L83) | Approximated LRU with sampling-based eviction pool |
| [Trie](/patterns/trie/) | Redis | [`rax.c` / `rax.h`](https://github.com/redis/redis/blob/df63a65d4d4ee33ae67e9f101885074febe0bccb/src/rax.h#L80-L130) | RAX radix tree for Streams and sorted key ranges |
| [Skip List](/patterns/skip-list/) | Redis | [`t_zset.c`](https://github.com/redis/redis/blob/df63a65d4d4ee33ae67e9f101885074febe0bccb/src/t_zset.c#L70-L130) | Sorted set implementation with probabilistic balancing |
| [Bloom Filter](/patterns/bloom-filter/) | LevelDB | [`bloom.cc`](https://github.com/google/leveldb/blob/7ee830d02b623e8ffe0b95d59a74db1e58da04c5/util/bloom.cc#L17-L80) | Block-level bloom filter to skip unnecessary disk reads |
| [Skip List](/patterns/skip-list/) | LevelDB | [`skiplist.h`](https://github.com/google/leveldb/blob/7ee830d02b623e8ffe0b95d59a74db1e58da04c5/db/skiplist.h#L40-L90) | Lock-free memtable with atomic next pointers |
| [Arena Allocator](/patterns/arena-allocator/) | LevelDB | [`arena.cc`](https://github.com/google/leveldb/blob/7ee830d02b623e8ffe0b95d59a74db1e58da04c5/util/arena.cc) | Block-based arena for memtable allocations |
| [Merge Iterator](/patterns/merge-iterator/) | LevelDB | [`merger.cc`](https://github.com/google/leveldb/blob/7ee830d02b623e8ffe0b95d59a74db1e58da04c5/table/merger.cc#L17-L100) | `MergingIterator` merges sorted iterators (memtable + SSTable levels) into single sorted view |
| [LSM Tree](/patterns/lsm-tree/) | LevelDB | [`db_impl.cc`](https://github.com/google/leveldb/blob/7ee830d02b623e8ffe0b95d59a74db1e58da04c5/db/db_impl.cc#L1241-L1368) | `DBImpl::Write` — batch writes to WAL, insert into memtable, flush to SST on threshold |
| [Merge Iterator](/patterns/merge-iterator/) | RocksDB | [`merge_helper.cc`](https://github.com/facebook/rocksdb/blob/7affaee1c49ebc80cb213ad86fe7d2a3ad447da2/db/merge_helper.cc#L87-L156) | `TimedFullMerge` combines multiple versions of the same key during compaction |
| [LSM Tree](/patterns/lsm-tree/) | RocksDB | [`memtable.cc`](https://github.com/facebook/rocksdb/blob/7affaee1c49ebc80cb213ad86fe7d2a3ad447da2/db/memtable.cc#L458-L534) | `MemTable::Add` — skip-list backed memtable, flush to L0 SST when full |
| [B+ Tree](/patterns/b-plus-tree/) | PostgreSQL | [`nbtinsert.c`](https://github.com/postgres/postgres/blob/e18b0cb7344cb4bd28468f6c0aeeb9b9241d30aa/src/backend/access/nbtree/nbtinsert.c#L22-L55) | B-link tree (Lehman-Yao variant) — all tables and indexes backed by B+ trees on disk pages |
| [B+ Tree](/patterns/b-plus-tree/) | SQLite | [`btreeInt.h`](https://github.com/sqlite/sqlite/blob/2cb57d9d4ac7eac3b1d15cfa71511f54817cb3e4/src/btreeInt.h#L190-L198) | Interior cells hold child page pointers + keys; leaf cells hold payloads. Page splitting via `balance_nonroot()` |
| [Merkle Tree](/patterns/merkle-tree/) | ZFS (OpenZFS) | [`blkptr.c`](https://github.com/openzfs/zfs/blob/7e054b2e7ea80c7c838f7fd44b7d517eea5c9d18/module/zfs/blkptr.c#L30-L77) | Block pointer checksums form a Merkle tree from data blocks to uberblock for silent corruption detection |
| [Checkpointing](/patterns/checkpointing/) | PostgreSQL | [`checkpointer.c`](https://github.com/postgres/postgres/blob/e18b0cb7344cb4bd28468f6c0aeeb9b9241d30aa/src/backend/postmaster/checkpointer.c#L218-L360) | `CheckpointerMain` — flush dirty buffers, write checkpoint WAL record, update `pg_control` |
| [Checkpointing](/patterns/checkpointing/) | Redis | [`rdb.c`](https://github.com/redis/redis/blob/df63a65d4d4ee33ae67e9f101885074febe0bccb/src/rdb.c#L1414-L1529) | `rdbSaveRio` — fork child process to write point-in-time RDB snapshot without blocking main thread |

## JVM Ecosystem

| Pattern | Project | Where | What It Does |
|---------|---------|-------|--------------|
| [Actor Model](/patterns/actor-model/) | Akka | [`Actor.scala`](https://github.com/akka/akka-core/blob/aded7b67a9dafcb32b8a5dc95f6debce3a97c0e9/akka-actor/src/main/scala/akka/actor/Actor.scala#L476-L547) | `trait Actor` — message-driven concurrency for JVM |
| [Circuit Breaker](/patterns/circuit-breaker/) | Netflix Hystrix | [`HystrixCircuitBreaker.java`](https://github.com/Netflix/Hystrix/blob/5ce3bc58c38e7ca60ef2fe0e516e390e294ad941/hystrix-core/src/main/java/com/netflix/hystrix/HystrixCircuitBreaker.java#L138-L289) | Three-state circuit breaker for microservice resilience |
| [Batch Processing](/patterns/batch-processing/) | Apache Kafka | [`RecordAccumulator.java`](https://github.com/apache/kafka/blob/b7b1c0a83d856766390ee0c05e33b63711eee80e/clients/src/main/java/org/apache/kafka/clients/producer/internals/RecordAccumulator.java#L69-L120) | Accumulate records into batches per partition |
| [Work Stealing](/patterns/work-stealing/) | OpenJDK | [`ForkJoinPool.java`](https://github.com/openjdk/jdk/blob/4b3ec455c85314d051800a8f46dd8f5c93881e3a/src/java.base/share/classes/java/util/concurrent/ForkJoinPool.java) | `scan` method with randomized work stealing |
| [LRU Cache](/patterns/lru-cache/) | Guava | [`CacheBuilder`](https://github.com/google/guava/blob/3e65944ec9207ca652128969fd1334e9920dde07/guava/src/com/google/common/cache/CacheBuilder.java) | `maximumSize()` with LRU eviction |
| [Rate Limiter](/patterns/rate-limiter/) | Guava | [`RateLimiter`](https://github.com/google/guava/blob/3e65944ec9207ca652128969fd1334e9920dde07/guava/src/com/google/common/util/concurrent/RateLimiter.java) | Smooth bursty / warm-up token bucket |
| [Consistent Hashing](/patterns/consistent-hashing/) | groupcache | [`consistenthash.go`](https://github.com/golang/groupcache/blob/2c02b8208cf8c02a3e358cb1d9b60950647543fc/consistenthash/consistenthash.go#L28-L81) | Hash ring with virtual replicas (by Brad Fitzpatrick) |

## Erlang / BEAM VM

| Pattern | Project | Where | What It Does |
|---------|---------|-------|--------------|
| [Actor Model](/patterns/actor-model/) | Erlang/OTP | [`erl_process.h`](https://github.com/erlang/otp/blob/c75602432b4eff922bcaf4a175144dc61adbd6d6/erts/emulator/beam/erl_process.h#L1043-L1205) | BEAM VM process struct — lightweight actor with mailbox |
| [Cooperative Scheduling](/patterns/cooperative-scheduling/) | Erlang/OTP | [BEAM scheduler](https://github.com/erlang/otp/blob/c75602432b4eff922bcaf4a175144dc61adbd6d6/erts/emulator/beam/erl_process.c) | Reduction-based preemption for millions of processes |
| [Semaphore](/patterns/semaphore/) | Erlang/OTP | [`erl_process_lock.c`](https://github.com/erlang/otp/blob/c75602432b4eff922bcaf4a175144dc61adbd6d6/erts/emulator/beam/erl_process_lock.c) | Process locks for safe concurrent access |

## Browsers & Web

| Pattern | Project | Where | What It Does |
|---------|---------|-------|--------------|
| [Bloom Filter](/patterns/bloom-filter/) | Chromium | [`selector_filter.h`](https://github.com/chromium/chromium/blob/5cffea3f665b7762369a0fa84d2f208875e7225e/third_party/blink/renderer/core/css/selector_filter.h#L149-L175) | CSS selector bloom filter — skip 60-70% of rules |
| [Bitmask](/patterns/bitmask/) | React | [`ReactFiberFlags.js`](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/react-reconciler/src/ReactFiberFlags.js#L14-L36) | Fiber effect flags — `Placement`, `Update`, `Deletion` |
| [Double Buffering](/patterns/double-buffering/) | React | [Fiber architecture](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/react-reconciler/src/ReactFiber.js#L327-L355) | Current tree vs work-in-progress tree swap on commit |
| [Diff / Patch](/patterns/diff-patch/) | React | [`ReactChildFiber.js`](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/react-reconciler/src/ReactChildFiber.js#L1169-L1340) | List reconciliation with key-based matching |

## Infrastructure & Cloud

| Pattern | Project | Where | What It Does |
|---------|---------|-------|--------------|
| [Retry Backoff](/patterns/retry-backoff/) | Kubernetes | [`backoff.go`](https://github.com/kubernetes/kubernetes/blob/586cc904093af4fe7492e564908a796f0b107f97/staging/src/k8s.io/apimachinery/pkg/util/wait/backoff.go#L30-L50) | Pod restart backoff, API server retries |
| [Retry Backoff](/patterns/retry-backoff/) | gRPC-Go | [`internal/backoff/backoff.go`](https://github.com/grpc/grpc-go/blob/f1864955bbb48efa131f6652933fa8b2189d9305/internal/backoff/backoff.go#L56-L75) | Exponential connection backoff with jitter |
| [Dependency Graph](/patterns/dependency-graph/) | Terraform | [Resource graph](https://github.com/hashicorp/terraform) | Parallel resource apply with DAG ordering |
| [Dependency Graph](/patterns/dependency-graph/) | Bazel | [Action graph](https://github.com/bazelbuild/bazel) | Topological execution of build targets |
| [Registry](/patterns/registry/) | gRPC-Go | [`server.go`](https://github.com/grpc/grpc-go/blob/f1864955bbb48efa131f6652933fa8b2189d9305/server.go#L154-L170) | `RegisterService` adds service descriptions to the server's service map for RPC method dispatch |
| [Registry](/patterns/registry/) | TensorFlow | [`op.h`](https://github.com/tensorflow/tensorflow/blob/b4c7e9a660badf8c8c81075fe9f781d23ed6f28a/tensorflow/core/framework/op.h#L258-L290) | `REGISTER_OP` macro registers operations into the global `OpRegistry` for computation graph building |
| [Consistent Hashing](/patterns/consistent-hashing/) | Nginx | [`ngx_http_upstream_hash`](https://github.com/nginx/nginx/blob/d994f5b8220847eb8f7e4400be5f7e6eb4538e46/src/http/modules/ngx_http_upstream_hash_module.c) | Upstream load balancing with ketama hashing |

## Compilers & Language Runtimes

| Pattern | Project | Where | What It Does |
|---------|---------|-------|--------------|
| [Visitor](/patterns/visitor/) | LLVM | [`InstVisitor.h`](https://github.com/llvm/llvm-project/blob/1dc53bacd24fb555dfd2ec030a5ee33f5db3fadf/llvm/include/llvm/IR/InstVisitor.h#L45-L107) | CRTP visitor dispatches on IR instruction opcode for optimization passes |
| [Visitor](/patterns/visitor/) | Vue.js | [`transforms/vIf.ts`](https://github.com/vuejs/core/blob/48ad452dd61926a59e358da3c74c5ef750ae21c4/packages/compiler-core/src/transforms/vIf.ts#L35-L60) | `transformIf` is a `NodeTransform` visitor that walks the template AST |
| [Vtable](/patterns/vtable/) | CPython | [`object.h`](https://github.com/python/cpython/blob/ff64d8de66ab7f8e56b5d410796a7d76c955280c/Include/cpython/object.h#L250-L340) | `PyTypeObject` vtable — `tp_repr`, `tp_hash`, `tp_call`, protocol suites |
| [Interning](/patterns/interning/) | CPython | [`unicodeobject.c`](https://github.com/python/cpython/blob/ff64d8de66ab7f8e56b5d410796a7d76c955280c/Objects/unicodeobject.c#L14416-L14427) | `PyUnicode_InternInPlace` — intern identifier strings for O(1) dict lookups |
| [Interning](/patterns/interning/) | Rust (rustc) | [`symbol.rs`](https://github.com/rust-lang/rust/blob/ab26b175979ee7b2cb3302dce204b99df96f7efb/compiler/rustc_span/src/symbol.rs#L24-L79) | `Symbol` is a `u32` index into global interner — all identifiers interned |
| [Tagged Union](/patterns/tagged-union/) | Godot Engine | [`variant.h`](https://github.com/godotengine/godot/blob/ec67cbe92628bdaf979b10594359ba6f02cf8838/core/variant/variant.h#L78-L120) | `Variant::Type` enum + union — every GDScript value is a `Variant` |
| [Tagged Union](/patterns/tagged-union/) | PyTorch | [`ivalue.h`](https://github.com/pytorch/pytorch/blob/cef26d1e97fcb9dd61b4471f9bd7fa9a32bd42b9/aten/src/ATen/core/ivalue.h#L51-L96) | `IValue` holds a `Tag` enum + `Payload` union for TorchScript interpreter |

## Further Reading

- [PostgreSQL (GitHub)](https://github.com/postgres/postgres) · [Redis (GitHub)](https://github.com/redis/redis) · [LevelDB (GitHub)](https://github.com/google/leveldb)
- [Akka (GitHub)](https://github.com/akka/akka) · [Erlang/OTP (GitHub)](https://github.com/erlang/otp)
- [Kubernetes (GitHub)](https://github.com/kubernetes/kubernetes) · [gRPC (GitHub)](https://github.com/grpc/grpc-go)
