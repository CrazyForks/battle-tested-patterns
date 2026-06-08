---
description: "Evict the least recently used entry when the cache is full — O(1) get and put using a hash map plus a doubly linked list."
difficulty: "intermediate"
---

# Pattern: LRU Cache

<DifficultyBadge />

## One Liner

Evict the least recently used entry when the cache is full — O(1) get and put using a hash map plus a doubly linked list.

<DemoBadge />

## Real-World Analogy

A small desk with limited space. You keep the books you've used most recently on the desk. When you need room for a new book, you move the one you haven't touched longest back to the bookshelf.

## Core Idea

An LRU cache combines a hash map (for O(1) key lookup) with a doubly linked list (for O(1) recency tracking). On every access, the entry moves to the front. When the cache exceeds capacity, the entry at the back (least recently used) is evicted.

```text
  Most Recent                                    Least Recent
  ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐
  │  E  │◄──►│  D  │◄──►│  C  │◄──►│  B  │◄──►│  A  │  ← evict this
  └─────┘    └─────┘    └─────┘    └─────┘    └─────┘

  get("B") → move B to front:
  ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐
  │  B  │◄──►│  E  │◄──►│  D  │◄──►│  C  │◄──►│  A  │
  └─────┘    └─────┘    └─────┘    └─────┘    └─────┘

  put("F") with capacity=5 → evict A, add F to front
```

| Property | Value |
|----------|-------|
| get | O(1) — hash map lookup + move to front |
| put | O(1) — hash map insert + evict if over capacity |
| Eviction policy | Least Recently Used (tail of list) |
| Space | O(capacity) |

**Try it yourself** — put and get keys to see how the LRU eviction works:

<LRUCacheViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| Go groupcache | [lru.go#L23-L104](https://github.com/golang/groupcache/blob/master/lru/lru.go#L23-L104) | `Cache` struct (L23-L34) with doubly linked list + hash map. `Add` (L56-L71) inserts/updates and moves to front; `Get` (L74-L83) moves to front on hit; `RemoveOldest` (L96-L104) evicts from back. By Brad Fitzpatrick (memcached creator). |
| Redis | [evict.c#L55-L83](https://github.com/redis/redis/blob/unstable/src/evict.c#L55-L83) | Approximated LRU — reduced-bit LRU clock and idle-time estimation with wraparound. `evictionPoolPopulate` (L134-L225) samples N keys and inserts into a sorted eviction pool. Engineering tradeoff: O(1) memory overhead at scale vs exact LRU. |

## Implementation

::: code-group

```typescript [TypeScript]
class LRUCache<K, V> {
  private map = new Map<K, V>();

  constructor(private capacity: number) {}

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  put(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value!;
      this.map.delete(oldest);
    }
  }
}
```

```rust [Rust]
use std::collections::HashMap;

pub struct LRUCache {
    capacity: usize,
    order: Vec<String>,
    map: HashMap<String, String>,
}

impl LRUCache {
    pub fn new(capacity: usize) -> Self {
        LRUCache { capacity, order: Vec::new(), map: HashMap::new() }
    }

    pub fn get(&mut self, key: &str) -> Option<&str> {
        if !self.map.contains_key(key) { return None; }
        self.order.retain(|k| k != key);
        self.order.push(key.to_string());
        self.map.get(key).map(|v| v.as_str())
    }

    pub fn put(&mut self, key: &str, value: &str) {
        self.order.retain(|k| k != key);
        self.order.push(key.to_string());
        self.map.insert(key.to_string(), value.to_string());
        if self.map.len() > self.capacity {
            if let Some(oldest) = self.order.first().cloned() {
                self.order.remove(0);
                self.map.remove(&oldest);
            }
        }
    }
}
```

```go [Go]
type entry struct {
	key   string
	value any
}

type LRUCache struct {
	capacity int
	ll       *list.List
	cache    map[string]*list.Element
}

func NewLRUCache(capacity int) *LRUCache {
	return &LRUCache{capacity: capacity, ll: list.New(), cache: make(map[string]*list.Element)}
}

func (c *LRUCache) Get(key string) (any, bool) {
	if ele, ok := c.cache[key]; ok {
		c.ll.MoveToFront(ele)
		return ele.Value.(*entry).value, true
	}
	return nil, false
}

func (c *LRUCache) Put(key string, value any) {
	if ele, ok := c.cache[key]; ok {
		c.ll.MoveToFront(ele)
		ele.Value.(*entry).value = value
		return
	}
	ele := c.ll.PushFront(&entry{key, value})
	c.cache[key] = ele
	if c.ll.Len() > c.capacity {
		oldest := c.ll.Back()
		c.ll.Remove(oldest)
		delete(c.cache, oldest.Value.(*entry).key)
	}
}
```

```python [Python]
from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache: OrderedDict[str, object] = OrderedDict()

    def get(self, key: str):
        if key not in self.cache:
            return None
        self.cache.move_to_end(key)
        return self.cache[key]

    def put(self, key: str, value: object) -> None:
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement an LRU cache with get/put and eviction | `exercises/typescript/lru-cache/01-basic.test.ts` |
| Intermediate | TTL-aware LRU cache with expiry | `exercises/typescript/lru-cache/02-intermediate.test.ts` |

Run exercises: `pnpm test` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/lru_cache.rs` · Go `exercises/go/lru_cache_test.go` · Python `exercises/python/test_lru_cache.py`

## When to Use

- **Database query caching** — cache hot queries, evict cold ones
- **DNS resolution** — cache recent lookups
- **Web browsers** — page/resource cache with bounded memory
- **API response caching** — keep frequently requested responses warm
- **Operating systems** — page cache, dentry cache, inode cache

## When NOT to Use

- **Scan-resistant workloads** — a full table scan evicts all useful entries (use LRU-K or ARC instead)
- **Time-based expiration needed** — LRU evicts by access recency, not age (add TTL layer separately)
- **Frequency matters more** — if popular items get evicted by a burst of unique requests, use LFU
- **Unbounded growth OK** — if memory isn't constrained, a simple hash map is simpler

## More Production Uses

- [Redis](https://github.com/redis/redis) — `maxmemory-policy allkeys-lru` for LRU eviction
- [Guava Cache](https://github.com/google/guava) — `CacheBuilder.maximumSize()` with LRU eviction
- [Python functools](https://github.com/python/cpython) — `@lru_cache` decorator
- [Caffeine](https://github.com/ben-manes/caffeine) — high-performance Java cache (Window TinyLfu, inspired by LRU)

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Free List](/patterns/free-list/) | LRU eviction frees nodes; free lists recycle them without calling the allocator |
| [Flyweight](/patterns/flyweight/) | Both reduce memory — LRU limits cache size, flyweight shares identical objects |
| [Consistent Hashing](/patterns/consistent-hashing/) | Distributed caches use consistent hashing to route keys to the right LRU instance |
| [Tombstone](/patterns/tombstone/) | Tombstones mark deleted cache entries in distributed LRU caches |
| [Bloom Filter](/patterns/bloom-filter/) | Bloom filters pre-check before expensive LRU cache lookups to avoid cache misses |
| [Interning / Symbol Table](/patterns/interning/) | Intern tables can use LRU eviction to bound memory usage |

## Challenge Questions

::: details Q1: LRU cache with capacity 3. Operations: put(A), put(B), put(C), put(D), get(B). What's in the cache?
**Answer:** `{B, D, C}`

After put(A,B,C), cache is full. put(D) evicts A (least recently used). Now `{D, C, B}`. get(B) moves B to front. Final order most→least recent: `B, D, C`.

Key insight: `get()` counts as "use" — it moves the entry to the front, not just returns it.
:::

::: details Q2: You have a web server with an LRU cache for API responses. A bot crawls every page once. What happens?
**Answer:** The bot evicts all your hot cache entries.

Each crawled page is accessed once, pushed to front, and evicts a frequently-used page. After the crawl, your cache is full of pages nobody will request again. This is the **scan resistance** problem — LRU is vulnerable to sequential scans. Solutions: LRU-K (evict only if accessed < K times), ARC (adaptive), or a two-tier cache.
:::

::: details Q3: Why does Redis use "approximated LRU" instead of exact LRU?
**Answer:** Exact LRU requires a doubly linked list per key — that's 2 pointers (16 bytes on 64-bit) per key just for ordering. With millions of keys, that's significant overhead.

Redis instead stores a 24-bit LRU clock per key (3 bytes) and samples N random keys when eviction is needed, evicting the one with the oldest clock. This trades perfect eviction order for O(1) memory overhead per key. In practice, sampling 10 keys gives results very close to exact LRU.
:::

::: details Q4: Can you build an LRU cache in O(1) without a doubly linked list?
**Answer:** Yes — using a language with ordered hash maps. In JavaScript, `Map` preserves insertion order. Delete and re-insert on access to move to "most recent." This is exactly what the TypeScript implementation above does.

In languages without ordered maps (C, Go), you need the classic hash map + doubly linked list approach. Go's `groupcache` does this with `container/list`.
:::
