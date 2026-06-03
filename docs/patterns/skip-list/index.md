# Pattern: Skip List

## One Liner

A probabilistic sorted data structure with O(log n) search, insert, and delete — simpler to implement than balanced trees with comparable performance.

## Core Idea

A skip list is a multi-level linked list where each level skips over more elements. The bottom level is a regular sorted linked list. Higher levels act as "express lanes" that allow binary-search-like behavior. Each node is randomly promoted to higher levels with probability p (typically 0.5).

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

| Property | Value |
|----------|-------|
| Search | O(log n) average |
| Insert | O(log n) average |
| Delete | O(log n) average |
| Space | O(n) expected |
| Advantage | Simpler than red-black/AVL trees, lock-free variants possible |

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| Redis | [t_zset.c#L70-L130](https://github.com/redis/redis/blob/unstable/src/t_zset.c#L70-L130) | `zskiplist` / `zskiplistNode` — Redis sorted sets use a skip list (not a balanced tree) for O(log n) range queries. `zslInsert` creates nodes with random levels. Chosen by Antirez for its simplicity and cache-friendliness. |
| LevelDB | [skiplist.h#L40-L90](https://github.com/google/leveldb/blob/main/db/skiplist.h#L40-L90) | `SkipList` class template — used as the in-memory sorted structure (MemTable) for LevelDB. `Insert` and `Contains` with compare-and-swap for concurrent reads. Foundation of LSM-tree architecture. |

## Implementation

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

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a skip list with insert/search/delete | `exercises/typescript/skip-list/01-basic.test.ts` |

Run exercises: `pnpm test`

## When to Use

- **In-memory sorted storage** — when you need sorted iteration + fast point lookups (Redis sorted sets)
- **Concurrent data structures** — lock-free skip lists are simpler than lock-free balanced trees
- **Database memtables** — in-memory write buffer before flushing to disk (LevelDB, RocksDB)
- **Range queries** — efficient range scans on sorted data

## When NOT to Use

- **Pure key-value lookup** — hash maps are O(1) average vs skip list's O(log n)
- **Deterministic performance needed** — skip list has probabilistic guarantees, not worst-case
- **Memory-constrained** — forward pointer arrays use more memory than a balanced tree
- **Persistent storage** — B-trees are better optimized for disk I/O patterns

## More Production Uses

- [RocksDB](https://github.com/facebook/rocksdb/blob/main/memtable/inlineskiplist.h) — `InlineSkipList` for concurrent MemTable
- [CockroachDB](https://github.com/cockroachdb/cockroach) — skip list-based memtable for Pebble storage engine
- [Java ConcurrentSkipListMap](https://github.com/openjdk/jdk) — lock-free sorted map in JDK
- [FoundationDB](https://github.com/apple/foundationdb) — skip list for in-memory sorted data

## Challenge Questions

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
