---
description: "Log every mutation to durable storage before applying it — replay the log to recover from crashes without data loss."
difficulty: "intermediate"
---

# Pattern: Write-Ahead Log (WAL)

<DifficultyBadge />

## One Liner

Log every mutation to durable storage before applying it — replay the log to recover from crashes without data loss.

<DemoBadge />

## Real-World Analogy

A captain's logbook. Before changing course, the captain writes the intended change in the log. If the ship loses power mid-turn, the crew can read the log and complete or undo the maneuver. The log is the source of truth.

## Core Idea

A write-ahead log records every state change as a sequential append before the actual state is modified. If the system crashes mid-operation, the log survives and can be replayed to reconstruct the exact state. The key insight: **sequential writes are fast** (disk-friendly), and **replay is idempotent** (safe to redo).

```text
  Client                  WAL (on disk)              State (in memory)
  ──────                  ────────────              ─────────────────
  SET x=1  ──────►  [1] SET x=1    ──────►  { x: 1 }
  SET y=2  ──────►  [2] SET y=2    ──────►  { x: 1, y: 2 }
  DEL x    ──────►  [3] DEL x      ──────►  { y: 2 }
                         ▲
              *** CRASH HERE ***

  Recovery: replay log entries 1, 2, 3 → { y: 2 } ✓
```

| Property | Value |
|----------|-------|
| Write pattern | Sequential append (optimal for disk) |
| Durability | Survives crashes — log is on durable storage |
| Recovery | Replay from beginning or last checkpoint |
| Overhead | One extra write per mutation (log + state) |

**Try it yourself** — write operations to the WAL, flush to table, then simulate a crash and recover:

<WriteAheadLogViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| etcd | [wal.go#L72-L95](https://github.com/etcd-io/etcd/blob/main/server/storage/wal/wal.go#L72-L95) | `WAL` struct (L72) holds dir, encoder, mutex, and file pipeline. `Save` method (L958-L1000) persists Raft hard state and entries, syncs to disk, and rotates segments when exceeding `SegmentSizeBytes`. The WAL is the source of truth for etcd's distributed consensus. |
| PostgreSQL | [xlog.c#L783-L1128](https://github.com/postgres/postgres/blob/master/src/backend/access/transam/xlog.c#L783-L1128) | `XLogInsertRecord` — the core WAL insert entry point. Reserves space, copies record data into WAL buffers, triggers flush if needed. `XLogWrite` (L2324-L2622) writes WAL pages from shared buffers to disk. Enables crash recovery, replication, and PITR. |

## Implementation

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

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement an in-memory write-ahead log | `exercises/typescript/write-ahead-log/01-basic.test.ts` |
| Intermediate | Checkpoint recovery — replay only after last checkpoint | `exercises/typescript/write-ahead-log/02-intermediate.test.ts` |

Run exercises: `pnpm test` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/write_ahead_log.rs` · Go `exercises/go/write_ahead_log_test.go` · Python `exercises/python/test_write_ahead_log.py`

## When to Use

- **Databases** — crash recovery for transactions (PostgreSQL, SQLite, MySQL InnoDB)
- **Distributed consensus** — Raft/Paxos log replication (etcd, ZooKeeper)
- **Message queues** — durable message storage (Kafka, Pulsar)
- **File systems** — journaling for metadata integrity (ext4, NTFS)
- **Event sourcing** — the event log IS the write-ahead log

## When NOT to Use

- **Ephemeral data** — cache entries or session data don't need crash recovery
- **Idempotent operations** — if you can safely re-derive state, a WAL adds unnecessary overhead
- **High-frequency updates to same key** — WAL grows fast; consider LSM tree or periodic snapshots
- **Read-heavy workloads** — WAL is write-optimized; reads still go through the in-memory state

## More Production Uses

- [SQLite](https://www.sqlite.org/wal.html) — WAL mode for concurrent readers with a single writer
- [RocksDB](https://github.com/facebook/rocksdb) — WAL for LSM-tree based storage
- [CockroachDB](https://github.com/cockroachdb/cockroach) — Raft WAL for distributed SQL
- [Apache Kafka](https://github.com/apache/kafka) — commit log as the core storage abstraction

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Checkpointing](/patterns/checkpointing/) | Checkpoints truncate the WAL — recover from checkpoint + replay remaining log |
| [LSM Tree (Log-Structured Merge Tree)](/patterns/lsm-tree/) | LSM trees use WAL to ensure memtable writes survive crashes before flushing |
| [Merkle Tree](/patterns/merkle-tree/) | Merkle trees verify the state that WAL helps reconstruct after recovery |
| [Logical Clock](/patterns/logical-clock/) | WAL entries are sequenced by logical clock for ordering guarantees |
| [MVCC](/patterns/mvcc/) | WAL records all mutations that MVCC versions are based on, enabling crash recovery |

## Challenge Questions

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

Snapshots capture state at discrete intervals, so any writes between the last snapshot and the crash are lost. The WAL records every individual mutation, so recovery replays up to the last successfully written entry — typically losing at most one operation. Most production systems use both: the WAL for durability between snapshots, and snapshots to bound WAL size and speed up recovery.
:::

::: details Q4: Two operations in the WAL are: (1) SET balance=100, (2) SET balance=200. During recovery, the system replays both. Does the replay order matter, and why?
**Answer:** Yes, order matters. Replaying (2) before (1) would set balance to 100, which is incorrect. WAL entries must be replayed in the exact order they were written.

WAL correctness depends on sequential replay reproducing the exact same state transitions as the original execution. This is why the WAL is an ordered, append-only log — not a set of unordered operations. If operations were commutative and idempotent (like "increment by 5"), order might not matter, but most real mutations (SET, DELETE) are order-dependent.
:::
