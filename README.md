<div align="center">

# Battle-Tested Patterns

**Code-level programming patterns extracted from production codebases.**

Every pattern backed by precise GitHub source links · Multi-language · Runnable exercises

[📖 Documentation](https://totoro-jam.github.io/battle-tested-patterns/) · [📖 中文文档](https://totoro-jam.github.io/battle-tested-patterns/zh/)

English | [简体中文](README.zh-CN.md)

[![CI](https://github.com/Totoro-jam/battle-tested-patterns/actions/workflows/ci.yml/badge.svg)](https://github.com/Totoro-jam/battle-tested-patterns/actions/workflows/ci.yml)
[![Deploy](https://github.com/Totoro-jam/battle-tested-patterns/actions/workflows/deploy.yml/badge.svg)](https://github.com/Totoro-jam/battle-tested-patterns/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](.github/CONTRIBUTING.md)

</div>

## 30 Patterns at a Glance

<table>
<tr>
<td width="33%">

**🧠 Data Structures**
- [Bitmask](https://totoro-jam.github.io/battle-tested-patterns/patterns/bitmask/) — flags in one int
- [Min Heap](https://totoro-jam.github.io/battle-tested-patterns/patterns/min-heap/) — priority queue
- [Ring Buffer](https://totoro-jam.github.io/battle-tested-patterns/patterns/ring-buffer/) — fixed-size FIFO
- [Trie](https://totoro-jam.github.io/battle-tested-patterns/patterns/trie/) — prefix search
- [Skip List](https://totoro-jam.github.io/battle-tested-patterns/patterns/skip-list/) — probabilistic order
- [Bloom Filter](https://totoro-jam.github.io/battle-tested-patterns/patterns/bloom-filter/) — set membership
- [LRU Cache](https://totoro-jam.github.io/battle-tested-patterns/patterns/lru-cache/) — eviction policy

</td>
<td width="33%">

**⚡ Concurrency**
- [Semaphore](https://totoro-jam.github.io/battle-tested-patterns/patterns/semaphore/) — bounded access
- [Actor Model](https://totoro-jam.github.io/battle-tested-patterns/patterns/actor-model/) — message passing
- [Work Stealing](https://totoro-jam.github.io/battle-tested-patterns/patterns/work-stealing/) — load balance
- [MVCC](https://totoro-jam.github.io/battle-tested-patterns/patterns/mvcc/) — snapshot isolation
- [Cooperative Scheduling](https://totoro-jam.github.io/battle-tested-patterns/patterns/cooperative-scheduling/) — yield control
- [Double Buffering](https://totoro-jam.github.io/battle-tested-patterns/patterns/double-buffering/) — atomic swap
- [Backpressure](https://totoro-jam.github.io/battle-tested-patterns/patterns/backpressure/) — flow control
- [Event Loop](https://totoro-jam.github.io/battle-tested-patterns/patterns/event-loop/) — I/O multiplexing
- [Logical Clock](https://totoro-jam.github.io/battle-tested-patterns/patterns/logical-clock/) — event ordering

</td>
<td width="33%">

**🏗️ Systems**
- [Circuit Breaker](https://totoro-jam.github.io/battle-tested-patterns/patterns/circuit-breaker/) — fault tolerance
- [Rate Limiter](https://totoro-jam.github.io/battle-tested-patterns/patterns/rate-limiter/) — throttle
- [Retry Backoff](https://totoro-jam.github.io/battle-tested-patterns/patterns/retry-backoff/) — resilience
- [Write-Ahead Log](https://totoro-jam.github.io/battle-tested-patterns/patterns/write-ahead-log/) — durability
- [Batch Processing](https://totoro-jam.github.io/battle-tested-patterns/patterns/batch-processing/) — throughput
- [Consistent Hashing](https://totoro-jam.github.io/battle-tested-patterns/patterns/consistent-hashing/) — distribution
- [Dependency Graph](https://totoro-jam.github.io/battle-tested-patterns/patterns/dependency-graph/) — ordering
- [Middleware Chain](https://totoro-jam.github.io/battle-tested-patterns/patterns/middleware-chain/) — pipeline

</td>
</tr>
<tr>
<td>

**♻️ Memory**
- [Object Pool](https://totoro-jam.github.io/battle-tested-patterns/patterns/object-pool/) — reuse instances
- [Flyweight](https://totoro-jam.github.io/battle-tested-patterns/patterns/flyweight/) — share immutables
- [Arena Allocator](https://totoro-jam.github.io/battle-tested-patterns/patterns/arena-allocator/) — bump alloc
- [Free List](https://totoro-jam.github.io/battle-tested-patterns/patterns/free-list/) — O(1) alloc/free
- [Copy-on-Write](https://totoro-jam.github.io/battle-tested-patterns/patterns/copy-on-write/) — defer copy
- [Reference Counting](https://totoro-jam.github.io/battle-tested-patterns/patterns/reference-counting/) — auto-cleanup

</td>
<td>

**🔄 Behavioral**
- [State Machine](https://totoro-jam.github.io/battle-tested-patterns/patterns/state-machine/) — transitions
- [Observer](https://totoro-jam.github.io/battle-tested-patterns/patterns/observer/) — pub/sub
- [Iterator](https://totoro-jam.github.io/battle-tested-patterns/patterns/iterator/) — lazy eval
- [Diff / Patch](https://totoro-jam.github.io/battle-tested-patterns/patterns/diff-patch/) — minimal edits

</td>
<td>

**📊 Proven In**
- React · Linux · Go
- Redis · PostgreSQL
- Kafka · Chromium
- Tokio · Erlang/OTP
- LevelDB · etcd
- Nginx · Akka

</td>
</tr>
</table>

## The Gap This Fills

| What exists | What's missing |
|------------|----------------|
| Design patterns books | Too abstract, too OOP-centric |
| Algorithm repos | Disconnected from real engineering |
| System design guides | Architecture-level, not code-level |

This project: **code-level techniques from React, Linux, Go, Chromium — each with verifiable source links**.

## Patterns

| Pattern | What It Does | Proven In |
|---------|-------------|-----------|
| [**Bitmask**](https://totoro-jam.github.io/battle-tested-patterns/patterns/bitmask/) | Pack N flags into one integer, check any combo in O(1) | [React Flags](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberFlags.js#L14-L36) · [Linux stat.h](https://github.com/torvalds/linux/blob/master/include/uapi/linux/stat.h#L25-L33)|
| [**Double Buffering**](https://totoro-jam.github.io/battle-tested-patterns/patterns/double-buffering/) | Swap two copies atomically, zero allocation | [React Fiber](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiber.js#L327-L355) · [SDL](https://github.com/libsdl-org/SDL/blob/main/src/render/SDL_render.c)|
| [**Cooperative Scheduling**](https://totoro-jam.github.io/battle-tested-patterns/patterns/cooperative-scheduling/) | Yield control between work chunks to stay responsive | [React Scheduler](https://github.com/facebook/react/blob/main/packages/scheduler/src/forks/Scheduler.js#L188-L258) · [Go Runtime](https://github.com/golang/go/blob/master/src/runtime/proc.go#L4143-L4200)|
| [**Min Heap**](https://totoro-jam.github.io/battle-tested-patterns/patterns/min-heap/) | O(1) peek at highest priority, O(log n) push/pop | [React MinHeap](https://github.com/facebook/react/blob/main/packages/scheduler/src/SchedulerMinHeap.js#L17-L90) · [Linux CFS](https://github.com/torvalds/linux/blob/master/kernel/sched/fair.c#L1407-L1460)|
| [**Diff / Patch**](https://totoro-jam.github.io/battle-tested-patterns/patterns/diff-patch/) | Compute minimal edits between two sequences | [React Reconciler](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactChildFiber.js#L1169-L1340) · [Git](https://github.com/git/git/blob/master/diff.c#L5020-L5060)|
| [**Object Pool**](https://totoro-jam.github.io/battle-tested-patterns/patterns/object-pool/) | Pre-allocate and reuse to avoid GC pressure | [Go sync.Pool](https://github.com/golang/go/blob/master/src/sync/pool.go#L52-L97) · [Godot](https://github.com/godotengine/godot/blob/master/core/templates/pooled_list.h#L35-L100)|
| [**Ring Buffer**](https://totoro-jam.github.io/battle-tested-patterns/patterns/ring-buffer/) | Fixed-size circular queue, zero allocation | [LMAX Disruptor](https://github.com/LMAX-Exchange/disruptor/blob/master/src/main/java/com/lmax/disruptor/RingBuffer.java#L84-L130) · [Linux](https://github.com/torvalds/linux/blob/master/include/linux/ring_buffer.h#L12-L70)|
| [**State Machine**](https://totoro-jam.github.io/battle-tested-patterns/patterns/state-machine/) | Explicit states, impossible transitions unrepresentable | [XState](https://github.com/statelyai/xstate/blob/main/packages/core/src/StateMachine.ts#L58-L120) · [Linux TCP](https://github.com/torvalds/linux/blob/master/net/ipv4/tcp_input.c#L4865-L4920)|
| [**Copy-on-Write**](https://totoro-jam.github.io/battle-tested-patterns/patterns/copy-on-write/) | Share by reference, copy only on mutation | [Git objects](https://github.com/git/git/blob/master/object-file.c#L719-L730) · [Rust Cow](https://github.com/rust-lang/rust/blob/main/library/alloc/src/borrow.rs#L169-L220)|
| [**Observer**](https://totoro-jam.github.io/battle-tested-patterns/patterns/observer/) | Subscribe to events, decouple producers from consumers | [Node EventEmitter](https://github.com/nodejs/node/blob/main/lib/events.js#L456-L520) · [Redux](https://github.com/reduxjs/redux/blob/master/src/createStore.ts#L211-L280)|
| [**Iterator**](https://totoro-jam.github.io/battle-tested-patterns/patterns/iterator/) | Lazy sequences, zero intermediate allocations | [Rust Iterator](https://github.com/rust-lang/rust/blob/main/library/core/src/iter/traits/iterator.rs#L68-L112) · [Python gen](https://github.com/python/cpython/blob/main/Objects/genobject.c)|
| [**Semaphore**](https://totoro-jam.github.io/battle-tested-patterns/patterns/semaphore/) | Bounded concurrency with a counter | [Linux](https://github.com/torvalds/linux/blob/master/include/linux/semaphore.h#L15-L55) · [Go x/sync](https://github.com/golang/sync/blob/master/semaphore/semaphore.go)|
| [**Batch Processing**](https://totoro-jam.github.io/battle-tested-patterns/patterns/batch-processing/) | Accumulate ops, execute as group | [Kafka](https://github.com/apache/kafka/blob/trunk/clients/src/main/java/org/apache/kafka/clients/producer/internals/RecordAccumulator.java#L69-L120)|
| [**Retry with Backoff**](https://totoro-jam.github.io/battle-tested-patterns/patterns/retry-backoff/) | Exponential delay + jitter on failure | [Kubernetes](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/apimachinery/pkg/util/wait/backoff.go#L30-L50) · [gRPC](https://github.com/grpc/grpc/blob/master/doc/connection-backoff.md)|
| [**Flyweight**](https://totoro-jam.github.io/battle-tested-patterns/patterns/flyweight/) | Share identical objects, avoid duplicates | [Python int cache](https://github.com/python/cpython/blob/main/Objects/longobject.c#L61-L75)|
| [**Bloom Filter**](https://totoro-jam.github.io/battle-tested-patterns/patterns/bloom-filter/) | Probabilistic set membership, zero false negatives | [LevelDB](https://github.com/google/leveldb/blob/main/util/bloom.cc#L17-L80) · [Chromium](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/css/selector_filter.h#L149-L175)|
| [**Circuit Breaker**](https://totoro-jam.github.io/battle-tested-patterns/patterns/circuit-breaker/) | Stop calling failing services, fail fast | [Hystrix](https://github.com/Netflix/Hystrix/blob/master/hystrix-core/src/main/java/com/netflix/hystrix/HystrixCircuitBreaker.java#L138-L289) · [gobreaker](https://github.com/sony/gobreaker/blob/master/gobreaker.go#L117-L131)|
| [**Arena Allocator**](https://totoro-jam.github.io/battle-tested-patterns/patterns/arena-allocator/) | Bump-allocate, free all at once | [bumpalo](https://github.com/fitzgen/bumpalo/blob/main/src/lib.rs#L378-L383) · [Go arena](https://github.com/golang/go/blob/master/src/arena/arena.go#L44-L67)|
| [**Backpressure**](https://totoro-jam.github.io/battle-tested-patterns/patterns/backpressure/) | Slow producers when consumers can't keep up | [Node.js Streams](https://github.com/nodejs/node/blob/main/lib/internal/streams/writable.js#L312-L370) · [Reactive Streams](https://github.com/reactive-streams/reactive-streams-jvm/blob/master/api/src/main/java/org/reactivestreams/Subscription.java#L25-L45)|
| [**Write-Ahead Log**](https://totoro-jam.github.io/battle-tested-patterns/patterns/write-ahead-log/) | Log mutations before applying, crash recovery | [etcd](https://github.com/etcd-io/etcd/blob/main/server/storage/wal/wal.go#L72-L95) · [PostgreSQL](https://github.com/postgres/postgres/blob/master/src/backend/access/transam/xlog.c)|
| [**LRU Cache**](https://totoro-jam.github.io/battle-tested-patterns/patterns/lru-cache/) | Evict least recently used, O(1) get/put | [groupcache](https://github.com/golang/groupcache/blob/master/lru/lru.go#L28-L76) · [Linux](https://github.com/torvalds/linux/blob/master/include/linux/list_lru.h#L15-L55)|
| [**Consistent Hashing**](https://totoro-jam.github.io/battle-tested-patterns/patterns/consistent-hashing/) | Add/remove nodes remaps ~1/n keys | [groupcache](https://github.com/golang/groupcache/blob/master/consistenthash/consistenthash.go#L28-L81) · [HAProxy](https://github.com/haproxy/haproxy/blob/master/src/lb_chash.c#L415-L491)|
| [**Trie**](https://totoro-jam.github.io/battle-tested-patterns/patterns/trie/) | O(k) lookup, shared prefixes share nodes | [Linux FIB](https://github.com/torvalds/linux/blob/master/net/ipv4/fib_trie.c#L80-L120) · [Redis rax](https://github.com/redis/redis/blob/unstable/src/rax.h#L80-L130)|
| [**Skip List**](https://totoro-jam.github.io/battle-tested-patterns/patterns/skip-list/) | Probabilistic O(log n) sorted structure | [Redis](https://github.com/redis/redis/blob/unstable/src/t_zset.c#L70-L130) · [LevelDB](https://github.com/google/leveldb/blob/main/db/skiplist.h#L40-L90)|
| [**Rate Limiter**](https://totoro-jam.github.io/battle-tested-patterns/patterns/rate-limiter/) | Token bucket controls throughput | [Go rate](https://github.com/golang/time/blob/master/rate/rate.go#L57-L66) · [Nginx](https://github.com/nginx/nginx/blob/master/src/http/modules/ngx_http_limit_req_module.c#L405-L532)|
| [**Work Stealing**](https://totoro-jam.github.io/battle-tested-patterns/patterns/work-stealing/) | Idle threads steal from busy queues | [Go proc.go](https://github.com/golang/go/blob/master/src/runtime/proc.go#L3836-L3903) · [Tokio](https://github.com/tokio-rs/tokio/blob/master/tokio/src/runtime/scheduler/multi_thread/worker.rs#L1136-L1175)|
| [**MVCC**](https://totoro-jam.github.io/battle-tested-patterns/patterns/mvcc/) | Timestamped versions, readers never block | [PostgreSQL](https://github.com/postgres/postgres/blob/master/src/backend/access/heap/heapam_visibility.c#L917-L1096) · [etcd](https://github.com/etcd-io/etcd/blob/main/server/storage/mvcc/kvstore.go#L53-L135)|
| [**Free List**](https://totoro-jam.github.io/battle-tested-patterns/patterns/free-list/) | O(1) alloc/free via linked freed slots | [Go mfixalloc](https://github.com/golang/go/blob/master/src/runtime/mfixalloc.go#L31-L109) · [Linux SLUB](https://github.com/torvalds/linux/blob/master/mm/slub.c#L530-L551)|
| [**Dependency Graph**](https://totoro-jam.github.io/battle-tested-patterns/patterns/dependency-graph/) | DAG + toposort for execution order | [Cargo](https://github.com/rust-lang/cargo/blob/master/src/cargo/core/resolver/dep_cache.rs#L1-L50) · [pnpm](https://github.com/pnpm/pnpm/blob/main/pkg-manager/sort-packages/src/index.ts)|
| [**Actor Model**](https://totoro-jam.github.io/battle-tested-patterns/patterns/actor-model/) | Private state + mailbox, no locks | [Akka](https://github.com/akka/akka/blob/main/akka-actor/src/main/scala/akka/actor/Actor.scala#L476-L547) · [Erlang/OTP](https://github.com/erlang/otp/blob/master/erts/emulator/beam/erl_process.h#L1043-L1205)|

> Every "Proven In" link goes to the **exact lines** in the source code. Not a directory. Not a file. The lines.

## What a Pattern Looks Like

Each pattern follows a consistent structure — here's a taste from **Bitmask**:

```text
  Bit position:   7    6    5    4    3    2    1    0
                ┌────┬────┬────┬────┬────┬────┬────┬────┐
  Flags:        │    │    │    │ SN │ CB │ RF │ UP │ PL │
                └────┴────┴────┴──┬─┴──┬─┴──┬─┴──┬─┴──┬─┘
                                  │    │    │    │    └── Placement  (1 << 0)
                                  │    │    │    └─────── Update     (1 << 1)
                                  │    │    └──────────── Ref        (1 << 2)
                                  │    └───────────────── Callback   (1 << 3)
                                  └────────────────────── Snapshot   (1 << 4)
```

Implementations in 4 languages, each idiomatic:

```typescript
// TypeScript                          // Python
const READ  = 1 << 0;                  READ  = 1 << 0
const WRITE = 1 << 1;                  WRITE = 1 << 1
const perms = READ | WRITE;            perms = READ | WRITE
(perms & READ) !== 0;  // true         bool(perms & READ)  # True
```

Then exercises at 2 difficulty levels — all with tests you can run.

## What's Inside

| Feature | Details |
|---------|---------|
| 30 patterns | Bitmask, LRU Cache, MVCC, Work Stealing, Actor Model, and 25 more |
| 60 exercises | Basic + intermediate for every pattern, real-world scenarios |
| 100+ challenge questions | "Guess what happens" scenario Q&A to test understanding |
| 6 system case studies | How React, Redis, Go, Linux, PostgreSQL, Kafka compose patterns |
| 4 languages | TypeScript, Go, Python, Rust — idiomatic implementations |
| Bilingual | Full English + Chinese documentation |

## Quick Start

```bash
git clone https://github.com/Totoro-jam/battle-tested-patterns.git
cd battle-tested-patterns && pnpm install

pnpm test                         # TypeScript exercises (Vitest)
cd exercises/rust && cargo test   # Rust exercises
cd exercises/go && go test ./...  # Go exercises
pnpm dev                          # Local docs site
```

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md). The bar is intentionally high:

1. **≥ 2 production proofs** with verified, line-number-precise source links
2. **TypeScript + ≥ 1 other language** — idiomatic, not translated
3. **≥ 2 exercises** with tests that pass
4. Source links checked weekly by CI — broken links auto-open an Issue

## License

[MIT](LICENSE) © Totoro-jam
