# 模式：一致性哈希 (Consistent Hashing)

## 一句话

将键分布到虚拟环上的节点，添加或移除节点时只重映射约 1/n 的键。

## 核心思想

传统模哈希（`hash(key) % n`）在 `n` 变化时几乎重映射所有键。一致性哈希将节点和键都放在循环环上。每个键映射到其位置顺时针方向的第一个节点。添加或移除节点只影响它和前驱之间弧段的键。

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

| 属性 | 值 |
|------|------|
| 添加/移除时键重映射 | 约 1/n（模哈希为 100%） |
| 虚拟节点（副本） | 改善均衡性——每个物理节点映射到环上 k 个位置 |
| 查找 | O(log n)，在排序环上二分搜索 |

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
