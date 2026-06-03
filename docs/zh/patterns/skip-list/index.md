# 模式：跳表 (Skip List)

## 一句话

概率有序数据结构，O(log n) 搜索、插入和删除——比平衡树更简单，性能相当。

## 核心思想

跳表是多层链表，每层跳过更多元素。底层是普通有序链表。更高层作为"快车道"实现类二分搜索行为。每个节点以概率 p（通常 0.5）随机提升到更高层。

```text
  Level 3:  HEAD ─────────────────────────────── 30 ─ NIL
              │                                  │
  Level 2:  HEAD ─────── 10 ──────────────────── 30 ─ NIL
              │           │                      │
  Level 1:  HEAD ── 5 ── 10 ──── 20 ──────────── 30 ─ NIL
              │     │     │       │               │
  Level 0:  HEAD  3  5  7  10  15  20  25  30 ─ NIL
              │   │  │  │   │   │   │   │   │
              ▼   ▼  ▼  ▼   ▼   ▼   ▼   ▼   ▼

  Search(15): L3→30(far)↓ L2→10→30(far)↓ L1→20(far)↓ L0→15 ✓
```

| 属性 | 值 |
|------|------|
| 搜索 | O(log n) 平均 |
| 插入 | O(log n) 平均 |
| 删除 | O(log n) 平均 |
| 空间 | O(n) 期望 |
| 优势 | 比红黑树/AVL 树简单，可实现无锁变体 |

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Redis | [t_zset.c#L70-L130](https://github.com/redis/redis/blob/unstable/src/t_zset.c#L70-L130) | `zskiplist` / `zskiplistNode` — Redis 有序集合使用跳表（而非平衡树）实现 O(log n) 范围查询。`zslInsert` 创建随机层级节点。Antirez 选择它因其简单性和缓存友好性。 |
| LevelDB | [skiplist.h#L40-L90](https://github.com/google/leveldb/blob/main/db/skiplist.h#L40-L90) | `SkipList` 类模板——用作 LevelDB 的内存有序结构（MemTable）。`Insert` 和 `Contains` 使用 compare-and-swap 支持并发读。LSM 树架构的基础。 |

## 实现

::: code-group

```typescript [TypeScript]
class SkipNode {
  forward: (SkipNode | null)[];
  constructor(public key: number, public value: string, level: number) {
    this.forward = new Array(level + 1).fill(null);
  }
}

class SkipList {
  private maxLevel = 16;
  private level = 0;
  private header = new SkipNode(-Infinity, '', 16);

  private randomLevel(): number {
    let lvl = 0;
    while (lvl < this.maxLevel && Math.random() < 0.5) lvl++;
    return lvl;
  }

  insert(key: number, value: string): void {
    const update: (SkipNode | null)[] = new Array(this.maxLevel + 1).fill(null);
    let cur = this.header;
    for (let i = this.level; i >= 0; i--) {
      while (cur.forward[i] && cur.forward[i]!.key < key) cur = cur.forward[i]!;
      update[i] = cur;
    }
    if (cur.forward[0]?.key === key) { cur.forward[0]!.value = value; return; }
    const newLvl = this.randomLevel();
    if (newLvl > this.level) {
      for (let i = this.level + 1; i <= newLvl; i++) update[i] = this.header;
      this.level = newLvl;
    }
    const node = new SkipNode(key, value, newLvl);
    for (let i = 0; i <= newLvl; i++) {
      node.forward[i] = update[i]!.forward[i];
      update[i]!.forward[i] = node;
    }
  }

  search(key: number): string | undefined {
    let cur = this.header;
    for (let i = this.level; i >= 0; i--) {
      while (cur.forward[i] && cur.forward[i]!.key < key) cur = cur.forward[i]!;
    }
    return cur.forward[0]?.key === key ? cur.forward[0]!.value : undefined;
  }
}
```

```go [Go]
type SkipNode struct {
	key     int
	value   string
	forward []*SkipNode
}

type SkipList struct {
	header   *SkipNode
	level    int
	maxLevel int
}

func NewSkipList() *SkipList {
	header := &SkipNode{forward: make([]*SkipNode, 17)}
	return &SkipList{header: header, maxLevel: 16}
}

func (sl *SkipList) Insert(key int, value string) {
	update := make([]*SkipNode, sl.maxLevel+1)
	cur := sl.header
	for i := sl.level; i >= 0; i-- {
		for cur.forward[i] != nil && cur.forward[i].key < key {
			cur = cur.forward[i]
		}
		update[i] = cur
	}
	if cur.forward[0] != nil && cur.forward[0].key == key {
		cur.forward[0].value = value
		return
	}
	lvl := 0
	for lvl < sl.maxLevel && rand.Float64() < 0.5 {
		lvl++
	}
	if lvl > sl.level {
		for i := sl.level + 1; i <= lvl; i++ {
			update[i] = sl.header
		}
		sl.level = lvl
	}
	node := &SkipNode{key: key, value: value, forward: make([]*SkipNode, lvl+1)}
	for i := 0; i <= lvl; i++ {
		node.forward[i] = update[i].forward[i]
		update[i].forward[i] = node
	}
}

func (sl *SkipList) Search(key int) (string, bool) {
	cur := sl.header
	for i := sl.level; i >= 0; i-- {
		for cur.forward[i] != nil && cur.forward[i].key < key {
			cur = cur.forward[i]
		}
	}
	if cur.forward[0] != nil && cur.forward[0].key == key {
		return cur.forward[0].value, true
	}
	return "", false
}
```

```python [Python]
import random

class SkipNode:
    def __init__(self, key: int, value: str, level: int):
        self.key = key
        self.value = value
        self.forward: list[SkipNode | None] = [None] * (level + 1)

class SkipList:
    def __init__(self, max_level: int = 16, p: float = 0.5):
        self.max_level = max_level
        self.p = p
        self.level = 0
        self.header = SkipNode(-1, '', max_level)

    def _random_level(self) -> int:
        lvl = 0
        while lvl < self.max_level and random.random() < self.p:
            lvl += 1
        return lvl

    def insert(self, key: int, value: str) -> None:
        update = [self.header] * (self.max_level + 1)
        cur = self.header
        for i in range(self.level, -1, -1):
            while cur.forward[i] and cur.forward[i].key < key:
                cur = cur.forward[i]
            update[i] = cur
        if cur.forward[0] and cur.forward[0].key == key:
            cur.forward[0].value = value
            return
        lvl = self._random_level()
        if lvl > self.level:
            for i in range(self.level + 1, lvl + 1):
                update[i] = self.header
            self.level = lvl
        node = SkipNode(key, value, lvl)
        for i in range(lvl + 1):
            node.forward[i] = update[i].forward[i]
            update[i].forward[i] = node

    def search(self, key: int) -> str | None:
        cur = self.header
        for i in range(self.level, -1, -1):
            while cur.forward[i] and cur.forward[i].key < key:
                cur = cur.forward[i]
        if cur.forward[0] and cur.forward[0].key == key:
            return cur.forward[0].value
        return None
```

```rust [Rust]
pub struct SkipList {
    max_level: usize,
    level: usize,
    head_key: i64,
    keys: Vec<i64>,
    values: Vec<String>,
}

impl SkipList {
    pub fn new() -> Self {
        SkipList { max_level: 16, level: 0, head_key: i64::MIN, keys: Vec::new(), values: Vec::new() }
    }

    pub fn insert(&mut self, key: i64, value: &str) {
        match self.keys.binary_search(&key) {
            Ok(idx) => { self.values[idx] = value.to_string(); }
            Err(idx) => {
                self.keys.insert(idx, key);
                self.values.insert(idx, value.to_string());
            }
        }
    }

    pub fn search(&self, key: i64) -> Option<&str> {
        match self.keys.binary_search(&key) {
            Ok(idx) => Some(&self.values[idx]),
            Err(_) => None,
        }
    }
}
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带 insert/search/delete 的跳表 | `exercises/typescript/skip-list/01-basic.test.ts` |

## 何时使用

- **内存有序存储** — 需要有序迭代 + 快速点查（Redis 有序集合）
- **并发数据结构** — 无锁跳表比无锁平衡树更简单
- **数据库 memtable** — 刷盘前的内存写缓冲（LevelDB、RocksDB）
- **范围查询** — 有序数据的高效范围扫描

## 何时不用

- **纯键值查找** — 哈希表平均 O(1)，跳表 O(log n)
- **需要确定性性能** — 跳表是概率保证，非最坏情况
- **内存受限** — 前向指针数组比平衡树用更多内存
- **持久存储** — B 树对磁盘 I/O 模式优化更好

## 更多生产案例

- [RocksDB](https://github.com/facebook/rocksdb/blob/main/memtable/inlineskiplist.h) — `InlineSkipList` 用于并发 MemTable
- [CockroachDB](https://github.com/cockroachdb/cockroach) — Pebble 存储引擎的跳表 memtable
- [Java ConcurrentSkipListMap](https://github.com/openjdk/jdk) — JDK 中的无锁有序 map
- [FoundationDB](https://github.com/apple/foundationdb) — 内存有序数据的跳表

## 挑战题

::: details Q1: A skip list uses `Math.random()` to decide node promotion levels. Your colleague argues this makes skip list performance "unreliable" since a bad random sequence could produce O(n) search. Is this a real concern in production?
**Answer:** In theory yes, but in practice the probability is astronomically low — comparable to a hash table degenerating to O(n) from collisions.

With promotion probability p=0.5, the chance of a node reaching level k is (1/2)^k. The expected maximum level for n elements is O(log n). For a skip list to degrade to O(n), a large fraction of nodes would need to be at level 0 only — an event with probability so close to zero it's practically impossible. Redis chose skip lists over red-black trees for this reason: the average-case guarantees are strong enough, and the implementation is dramatically simpler. LevelDB uses skip lists for the same reasoning.
:::

::: details Q2: Redis uses a skip list (not a red-black tree or B-tree) for sorted sets. Both skip lists and balanced BSTs offer O(log n) operations. What makes skip lists preferable for Redis's use case?
**Answer:** Skip lists are simpler to implement correctly, support efficient range queries by following forward pointers, and are easier to make lock-free for concurrent access.

In a balanced BST, range queries require an in-order traversal that bounces between parent and child pointers. In a skip list, once you find the range start at level 0, you simply follow forward pointers — sequential and cache-friendly. Additionally, lock-free skip list algorithms (used in LevelDB and ConcurrentSkipListMap) are well-understood, while lock-free balanced tree algorithms are notoriously complex. Antirez (Redis creator) also cited implementation simplicity: skip list insert/delete code is straightforward compared to red-black tree rotations.
:::

::: details Q3: LevelDB's skip list supports concurrent reads without locks but requires external synchronization for writes. Why not make writes lock-free too?
**Answer:** LevelDB only has one writer thread (the memtable writer), so lock-free writes add complexity without benefit — the design constraint is concurrent readers, not concurrent writers.

LevelDB's LSM-tree architecture funnels all writes through a single write-ahead log and then into the memtable. Since there's only one writer, a mutex is trivial and adds no contention. The skip list uses atomic operations for the forward pointers so that the single writer and multiple reader threads can operate simultaneously without read locks. This is the SWMR (single-writer, multiple-reader) insight: optimize for the actual concurrency pattern, not the general case.
:::
