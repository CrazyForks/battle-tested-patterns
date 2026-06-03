# 模式：墓碑 / 延迟删除 (Tombstone)

## 一句话

用墓碑标记代替直接删除条目——后台进程稍后回收空间。

## 核心思想

不立即删除数据，而是写入一条特殊的"墓碑"记录来覆盖原始数据。读取时检查墓碑标记，将已标记的条目视为已删除。后台压缩进程随后物理删除墓碑和被覆盖的数据，真正回收空间。这将快速路径（标记删除）与慢速路径（回收空间）解耦。

```text
  Write path:                      Read path:

  delete("B")                      get("B")
      │                                │
      ▼                                ▼
  ┌──────────┐                   ┌──────────┐
  │ Log/SST  │                   │  Lookup   │
  ├──────────┤                   ├──────────┤
  │ A = "v1" │                   │ Found:    │
  │ B = tomb │ ◄── tombstone     │ B = tomb  │──► return NOT FOUND
  │ C = "v3" │                   │           │
  └──────────┘                   └──────────┘

  Compaction (background):
  ┌──────────┐      ┌──────────┐
  │ A = "v1" │      │ A = "v1" │
  │ B = "v2" │ ──►  │ C = "v3" │  B removed (tombstone + original)
  │ B = tomb │      └──────────┘
  │ C = "v3" │
  └──────────┘
```

| 属性 | 值 |
|------|------|
| 删除 | O(1) -- 仅追加墓碑标记 |
| 空间回收 | 延迟 -- 后台压缩 |
| 读开销 | 需要检查墓碑标记 |
| 一致性 | 墓碑必须传播到所有副本后才能移除 |

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| LevelDB | [dbformat.h#L39-L43](https://github.com/google/leveldb/blob/main/db/dbformat.h#L39-L43) | `kTypeDeletion`（值 0x0）在预写日志和 SSTable 中标记键已删除。压缩期间（db_impl.cc 中的 `DoCompactionWork`），当没有更早的快照引用该键时，墓碑被丢弃。 |
| Apache Cassandra | [gc_grace_seconds](https://github.com/apache/cassandra/blob/trunk/src/java/org/apache/cassandra/db/Columns.java#L1-L30) | 墓碑在 `gc_grace_seconds`（默认 10 天）期间传播到各副本，之后压缩才移除它们。这防止恢复的节点重新引入已删除数据。`Cell.isLive()` 在读取时检查墓碑状态。 |

## 实现

::: code-group

```typescript [TypeScript]
interface Entry<V> {
  value: V | null;
  deleted: boolean;
  timestamp: number;
}

class TombstoneStore<V> {
  private store = new Map<string, Entry<V>>();
  private tombstoneCount = 0;

  put(key: string, value: V): void {
    this.store.set(key, {
      value,
      deleted: false,
      timestamp: Date.now(),
    });
  }

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry || entry.deleted) return undefined;
    return entry.value!;
  }

  delete(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry || entry.deleted) return false;
    entry.deleted = true;
    entry.value = null;
    entry.timestamp = Date.now();
    this.tombstoneCount++;
    return true;
  }

  /** Compact: remove tombstones older than maxAge ms. */
  compact(maxAge: number): number {
    const cutoff = Date.now() - maxAge;
    let removed = 0;
    for (const [key, entry] of this.store) {
      if (entry.deleted && entry.timestamp < cutoff) {
        this.store.delete(key);
        removed++;
        this.tombstoneCount--;
      }
    }
    return removed;
  }

  get size(): number {
    let count = 0;
    for (const entry of this.store.values()) {
      if (!entry.deleted) count++;
    }
    return count;
  }

  get pendingTombstones(): number {
    return this.tombstoneCount;
  }
}
```

```go [Go]
type Entry struct {
	Value     string
	Deleted   bool
	Timestamp int64
}

type TombstoneStore struct {
	store          map[string]*Entry
	tombstoneCount int
}

func NewTombstoneStore() *TombstoneStore {
	return &TombstoneStore{store: make(map[string]*Entry)}
}

func (s *TombstoneStore) Put(key, value string) {
	s.store[key] = &Entry{Value: value, Deleted: false, Timestamp: time.Now().UnixMilli()}
}

func (s *TombstoneStore) Get(key string) (string, bool) {
	entry, ok := s.store[key]
	if !ok || entry.Deleted {
		return "", false
	}
	return entry.Value, true
}

func (s *TombstoneStore) Delete(key string) bool {
	entry, ok := s.store[key]
	if !ok || entry.Deleted {
		return false
	}
	entry.Deleted = true
	entry.Value = ""
	entry.Timestamp = time.Now().UnixMilli()
	s.tombstoneCount++
	return true
}

func (s *TombstoneStore) Compact(maxAgeMs int64) int {
	cutoff := time.Now().UnixMilli() - maxAgeMs
	removed := 0
	for key, entry := range s.store {
		if entry.Deleted && entry.Timestamp < cutoff {
			delete(s.store, key)
			removed++
			s.tombstoneCount--
		}
	}
	return removed
}

func (s *TombstoneStore) Size() int {
	count := 0
	for _, entry := range s.store {
		if !entry.Deleted {
			count++
		}
	}
	return count
}
```

```python [Python]
import time

class TombstoneStore:
    def __init__(self):
        self._store: dict[str, dict] = {}
        self._tombstone_count = 0

    def put(self, key: str, value: str) -> None:
        self._store[key] = {
            "value": value,
            "deleted": False,
            "timestamp": time.time() * 1000,
        }

    def get(self, key: str) -> str | None:
        entry = self._store.get(key)
        if entry is None or entry["deleted"]:
            return None
        return entry["value"]

    def delete(self, key: str) -> bool:
        entry = self._store.get(key)
        if entry is None or entry["deleted"]:
            return False
        entry["deleted"] = True
        entry["value"] = None
        entry["timestamp"] = time.time() * 1000
        self._tombstone_count += 1
        return True

    def compact(self, max_age_ms: float) -> int:
        cutoff = time.time() * 1000 - max_age_ms
        to_remove = [
            k for k, e in self._store.items()
            if e["deleted"] and e["timestamp"] < cutoff
        ]
        for k in to_remove:
            del self._store[k]
        self._tombstone_count -= len(to_remove)
        return len(to_remove)

    @property
    def size(self) -> int:
        return sum(1 for e in self._store.values() if not e["deleted"])

    @property
    def pending_tombstones(self) -> int:
        return self._tombstone_count
```

```rust [Rust]
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

struct Entry {
    value: Option<String>,
    deleted: bool,
    timestamp: u128,
}

pub struct TombstoneStore {
    store: HashMap<String, Entry>,
    tombstone_count: usize,
}

impl TombstoneStore {
    pub fn new() -> Self {
        TombstoneStore { store: HashMap::new(), tombstone_count: 0 }
    }

    fn now_ms() -> u128 {
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis()
    }

    pub fn put(&mut self, key: &str, value: &str) {
        self.store.insert(key.to_string(), Entry {
            value: Some(value.to_string()),
            deleted: false,
            timestamp: Self::now_ms(),
        });
    }

    pub fn get(&self, key: &str) -> Option<&str> {
        self.store.get(key)
            .filter(|e| !e.deleted)
            .and_then(|e| e.value.as_deref())
    }

    pub fn delete(&mut self, key: &str) -> bool {
        if let Some(entry) = self.store.get_mut(key) {
            if !entry.deleted {
                entry.deleted = true;
                entry.value = None;
                entry.timestamp = Self::now_ms();
                self.tombstone_count += 1;
                return true;
            }
        }
        false
    }

    pub fn compact(&mut self, max_age_ms: u128) -> usize {
        let cutoff = Self::now_ms().saturating_sub(max_age_ms);
        let to_remove: Vec<String> = self.store.iter()
            .filter(|(_, e)| e.deleted && e.timestamp < cutoff)
            .map(|(k, _)| k.clone())
            .collect();
        let count = to_remove.len();
        for key in to_remove {
            self.store.remove(&key);
        }
        self.tombstone_count -= count;
        count
    }

    pub fn size(&self) -> usize {
        self.store.values().filter(|e| !e.deleted).count()
    }
}
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带墓碑删除的键值存储 | `exercises/typescript/tombstone/01-basic.test.ts` |
| 进阶 | 添加基于时间的压缩和墓碑指标 | `exercises/typescript/tombstone/02-intermediate.test.ts` |

## 何时使用

- **LSM 树存储引擎** -- LevelDB、RocksDB、Cassandra 追加墓碑；压缩负责清理
- **分布式数据库** -- 墓碑在物理删除前将删除意图传播到所有副本
- **应用层软删除** -- 标记记录为已删除但保留审计记录；保留期后清除
- **不可变/仅追加日志** -- 无法修改现有条目，删除需要影子记录
- **并发数据结构** -- 标记节点已删除以避免并发读取期间不安全的指针操作

## 何时不用

- **可原地修改的存储** -- 如果可以直接删除条目（哈希表、可变数组），直接删除即可
- **内存受限系统** -- 墓碑在压缩前占用空间；空间紧张时立即删除更好
- **无后台处理** -- 压缩需要后台线程/进程；如不可用，墓碑会无限积累

## 更多生产案例

- [RocksDB](https://github.com/facebook/rocksdb) -- `kTypeDeletion` 和 `kTypeSingleDeletion` 墓碑，可配置压缩触发器
- [Apache HBase](https://github.com/apache/hbase) -- 删除标记在主压缩期间传播到所有存储文件
- [CockroachDB](https://github.com/cockroachdb/cockroach) -- 用于范围删除的 MVCC 墓碑，由后台任务 GC
- [Elasticsearch](https://github.com/elastic/elasticsearch) -- 软删除文档用 `_deleted` 标记，段合并时清除

## 挑战题

::: details Q1: A Cassandra cluster with gc_grace_seconds=10 days. Node C goes down for 15 days. What happens when C comes back online?
**Answer:** Node C may resurrect deleted data.

While C was down, other nodes deleted some keys and their tombstones expired (gc_grace_seconds=10 days). When C comes back, it still has the original data without tombstones. During anti-entropy repair, C's "live" data wins because there's no tombstone to contradict it. The deleted data reappears across the cluster.

Fix: Run `nodetool repair` before gc_grace_seconds expires, or increase gc_grace_seconds to exceed the maximum expected downtime.
:::

::: details Q2: Your LSM-tree database has a "tombstone accumulation" problem -- reads are getting slower. Why?
**Answer:** Tombstones must be checked during reads.

When you read a key, the database must scan from the newest SSTable to the oldest. If it finds a tombstone, it knows the key is deleted -- but it still had to read through all the levels to find it. Worse, range scans must check every tombstone in the range to filter deleted keys.

If compaction falls behind or the delete rate is high, tombstones pile up across levels. Solutions: trigger compaction more aggressively on tombstone-heavy SSTables, or use "single delete" (RocksDB) which cancels exactly one put, avoiding tombstone persistence.
:::

::: details Q3: Why can't you just immediately delete the tombstone after all replicas acknowledge the deletion?
**Answer:** Because of read-repair and anti-entropy.

Even if all currently-live replicas acknowledge the deletion, a temporarily-offline replica might still hold the original data. When it comes back, it would re-introduce the data. The tombstone must persist long enough to "win" conflict resolution against stale data from any replica that was down.

This is why Cassandra uses `gc_grace_seconds` -- it's the maximum expected time for a node to be offline. The tombstone lives at least that long to guarantee it outlives any stale replica.
:::
