---
description: "46 个模式如何关联：组合链路、共享构建块和真实系统中的模式组合。"
---

# 模式如何协作

这些模式不是孤立存在的。最有价值的洞察是生产系统如何将它们**组合**在一起。

**交互式探索** — 点击任意系统查看它使用了哪些模式及其原因：

<PatternConnectionsViz />

## 组合链路

最有价值的洞察不是有哪些模式存在 — 而是它们在真实系统中如何**链式组合**。

### React Reconciler：从标志位到帧

```text
Bitmask          → 标志位编码需要做什么工作
    ↓
Dirty Flag       → 跳过未变更的子树
    ↓
Min Heap         → 先挑最高优先级的工作
    ↓
Cooperative Scheduling → 每 5ms 让出避免卡顿
    ↓
Diff / Patch     → 计算最小树变更
    ↓
Double Buffering → 构建 workInProgress 树，原子交换
    ↓
Batch Processing → 一次提交刷新所有状态更新
```

### PostgreSQL：从写入到恢复

```text
Write-Ahead Log  → 每次修改先写日志再应用
    ↓
Checkpointing    → 定期快照限制崩溃恢复时的重放量
    ↓
B+ Tree          → 磁盘优化索引支持范围查询
    ↓
MVCC             → 读者看到一致快照，永不阻塞写者
    ↓
LRU Cache        → 缓冲池将热页面保持在内存中
    ↓
Bloom Filter     → 跳过对不存在键的索引查找
```

### Kafka Broker：从生产者到消费者

```text
Batch Processing → 累积消息，批量 fsync
    ↓
Write-Ahead Log  → 磁盘上的追加日志段
    ↓
Ring Buffer      → 固定大小 I/O 事件队列
    ↓
Backpressure     → 慢消费者信号生产者节流
    ↓
Consistent Hashing → 跨 broker 分区分配
    ↓
Tombstone        → 日志压缩移除过期记录
```

### Go Runtime：调度 + 内存

```text
Work Stealing    → 空闲 P 从忙碌 P 的队列偷取 goroutine
    ↓
Semaphore        → GOMAXPROCS 限制并发 OS 线程
    ↓
Object Pool      → sync.Pool 回收频繁分配的对象
    ↓
Free List        → mspan 追踪 size class 中的空闲槽位
    ↓
Arena Allocator  → 栈帧以 bump pointer 方式分配
    ↓
Copy-on-Write    → slice append 容量不足时才复制
```

## 全局视角

理解单个模式有用。理解它们如何**组合**才是区分高级工程师和初级工程师的关键。

当你遇到性能问题时，你不会想"我需要一个 bitmask"。你会想"我需要低成本追踪多个状态（bitmask）、跳过未变更的部分（subtree flags）、增量处理工作（cooperative scheduling）、优先处理紧急任务（min heap）、在热路径上避免分配（double buffering）。"

这就是 React 团队构建的。这就是 Redis、Go、Linux、PostgreSQL 和 Kafka 都在展示的。相同的模式以不同的配置重新组合，解决不同的问题。

## 总结：跨系统的模式分布

| 模式 | React | Redis | Go Runtime | Linux | PostgreSQL | Kafka |
|------|:-----:|:-----:|:----------:|:-----:|:----------:|:-----:|
| **Bitmask** | ✅ | | ✅ | ✅ | | |
| **Min Heap** | ✅ | | ✅ | ✅ | | |
| **Cooperative Scheduling** | ✅ | | ✅ | | | |
| **Diff / Patch** | ✅ | | | | | |
| **Double Buffering** | ✅ | | | | | |
| **Batch Processing** | ✅ | ✅ | | ✅ | | ✅ |
| **Dirty Flag** | ✅ | | | | | |
| **Observer** | ✅ | | | | | |
| **Skip List** | | ✅ | | | | |
| **LRU Cache** | | ✅ | ✅ | | ✅ | |
| **Trie** | | ✅ | | ✅ | | |
| **Bloom Filter** | | ✅ | | | ✅ | |
| **Work Stealing** | | | ✅ | | | |
| **Free List** | | | ✅ | ✅ | | |
| **Semaphore** | | | ✅ | ✅ | | |
| **Object Pool** | | | ✅ | | | |
| **Rate Limiter** | | | ✅ | ✅ | | |
| **Arena Allocator** | | | ✅ | | | |
| **State Machine** | | | | ✅ | | |
| **Ring Buffer** | | | | ✅ | | ✅ |
| **Backpressure** | | | | ✅ | | ✅ |
| **Vtable** | | | | ✅ | | |
| **Reference Counting** | | | | ✅ | | |
| **Copy-on-Write** | | ✅ | ✅ | ✅ | | |
| **Tombstone** | | ✅ | | | | ✅ |
| **MVCC** | | | | | ✅ | |
| **Write-Ahead Log** | | | | | ✅ | ✅ |
| **B+ Tree** | | | | ✅ | ✅ | |
| **Checkpointing** | | | | | ✅ | |
| **Event Loop** | | ✅ | ✅ | ✅ | | |
| **Iterator** | ✅ | | ✅ | | | |
| **Tagged Union** | ✅ | | ✅ | | | |
| **Retry Backoff** | | | | | | ✅ |
| **Consistent Hashing** | | | ✅ | | | ✅ |
