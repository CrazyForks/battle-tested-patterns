---
description: "定期快照一致性状态，使恢复只需从检查点开始重放——而不是从时间的起点。"
---

# 模式：检查点 (Checkpointing)

## 一句话

定期快照一致性状态，使恢复只需从检查点开始重放——而不是从时间的起点。

<DemoBadge />

## 核心思想

检查点在已知时间点捕获当前系统状态的一致性快照。崩溃后，恢复加载最后的检查点，只重放之后记录的操作。没有检查点，基于 WAL 的系统必须在每次重启时重放整个历史——这会无限增长。检查点将恢复时间限制在最后一个检查点以来的时间间隔内。

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

| 属性 | 值 |
|------|------|
| 恢复时间 | 与上次检查点以来的操作数成正比 |
| 检查点代价 | O(state_size) 序列化当前状态 |
| WAL 截断 | 可安全丢弃检查点之前的日志条目 |
| 一致性 | 检查点必须捕获一致性快照 |

**动手试试** — 递增状态、创建检查点、模拟崩溃，然后从检查点恢复：

<CheckpointingViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| PostgreSQL | [checkpointer.c#L218-L360](https://github.com/postgres/postgres/blob/master/src/backend/postmaster/checkpointer.c#L218-L360) | `CheckpointerMain` — 检查点后台进程。在循环中等待检查点请求或 `checkpoint_timeout`（默认 5 分钟）。调用 `CreateCheckPoint` 将所有脏缓冲区刷写到磁盘，写入检查点 WAL 记录，并用检查点位置更新 `pg_control`。崩溃恢复时，PostgreSQL 读取 `pg_control` 找到最后的检查点，只从该点开始重放 WAL。 |
| Redis | [rdb.c#L1414-L1529](https://github.com/redis/redis/blob/unstable/src/rdb.c#L1414-L1529) | `rdbSaveRio` 将整个 Redis 数据集序列化到 RDB 文件——一个时间点快照。Redis fork 一个子进程（`rdbSaveBackground`）来写入快照而不阻塞主线程。RDB 文件就是一个完整的检查点：重启时，Redis 加载它来即时恢复状态。结合 AOF（仅追加文件），Redis 只需重放在最后一次 RDB 快照之后写入的 AOF 条目。 |

## 实现

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

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带检查点和恢复的 WAL | `exercises/typescript/checkpointing/01-basic.test.ts` |
| 进阶 | 增量检查点（仅脏页） | `exercises/typescript/checkpointing/02-intermediate.test.ts` |

运行练习：`pnpm test`

## 何时使用

- **数据库崩溃恢复** -- 限制 WAL 重放时间（PostgreSQL、MySQL）
- **内存缓存** -- 持久化状态以在重启后存活（Redis RDB）
- **流处理** -- 保存处理位置以实现精确一次保证（Flink、Kafka）
- **长时间运行的计算** -- 保存进度以在故障后恢复（ML 训练）
- **游戏存档** -- 在安全点快照游戏状态

## 何时不用

- **无状态服务** -- 没有需要检查点的状态
- **非常小的状态** -- 如果 WAL 重放时间 < 1 秒，检查点增加复杂性但收益很小
- **快速变化的状态** -- 如果整个状态在检查点之间都变了，快照和重放 WAL 一样昂贵
- **分布式状态** -- 跨节点协调一致性检查点需要分布式快照协议（Chandy-Lamport）

## 更多生产案例

- [Apache Flink](https://github.com/apache/flink) -- 分布式快照实现精确一次的流处理
- [etcd](https://github.com/etcd-io/etcd) -- 定期快照以压缩 Raft 日志
- [SQLite WAL 模式](https://www.sqlite.org/wal.html) -- WAL 检查点将页面传回数据库文件
- [PyTorch](https://github.com/pytorch/pytorch) -- 模型检查点以在中断后恢复训练

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [预写日志 (Write-Ahead Log)](/zh/patterns/write-ahead-log/) | 检查点截断 WAL——恢复只从最新检查点重放 |
| [写时复制 (Copy-on-Write)](/zh/patterns/copy-on-write/) | 写时复制在不停止写入的情况下实现一致快照 |
| [逻辑时钟 / Epoch (Logical Clock)](/zh/patterns/logical-clock/) | 检查点与逻辑时钟位置关联以保证一致性 |

## 挑战题

::: details Q1: 你的 PostgreSQL 数据库配置了 checkpoint_timeout = 30 分钟。服务器崩溃了。最坏情况的恢复时间是多少，如何减少？
**答案：** 最坏情况：重放最多 30 分钟的 WAL 条目。减少方法：降低 checkpoint_timeout（例如改为 5 分钟）或 checkpoint_completion_target。

权衡很明显：更频繁的检查点意味着更快的恢复但正常运行时更多的 I/O 开销。每次检查点将所有脏页刷写到磁盘，可能导致写入突发。PostgreSQL 的 `checkpoint_completion_target`（默认 0.9）将 I/O 分散到检查点间隔的 90% 以避免尖峰。在高吞吐系统中，你可能每 1-5 分钟检查点一次；对于低流量系统，30 分钟或更长时间是合适的。
:::

::: details Q2: Redis 使用 fork() 创建子进程来进行 RDB 快照。数据库有 10GB。Redis 在快照期间需要 20GB 的内存吗？
**答案：** 不需要，这要感谢写时复制（COW）。fork 出的子进程共享父进程的内存页面。只有父进程在 fork 之后修改的页面才会被复制。在实践中，快照期间的内存开销通常是数据集的 10-30%，而不是 100%。

操作系统内核对 fork 的进程页面使用 COW。子进程读取冻结的状态，而父进程继续处理写入。只有父进程修改的页面会被复制（通过内核的 COW 机制）。如果快照期间写入量低，内存开销是最小的。然而，在高写入负载下，COW 页面复制在最坏情况下可以接近 100%。这就是为什么 Redis 建议在后台保存期间监控 `rss`。
:::

::: details Q3: 你正在为流处理系统实现检查点。每次检查点需要 5 秒钟来写入，但系统每秒处理 10 万个事件。在检查点创建期间到达的 50 万个事件会怎样？
**答案：** 系统必须在检查点创建期间继续处理事件。检查点捕获的是开始那一刻的状态一致性快照，而不是完成时的。传入的事件正常处理并记录到 WAL。

这就是"一致性快照"问题。解决方案：(1) 使用写时复制快照（如 Redis fork）——检查点在 fork 时捕获状态，新写入进入 COW 页面；(2) 使用模糊检查点加"重做日志"——开始快照，跟踪快照期间更改的页面，并在检查点元数据中包含这些更改；(3) 使用屏障——短暂暂停处理以获取一致性切割，然后恢复。Apache Flink 使用受 Chandy-Lamport 算法启发的异步屏障快照。
:::

::: details Q4: 你的系统每小时做一次检查点，但检查点文件有 50GB。磁盘写入速度是 200MB/s，所以写入需要约 4 分钟。在这 4 分钟内，你能安全地截断 WAL 吗？
**答案：** 不能。你只能在检查点完全写入并确认持久化（fsync）之后才能截断检查点之前的 WAL 条目。如果系统在检查点写入期间崩溃，你需要 WAL 来恢复。

这是一个常见错误：在检查点完成之前截断 WAL。如果检查点写入中途失败（磁盘满、崩溃、断电），你既丢失了不完整的检查点，又丢失了恢复所需的 WAL 条目。安全的顺序是：(1) 将检查点写入临时文件，(2) fsync 临时文件，(3) 原子地将其重命名为检查点文件，(4) 然后才截断 WAL。PostgreSQL 严格遵循这个协议，etcd 的快照机制也是如此。
:::
