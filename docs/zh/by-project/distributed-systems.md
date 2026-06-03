---
description: "分布式系统模式：环形缓冲区（LMAX Disruptor）、一致性哈希、WAL、MVCC 和熔断器。"
---

# 分布式系统中的模式

高吞吐消息系统和交易系统将吞吐模式推向极限。

| 模式 | 项目 | 位置 | 作用 |
|------|------|------|------|
| [环形缓冲区](/zh/patterns/ring-buffer/) | LMAX Disruptor | [`RingBuffer.java`](https://github.com/LMAX-Exchange/disruptor/blob/master/src/main/java/com/lmax/disruptor/RingBuffer.java#L84-L130) | 每秒 600 万笔订单的核心数据结构 |
| [批处理](/zh/patterns/batch-processing/) | Apache Kafka | [`RecordAccumulator.java`](https://github.com/apache/kafka/blob/trunk/clients/src/main/java/org/apache/kafka/clients/producer/internals/RecordAccumulator.java#L69-L120) | 按分区累积记录为批次提升吞吐 |
| [熔断器](/zh/patterns/circuit-breaker/) | Netflix Hystrix | [`HystrixCircuitBreaker.java`](https://github.com/Netflix/Hystrix/blob/master/hystrix-core/src/main/java/com/netflix/hystrix/HystrixCircuitBreaker.java#L138-L289) | 微服务弹性的三态熔断器 |
| [熔断器](/zh/patterns/circuit-breaker/) | Sony gobreaker | [`gobreaker.go`](https://github.com/sony/gobreaker/blob/master/gobreaker.go#L117-L131) | 带代计数器防过期检测的 Go 熔断器 |
| [背压](/zh/patterns/backpressure/) | Reactive Streams | [`Subscription.java`](https://github.com/reactive-streams/reactive-streams-jvm/blob/master/api/src/main/java/org/reactivestreams/Subscription.java#L14-L37) | `request(n)` 拉模型流控规范 |
| [预写日志](/zh/patterns/write-ahead-log/) | etcd | [`wal.go`](https://github.com/etcd-io/etcd/blob/main/server/storage/wal/wal.go#L72-L95) | Raft 共识 WAL——分布式状态的事实来源 |
| [预写日志](/zh/patterns/write-ahead-log/) | PostgreSQL | [`xlog.c`](https://github.com/postgres/postgres/blob/master/src/backend/access/transam/xlog.c#L783-L1128) | 事务 WAL 用于崩溃恢复、复制、PITR |
| [MVCC](/zh/patterns/mvcc/) | PostgreSQL | [`heapam_visibility.c`](https://github.com/postgres/postgres/blob/master/src/backend/access/heap/heapam_visibility.c#L917-L1096) | `HeapTupleSatisfiesMVCC` — 快照隔离可见性检查 |
| [MVCC](/zh/patterns/mvcc/) | etcd | [`kvstore.go`](https://github.com/etcd-io/etcd/blob/main/server/storage/mvcc/kvstore.go#L53-L135) | 多版本键值存储，驱动 Kubernetes 配置 |
| [一致性哈希](/zh/patterns/consistent-hashing/) | groupcache | [`consistenthash.go`](https://github.com/golang/groupcache/blob/master/consistenthash/consistenthash.go#L28-L81) | 带虚拟副本的哈希环，用于分布式缓存 |
| [Actor 模型](/zh/patterns/actor-model/) | Akka | [`Actor.scala`](https://github.com/akka/akka-core/blob/main/akka-actor/src/main/scala/akka/actor/Actor.scala#L476-L547) | `trait Actor` — JVM 上的消息驱动并发 |
| [Actor 模型](/zh/patterns/actor-model/) | Erlang/OTP | [`erl_process.h`](https://github.com/erlang/otp/blob/master/erts/emulator/beam/erl_process.h#L1043-L1205) | BEAM VM 进程结构体 — 带信箱的轻量级 Actor |
| [限流器](/zh/patterns/rate-limiter/) | Nginx | [`ngx_http_limit_req_module.c`](https://github.com/nginx/nginx/blob/master/src/http/modules/ngx_http_limit_req_module.c#L405-L532) | HTTP 请求的漏桶限流 |
| [逻辑时钟](/zh/patterns/logical-clock/) | etcd | [`mvcc/revision.go`](https://github.com/etcd-io/etcd/blob/main/server/storage/mvcc/revision.go) | 单调递增修订号，用于集群内事件排序 |
| [逻辑时钟](/zh/patterns/logical-clock/) | LevelDB | [`db_impl.cc` 序列号](https://github.com/google/leveldb/blob/main/db/db_impl.cc#L1311-L1337) | 序列号排序所有写入，无需墙钟时间 |
| [指数退避重试](/zh/patterns/retry-backoff/) | Kubernetes | [`backoff.go`](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/apimachinery/pkg/util/wait/backoff.go#L30-L50) | Pod 重启退避、API Server 指数延迟重试 |
| [墓碑](/zh/patterns/tombstone/) | Cassandra | [Tombstone 标记](https://github.com/apache/cassandra) | 分布式删除传播中的删除标记 |
| [LSM 树](/zh/patterns/lsm-tree/) | LevelDB | [`db_impl.cc`](https://github.com/google/leveldb/blob/main/db/db_impl.cc#L1241-L1368) | 内存缓冲写入，刷入有序文件，后台合并 |
| [检查点](/zh/patterns/checkpointing/) | PostgreSQL | [`checkpointer.c`](https://github.com/postgres/postgres/blob/master/src/backend/postmaster/checkpointer.c#L218-L360) | 周期性快照，限制崩溃恢复时 WAL 回放时间 |

## 延伸阅读

- [LMAX Disruptor (GitHub)](https://github.com/LMAX-Exchange/disruptor) · [Apache Kafka (GitHub)](https://github.com/apache/kafka)
- [Netflix Hystrix (GitHub)](https://github.com/Netflix/Hystrix) · [etcd (GitHub)](https://github.com/etcd-io/etcd)
