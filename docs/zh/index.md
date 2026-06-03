---
layout: home

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
      link: /zh/patterns/bitmask/

features:
  - icon: 🎮
    title: 交互式可视化
    details: 每个模式都配有动手操作的 SVG 可视化。点击、拖拽、实验——通过亲身操作建立直觉，而非只是阅读。
  - icon: 🔗
    title: 生产验证
    details: 每个模式附带精确到行号的 GitHub 源码链接，证明它在真实项目中被使用。
  - icon: 🌍
    title: 多语言实现
    details: TypeScript、Rust、Go、Python 的地道实现——不是机械翻译，而是每种语言的原生表达。
  - icon: 🧪
    title: 可运行练习
    details: 渐进式练习（基础 → 进阶 → 高级），配套测试用例，本地即可运行。
  - icon: 🧠
    title: 挑战题
    details: 每个模式包含 3-4 个场景化"你猜会怎样"题目，验证真正理解而非泛泛浏览。
  - icon: 🔀
    title: 真实系统案例
    details: 看 React、Redis、Go runtime、Linux、PostgreSQL、Kafka 如何在生产中组合使用多个模式。
---

## 编程模式

| 模式 | 核心洞察 | 来源项目 |
|------|---------|---------|
| [位掩码 (Bitmask)](/zh/patterns/bitmask/) | 将多个布尔标志压缩到一个整数中 | React, Linux, Chromium |
| [双缓冲 (Double Buffering)](/zh/patterns/double-buffering/) | 在两份副本间切换以实现原子更新 | React Fiber, GPU, PostgreSQL |
| [协作调度 (Cooperative Scheduling)](/zh/patterns/cooperative-scheduling/) | 主动让出控制权以保持响应 | React, Go Runtime |
| [最小堆 (Min Heap)](/zh/patterns/min-heap/) | O(1) 访问最高优先级元素 | React Scheduler, Linux CFS, Node.js |
| [差异/补丁 (Diff/Patch)](/zh/patterns/diff-patch/) | 计算两个状态之间的最小变更 | React Reconciler, Git |
| [对象池 (Object Pool)](/zh/patterns/object-pool/) | 预分配并复用对象，避免 GC | Go sync.Pool, Godot |
| [环形缓冲区 (Ring Buffer)](/zh/patterns/ring-buffer/) | 固定大小循环队列，零分配 | LMAX Disruptor, Linux ftrace |
| [状态机 (State Machine)](/zh/patterns/state-machine/) | 显式状态+转换，不可能状态不可表达 | XState, Linux TCP |
| [写时复制 (Copy-on-Write)](/zh/patterns/copy-on-write/) | 引用共享，修改时才复制 | Git 对象, Rust Cow |
| [观察者 (Observer)](/zh/patterns/observer/) | 订阅事件，通知时无耦合 | Node EventEmitter, Redux |
| [迭代器 (Iterator)](/zh/patterns/iterator/) | 惰性处理序列，零中间分配 | Rust Iterator, Python 生成器 |
| [信号量 (Semaphore)](/zh/patterns/semaphore/) | 用计数器限制并发操作 | Linux 内核, Go x/sync |
| [批处理 (Batch Processing)](/zh/patterns/batch-processing/) | 累积操作批量执行提升吞吐 | Kafka, React batched setState |
| [指数退避重试 (Retry)](/zh/patterns/retry-backoff/) | 指数增长延迟重试 + 抖动 | Kubernetes, gRPC |
| [享元/驻留 (Flyweight)](/zh/patterns/flyweight/) | 共享相同对象，避免重复分配 | Python 整数缓存, V8 |
| [布隆过滤器 (Bloom Filter)](/zh/patterns/bloom-filter/) | 概率集合成员测试——零漏判 | LevelDB, Chromium Blink |
| [熔断器 (Circuit Breaker)](/zh/patterns/circuit-breaker/) | 停止调用故障服务，快速失败 | Netflix Hystrix, Sony gobreaker |
| [Arena 分配器](/zh/patterns/arena-allocator/) | 区域内推进指针分配，一次性释放 | Rust bumpalo, jemalloc |
| [背压 (Backpressure)](/zh/patterns/backpressure/) | 消费者跟不上时减慢生产者 | Node.js Streams, Reactive Streams |
| [预写日志 (WAL)](/zh/patterns/write-ahead-log/) | 应用前先记录变更，崩溃可恢复 | etcd, PostgreSQL |
| [LRU 缓存](/zh/patterns/lru-cache/) | 淘汰最近最少使用，O(1) get/put | Go groupcache, Linux 内核 |
| [一致性哈希](/zh/patterns/consistent-hashing/) | 添加/移除节点只重映射约 1/n 的键 | Go groupcache, HAProxy |
| [Trie 前缀树](/zh/patterns/trie/) | 按键长度 O(k) 查找，共享前缀共享节点 | Linux FIB, Redis rax |
| [跳表](/zh/patterns/skip-list/) | 概率 O(log n) 有序结构 | Redis 有序集合, LevelDB |
| [限流器](/zh/patterns/rate-limiter/) | 令牌桶控制吞吐量，支持突发 | Go x/time/rate, Nginx |
| [工作窃取](/zh/patterns/work-stealing/) | 空闲线程从繁忙线程窃取任务 | Go runtime, Tokio |
| [MVCC](/zh/patterns/mvcc/) | 带时间戳的版本让读者永不阻塞写者 | PostgreSQL, etcd |
| [空闲链表](/zh/patterns/free-list/) | 已释放槽位链表实现 O(1) 分配/释放 | Go runtime, Linux SLUB |
| [依赖图](/zh/patterns/dependency-graph/) | DAG + 拓扑排序确定合法执行顺序 | Cargo, pnpm |
| [Actor 模型](/zh/patterns/actor-model/) | 私有状态 + 信箱，无共享状态 | Akka, Erlang/OTP |
| [引用计数](/zh/patterns/reference-counting/) | 零引用自动清理，确定性生命周期 | CPython, Rust Arc |
| [逻辑时钟](/zh/patterns/logical-clock/) | 单调递增计数器排序事件，无需墙钟 | etcd, LevelDB |
| [事件循环](/zh/patterns/event-loop/) | 单线程 I/O 多路复用 epoll/kqueue | libuv, Redis |
| [中间件链](/zh/patterns/middleware-chain/) | 可组合处理器：预处理→下一个→后处理 | gRPC, Koa.js |
| [B+ 树](/zh/patterns/b-plus-tree/) | 高扇出平衡树，叶节点链表支持范围扫描 | PostgreSQL, SQLite |
| [墓碑删除](/zh/patterns/tombstone/) | 标记删除，后台回收——延迟删除 | LevelDB, Cassandra |
| [注册表](/zh/patterns/registry/) | 按名注册，运行时发现 | TensorFlow, gRPC |
| [脏标记](/zh/patterns/dirty-flag/) | 变更时标脏，按需重算 | Chromium, React |
| [标签联合 (Tagged Union)](/zh/patterns/tagged-union/) | 类型标签 + 联合体，安全的多类型分发 | Godot Variant, PyTorch IValue |
| [驻留 (Interning)](/zh/patterns/interning/) | 去重不可变值，指针比较实现 O(1) 等值判断 | Rust 编译器, CPython |
| [虚函数表 (Vtable)](/zh/patterns/vtable/) | 函数指针结构体实现手动多态 | Linux 内核, CPython |
| [访问者 (Visitor)](/zh/patterns/visitor/) | 对树节点分发类型特定回调 | LLVM, Vue 编译器 |
| [默克尔树 (Merkle Tree)](/zh/patterns/merkle-tree/) | 哈希对逐层上推至根，O(log n) 完整性证明 | Git, ZFS |
| [归并迭代器 (Merge Iterator)](/zh/patterns/merge-iterator/) | 最小堆实现 K 路有序流合并 | LevelDB, RocksDB |
| [LSM 树](/zh/patterns/lsm-tree/) | 写入缓冲在内存，刷入有序文件，后台合并 | LevelDB, RocksDB |
| [检查点 (Checkpointing)](/zh/patterns/checkpointing/) | 周期性快照状态，从检查点恢复 | PostgreSQL, Redis |
