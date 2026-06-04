---
description: "按场景查找模式 — Web API、数据库、分布式系统、前端、编译器等。"
---

# 使用场景

按你正在构建的系统类型查找模式。

## Web API 与微服务

构建 REST/gRPC 服务？这些模式让它在负载下保持可靠。

| 场景 | 模式 | 实际案例 |
|---|---|---|
| 防护下游故障 | [Circuit Breaker](/zh/patterns/circuit-breaker/) + [Retry with Backoff](/zh/patterns/retry-backoff/) | Netflix Hystrix 包装每个 HTTP 客户端调用 |
| API 限流 | [Rate Limiter](/zh/patterns/rate-limiter/) | Stripe 允许 25 个突发，以 25/秒补充 |
| 请求中间件（认证、日志、追踪） | [Middleware Chain](/zh/patterns/middleware-chain/) | gRPC 拦截器，Koa.js 洋葱模型 |
| 服务发现 | [Registry](/zh/patterns/registry/) | Consul、etcd 服务注册 |
| 节点间负载分配 | [Consistent Hashing](/zh/patterns/consistent-hashing/) | HAProxy、groupcache 键分布 |
| 防止过载 | [Backpressure](/zh/patterns/backpressure/) + [Batch Processing](/zh/patterns/batch-processing/) | Node.js stream piping，Kafka 消费者组 |

## 数据库与存储

PostgreSQL、Redis、LevelDB 以及所有严肃存储引擎背后的模式。

| 场景 | 模式 | 实际案例 |
|---|---|---|
| 崩溃恢复 | [WAL](/zh/patterns/write-ahead-log/) + [Checkpointing](/zh/patterns/checkpointing/) | PostgreSQL：WAL + 定期 checkpoint |
| 写密集负载 | [LSM Tree](/zh/patterns/lsm-tree/) + [Bloom Filter](/zh/patterns/bloom-filter/) | LevelDB/RocksDB：memtable → SSTable + bloom 跳过 |
| 磁盘范围查询 | [B+ Tree](/zh/patterns/b-plus-tree/) | PostgreSQL btree 索引，SQLite |
| 并发读写 | [MVCC](/zh/patterns/mvcc/) | PostgreSQL 元组版本化，etcd 修订版 |
| 数据完整性验证 | [Merkle Tree](/zh/patterns/merkle-tree/) | ZFS 块校验和，Git 对象存储 |
| 有序键合并 | [Merge Iterator](/zh/patterns/merge-iterator/) + [Min Heap](/zh/patterns/min-heap/) | LevelDB compaction |
| 删除但不立即移除 | [Tombstone](/zh/patterns/tombstone/) | Cassandra tombstone，LevelDB 删除标记 |
| 内存缓存 | [LRU Cache](/zh/patterns/lru-cache/) | Redis LRU 淘汰，Go groupcache |
| 无时钟事件排序 | [Logical Clock](/zh/patterns/logical-clock/) | etcd Raft log，DynamoDB 版本向量 |

## 前端与 UI 框架

React、Vue 和浏览器引擎在每一帧中使用这些模式。

| 场景 | 模式 | 实际案例 |
|---|---|---|
| Virtual DOM diffing | [Diff / Patch](/zh/patterns/diff-patch/) + [Bitmask](/zh/patterns/bitmask/) | React reconciler：diff 树，应用最小补丁 |
| 响应式渲染 | [Cooperative Scheduling](/zh/patterns/cooperative-scheduling/) | React Scheduler：每 5ms 让出以保持 16ms 内 |
| 帧安全状态更新 | [Double Buffering](/zh/patterns/double-buffering/) | React Fiber：workInProgress ↔ current 树交换 |
| 避免不必要的重渲染 | [Dirty Flag](/zh/patterns/dirty-flag/) | React shouldComponentUpdate，Chromium layout |
| 状态管理 | [Observer](/zh/patterns/observer/) + [State Machine](/zh/patterns/state-machine/) | Redux subscribe，XState 有限状态 |
| 优先级任务调度 | [Min Heap](/zh/patterns/min-heap/) | React Scheduler 优先级队列 |

## 分布式系统

跨多台机器的系统模式。

| 场景 | 模式 | 实际案例 |
|---|---|---|
| 共识日志 | [WAL](/zh/patterns/write-ahead-log/) + [Logical Clock](/zh/patterns/logical-clock/) | etcd Raft：带 term/index 的追加日志 |
| 分区容错路由 | [Consistent Hashing](/zh/patterns/consistent-hashing/) | Amazon DynamoDB，Cassandra ring |
| 复制状态 | [State Machine](/zh/patterns/state-machine/) + [WAL](/zh/patterns/write-ahead-log/) | Raft：通过日志复制状态机 |
| 无冲突复制 | [Logical Clock](/zh/patterns/logical-clock/) + [Tombstone](/zh/patterns/tombstone/) | CRDT，Dynamo 风格 last-write-wins |
| 数据同步 | [Merkle Tree](/zh/patterns/merkle-tree/) | Cassandra 反熵修复 |
| 消息驱动架构 | [Actor Model](/zh/patterns/actor-model/) + [Backpressure](/zh/patterns/backpressure/) | Akka cluster，Erlang/OTP |
| 构建/部署流水线 | [Dependency Graph](/zh/patterns/dependency-graph/) + [Batch Processing](/zh/patterns/batch-processing/) | Cargo 构建图，pnpm workspace |

## 运行时与内存管理

Go、CPython、V8 和游戏引擎如何管理内存和执行。

| 场景 | 模式 | 实际案例 |
|---|---|---|
| 减少 GC 压力 | [Object Pool](/zh/patterns/object-pool/) + [Free List](/zh/patterns/free-list/) | Go sync.Pool，Linux SLUB 分配器 |
| 阶段性分配 | [Arena Allocator](/zh/patterns/arena-allocator/) | Rust bumpalo，Go arena（实验性） |
| 确定性清理 | [Reference Counting](/zh/patterns/reference-counting/) | CPython refcount，Rust Rc/Arc |
| 字符串去重 | [Interning](/zh/patterns/interning/) + [Flyweight](/zh/patterns/flyweight/) | Rust 编译器符号驻留，Python 小整数缓存 |
| 高效克隆 | [Copy-on-Write](/zh/patterns/copy-on-write/) | Linux fork()，Rust `Cow<T>` |
| 跨核工作分配 | [Work Stealing](/zh/patterns/work-stealing/) | Go runtime P/M/G 调度器，Tokio |
| I/O 多路复用 | [Event Loop](/zh/patterns/event-loop/) + [Ring Buffer](/zh/patterns/ring-buffer/) | libuv (Node.js)，Redis 单线程 |
| 线程安全计数器 | [Semaphore](/zh/patterns/semaphore/) | Linux 内核信号量，Go x/sync |

## 编译器与语言工具

LLVM、V8、rustc 以及 Vue/React 编译器中使用的模式。

| 场景 | 模式 | 实际案例 |
|---|---|---|
| AST 遍历 | [Visitor](/zh/patterns/visitor/) | LLVM InstVisitor，Vue 编译器转换 |
| 动态分发 | [Vtable](/zh/patterns/vtable/) | CPython tp_* slots，Rust dyn Trait |
| 符号表 | [Interning](/zh/patterns/interning/) + [Trie](/zh/patterns/trie/) | rustc Symbol interning |
| IR 转换 | [Iterator](/zh/patterns/iterator/) + [Diff / Patch](/zh/patterns/diff-patch/) | Rust Iterator 适配器，tree-sitter edits |
| 类型表示 | [Tagged Union](/zh/patterns/tagged-union/) | V8 tagged pointers，PyTorch TensorImpl |
| 插件系统 | [Registry](/zh/patterns/registry/) + [Middleware Chain](/zh/patterns/middleware-chain/) | Babel 插件，webpack loaders |

## 网络与协议

| 场景 | 模式 | 实际案例 |
|---|---|---|
| 连接状态追踪 | [State Machine](/zh/patterns/state-machine/) | Linux TCP 状态机 (SYN_SENT → ESTABLISHED → ...) |
| IP 路由 | [Trie](/zh/patterns/trie/) | Linux LC-trie IPv4 FIB |
| 报文缓冲 | [Ring Buffer](/zh/patterns/ring-buffer/) | Linux sk_buff，DPDK ring |
| 流控 | [Backpressure](/zh/patterns/backpressure/) + [Rate Limiter](/zh/patterns/rate-limiter/) | TCP 流控，Nginx limit_req |
| DNS 解析 | [Trie](/zh/patterns/trie/) + [LRU Cache](/zh/patterns/lru-cache/) | 域名查找 + 响应缓存 |
