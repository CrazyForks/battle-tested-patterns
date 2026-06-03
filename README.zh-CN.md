<div align="center">

# Battle-Tested Patterns

**从顶级开源项目源码中提炼的代码级编程模式。**

每个模式附带精确到行号的源码链接 · 多语言实现 · 可运行练习

[📖 Documentation](https://totoro-jam.github.io/battle-tested-patterns/) · [📖 中文文档](https://totoro-jam.github.io/battle-tested-patterns/zh/)

[English](README.md) | 简体中文

[![CI](https://github.com/Totoro-jam/battle-tested-patterns/actions/workflows/ci.yml/badge.svg)](https://github.com/Totoro-jam/battle-tested-patterns/actions/workflows/ci.yml)
[![Deploy](https://github.com/Totoro-jam/battle-tested-patterns/actions/workflows/deploy.yml/badge.svg)](https://github.com/Totoro-jam/battle-tested-patterns/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](.github/CONTRIBUTING.md)

</div>

## 30 个模式速览

<table>
<tr>
<td width="33%">

**🧠 数据结构**
- [Bitmask](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/bitmask/) — 标志位压缩
- [Min Heap](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/min-heap/) — 优先队列
- [Ring Buffer](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/ring-buffer/) — 定长 FIFO
- [Trie](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/trie/) — 前缀搜索
- [Skip List](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/skip-list/) — 概率有序
- [Bloom Filter](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/bloom-filter/) — 集合判存
- [LRU Cache](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/lru-cache/) — 淘汰策略

</td>
<td width="33%">

**⚡ 并发**
- [Semaphore](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/semaphore/) — 有界访问
- [Actor Model](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/actor-model/) — 消息传递
- [Work Stealing](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/work-stealing/) — 负载均衡
- [MVCC](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/mvcc/) — 快照隔离
- [Cooperative Scheduling](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/cooperative-scheduling/) — 协作让出
- [Double Buffering](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/double-buffering/) — 原子交换
- [Backpressure](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/backpressure/) — 流量控制
- [Event Loop](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/event-loop/) — I/O 多路复用
- [Logical Clock](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/logical-clock/) — 事件排序

</td>
<td width="33%">

**🏗️ 系统**
- [Circuit Breaker](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/circuit-breaker/) — 容错
- [Rate Limiter](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/rate-limiter/) — 限流
- [Retry Backoff](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/retry-backoff/) — 弹性
- [Write-Ahead Log](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/write-ahead-log/) — 持久性
- [Batch Processing](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/batch-processing/) — 吞吐
- [Consistent Hashing](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/consistent-hashing/) — 分布
- [Dependency Graph](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/dependency-graph/) — 排序
- [Middleware Chain](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/middleware-chain/) — 管道

</td>
</tr>
<tr>
<td>

**♻️ 内存**
- [Object Pool](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/object-pool/) — 复用实例
- [Flyweight](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/flyweight/) — 共享不可变
- [Arena Allocator](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/arena-allocator/) — bump 分配
- [Free List](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/free-list/) — O(1) 分配释放
- [Copy-on-Write](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/copy-on-write/) — 延迟复制
- [Reference Counting](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/reference-counting/) — 自动清理

</td>
<td>

**🔄 行为型**
- [State Machine](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/state-machine/) — 状态转换
- [Observer](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/observer/) — 发布订阅
- [Iterator](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/iterator/) — 惰性求值
- [Diff / Patch](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/diff-patch/) — 最小编辑

</td>
<td>

**📊 验证来源**
- React · Linux · Go
- Redis · PostgreSQL
- Kafka · Chromium
- Tokio · Erlang/OTP
- LevelDB · etcd
- Nginx · Akka

</td>
</tr>
</table>

## 填补什么空白

| 现有资源 | 缺失的部分 |
|---------|-----------|
| 设计模式书 | 太抽象，过于 OOP |
| 算法仓库 | 脱离工程实践 |
| 系统设计指南 | 架构层面，不涉及代码级 |

本项目：**从 React、Linux、Go、Chromium 等项目中提取的代码级技巧——每个都有可验证的源码链接**。

## 编程模式

| 模式 | 做什么 | 验证来源 |
|------|--------|---------|
| [**位掩码**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/bitmask/) | 将 N 个标志打包到一个整数，O(1) 检查任意组合 | [React Flags](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberFlags.js#L14-L36) · [Linux stat.h](https://github.com/torvalds/linux/blob/master/include/uapi/linux/stat.h#L25-L33)|
| [**双缓冲**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/double-buffering/) | 原子交换两份副本，零分配 | [React Fiber](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiber.js#L327-L355) · [SDL](https://github.com/libsdl-org/SDL/blob/main/src/render/SDL_render.c)|
| [**协作调度**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/cooperative-scheduling/) | 在工作块之间让出控制权保持响应 | [React Scheduler](https://github.com/facebook/react/blob/main/packages/scheduler/src/forks/Scheduler.js#L188-L258) · [Go Runtime](https://github.com/golang/go/blob/master/src/runtime/proc.go#L4143-L4200)|
| [**最小堆**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/min-heap/) | O(1) 查看最高优先级，O(log n) 插入/删除 | [React MinHeap](https://github.com/facebook/react/blob/main/packages/scheduler/src/SchedulerMinHeap.js#L17-L90) · [Linux CFS](https://github.com/torvalds/linux/blob/master/kernel/sched/fair.c#L1407-L1460)|
| [**差异/补丁**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/diff-patch/) | 计算两个序列之间的最小编辑 | [React Reconciler](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactChildFiber.js#L1169-L1340) · [Git](https://github.com/git/git/blob/master/diff.c#L5020-L5060)|
| [**对象池**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/object-pool/) | 预分配复用对象，避免 GC 压力 | [Go sync.Pool](https://github.com/golang/go/blob/master/src/sync/pool.go#L52-L97) · [Godot](https://github.com/godotengine/godot/blob/master/core/templates/pooled_list.h#L35-L100)|
| [**环形缓冲区**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/ring-buffer/) | 固定大小循环队列，零分配 | [LMAX Disruptor](https://github.com/LMAX-Exchange/disruptor/blob/master/src/main/java/com/lmax/disruptor/RingBuffer.java#L84-L130) · [Linux](https://github.com/torvalds/linux/blob/master/include/linux/ring_buffer.h#L12-L70)|
| [**状态机**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/state-machine/) | 显式状态，不可能的转换不存在 | [XState](https://github.com/statelyai/xstate/blob/main/packages/core/src/StateMachine.ts#L58-L120) · [Linux TCP](https://github.com/torvalds/linux/blob/master/net/ipv4/tcp_input.c#L4865-L4920)|
| [**写时复制**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/copy-on-write/) | 引用共享，修改时才复制 | [Git objects](https://github.com/git/git/blob/master/object-file.c#L719-L730) · [Rust Cow](https://github.com/rust-lang/rust/blob/main/library/alloc/src/borrow.rs#L169-L220)|
| [**观察者**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/observer/) | 订阅事件，生产者消费者解耦 | [Node EventEmitter](https://github.com/nodejs/node/blob/main/lib/events.js#L456-L520) · [Redux](https://github.com/reduxjs/redux/blob/master/src/createStore.ts#L211-L280)|
| [**迭代器**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/iterator/) | 惰性序列，零中间分配 | [Rust Iterator](https://github.com/rust-lang/rust/blob/main/library/core/src/iter/traits/iterator.rs#L68-L112) · [Python gen](https://github.com/python/cpython/blob/main/Objects/genobject.c)|
| [**信号量**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/semaphore/) | 计数器限制并发 | [Linux](https://github.com/torvalds/linux/blob/master/include/linux/semaphore.h#L15-L55) · [Go x/sync](https://github.com/golang/sync/blob/master/semaphore/semaphore.go)|
| [**批处理**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/batch-processing/) | 累积操作批量执行 | [Kafka](https://github.com/apache/kafka/blob/trunk/clients/src/main/java/org/apache/kafka/clients/producer/internals/RecordAccumulator.java#L69-L120)|
| [**指数退避重试**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/retry-backoff/) | 指数延迟 + 抖动重试 | [Kubernetes](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/apimachinery/pkg/util/wait/backoff.go#L30-L50) · [gRPC](https://github.com/grpc/grpc/blob/master/doc/connection-backoff.md)|
| [**享元/驻留**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/flyweight/) | 共享相同对象避免重复 | [Python int cache](https://github.com/python/cpython/blob/main/Objects/longobject.c#L61-L75)|
| [**布隆过滤器**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/bloom-filter/) | 概率集合成员测试，零漏判 | [LevelDB](https://github.com/google/leveldb/blob/main/util/bloom.cc#L17-L80) · [Chromium](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/css/selector_filter.h#L149-L175)|
| [**熔断器**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/circuit-breaker/) | 停止调用故障服务，快速失败 | [Hystrix](https://github.com/Netflix/Hystrix/blob/master/hystrix-core/src/main/java/com/netflix/hystrix/HystrixCircuitBreaker.java#L138-L289) · [gobreaker](https://github.com/sony/gobreaker/blob/master/gobreaker.go#L117-L131)|
| [**Arena 分配器**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/arena-allocator/) | 区域内推进指针分配，一次性释放 | [bumpalo](https://github.com/fitzgen/bumpalo/blob/main/src/lib.rs#L378-L383) · [Go arena](https://github.com/golang/go/blob/master/src/arena/arena.go#L44-L67)|
| [**背压**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/backpressure/) | 消费者跟不上时减慢生产者 | [Node.js Streams](https://github.com/nodejs/node/blob/main/lib/internal/streams/writable.js#L312-L370) · [Reactive Streams](https://github.com/reactive-streams/reactive-streams-jvm/blob/master/api/src/main/java/org/reactivestreams/Subscription.java#L25-L45)|
| [**预写日志**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/write-ahead-log/) | 应用前先记录变更，崩溃可恢复 | [etcd](https://github.com/etcd-io/etcd/blob/main/server/storage/wal/wal.go#L72-L95) · [PostgreSQL](https://github.com/postgres/postgres/blob/master/src/backend/access/transam/xlog.c)|
| [**LRU 缓存**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/lru-cache/) | 淘汰最近最少使用，O(1) get/put | [groupcache](https://github.com/golang/groupcache/blob/master/lru/lru.go#L28-L76) · [Linux](https://github.com/torvalds/linux/blob/master/include/linux/list_lru.h#L15-L55)|
| [**一致性哈希**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/consistent-hashing/) | 添加/移除节点只重映射约 1/n | [groupcache](https://github.com/golang/groupcache/blob/master/consistenthash/consistenthash.go#L28-L81) · [HAProxy](https://github.com/haproxy/haproxy/blob/master/src/lb_chash.c#L415-L491)|
| [**Trie 前缀树**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/trie/) | 按键长度 O(k) 查找 | [Linux FIB](https://github.com/torvalds/linux/blob/master/net/ipv4/fib_trie.c#L80-L120) · [Redis rax](https://github.com/redis/redis/blob/unstable/src/rax.h#L80-L130)|
| [**跳表**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/skip-list/) | 概率 O(log n) 有序结构 | [Redis](https://github.com/redis/redis/blob/unstable/src/t_zset.c#L70-L130) · [LevelDB](https://github.com/google/leveldb/blob/main/db/skiplist.h#L40-L90)|
| [**限流器**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/rate-limiter/) | 令牌桶控制吞吐量 | [Go rate](https://github.com/golang/time/blob/master/rate/rate.go#L57-L66) · [Nginx](https://github.com/nginx/nginx/blob/master/src/http/modules/ngx_http_limit_req_module.c#L405-L532)|
| [**工作窃取**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/work-stealing/) | 空闲线程从繁忙队列窃取 | [Go proc.go](https://github.com/golang/go/blob/master/src/runtime/proc.go#L3836-L3903) · [Tokio](https://github.com/tokio-rs/tokio/blob/master/tokio/src/runtime/scheduler/multi_thread/worker.rs#L1136-L1175)|
| [**MVCC**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/mvcc/) | 带时间戳版本，读者不阻塞 | [PostgreSQL](https://github.com/postgres/postgres/blob/master/src/backend/access/heap/heapam_visibility.c#L917-L1096) · [etcd](https://github.com/etcd-io/etcd/blob/main/server/storage/mvcc/kvstore.go#L53-L135)|
| [**空闲链表**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/free-list/) | O(1) 分配/释放 | [Go mfixalloc](https://github.com/golang/go/blob/master/src/runtime/mfixalloc.go#L31-L109) · [Linux SLUB](https://github.com/torvalds/linux/blob/master/mm/slub.c#L530-L551)|
| [**依赖图**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/dependency-graph/) | DAG + 拓扑排序 | [Cargo](https://github.com/rust-lang/cargo/blob/master/src/cargo/core/resolver/dep_cache.rs#L1-L50) · [pnpm](https://github.com/pnpm/pnpm/blob/main/pkg-manager/sort-packages/src/index.ts)|
| [**Actor 模型**](https://totoro-jam.github.io/battle-tested-patterns/zh/patterns/actor-model/) | 私有状态+信箱，无锁 | [Akka](https://github.com/akka/akka/blob/main/akka-actor/src/main/scala/akka/actor/Actor.scala#L476-L547) · [Erlang/OTP](https://github.com/erlang/otp/blob/master/erts/emulator/beam/erl_process.h#L1043-L1205)|

> 每个"验证来源"链接都指向源代码的**精确行号**。不是目录，不是文件，是行。

## 模式长什么样

每个模式遵循一致的结构——以**位掩码**为例：

```text
  比特位:          7    6    5    4    3    2    1    0
                ┌────┬────┬────┬────┬────┬────┬────┬────┐
  标志:         │    │    │    │ SN │ CB │ RF │ UP │ PL │
                └────┴────┴────┴──┬─┴──┬─┴──┬─┴──┬─┴──┬─┘
                                  │    │    │    │    └── Placement  (1 << 0)
                                  │    │    │    └─────── Update     (1 << 1)
                                  │    │    └──────────── Ref        (1 << 2)
                                  │    └───────────────── Callback   (1 << 3)
                                  └────────────────────── Snapshot   (1 << 4)
```

4 种语言实现，各自地道：

```typescript
// TypeScript                          // Python
const READ  = 1 << 0;                  READ  = 1 << 0
const WRITE = 1 << 1;                  WRITE = 1 << 1
const perms = READ | WRITE;            perms = READ | WRITE
(perms & READ) !== 0;  // true         bool(perms & READ)  # True
```

然后是 2 个难度等级的练习——全部配套可运行测试。

## 项目亮点

| 特性 | 详情 |
|------|------|
| 30 个模式 | Bitmask、LRU Cache、MVCC、Work Stealing、Actor Model 等 |
| 60 个练习 | 每个模式 basic + intermediate，真实场景 |
| 100+ 挑战题 | "你猜会怎样"场景问答，验证真正理解 |
| 6 个系统案例 | React、Redis、Go、Linux、PostgreSQL、Kafka 如何组合模式 |
| 4 种语言 | TypeScript、Go、Python、Rust 地道实现 |
| 双语 | 完整中英文文档 |

## 快速开始

```bash
git clone https://github.com/Totoro-jam/battle-tested-patterns.git
cd battle-tested-patterns && pnpm install

pnpm test                         # TypeScript 练习 (Vitest)
cd exercises/rust && cargo test   # Rust 练习
cd exercises/go && go test ./...  # Go 练习
pnpm dev                          # 本地文档站
```

## 参与贡献

详见 [CONTRIBUTING.md](.github/CONTRIBUTING.md)（[中文版](.github/CONTRIBUTING.zh-CN.md)）。门槛不低：

1. **≥ 2 个生产验证** — 精确到行号的已验证源码链接
2. **TypeScript + ≥ 1 种其他语言** — 地道实现，不是翻译
3. **≥ 2 个练习** — 配套测试且通过
4. 源码链接每周由 CI 自动检查——失效链接自动开 Issue

## 许可证

[MIT](LICENSE) © Totoro-jam
