---
title: 'Case Study: How Kafka Composes Three Patterns for a High-Throughput Log'
description: A deep dive into how Apache Kafka combines an append-only commit log, producer-side batching, and backpressure so a single cluster sustains millions of messages per second without losing data or running out of memory — every claim backed by source code at a pinned commit.
---

# Case Study: How Kafka Composes Three Patterns for a High-Throughput Log

> **What this is.** Most pattern docs teach one pattern in isolation. This case
> study does the opposite: it dissects how one real system — Apache Kafka, the
> de-facto distributed log — composes **three** patterns so that a cluster
> ingests millions of messages per second, replays them in order, and slows a
> too-fast producer instead of dropping data or running out of memory. Every
> per-pattern claim links to source code at a pinned commit; the composition
> argument is backed by Kafka's own design writing.

## The Problem Kafka Solves

A messaging backbone has to move enormous volumes of small records between many
producers and many consumers, durably and in order — and keep doing it when one
side is faster than the other. Three pressures collide:

- **Throughput**: sending each tiny record as its own network round-trip would
  cap throughput at "messages per RTT", far below what the hardware allows.
- **Durability and ordering**: a consumer that crashes and restarts must be able
  to replay exactly what it missed, in the original order.
- **Stability under overload**: if producers outrun consumers, something must
  give — and "silently drop data" or "OOM the broker" are both unacceptable.

Kafka's answer rests on one foundational choice — **model every partition as an
append-only log** — and two client-side disciplines layered on top. Three
patterns work together.

| Question | Pattern | How Kafka answers it |
|----------|---------|----------------------|
| *How do we store and replay records durably, in order?* | **Write-ahead log** | Each partition is an append-only commit log on disk; `LogSegment.append` writes records sequentially and indexes their offsets |
| *How do we avoid one network round-trip per record?* | **Batch processing** | The producer accumulates records into per-partition batches and sends them in bulk |
| *How do we slow a too-fast producer without dropping data?* | **Backpressure** | When the producer's buffer is full, `BufferPool.allocate` blocks the calling thread until memory frees up |

## Pattern 1 — Write-ahead log: every partition is an append-only commit log

Kafka's durability and ordering come from one idea: a partition is not a queue of
mutable slots, it is an **append-only log**. On the broker, each partition is a
sequence of segment files, and new records are only ever appended to the active
segment's tail. `LogSegment.append` is that primitive:

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

Two things matter. First, `log.append(records)` only ever writes to the end of the
file — sequential I/O, the fastest disk access pattern, and the reason a single
broker can saturate a disk. Second, every record gets a monotonically increasing
**offset**, and a sparse offset index is updated as the log grows. A consumer is
just a cursor over offsets: to replay, it asks for "everything from offset N", and
ordering is automatic because the log is, by construction, ordered.

::: tip Mental model
A Kafka partition is a tape that only ever grows at one end. Producers write to
the tip; consumers are bookmarks at different positions reading forward. Nobody
edits the middle — "deleting" old data just means cutting off the tail of the tape
(segment expiry). Replay is trivial: rewind your bookmark and read forward again.
:::

→ For the pattern in isolation, see [Write-Ahead Log](/patterns/write-ahead-log/).

## Pattern 2 — Batch processing: amortize the network round-trip

A producer that sent one record per request would be bottlenecked by network
latency, not bandwidth. Kafka's producer instead **accumulates** records into
per-partition batches and sends them in bulk. `RecordAccumulator.append` is where
a record joins its batch:

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

Records pile into a `ProducerBatch` per partition until the batch reaches
`batch.size` (default 16 KB) or `linger.ms` elapses; then a background `Sender`
thread `drain`s the ready batches grouped by destination broker and ships each
group in a single request. One round-trip now carries thousands of records, so
throughput is bounded by bandwidth, not latency. The connection to Pattern 1: each
batch the producer ships becomes the `MemoryRecords` that `LogSegment.append`
writes to the partition's log in one sequential append.

::: tip Mental model
Batching is carpooling for records. Instead of each passenger (record) hailing its
own taxi (request), they wait briefly at a stop (`linger.ms`) until the van fills
(`batch.size`), then ride together. The road (network) does the same number of
trips for vastly more passengers.
:::

→ For the pattern in isolation, see [Batch Processing](/patterns/batch-processing/).

## Pattern 3 — Backpressure: block the producer instead of dropping or OOMing

Batching needs memory to hold un-sent records. If producers outrun the network,
that memory must be bounded — otherwise the JVM heap blows up. Kafka caps it at
`buffer.memory` (default 32 MB) and, when the buffer is exhausted, **blocks the
calling thread** rather than dropping records. `BufferPool.allocate` is the gate:

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

When the buffer is full the calling thread parks on a `Condition` and waits — up
to `max.block.ms` — for the `Sender` to free memory by shipping batches. The
producer's `send()` therefore *slows down* exactly when the downstream can't keep
up. This is **block-style backpressure**: lossless, applying the slowdown to the
source, not discarding data. (Consumers exert the symmetric flow control with
`max.poll.records` and `fetch.max.bytes`.)

::: tip Mental model
The producer's buffer is a sink with a fixed-size basin. As long as the drain
(network) keeps up, water (records) flows freely. When the basin fills, the tap
(`send()`) is held shut until the drain catches up — the water never overflows
onto the floor (drops) and the basin never bursts (OOM). The producer feels the
slowdown directly.
:::

→ For the pattern in isolation, see [Backpressure](/patterns/backpressure/).

## How the Three Compose

Send a record and the three patterns hand off:

1. **Batch processing** (`RecordAccumulator.append`) groups the record into its
   partition's in-progress batch; the `Sender` later drains ready batches per
   broker — turning many small records into few large requests.
2. **Backpressure** (`BufferPool.allocate`) governs the rate: if the producer's
   `buffer.memory` is exhausted because the network can't drain batches fast
   enough, the calling thread blocks until space frees up — no drops, no OOM.
3. **Write-ahead log** (`LogSegment.append`) makes it durable and replayable: each
   shipped batch is appended sequentially to the partition's commit log and its
   offset indexed, so any consumer can replay from any offset in order.

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

The unifying idea is **an append-only log fed by an amortized, self-throttling
pipe**. The log gives durability and ordering for free (append + offset); batching
turns latency-bound sends into bandwidth-bound ones; backpressure keeps the whole
pipe stable when consumers lag. Remove any one and it breaks: without the log,
there is no ordered replay; without batching, throughput collapses to one record
per round-trip; without backpressure, a slow consumer either drops data or
exhausts producer memory.

::: info Architectural inference
The framing of these three as a *deliberately composed* design — the partitioned,
append-only log as a unifying abstraction fed by a batching, back-pressured
producer — rests on Kafka's design documentation and Jay Kreps's "The Log" (see
Further Reading), not on any single source file. The per-pattern code links are
direct source-code evidence; the "combined by design" claim is supported by that
design-level material.
:::

## Production Proof

All source links are pinned to Apache Kafka commit
`2ae524ed625438c5fee89e78648bd73e64a3ada0` (tag `3.7.0`). Per-pattern claims are
`source-code` (L1); the composition relationship is backed by official material
(`official-doc` / `official-blog`).

| Pattern / Claim | Source | Evidence | Role in the producer→log path |
|-----------------|--------|----------|-------------------------------|
| Write-ahead log | [LogSegment.java#L245-L275](https://github.com/apache/kafka/blob/2ae524ed625438c5fee89e78648bd73e64a3ada0/storage/src/main/java/org/apache/kafka/storage/internals/log/LogSegment.java#L245-L275) | source-code | `LogSegment.append` appends a batch of records to the partition's commit log sequentially and indexes their offsets |
| Batch processing | [RecordAccumulator.java#L284-L315](https://github.com/apache/kafka/blob/2ae524ed625438c5fee89e78648bd73e64a3ada0/clients/src/main/java/org/apache/kafka/clients/producer/internals/RecordAccumulator.java#L284-L315) | source-code | `RecordAccumulator.append` accumulates records into per-partition batches sent in bulk |
| Backpressure | [BufferPool.java#L111-L160](https://github.com/apache/kafka/blob/2ae524ed625438c5fee89e78648bd73e64a3ada0/clients/src/main/java/org/apache/kafka/clients/producer/internals/BufferPool.java#L111-L160) | source-code | `BufferPool.allocate` blocks the producer thread when `buffer.memory` is exhausted |
| Composition (by design) | [The Log (Jay Kreps)](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying) | official-blog | Kafka's foundational argument for the partitioned, append-only log as a unifying abstraction |
| Composition (by design) | [Kafka Design documentation](https://kafka.apache.org/documentation/#design) | official-doc | Official explanation of producer batching, the log, and buffer/throughput design intent |

## Takeaways

- **Patterns rarely ship alone.** A high-throughput log needs a *durability*
  pattern (write-ahead log), a *throughput* pattern (batch processing), and a
  *stability* pattern (backpressure) at once — and they hand off in a pipe.
- **The log is the foundation; everything else feeds it.** Ordering and replay are
  free consequences of "only ever append + assign an offset". Recognising the
  partition *as* a log is the whole architecture in one phrase.
- **Backpressure is block, not drop.** Kafka slows the producer (`BufferPool`
  parks the thread) rather than discarding records — losslessness is a deliberate
  choice, and the slowdown is applied to the source.
- **This echoes SQLite and LevelDB.** All three lean on an append-only log for
  durability and turn random work into sequential writes. Reading one makes the
  others' write path easier to recognise.

## Further Reading

A path from "I read this" to "I can recognise these patterns anywhere":

1. **Start with the foundational essay** — Jay Kreps's
   [The Log: What every software engineer should know about real-time data's
   unifying abstraction](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying)
   frames the partitioned append-only log as Kafka's core idea. Read this first;
   the source then confirms it.
2. **Then the official design** — [Kafka Design](https://kafka.apache.org/documentation/#design)
   covers the log, producer batching, and the throughput/durability trade-offs.
3. **Then the producer knobs** — [Producer configs](https://kafka.apache.org/documentation/#producerconfigs)
   document `batch.size`, `linger.ms`, `buffer.memory`, and `max.block.ms` — the
   exact parameters the batching and backpressure code reads.
4. **Then a coupling proof** — [KIP-794: Strictly Uniform Sticky Partitioner](https://cwiki.apache.org/confluence/display/KAFKA/KIP-794%3A+Strictly+Uniform+Sticky+Partitioner)
   shows how partitioning, batch formation, and buffer-pool pressure interact in
   the producer.
5. **Compare across systems** — read the [SQLite WAL case study](/case-studies/sqlite-wal)
   and note how "append first, durable on commit" appears as WAL frames there and
   as log segments here.

## Study These Patterns

- [Write-Ahead Log](/patterns/write-ahead-log/) — log every mutation before applying it; replay to recover
- [Batch Processing](/patterns/batch-processing/) — accumulate work and process it in bulk to amortize fixed costs
- [Backpressure](/patterns/backpressure/) — slow a fast producer for a slow consumer instead of dropping data
