---
title: "模式：逻辑时钟 / Epoch (Logical Clock)"
description: "单调递增的计数器，无需物理时钟即可排序事件——实现一致性快照和过期检测。"
difficulty: "advanced"
---

# 模式：逻辑时钟 / Epoch (Logical Clock)

<DifficultyBadge />

## 一句话

单调递增的计数器，无需物理时钟即可排序事件——实现一致性快照和过期检测。

<DemoBadge />

## 现实类比

在一个所有人都在不同时区的群聊中给消息编号。不用挂钟时间（各地不同），而是给每条消息打一个序号，保证「我看到你的消息后才发的我的」——因果顺序，而非时钟顺序。

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
| 递增 | O(1) — counter++ |
| 接收 | O(1) — max + 1 |
| 保证 | 若 A → B（因果），则 clock(A) < clock(B) |
| 局限 | 反之不成立：clock(A) < clock(B) 不意味着 A → B |

**动手试试** — 执行本地事件并在进程之间发送消息，观察 Lamport 时钟：

<LogicalClockViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| etcd | [kvstore.go#L53-L72](https://github.com/etcd-io/etcd/blob/e9b62f804766edf77cfa918d600cb6fb2c56b401/server/storage/mvcc/kvstore.go#L53-L72) | `store` 结构体（L53）包含 `currentRev int64`（L72）——单调递增的修订计数器。在 [kvstore_txn.go#L214](https://github.com/etcd-io/etcd/blob/e9b62f804766edf77cfa918d600cb6fb2c56b401/server/storage/mvcc/kvstore_txn.go#L214)（`tw.s.currentRev++`）的每次写事务中递增。Watch 和快照使用此修订号实现一致性读——"给我修订号 42 之后的所有变更"。 |
| LevelDB | [dbformat.h#L62-L66](https://github.com/google/leveldb/blob/7ee830d02b623e8ffe0b95d59a74db1e58da04c5/db/dbformat.h#L62-L66) | `SequenceNumber`（L62）是一个 `uint64_t`，每次写操作递增。`kMaxSequenceNumber`（L66）保留 8 位用于打包类型信息。用于 WAL 中的写入排序、快照可见性判断和压缩时的键冲突解决。 |

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

```go [Go]
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

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带 tick/send/receive 的 Lamport 时钟 | `exercises/typescript/logical-clock/01-basic.test.ts` |
| 进阶 | 构建多节点因果关系追踪的版本向量 | `exercises/typescript/logical-clock/02-intermediate.test.ts` |

运行练习：`pnpm test:ts`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

练习文件： Rust `exercises/rust/src/logical_clock/mod.rs` · Go `exercises/go/logical_clock/logical_clock_test.go` · Python `exercises/python/logical_clock/test_logical_clock.py`

## 何时使用

- **数据库修订追踪** — etcd、CockroachDB 和 Spanner 使用单调修订号实现一致性快照和 watch API
- **缓存失效** — 基于 epoch 的失效："如果你缓存的 epoch < 当前 epoch，你的数据已过期"
- **分布式事件排序** — 在没有同步时钟的节点间排序消息（消息队列、事件溯源）
- **MVCC（多版本并发控制）** — 每个事务获得一个序列号；读者看到某个时间点的一致快照
- **乐观并发** — "仅当版本匹配时更新这行"（使用逻辑时间戳的 compare-and-swap）

## 何时不用

- **需要物理时间** — 如果需要"这发生在下午 2:30"这样面向用户的时间戳，逻辑时钟只给你排序而非真实时间。使用混合逻辑时钟（HLC）或 TrueTime。
- **检测并发事件** — Lamport 时钟在 `clock(A) < clock(B)` 时无法判断两个事件是并发的还是因果相关的。你需要向量时钟。
- **单进程顺序代码** — 如果一切在单线程无分布的环境运行，简单的计数器或数组索引就够了。Lamport 机制只增加无意义的复杂性。

## 更多生产案例

- [CockroachDB](https://github.com/cockroachdb/cockroach) — 混合逻辑时钟（HLC），结合物理时钟 + 逻辑计数器实现可序列化事务
- [Amazon DynamoDB](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) — 向量时钟用于跨副本冲突检测
- [Kafka](https://github.com/apache/kafka) — 偏移量作为分区日志中的单调逻辑位置
- [Raft 共识](https://github.com/etcd-io/raft) — `term` 是逻辑 epoch；更高的 term 赢得选举

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [MVCC 多版本并发控制](/zh/patterns/mvcc/) | MVCC 使用逻辑时间戳作为版本标识符 |
| [预写日志 (Write-Ahead Log)](/zh/patterns/write-ahead-log/) | WAL 条目按逻辑时钟序列号排序 |
| [检查点 (Checkpointing)](/zh/patterns/checkpointing/) | 检查点在特定的逻辑时钟位置获取 |

## 挑战题

::: details Q1: 进程 A 的 Lamport 时钟为 5，进程 B 的时钟为 3。你能确定哪个事件先发生吗？
**答案：** 不能。Lamport 时钟只保证：如果 A 因果先于 B，则 `clock(A) < clock(B)`。反过来不成立。

`clock(A) = 5 > clock(B) = 3` 并不意味着 A 发生在 B 之后。它们可能是不同机器上从未通信过的并发事件。要检测并发性，你需要**向量时钟**——每个节点一个计数器，按分量比较。
:::

::: details Q2: 混合逻辑时钟（HLC）相比纯 Lamport 时钟有什么改进？
**答案：** HLC 将物理时间戳（挂钟时间）与逻辑计数器结合。物理部分给你实时近似性——"这大约发生在下午 2:30"。逻辑部分打破平局并维持 Lamport 保证。

规则：`hlc = max(local_wall_clock, local_hlc, remote_hlc)`。如果挂钟前进，逻辑部分重置。如果挂钟落后（NTP 还没追上），逻辑部分递增。

CockroachDB 使用 HLC 因为它两者都需要：因果排序保证一致性，实时边界保证事务截止时间。纯 Lamport 时钟给出排序但数字作为时间没有意义。纯挂钟给出时间但可能倒退。
:::

::: details Q3: 你的缓存使用 epoch 计数器进行失效。服务器重启后 epoch 重置为 0。什么会出问题？
**答案：** 过期的缓存条目看起来是有效的。一个缓存了 epoch 5 的客户端看到服务器的 epoch 0，可能错误地认为自己的数据更新（或者根据协议，强制完全重新获取）。

解决方案：(1) 将 epoch 持久化到磁盘并在重启时恢复，(2) 使用服务器 ID + epoch 的组合使重启可区分，(3) 使用只增不减的基于时间戳的 epoch。etcd 通过持久化修订号 + 在重新加入时变化的成员 ID 来解决这个问题。
:::

::: details Q4: 你正在构建一个事件溯源系统。应该使用 Lamport 时钟还是序列号作为事件 ID？
**答案：** 对于单写者事件存储，序列号更好。当只有一个事件源时，Lamport 时钟增加了不必要的复杂性——简单的自增整数就是完全有效的逻辑时钟。

Lamport 时钟在多个独立写者存在时（分布式系统）才发挥优势。单写者：使用序列号。多写者但有一个协调节点：使用集中式序列（如 Kafka 分区偏移量）。真正分布式的多写者：使用 Lamport 或向量时钟。工具应与分布模型匹配。
:::
