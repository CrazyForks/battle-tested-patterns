# 模式：逻辑时钟 / Epoch (Logical Clock)

## 一句话

单调递增的计数器，无需物理时钟即可排序事件——实现一致性快照和过期检测。

## 核心思想

在分布式系统中，物理时钟不可靠——会漂移、NTP 同步时跳变、不同机器间不一致。逻辑时钟是一个只增不减的整数。Lamport 规则：本地事件时递增，收到消息时取 `max(本地, 远端) + 1`。这保证了：如果事件 A 因果上先于事件 B，那么 `clock(A) < clock(B)`。

```text
  Process P1          Process P2
  ─────────           ─────────
  tick → 1
  tick → 2
  send(2) ──────────► receive(2)
                      max(0, 2)+1 = 3
                      tick → 4
  receive(4) ◄─────── send(4)
  max(2, 4)+1 = 5
  tick → 6

  因果序: P1:1 → P1:2 → P2:3 → P2:4 → P1:5 → P1:6
```

| 属性 | 值 |
|------|------|
| 递增 | O(1) -- counter++ |
| 接收 | O(1) -- max + 1 |
| 保证 | 若 A → B（因果），则 clock(A) < clock(B) |
| 局限 | 反之不成立：clock(A) < clock(B) 不意味着 A → B |

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| etcd | [kvstore.go#L53-L72](https://github.com/etcd-io/etcd/blob/main/server/storage/mvcc/kvstore.go#L53-L72) | `store` 结构体（L53）包含 `currentRev int64`（L72）——单调递增的修订计数器。在 [kvstore_txn.go#L214](https://github.com/etcd-io/etcd/blob/main/server/storage/mvcc/kvstore_txn.go#L214)（`tw.s.currentRev++`）的每次写事务中递增。Watch 和快照使用此修订号实现一致性读——"给我修订号 42 之后的所有变更"。 |
| LevelDB | [dbformat.h#L62-L66](https://github.com/google/leveldb/blob/main/db/dbformat.h#L62-L66) | `SequenceNumber`（L62）是一个 `uint64_t`，每次写操作递增。`kMaxSequenceNumber`（L66）保留 8 位用于打包类型信息。用于 WAL 中的写入排序、快照可见性判断和压缩时的键冲突解决。 |

## 实现

::: code-group

```typescript [TypeScript]
class LamportClock {
  private time = 0;

  /** Increment the clock for a local event. */
  tick(): void {
    this.time++;
  }

  /** Record a send event and return the timestamp. */
  send(): number {
    this.time++;
    return this.time;
  }

  /** Receive a message with a remote timestamp. */
  receive(remoteTimestamp: number): void {
    this.time = Math.max(this.time, remoteTimestamp) + 1;
  }

  /** Current clock value. */
  now(): number {
    return this.time;
  }
}
```

```go [Go]
import "sync"

type LamportClock struct {
	mu   sync.Mutex
	time uint64
}

func (c *LamportClock) Tick() uint64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.time++
	return c.time
}

func (c *LamportClock) Send() uint64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.time++
	return c.time
}

func (c *LamportClock) Receive(remote uint64) uint64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	if remote > c.time {
		c.time = remote
	}
	c.time++
	return c.time
}

func (c *LamportClock) Now() uint64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.time
}
```

```python [Python]
class LamportClock:
    def __init__(self) -> None:
        self._time = 0

    def tick(self) -> None:
        self._time += 1

    def send(self) -> int:
        self._time += 1
        return self._time

    def receive(self, remote_timestamp: int) -> None:
        self._time = max(self._time, remote_timestamp) + 1

    def now(self) -> int:
        return self._time
```

```rust [Rust]
use std::sync::atomic::{AtomicU64, Ordering};

pub struct LamportClock {
    time: AtomicU64,
}

impl LamportClock {
    pub fn new() -> Self {
        LamportClock { time: AtomicU64::new(0) }
    }

    pub fn tick(&self) -> u64 {
        self.time.fetch_add(1, Ordering::SeqCst) + 1
    }

    pub fn send(&self) -> u64 {
        self.tick()
    }

    pub fn receive(&self, remote: u64) -> u64 {
        loop {
            let current = self.time.load(Ordering::SeqCst);
            let new_time = std::cmp::max(current, remote) + 1;
            if self.time.compare_exchange(
                current, new_time, Ordering::SeqCst, Ordering::SeqCst
            ).is_ok() {
                return new_time;
            }
        }
    }

    pub fn now(&self) -> u64 {
        self.time.load(Ordering::SeqCst)
    }
}
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带 tick/send/receive 的 Lamport 时钟 | `exercises/typescript/logical-clock/01-basic.test.ts` |
| 进阶 | 构建多节点因果关系追踪的版本向量 | `exercises/typescript/logical-clock/02-intermediate.test.ts` |

## 何时使用

- **数据库修订追踪** -- etcd、CockroachDB 和 Spanner 使用单调修订号实现一致性快照和 watch API
- **缓存失效** -- 基于 epoch 的失效："如果你缓存的 epoch < 当前 epoch，你的数据已过期"
- **分布式事件排序** -- 在没有同步时钟的节点间排序消息（消息队列、事件溯源）
- **MVCC（多版本并发控制）** -- 每个事务获得一个序列号；读者看到某个时间点的一致快照
- **乐观并发** -- "仅当版本匹配时更新这行"（使用逻辑时间戳的 compare-and-swap）

## 何时不用

- **需要物理时间** -- 如果需要"这发生在下午 2:30"这样面向用户的时间戳，逻辑时钟只给你排序而非真实时间。使用混合逻辑时钟（HLC）或 TrueTime。
- **检测并发事件** -- Lamport 时钟在 `clock(A) < clock(B)` 时无法判断两个事件是并发的还是因果相关的。你需要向量时钟。
- **单进程顺序代码** -- 如果一切在单线程无分布的环境运行，简单的计数器或数组索引就够了。Lamport 机制只增加无意义的复杂性。

## 更多生产案例

- [CockroachDB](https://github.com/cockroachdb/cockroach) -- 混合逻辑时钟（HLC），结合物理时钟 + 逻辑计数器实现可序列化事务
- [Amazon DynamoDB](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) -- 向量时钟用于跨副本冲突检测
- [Kafka](https://github.com/apache/kafka) -- 偏移量作为分区日志中的单调逻辑位置
- [Raft 共识](https://github.com/etcd-io/raft) -- `term` 是逻辑 epoch；更高的 term 赢得选举

## 挑战题

::: details Q1: Process A has Lamport clock 5, Process B has clock 3. Can you determine which event happened first?
**Answer:** No. Lamport clocks only guarantee: if A causally precedes B, then `clock(A) < clock(B)`. The converse is NOT guaranteed.

`clock(A) = 5 > clock(B) = 3` does NOT mean A happened after B. They could be concurrent events on different machines that never communicated. To detect concurrency, you need a **vector clock** -- one counter per node, with component-wise comparison.
:::

::: details Q2: How does a Hybrid Logical Clock (HLC) improve on a pure Lamport clock?
**Answer:** An HLC combines a physical timestamp (wall clock) with a logical counter. The physical part gives you real-time proximity -- "this happened around 2:30 PM." The logical part breaks ties and maintains the Lamport guarantee.

Rule: `hlc = max(local_wall_clock, local_hlc, remote_hlc)`. If the wall clock advances, the logical part resets. If the wall clock is behind (NTP hasn't caught up), the logical part increments.

CockroachDB uses HLC because it needs both: causal ordering for consistency AND real-time bounds for transaction deadlines. A pure Lamport clock gives ordering but the numbers are meaningless as time. A pure wall clock gives time but can go backward.
:::

::: details Q3: Your cache uses an epoch counter for invalidation. A server restarts and the epoch resets to 0. What breaks?
**Answer:** Stale cache entries appear valid. A client with cached epoch 5 sees the server's epoch 0 and might incorrectly conclude it has newer data (or, depending on the protocol, force a full re-fetch).

Solutions: (1) persist the epoch to disk and restore on restart, (2) use a combination of server ID + epoch so restarts are distinguishable, (3) use a timestamp-based epoch that only increases. etcd solves this with persistent revision + a member ID that changes on rejoin.
:::

::: details Q4: You're building an event sourcing system. Should you use Lamport clocks or sequence numbers as event IDs?
**Answer:** Sequence numbers are better for a single-writer event store. A Lamport clock adds unnecessary complexity when there's only one source of events -- a simple auto-incrementing integer is a perfectly valid logical clock.

Lamport clocks shine when multiple independent writers exist (distributed systems). For single-writer: use a sequence number. For multi-writer with one coordinating node: use a centralized sequence (like Kafka partition offsets). For truly distributed multi-writer: use Lamport or vector clocks. Match the tool to the distribution model.
:::
