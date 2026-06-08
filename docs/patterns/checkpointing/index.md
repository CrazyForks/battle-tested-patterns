---
description: "Periodically snapshot consistent state so recovery replays only from the checkpoint — not from the beginning of time."
difficulty: "intermediate"
---

# Pattern: Checkpointing

<DifficultyBadge />

## One Liner

Periodically snapshot consistent state so recovery replays only from the checkpoint — not from the beginning of time.

<DemoBadge />

## Real-World Analogy

Saving your game. You play for a while, hit 'save,' and if you die, you restart from the last save point instead of the beginning. The more often you save, the less progress you lose — but each save takes time.

## Core Idea

Checkpointing captures a consistent snapshot of the current system state at a known point. On crash, recovery loads the last checkpoint and replays only the operations logged after it. Without checkpointing, a WAL-based system must replay its entire history on every restart — which grows unbounded. Checkpointing bounds recovery time to the interval since the last checkpoint.

```text
  Time ──────────────────────────────────────────────►

  WAL:  [op1] [op2] [op3] [op4] [op5] [op6] [op7] [op8]
                          ▲                    ▲
                     Checkpoint 1         Checkpoint 2
                     (state snapshot)     (state snapshot)

  Without checkpointing:
    Recovery replays: op1, op2, op3, op4, op5, op6, op7, op8

  With checkpointing:
    Recovery loads Checkpoint 2, replays: op7, op8 only
```

| Property | Value |
|----------|-------|
| Recovery time | Proportional to ops since last checkpoint |
| Checkpoint cost | O(state_size) to serialize current state |
| WAL truncation | Safe to discard log entries before checkpoint |
| Consistency | Checkpoint must capture a consistent snapshot |

**Try it yourself** — increment state, take checkpoints, crash, and restore from a checkpoint:

<CheckpointingViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| PostgreSQL | [checkpointer.c#L218-L360](https://github.com/postgres/postgres/blob/master/src/backend/postmaster/checkpointer.c#L218-L360) | `CheckpointerMain` — the checkpoint background process. Runs in a loop waiting for checkpoint requests or `checkpoint_timeout` (default 5 minutes). Calls `CreateCheckPoint` which flushes all dirty buffers to disk, writes a checkpoint WAL record, and updates `pg_control` with the checkpoint location. On crash recovery, PostgreSQL reads `pg_control` to find the last checkpoint and replays WAL only from that point. |
| Redis | [rdb.c#L1414-L1529](https://github.com/redis/redis/blob/unstable/src/rdb.c#L1414-L1529) | `rdbSaveRio` serializes the entire Redis dataset to an RDB file — a point-in-time snapshot. Redis forks a child process (`rdbSaveBackground`) to write the snapshot without blocking the main thread. The RDB file is a complete checkpoint: on restart, Redis loads it to restore state instantly. Combined with AOF (append-only file), Redis can replay only the AOF entries written after the last RDB snapshot. |

## Implementation

::: code-group

```typescript [TypeScript]
interface LogEntry {
  id: number;
  operation: string;
  data: Record<string, unknown>;
}

class CheckpointableStore {
  private state: Map<string, unknown> = new Map();
  private wal: LogEntry[] = [];
  private nextId = 1;
  private checkpoint: { state: Map<string, unknown>; walPosition: number } | null = null;

  /** Apply an operation, logging it to the WAL first. */
  apply(operation: string, key: string, value: unknown): void {
    const entry: LogEntry = {
      id: this.nextId++,
      operation,
      data: { key, value },
    };
    this.wal.push(entry);
    this.executeOp(entry);
  }

  get(key: string): unknown {
    return this.state.get(key);
  }

  /** Take a checkpoint: snapshot current state and record WAL position. */
  takeCheckpoint(): void {
    this.checkpoint = {
      state: new Map(this.state),
      walPosition: this.wal.length,
    };
  }

  /** Simulate crash: wipe in-memory state but keep WAL and checkpoint. */
  simulateCrash(): void {
    this.state = new Map();
  }

  /** Recover from crash using checkpoint + WAL replay. */
  recover(): number {
    if (this.checkpoint) {
      this.state = new Map(this.checkpoint.state);
      let replayed = 0;
      for (let i = this.checkpoint.walPosition; i < this.wal.length; i++) {
        this.executeOp(this.wal[i]!);
        replayed++;
      }
      return replayed;
    }
    // No checkpoint: replay entire WAL
    this.state = new Map();
    for (const entry of this.wal) {
      this.executeOp(entry);
    }
    return this.wal.length;
  }

  private executeOp(entry: LogEntry): void {
    const { key, value } = entry.data as { key: string; value: unknown };
    if (entry.operation === 'SET') {
      this.state.set(key, value);
    } else if (entry.operation === 'DELETE') {
      this.state.delete(key);
    }
  }

  get walLength(): number { return this.wal.length; }
  get stateSize(): number { return this.state.size; }
}
```

```rust [Rust]
use std::collections::HashMap;

pub struct LogEntry {
    pub id: usize,
    pub operation: String,
    pub key: String,
    pub value: Option<String>,
}

struct Snapshot {
    state: HashMap<String, String>,
    wal_position: usize,
}

pub struct CheckpointableStore {
    state: HashMap<String, String>,
    wal: Vec<LogEntry>,
    next_id: usize,
    checkpoint: Option<Snapshot>,
}

impl CheckpointableStore {
    pub fn new() -> Self {
        CheckpointableStore {
            state: HashMap::new(),
            wal: Vec::new(),
            next_id: 1,
            checkpoint: None,
        }
    }

    pub fn apply(&mut self, operation: &str, key: &str, value: Option<&str>) {
        let entry = LogEntry {
            id: self.next_id,
            operation: operation.to_string(),
            key: key.to_string(),
            value: value.map(|v| v.to_string()),
        };
        self.next_id += 1;
        self.execute_op(&entry);
        self.wal.push(entry);
    }

    pub fn get(&self, key: &str) -> Option<&str> {
        self.state.get(key).map(|s| s.as_str())
    }

    pub fn take_checkpoint(&mut self) {
        self.checkpoint = Some(Snapshot {
            state: self.state.clone(),
            wal_position: self.wal.len(),
        });
    }

    pub fn simulate_crash(&mut self) {
        self.state.clear();
    }

    pub fn recover(&mut self) -> usize {
        if let Some(ref snap) = self.checkpoint {
            self.state = snap.state.clone();
            let start = snap.wal_position;
            let mut replayed = 0;
            for i in start..self.wal.len() {
                self.execute_op_by_index(i);
                replayed += 1;
            }
            return replayed;
        }
        self.state.clear();
        for i in 0..self.wal.len() {
            self.execute_op_by_index(i);
        }
        self.wal.len()
    }

    fn execute_op(&mut self, entry: &LogEntry) {
        if entry.operation == "SET" {
            if let Some(ref v) = entry.value {
                self.state.insert(entry.key.clone(), v.clone());
            }
        } else if entry.operation == "DELETE" {
            self.state.remove(&entry.key);
        }
    }

    fn execute_op_by_index(&mut self, idx: usize) {
        let op = self.wal[idx].operation.clone();
        let key = self.wal[idx].key.clone();
        let value = self.wal[idx].value.clone();
        if op == "SET" {
            if let Some(v) = value {
                self.state.insert(key, v);
            }
        } else if op == "DELETE" {
            self.state.remove(&key);
        }
    }

    pub fn wal_length(&self) -> usize { self.wal.len() }
    pub fn state_size(&self) -> usize { self.state.len() }
}
```

```go [Go]
package checkpoint

type LogEntry struct {
	ID        int
	Operation string
	Key       string
	Value     any
}

type stateSnapshot struct {
	state       map[string]any
	walPosition int
}

type CheckpointableStore struct {
	state      map[string]any
	wal        []LogEntry
	nextID     int
	checkpoint *stateSnapshot
}

func NewStore() *CheckpointableStore {
	return &CheckpointableStore{
		state:  make(map[string]any),
		nextID: 1,
	}
}

func (s *CheckpointableStore) Apply(operation, key string, value any) {
	entry := LogEntry{ID: s.nextID, Operation: operation, Key: key, Value: value}
	s.nextID++
	s.wal = append(s.wal, entry)
	s.executeOp(entry)
}

func (s *CheckpointableStore) Get(key string) (any, bool) {
	v, ok := s.state[key]
	return v, ok
}

func (s *CheckpointableStore) TakeCheckpoint() {
	snap := make(map[string]any, len(s.state))
	for k, v := range s.state {
		snap[k] = v
	}
	s.checkpoint = &stateSnapshot{state: snap, walPosition: len(s.wal)}
}

func (s *CheckpointableStore) SimulateCrash() {
	s.state = make(map[string]any)
}

func (s *CheckpointableStore) Recover() int {
	if s.checkpoint != nil {
		s.state = make(map[string]any, len(s.checkpoint.state))
		for k, v := range s.checkpoint.state {
			s.state[k] = v
		}
		replayed := 0
		for i := s.checkpoint.walPosition; i < len(s.wal); i++ {
			s.executeOp(s.wal[i])
			replayed++
		}
		return replayed
	}
	s.state = make(map[string]any)
	for _, entry := range s.wal {
		s.executeOp(entry)
	}
	return len(s.wal)
}

func (s *CheckpointableStore) executeOp(entry LogEntry) {
	if entry.Operation == "SET" {
		s.state[entry.Key] = entry.Value
	} else if entry.Operation == "DELETE" {
		delete(s.state, entry.Key)
	}
}

func (s *CheckpointableStore) WALLength() int   { return len(s.wal) }
func (s *CheckpointableStore) StateSize() int    { return len(s.state) }
```

```python [Python]
from dataclasses import dataclass, field
from typing import Any

@dataclass
class LogEntry:
    id: int
    operation: str
    key: str
    value: Any = None

class CheckpointableStore:
    def __init__(self):
        self._state: dict[str, Any] = {}
        self._wal: list[LogEntry] = []
        self._next_id = 1
        self._checkpoint: dict | None = None  # {state, wal_position}

    def apply(self, operation: str, key: str, value: Any = None) -> None:
        entry = LogEntry(id=self._next_id, operation=operation, key=key, value=value)
        self._next_id += 1
        self._wal.append(entry)
        self._execute_op(entry)

    def get(self, key: str) -> Any:
        return self._state.get(key)

    def take_checkpoint(self) -> None:
        self._checkpoint = {
            "state": dict(self._state),
            "wal_position": len(self._wal),
        }

    def simulate_crash(self) -> None:
        self._state = {}

    def recover(self) -> int:
        if self._checkpoint is not None:
            self._state = dict(self._checkpoint["state"])
            replayed = 0
            for i in range(self._checkpoint["wal_position"], len(self._wal)):
                self._execute_op(self._wal[i])
                replayed += 1
            return replayed
        self._state = {}
        for entry in self._wal:
            self._execute_op(entry)
        return len(self._wal)

    def _execute_op(self, entry: LogEntry) -> None:
        if entry.operation == "SET":
            self._state[entry.key] = entry.value
        elif entry.operation == "DELETE":
            self._state.pop(entry.key, None)

    @property
    def wal_length(self) -> int:
        return len(self._wal)

    @property
    def state_size(self) -> int:
        return len(self._state)
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | WAL with checkpoint and recovery | `exercises/typescript/checkpointing/01-basic.test.ts` |
| Intermediate | Incremental checkpoint (only dirty pages) | `exercises/typescript/checkpointing/02-intermediate.test.ts` |

Run exercises: `pnpm test` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/checkpointing.rs` · Go `exercises/go/checkpointing_test.go` · Python `exercises/python/test_checkpointing.py`

## When to Use

- **Database crash recovery** — bound WAL replay time (PostgreSQL, MySQL)
- **In-memory caches** — persist state to survive restarts (Redis RDB)
- **Stream processing** — save processing position for exactly-once guarantees (Flink, Kafka)
- **Long-running computations** — save progress to resume after failure (ML training)
- **Game saves** — snapshot game state at safe points

## When NOT to Use

- **Stateless services** — no state to checkpoint
- **Very small state** — if WAL replay takes < 1 second, checkpointing adds complexity for little benefit
- **Rapidly changing state** — if the entire state changes between checkpoints, snapshots are as expensive as replaying the WAL
- **Distributed state** — coordinating consistent checkpoints across nodes requires distributed snapshot protocols (Chandy-Lamport)

## More Production Uses

- [Apache Flink](https://github.com/apache/flink) — distributed snapshots for exactly-once stream processing
- [etcd](https://github.com/etcd-io/etcd) — periodic snapshots to compact the Raft log
- [SQLite WAL mode](https://www.sqlite.org/wal.html) — WAL checkpointing transfers pages back to the database file
- [PyTorch](https://github.com/pytorch/pytorch) — model checkpointing to resume training after interruption

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Write-Ahead Log (WAL)](/patterns/write-ahead-log/) | Checkpoints truncate the WAL — recovery replays only from the latest checkpoint |
| [Copy-on-Write (CoW)](/patterns/copy-on-write/) | Copy-on-write enables consistent snapshots without stopping writes |
| [Logical Clock](/patterns/logical-clock/) | Checkpoints are associated with logical clock positions for consistency |
| [Merkle Tree](/patterns/merkle-tree/) | Merkle trees verify checkpoint integrity by detecting which subtrees changed |

## Challenge Questions

::: details Q1: Your PostgreSQL database is configured with checkpoint_timeout = 30 minutes. The server crashes. What's the worst-case recovery time, and how would you reduce it?
**Answer:** Worst case: replaying up to 30 minutes of WAL entries. Reduce it by lowering checkpoint_timeout (e.g., to 5 minutes) or checkpoint_completion_target.

The trade-off is clear: more frequent checkpoints mean faster recovery but more I/O overhead during normal operation. Each checkpoint flushes all dirty pages to disk, which can cause a write burst. PostgreSQL's `checkpoint_completion_target` (default 0.9) spreads the I/O over 90% of the checkpoint interval to avoid spikes. In high-throughput systems, you might checkpoint every 1-5 minutes; for low-traffic systems, 30 minutes or more is fine.
:::

::: details Q2: Redis uses fork() to create a child process for RDB snapshots. The database is 10GB. Does Redis need 20GB of RAM during the snapshot?
**Answer:** No, thanks to copy-on-write (COW). The forked child shares the parent's memory pages. Only pages modified by the parent after the fork are duplicated. In practice, memory overhead during snapshot is typically 10-30% of the dataset, not 100%.

The OS kernel uses COW for forked process pages. The child reads the frozen state while the parent continues serving writes. Only pages that the parent modifies get copied (by the kernel's COW mechanism). If write volume is low during the snapshot, memory overhead is minimal. However, under heavy write load, COW page duplication can approach 100% in the worst case. This is why Redis recommends monitoring `rss` during background saves.
:::

::: details Q3: You're implementing checkpointing for a stream processing system. Each checkpoint takes 5 seconds to write, but the system processes 100K events/second. What happens to the 500K events that arrive during checkpoint creation?
**Answer:** The system must continue processing events during checkpoint creation. The checkpoint captures a consistent snapshot of the state at the moment it starts, not when it finishes. Incoming events are processed normally and logged to the WAL.

This is the "consistent snapshot" problem. Solutions: (1) use a copy-on-write snapshot (like Redis fork) — the checkpoint captures state at fork time while new writes go to COW pages; (2) use a fuzzy checkpoint with a "redo log" — start the snapshot, track which pages changed during the snapshot, and include those changes in the checkpoint metadata; (3) use barriers — pause processing briefly to take a consistent cut, then resume. Apache Flink uses asynchronous barrier snapshots inspired by the Chandy-Lamport algorithm.
:::

::: details Q4: Your system takes a checkpoint every hour, but the checkpoint file is 50GB. The disk write speed is 200MB/s, so writing takes ~4 minutes. During those 4 minutes, can you safely truncate the WAL?
**Answer:** No. You can only truncate WAL entries before the checkpoint AFTER the checkpoint is fully written and confirmed durable (fsynced). If the system crashes during checkpoint writing, you need the WAL to recover.

This is a common mistake: truncating the WAL before the checkpoint is complete. If the checkpoint write fails midway (disk full, crash, power loss), you've lost both the incomplete checkpoint AND the WAL entries you need for recovery. The safe sequence is: (1) write checkpoint to a temporary file, (2) fsync the temp file, (3) atomically rename it to the checkpoint file, (4) THEN truncate the WAL. PostgreSQL follows exactly this protocol, and etcd's snapshot mechanism does the same.
:::
