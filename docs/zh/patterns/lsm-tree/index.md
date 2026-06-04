---
description: "将写入缓冲在内存中，刷写到磁盘的有序文件，后台合并文件——用读放大换取快速写入。"
---

# 模式：LSM 树 (Log-Structured Merge Tree)

## 一句话

将写入缓冲在内存中，刷写到磁盘的有序文件，后台合并文件——用读放大换取快速写入。

<DemoBadge />

## 核心思想

LSM 树将写入吸收到内存中的有序结构（memtable）中。当 memtable 达到大小阈值时，被刷写到磁盘作为不可变的有序段（SSTable）。后台 compaction 合并多个有序段以限制文件数量并回收已删除/覆盖的键的空间。读取先检查 memtable，然后检查每个层级的有序段。

```text
  Write Path                          Read Path
  ──────────                          ─────────
  PUT k=v ──►  ┌────────────┐         GET k
               │  Memtable  │ ◄──── 1. Check memtable
               │ (sorted,   │
               │  in-memory)│
               └─────┬──────┘
          flush when  │
          size > limit│
                      ▼
               ┌────────────┐
               │  Level 0   │ ◄──── 2. Check L0 files
               │  (SSTables)│
               └─────┬──────┘
          compact     │
          when full   │
                      ▼
               ┌────────────┐
               │  Level 1   │ ◄──── 3. Check L1 files
               │  (merged)  │
               └─────┬──────┘
                      ▼
                     ...
```

| 属性 | 值 |
|------|------|
| 写放大 | 由于 compaction 为 O(level_count) |
| 读放大 | 最坏情况 O(level_count) |
| 写入吞吐 | 非常高——仅顺序 I/O |
| 空间放大 | compaction 期间临时数据重复 |

**动手试试** — 写入键到 memtable，观察刷写到 SSTable，并进行层级压缩：

<LSMTreeViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| LevelDB | [db_impl.cc#L1241-L1368](https://github.com/google/leveldb/blob/main/db/db_impl.cc#L1241-L1368) | `DBImpl::Write` — 核心写入路径。将写入批量分组（L1241-L1288），追加到 WAL（L1311），插入 memtable（L1337-L1354）。当 memtable 超过 `write_buffer_size` 时，`MakeRoomForWrite`（L1368）触发刷写：当前 memtable 变为不可变并创建新的。后台 compaction 然后跨层级合并 SSTable 文件。 |
| RocksDB | [memtable.cc#L458-L534](https://github.com/facebook/rocksdb/blob/main/db/memtable.cc#L458-L534) | `MemTable::Add` 将带有序列号和类型的键值对插入基于跳表的 memtable。memtable 是所有写入的第一个目的地。当达到 `write_buffer_size` 时变为不可变并安排刷写到 L0 SST 文件。RocksDB 扩展了 LevelDB 的设计，支持并发 memtable 写入、column family 和可插拔的 memtable 实现。 |

## 实现

::: code-group

```typescript [TypeScript]
interface KVEntry {
  key: string;
  value: string | null; // null = tombstone (deleted)
  seq: number;
}

class Memtable {
  private entries: Map<string, KVEntry> = new Map();
  private _size = 0;

  put(key: string, value: string, seq: number): void {
    this.entries.set(key, { key, value, seq });
    this._size++;
  }

  delete(key: string, seq: number): void {
    this.entries.set(key, { key, value: null, seq });
    this._size++;
  }

  get(key: string): KVEntry | undefined {
    return this.entries.get(key);
  }

  get size(): number { return this._size; }

  flush(): KVEntry[] {
    const sorted = [...this.entries.values()].sort((a, b) => a.key.localeCompare(b.key));
    this.entries.clear();
    this._size = 0;
    return sorted;
  }
}

type SortedRun = KVEntry[];

class LSMTree {
  private memtable = new Memtable();
  private runs: SortedRun[] = []; // L0 sorted runs, newest first
  private seq = 0;
  private readonly flushThreshold: number;
  private readonly maxRuns: number;

  constructor(flushThreshold = 4, maxRuns = 4) {
    this.flushThreshold = flushThreshold;
    this.maxRuns = maxRuns;
  }

  put(key: string, value: string): void {
    this.memtable.put(key, value, this.seq++);
    if (this.memtable.size >= this.flushThreshold) {
      this.flushMemtable();
    }
  }

  delete(key: string): void {
    this.memtable.delete(key, this.seq++);
    if (this.memtable.size >= this.flushThreshold) {
      this.flushMemtable();
    }
  }

  get(key: string): string | undefined {
    // Check memtable first
    const memEntry = this.memtable.get(key);
    if (memEntry) return memEntry.value ?? undefined;

    // Check sorted runs (newest first)
    for (const run of this.runs) {
      const entry = this.binarySearch(run, key);
      if (entry) return entry.value ?? undefined;
    }
    return undefined;
  }

  private binarySearch(run: SortedRun, key: string): KVEntry | undefined {
    let lo = 0, hi = run.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const cmp = run[mid]!.key.localeCompare(key);
      if (cmp === 0) return run[mid];
      if (cmp < 0) lo = mid + 1;
      else hi = mid - 1;
    }
    return undefined;
  }

  private flushMemtable(): void {
    const run = this.memtable.flush();
    this.runs.unshift(run); // newest first
    if (this.runs.length > this.maxRuns) {
      this.compact();
    }
  }

  private compact(): void {
    // Merge all runs into one
    const merged = new Map<string, KVEntry>();
    // Process oldest first so newest wins
    for (let i = this.runs.length - 1; i >= 0; i--) {
      for (const entry of this.runs[i]!) {
        merged.set(entry.key, entry);
      }
    }
    // Remove tombstones and sort
    const compacted = [...merged.values()]
      .filter((e) => e.value !== null)
      .sort((a, b) => a.key.localeCompare(b.key));
    this.runs = compacted.length > 0 ? [compacted] : [];
  }

  get runCount(): number { return this.runs.length; }
}
```

```go [Go]
package lsm

import "sort"

type KVEntry struct {
	Key   string
	Value *string // nil = tombstone
	Seq   int
}

type Memtable struct {
	entries map[string]KVEntry
	size    int
}

func NewMemtable() *Memtable {
	return &Memtable{entries: make(map[string]KVEntry)}
}

func (m *Memtable) Put(key, value string, seq int) {
	m.entries[key] = KVEntry{Key: key, Value: &value, Seq: seq}
	m.size++
}

func (m *Memtable) Delete(key string, seq int) {
	m.entries[key] = KVEntry{Key: key, Value: nil, Seq: seq}
	m.size++
}

func (m *Memtable) Get(key string) (KVEntry, bool) {
	e, ok := m.entries[key]
	return e, ok
}

func (m *Memtable) Flush() []KVEntry {
	result := make([]KVEntry, 0, len(m.entries))
	for _, e := range m.entries {
		result = append(result, e)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Key < result[j].Key
	})
	m.entries = make(map[string]KVEntry)
	m.size = 0
	return result
}

type LSMTree struct {
	memtable       *Memtable
	runs           [][]KVEntry
	seq            int
	flushThreshold int
	maxRuns        int
}

func NewLSMTree(flushThreshold, maxRuns int) *LSMTree {
	return &LSMTree{
		memtable:       NewMemtable(),
		flushThreshold: flushThreshold,
		maxRuns:        maxRuns,
	}
}

func (t *LSMTree) Put(key, value string) {
	t.memtable.Put(key, value, t.seq)
	t.seq++
	if t.memtable.size >= t.flushThreshold {
		t.flushMemtable()
	}
}

func (t *LSMTree) Delete(key string) {
	t.memtable.Delete(key, t.seq)
	t.seq++
	if t.memtable.size >= t.flushThreshold {
		t.flushMemtable()
	}
}

func (t *LSMTree) Get(key string) (string, bool) {
	if e, ok := t.memtable.Get(key); ok {
		if e.Value == nil {
			return "", false
		}
		return *e.Value, true
	}
	for _, run := range t.runs {
		if e := binarySearch(run, key); e != nil {
			if e.Value == nil {
				return "", false
			}
			return *e.Value, true
		}
	}
	return "", false
}

func binarySearch(run []KVEntry, key string) *KVEntry {
	lo, hi := 0, len(run)-1
	for lo <= hi {
		mid := (lo + hi) / 2
		if run[mid].Key == key {
			return &run[mid]
		}
		if run[mid].Key < key {
			lo = mid + 1
		} else {
			hi = mid - 1
		}
	}
	return nil
}

func (t *LSMTree) flushMemtable() {
	run := t.memtable.Flush()
	t.runs = append([][]KVEntry{run}, t.runs...)
	if len(t.runs) > t.maxRuns {
		t.compact()
	}
}

func (t *LSMTree) compact() {
	merged := make(map[string]KVEntry)
	for i := len(t.runs) - 1; i >= 0; i-- {
		for _, e := range t.runs[i] {
			merged[e.Key] = e
		}
	}
	result := make([]KVEntry, 0)
	for _, e := range merged {
		if e.Value != nil {
			result = append(result, e)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Key < result[j].Key
	})
	if len(result) > 0 {
		t.runs = [][]KVEntry{result}
	} else {
		t.runs = nil
	}
}

func (t *LSMTree) RunCount() int {
	return len(t.runs)
}
```

```python [Python]
from dataclasses import dataclass, field
from bisect import bisect_left

@dataclass
class KVEntry:
    key: str
    value: str | None  # None = tombstone
    seq: int = 0

class Memtable:
    def __init__(self):
        self._entries: dict[str, KVEntry] = {}
        self._size = 0

    def put(self, key: str, value: str, seq: int) -> None:
        self._entries[key] = KVEntry(key=key, value=value, seq=seq)
        self._size += 1

    def delete(self, key: str, seq: int) -> None:
        self._entries[key] = KVEntry(key=key, value=None, seq=seq)
        self._size += 1

    def get(self, key: str) -> KVEntry | None:
        return self._entries.get(key)

    @property
    def size(self) -> int:
        return self._size

    def flush(self) -> list[KVEntry]:
        result = sorted(self._entries.values(), key=lambda e: e.key)
        self._entries.clear()
        self._size = 0
        return result

class LSMTree:
    def __init__(self, flush_threshold: int = 4, max_runs: int = 4):
        self._memtable = Memtable()
        self._runs: list[list[KVEntry]] = []
        self._seq = 0
        self._flush_threshold = flush_threshold
        self._max_runs = max_runs

    def put(self, key: str, value: str) -> None:
        self._memtable.put(key, value, self._seq)
        self._seq += 1
        if self._memtable.size >= self._flush_threshold:
            self._flush()

    def delete(self, key: str) -> None:
        self._memtable.delete(key, self._seq)
        self._seq += 1
        if self._memtable.size >= self._flush_threshold:
            self._flush()

    def get(self, key: str) -> str | None:
        entry = self._memtable.get(key)
        if entry is not None:
            return entry.value

        for run in self._runs:
            entry = self._binary_search(run, key)
            if entry is not None:
                return entry.value
        return None

    def _binary_search(self, run: list[KVEntry], key: str) -> KVEntry | None:
        keys = [e.key for e in run]
        i = bisect_left(keys, key)
        if i < len(run) and run[i].key == key:
            return run[i]
        return None

    def _flush(self) -> None:
        run = self._memtable.flush()
        self._runs.insert(0, run)
        if len(self._runs) > self._max_runs:
            self._compact()

    def _compact(self) -> None:
        merged: dict[str, KVEntry] = {}
        for run in reversed(self._runs):
            for entry in run:
                merged[entry.key] = entry
        result = [e for e in merged.values() if e.value is not None]
        result.sort(key=lambda e: e.key)
        self._runs = [result] if result else []

    @property
    def run_count(self) -> int:
        return len(self._runs)
```

```rust [Rust]
use std::collections::BTreeMap;

#[derive(Clone, Debug)]
pub struct KVEntry {
    pub key: String,
    pub value: Option<String>, // None = tombstone
    pub seq: usize,
}

pub struct Memtable {
    entries: BTreeMap<String, KVEntry>,
    size: usize,
}

impl Memtable {
    pub fn new() -> Self {
        Memtable { entries: BTreeMap::new(), size: 0 }
    }

    pub fn put(&mut self, key: &str, value: &str, seq: usize) {
        self.entries.insert(key.to_string(), KVEntry {
            key: key.to_string(), value: Some(value.to_string()), seq,
        });
        self.size += 1;
    }

    pub fn delete(&mut self, key: &str, seq: usize) {
        self.entries.insert(key.to_string(), KVEntry {
            key: key.to_string(), value: None, seq,
        });
        self.size += 1;
    }

    pub fn get(&self, key: &str) -> Option<&KVEntry> {
        self.entries.get(key)
    }

    pub fn size(&self) -> usize { self.size }

    pub fn flush(&mut self) -> Vec<KVEntry> {
        let result: Vec<KVEntry> = self.entries.values().cloned().collect();
        self.entries.clear();
        self.size = 0;
        result
    }
}

pub struct LSMTree {
    memtable: Memtable,
    runs: Vec<Vec<KVEntry>>,
    seq: usize,
    flush_threshold: usize,
    max_runs: usize,
}

impl LSMTree {
    pub fn new(flush_threshold: usize, max_runs: usize) -> Self {
        LSMTree {
            memtable: Memtable::new(),
            runs: Vec::new(),
            seq: 0,
            flush_threshold,
            max_runs,
        }
    }

    pub fn put(&mut self, key: &str, value: &str) {
        self.memtable.put(key, value, self.seq);
        self.seq += 1;
        if self.memtable.size() >= self.flush_threshold {
            self.flush_memtable();
        }
    }

    pub fn delete(&mut self, key: &str) {
        self.memtable.delete(key, self.seq);
        self.seq += 1;
        if self.memtable.size() >= self.flush_threshold {
            self.flush_memtable();
        }
    }

    pub fn get(&self, key: &str) -> Option<&str> {
        if let Some(entry) = self.memtable.get(key) {
            return entry.value.as_deref();
        }
        for run in &self.runs {
            if let Ok(idx) = run.binary_search_by(|e| e.key.as_str().cmp(key)) {
                return run[idx].value.as_deref();
            }
        }
        None
    }

    fn flush_memtable(&mut self) {
        let run = self.memtable.flush();
        self.runs.insert(0, run);
        if self.runs.len() > self.max_runs {
            self.compact();
        }
    }

    fn compact(&mut self) {
        let mut merged = BTreeMap::new();
        for run in self.runs.iter().rev() {
            for entry in run {
                merged.insert(entry.key.clone(), entry.clone());
            }
        }
        let result: Vec<KVEntry> = merged.into_values()
            .filter(|e| e.value.is_some())
            .collect();
        self.runs = if result.is_empty() { vec![] } else { vec![result] };
    }

    pub fn run_count(&self) -> usize { self.runs.len() }
}
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带刷写到有序段的内存 memtable | `exercises/typescript/lsm-tree/01-basic.test.ts` |
| 进阶 | 多层 compaction 与大小触发的合并 | `exercises/typescript/lsm-tree/02-intermediate.test.ts` |

运行练习：`pnpm test`

## 何时使用

- **写密集工作负载** -- 日志记录、时序数据、事件流
- **键值存储** -- LevelDB、RocksDB、Cassandra、HBase
- **嵌入式数据库** -- 空间高效、实现简单
- **追加为主的数据** -- IoT 传感器数据、分析事件
- **SSD 优化存储** -- 顺序写入最大化 SSD 寿命

## 何时不用

- **读密集工作负载** -- 读取可能需要检查多个层级；快速读取请用 B+ 树
- **小数据集** -- LSM 的开销（compaction、多文件）对于能放入 B+ 树的数据不值得
- **有严格延迟要求的范围扫描** -- compaction 可能导致延迟尖峰
- **频繁更新 + 点读** -- 对同一键的重复更新在 compaction 期间产生写放大

## 更多生产案例

- [Apache Cassandra](https://github.com/apache/cassandra) -- 基于 LSM 的分布式 NoSQL 数据库
- [ScyllaDB](https://github.com/scylladb/scylladb) -- 高性能 Cassandra 兼容的 LSM 存储
- [BadgerDB](https://github.com/dgraph-io/badger) -- Go 原生的 LSM 键值存储，支持值分离
- [SQLite LSM 扩展](https://www.sqlite.org/lsm.html) -- SQLite 的基于 LSM 的存储后端

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [跳表 (Skip List)](/zh/patterns/skip-list/) | 跳表充当 LSM 树中的内存有序缓冲区（memtable） |
| [布隆过滤器 (Bloom Filter)](/zh/patterns/bloom-filter/) | 每个 SSTable 上的布隆过滤器避免查找时不必要的磁盘读取 |
| [归并迭代器 (Merge Iterator / K-Way Merge)](/zh/patterns/merge-iterator/) | 压缩使用归并迭代器合并多个有序 SSTable |
| [预写日志 (Write-Ahead Log)](/zh/patterns/write-ahead-log/) | WAL 确保 memtable 写入在刷盘到 SSTable 前幸存崩溃 |
| [墓碑 / 延迟删除 (Tombstone)](/zh/patterns/tombstone/) | LSM 树使用墓碑标记删除，在压缩时清理 |

## 挑战题

::: details Q1: 你的 LSM 树有 5 个层级（L0-L4）。读取键 "user:999" 没有找到结果。它可能需要检查多少个文件？
**答案：** 最坏情况下，所有层级的所有文件。L0 文件可能重叠，所以需要检查所有 L0 文件。L1-L4 文件在层级内不重叠，所以每层最多检查一个文件。总计：所有 L0 文件 + 4（其余每层一个）。

这就是"读放大"——LSM 树的根本权衡。解决方案：(1) 在每个 SSTable 上使用 Bloom filter 来跳过肯定不包含该键的文件（LevelDB/RocksDB 就是这么做的）；(2) 通过积极 compaction 最小化 L0 文件；(3) 使用前缀索引跳过整个层级。RocksDB 的 Bloom filter 通常将读取减少到 1-2 次文件读取，即使有很多层级。
:::

::: details Q2: 你从 LSM 树中删除了一个键。该键仍然存在于磁盘上较旧的 SSTable 中。空间是否立即释放？
**答案：** 不是。删除操作向 memtable 写入一个 tombstone 标记。原始的键值对保留在旧的 SSTable 中，直到 compaction 合并该 SSTable 并遇到 tombstone，此时两者都被丢弃。

这就是为什么 LSM 树有"空间放大"。已删除的数据在 compaction 到达之前一直占用磁盘空间。在极端情况下（删除密集的工作负载），磁盘使用量可能暂时显著超过逻辑数据大小。RocksDB 通过定期的 compaction filter 和手动 compaction 触发来解决这个问题。tombstone 本身也占用空间，必须保留足够长的时间以遮蔽所有层级中该键的所有旧副本。
:::

::: details Q3: 你的 LSM 树每秒接收 10 万次写入。Compaction 跟不上——L0 积累文件的速度超过合并速度。会发生什么，如何修复？
**答案：** 写入停顿。当 L0 超过文件限制时，系统必须限流或暂停传入写入，直到 compaction 赶上。这导致延迟尖峰。

LevelDB 的 `MakeRoomForWrite` 明确检查 L0 文件数量，超过 `kL0_SlowdownWritesTrigger`（8 个文件）时休眠，在 `kL0_StopWritesTrigger`（12 个文件）时完全停止写入。解决方案：(1) 增加 compaction 并行度（RocksDB 支持并发 compaction 线程）；(2) 使用 leveled compaction 代替 size-tiered 来限制 L0 增长；(3) 增大 memtable 大小以减少刷写频率；(4) 使用写入速率限制来平滑突发而不是触及硬限制。
:::

::: details Q4: LevelDB 使用单线程 compaction 模型。RocksDB 改为多线程 compaction。这解决了什么问题，又产生了什么新问题？
**答案：** 多线程 compaction 解决了吞吐量瓶颈——通过并行运行多个合并操作，compaction 可以跟上更高的写入速率。新问题：对重叠键范围的并发 compaction 可能导致写入冲突，需要仔细协调。

使用单线程 compaction 时，一个慢合并会阻塞所有其他合并——在高负载下写入停顿变得常见。多线程 compaction 允许 L0→L1 和 L2→L3 的合并同时进行。然而，两个触及相同键范围的 compaction 任务会产生冲突的输出。RocksDB 通过跟踪哪些键范围被活动 compaction "锁定"，只调度不重叠的 compaction 任务来解决此问题。这种协调增加了复杂性，但显著提高了持续写入吞吐量。
:::
