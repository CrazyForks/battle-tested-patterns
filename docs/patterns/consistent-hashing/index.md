# Pattern: Consistent Hashing

## One Liner

Distribute keys across nodes on a virtual ring so that adding or removing a node only remaps ~1/n of the keys.

## Core Idea

Traditional modular hashing (`hash(key) % n`) remaps almost every key when `n` changes. Consistent hashing places both nodes and keys on a circular ring. Each key maps to the first node clockwise from its position. Adding or removing a node only affects keys in the arc between it and its predecessor.

```text
  Clockwise →
        ┌─── 0 ───────────────────────────────┐
        │                                      │
      Node A ─── ● key:user:42 ─── Node B      │
        │                            │         │
        │                            │         │
        │                            │         │
      ● key:order:7          ● key:session:99  │
        │                            │         │
      Node C ────────────────────────┘         │
        │                                      │
        └──────────── 2^32 ────────────────────┘

  Lookup: walk clockwise to the next node
    key:user:42    → Node B
    key:order:7    → Node C
    key:session:99 → Node A
```

| Property | Value |
|----------|-------|
| Key remapping on add/remove | ~1/n (vs 100% with modular hash) |
| Virtual nodes (replicas) | Improve balance — each physical node maps to k positions on the ring |
| Lookup | O(log n) via binary search on sorted ring |

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| Go groupcache | [consistenthash.go#L28-L81](https://github.com/golang/groupcache/blob/master/consistenthash/consistenthash.go#L28-L81) | `Map` struct (L28-L33) with sorted keys and hashMap. `Add` (L53-L62) inserts virtual nodes. `Get` (L65-L81) uses `sort.Search` binary search to find the closest node clockwise. By Brad Fitzpatrick (creator of memcached). |
| HAProxy | [lb_chash.c#L415-L491](https://github.com/haproxy/haproxy/blob/master/src/lb_chash.c#L415-L491) | `chash_get_server_hash` — finds the nearest server on the consistent hash ring using elastic binary trees (eb-trees) for O(log n) lookups. Supports bounded-loads balancing and server eligibility checks. |

## Implementation

::: code-group

```typescript [TypeScript]
class HashRing {
  private ring = new Map<number, string>();
  private sortedKeys: number[] = [];

  constructor(private replicas = 100) {}

  private hash(key: string): number {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  addNode(node: string): void {
    for (let i = 0; i < this.replicas; i++) {
      const h = this.hash(`${node}:${i}`);
      this.ring.set(h, node);
      this.sortedKeys.push(h);
    }
    this.sortedKeys.sort((a, b) => a - b);
  }

  removeNode(node: string): void {
    for (let i = 0; i < this.replicas; i++) {
      this.ring.delete(this.hash(`${node}:${i}`));
    }
    this.sortedKeys = this.sortedKeys.filter((k) => this.ring.has(k));
  }

  getNode(key: string): string | undefined {
    if (this.sortedKeys.length === 0) return undefined;
    const h = this.hash(key);
    for (const k of this.sortedKeys) {
      if (k >= h) return this.ring.get(k);
    }
    return this.ring.get(this.sortedKeys[0]!);
  }
}
```

```go [Go]
type HashRing struct {
	replicas int
	keys     []int
	hashMap  map[int]string
}

func fnv1a(s string) int {
	h := 2166136261
	for i := 0; i < len(s); i++ {
		h ^= int(s[i])
		h *= 16777619
	}
	if h < 0 {
		h = -h
	}
	return h
}

func NewHashRing(replicas int) *HashRing {
	return &HashRing{replicas: replicas, hashMap: make(map[int]string)}
}

func (r *HashRing) AddNode(node string) {
	for i := 0; i < r.replicas; i++ {
		h := fnv1a(fmt.Sprintf("%s:%d", node, i))
		r.keys = append(r.keys, h)
		r.hashMap[h] = node
	}
	sort.Ints(r.keys)
}

func (r *HashRing) GetNode(key string) string {
	if len(r.keys) == 0 {
		return ""
	}
	h := fnv1a(key)
	idx := sort.SearchInts(r.keys, h)
	if idx >= len(r.keys) {
		idx = 0
	}
	return r.hashMap[r.keys[idx]]
}
```

```python [Python]
import bisect

class HashRing:
    def __init__(self, replicas: int = 100):
        self.replicas = replicas
        self.ring: dict[int, str] = {}
        self.sorted_keys: list[int] = []

    def _hash(self, key: str) -> int:
        h = 2166136261
        for ch in key:
            h ^= ord(ch)
            h = (h * 16777619) & 0xFFFFFFFF
        return h

    def add_node(self, node: str) -> None:
        for i in range(self.replicas):
            h = self._hash(f"{node}:{i}")
            self.ring[h] = node
            bisect.insort(self.sorted_keys, h)

    def get_node(self, key: str) -> str | None:
        if not self.sorted_keys:
            return None
        h = self._hash(key)
        idx = bisect.bisect_left(self.sorted_keys, h)
        if idx >= len(self.sorted_keys):
            idx = 0
        return self.ring[self.sorted_keys[idx]]
```

```rust [Rust]
pub struct HashRing {
    replicas: usize,
    keys: Vec<u32>,
    ring: std::collections::HashMap<u32, String>,
}

impl HashRing {
    pub fn new(replicas: usize) -> Self {
        HashRing { replicas, keys: Vec::new(), ring: std::collections::HashMap::new() }
    }

    fn hash(key: &str) -> u32 {
        let mut h: u32 = 2166136261;
        for b in key.bytes() {
            h ^= b as u32;
            h = h.wrapping_mul(16777619);
        }
        h
    }

    pub fn add_node(&mut self, node: &str) {
        for i in 0..self.replicas {
            let h = Self::hash(&format!("{}:{}", node, i));
            self.ring.insert(h, node.to_string());
            self.keys.push(h);
        }
        self.keys.sort();
    }

    pub fn get_node(&self, key: &str) -> Option<&str> {
        if self.keys.is_empty() { return None; }
        let h = Self::hash(key);
        let idx = self.keys.partition_point(|&k| k < h);
        let idx = if idx >= self.keys.len() { 0 } else { idx };
        self.ring.get(&self.keys[idx]).map(|s| s.as_str())
    }
}
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a hash ring with addNode/getNode | `exercises/typescript/consistent-hashing/01-basic.test.ts` |

Run exercises: `pnpm test`

## When to Use

- **Distributed caches** — route keys to cache servers, minimize cache invalidation on scale events
- **Load balancing** — distribute requests with minimal disruption when backends change
- **Sharded databases** — assign data partitions to nodes
- **CDNs** — route content to edge servers based on URL hash

## When NOT to Use

- **Static topology** — if nodes never change, modular hashing is simpler
- **Small clusters** — with < 5 nodes, random or round-robin may be good enough
- **Strict ordering** — consistent hashing doesn't preserve key ordering
- **Uniform distribution required** — without virtual nodes, distribution can be uneven

## More Production Uses

- [serialx/hashring](https://github.com/serialx/hashring/blob/master/hashring.go#L31-L37) — Go hash ring with weighted nodes
- [Apache Cassandra](https://github.com/apache/cassandra) — partitioner uses consistent hashing for token ring
- [Amazon DynamoDB](https://www.allthingsdistributed.com/2007/10/amazons_dynamo.html) — original paper on consistent hashing in production
- [Memcached](https://github.com/memcached/memcached) — client-side consistent hashing (ketama algorithm)
