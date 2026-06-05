---
description: "Distributed systems patterns: ring buffer (LMAX Disruptor), consistent hashing, WAL, MVCC, and circuit breaker."
---

# Patterns from Distributed Systems

High-throughput messaging and trading systems push throughput patterns to the extreme.

| Pattern | Project | Where | What It Does |
|---------|---------|-------|--------------|
| [Ring Buffer](/patterns/ring-buffer/) | LMAX Disruptor | [`RingBuffer.java`](https://github.com/LMAX-Exchange/disruptor/blob/master/src/main/java/com/lmax/disruptor/RingBuffer.java#L84-L130) | Core data structure — 6M orders/sec at LMAX Exchange |
| [Batch Processing](/patterns/batch-processing/) | Apache Kafka | [`RecordAccumulator.java`](https://github.com/apache/kafka/blob/trunk/clients/src/main/java/org/apache/kafka/clients/producer/internals/RecordAccumulator.java#L69-L120) | Accumulate records into batches per partition for throughput |
| [Circuit Breaker](/patterns/circuit-breaker/) | Netflix Hystrix | [`HystrixCircuitBreaker.java`](https://github.com/Netflix/Hystrix/blob/master/hystrix-core/src/main/java/com/netflix/hystrix/HystrixCircuitBreaker.java#L138-L289) | Three-state circuit breaker for microservice resilience |
| [Circuit Breaker](/patterns/circuit-breaker/) | Sony gobreaker | [`gobreaker.go`](https://github.com/sony/gobreaker/blob/master/gobreaker.go#L117-L131) | Go circuit breaker with generation-based staleness detection |
| [Backpressure](/patterns/backpressure/) | Reactive Streams | [`Subscription.java`](https://github.com/reactive-streams/reactive-streams-jvm/blob/master/api/src/main/java/org/reactivestreams/Subscription.java#L14-L37) | `request(n)` pull-based flow control specification |
| [Write-Ahead Log](/patterns/write-ahead-log/) | etcd | [`wal.go`](https://github.com/etcd-io/etcd/blob/main/server/storage/wal/wal.go#L72-L95) | Raft consensus WAL — source of truth for distributed state |
| [Write-Ahead Log](/patterns/write-ahead-log/) | PostgreSQL | [`xlog.c`](https://github.com/postgres/postgres/blob/master/src/backend/access/transam/xlog.c#L783-L1128) | Transaction WAL for crash recovery, replication, PITR |
| [MVCC](/patterns/mvcc/) | PostgreSQL | [`heapam_visibility.c`](https://github.com/postgres/postgres/blob/master/src/backend/access/heap/heapam_visibility.c#L917-L1096) | `HeapTupleSatisfiesMVCC` — snapshot isolation visibility check |
| [MVCC](/patterns/mvcc/) | etcd | [`kvstore.go`](https://github.com/etcd-io/etcd/blob/main/server/storage/mvcc/kvstore.go#L53-L135) | Multi-version key-value store powering Kubernetes config |
| [Consistent Hashing](/patterns/consistent-hashing/) | groupcache | [`consistenthash.go`](https://github.com/golang/groupcache/blob/master/consistenthash/consistenthash.go#L28-L81) | Hash ring with virtual replicas for distributed caching |
| [Actor Model](/patterns/actor-model/) | Akka | [`Actor.scala`](https://github.com/akka/akka-core/blob/main/akka-actor/src/main/scala/akka/actor/Actor.scala#L476-L547) | `trait Actor` — message-driven concurrency for JVM |
| [Actor Model](/patterns/actor-model/) | Erlang/OTP | [`erl_process.h`](https://github.com/erlang/otp/blob/master/erts/emulator/beam/erl_process.h#L1043-L1205) | BEAM VM process struct — lightweight actor with mailbox |
| [Rate Limiter](/patterns/rate-limiter/) | Nginx | [`ngx_http_limit_req_module.c`](https://github.com/nginx/nginx/blob/master/src/http/modules/ngx_http_limit_req_module.c#L405-L532) | Leaky bucket rate limiting for HTTP requests |
| [Logical Clock](/patterns/logical-clock/) | etcd | [`mvcc/revision.go`](https://github.com/etcd-io/etcd/blob/main/server/storage/mvcc/revision.go) | Monotonic revision counter for event ordering across cluster |
| [Logical Clock](/patterns/logical-clock/) | LevelDB | [`db_impl.cc` sequence number](https://github.com/google/leveldb/blob/main/db/db_impl.cc#L1311-L1337) | Sequence numbers order all writes without wall-clock time |
| [Retry Backoff](/patterns/retry-backoff/) | Kubernetes | [`backoff.go`](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/apimachinery/pkg/util/wait/backoff.go#L30-L50) | Pod restart backoff, API server retries with exponential delay |
| [Tombstone](/patterns/tombstone/) | Cassandra | [Tombstone markers](https://github.com/apache/cassandra) | Delete markers in distributed delete propagation |
| [LSM Tree](/patterns/lsm-tree/) | LevelDB | [`db_impl.cc`](https://github.com/google/leveldb/blob/main/db/db_impl.cc#L1241-L1368) | Buffer writes in memory, flush to sorted files, compact in background |
| [Checkpointing](/patterns/checkpointing/) | PostgreSQL | [`checkpointer.c`](https://github.com/postgres/postgres/blob/master/src/backend/postmaster/checkpointer.c#L218-L360) | Periodic state snapshot bounds WAL replay time on crash recovery |

## How They Compose: A Distributed Write

When a client writes a key to a distributed database like etcd, patterns chain across the entire path:

<CompositionFlow variant="distributed-write" />

The patterns form a durability pipeline: rate limiting protects the system, consistent hashing routes the request, WAL ensures durability, logical clocks order events, MVCC provides isolation, and checkpoints bound recovery time.

## Further Reading

- [LMAX Disruptor (GitHub)](https://github.com/LMAX-Exchange/disruptor) · [Apache Kafka (GitHub)](https://github.com/apache/kafka)
- [Netflix Hystrix (GitHub)](https://github.com/Netflix/Hystrix) · [etcd (GitHub)](https://github.com/etcd-io/etcd)
