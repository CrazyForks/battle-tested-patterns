---
description: "Store strings in a tree where each edge represents a character — shared prefixes share nodes, enabling O(k) lookup by key length."
---

# Pattern: Trie (Prefix Tree)

## One Liner

Store strings in a tree where each edge represents a character — shared prefixes share nodes, enabling O(k) lookup by key length.

<DemoBadge />

## Core Idea

A trie (pronounced "try") is a tree where each path from root to node spells a prefix. Nodes branch on characters. This makes prefix queries trivial and key lookup proportional to key length, not the number of stored keys.

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

| Property | Value |
|----------|-------|
| Lookup | O(k) where k = key length |
| Insert | O(k) |
| Prefix search | O(k + results) — find all keys with prefix in one traversal |
| Space | O(n × k) worst case, but shared prefixes save significantly |

**Try it yourself** — insert words and search to see how shared prefixes create a compact tree:

<TrieViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| Linux Kernel | [fib_trie.c#L80-L120](https://github.com/torvalds/linux/blob/master/net/ipv4/fib_trie.c#L80-L120) | IP routing table — a compressed trie (LC-trie) stores the kernel's forwarding information base (FIB). `key_vector` nodes with variable-length prefix matching for O(log n) longest-prefix-match lookups on every packet forwarded. |
| Redis | [rax.h#L80-L130](https://github.com/redis/redis/blob/unstable/src/rax.h#L80-L130) | Radix tree (`rax`) — a compressed trie used for Redis Streams keys, cluster slot-to-node mapping, and sorted set iterator. `raxNode` stores compressed prefixes with iskey/isnull flags. |

## Implementation

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

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a trie with insert/search/startsWith | `exercises/typescript/trie/01-basic.test.ts` |
| Intermediate | Autocomplete with frequency-ranked results | `exercises/typescript/trie/02-intermediate.test.ts` |

Run exercises: `pnpm test`

## When to Use

- **Autocomplete / type-ahead** — find all completions for a prefix
- **IP routing** — longest prefix match for packet forwarding (Linux FIB)
- **Spell checking** — fast word validation and suggestion
- **DNS resolution** — domain name lookup with hierarchical labels
- **Deduplication** — efficiently detect duplicate strings

## When NOT to Use

- **Exact key lookup only** — a hash map is O(1) vs trie's O(k)
- **Numeric keys** — binary search tree or sorted array is more space-efficient
- **Memory-constrained** — tries can use significant memory for sparse key distributions
- **Short, unique keys** — if keys share few prefixes, tries waste nodes

## More Production Uses

- [Chromium](https://chromium.googlesource.com/chromium/src) — URL autocomplete trie
- [Go `net` package](https://github.com/golang/go) — domain name matching
- [Apache Lucene](https://github.com/apache/lucene) — FST (finite state transducer) for term index
- [iptables/nftables](https://github.com/torvalds/linux) — IP set matching with tries

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Bloom Filter](/patterns/bloom-filter/) | Bloom filters pre-filter before expensive trie lookups |
| [Registry](/patterns/registry/) | Tries can implement registries with prefix-based routing |
| [Skip List](/patterns/skip-list/) | Alternative sorted lookup — skip lists are ordered by value, tries by key characters |

## Challenge Questions

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
