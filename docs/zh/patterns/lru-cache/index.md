# 模式：LRU 缓存 (LRU Cache)

## 一句话

缓存满时淘汰最近最少使用的条目——用哈希表加双向链表实现 O(1) 的 get 和 put。

## 核心思想

LRU 缓存将哈希表（O(1) 键查找）与双向链表（O(1) 访问顺序跟踪）结合。每次访问时，条目移到前端。缓存超出容量时，最后面（最近最少使用）的条目被淘汰。

```text
  最近访问                                    最久未访问
  ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐
  │  E  │◄──►│  D  │◄──►│  C  │◄──►│  B  │◄──►│  A  │  ← 淘汰这个
  └─────┘    └─────┘    └─────┘    └─────┘    └─────┘

  get("B") → 移动 B 到前端:
  ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐
  │  B  │◄──►│  E  │◄──►│  D  │◄──►│  C  │◄──►│  A  │
  └─────┘    └─────┘    └─────┘    └─────┘    └─────┘
```

| 属性 | 值 |
|------|------|
| get | O(1) — 哈希查找 + 移到前端 |
| put | O(1) — 哈希插入 + 超容量淘汰 |
| 淘汰策略 | 最近最少使用（链表尾部） |
| 空间 | O(capacity) |

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Go groupcache | [lru.go#L23-L104](https://github.com/golang/groupcache/blob/master/lru/lru.go#L23-L104) | `Cache` 结构体（L23-L34），含双向链表 + 哈希表。`Add`（L56-L71）插入/更新并移到前端；`Get`（L74-L83）命中时移到前端；`RemoveOldest`（L96-L104）从尾部淘汰。作者 Brad Fitzpatrick（memcached 创造者）。 |
| Redis | [evict.c#L55-L83](https://github.com/redis/redis/blob/unstable/src/evict.c#L55-L83) | 近似 LRU——缩减位宽的 LRU 时钟和带绕回处理的空闲时间估算。`evictionPoolPopulate`（L134-L225）采样 N 个键插入排序淘汰池。工程权衡：以 O(1) 内存开销换取规模化性能。 |

## 实现

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

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带 get/put 和淘汰的 LRU 缓存 | `exercises/typescript/lru-cache/01-basic.test.ts` |

## 何时使用

- **数据库查询缓存** — 缓存热查询，淘汰冷查询
- **DNS 解析** — 缓存最近的查找结果
- **Web 浏览器** — 有界内存的页面/资源缓存
- **API 响应缓存** — 保持频繁请求的响应温热
- **操作系统** — 页面缓存、dentry 缓存、inode 缓存

## 何时不用

- **抗扫描工作负载** — 全表扫描会淘汰所有有用条目（用 LRU-K 或 ARC 替代）
- **需要基于时间过期** — LRU 按访问时间淘汰，不是按年龄（需单独加 TTL 层）
- **频率更重要** — 如果突发的唯一请求淘汰了热门条目，用 LFU
- **可以无限增长** — 如果内存不受限，简单哈希表更简单

## 更多生产案例

- [Redis](https://github.com/redis/redis) — `maxmemory-policy allkeys-lru` LRU 淘汰
- [Guava Cache](https://github.com/google/guava) — `CacheBuilder.maximumSize()` LRU 淘汰
- [Python functools](https://github.com/python/cpython) — `@lru_cache` 装饰器
- [Caffeine](https://github.com/ben-manes/caffeine) — 高性能 Java 缓存（Window TinyLfu）

## 挑战题

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
