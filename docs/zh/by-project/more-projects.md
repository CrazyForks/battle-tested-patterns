# 更多项目

来自数据库、JVM 生态、浏览器及其他知名开源项目的模式。

## 数据库与存储

| 模式 | 项目 | 位置 | 作用 |
|------|------|------|------|
| [MVCC](/zh/patterns/mvcc/) | PostgreSQL | `heapam_visibility.c` | `HeapTupleSatisfiesMVCC` — 快照隔离可见性检查 |
| [预写日志](/zh/patterns/write-ahead-log/) | PostgreSQL | `xlog.c` | 事务 WAL 用于崩溃恢复、复制、PITR |
| [MVCC](/zh/patterns/mvcc/) | etcd | `kvstore.go` | 多版本 KV 存储，驱动 Kubernetes 配置 |
| [预写日志](/zh/patterns/write-ahead-log/) | etcd | `wal.go` | Raft 共识 WAL 用于分布式状态 |
| [LRU 缓存](/zh/patterns/lru-cache/) | Redis | `evict.c` | 近似 LRU——基于采样的淘汰池 |
| [Trie 前缀树](/zh/patterns/trie/) | Redis | `rax.c` / `rax.h` | RAX 压缩前缀树，用于 Streams 和有序键范围 |
| [跳表](/zh/patterns/skip-list/) | Redis | `t_zset.c` | 有序集合实现，概率平衡 |
| [布隆过滤器](/zh/patterns/bloom-filter/) | LevelDB | `bloom.cc` | 块级布隆过滤器跳过不必要的磁盘读取 |
| [跳表](/zh/patterns/skip-list/) | LevelDB | `skiplist.h` | 无锁 memtable，原子 next 指针 |
| [Arena 分配器](/zh/patterns/arena-allocator/) | LevelDB | `arena.cc` | 基于块的 arena 分配器用于 memtable |

## JVM 生态

| 模式 | 项目 | 位置 | 作用 |
|------|------|------|------|
| [Actor 模型](/zh/patterns/actor-model/) | Akka | `Actor.scala` | `trait Actor` — JVM 上的消息驱动并发 |
| [熔断器](/zh/patterns/circuit-breaker/) | Netflix Hystrix | `HystrixCircuitBreaker.java` | 微服务弹性的三态熔断器 |
| [批处理](/zh/patterns/batch-processing/) | Apache Kafka | `RecordAccumulator.java` | 按分区累积记录为批次 |
| [工作窃取](/zh/patterns/work-stealing/) | OpenJDK | `ForkJoinPool.java` | `scan` 方法实现随机化工作窃取 |
| [LRU 缓存](/zh/patterns/lru-cache/) | Guava | `CacheBuilder` | `maximumSize()` LRU 淘汰 |
| [限流器](/zh/patterns/rate-limiter/) | Guava | `RateLimiter` | 平滑突发/预热令牌桶 |
| [一致性哈希](/zh/patterns/consistent-hashing/) | groupcache | `consistenthash.go` | 带虚拟副本的哈希环（Brad Fitzpatrick 作品） |

## Erlang / BEAM 虚拟机

| 模式 | 项目 | 位置 | 作用 |
|------|------|------|------|
| [Actor 模型](/zh/patterns/actor-model/) | Erlang/OTP | `erl_process.h` | BEAM VM 进程结构体——带信箱的轻量级 Actor |
| [协作调度](/zh/patterns/cooperative-scheduling/) | Erlang/OTP | BEAM 调度器 | 基于 reduction 的抢占，支持数百万进程 |
| [信号量](/zh/patterns/semaphore/) | Erlang/OTP | `erl_process_lock.c` | 进程锁保证安全的并发访问 |

## 浏览器与 Web

| 模式 | 项目 | 位置 | 作用 |
|------|------|------|------|
| [布隆过滤器](/zh/patterns/bloom-filter/) | Chromium | `selector_filter.h` | CSS 选择器布隆过滤器——跳过 60-70% 的规则 |
| [位掩码](/zh/patterns/bitmask/) | React | `ReactFiberFlags.js` | Fiber 副作用标志——`Placement`、`Update`、`Deletion` |
| [双缓冲](/zh/patterns/double-buffering/) | React | Fiber 架构 | current 树与 work-in-progress 树在 commit 时交换 |
| [差异/补丁](/zh/patterns/diff-patch/) | React | `ReactChildFiber.js` | 基于 key 的列表 reconciliation |

## 基础设施与云

| 模式 | 项目 | 位置 | 作用 |
|------|------|------|------|
| [重试退避](/zh/patterns/retry-backoff/) | Kubernetes | `backoff.go` | Pod 重启退避、API 服务器重试 |
| [重试退避](/zh/patterns/retry-backoff/) | gRPC-Go | `internal/backoff/backoff.go` | 带抖动的指数连接退避 |
| [依赖图](/zh/patterns/dependency-graph/) | Terraform | 资源图 | DAG 顺序的并行资源 apply |
| [依赖图](/zh/patterns/dependency-graph/) | Bazel | Action 图 | 构建目标的拓扑执行 |
| [一致性哈希](/zh/patterns/consistent-hashing/) | Nginx | `ngx_http_upstream_hash` | 基于 ketama 哈希的上游负载均衡 |

## 延伸阅读

- [PostgreSQL (GitHub)](https://github.com/postgres/postgres) · [Redis (GitHub)](https://github.com/redis/redis) · [LevelDB (GitHub)](https://github.com/google/leveldb)
- [Akka (GitHub)](https://github.com/akka/akka) · [Erlang/OTP (GitHub)](https://github.com/erlang/otp)
- [Kubernetes (GitHub)](https://github.com/kubernetes/kubernetes) · [gRPC (GitHub)](https://github.com/grpc/grpc-go)
