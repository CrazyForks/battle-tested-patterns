---
description: "概率有序数据结构，O(log n) 搜索、插入和删除——比平衡树更简单，性能相当。"
difficulty: "advanced"
---

# 模式：跳表 (Skip List)

<DifficultyBadge />

## 一句话

概率有序数据结构，O(log n) 搜索、插入和删除——比平衡树更简单，性能相当。

<DemoBadge />

## 现实类比

快慢车线路系统。快线跳过大部分站点，让你快速前进。到了目的地附近，换乘慢线精确停靠。多层快线加速了长距离搜索。

## 核心思想

跳表是多层链表，每层跳过更多元素。底层是普通有序链表。更高层作为"快车道"实现类二分搜索行为。每个节点以概率 p（通常 0.5）随机提升到更高层。

```text
  Level 3:  HEAD ─────────────────────────────── 30 ─ NIL
              │                                  │
  Level 2:  HEAD ─────── 10 ──────────────────── 30 ─ NIL
              │           │                      │
  Level 1:  HEAD ── 5 ── 10 ──── 20 ──────────── 30 ─ NIL
              │     │     │       │              │
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

**动手试试** — 插入值并搜索，观察"快车道"如何加速遍历：

<SkipListViz />

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

```rust [Rust]
const MAX_LEVEL: usize = 4;

struct SkipNode {
    key: i64,
    value: String,
    forward: Vec<Option<usize>>,
}

pub struct SkipList {
    nodes: Vec<SkipNode>,
    head: usize,
    level: usize,
    seed: u64,
}

impl SkipList {
    pub fn new() -> Self {
        let head = SkipNode { key: i64::MIN, value: String::new(), forward: vec![None; MAX_LEVEL] };
        SkipList { nodes: vec![head], head: 0, level: 0, seed: 42 }
    }

    fn random_level(&mut self) -> usize {
        let mut lvl = 0;
        while lvl < MAX_LEVEL - 1 {
            self.seed ^= self.seed << 13;
            self.seed ^= self.seed >> 7;
            self.seed ^= self.seed << 17;
            if self.seed % 2 == 0 { lvl += 1; } else { break; }
        }
        lvl
    }

    pub fn insert(&mut self, key: i64, value: &str) {
        let mut update = [0usize; MAX_LEVEL];
        let mut cur = self.head;
        for i in (0..=self.level).rev() {
            while let Some(nx) = self.nodes[cur].forward[i] {
                if self.nodes[nx].key < key { cur = nx; } else { break; }
            }
            update[i] = cur;
        }
        if let Some(nx) = self.nodes[cur].forward[0] {
            if self.nodes[nx].key == key {
                self.nodes[nx].value = value.to_string();
                return;
            }
        }
        let lvl = self.random_level();
        if lvl > self.level {
            for i in (self.level + 1)..=lvl { update[i] = self.head; }
            self.level = lvl;
        }
        let idx = self.nodes.len();
        self.nodes.push(SkipNode { key, value: value.to_string(), forward: vec![None; lvl + 1] });
        for i in 0..=lvl {
            self.nodes[idx].forward[i] = self.nodes[update[i]].forward[i];
            self.nodes[update[i]].forward[i] = Some(idx);
        }
    }

    pub fn search(&self, key: i64) -> Option<&str> {
        let mut cur = self.head;
        for i in (0..=self.level).rev() {
            while let Some(nx) = self.nodes[cur].forward[i] {
                if self.nodes[nx].key < key { cur = nx; } else { break; }
            }
        }
        if let Some(nx) = self.nodes[cur].forward[0] {
            if self.nodes[nx].key == key { return Some(&self.nodes[nx].value); }
        }
        None
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

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带 insert/search/delete 的跳表 | `exercises/typescript/skip-list/01-basic.test.ts` |
| 进阶 | 带范围查询的跳表 | `exercises/typescript/skip-list/02-intermediate.test.ts` |

运行练习：`pnpm test`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

练习文件： Rust `exercises/rust/src/skip_list.rs` · Go `exercises/go/skip_list_test.go` · Python `exercises/python/test_skip_list.py`

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

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [LSM 树 (Log-Structured Merge Tree)](/zh/patterns/lsm-tree/) | LSM 树使用跳表作为内存中的有序缓冲区（memtable） |
| [B+ 树 (B+ Tree)](/zh/patterns/b-plus-tree/) | B+ 树保证 O(log n)；跳表以更简单的代码概率性地实现 |
| [布隆过滤器 (Bloom Filter)](/zh/patterns/bloom-filter/) | 两者都是概率性的——布隆过滤器用于成员判定，跳表用于排序 |
| [空闲链表 (Free List)](/zh/patterns/free-list/) | 跳表节点需要分配管理；空闲链表为固定大小节点提供 O(1) 分配 |
| [合并迭代器 (Merge Iterator)](/zh/patterns/merge-iterator/) | 合并迭代器组合来自多个跳表层级或实例的有序输出 |
| [Trie 前缀树](/zh/patterns/trie/) | 两者都提供有序键遍历——跳表通过概率平衡，前缀树通过前缀结构 |

## 挑战题

::: details Q1: 跳表使用 `Math.random()` 来决定节点的提升层级。你的同事认为这使得跳表性能"不可靠"，因为糟糕的随机序列可能导致 O(n) 搜索。这在生产中是真正的顾虑吗？
**答案：** 理论上是的，但实际中这个概率极低——相当于哈希表因碰撞退化到 O(n) 的概率。

提升概率 p=0.5 时，节点达到第 k 层的概率是 (1/2)^k。n 个元素的期望最大层级是 O(log n)。跳表退化到 O(n) 需要大部分节点都只在第 0 层——这个事件的概率接近零，实际上不可能发生。Redis 选择跳表而非红黑树正是因为这个原因：平均情况的保证足够强，且实现大大简化。LevelDB 出于同样的原因使用跳表。
:::

::: details Q2: Redis 对有序集合使用跳表（而非红黑树或 B 树）。跳表和平衡 BST 都提供 O(log n) 操作。是什么使跳表更适合 Redis 的用例？
**答案：** 跳表实现起来更简单且正确，通过跟随前向指针支持高效范围查询，且更容易实现无锁并发访问。

在平衡 BST 中，范围查询需要在父节点和子节点指针之间来回跳转的中序遍历。在跳表中，一旦在第 0 层找到范围起点，你只需跟随前向指针——顺序且缓存友好。此外，无锁跳表算法（用于 LevelDB 和 ConcurrentSkipListMap）已被充分理解，而无锁平衡树算法则出了名的复杂。Antirez（Redis 创造者）也指出了实现的简洁性：跳表的插入/删除代码比红黑树的旋转要直观得多。
:::

::: details Q3: LevelDB 的跳表支持无锁并发读取但写入需要外部同步。为什么不把写入也做成无锁的？
**答案：** LevelDB 只有一个写入线程（memtable 写入者），所以无锁写入增加了复杂性但没有收益——设计约束是并发读取者，而非并发写入者。

LevelDB 的 LSM-tree 架构将所有写入汇集到单个 write-ahead log 然后进入 memtable。由于只有一个写入者，mutex 是简单的且不会产生竞争。跳表对前向指针使用原子操作，使得单个写入者和多个读取线程可以同时操作而无需读锁。这就是 SWMR（单写者多读者）洞察：为实际的并发模式优化，而非为一般情况优化。
:::

::: details Q4: 你正在用跳表实现一个排行榜，需要按分数取前 100 名玩家。朴素做法是从第 0 层头部开始遍历。你的同事说"维护一个尾指针来反向遍历就行了"。为什么这不像双向链表那样简单？
**答案：** 跳表本质上是仅向前的结构。在每一层添加后向指针会使指针数翻倍并使插入/删除复杂化，抵消了相比平衡树的简洁性优势。

在双向链表中，维护尾指针并反向遍历很简单。但在跳表中，你需要在每一层都添加后向指针才能实现 O(log n) 的反向遍历——否则你只能退回到第 0 层的 O(n) 遍历。这实质上把跳表变成了双向跳表，复杂度大幅增加。"Top-K"查询的实用方案是存储取反的分数（或使用反序比较器），让最高分排在最前，然后从头部正向遍历。Redis 的有序集合就采用了这种方式——`ZREVRANGE` 在仅第 0 层支持双向遍历的跳表上沿正向指针行走。
:::
