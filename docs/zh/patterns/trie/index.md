# 模式：Trie 前缀树 (Trie / Prefix Tree)

## 一句话

在树中存储字符串，每条边代表一个字符——共享前缀共享节点，实现按键长度 O(k) 查找。

## 核心思想

Trie 是一种树，从根到节点的每条路径拼出一个前缀。节点按字符分支。这使前缀查询变得简单，键查找与键长度成正比，而非存储的键数。

```text
  Root
   ├── c
   │   ├── a
   │   │   ├── r ●       "car"
   │   │   │   ├── d ●   "card"
   │   │   │   └── e ●   "care"
   │   │   └── t ●       "cat"
   │   └── u
   │       └── t ●       "cut"
   └── d
       └── o
           └── g ●       "dog"
```

| 属性 | 值 |
|------|------|
| 查找 | O(k)，k = 键长度 |
| 插入 | O(k) |
| 前缀搜索 | O(k + 结果数) — 一次遍历找到所有带前缀的键 |
| 空间 | O(n × k) 最坏情况，但共享前缀显著节省 |

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Linux Kernel | [fib_trie.c#L80-L120](https://github.com/torvalds/linux/blob/master/net/ipv4/fib_trie.c#L80-L120) | IP 路由表——压缩 trie（LC-trie）存储内核的转发信息库（FIB）。`key_vector` 节点支持变长前缀匹配，对每个转发的数据包进行 O(log n) 最长前缀匹配查找。 |
| Redis | [rax.h#L80-L130](https://github.com/redis/redis/blob/unstable/src/rax.h#L80-L130) | Radix tree（`rax`）——压缩 trie 用于 Redis Streams 键、集群 slot 到节点的映射和有序集合迭代器。`raxNode` 存储压缩前缀，带 iskey/isnull 标志。 |

## 实现

::: code-group

```typescript [TypeScript]
class TrieNode {
  children = new Map<string, TrieNode>();
  isEnd = false;
}

class Trie {
  private root = new TrieNode();

  insert(word: string): void {
    let node = this.root;
    for (const ch of word) {
      if (!node.children.has(ch)) node.children.set(ch, new TrieNode());
      node = node.children.get(ch)!;
    }
    node.isEnd = true;
  }

  search(word: string): boolean {
    const node = this.findNode(word);
    return node !== null && node.isEnd;
  }

  startsWith(prefix: string): boolean {
    return this.findNode(prefix) !== null;
  }

  private findNode(s: string): TrieNode | null {
    let node = this.root;
    for (const ch of s) {
      if (!node.children.has(ch)) return null;
      node = node.children.get(ch)!;
    }
    return node;
  }
}
```

```go [Go]
type TrieNode struct {
	children map[byte]*TrieNode
	isEnd    bool
}

type Trie struct {
	root *TrieNode
}

func NewTrie() *Trie {
	return &Trie{root: &TrieNode{children: make(map[byte]*TrieNode)}}
}

func (t *Trie) Insert(word string) {
	node := t.root
	for i := 0; i < len(word); i++ {
		ch := word[i]
		if _, ok := node.children[ch]; !ok {
			node.children[ch] = &TrieNode{children: make(map[byte]*TrieNode)}
		}
		node = node.children[ch]
	}
	node.isEnd = true
}

func (t *Trie) Search(word string) bool {
	node := t.find(word)
	return node != nil && node.isEnd
}

func (t *Trie) StartsWith(prefix string) bool {
	return t.find(prefix) != nil
}

func (t *Trie) find(s string) *TrieNode {
	node := t.root
	for i := 0; i < len(s); i++ {
		if next, ok := node.children[s[i]]; ok {
			node = next
		} else {
			return nil
		}
	}
	return node
}
```

```python [Python]
class TrieNode:
    def __init__(self):
        self.children: dict[str, TrieNode] = {}
        self.is_end = False

class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word: str) -> None:
        node = self.root
        for ch in word:
            if ch not in node.children:
                node.children[ch] = TrieNode()
            node = node.children[ch]
        node.is_end = True

    def search(self, word: str) -> bool:
        node = self._find(word)
        return node is not None and node.is_end

    def starts_with(self, prefix: str) -> bool:
        return self._find(prefix) is not None

    def _find(self, s: str):
        node = self.root
        for ch in s:
            if ch not in node.children:
                return None
            node = node.children[ch]
        return node
```

```rust [Rust]
use std::collections::HashMap;

pub struct TrieNode {
    children: HashMap<char, TrieNode>,
    is_end: bool,
}

impl TrieNode {
    fn new() -> Self { TrieNode { children: HashMap::new(), is_end: false } }
}

pub struct Trie { root: TrieNode }

impl Trie {
    pub fn new() -> Self { Trie { root: TrieNode::new() } }

    pub fn insert(&mut self, word: &str) {
        let mut node = &mut self.root;
        for ch in word.chars() {
            node = node.children.entry(ch).or_insert_with(TrieNode::new);
        }
        node.is_end = true;
    }

    pub fn search(&self, word: &str) -> bool {
        self.find(word).map_or(false, |n| n.is_end)
    }

    pub fn starts_with(&self, prefix: &str) -> bool {
        self.find(prefix).is_some()
    }

    fn find(&self, s: &str) -> Option<&TrieNode> {
        let mut node = &self.root;
        for ch in s.chars() {
            match node.children.get(&ch) {
                Some(next) => node = next,
                None => return None,
            }
        }
        Some(node)
    }
}
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带 insert/search/startsWith 的 Trie | `exercises/typescript/trie/01-basic.test.ts` |

## 何时使用

- **自动补全 / 输入提示** — 查找某前缀的所有补全
- **IP 路由** — 数据包转发的最长前缀匹配（Linux FIB）
- **拼写检查** — 快速单词验证和建议
- **DNS 解析** — 分层标签的域名查找
- **去重** — 高效检测重复字符串

## 何时不用

- **仅精确键查找** — 哈希表是 O(1)，trie 是 O(k)
- **数字键** — 二叉搜索树或排序数组更省空间
- **内存受限** — 稀疏键分布时 trie 可能占用大量内存
- **短的唯一键** — 如果键共享的前缀很少，trie 浪费节点

## 更多生产案例

- [Chromium](https://chromium.googlesource.com/chromium/src) — URL 自动补全 trie
- [Go `net` 包](https://github.com/golang/go) — 域名匹配
- [Apache Lucene](https://github.com/apache/lucene) — FST（有限状态转换器）用于词项索引
- [iptables/nftables](https://github.com/torvalds/linux) — 使用 trie 的 IP 集合匹配

## 挑战题

::: details Q1: You build a trie to store 100,000 English words. Each node has a `Map<string, TrieNode>` with one entry per child character. A colleague points out this uses far more memory than a simple hash set of the same words. Is the trie's memory overhead justified?
**Answer:** For pure exact-match lookups, no — a hash set is more memory-efficient and O(1). The trie's memory overhead is only justified when you need prefix operations.

A naive trie with one node per character creates many small objects with map/pointer overhead. For 100k English words, a hash set stores 100k strings; a trie might create 500k+ nodes. The trie becomes worthwhile when your use case requires prefix search ("find all words starting with 'pre'"), autocomplete, or longest-prefix matching — operations a hash set cannot do efficiently. If you only need "is this exact word in the set?", use a hash set.
:::

::: details Q2: Redis uses a radix tree (compressed trie) instead of a standard trie. What does "compressed" mean, and why does it matter for memory?
**Answer:** A compressed trie (radix tree) merges chains of single-child nodes into one node with a multi-character label, dramatically reducing node count.

In a standard trie storing "application", you create 11 nodes — one per character. If no other word shares the prefix "applicat", the first 8 nodes each have exactly one child, wasting 8 nodes of overhead. A radix tree compresses this into a single node labeled "applicat" followed by branching at "i"→"on" and potentially other suffixes. Redis's `rax` implementation stores compressed prefixes inline in the node struct, reducing memory by 5-10x for typical string sets with long shared prefixes.
:::

::: details Q3: The Linux kernel uses a trie for IP routing table lookups. A hash map would give O(1) exact-match lookup. Why does the kernel use a trie instead?
**Answer:** IP routing requires longest-prefix matching, not exact matching — a trie naturally supports this while a hash map does not.

When the kernel routes a packet to `192.168.1.42`, it needs to find the most specific matching route. The routing table might contain `0.0.0.0/0` (default), `192.168.0.0/16`, and `192.168.1.0/24`. The correct match is the longest prefix: `192.168.1.0/24`. A hash map would require checking all possible prefix lengths (up to 32 for IPv4), needing 32 lookups per packet. A trie traverses from root to the deepest matching node in a single pass, naturally finding the longest prefix. This is why every major OS uses a trie variant for IP routing.
:::

::: details Q4: Your autocomplete system stores 10 million product names in a trie. Searching for prefix "ip" returns 50,000 results. Users only see the top 10. How would you avoid collecting all 50,000 results?
**Answer:** Store a "top-k results" list at each trie node, precomputed during insertion, so prefix queries return ranked results in O(k) time without traversing the subtree.

Naively, prefix search requires traversing the entire subtree below the prefix node, collecting all `isEnd` nodes — O(results) time that's wasteful when you only need 10. By maintaining a bounded priority queue of the top-k results at each node (updated on insertion), you can answer "top 10 for prefix 'ip'" by reading the list at the 'p' node under 'i'. This trades insertion time and memory for query speed. Google's search suggestions use a similar approach with frequency-weighted tries.
:::
