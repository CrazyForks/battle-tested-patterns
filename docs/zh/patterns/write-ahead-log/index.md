---
description: "在应用变更前先将每个变更记录到持久存储——重放日志即可从崩溃中恢复，零数据丢失。"
difficulty: "intermediate"
---

# 模式：预写日志 (Write-Ahead Log)

<DifficultyBadge />

## 一句话

在应用变更前先将每个变更记录到持久存储——重放日志即可从崩溃中恢复，零数据丢失。

<DemoBadge />

## 现实类比

船长日志。在改变航向之前，船长先把计划写在日志里。如果船中途断电，船员可以读日志来完成或撤销操作。日志是唯一的事实来源。

## 核心思想

预写日志在实际修改状态之前，将每个状态变更作为顺序追加记录下来。如果系统在操作中途崩溃，日志会幸存并可以重放以重建精确状态。关键洞察：**顺序写入很快**（对磁盘友好），**重放是幂等的**（可以安全重做）。

```text
  客户端                  WAL (磁盘上)              状态 (内存中)
  ──────                  ────────────              ─────────────
  SET x=1  ──────►  [1] SET x=1    ──────►  { x: 1 }
  SET y=2  ──────►  [2] SET y=2    ──────►  { x: 1, y: 2 }
  DEL x    ──────►  [3] DEL x      ──────►  { y: 2 }
                         ▲
              *** 此处崩溃 ***

  恢复: 重放日志条目 1, 2, 3 → { y: 2 } ✓
```

| 属性 | 值 |
|------|------|
| 写入模式 | 顺序追加（磁盘最优） |
| 持久性 | 崩溃后存活——日志在持久存储上 |
| 恢复 | 从头或从上一个检查点重放 |
| 开销 | 每次变更多一次写入（日志 + 状态） |

**动手试试** — 写入操作到 WAL，刷新到表，然后模拟崩溃并恢复：

<WriteAheadLogViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| etcd | [wal.go#L72-L95](https://github.com/etcd-io/etcd/blob/main/server/storage/wal/wal.go#L72-L95) | `WAL` 结构体（L72）持有目录、编码器、互斥锁和文件管道。`Save` 方法（L958-L1000）持久化 Raft 硬状态和条目，同步到磁盘，超过 `SegmentSizeBytes` 时轮转段。WAL 是 etcd 分布式共识的事实来源。 |
| PostgreSQL | [xlog.c#L783-L1128](https://github.com/postgres/postgres/blob/master/src/backend/access/transam/xlog.c#L783-L1128) | `XLogInsertRecord` — WAL 核心插入入口。预留空间，将记录数据复制到 WAL 缓冲区，按需触发刷盘。`XLogWrite`（L2324-L2622）将 WAL 页从共享缓冲区写入磁盘。支持崩溃恢复、复制和 PITR。 |

## 实现

::: code-group

```typescript [TypeScript]
interface LogEntry {
  id: number;
  operation: string;
  data: Record<string, unknown>;
  applied: boolean;
}

class WriteAheadLog {
  private entries: LogEntry[] = [];
  private nextId = 1;

  append(operation: string, data: Record<string, unknown>): number {
    const id = this.nextId++;
    this.entries.push({ id, operation, data, applied: false });
    return id;
  }

  apply(applyFn: (entry: LogEntry) => void): number {
    let count = 0;
    for (const entry of this.entries) {
      if (!entry.applied) {
        applyFn(entry);
        entry.applied = true;
        count++;
      }
    }
    return count;
  }

  recover(applyFn: (entry: LogEntry) => void): number {
    let count = 0;
    for (const entry of this.entries) {
      applyFn(entry);
      entry.applied = true;
      count++;
    }
    return count;
  }
}
```

```go [Go]
type LogEntry struct {
	ID        int
	Operation string
	Data      map[string]any
	Applied   bool
}

type WAL struct {
	entries []LogEntry
	nextID  int
}

func NewWAL() *WAL {
	return &WAL{nextID: 1}
}

func (w *WAL) Append(op string, data map[string]any) int {
	id := w.nextID
	w.nextID++
	w.entries = append(w.entries, LogEntry{ID: id, Operation: op, Data: data})
	return id
}

func (w *WAL) Apply(fn func(LogEntry)) int {
	count := 0
	for i := range w.entries {
		if !w.entries[i].Applied {
			fn(w.entries[i])
			w.entries[i].Applied = true
			count++
		}
	}
	return count
}

func (w *WAL) Recover(fn func(LogEntry)) int {
	count := 0
	for i := range w.entries {
		fn(w.entries[i])
		w.entries[i].Applied = true
		count++
	}
	return count
}
```

```python [Python]
from dataclasses import dataclass, field
from typing import Any

@dataclass
class LogEntry:
    id: int
    operation: str
    data: dict[str, Any]
    applied: bool = False

class WriteAheadLog:
    def __init__(self):
        self._entries: list[LogEntry] = []
        self._next_id = 1

    def append(self, operation: str, data: dict[str, Any]) -> int:
        entry = LogEntry(id=self._next_id, operation=operation, data=data)
        self._next_id += 1
        self._entries.append(entry)
        return entry.id

    def apply(self, apply_fn) -> int:
        count = 0
        for entry in self._entries:
            if not entry.applied:
                apply_fn(entry)
                entry.applied = True
                count += 1
        return count

    def recover(self, apply_fn) -> int:
        count = 0
        for entry in self._entries:
            apply_fn(entry)
            entry.applied = True
            count += 1
        return count
```

```rust [Rust]
use std::collections::HashMap;

pub struct LogEntry {
    pub id: usize,
    pub operation: String,
    pub data: HashMap<String, String>,
    pub applied: bool,
}

pub struct WriteAheadLog {
    entries: Vec<LogEntry>,
    next_id: usize,
}

impl WriteAheadLog {
    pub fn new() -> Self {
        WriteAheadLog { entries: Vec::new(), next_id: 1 }
    }

    pub fn append(&mut self, operation: &str, data: HashMap<String, String>) -> usize {
        let id = self.next_id;
        self.next_id += 1;
        self.entries.push(LogEntry {
            id, operation: operation.to_string(), data, applied: false,
        });
        id
    }

    pub fn apply(&mut self, apply_fn: &dyn Fn(&LogEntry)) -> usize {
        let mut count = 0;
        for entry in &mut self.entries {
            if !entry.applied {
                apply_fn(entry);
                entry.applied = true;
                count += 1;
            }
        }
        count
    }

    pub fn recover(&mut self, apply_fn: &dyn Fn(&LogEntry)) -> usize {
        let mut count = 0;
        for entry in &mut self.entries {
            apply_fn(entry);
            entry.applied = true;
            count += 1;
        }
        count
    }
}
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现内存中的预写日志 | `exercises/typescript/write-ahead-log/01-basic.test.ts` |
| 进阶 | 检查点恢复 — 仅重放最后检查点之后的条目 | `exercises/typescript/write-ahead-log/02-intermediate.test.ts` |

运行练习：`pnpm test`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

练习文件： Rust `exercises/rust/src/write_ahead_log.rs` · Go `exercises/go/write_ahead_log_test.go` · Python `exercises/python/test_write_ahead_log.py`

## 何时使用

- **数据库** — 事务崩溃恢复（PostgreSQL、SQLite、MySQL InnoDB）
- **分布式共识** — Raft/Paxos 日志复制（etcd、ZooKeeper）
- **消息队列** — 持久消息存储（Kafka、Pulsar）
- **文件系统** — 元数据完整性日志（ext4、NTFS）
- **事件溯源** — 事件日志本身就是预写日志

## 何时不用

- **临时数据** — 缓存条目或会话数据不需要崩溃恢复
- **幂等操作** — 如果可以安全地重新推导状态，WAL 增加不必要的开销
- **同一键的高频更新** — WAL 增长很快；考虑 LSM 树或定期快照
- **读密集工作负载** — WAL 针对写优化；读取仍然通过内存状态

## 更多生产案例

- [SQLite](https://www.sqlite.org/wal.html) — WAL 模式实现单写多读并发
- [RocksDB](https://github.com/facebook/rocksdb) — 基于 LSM 树存储的 WAL
- [CockroachDB](https://github.com/cockroachdb/cockroach) — 分布式 SQL 的 Raft WAL
- [Apache Kafka](https://github.com/apache/kafka) — 提交日志作为核心存储抽象

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [检查点 (Checkpointing)](/zh/patterns/checkpointing/) | 检查点截断 WAL——从检查点恢复 + 重放剩余日志 |
| [LSM 树 (Log-Structured Merge Tree)](/zh/patterns/lsm-tree/) | LSM 树使用 WAL 确保 memtable 写入在刷盘前幸存崩溃 |
| [Merkle 树 (Merkle Tree)](/zh/patterns/merkle-tree/) | Merkle 树验证 WAL 在恢复后帮助重建的状态 |
| [逻辑时钟 / Epoch (Logical Clock)](/zh/patterns/logical-clock/) | WAL 条目按逻辑时钟排序以保证顺序 |
| [多版本并发控制 (MVCC)](/zh/patterns/mvcc/) | WAL 记录 MVCC 版本所基于的所有变更，实现崩溃恢复 |

## 挑战题

::: details Q1: 你的 WAL 实现调用了 write() 但没有调用 fsync()。操作系统崩溃（不仅仅是进程崩溃）。你的数据安全吗？
**答案：** 不安全。没有 fsync，数据可能在 OS 页面缓存中但不在磁盘上。OS 崩溃或断电会丢失未刷写的写入。

`write()` 将数据传输到内核的页面缓存，这是易失性内存。只有 `fsync()`（或 `fdatasync()`）才强制写入持久存储。这就是为什么像 PostgreSQL 这样的数据库有 `synchronous_commit`，etcd 在每次 WAL 写入后调用 `sync()`。权衡：每次写入都 fsync 很慢（尤其在机械硬盘上），所以很多系统批量写入并定期 fsync，接受一个小的潜在数据丢失窗口。
:::

::: details Q2: 你的 WAL 已经运行了 6 个月，包含 2 亿条日志条目。崩溃后的恢复需要 45 分钟。如何修复？
**答案：** 定期对当前状态进行快照（检查点）并截断到该点的 WAL。恢复只重放最后一次快照之后的条目。

这是日志压缩或检查点。不是重放整个历史，而是将当前状态序列化到快照文件，记录 WAL 位置，然后删除更旧的日志条目。恢复加载快照并只重放之后的条目。etcd 通过其快照机制做到这一点；PostgreSQL 使用检查点。没有它，基于 WAL 的系统恢复会越来越慢。
:::

::: details Q3: 一个队友建议用定期的全状态快照替代 WAL。"每 5 秒快照一次就行了。"WAL 给你什么是仅靠快照无法实现的？
**答案：** WAL 给你零数据丢失的时间点恢复。5 秒的快照间隔意味着崩溃时你可能丢失最多 5 秒的写入。

快照在离散的时间间隔捕获状态，所以最后一次快照和崩溃之间的任何写入都会丢失。WAL 记录每个单独的变更，所以恢复会重放到最后一条成功写入的条目——通常最多丢失一个操作。大多数生产系统两者都使用：快照之间用 WAL 保证持久性，快照用来限制 WAL 大小和加速恢复。
:::

::: details Q4: WAL 中有两个操作：(1) SET balance=100，(2) SET balance=200。恢复期间，系统重放两者。重放顺序重要吗？为什么？
**答案：** 是的，顺序很重要。先重放 (2) 再重放 (1) 会将 balance 设为 100，这是不正确的。WAL 条目必须按写入的精确顺序重放。

WAL 的正确性依赖于顺序重放能重现与原始执行完全相同的状态转换。这就是为什么 WAL 是有序的、仅追加的日志——而不是无序操作的集合。如果操作是可交换的且幂等的（如"增加 5"），顺序可能不重要，但大多数真实变更（SET、DELETE）是顺序依赖的。
:::
