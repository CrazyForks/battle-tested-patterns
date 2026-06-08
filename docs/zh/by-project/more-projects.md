---
description: "更多开源项目的模式：PostgreSQL、Redis、Kafka、LLVM、Chromium、V8 等。"
---

# 更多项目

来自数据库、JVM 生态、浏览器及其他知名开源项目的模式。

## 数据库与存储

| 模式 | 项目 | 位置 | 作用 |
|------|------|------|------|
| [MVCC](/zh/patterns/mvcc/) | PostgreSQL | [`heapam_visibility.c`](https://github.com/postgres/postgres/blob/master/src/backend/access/heap/heapam_visibility.c#L917-L1096) | `HeapTupleSatisfiesMVCC` — 快照隔离可见性检查 |
| [预写日志](/zh/patterns/write-ahead-log/) | PostgreSQL | [`xlog.c`](https://github.com/postgres/postgres/blob/master/src/backend/access/transam/xlog.c#L783-L1128) | 事务 WAL 用于崩溃恢复、复制、PITR |
| [MVCC](/zh/patterns/mvcc/) | etcd | [`kvstore.go`](https://github.com/etcd-io/etcd/blob/main/server/storage/mvcc/kvstore.go#L53-L135) | 多版本 KV 存储，驱动 Kubernetes 配置 |
| [预写日志](/zh/patterns/write-ahead-log/) | etcd | [`wal.go`](https://github.com/etcd-io/etcd/blob/main/server/storage/wal/wal.go#L72-L95) | Raft 共识 WAL 用于分布式状态 |
| [LRU 缓存](/zh/patterns/lru-cache/) | Redis | [`evict.c`](https://github.com/redis/redis/blob/unstable/src/evict.c#L55-L83) | 近似 LRU——基于采样的淘汰池 |
| [Trie 前缀树](/zh/patterns/trie/) | Redis | [`rax.c` / `rax.h`](https://github.com/redis/redis/blob/unstable/src/rax.h#L80-L130) | RAX 压缩前缀树，用于 Streams 和有序键范围 |
| [跳表](/zh/patterns/skip-list/) | Redis | [`t_zset.c`](https://github.com/redis/redis/blob/unstable/src/t_zset.c#L70-L130) | 有序集合实现，概率平衡 |
| [布隆过滤器](/zh/patterns/bloom-filter/) | LevelDB | [`bloom.cc`](https://github.com/google/leveldb/blob/main/util/bloom.cc#L17-L80) | 块级布隆过滤器跳过不必要的磁盘读取 |
| [跳表](/zh/patterns/skip-list/) | LevelDB | [`skiplist.h`](https://github.com/google/leveldb/blob/main/db/skiplist.h#L40-L90) | 无锁 memtable，原子 next 指针 |
| [Arena 分配器](/zh/patterns/arena-allocator/) | LevelDB | [`arena.cc`](https://github.com/google/leveldb/blob/main/util/arena.cc) | 基于块的 arena 分配器用于 memtable |
| [合并迭代器](/zh/patterns/merge-iterator/) | LevelDB | [`merger.cc`](https://github.com/google/leveldb/blob/main/table/merger.cc#L17-L100) | `MergingIterator` 合并有序迭代器（memtable + SSTable 各层）为单一有序视图 |
| [LSM 树](/zh/patterns/lsm-tree/) | LevelDB | [`db_impl.cc`](https://github.com/google/leveldb/blob/main/db/db_impl.cc#L1241-L1368) | `DBImpl::Write`——批量写入 WAL，插入 memtable，阈值时刷入 SST |
| [合并迭代器](/zh/patterns/merge-iterator/) | RocksDB | [`merge_helper.cc`](https://github.com/facebook/rocksdb/blob/main/db/merge_helper.cc#L87-L156) | `TimedFullMerge` 在 compaction 期间合并同键的多个版本 |
| [LSM 树](/zh/patterns/lsm-tree/) | RocksDB | [`memtable.cc`](https://github.com/facebook/rocksdb/blob/main/db/memtable.cc#L458-L534) | `MemTable::Add`——跳表支撑的 memtable，写满后刷入 L0 SST |
| [B+ 树](/zh/patterns/b-plus-tree/) | PostgreSQL | [`nbtinsert.c`](https://github.com/postgres/postgres/blob/master/src/backend/access/nbtree/nbtinsert.c#L22-L55) | B-link 树（Lehman-Yao 变体）——所有表和索引均由磁盘页上的 B+ 树支撑 |
| [B+ 树](/zh/patterns/b-plus-tree/) | SQLite | [`btreeInt.h`](https://github.com/sqlite/sqlite/blob/master/src/btreeInt.h#L190-L198) | 内部单元持有子页指针 + 键；叶单元持有有效载荷。通过 `balance_nonroot()` 实现页面分裂 |
| [默克尔树](/zh/patterns/merkle-tree/) | ZFS (OpenZFS) | [`blkptr.c`](https://github.com/openzfs/zfs/blob/master/module/zfs/blkptr.c#L30-L77) | 块指针校验和形成 Merkle 树，从数据块到 uberblock，检测静默数据损坏 |
| [检查点](/zh/patterns/checkpointing/) | PostgreSQL | [`checkpointer.c`](https://github.com/postgres/postgres/blob/master/src/backend/postmaster/checkpointer.c#L218-L360) | `CheckpointerMain`——刷新脏缓冲区，写检查点 WAL 记录，更新 `pg_control` |
| [检查点](/zh/patterns/checkpointing/) | Redis | [`rdb.c`](https://github.com/redis/redis/blob/unstable/src/rdb.c#L1414-L1529) | `rdbSaveRio`——fork 子进程写入时间点 RDB 快照，不阻塞主线程 |

## JVM 生态

| 模式 | 项目 | 位置 | 作用 |
|------|------|------|------|
| [Actor 模型](/zh/patterns/actor-model/) | Akka | [`Actor.scala`](https://github.com/akka/akka-core/blob/main/akka-actor/src/main/scala/akka/actor/Actor.scala#L476-L547) | `trait Actor` — JVM 上的消息驱动并发 |
| [熔断器](/zh/patterns/circuit-breaker/) | Netflix Hystrix | [`HystrixCircuitBreaker.java`](https://github.com/Netflix/Hystrix/blob/master/hystrix-core/src/main/java/com/netflix/hystrix/HystrixCircuitBreaker.java#L138-L289) | 微服务弹性的三态熔断器 |
| [批处理](/zh/patterns/batch-processing/) | Apache Kafka | [`RecordAccumulator.java`](https://github.com/apache/kafka/blob/trunk/clients/src/main/java/org/apache/kafka/clients/producer/internals/RecordAccumulator.java#L69-L120) | 按分区累积记录为批次 |
| [工作窃取](/zh/patterns/work-stealing/) | OpenJDK | [`ForkJoinPool.java`](https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/java/util/concurrent/ForkJoinPool.java) | `scan` 方法实现随机化工作窃取 |
| [LRU 缓存](/zh/patterns/lru-cache/) | Guava | [`CacheBuilder`](https://github.com/google/guava/blob/master/guava/src/com/google/common/cache/CacheBuilder.java) | `maximumSize()` LRU 淘汰 |
| [限流器](/zh/patterns/rate-limiter/) | Guava | [`RateLimiter`](https://github.com/google/guava/blob/master/guava/src/com/google/common/util/concurrent/RateLimiter.java) | 平滑突发/预热令牌桶 |
| [一致性哈希](/zh/patterns/consistent-hashing/) | groupcache | [`consistenthash.go`](https://github.com/golang/groupcache/blob/master/consistenthash/consistenthash.go#L28-L81) | 带虚拟副本的哈希环（Brad Fitzpatrick 作品） |

## Erlang / BEAM 虚拟机

| 模式 | 项目 | 位置 | 作用 |
|------|------|------|------|
| [Actor 模型](/zh/patterns/actor-model/) | Erlang/OTP | [`erl_process.h`](https://github.com/erlang/otp/blob/master/erts/emulator/beam/erl_process.h#L1043-L1205) | BEAM VM 进程结构体——带信箱的轻量级 Actor |
| [协作调度](/zh/patterns/cooperative-scheduling/) | Erlang/OTP | [BEAM 调度器](https://github.com/erlang/otp/blob/master/erts/emulator/beam/erl_process.c) | 基于 reduction 的抢占，支持数百万进程 |
| [信号量](/zh/patterns/semaphore/) | Erlang/OTP | [`erl_process_lock.c`](https://github.com/erlang/otp/blob/master/erts/emulator/beam/erl_process_lock.c) | 进程锁保证安全的并发访问 |

## 浏览器与 Web

| 模式 | 项目 | 位置 | 作用 |
|------|------|------|------|
| [布隆过滤器](/zh/patterns/bloom-filter/) | Chromium | [`selector_filter.h`](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/css/selector_filter.h#L149-L175) | CSS 选择器布隆过滤器——跳过 60-70% 的规则 |
| [位掩码](/zh/patterns/bitmask/) | React | [`ReactFiberFlags.js`](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberFlags.js#L14-L36) | Fiber 副作用标志——`Placement`、`Update`、`Deletion` |
| [双缓冲](/zh/patterns/double-buffering/) | React | [Fiber 架构](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiber.js#L327-L355) | current 树与 work-in-progress 树在 commit 时交换 |
| [差异/补丁](/zh/patterns/diff-patch/) | React | [`ReactChildFiber.js`](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactChildFiber.js#L1169-L1340) | 基于 key 的列表 reconciliation |

## 基础设施与云

| 模式 | 项目 | 位置 | 作用 |
|------|------|------|------|
| [指数退避重试](/zh/patterns/retry-backoff/) | Kubernetes | [`backoff.go`](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/apimachinery/pkg/util/wait/backoff.go#L30-L50) | Pod 重启退避、API 服务器重试 |
| [指数退避重试](/zh/patterns/retry-backoff/) | gRPC-Go | [`internal/backoff/backoff.go`](https://github.com/grpc/grpc-go/blob/master/internal/backoff/backoff.go#L56-L75) | 带抖动的指数连接退避 |
| [依赖图](/zh/patterns/dependency-graph/) | Terraform | [资源图](https://github.com/hashicorp/terraform) | DAG 顺序的并行资源 apply |
| [依赖图](/zh/patterns/dependency-graph/) | Bazel | [Action 图](https://github.com/bazelbuild/bazel) | 构建目标的拓扑执行 |
| [注册表](/zh/patterns/registry/) | gRPC-Go | [`server.go`](https://github.com/grpc/grpc-go/blob/master/server.go#L154-L170) | `RegisterService` 将服务描述添加到服务器的服务映射中，用于 RPC 方法分发 |
| [注册表](/zh/patterns/registry/) | TensorFlow | [`op.h`](https://github.com/tensorflow/tensorflow/blob/master/tensorflow/core/framework/op.h#L258-L290) | `REGISTER_OP` 宏将操作注册到全局 `OpRegistry`，用于构建计算图 |
| [一致性哈希](/zh/patterns/consistent-hashing/) | Nginx | [`ngx_http_upstream_hash`](https://github.com/nginx/nginx/blob/master/src/http/modules/ngx_http_upstream_hash_module.c) | 基于 ketama 哈希的上游负载均衡 |

## 编译器与语言运行时

| 模式 | 项目 | 位置 | 作用 |
|------|------|------|------|
| [访问者](/zh/patterns/visitor/) | LLVM | [`InstVisitor.h`](https://github.com/llvm/llvm-project/blob/main/llvm/include/llvm/IR/InstVisitor.h#L45-L107) | CRTP 访问者按 IR 指令操作码分发，用于优化 pass |
| [访问者](/zh/patterns/visitor/) | Vue.js | [`transforms/vIf.ts`](https://github.com/vuejs/core/blob/main/packages/compiler-core/src/transforms/vIf.ts#L35-L60) | `transformIf` 是 `NodeTransform` 访问者，遍历模板 AST |
| [虚函数表](/zh/patterns/vtable/) | CPython | [`object.h`](https://github.com/python/cpython/blob/main/Include/cpython/object.h#L250-L340) | `PyTypeObject` 虚表——`tp_repr`、`tp_hash`、`tp_call`、协议套件 |
| [驻留](/zh/patterns/interning/) | CPython | [`unicodeobject.c`](https://github.com/python/cpython/blob/main/Objects/unicodeobject.c#L15575-L15631) | `PyUnicode_InternInPlace`——驻留标识符字符串实现 O(1) 字典查找 |
| [驻留](/zh/patterns/interning/) | Rust (rustc) | [`symbol.rs`](https://github.com/rust-lang/rust/blob/master/compiler/rustc_span/src/symbol.rs#L24-L79) | `Symbol` 是全局驻留表的 `u32` 索引——所有标识符均驻留 |
| [标签联合体](/zh/patterns/tagged-union/) | Godot Engine | [`variant.h`](https://github.com/godotengine/godot/blob/master/core/variant/variant.h#L78-L120) | `Variant::Type` 枚举 + 联合体——每个 GDScript 值都是 `Variant` |
| [标签联合体](/zh/patterns/tagged-union/) | PyTorch | [`ivalue.h`](https://github.com/pytorch/pytorch/blob/main/aten/src/ATen/core/ivalue.h#L51-L96) | `IValue` 持有 `Tag` 枚举 + `Payload` 联合体，用于 TorchScript 解释器 |

## 延伸阅读

- [PostgreSQL (GitHub)](https://github.com/postgres/postgres) · [Redis (GitHub)](https://github.com/redis/redis) · [LevelDB (GitHub)](https://github.com/google/leveldb)
- [Akka (GitHub)](https://github.com/akka/akka) · [Erlang/OTP (GitHub)](https://github.com/erlang/otp)
- [Kubernetes (GitHub)](https://github.com/kubernetes/kubernetes) · [gRPC (GitHub)](https://github.com/grpc/grpc-go)
