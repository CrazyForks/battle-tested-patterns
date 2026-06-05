---
description: "46 个模式的 Big-O 复杂度速查表 — 核心操作、时间与空间复杂度一目了然。"
---

# 复杂度速查表

所有模式核心操作的时间和空间复杂度快速参考。用于在选择模式前对比权衡。

## 如何阅读

- **n** = 元素/项目数量
- **k** = 键长度（用于字符串键结构）
- **m** = 哈希函数数量（布隆过滤器）
- **L** = 层级数（跳表、LSM 树）
- 均摊成本标记为 **(amort.)**

## 数据结构

| 模式 | 插入 | 查找 | 删除 | 空间 | 说明 |
|------|------|------|------|------|------|
| [位掩码 (Bitmask)](/zh/patterns/bitmask/) | O(1) | O(1) | O(1) | O(1) | 固定大小；受字宽限制（32/64 标志位） |
| [环形缓冲区 (Ring Buffer)](/zh/patterns/ring-buffer/) | O(1) | O(1) | O(1) | O(n) | 固定容量；满时覆盖最旧元素 |
| [标签联合体 (Tagged Union)](/zh/patterns/tagged-union/) | — | O(1) | — | O(最大变体) | 按标签分发；无动态分配 |
| [最小堆 (Min Heap)](/zh/patterns/min-heap/) | O(log n) | O(1) peek | O(log n) | O(n) | O(1) 获取最小值；用于优先队列 |
| [Trie 前缀树](/zh/patterns/trie/) | O(k) | O(k) | O(k) | O(n × k) | 与总条目数无关；前缀查询 O(k + 结果数) |
| [布隆过滤器 (Bloom Filter)](/zh/patterns/bloom-filter/) | O(m) | O(m) | ✗ | O(n) | 概率性；可能有假阳性，无假阴性 |
| [LRU 缓存](/zh/patterns/lru-cache/) | O(1) | O(1) | O(1) | O(n) | 哈希表 + 双向链表 |
| [跳表 (Skip List)](/zh/patterns/skip-list/) | O(log n) avg | O(log n) avg | O(log n) avg | O(n) | 概率性平衡；支持范围查询 |
| [B+ 树](/zh/patterns/b-plus-tree/) | O(log n) | O(log n) | O(log n) | O(n) | 磁盘优化；高扇出减少 I/O |
| [默克尔树](/zh/patterns/merkle-tree/) | O(log n) | O(log n) | O(log n) | O(n) | O(log n) 验证证明 |
| [合并迭代器](/zh/patterns/merge-iterator/) | — | O(log k) next | — | O(k) | k = 流数量；基于堆的合并 |

## 并发

| 模式 | 核心操作 | 成本 | 空间 | 说明 |
|------|---------|------|------|------|
| [信号量 (Semaphore)](/zh/patterns/semaphore/) | acquire / release | O(1) | O(1) | 基于计数器；竞争时可能阻塞 |
| [双缓冲 (Double Buffering)](/zh/patterns/double-buffering/) | swap | O(1) | O(2n) | 指针交换；无拷贝 |
| [事件循环 (Event Loop)](/zh/patterns/event-loop/) | enqueue / dequeue | O(1) | O(队列) | 单线程；I/O 多路复用 |
| [背压 (Backpressure)](/zh/patterns/backpressure/) | signal / check | O(1) | O(1) | 流控制；通常附加在现有通道上 |
| [写时复制 (Copy-on-Write)](/zh/patterns/copy-on-write/) | read | O(1) | O(n)/快照 | 写入触发 O(n) 克隆；读取永不阻塞 |
| [协作调度](/zh/patterns/cooperative-scheduling/) | yield | O(1) | O(任务数) | 需要主动让出点 |
| [MVCC](/zh/patterns/mvcc/) | read / write | O(1) + GC | O(n × 版本数) | 读取永不阻塞；GC 成本均摊 |
| [工作窃取 (Work Stealing)](/zh/patterns/work-stealing/) | push / steal | O(1) amort. | O(任务数) | 无锁双端队列；缓存行感知 |
| [Actor 模型](/zh/patterns/actor-model/) | send message | O(1) | O(actors × 邮箱) | 隔离状态；无共享内存 |
| [逻辑时钟 (Logical Clock)](/zh/patterns/logical-clock/) | tick / merge | O(1) Lamport, O(n) Vector | O(1) / O(n) | 向量时钟随节点数增长 |

## 系统

| 模式 | 核心操作 | 成本 | 空间 | 说明 |
|------|---------|------|------|------|
| [状态机 (State Machine)](/zh/patterns/state-machine/) | transition | O(1) | O(状态数) | 常数时间分发；显式状态 |
| [熔断器 (Circuit Breaker)](/zh/patterns/circuit-breaker/) | call / check | O(1) | O(1) | 计数器 + 定时器；3 个状态 |
| [限流器 (Rate Limiter)](/zh/patterns/rate-limiter/) | allow? | O(1) | O(1)/限流器 | 令牌桶或滑动窗口 |
| [指数退避重试](/zh/patterns/retry-backoff/) | retry | O(重试次数) | O(1) | 指数延迟 + 抖动 |
| [批处理 (Batch Processing)](/zh/patterns/batch-processing/) | flush | O(批大小) | O(批大小) | 均摊单次操作开销 |
| [中间件链 (Middleware)](/zh/patterns/middleware-chain/) | execute | O(中间件数) | O(中间件数) | 线性管道；每个处理器 O(1) |
| [注册表 (Registry)](/zh/patterns/registry/) | register / lookup | O(1) hash | O(n) | 字符串键服务定位器 |
| [脏标记 (Dirty Flag)](/zh/patterns/dirty-flag/) | check / mark | O(1) | O(1) | 布尔守卫；跳过未变更 |
| [依赖图 (Dependency Graph)](/zh/patterns/dependency-graph/) | topo sort | O(V + E) | O(V + E) | DAG；检测环 |
| [一致性哈希](/zh/patterns/consistent-hashing/) | lookup node | O(log n) | O(n × vnodes) | 环上二分查找；最小重映射 |
| [预写日志 (WAL)](/zh/patterns/write-ahead-log/) | append | O(1) amort. | O(日志大小) | 顺序写入；fsync 保证持久性 |
| [检查点 (Checkpointing)](/zh/patterns/checkpointing/) | snapshot | O(状态大小) | O(状态大小) | 定期快照；截断 WAL |
| [LSM 树](/zh/patterns/lsm-tree/) | write / read | O(1) write, O(L) read | O(n) | 写优化；后台压缩 |

## 内存

| 模式 | 分配 | 释放 | 查找 | 空间 | 说明 |
|------|------|------|------|------|------|
| [对象池 (Object Pool)](/zh/patterns/object-pool/) | O(1) | O(1) | — | O(池大小) | 预分配；避免 GC 压力 |
| [享元 (Flyweight)](/zh/patterns/flyweight/) | — | — | O(1) | O(唯一实例数) | 共享相同实例 |
| [Arena 分配器](/zh/patterns/arena-allocator/) | O(1) bump | O(1) 批量 | — | O(竞技场大小) | 指针碰撞；一次性释放 |
| [空闲链表 (Free List)](/zh/patterns/free-list/) | O(1) | O(1) | — | O(n) | 释放槽位的链表 |
| [写时复制 (Copy-on-Write)](/zh/patterns/copy-on-write/) | O(1) share | O(n) on write | O(1) | O(n)/快照 | 延迟拷贝 |
| [引用计数 (Ref Count)](/zh/patterns/reference-counting/) | O(1) clone | O(1) drop | — | O(1)/引用 | 确定性释放；不处理循环 |
| [墓碑标记 (Tombstone)](/zh/patterns/tombstone/) | — | O(1) mark | O(1) | O(n + 已删除) | 软删除；稍后压缩 |
| [驻留 (Interning)](/zh/patterns/interning/) | O(k) 首次, O(1) 后续 | — | O(1) | O(唯一数 × k) | 基于哈希去重；按指针比较 |

## 行为型

| 模式 | 核心操作 | 成本 | 空间 | 说明 |
|------|---------|------|------|------|
| [观察者 (Observer)](/zh/patterns/observer/) | notify | O(订阅者数) | O(订阅者数) | 扇出；顺序可能不同 |
| [迭代器 (Iterator)](/zh/patterns/iterator/) | next | O(1)/步 | O(1) | 惰性求值；拉取式 |
| [差异/补丁 (Diff/Patch)](/zh/patterns/diff-patch/) | diff | O(n × m) Myers | O(n + m) | 最小编辑距离 |
| [虚表 (Vtable)](/zh/patterns/vtable/) | dispatch | O(1) | O(方法数) | 指针间接；静态解析 |
| [访问者 (Visitor)](/zh/patterns/visitor/) | visit | O(节点数) | O(树深度) | 双重分发；遍历 + 操作 |

## 关键权衡总结

| 如果你需要... | 选择 | 权衡 |
|--------------|------|------|
| O(1) 查找 + O(1) 淘汰 | [LRU 缓存](/zh/patterns/lru-cache/) | 双向链表额外内存 |
| O(1) 大规模写入 | [LSM 树](/zh/patterns/lsm-tree/) | 读放大（多层级） |
| O(1) 成员检测 | [布隆过滤器](/zh/patterns/bloom-filter/) | 假阳性（无假阴性） |
| O(1) 分配 | [Arena 分配器](/zh/patterns/arena-allocator/) 或 [空闲链表](/zh/patterns/free-list/) | 无单独释放(Arena) 或碎片化(空闲链表) |
| O(log n) 有序访问 | [跳表](/zh/patterns/skip-list/) 或 [B+ 树](/zh/patterns/b-plus-tree/) | 跳表更简单，B+ 树磁盘优化 |
| 零拷贝读取 | [写时复制](/zh/patterns/copy-on-write/) 或 [MVCC](/zh/patterns/mvcc/) | 写入时有写放大 |
| 扩容最小重哈希 | [一致性哈希](/zh/patterns/consistent-hashing/) | 虚拟节点增加内存开销 |
