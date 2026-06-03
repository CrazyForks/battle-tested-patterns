# 模式：预写日志 (Write-Ahead Log)

## 一句话

在应用变更前先将每个变更记录到持久存储——重放日志即可从崩溃中恢复，零数据丢失。

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

## 挑战题

::: details Q1: Your WAL implementation calls write() but not fsync(). The OS crashes (not just the process). Is your data safe?
**Answer:** No. Without fsync, data may be in the OS page cache but not on disk. An OS crash or power loss loses the unflushed writes.

`write()` transfers data to the kernel's page cache, which is volatile memory. Only `fsync()` (or `fdatasync()`) forces it to durable storage. This is why databases like PostgreSQL have `synchronous_commit` and etcd calls `sync()` after every WAL write. The trade-off: fsync on every write is slow (especially on spinning disks), so many systems batch writes and fsync periodically, accepting a small window of potential data loss.
:::

::: details Q2: Your WAL has been running for 6 months and contains 200 million log entries. Recovery after a crash takes 45 minutes. How do you fix this?
**Answer:** Take periodic snapshots (checkpoints) of the current state and truncate the WAL up to that point. Recovery replays only entries after the last snapshot.

This is log compaction or checkpointing. Instead of replaying the entire history, you serialize the current state to a snapshot file, record the WAL position, and delete older log entries. Recovery loads the snapshot and replays only the entries after it. etcd does this with its snapshot mechanism; PostgreSQL uses checkpoints. Without it, WAL-based systems become progressively slower to recover.
:::

::: details Q3: A teammate suggests using periodic full-state snapshots instead of a WAL. "Just snapshot every 5 seconds." What does the WAL give you that snapshots alone don't?
**Answer:** The WAL gives you point-in-time recovery with zero data loss. A 5-second snapshot interval means you can lose up to 5 seconds of writes on crash.

Snapshots capture state at discrete intervals, so any writes between the last snapshot and the crash are lost. The WAL records every individual mutation, so recovery replays up to the last successfully written entry -- typically losing at most one operation. Most production systems use both: the WAL for durability between snapshots, and snapshots to bound WAL size and speed up recovery.
:::

::: details Q4: Two operations in the WAL are: (1) SET balance=100, (2) SET balance=200. During recovery, the system replays both. Does the replay order matter, and why?
**Answer:** Yes, order matters. Replaying (2) before (1) would set balance to 100, which is incorrect. WAL entries must be replayed in the exact order they were written.

WAL correctness depends on sequential replay reproducing the exact same state transitions as the original execution. This is why the WAL is an ordered, append-only log -- not a set of unordered operations. If operations were commutative and idempotent (like "increment by 5"), order might not matter, but most real mutations (SET, DELETE) are order-dependent.
:::
