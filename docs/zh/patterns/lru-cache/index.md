---
description: "缓存满时淘汰最近最少使用的条目——用哈希表加双向链表实现 O(1) 的 get 和 put。"
difficulty: "intermediate"
---

# 模式：LRU 缓存 (LRU Cache)

<DifficultyBadge />

## 一句话

缓存满时淘汰最近最少使用的条目——用哈希表加双向链表实现 O(1) 的 get 和 put。

<DemoBadge />

## 现实类比

一张空间有限的办公桌。你把最近用过的书放在桌上。需要腾地方放新书时，把最久没碰过的那本放回书架。

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

**动手试试** — 执行 put 和 get 操作，观察 LRU 淘汰机制如何工作：

<LRUCacheViz />

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
| 进阶 | 带 TTL 过期的 LRU 缓存 | `exercises/typescript/lru-cache/02-intermediate.test.ts` |

运行练习：`pnpm test`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

练习文件： Rust `exercises/rust/src/lru_cache.rs` · Go `exercises/go/lru_cache_test.go` · Python `exercises/python/test_lru_cache.py`

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

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [空闲链表 (Free List)](/zh/patterns/free-list/) | LRU 淘汰释放节点；空闲链表回收它们而无需调用分配器 |
| [享元 / 驻留 (Flyweight / Interning)](/zh/patterns/flyweight/) | 两者都减少内存——LRU 限制缓存大小，享元共享相同对象 |
| [一致性哈希 (Consistent Hashing)](/zh/patterns/consistent-hashing/) | 分布式缓存使用一致性哈希将键路由到正确的 LRU 实例 |
| [墓碑 / 延迟删除 (Tombstone)](/zh/patterns/tombstone/) | 墓碑在分布式 LRU 缓存中标记已删除的条目 |
| [布隆过滤器 (Bloom Filter)](/zh/patterns/bloom-filter/) | 布隆过滤器在昂贵的 LRU 缓存查找前做预检查以避免缓存未命中 |
| [驻留 / 符号表 (Interning)](/zh/patterns/interning/) | 驻留表可以使用 LRU 淘汰来限制内存使用 |

## 挑战题

::: details Q1: 容量为 3 的 LRU 缓存。操作：put(A), put(B), put(C), put(D), get(B)。缓存中有什么？
**答案：** `{B, D, C}`

put(A,B,C) 后缓存满了。put(D) 淘汰 A（最近最少使用）。现在是 `{D, C, B}`。get(B) 将 B 移到最前。最终从最近到最久的顺序：`B, D, C`。

关键洞察：`get()` 也算作"使用"——它将条目移到最前，而不仅仅是返回它。
:::

::: details Q2: 你的 Web 服务器使用 LRU 缓存存储 API 响应。一个爬虫访问了每个页面一次。会发生什么？
**答案：** 爬虫会淘汰你所有的热缓存条目。

每个被爬取的页面只访问一次，推到前面，并淘汰一个频繁使用的页面。爬取结束后，你的缓存里全是没人会再请求的页面。这就是**抗扫描性**问题——LRU 容易受到顺序扫描的影响。解决方案：LRU-K（只有访问次数 < K 次才淘汰）、ARC（自适应）或双层缓存。
:::

::: details Q3: 为什么 Redis 使用"近似 LRU"而不是精确 LRU？
**答案：** 精确 LRU 需要每个键维护一个双向链表——在 64 位系统上仅排序就需要 2 个指针（每键 16 字节）。数百万个键时，这是很大的开销。

Redis 改为每个键存储一个 24 位 LRU 时钟（3 字节），在需要淘汰时随机采样 N 个键，淘汰时钟最旧的那个。这用完美的淘汰顺序换取每键 O(1) 的内存开销。实际中，采样 10 个键的结果与精确 LRU 非常接近。
:::

::: details Q4: 你能在 O(1) 时间内构建一个不用双向链表的 LRU 缓存吗？
**答案：** 可以——使用有序哈希表的语言。在 JavaScript 中，`Map` 保持插入顺序。在访问时先删除再重新插入即可移到"最近使用"位置。这正是上面 TypeScript 实现的做法。

在没有有序 map 的语言（C、Go）中，你需要经典的哈希表 + 双向链表方法。Go 的 `groupcache` 使用 `container/list` 来实现这一点。
:::
