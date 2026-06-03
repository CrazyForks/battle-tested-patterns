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
  ┌──────────┐                   ┌───────────┐
  │ Log/SST  │                   │  Lookup   │
  ├──────────┤                   ├───────────┤
  │ A = "v1" │                   │ Found:    │
  │ B = tomb │ ◄── tombstone     │ B = tomb  │──► return NOT FOUND
  │ C = "v3" │                   │           │
  └──────────┘                   └───────────┘

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

**动手试试** — 写入条目，用墓碑标记删除，然后压缩回收空间：

<TombstoneViz />

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

::: details Q1: 一个 Cassandra 集群设置 gc_grace_seconds=10 天。节点 C 宕机了 15 天。当 C 恢复上线时会发生什么？
**答案：** 节点 C 可能会复活已删除的数据。

在 C 宕机期间，其他节点删除了一些键，它们的墓碑已过期（gc_grace_seconds=10 天）。当 C 恢复时，它仍然拥有没有墓碑的原始数据。在反熵修复期间，C 的"活"数据获胜，因为没有墓碑来否定它。已删除的数据在整个集群中重新出现。

修复：在 gc_grace_seconds 过期前运行 `nodetool repair`，或者增加 gc_grace_seconds 使其超过预期的最大宕机时间。
:::

::: details Q2: 你的 LSM-tree 数据库有"墓碑累积"问题——读取变得越来越慢。为什么？
**答案：** 读取时必须检查墓碑。

当你读取一个键时，数据库必须从最新的 SSTable 扫描到最旧的。如果找到墓碑，它知道键已被删除——但它仍然需要读取所有层级才能找到它。更糟糕的是，范围扫描必须检查范围内的每个墓碑以过滤已删除的键。

如果压缩落后或删除率很高，墓碑会在各层级堆积。解决方案：对墓碑较多的 SSTable 更积极地触发压缩，或使用 "single delete"（RocksDB），它精确取消一次 put，避免墓碑持久化。
:::

::: details Q3: 为什么不能在所有副本确认删除后立即删除墓碑？
**答案：** 因为读修复和反熵。

即使所有当前在线的副本都确认了删除，一个临时离线的副本可能仍然持有原始数据。当它恢复时，它会重新引入数据。墓碑必须持续足够长的时间，以在冲突解决中"赢过"来自任何宕机副本的过期数据。

这就是 Cassandra 使用 `gc_grace_seconds` 的原因——它是节点离线的最大预期时间。墓碑至少存活这么长时间，以保证它比任何过期副本存活更久。
:::
