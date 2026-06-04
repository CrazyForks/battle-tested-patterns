---
description: "系统设计与编程面试备战 — 46 个模式映射到面试题型，含示例问答与面试官关注点。"
---

# 面试指南

这些模式在系统设计和编程面试中反复出现。本页将它们映射到你实际会遇到的问题。

## 如何使用本页

1. **找到你准备的面试主题**
2. **阅读链接的模式页面**（理解机制，不只是名字）
3. **运行交互式可视化** — 面试官喜欢能画出来、讲清楚的候选人
4. **做练习题** — 它们的结构类似编程面试题

## 系统设计面试

### "设计一个限流器"

这是最常见的系统设计题。你需要：

| 概念 | 模式 | 怎么说 |
|---|---|---|
| 令牌桶算法 | [Rate Limiter](/zh/patterns/rate-limiter/) | "我会用令牌桶 — 它在保持稳定补充速率的同时处理最多容量的突发" |
| 分布式限流 | [Consistent Hashing](/zh/patterns/consistent-hashing/) | "多节点场景，我会将客户端 IP 哈希到特定限流器实例，避免跨节点协调" |
| 滑动窗口变体 | [Ring Buffer](/zh/patterns/ring-buffer/) | "环形缓冲区可以在滑动窗口变体中追踪请求时间戳" |

### "设计一个缓存"

| 概念 | 模式 | 怎么说 |
|---|---|---|
| 淘汰策略 | [LRU Cache](/zh/patterns/lru-cache/) | "LRU 用双向链表 + 哈希表实现 O(1) 的 get/put/evict" |
| 缓存击穿防护 | [Semaphore](/zh/patterns/semaphore/) | "用信号量让只有一个请求计算值，其他请求等待" |
| 分布式缓存路由 | [Consistent Hashing](/zh/patterns/consistent-hashing/) | "一致性哈希让我增减缓存节点时不需要全量重分配" |
| 负缓存 | [Bloom Filter](/zh/patterns/bloom-filter/) | "前置布隆过滤器避免对确定不存在的键进行缓存查找" |

### "设计一个 KV 存储"

| 概念 | 模式 | 怎么说 |
|---|---|---|
| 写入路径 | [LSM Tree](/zh/patterns/lsm-tree/) | "先写 WAL，再写 memtable。memtable 满时刷到磁盘的有序 SSTable" |
| 读优化 | [Bloom Filter](/zh/patterns/bloom-filter/) | "每个 SSTable 有布隆过滤器 — 跳过确定不包含该键的文件" |
| 崩溃恢复 | [WAL](/zh/patterns/write-ahead-log/) + [Checkpointing](/zh/patterns/checkpointing/) | "WAL 保证持久性。定期检查点限制恢复时间" |
| 压缩合并 | [Merge Iterator](/zh/patterns/merge-iterator/) | "用 min-heap 做 K 路归并有序 SSTable" |
| 删除 | [Tombstone](/zh/patterns/tombstone/) | "不能从不可变 SSTable 中删除 — 写入墓碑标记，稍后压缩" |

### "设计一个分布式数据库"

| 概念 | 模式 | 怎么说 |
|---|---|---|
| 复制 | [WAL](/zh/patterns/write-ahead-log/) + [State Machine](/zh/patterns/state-machine/) | "Raft：复制 WAL 条目，按序应用到状态机" |
| 一致性 | [Logical Clock](/zh/patterns/logical-clock/) | "Lamport 时间戳实现全序，向量时钟实现因果一致性" |
| 分区 | [Consistent Hashing](/zh/patterns/consistent-hashing/) | "一致性哈希 + 虚拟节点实现均匀分布" |
| 反熵 | [Merkle Tree](/zh/patterns/merkle-tree/) | "比较副本间的 Merkle 根，O(log n) 找到差异" |
| 并发读 | [MVCC](/zh/patterns/mvcc/) | "每个事务看到一致快照 — 读者永不阻塞写者" |
| 冲突解决 | [Tombstone](/zh/patterns/tombstone/) + [Logical Clock](/zh/patterns/logical-clock/) | "向量时钟比较做 last-write-wins，墓碑处理删除" |

### "设计一个任务调度器"

| 概念 | 模式 | 怎么说 |
|---|---|---|
| 优先级队列 | [Min Heap](/zh/patterns/min-heap/) | "按截止时间/优先级的最小堆 — O(1) peek，O(log n) insert" |
| 公平调度 | [Work Stealing](/zh/patterns/work-stealing/) | "空闲 worker 从忙碌队列偷取 — Go runtime 就是这么做的" |
| 时间片 | [Cooperative Scheduling](/zh/patterns/cooperative-scheduling/) | "每个任务在时间片后让出 — React Scheduler 这样做来保持 16ms 内" |
| 并发限制 | [Semaphore](/zh/patterns/semaphore/) | "N 个许可的信号量限制并发任务数" |
| 任务依赖 | [Dependency Graph](/zh/patterns/dependency-graph/) | "任务的 DAG，按拓扑序执行" |

### "设计一个消息队列"

| 概念 | 模式 | 怎么说 |
|---|---|---|
| 生产者缓冲 | [Ring Buffer](/zh/patterns/ring-buffer/) | "固定大小环形缓冲区，零分配的入队/出队" |
| 消费者流控 | [Backpressure](/zh/patterns/backpressure/) | "消费者慢时，信号生产者减速 — 不丢消息" |
| 有序投递 | [Logical Clock](/zh/patterns/logical-clock/) | "Lamport 时间戳确保跨分区的因果排序" |
| 批量写入 | [Batch Processing](/zh/patterns/batch-processing/) | "累积消息，批量 fsync — Kafka 这样做来提高吞吐" |
| 持久性 | [WAL](/zh/patterns/write-ahead-log/) | "磁盘上的追加日志 — 恢复时重放" |

### "设计一个 API 网关"

| 概念 | 模式 | 怎么说 |
|---|---|---|
| 限流 | [Rate Limiter](/zh/patterns/rate-limiter/) | "按客户端、按端点的令牌桶" |
| 熔断 | [Circuit Breaker](/zh/patterns/circuit-breaker/) | "后端错误率超阈值时打开熔断器，快速失败" |
| 重试策略 | [Retry with Backoff](/zh/patterns/retry-backoff/) | "指数退避 + 抖动避免惊群效应" |
| 请求流水线 | [Middleware Chain](/zh/patterns/middleware-chain/) | "认证 → 限流 → 转换 → 路由 → 响应 — 可组合的处理器" |
| 服务发现 | [Registry](/zh/patterns/registry/) | "服务自注册，网关按名查找" |

## 编程面试

### 数据结构设计

| 题目 | 核心模式 | 关键洞察 |
|---|---|---|
| "实现一个 LRU 缓存" | [LRU Cache](/zh/patterns/lru-cache/) | 哈希表 + 双向链表，一切 O(1) |
| "设计一个 Trie" | [Trie](/zh/patterns/trie/) | 递归 children map，isEnd 标志 |
| "实现一个最小堆" | [Min Heap](/zh/patterns/min-heap/) | 基于数组，插入时上浮，提取时下沉 |
| "设计一个跳表" | [Skip List](/zh/patterns/skip-list/) | 随机化层级，从高层向下搜索 |
| "实现一个布隆过滤器" | [Bloom Filter](/zh/patterns/bloom-filter/) | k 个哈希函数，位数组，零假阴性 |
| "设计线程安全的对象池" | [Object Pool](/zh/patterns/object-pool/) | Acquire/Release + mutex 或 CAS |

### 算法题

| 题目 | 核心模式 | 关键洞察 |
|---|---|---|
| "合并 K 个有序链表" | [Merge Iterator](/zh/patterns/merge-iterator/) | k 个头节点的 min-heap，取最小并前进 |
| "数据流中位数" | [Min Heap](/zh/patterns/min-heap/) | 两个堆：下半部分最大堆，上半部分最小堆 |
| "扁平化嵌套列表的迭代器" | [Iterator](/zh/patterns/iterator/) | 基于栈的惰性遍历 |
| "检测链表环" | [Reference Counting](/zh/patterns/reference-counting/) | 或用 Floyd 算法 — 但引用计数解释了为什么环是问题 |
| "序列化/反序列化树" | [Visitor](/zh/patterns/visitor/) | 前序遍历序列化，递归重建反序列化 |
| "最小编辑距离" | [Diff / Patch](/zh/patterns/diff-patch/) | 两个序列上的动态规划 |

### 并发题

| 题目 | 核心模式 | 关键洞察 |
|---|---|---|
| "实现一个信号量" | [Semaphore](/zh/patterns/semaphore/) | 计数器 + 互斥锁 + 条件变量 |
| "设计线程池" | [Work Stealing](/zh/patterns/work-stealing/) | 每线程双端队列，从尾部偷取 |
| "实现读写锁" | [MVCC](/zh/patterns/mvcc/) | 多个并发读者，独占写者 |
| "生产者-消费者问题" | [Ring Buffer](/zh/patterns/ring-buffer/) + [Backpressure](/zh/patterns/backpressure/) | 有界缓冲区 + wait/signal |
| "哲学家就餐" | [Semaphore](/zh/patterns/semaphore/) | 资源排序防止死锁 |

## 面试官真正看什么

不是背模式名字。以下是区分强候选人的关键：

### 1. 权衡意识

不要只说"我会用布隆过滤器"。要说：

> "布隆过滤器给我们 O(k) 查找、O(m) 位空间，可调的假阳性率。代价是不能删除 — 如果需要删除就用计数布隆过滤器，但空间增加 4 倍。"

本书每个模式都有 **何时不用** 章节 — 读那些。

### 2. 生产上下文

不要说"我会用队列"。要说：

> "我会用类似 LMAX Disruptor 的环形缓冲区 — 固定大小、零分配，生产者和消费者可以在不同核上运行而不产生缓存行竞争，因为它们访问不同的索引。"

每个模式的 **Production Proof** 章节给你这些参考。

### 3. 组合能力

真实系统组合多个模式。设计 KV 存储时，不要只说"LSM tree"。走一遍完整栈：

> "写入先到 WAL 保证持久性，然后到 memtable（内存中排序）。满时刷到 SSTable。每个 SSTable 有布隆过滤器优化读取。压缩用 merge iterator 合并 SSTable。删除用墓碑。"

[速查表](/zh/guide/cheatsheet)有**模式组合**章节。

### 4. 画图能力

如果你能在白板上画出模式的机制，你就理解了它。如果不能，你只是背了名字。每个模式的交互式可视化教你画什么。

## 学习计划

### 一周冲刺

| 天 | 重点 | 模式 |
|---|---|---|
| 1 | 缓存与查找 | LRU Cache, Bloom Filter, Trie |
| 2 | 存储引擎 | WAL, LSM Tree, B+ Tree, Checkpointing |
| 3 | 可靠性 | Circuit Breaker, Rate Limiter, Retry with Backoff |
| 4 | 并发 | Semaphore, MVCC, Work Stealing |
| 5 | 分布式 | Consistent Hashing, Logical Clock, Merkle Tree |
| 6 | 内存与运行时 | Object Pool, Arena, Reference Counting, Copy-on-Write |
| 7 | 复习 | 跑所有练习，练习画机制图 |

### 周末速成

聚焦覆盖 80% 系统设计面试的 10 个模式：

1. [LRU Cache](/zh/patterns/lru-cache/) — 所有缓存题
2. [Rate Limiter](/zh/patterns/rate-limiter/) — 专门的面试题 + API 网关必考
3. [Consistent Hashing](/zh/patterns/consistent-hashing/) — 所有分布式题
4. [WAL](/zh/patterns/write-ahead-log/) — 所有存储/数据库题
5. [LSM Tree](/zh/patterns/lsm-tree/) — KV 存储设计
6. [Bloom Filter](/zh/patterns/bloom-filter/) — 读优化、集合成员检测
7. [Circuit Breaker](/zh/patterns/circuit-breaker/) — API 网关、微服务
8. [MVCC](/zh/patterns/mvcc/) — 数据库并发
9. [Min Heap](/zh/patterns/min-heap/) — 调度器、合并 K 路、中位数
10. [Merkle Tree](/zh/patterns/merkle-tree/) — 数据完整性、反熵
