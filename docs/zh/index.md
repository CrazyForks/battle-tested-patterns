---
layout: home
description: "46 个经过生产验证的编程模式，源自 React、Linux、Go、Chromium — 交互式可视化、精确源码链接、多语言实现、可运行练习。"

hero:
  name: Battle-Tested Patterns
  text: 生产验证的编程模式
  tagline: 源自 React、Linux、Go、Chromium 等顶级项目的实战经验。交互式可视化、精确源码链接、多语言实现。
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/guide/what-is-this
    - theme: alt
      text: 浏览模式
      link: /zh/patterns/
    - theme: alt
      text: 面试指南
      link: /zh/guide/interview

features:
  - icon:
      src: /images/interactive_visualizations.png
      width: 80
      height: 80
    title: 交互式可视化
    details: 每个模式都配有动手操作的 SVG 可视化。点击、拖拽、实验——通过亲身操作建立直觉，而非只是阅读。
  - icon:
      src: /images/production_proof.png
      width: 80
      height: 80
    title: 生产验证
    details: 每个模式附带精确到行号的 GitHub 源码链接，证明它在真实项目中被使用。
  - icon:
      src: /images/multi-language.png
      width: 80
      height: 80
    title: 多语言实现
    details: TypeScript、Rust、Go、Python 的地道实现——不是机械翻译，而是每种语言的原生表达。
  - icon:
      src: /images/runnable_exercises.png
      width: 80
      height: 80
    title: 可运行练习
    details: 渐进式练习（基础 → 进阶 → 高级），配套测试用例，本地即可运行。
  - icon:
      src: /images/challengequestions.png
      width: 80
      height: 80
    title: 挑战题
    details: 每个模式包含 3-4 个场景化"你猜会怎样"题目，验证真正理解而非泛泛浏览。
  - icon:
      src: /images/real_system_case.png
      width: 80
      height: 80
    title: 真实系统案例
    details: 看 React、Redis、Go runtime、Linux、PostgreSQL、Kafka 如何在生产中组合使用多个模式。
---

## 46 个模式，5 大分类

### 数据结构

| 模式 | 核心洞察 | 来源项目 |
|------|---------|---------|
| [位掩码 (Bitmask)](/zh/patterns/bitmask/) | 将多个标志压缩到一个整数 | React, Linux, Chromium |
| [最小堆 (Min Heap)](/zh/patterns/min-heap/) | O(1) 访问最高优先级元素 | React Scheduler, Linux CFS |
| [环形缓冲区 (Ring Buffer)](/zh/patterns/ring-buffer/) | 固定大小循环队列，零分配 | LMAX Disruptor, Linux |
| [Trie 前缀树](/zh/patterns/trie/) | 按键长度 O(k) 查找，共享前缀 | Linux FIB, Redis rax |
| [跳表 (Skip List)](/zh/patterns/skip-list/) | 概率 O(log n) 有序结构 | Redis, LevelDB |
| [布隆过滤器 (Bloom Filter)](/zh/patterns/bloom-filter/) | 概率成员测试——零漏判 | LevelDB, Chromium |
| [LRU 缓存](/zh/patterns/lru-cache/) | 淘汰最少使用，O(1) get/put | Go groupcache, Linux |
| [B+ 树](/zh/patterns/b-plus-tree/) | 叶链平衡树，支持范围扫描 | PostgreSQL, SQLite |
| [标签联合 (Tagged Union)](/zh/patterns/tagged-union/) | 类型标签 + 联合体安全分发 | Godot, PyTorch |
| [默克尔树 (Merkle Tree)](/zh/patterns/merkle-tree/) | 哈希逐层上推，O(log n) 完整性证明 | Git, ZFS |
| [归并迭代器 (Merge Iterator)](/zh/patterns/merge-iterator/) | 最小堆实现 K 路有序流合并 | LevelDB, RocksDB |

### 并发

| 模式 | 核心洞察 | 来源项目 |
|------|---------|---------|
| [信号量 (Semaphore)](/zh/patterns/semaphore/) | 计数器限制并发操作 | Linux, Go x/sync |
| [Actor 模型](/zh/patterns/actor-model/) | 私有状态 + 信箱，无共享 | Akka, Erlang/OTP |
| [工作窃取 (Work Stealing)](/zh/patterns/work-stealing/) | 空闲线程从繁忙队列窃取 | Go runtime, Tokio |
| [MVCC](/zh/patterns/mvcc/) | 版本化读永不阻塞写 | PostgreSQL, etcd |
| [协作调度](/zh/patterns/cooperative-scheduling/) | 主动让出控制权保持响应 | React, Go Runtime |
| [双缓冲 (Double Buffering)](/zh/patterns/double-buffering/) | 交换两份副本原子更新 | React Fiber, GPU |
| [背压 (Backpressure)](/zh/patterns/backpressure/) | 消费者慢时减慢生产者 | Node.js Streams, Reactive Streams |
| [事件循环 (Event Loop)](/zh/patterns/event-loop/) | 单线程 I/O 多路复用 | libuv, Redis |
| [逻辑时钟 (Logical Clock)](/zh/patterns/logical-clock/) | 无需墙钟排序事件 | etcd, LevelDB |

### 系统

| 模式 | 核心洞察 | 来源项目 |
|------|---------|---------|
| [熔断器 (Circuit Breaker)](/zh/patterns/circuit-breaker/) | 停止调用故障服务，快速失败 | Netflix Hystrix, gobreaker |
| [限流器 (Rate Limiter)](/zh/patterns/rate-limiter/) | 令牌桶控制吞吐量 | Go x/time/rate, Nginx |
| [指数退避重试 (Retry)](/zh/patterns/retry-backoff/) | 指数延迟 + 抖动 | Kubernetes, gRPC |
| [预写日志 (WAL)](/zh/patterns/write-ahead-log/) | 先记录再应用，崩溃可恢复 | etcd, PostgreSQL |
| [批处理 (Batch Processing)](/zh/patterns/batch-processing/) | 累积操作批量执行 | Kafka, React |
| [一致性哈希](/zh/patterns/consistent-hashing/) | 增删节点只重映射 ~1/n 的键 | Go groupcache, HAProxy |
| [依赖图 (Dependency Graph)](/zh/patterns/dependency-graph/) | DAG + 拓扑排序 | Cargo, pnpm |
| [中间件链 (Middleware Chain)](/zh/patterns/middleware-chain/) | 可组合的前/后处理器 | gRPC, Koa.js |
| [注册表 (Registry)](/zh/patterns/registry/) | 按名注册，运行时发现 | TensorFlow, gRPC |
| [脏标记 (Dirty Flag)](/zh/patterns/dirty-flag/) | 标脏后按需重算 | Chromium, React |
| [LSM 树](/zh/patterns/lsm-tree/) | 写入缓冲，刷入有序文件 | LevelDB, RocksDB |
| [检查点 (Checkpointing)](/zh/patterns/checkpointing/) | 快照状态，从检查点恢复 | PostgreSQL, Redis |

### 内存

| 模式 | 核心洞察 | 来源项目 |
|------|---------|---------|
| [对象池 (Object Pool)](/zh/patterns/object-pool/) | 预分配复用避免 GC | Go sync.Pool, Godot |
| [享元 (Flyweight)](/zh/patterns/flyweight/) | 跨使用方共享相同对象 | Python 整数缓存, V8 |
| [Arena 分配器](/zh/patterns/arena-allocator/) | 区域内推进指针，一次性释放 | Rust bumpalo, Go |
| [空闲链表 (Free List)](/zh/patterns/free-list/) | 链表已释放槽位 O(1) 分配/释放 | Go runtime, Linux SLUB |
| [写时复制 (Copy-on-Write)](/zh/patterns/copy-on-write/) | 引用共享，修改时才复制 | Git, Rust Cow |
| [引用计数 (Reference Counting)](/zh/patterns/reference-counting/) | 零引用自动清理 | CPython, Rust Arc |
| [墓碑 (Tombstone)](/zh/patterns/tombstone/) | 标记删除，后台回收 | LevelDB, Cassandra |
| [驻留 (Interning)](/zh/patterns/interning/) | 去重值，O(1) 等值判断 | Rust 编译器, CPython |

### 行为型

| 模式 | 核心洞察 | 来源项目 |
|------|---------|---------|
| [状态机 (State Machine)](/zh/patterns/state-machine/) | 显式状态，不可能转换不可表达 | XState, Linux TCP |
| [观察者 (Observer)](/zh/patterns/observer/) | 订阅事件，解耦生产消费 | Node EventEmitter, Redux |
| [迭代器 (Iterator)](/zh/patterns/iterator/) | 惰性序列，零中间分配 | Rust Iterator, Python |
| [差异/补丁 (Diff/Patch)](/zh/patterns/diff-patch/) | 计算两个状态间最小变更 | React Reconciler, Git |
| [虚函数表 (Vtable)](/zh/patterns/vtable/) | 函数指针结构体实现多态 | Linux 内核, CPython |
| [访问者 (Visitor)](/zh/patterns/visitor/) | 对树节点分发类型特定回调 | LLVM, Vue 编译器 |
