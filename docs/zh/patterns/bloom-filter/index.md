---
description: "以 O(k) 时间测试集合成员资格，零漏判——代价是可调的误判率。"
difficulty: "intermediate"
---

# 模式：布隆过滤器 (Bloom Filter)

<DifficultyBadge />

## 一句话

以 O(k) 时间测试集合成员资格，零漏判——代价是可调的误判率。

<DemoBadge />

## 现实类比

一个记性不太好的门卫。如果门卫说「你肯定不在名单上」，那就一定不在。但如果他说「你可能在」，你还得进去查真正的登记册才能确认。

## 核心思想

布隆过滤器是一种空间高效的概率数据结构。它使用大小为 `m` 的位数组和 `k` 个独立哈希函数。**添加**元素时，哈希 `k` 次并设置对应位。**测试**时，哈希 `k` 次并检查所有位是否都被设置。

```text
  hash1=2         hash2=5               hash3=9
     │               │                     │
     ▼               ▼                     ▼
  ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐
  │ 0│ 0│ 1│ 0│ 0│ 1│ 0│ 0│ 0│ 1│ 0│ 0│  m=12
  └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘
    0  1  2  3  4  5  6  7  8  9 10 11

  add("apple")  → set bits 2, 5, 9
  test("apple") → all set     → "maybe yes"
  test("grape") → bit 7 not set → "definitely no"
```

| 属性 | 值 |
|------|------|
| 漏判 (False Negative) | **不可能** — 已添加的元素一定测试为正 |
| 误判 (False Positive) | **可能** — 未添加的元素可能测试为正 |
| 误判率 | ≈ `(1 - e^(-kn/m))^k`，其中 `n` = 已插入元素数 |
| 删除 | **不支持** — 清除位可能影响其他元素 |

**动手试试** — 添加元素并测试成员关系，亲眼看看误判 (false positive) 是如何发生的：

<BloomFilterViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| LevelDB | [bloom.cc#L17-L80](https://github.com/google/leveldb/blob/main/util/bloom.cc#L17-L80) | `BloomFilterPolicy` — 使用双重哈希（Kirsch-Mitzenmacher）和旋转右移17位设置每个 key 的 `k` 个位。`KeyMayMatch` 在任一探测位为零时立即返回 false，避免对不存在的 key 进行磁盘读取。 |
| Chromium (Blink) | [selector_filter.h#L149-L175](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/css/selector_filter.h#L149-L175) | 8192 位布隆过滤器用于 CSS 祖先选择器快速拒绝——无需完整匹配即可淘汰 60-70% 的 CSS 规则。使用加盐哈希（标签/id/class/属性）防止跨类型碰撞。 |

## 实现

::: code-group

```typescript [TypeScript]
class BloomFilter {
  private bits: Uint8Array;
  private size: number;
  private hashCount: number;

  constructor(size: number, hashCount = 3) {
    this.size = size;
    this.hashCount = hashCount;
    this.bits = new Uint8Array(size);
  }

  private hashes(item: string): number[] {
    let h1 = 0;
    let h2 = 0;
    for (let i = 0; i < item.length; i++) {
      h1 = (h1 * 31 + item.charCodeAt(i)) | 0;
      h2 = (h2 * 37 + item.charCodeAt(i)) | 0;
    }
    const result: number[] = [];
    for (let i = 0; i < this.hashCount; i++) {
      result.push(((h1 + i * h2) % this.size + this.size) % this.size);
    }
    return result;
  }

  add(item: string): void {
    for (const pos of this.hashes(item)) {
      this.bits[pos] = 1;
    }
  }

  mightContain(item: string): boolean {
    return this.hashes(item).every((pos) => this.bits[pos] === 1);
  }
}
```

```rust [Rust]
pub struct BloomFilter {
    bits: Vec<bool>,
    size: usize,
    hash_count: usize,
}

impl BloomFilter {
    pub fn new(size: usize, hash_count: usize) -> Self {
        BloomFilter { bits: vec![false; size], size, hash_count }
    }

    fn hashes(&self, item: &str) -> Vec<usize> {
        let mut h1: i32 = 0;
        let mut h2: i32 = 0;
        for b in item.bytes() {
            h1 = h1.wrapping_mul(31).wrapping_add(b as i32);
            h2 = h2.wrapping_mul(37).wrapping_add(b as i32);
        }
        (0..self.hash_count)
            .map(|i| ((h1.wrapping_add((i as i32).wrapping_mul(h2))) as usize) % self.size)
            .collect()
    }

    pub fn add(&mut self, item: &str) {
        for pos in self.hashes(item) {
            self.bits[pos] = true;
        }
    }

    pub fn might_contain(&self, item: &str) -> bool {
        self.hashes(item).iter().all(|&pos| self.bits[pos])
    }
}
```

```go [Go]
type BloomFilter struct {
	bits      []bool
	size      int
	hashCount int
}

func NewBloomFilter(size, hashCount int) *BloomFilter {
	return &BloomFilter{bits: make([]bool, size), size: size, hashCount: hashCount}
}

func (bf *BloomFilter) hashes(item string) []int {
	h1, h2 := 0, 0
	for _, b := range []byte(item) {
		h1 = h1*31 + int(b)
		h2 = h2*37 + int(b)
	}
	result := make([]int, bf.hashCount)
	for i := range result {
		result[i] = ((h1 + i*h2) % bf.size + bf.size) % bf.size
	}
	return result
}

func (bf *BloomFilter) Add(item string) {
	for _, pos := range bf.hashes(item) {
		bf.bits[pos] = true
	}
}

func (bf *BloomFilter) MightContain(item string) bool {
	for _, pos := range bf.hashes(item) {
		if !bf.bits[pos] {
			return false
		}
	}
	return true
}
```

```python [Python]
class BloomFilter:
    def __init__(self, size: int, hash_count: int = 3):
        self.size = size
        self.hash_count = hash_count
        self.bits = [False] * size

    def _hashes(self, item: str) -> list[int]:
        h1, h2 = 0, 0
        for ch in item:
            h1 = (h1 * 31 + ord(ch)) & 0xFFFFFFFF
            h2 = (h2 * 37 + ord(ch)) & 0xFFFFFFFF
        return [(h1 + i * h2) % self.size for i in range(self.hash_count)]

    def add(self, item: str) -> None:
        for pos in self._hashes(item):
            self.bits[pos] = True

    def might_contain(self, item: str) -> bool:
        return all(self.bits[pos] for pos in self._hashes(item))
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带 add/mightContain 的布隆过滤器 | `exercises/typescript/bloom-filter/01-basic.test.ts` |
| 进阶 | 使用布隆过滤器字典的拼写检查器 | `exercises/typescript/bloom-filter/02-intermediate.test.ts` |

运行练习：`pnpm test`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

练习文件： Rust `exercises/rust/src/bloom_filter.rs` · Go `exercises/go/bloom_filter_test.go` · Python `exercises/python/test_bloom_filter.py`

## 何时使用

- **数据库键查找** — 跳过对一定不存在的键的磁盘读取（LevelDB、Cassandra、HBase）
- **Web 缓存** — 检查 URL 是否曾被访问，避免缓存一次性请求
- **网络安全** — 无需存储全部 URL 即可检查恶意列表
- **拼写检查** — 在字典查找前快速拒绝"绝对不是单词"的输入
- **分布式系统** — 先本地过滤，减少节点间通信

## 何时不用

- **需要删除** — 标准布隆过滤器不支持删除（用计数布隆过滤器替代）
- **需要精确判断** — 如果误判不可接受，用哈希集合
- **小集合** — 少于 1000 个元素时，哈希集合占用内存相当但零误判
- **需要遍历元素** — 布隆过滤器只能回答"X 是否在集合中？"，不能回答"集合里有什么？"

## 更多生产案例

- [PostgreSQL](https://github.com/postgres/postgres/blob/master/contrib/bloom/blutils.c#L265-L293) — bloom 索引用于多列过滤
- [Apache Cassandra](https://github.com/apache/cassandra) — SSTable 布隆过滤器避免磁盘读取
- [bits-and-blooms/bloom](https://github.com/bits-and-blooms/bloom/blob/master/bloom.go#L77-L81) — 流行的 Go 布隆过滤器库（7k+ stars）
- [Bitcoin](https://github.com/bitcoin/bitcoin) — 轻量客户端的 SPV 布隆过滤器

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [LSM 树 (Log-Structured Merge Tree)](/zh/patterns/lsm-tree/) | LSM 树为每个 SSTable 附加布隆过滤器以避免不必要的磁盘读取 |
| [Trie 前缀树 (Trie / Prefix Tree)](/zh/patterns/trie/) | 布隆过滤器在昂贵的 Trie 遍历前做预筛选 |
| [LRU 缓存 (LRU Cache)](/zh/patterns/lru-cache/) | 两者都加速查找——布隆过滤器排除否定，LRU 缓存存储肯定 |
| [驻留 / 符号表 (Interning)](/zh/patterns/interning/) | 布隆过滤器可以在昂贵的驻留表查找前做预检查 |
| [跳表 (Skip List)](/zh/patterns/skip-list/) | 布隆过滤器可以减少跳表存储中不必要的磁盘读取 |

## 挑战题

::: details Q1: 你部署了一个 m=1000 位、k=3 个哈希函数的 Bloom Filter 来检查 URL 的成员关系。插入 800 个 URL 后，假阳性率高得无法接受。你预期大约是 1%。出了什么问题？
**答案：** 位数组过度饱和——1000 位中插入 800 个元素意味着大多数位都被设为 1，几乎任何查询都会返回"可能存在"。

假阳性率公式 `(1 - e^(-kn/m))^k` 表明，当 k=3、n=800、m=1000 时，大约 91% 的位被置位，假阳性率约为 75%。修复方法是增大 m。对于 n=800、k=3 的 1% 假阳性率，你需要大约 m=11,500 位（约 1.4 KB）。经验法则是每个元素约 10 位可达到 1% 的假阳性率。
:::

::: details Q2: 你的同事提议通过清除插入时设置的位来从 Bloom Filter 中删除元素。为什么这会破坏数据结构？
**答案：** 清除一个元素的位可能会破坏其他元素的成员关系证据，因为其他元素的哈希也映射到了相同的位位置。

在 Bloom Filter 中，多个元素共享位。如果 "apple" 和 "banana" 都哈希到位位置 5，删除 "apple" 时清除位 5 会导致 "banana" 的假阴性——违反了 Bloom Filter 零假阴性的基本保证。计数 Bloom Filter 通过存储计数器而非单个位来解决这个问题，删除时递减计数器，只在计数器归零时才清除。
:::

::: details Q3: 你的系统有两个 Bloom Filter——一个基于服务器 A 的数据集构建，另一个基于服务器 B 的数据集构建。一个查询需要检查"这个键是否被任一服务器见过？"你能不单独查询两个过滤器就回答这个问题吗？
**答案：** 可以。对两个位数组进行按位 OR 操作，创建一个联合过滤器，可以在单次查询中回答"被 A 或 B 见过"。

这之所以可行，是因为 Bloom Filter 的成员测试纯粹取决于哪些位被设置。对数组进行 OR 运算产生的过滤器中，如果一个位在 A 或 B 中任一被设置，它就是被设置的——这正是并集语义。结果过滤器的假阳性率更高（更多位被设置），但零假阴性的保证不变。这个特性使 Bloom Filter 具有独特的可组合性——你无法在不传输所有元素的情况下对 hash set 做到这一点。
:::

::: details Q4: LevelDB 使用 Bloom Filter 来跳过对不存在的键的磁盘读取。如果 Bloom Filter 对一个实际不存在的键说"可能存在"，代价是什么？如果它对一个确实存在的键说"不存在"呢？
**答案：** 假阳性的代价是一次不必要的磁盘读取（浪费了 I/O 但结果正确）。假阴性则会对一个存在的键返回"键未找到"——这是无声的数据丢失。

这种不对称性正是 Bloom Filter 保证零假阴性的原因。假阳性只是意味着"我们检查了磁盘但键不在那里"——系统以一次额外 I/O 的代价自我修正。但如果 Bloom Filter 可能产生假阴性，数据库会完全跳过磁盘读取并错误地报告键不存在。那是数据损坏，而不是性能问题。Bloom Filter 在数据库中的全部价值都依赖于这种单边错误保证。
:::
