---
title: "Pattern: B+ Tree"
description: "Self-balancing tree with high branching factor — internal nodes guide, leaf nodes store, all leaves linked for efficient range scans."
difficulty: "advanced"
---

# Pattern: B+ Tree

<DifficultyBadge />

## One Liner

Self-balancing tree with high branching factor — internal nodes guide, leaf nodes store, all leaves linked for efficient range scans.

<DemoBadge />

## Real-World Analogy

A library's card catalog with multiple levels. The top drawer says 'A-M' and 'N-Z.' Inside 'A-M,' you find 'A-D', 'E-H', etc. You keep narrowing until you reach the actual cards, which are linked together for easy browsing.

## Core Idea

A B+ tree separates routing from storage. Internal nodes hold only keys and child pointers to guide searches down the tree. Leaf nodes hold actual key-value pairs and are linked together, enabling efficient sequential scans. The high branching factor (hundreds of keys per node) keeps the tree shallow — typically 3-4 levels for billions of records — minimizing disk I/O.

```text
                    ┌──────────────┐
                    │   [30 | 60]  │          Internal (keys only)
                    └──┬─────┬──┬──┘
                       │     │  │
          ┌────────────┘     │  └────────────┐
          ▼                  ▼               ▼
     ┌─────────┐      ┌──────────┐     ┌─────────┐
     │[10 | 20]│      │[40 | 50] │     │[70 | 80]│   Internal
     └─┬──┬──┬─┘      └──┬──┬──┬─┘     └─┬──┬──┬─┘
       │  │  │           │  │  │         │  │  │
       ▼  ▼  ▼           ▼  ▼  ▼         ▼  ▼  ▼
     ┌───┬───┬───┬───┬───┬───┬───┬───┬───┐
     │1-9│10-│20-│30-│40-│50-│60-│70-│80-│  Leaf nodes
     │   │ 19│ 29│ 39│ 49│ 59│ 69│ 79│ 99│  (data here)
     └─►─┴─►─┴─►─┴─►─┴─►─┴─►─┴─►─┴─►─┴───┘
       Linked list for range scans ──────►
```

| Property | Value |
|----------|-------|
| Search | O(log_B n) — B = branching factor |
| Insert | O(log_B n) — may split nodes |
| Range scan | O(log_B n + k) — k = result count |
| Space | O(n) |
| Fan-out | Typically 100-1000 keys per node |

**Try it yourself** — insert keys and watch the B+ tree split nodes to stay balanced:

<BPlusTreeViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| PostgreSQL | [nbtinsert.c#L22-L55](https://github.com/postgres/postgres/blob/e18b0cb7344cb4bd28468f6c0aeeb9b9241d30aa/src/backend/access/nbtree/nbtinsert.c#L22-L55) | B-link tree (Lehman-Yao variant of B+ tree). `_bt_doinsert` manages concurrent insertions with right-links between siblings. Internal pages store keys + child pointers; leaf pages store heap TIDs and are chained for index scans via `_bt_readnextpage`. |
| SQLite | [btreeInt.h#L190-L198](https://github.com/sqlite/sqlite/blob/2cb57d9d4ac7eac3b1d15cfa71511f54817cb3e4/src/btreeInt.h#L190-L198) | All tables and indexes backed by B+ trees on disk pages. Cell format defined in `btreeInt.h`: interior cells hold child page pointers + keys; leaf cells hold complete payloads. `balance_nonroot()` handles page splitting when a node overflows. |

## Implementation

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

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a B+ tree with insert and search | `exercises/typescript/b-plus-tree/01-basic.test.ts` |
| Intermediate | Add range queries with linked leaf traversal | `exercises/typescript/b-plus-tree/02-intermediate.test.ts` |

Run exercises: `pnpm test:ts` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/b_plus_tree/mod.rs` · Go `exercises/go/b_plus_tree/b_plus_tree_test.go` · Python `exercises/python/b_plus_tree/test_b_plus_tree.py`

## When to Use

- **Database indexes** — every RDBMS uses B+ trees for primary and secondary indexes
- **File systems** — NTFS, ext4, Btrfs store directory entries and metadata in B+ trees
- **Range queries needed** — linked leaves enable efficient `WHERE x BETWEEN a AND b`
- **Disk-backed storage** — high fan-out minimizes disk seeks (3-4 levels for billions of rows)
- **Ordered iteration** — leaf chain provides sorted traversal without tree walk

## When NOT to Use

- **In-memory only with small data** — a hash map or balanced BST is simpler and faster
- **Write-heavy with no reads** — LSM trees (LevelDB, RocksDB) batch writes more efficiently
- **Point lookups only** — hash indexes are O(1) vs O(log n); skip the tree overhead
- **Append-only workloads** — random inserts cause page splits; log-structured storage avoids this

## More Production Uses

- [InnoDB (MySQL)](https://github.com/mysql/mysql-server) — clustered index is a B+ tree; secondary indexes point back to it
- [MongoDB WiredTiger](https://github.com/mongodb/mongo) — WiredTiger storage engine uses B+ trees for indexes
- [LMDB](https://github.com/LMDB/lmdb) — copy-on-write B+ tree for crash-safe memory-mapped storage
- [Btrfs](https://github.com/torvalds/linux) — Linux filesystem built entirely on B-trees / B+ trees

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Skip List](/patterns/skip-list/) | Simpler probabilistic alternative with comparable O(log n) performance |
| [LSM Tree (Log-Structured Merge Tree)](/patterns/lsm-tree/) | LSM trees buffer writes for speed; B+ trees optimize reads with balanced structure |
| [Merkle Tree](/patterns/merkle-tree/) | Both are tree structures — Merkle for integrity verification, B+ for ordered storage |
| [Merge Iterator (K-Way Merge)](/patterns/merge-iterator/) | B+ tree range scans use iterator patterns similar to merge iterators |
| [Min-Heap / Priority Queue](/patterns/min-heap/) | Both are tree-based structures — B+ trees optimize range queries, min-heaps optimize priority extraction |

## Challenge Questions

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

In a standard B+ tree, a split requires locking the parent to insert the new child pointer. This can cascade up to the root, creating a bottleneck. Lehman and Yao's B-link tree adds a right-link pointer between siblings at every level. A reader that lands on a node mid-split can follow the right-link to find the new sibling. Writers only need to lock the node being split and its right neighbor — no parent lock needed at split time.

This is why PostgreSQL can handle concurrent index insertions without locking the entire tree.
:::

::: details Q4: Your B+ tree index works well for `SELECT * FROM orders WHERE price BETWEEN 10 AND 50`, but `SELECT * FROM orders WHERE status = 'pending' AND region = 'US'` is slow despite having a composite index on (status, region). What happened?
**Answer:** The query likely isn't using the index's leftmost prefix, or the column order in the composite index doesn't match the query pattern.

A B+ tree composite index on (status, region) stores entries sorted first by status, then by region within each status. This index handles `WHERE status = 'pending'` and `WHERE status = 'pending' AND region = 'US'` efficiently. But if the query filters on `region` alone without `status`, the B+ tree can't skip to the right leaf — it must scan the entire index. This is the "leftmost prefix" rule: a composite B+ tree index is only useful for queries that filter on a prefix of the indexed columns in order. For multi-column filtering on arbitrary combinations, consider separate indexes or a different indexing strategy.
:::
