# 模式：B+ 树 (B+ Tree)

## 一句话

自平衡多路树，高扇出——内部节点负责路由，叶节点存储数据，所有叶节点通过链表相连以支持高效范围扫描。

## 核心思想

B+ 树将路由与存储分离。内部节点仅保存键和子节点指针，用于引导搜索方向。叶节点保存实际的键值对，并通过链表相连，实现高效的顺序扫描。高扇出（每个节点数百个键）使树非常扁平——十亿条记录通常只需 3-4 层——最大限度减少磁盘 I/O。

```text
                    ┌──────────────┐
                    │   [30 | 60]  │          Internal (keys only)
                    └──┬─────┬──┬─┘
                       │     │  │
          ┌────────────┘     │  └────────────┐
          ▼                  ▼               ▼
     ┌─────────┐      ┌──────────┐     ┌─────────┐
     │[10 | 20]│      │[40 | 50] │     │[70 | 80]│   Internal
     └─┬──┬──┬─┘      └─┬──┬──┬─┘     └─┬──┬──┬─┘
       │  │  │           │  │  │         │  │  │
       ▼  ▼  ▼           ▼  ▼  ▼         ▼  ▼  ▼
     ┌───┬───┬───┬───┬───┬───┬───┬───┬───┐
     │1-9│10-│20-│30-│40-│50-│60-│70-│80-│  Leaf nodes
     │   │ 19│ 29│ 39│ 49│ 59│ 69│ 79│ 99│  (data here)
     └─►─┴─►─┴─►─┴─►─┴─►─┴─►─┴─►─┴─►─┴───┘
       Linked list for range scans ──────►
```

| 属性 | 值 |
|------|------|
| 查找 | O(log_B n) -- B = 扇出因子 |
| 插入 | O(log_B n) -- 可能触发节点分裂 |
| 范围扫描 | O(log_B n + k) -- k = 结果数量 |
| 空间 | O(n) |
| 扇出 | 通常每个节点 100-1000 个键 |

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| PostgreSQL | [nbtinsert.c#L22-L55](https://github.com/postgres/postgres/blob/master/src/backend/access/nbtree/nbtinsert.c#L22-L55) | B-link 树（Lehman-Yao 的 B+ 树变体）。`_bt_doinsert` 通过兄弟节点间的右链接管理并发插入。内部页存储键 + 子指针；叶页存储堆 TID，并通过 `_bt_readnextpage` 串联以支持索引扫描。 |
| SQLite | [btree.c#L1-L60](https://github.com/sqlite/sqlite/blob/master/src/btree.c#L1-L60) | 所有表和索引都由磁盘页上的 B+ 树支撑。内部单元持有键 + 子页号；叶单元存储完整数据。`sqlite3BtreeInsert` 在节点溢出时处理插入与页分裂。 |

## 实现

::: code-group

```typescript [TypeScript]
class BPlusLeaf<K, V> {
  keys: K[] = [];
  values: V[] = [];
  next: BPlusLeaf<K, V> | null = null;
}

class BPlusInternal<K> {
  keys: K[] = [];
  children: (BPlusInternal<K> | BPlusLeaf<K, any>)[] = [];
}

type BPlusNode<K, V> = BPlusInternal<K> | BPlusLeaf<K, V>;

class BPlusTree<V> {
  private root: BPlusNode<number, V>;

  constructor(private order: number) {
    this.root = new BPlusLeaf<number, V>();
  }

  search(key: number): V | undefined {
    let node = this.root;
    while (node instanceof BPlusInternal) {
      let i = 0;
      while (i < node.keys.length && key >= node.keys[i]) i++;
      node = node.children[i];
    }
    const leaf = node as BPlusLeaf<number, V>;
    const idx = leaf.keys.indexOf(key);
    return idx >= 0 ? leaf.values[idx] : undefined;
  }

  insert(key: number, value: V): void {
    const result = this.insertNode(this.root, key, value);
    if (result) {
      const newRoot = new BPlusInternal<number>();
      newRoot.keys = [result.key];
      newRoot.children = [this.root, result.node];
      this.root = newRoot;
    }
  }

  rangeQuery(start: number, end: number): V[] {
    let node = this.root;
    while (node instanceof BPlusInternal) {
      let i = 0;
      while (i < node.keys.length && start >= node.keys[i]) i++;
      node = node.children[i];
    }
    const results: V[] = [];
    let leaf: BPlusLeaf<number, V> | null = node as BPlusLeaf<number, V>;
    while (leaf) {
      for (let i = 0; i < leaf.keys.length; i++) {
        if (leaf.keys[i] > end) return results;
        if (leaf.keys[i] >= start) results.push(leaf.values[i]);
      }
      leaf = leaf.next;
    }
    return results;
  }

  private insertNode(
    node: BPlusNode<number, V>,
    key: number,
    value: V,
  ): { key: number; node: BPlusNode<number, V> } | null {
    if (node instanceof BPlusLeaf) {
      let i = 0;
      while (i < node.keys.length && node.keys[i] < key) i++;
      if (i < node.keys.length && node.keys[i] === key) {
        node.values[i] = value;
        return null;
      }
      node.keys.splice(i, 0, key);
      node.values.splice(i, 0, value);
      if (node.keys.length >= this.order) {
        return this.splitLeaf(node);
      }
      return null;
    }
    const internal = node as BPlusInternal<number>;
    let i = 0;
    while (i < internal.keys.length && key >= internal.keys[i]) i++;
    const result = this.insertNode(internal.children[i], key, value);
    if (!result) return null;
    internal.keys.splice(i, 0, result.key);
    internal.children.splice(i + 1, 0, result.node);
    if (internal.keys.length >= this.order) {
      return this.splitInternal(internal);
    }
    return null;
  }

  private splitLeaf(leaf: BPlusLeaf<number, V>) {
    const mid = Math.ceil(leaf.keys.length / 2);
    const newLeaf = new BPlusLeaf<number, V>();
    newLeaf.keys = leaf.keys.splice(mid);
    newLeaf.values = leaf.values.splice(mid);
    newLeaf.next = leaf.next;
    leaf.next = newLeaf;
    return { key: newLeaf.keys[0], node: newLeaf as BPlusNode<number, V> };
  }

  private splitInternal(node: BPlusInternal<number>) {
    const mid = Math.floor(node.keys.length / 2);
    const promoteKey = node.keys[mid];
    const newNode = new BPlusInternal<number>();
    newNode.keys = node.keys.splice(mid + 1);
    newNode.children = node.children.splice(mid + 1);
    node.keys.pop();
    return { key: promoteKey, node: newNode as BPlusNode<number, any> };
  }
}
```

```go [Go]
type BPlusTree struct {
	order int
	root  bpNode
}

type bpNode interface {
	isLeaf() bool
}

type bpLeaf struct {
	keys   []int
	values []string
	next   *bpLeaf
}

type bpInternal struct {
	keys     []int
	children []bpNode
}

func (l *bpLeaf) isLeaf() bool     { return true }
func (n *bpInternal) isLeaf() bool  { return false }

func NewBPlusTree(order int) *BPlusTree {
	return &BPlusTree{order: order, root: &bpLeaf{}}
}

func (t *BPlusTree) Search(key int) (string, bool) {
	node := t.root
	for !node.isLeaf() {
		internal := node.(*bpInternal)
		i := 0
		for i < len(internal.keys) && key >= internal.keys[i] {
			i++
		}
		node = internal.children[i]
	}
	leaf := node.(*bpLeaf)
	for i, k := range leaf.keys {
		if k == key {
			return leaf.values[i], true
		}
	}
	return "", false
}

func (t *BPlusTree) RangeQuery(start, end int) []string {
	node := t.root
	for !node.isLeaf() {
		internal := node.(*bpInternal)
		i := 0
		for i < len(internal.keys) && start >= internal.keys[i] {
			i++
		}
		node = internal.children[i]
	}
	var results []string
	leaf := node.(*bpLeaf)
	for leaf != nil {
		for i, k := range leaf.keys {
			if k > end {
				return results
			}
			if k >= start {
				results = append(results, leaf.values[i])
			}
		}
		leaf = leaf.next
	}
	return results
}
```

```python [Python]
class BPlusLeaf:
    def __init__(self):
        self.keys: list[int] = []
        self.values: list[str] = []
        self.next: "BPlusLeaf | None" = None

class BPlusInternal:
    def __init__(self):
        self.keys: list[int] = []
        self.children: list = []

class BPlusTree:
    def __init__(self, order: int):
        self.order = order
        self.root: BPlusLeaf | BPlusInternal = BPlusLeaf()

    def search(self, key: int) -> str | None:
        node = self.root
        while isinstance(node, BPlusInternal):
            i = 0
            while i < len(node.keys) and key >= node.keys[i]:
                i += 1
            node = node.children[i]
        leaf: BPlusLeaf = node
        for i, k in enumerate(leaf.keys):
            if k == key:
                return leaf.values[i]
        return None

    def insert(self, key: int, value: str) -> None:
        result = self._insert(self.root, key, value)
        if result:
            new_root = BPlusInternal()
            new_root.keys = [result[0]]
            new_root.children = [self.root, result[1]]
            self.root = new_root

    def _insert(self, node, key, value):
        if isinstance(node, BPlusLeaf):
            i = 0
            while i < len(node.keys) and node.keys[i] < key:
                i += 1
            if i < len(node.keys) and node.keys[i] == key:
                node.values[i] = value
                return None
            node.keys.insert(i, key)
            node.values.insert(i, value)
            if len(node.keys) >= self.order:
                return self._split_leaf(node)
            return None

        internal: BPlusInternal = node
        i = 0
        while i < len(internal.keys) and key >= internal.keys[i]:
            i += 1
        result = self._insert(internal.children[i], key, value)
        if result is None:
            return None
        internal.keys.insert(i, result[0])
        internal.children.insert(i + 1, result[1])
        if len(internal.keys) >= self.order:
            return self._split_internal(internal)
        return None

    def _split_leaf(self, leaf: BPlusLeaf):
        mid = len(leaf.keys) // 2
        new_leaf = BPlusLeaf()
        new_leaf.keys = leaf.keys[mid:]
        new_leaf.values = leaf.values[mid:]
        leaf.keys = leaf.keys[:mid]
        leaf.values = leaf.values[:mid]
        new_leaf.next = leaf.next
        leaf.next = new_leaf
        return (new_leaf.keys[0], new_leaf)

    def _split_internal(self, node: BPlusInternal):
        mid = len(node.keys) // 2
        promote_key = node.keys[mid]
        new_node = BPlusInternal()
        new_node.keys = node.keys[mid + 1:]
        new_node.children = node.children[mid + 1:]
        node.keys = node.keys[:mid]
        node.children = node.children[:mid + 1]
        return (promote_key, new_node)

    def range_query(self, start: int, end: int) -> list[str]:
        node = self.root
        while isinstance(node, BPlusInternal):
            i = 0
            while i < len(node.keys) and start >= node.keys[i]:
                i += 1
            node = node.children[i]
        results: list[str] = []
        leaf: BPlusLeaf | None = node
        while leaf is not None:
            for i, k in enumerate(leaf.keys):
                if k > end:
                    return results
                if k >= start:
                    results.append(leaf.values[i])
            leaf = leaf.next
        return results
```

```rust [Rust]
pub struct BPlusTree {
    order: usize,
    root: BPlusNode,
}

enum BPlusNode {
    Leaf(LeafNode),
    Internal(InternalNode),
}

struct LeafNode {
    keys: Vec<i64>,
    values: Vec<String>,
}

struct InternalNode {
    keys: Vec<i64>,
    children: Vec<BPlusNode>,
}

impl BPlusTree {
    pub fn new(order: usize) -> Self {
        BPlusTree {
            order,
            root: BPlusNode::Leaf(LeafNode { keys: vec![], values: vec![] }),
        }
    }

    pub fn search(&self, key: i64) -> Option<&str> {
        let mut node = &self.root;
        loop {
            match node {
                BPlusNode::Internal(n) => {
                    let mut i = 0;
                    while i < n.keys.len() && key >= n.keys[i] { i += 1; }
                    node = &n.children[i];
                }
                BPlusNode::Leaf(leaf) => {
                    for (i, &k) in leaf.keys.iter().enumerate() {
                        if k == key { return Some(&leaf.values[i]); }
                    }
                    return None;
                }
            }
        }
    }

    pub fn insert(&mut self, key: i64, value: String) {
        let order = self.order;
        let root = std::mem::replace(
            &mut self.root,
            BPlusNode::Leaf(LeafNode { keys: vec![], values: vec![] }),
        );
        let (new_root, split) = Self::insert_node(root, key, value, order);
        if let Some((promote_key, right)) = split {
            let left = new_root;
            self.root = BPlusNode::Internal(InternalNode {
                keys: vec![promote_key],
                children: vec![left, right],
            });
        } else {
            self.root = new_root;
        }
    }

    fn insert_node(
        node: BPlusNode, key: i64, value: String, order: usize,
    ) -> (BPlusNode, Option<(i64, BPlusNode)>) {
        match node {
            BPlusNode::Leaf(mut leaf) => {
                let pos = leaf.keys.iter().position(|&k| k >= key);
                match pos {
                    Some(i) if leaf.keys[i] == key => {
                        leaf.values[i] = value;
                        (BPlusNode::Leaf(leaf), None)
                    }
                    Some(i) => {
                        leaf.keys.insert(i, key);
                        leaf.values.insert(i, value);
                        Self::maybe_split_leaf(leaf, order)
                    }
                    None => {
                        leaf.keys.push(key);
                        leaf.values.push(value);
                        Self::maybe_split_leaf(leaf, order)
                    }
                }
            }
            BPlusNode::Internal(mut internal) => {
                let mut i = 0;
                while i < internal.keys.len() && key >= internal.keys[i] { i += 1; }
                let child = internal.children.remove(i);
                let (new_child, split) = Self::insert_node(child, key, value, order);
                internal.children.insert(i, new_child);
                if let Some((promote_key, right)) = split {
                    internal.keys.insert(i, promote_key);
                    internal.children.insert(i + 1, right);
                    if internal.keys.len() >= order {
                        return Self::split_internal(internal);
                    }
                }
                (BPlusNode::Internal(internal), None)
            }
        }
    }

    fn maybe_split_leaf(
        mut leaf: LeafNode, order: usize,
    ) -> (BPlusNode, Option<(i64, BPlusNode)>) {
        if leaf.keys.len() < order {
            return (BPlusNode::Leaf(leaf), None);
        }
        let mid = leaf.keys.len() / 2;
        let new_leaf = LeafNode {
            keys: leaf.keys.split_off(mid),
            values: leaf.values.split_off(mid),
        };
        let promote = new_leaf.keys[0];
        (BPlusNode::Leaf(leaf), Some((promote, BPlusNode::Leaf(new_leaf))))
    }

    fn split_internal(
        mut node: InternalNode,
    ) -> (BPlusNode, Option<(i64, BPlusNode)>) {
        let mid = node.keys.len() / 2;
        let promote = node.keys[mid];
        let right_keys = node.keys.split_off(mid + 1);
        node.keys.pop();
        let right_children = node.children.split_off(mid + 1);
        let right = InternalNode { keys: right_keys, children: right_children };
        (BPlusNode::Internal(node), Some((promote, BPlusNode::Internal(right))))
    }
}
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带插入和搜索的 B+ 树 | `exercises/typescript/b-plus-tree/01-basic.test.ts` |
| 进阶 | 添加基于叶节点链表的范围查询 | `exercises/typescript/b-plus-tree/02-intermediate.test.ts` |

## 何时使用

- **数据库索引** -- 所有关系数据库都用 B+ 树实现主键和二级索引
- **文件系统** -- NTFS、ext4、Btrfs 用 B+ 树存储目录条目和元数据
- **需要范围查询** -- 叶节点链表高效支持 `WHERE x BETWEEN a AND b`
- **磁盘存储** -- 高扇出最大限度减少磁盘寻址（十亿行只需 3-4 层）
- **有序遍历** -- 叶链表提供排序遍历，无需树遍历

## 何时不用

- **仅内存且数据量小** -- 哈希表或平衡 BST 更简单高效
- **写多读少** -- LSM 树（LevelDB、RocksDB）批量写入效率更高
- **仅点查** -- 哈希索引 O(1) 优于 O(log n)，无需树的开销
- **仅追加写** -- 随机插入导致页分裂；日志结构存储可避免

## 更多生产案例

- [InnoDB (MySQL)](https://github.com/mysql/mysql-server) -- 聚簇索引就是 B+ 树；二级索引回指聚簇索引
- [MongoDB WiredTiger](https://github.com/mongodb/mongo) -- WiredTiger 存储引擎用 B+ 树实现索引
- [LMDB](https://github.com/LMDB/lmdb) -- 写时复制 B+ 树，用于崩溃安全的内存映射存储
- [Btrfs](https://github.com/torvalds/linux) -- Linux 文件系统完全构建在 B-tree / B+ 树之上

## 挑战题

::: details Q1: A B+ tree with order 100 and 1 billion keys. How many levels deep is it? How many disk reads for a point lookup?
**Answer:** At most 5 levels.

Each internal node holds up to 99 keys and 100 children. Level 0 (root): 1 node. Level 1: 100 nodes. Level 2: 10,000 nodes. Level 3: 1,000,000 nodes. Level 4 (leaves): 100,000,000 nodes.

100^4 = 10 billion > 1 billion, so 5 levels suffice. A point lookup reads one node per level = 5 disk reads. In practice the root and top internal levels are cached in RAM, so typically 2-3 disk reads.
:::

::: details Q2: Why do B+ trees store values ONLY in leaves, unlike B-trees which store values in internal nodes too?
**Answer:** Two reasons:

1. **Higher fan-out**: Internal nodes without values are smaller, so more keys fit per page. More keys per node = shallower tree = fewer disk reads.
2. **Simpler range scans**: All values are at the leaf level linked together. A range query walks the leaf chain linearly. In a B-tree, you'd need an in-order traversal visiting every level.

The tradeoff: exact-match lookups always go to leaf level in a B+ tree (never short-circuit at an internal node). But disk-backed systems optimize for fan-out, making B+ trees the universal choice for databases.
:::

::: details Q3: PostgreSQL uses a "B-link tree" instead of a standard B+ tree. What problem does the right-link solve?
**Answer:** Concurrent access without global locks.

In a standard B+ tree, a split requires locking the parent to insert the new child pointer. This can cascade up to the root, creating a bottleneck. Lehman and Yao's B-link tree adds a right-link pointer between siblings at every level. A reader that lands on a node mid-split can follow the right-link to find the new sibling. Writers only need to lock the node being split and its right neighbor -- no parent lock needed at split time.

This is why PostgreSQL can handle concurrent index insertions without locking the entire tree.
:::
