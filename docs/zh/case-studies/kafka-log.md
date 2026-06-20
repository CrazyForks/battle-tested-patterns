---
title: '案例研究：Kafka 如何组合三种模式构建高吞吐日志'
description: 深入剖析 Apache Kafka 如何组合仅追加的提交日志、生产者侧批处理与背压，使单个集群每秒持续处理数百万条消息而不丢数据、不耗尽内存——每一处论断都由固定 commit 上的源码佐证。
---

# 案例研究：Kafka 如何组合三种模式构建高吞吐日志

> **这是什么。** 大多数模式文档孤立地讲解一个模式。本案例研究反其道而行：它剖析单个真实系统——Apache Kafka，事实上的分布式日志——如何组合 **三种** 模式，使一个集群每秒摄入数百万条消息、按序重放它们，并在生产者过快时让其变慢而非丢数据或耗尽内存。每一处针对单个模式的论断都链接到固定 commit 上的源码；组合关系的论证则由 Kafka 自己的设计论述支撑。

## Kafka 解决的问题

一个消息中枢必须在众多生产者与众多消费者之间搬运巨量的小记录，既持久又有序——并且要在一侧比另一侧快时仍能持续工作。三股压力相互碰撞：

- **吞吐量**：把每条小记录作为独立的一次网络往返发送，会把吞吐量限制在"每 RTT 多少条消息"，远低于硬件能达到的水平。
- **持久性与有序性**：一个崩溃后重启的消费者必须能精确重放它错过的内容，且保持原始顺序。
- **过载下的稳定性**：如果生产者跑赢消费者，总得有所让步——而"悄悄丢数据"或"把 broker 撑爆 OOM"都是不可接受的。

Kafka 的答案立足于一个根基性选择——**把每个分区都建模为一个仅追加的日志**——并在其上叠加两条客户端侧的纪律。三种模式协同工作。

| 问题 | 模式 | Kafka 如何回答 |
|----------|---------|----------------------|
| *如何持久且有序地存储并重放记录？* | **预写日志** | 每个分区是磁盘上一个仅追加的提交日志；`LogSegment.append` 顺序写入记录并为其偏移建索引 |
| *如何避免每条记录一次网络往返？* | **批处理** | 生产者把记录累积进按分区组织的批，再成批发送 |
| *如何在不丢数据的前提下让过快的生产者变慢？* | **背压** | 当生产者的缓冲区满时，`BufferPool.allocate` 阻塞调用线程，直到内存释放 |

## 模式 1 —— 预写日志：每个分区都是一个仅追加的提交日志

Kafka 的持久性与有序性来自一个思想：分区不是一个由可变槽位组成的队列，它是一个 **仅追加的日志**。在 broker 上，每个分区是一串段文件，新记录永远只追加到活跃段的尾部。`LogSegment.append` 就是这个原语：

```java
public void append(long largestOffset,
                   long largestTimestampMs,
                   long shallowOffsetOfMaxTimestamp,
                   MemoryRecords records) throws IOException {
    if (records.sizeInBytes() > 0) {
        int physicalPosition = log.sizeInBytes();
        ensureOffsetInRange(largestOffset);
        // append the messages
        long appendedBytes = log.append(records);
        // append an entry to the index (if needed)
        if (bytesSinceLastIndexEntry > indexIntervalBytes) {
            offsetIndex().append(largestOffset, physicalPosition);
            timeIndex().maybeAppend(maxTimestampSoFar(), offsetOfMaxTimestampSoFar());
            bytesSinceLastIndexEntry = 0;
        }
        bytesSinceLastIndexEntry += records.sizeInBytes();
    }
}
```

有两点很重要。第一，`log.append(records)` 永远只写到文件末尾——顺序 I/O，最快的磁盘访问模式，也是单个 broker 能跑满磁盘的原因。第二，每条记录都获得一个单调递增的 **偏移量（offset）**，并随日志增长更新一个稀疏的偏移索引。一个消费者只是偏移量上的游标：要重放，它请求"从偏移量 N 开始的一切"，而有序性是自动的，因为日志按构造就是有序的。

::: tip 心智模型
一个 Kafka 分区是一卷只在一端增长的磁带。生产者写到带头；消费者是停在不同位置、向前读的书签。没人编辑中间——"删除"旧数据只是把磁带的尾部剪掉（段过期）。重放很简单：把书签倒回去，再向前读一遍。
:::

→ 单独了解该模式，见 [Write-Ahead Log](/zh/patterns/write-ahead-log/)。

## 模式 2 —— 批处理：摊薄网络往返

一个每条记录发一个请求的生产者，瓶颈会是网络延迟而非带宽。Kafka 的生产者转而把记录 **累积** 进按分区组织的批，再成批发送。`RecordAccumulator.append` 是一条记录加入它那个批的地方：

```java
public RecordAppendResult append(String topic,
                                 int partition,
                                 long timestamp,
                                 byte[] key,
                                 byte[] value,
                                 Header[] headers,
                                 AppendCallbacks callbacks,
                                 long maxTimeToBlock,
                                 boolean abortOnNewBatch,
                                 long nowMs,
                                 Cluster cluster) throws InterruptedException {
    TopicInfo topicInfo = topicInfoMap.computeIfAbsent(topic, k -> new TopicInfo(logContext, k, batchSize));
    appendsInProgress.incrementAndGet();
    ByteBuffer buffer = null;
    // ...try to append to the in-progress batch for this partition's deque;
    //    if it is full, allocate a new batch buffer and start a fresh one...
}
```

记录堆进每个分区一个的 `ProducerBatch`，直到批达到 `batch.size`（默认 16 KB）或 `linger.ms` 到期；然后一个后台 `Sender` 线程把就绪的批按目标 broker 分组 `drain`（抽走），把每组作为单个请求发出。一次往返现在承载数千条记录，于是吞吐量受带宽而非延迟约束。与模式 1 的联系：生产者发出的每个批，就成为 `LogSegment.append` 在一次顺序追加中写入分区日志的那个 `MemoryRecords`。

::: tip 心智模型
批处理是记录的拼车。与其每个乘客（记录）各自叫一辆出租车（请求），他们在站点（`linger.ms`）短暂等待，直到面包车坐满（`batch.size`），然后一起出发。道路（网络）跑相同的趟数，却运送多得多的乘客。
:::

→ 单独了解该模式，见 [Batch Processing](/zh/patterns/batch-processing/)。

## 模式 3 —— 背压：阻塞生产者，而非丢弃或 OOM

批处理需要内存来暂存未发送的记录。如果生产者跑赢网络，这块内存必须有界——否则 JVM 堆会爆。Kafka 用 `buffer.memory`（默认 32 MB）给它封顶，并在缓冲区耗尽时 **阻塞调用线程** 而非丢弃记录。`BufferPool.allocate` 是那道闸：

```java
public ByteBuffer allocate(int size, long maxTimeToBlockMs) throws InterruptedException {
    if (size > this.totalMemory)
        throw new IllegalArgumentException("Attempt to allocate " + size
            + " bytes, but there is a hard limit of " + this.totalMemory + " ...");
    ByteBuffer buffer = null;
    this.lock.lock();
    try {
        int freeListSize = freeSize() * this.poolableSize;
        if (this.nonPooledAvailableMemory + freeListSize >= size) {
            // enough memory on hand — satisfy immediately
        } else {
            // out of memory: block until another thread frees some
            Condition moreMemory = this.lock.newCondition();
            this.waiters.addLast(moreMemory);
            while (accumulated < size) {
                // wait up to max.block.ms for memory to be released
                moreMemory.await(remainingTimeToBlockNs, TimeUnit.NANOSECONDS);
                // ...accumulate freed memory, then proceed or time out...
            }
        }
    } finally {
        this.lock.unlock();
    }
}
```

当缓冲区满时，调用线程停在一个 `Condition` 上等待——最多等 `max.block.ms`——等 `Sender` 通过发出批来释放内存。生产者的 `send()` 因此恰好在下游跟不上时 *变慢*。这是 **阻塞式背压**：无损，把减速施加到源头，而非丢弃数据。（消费者用 `max.poll.records` 与 `fetch.max.bytes` 施加对称的流控。）

::: tip 心智模型
生产者的缓冲区是一个带定容水池的水槽。只要排水口（网络）跟得上，水（记录）就自由流动。当水池满了，水龙头（`send()`）被关住，直到排水口赶上来——水永远不会溢到地上（丢弃），水池也永远不会胀裂（OOM）。生产者直接感受到减速。
:::

→ 单独了解该模式，见 [Backpressure](/zh/patterns/backpressure/)。

## 三者如何组合

发送一条记录，三个模式依次交接：

1. **批处理**（`RecordAccumulator.append`）把记录归入它那个分区的在途批；`Sender` 稍后按 broker 抽走就绪批——把许多小记录变成少数大请求。
2. **背压**（`BufferPool.allocate`）治理速率：如果因网络抽不快批而使生产者的 `buffer.memory` 耗尽，调用线程就阻塞直到空间释放——不丢、不 OOM。
3. **预写日志**（`LogSegment.append`）使其持久且可重放：每个发出的批被顺序追加到分区的提交日志、其偏移被建索引，于是任何消费者都能从任意偏移按序重放。

```text
producer.send(record)
        │  (batch: RecordAccumulator.append groups records per partition)
        ▼
   per-partition ProducerBatch  ◄── fills to batch.size or linger.ms
        │  (backpressure: BufferPool.allocate blocks if buffer.memory is exhausted)
        ▼
   Sender drains ready batches, one request per broker
        │
        ▼
   broker: LogSegment.append writes the batch to the partition's commit log
        │   (sequential append + offset index)
        ▼
   durable, ordered log  ──►  consumers replay from any offset, in order
```

统一这一切的思想是 **一个由被摊薄、自我节流的管道喂养的仅追加日志**。日志免费给出持久性与有序性（追加 + 偏移）；批处理把受延迟约束的发送变成受带宽约束的发送；背压在消费者落后时保持整条管道稳定。去掉其中任意一个它都会崩塌：没有日志，就没有有序重放；没有批处理，吞吐量塌缩为每往返一条记录；没有背压，慢消费者要么导致丢数据、要么耗尽生产者内存。

::: info 架构推断
把这三者描述为一个 *有意组合* 的设计——一个作为统一抽象、由批处理与背压生产者喂养的分区式仅追加日志——依据的是 Kafka 的设计文档与 Jay Kreps 的《The Log》（见延伸阅读），而非任何单个源码文件。针对单个模式的代码链接是直接的源码证据；而"被有意组合在一起"这一论断，由那些设计层级的材料支撑。
:::

## 生产验证

所有源码链接均固定到 Apache Kafka commit `2ae524ed625438c5fee89e78648bd73e64a3ada0`（tag `3.7.0`）。针对单个模式的论断属于 `source-code`（L1）；组合关系则由官方材料（`official-doc` / `official-blog`）支撑。

| 模式 / 论断 | 来源 | 证据类型 | 在生产者→日志路径中的角色 |
|-----------------|--------|----------|-------------------------------|
| 预写日志 | [LogSegment.java#L245-L275](https://github.com/apache/kafka/blob/2ae524ed625438c5fee89e78648bd73e64a3ada0/storage/src/main/java/org/apache/kafka/storage/internals/log/LogSegment.java#L245-L275) | source-code | `LogSegment.append` 把一批记录顺序追加到分区的提交日志并为其偏移建索引 |
| 批处理 | [RecordAccumulator.java#L284-L315](https://github.com/apache/kafka/blob/2ae524ed625438c5fee89e78648bd73e64a3ada0/clients/src/main/java/org/apache/kafka/clients/producer/internals/RecordAccumulator.java#L284-L315) | source-code | `RecordAccumulator.append` 把记录累积进按分区组织、成批发送的批 |
| 背压 | [BufferPool.java#L111-L160](https://github.com/apache/kafka/blob/2ae524ed625438c5fee89e78648bd73e64a3ada0/clients/src/main/java/org/apache/kafka/clients/producer/internals/BufferPool.java#L111-L160) | source-code | `BufferPool.allocate` 在 `buffer.memory` 耗尽时阻塞生产者线程 |
| 组合（有意为之） | [The Log（Jay Kreps）](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying) | official-blog | Kafka 关于"分区式仅追加日志作为统一抽象"的根基性论证 |
| 组合（有意为之） | [Kafka Design 文档](https://kafka.apache.org/documentation/#design) | official-doc | 官方对生产者批处理、日志与缓冲/吞吐设计意图的解释 |

## 要点

- **模式很少单独出现。** 一个高吞吐日志同时需要一个 *持久性* 模式（预写日志）、一个 *吞吐* 模式（批处理）和一个 *稳定性* 模式（背压）——而且它们在一条管道里交接。
- **日志是根基；其余一切都喂养它。** 有序性与重放是"只追加 + 分配一个偏移"的免费结果。把分区认作 *一个日志*，就是整个架构的一句话总结。
- **背压是阻塞，不是丢弃。** Kafka 让生产者变慢（`BufferPool` 把线程停住）而非丢弃记录——无损是有意的选择，且减速被施加到源头。
- **这与 SQLite 和 LevelDB 呼应。** 三者都倚靠一个仅追加的日志来获得持久性，并把随机工作变成顺序写入。读懂其一，会让另外两个的写路径更易识别。

## 延伸阅读

一条从"我读过了"走向"我能在任何地方认出这些模式"的路径：

1. **先从根基性文章开始** —— Jay Kreps 的
   [The Log: What every software engineer should know about real-time data's
   unifying abstraction](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying)
   把分区式仅追加日志框定为 Kafka 的核心思想。先读这个；源码随后都在印证它。
2. **然后是官方设计** —— [Kafka Design](https://kafka.apache.org/documentation/#design)
   覆盖日志、生产者批处理与吞吐/持久性权衡。
3. **然后是生产者旋钮** —— [Producer configs](https://kafka.apache.org/documentation/#producerconfigs)
   记录了 `batch.size`、`linger.ms`、`buffer.memory`、`max.block.ms`——正是批处理与背压代码读取的那些参数。
4. **然后是一份耦合证明** —— [KIP-794: Strictly Uniform Sticky Partitioner](https://cwiki.apache.org/confluence/display/KAFKA/KIP-794%3A+Strictly+Uniform+Sticky+Partitioner)
   展示了分区、批形成与缓冲池压力在生产者中如何相互作用。
5. **跨系统对比** —— 阅读 [SQLite WAL 案例研究](/zh/case-studies/sqlite-wal)，注意"先追加、提交即持久"如何在那里表现为 WAL 帧、在这里表现为日志段。

## 延伸学习这些模式

- [Write-Ahead Log](/zh/patterns/write-ahead-log/) —— 在应用每次改动前先记录日志；靠重放恢复
- [Batch Processing](/zh/patterns/batch-processing/) —— 累积工作并成批处理，以摊薄固定开销
- [Backpressure](/zh/patterns/backpressure/) —— 为慢消费者让快生产者变慢，而非丢弃数据
