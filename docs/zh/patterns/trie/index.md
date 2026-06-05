---
description: "在树中存储字符串，每条边代表一个字符——共享前缀共享节点，实现按键长度 O(k) 查找。"
difficulty: "intermediate"
---

# 模式：Trie 前缀树 (Trie / Prefix Tree)

<DifficultyBadge />

## 一句话

在树中存储字符串，每条边代表一个字符——共享前缀共享节点，实现按键长度 O(k) 查找。

<DemoBadge />

## 现实类比

老式电话簿边缘的字母标签——A、B、C。要找 'Smith'，先跳到 S，再到 SM，再到 SMI。每个字母缩小范围，共享前缀的名字（'Smith'、'Smithson'）走同一条路径。

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

**动手试试** — 插入单词并搜索，观察共享前缀如何构成紧凑的树：

<TrieViz />

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
| 进阶 | 基于频率排序的自动补全 | `exercises/typescript/trie/02-intermediate.test.ts` |

运行练习：`pnpm test`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

练习文件： Rust `exercises/rust/src/trie.rs` · Go `exercises/go/trie_test.go` · Python `exercises/python/test_trie.py`

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

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [布隆过滤器 (Bloom Filter)](/zh/patterns/bloom-filter/) | 布隆过滤器在昂贵的 Trie 查找前做预过滤 |
| [注册表 / 自注册 (Registry)](/zh/patterns/registry/) | Trie 可以实现基于前缀路由的注册表 |
| [跳表 (Skip List)](/zh/patterns/skip-list/) | 另一种有序查找——跳表按值排序，Trie 按键字符排序 |

## 挑战题

::: details Q1: 你构建了一个 Trie 来存储 100,000 个英文单词。每个节点有一个 `Map<string, TrieNode>`，每个子字符一个条目。一位同事指出这比同样单词的简单 hash set 使用更多内存。Trie 的内存开销是合理的吗？
**答案：** 对于纯精确匹配查找，不合理——hash set 更节省内存且 O(1)。Trie 的内存开销只有在你需要前缀操作时才合理。

朴素的 Trie 每个字符创建一个节点，产生大量带有 map/指针开销的小对象。对于 10 万个英文单词，hash set 存储 10 万个字符串；Trie 可能创建 50 万以上的节点。当你的用例需要前缀搜索（"找到所有以 'pre' 开头的单词"）、自动补全或最长前缀匹配时，Trie 才值得——这些操作 hash set 无法高效完成。如果你只需要"这个确切的单词在集合中吗？"，使用 hash set。
:::

::: details Q2: Redis 使用基数树（压缩 Trie）而不是标准 Trie。"压缩"是什么意思？为什么它对内存很重要？
**答案：** 压缩 Trie（基数树）将单子节点链合并为一个带多字符标签的节点，大幅减少节点数量。

在标准 Trie 中存储 "application"，你需要创建 11 个节点——每个字符一个。如果没有其他单词共享前缀 "applicat"，前 8 个节点各自恰好有一个子节点，浪费了 8 个节点的开销。基数树将其压缩为单个标签为 "applicat" 的节点，然后在 "i"->"on" 处分支以及可能的其他后缀。Redis 的 `rax` 实现在节点结构中内联存储压缩前缀，对于有长共享前缀的典型字符串集合，内存减少 5-10 倍。
:::

::: details Q3: Linux 内核使用 Trie 进行 IP 路由表查找。Hash map 能提供 O(1) 的精确匹配查找。为什么内核使用 Trie？
**答案：** IP 路由需要最长前缀匹配，而非精确匹配——Trie 天然支持这一点，而 hash map 不行。

当内核将数据包路由到 `192.168.1.42` 时，它需要找到最具体的匹配路由。路由表可能包含 `0.0.0.0/0`（默认）、`192.168.0.0/16` 和 `192.168.1.0/24`。正确的匹配是最长前缀：`192.168.1.0/24`。Hash map 需要检查所有可能的前缀长度（IPv4 最多 32 位），每个数据包需要 32 次查找。Trie 在一次遍历中从根到最深匹配节点，自然找到最长前缀。这就是为什么每个主要操作系统都使用 Trie 变体进行 IP 路由。
:::

::: details Q4: 你的自动补全系统在 Trie 中存储了 1000 万个产品名称。搜索前缀 "ip" 返回 50,000 个结果。用户只看前 10 个。如何避免收集所有 50,000 个结果？
**答案：** 在每个 Trie 节点存储一个"top-k 结果"列表，在插入时预计算，这样前缀查询可以在 O(k) 时间内返回排名结果而无需遍历子树。

朴素方法中，前缀搜索需要遍历前缀节点下的整个子树，收集所有 `isEnd` 节点——O(结果数) 的时间在你只需要 10 个时是浪费的。通过在每个节点维护一个有界优先队列的 top-k 结果（在插入时更新），你可以通过读取 'i' 下 'p' 节点的列表来回答"前缀 'ip' 的前 10 个"。这以插入时间和内存换取查询速度。Google 的搜索建议使用类似的方法，采用频率加权的 Trie。
:::
