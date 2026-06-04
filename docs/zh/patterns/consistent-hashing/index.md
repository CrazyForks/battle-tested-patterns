---
description: "将键分布到虚拟环上的节点，添加或移除节点时只重映射约 1/n 的键。"
---

# 模式：一致性哈希 (Consistent Hashing)

## 一句话

将键分布到虚拟环上的节点，添加或移除节点时只重映射约 1/n 的键。

<DemoBadge />

## 核心思想

传统模哈希（`hash(key) % n`）在 `n` 变化时几乎重映射所有键。一致性哈希将节点和键都放在循环环上。每个键映射到其位置顺时针方向的第一个节点。添加或移除节点只影响它和前驱之间弧段的键。

```text
  Hash ring (0 to 2^32, wraps around):

  0         Node A    ●k1     Node B          ●k2     Node C    2^32→0
  ├───────────┼─────────┼───────┼───────────────┼───────┼─────────┤
              ▲         │       ▲               │       ▲         │
              │         │       │               │       │         │
              │         └───►───┘               └───►───┘         │
              │              ↑                       ↑            │
              │         k1→Node B              k2→Node C          │
              └───────────────────────────────────────────────────┘
                              k3 wraps around → Node A

  ●k1 = key "user:42"     → next node clockwise = Node B
  ●k2 = key "session:99"  → next node clockwise = Node C
  ●k3 = key "order:7" (between Node C and 2^32) → wraps → Node A
```

| 属性 | 值 |
|------|------|
| 添加/移除时键重映射 | 约 1/n（模哈希为 100%） |
| 虚拟节点（副本） | 改善均衡性——每个物理节点映射到环上 k 个位置 |
| 查找 | O(log n)，在排序环上二分搜索 |

**动手试试** — 添加键值，然后增减节点，观察最小化的键重分布：

<ConsistentHashViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Go groupcache | [consistenthash.go#L28-L81](https://github.com/golang/groupcache/blob/master/consistenthash/consistenthash.go#L28-L81) | `Map` 结构体（L28-L33）含排序键和 hashMap。`Add`（L53-L62）插入虚拟节点。`Get`（L65-L81）用 `sort.Search` 二分搜索找最近顺时针节点。作者 Brad Fitzpatrick（memcached 创造者）。 |
| HAProxy | [lb_chash.c#L415-L491](https://github.com/haproxy/haproxy/blob/master/src/lb_chash.c#L415-L491) | `chash_get_server_hash` — 使用弹性二叉树（eb-trees）在一致性哈希环上找最近服务器，O(log n) 查找。支持有界负载均衡和服务器可用性检查。 |

## 实现

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

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带 addNode/getNode 的哈希环 | `exercises/typescript/consistent-hashing/01-basic.test.ts` |
| 进阶 | 带虚拟节点的一致性哈希环 | `exercises/typescript/consistent-hashing/02-intermediate.test.ts` |

运行练习：`pnpm test`

## 何时使用

- **分布式缓存** — 路由键到缓存服务器，扩缩容时最小化缓存失效
- **负载均衡** — 后端变化时最小扰动分发请求
- **分片数据库** — 将数据分区分配到节点
- **CDN** — 根据 URL 哈希路由内容到边缘服务器

## 何时不用

- **静态拓扑** — 如果节点不会变化，模哈希更简单
- **小集群** — 少于 5 个节点时，随机或轮询可能够用
- **严格排序** — 一致性哈希不保留键的顺序
- **要求均匀分布** — 没有虚拟节点时分布可能不均

## 更多生产案例

- [serialx/hashring](https://github.com/serialx/hashring/blob/master/hashring.go#L31-L37) — Go 哈希环，支持加权节点
- [Apache Cassandra](https://github.com/apache/cassandra) — 分区器使用一致性哈希的 token 环
- [Amazon DynamoDB](https://www.allthingsdistributed.com/2007/10/amazons_dynamo.html) — 一致性哈希在生产中的原始论文
- [Memcached](https://github.com/memcached/memcached) — 客户端一致性哈希（ketama 算法）

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [注册表 / 自注册 (Registry)](/zh/patterns/registry/) | 注册表发现服务；一致性哈希路由到它们 |
| [LRU 缓存 (LRU Cache)](/zh/patterns/lru-cache/) | 分布式 LRU 缓存使用一致性哈希将键路由到正确的节点 |
| [限流器 / 令牌桶 (Rate Limiter)](/zh/patterns/rate-limiter/) | 一致性哈希集群中的节点级限流 |

## 挑战题

::: details Q1: 你有一个包含 3 个物理节点的哈希环，每个节点只有 1 个虚拟节点（没有副本）。一个节点占了 60% 的键空间，其余两个各占 20%。虚拟节点如何解决这个问题？为什么 groupcache 默认使用较高的副本数？
**答案：** 虚拟节点将每个物理节点分散到环上的多个位置，随着虚拟节点数量的增加，分布趋向均匀。

每个节点只有 1 个位置时，节点间的弧长由哈希值决定——本质上是随机的，导致高方差。当每个物理节点有 100-200 个虚拟节点时，大数定律开始起作用，每个物理节点大约拥有环的 1/n。groupcache 默认使用较高的副本数是因为统计均匀性需要大量样本。权衡在于内存：更多虚拟节点意味着更大的排序键数组和环映射。
:::

::: details Q2: 节点 B 崩溃并从 5 节点的环中移除。哪些节点吸收了它的流量？每个剩余节点是否均匀分担负载？
**答案：** 只有环上 B 顺时针方向的下一个节点吸收了 B 的所有键——其他三个节点完全不受影响。

这既是一致性哈希的优势也是其劣势。当 B 被移除时，映射到 B 的键现在"落到"下一个顺时针节点。没有虚拟节点时，一个节点吸收 100% 的重新分配负载，可能使其流量翻倍。有了虚拟节点，B 的多个环位置是分散的，因此它的键会分散到多个后继节点——更接近均匀分配。这是虚拟节点存在的关键原因：它们将"一个邻居吸收全部"的故障转变为"多个邻居分担负载"的故障。
:::

::: details Q3: 你的缓存集群使用一致性哈希。新产品上线导致一个特定键（"homepage_banner"）收到正常请求率 100 倍的流量。一致性哈希将它映射到节点 C，该节点现在过载而其他节点空闲。一致性哈希能解决热点问题吗？
**答案：** 不能。一致性哈希将键均匀分配到节点上，但当单个键的请求率差异巨大时，它无法均匀分配负载。

一致性哈希解决的是键的*分配*问题，而非键的*热度*问题。单个热键总是映射到一个节点。解决方案包括：读副本（在多个节点上缓存热键）、请求级负载均衡（将热键的读取随机路由）或键分片（将 "homepage_banner" 拆分为 "homepage_banner:1" 到 "homepage_banner:10" 分布在多个节点上）。一致性哈希的有界负载扩展通过将溢出流量重定向到环上的下一个节点来解决此问题。
:::

::: details Q4: 你需要将缓存集群从 3 个节点零停机迁移到 5 个节点。迁移期间新旧节点共存。一个被重映射到新节点的键返回缓存未命中，尽管数据还在旧节点上。如何处理？
**答案：** 迁移期间使用双读策略：先在新环上查找键，未命中则回退到旧环。

一致性哈希保证最小重映射（约 1/n 的键移动），但被移动的键在新节点上被填充之前会未命中。迁移策略是：(1) 在新旧两个环上分别计算键的归属节点，(2) 先从新节点读取，(3) 未命中时从旧节点读取并回填到新节点。所有键迁移完成（或 TTL 自然过期）后，移除旧环。Memcached 和 Redis Cluster 在重分片时就采用这种方案——一致性哈希环定义了目标状态，过渡期负责弥合差距。
:::
