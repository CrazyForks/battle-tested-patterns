# 模式：布隆过滤器 (Bloom Filter)

## 一句话

以 O(k) 时间测试集合成员资格，零漏判——代价是可调的误判率。

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
  test("apple") → all set       → "maybe yes"
  test("grape") → bit 7 not set → "definitely no"
```

| 属性 | 值 |
|------|------|
| 漏判 (False Negative) | **不可能** — 已添加的元素一定测试为正 |
| 误判 (False Positive) | **可能** — 未添加的元素可能测试为正 |
| 误判率 | ≈ `(1 - e^(-kn/m))^k`，其中 `n` = 已插入元素数 |
| 删除 | **不支持** — 清除位可能影响其他元素 |

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

## 挑战题

::: details Q1: You deploy a bloom filter with m=1000 bits and k=3 hashes to check URL membership. After inserting 800 URLs, your false positive rate is unacceptably high. You expected around 1%. What went wrong?
**Answer:** The bit array is oversaturated — 800 items in 1000 bits means most bits are set to 1, making almost any query return "maybe yes."

The false positive rate formula `(1 - e^(-kn/m))^k` shows that with k=3, n=800, m=1000, approximately 91% of bits are set, giving a ~75% false positive rate. The fix is to increase m. For a 1% false positive rate with n=800 and k=3, you need roughly m=11,500 bits (about 1.4 KB). The rule of thumb is ~10 bits per element for a 1% false positive rate.
:::

::: details Q2: Your colleague proposes deleting items from a bloom filter by clearing the bits that were set during insertion. Why does this break the data structure?
**Answer:** Clearing bits for one item can destroy membership evidence for other items whose hashes mapped to the same bit positions.

In a bloom filter, multiple items share bits. If "apple" and "banana" both hash to bit position 5, clearing bit 5 when removing "apple" creates a false negative for "banana" — violating the bloom filter's fundamental guarantee of zero false negatives. Counting bloom filters solve this by storing counters instead of single bits, decrementing on delete and only clearing when the counter reaches zero.
:::

::: details Q3: Your system has two bloom filters — one built from server A's dataset and another from server B's dataset. A query needs to check "was this key seen by either server?" Can you answer this without querying both filters separately?
**Answer:** Yes. Bitwise OR the two bit arrays together to create a union filter that answers "seen by A or B" in a single query.

This works because a bloom filter's membership test is purely a function of which bits are set. ORing the arrays produces a filter where a bit is set if it was set in either A or B, which is exactly the union semantics. The resulting filter has a higher false positive rate (more bits are set), but zero false negatives are preserved. This property makes bloom filters uniquely composable — you cannot do this with hash sets without transferring all elements.
:::

::: details Q4: LevelDB uses bloom filters to skip disk reads for nonexistent keys. If the bloom filter says "maybe yes" for a key that doesn't actually exist, what is the cost? What if it said "no" for a key that does exist?
**Answer:** A false positive costs one unnecessary disk read (wasted I/O but correct result). A false negative would return "key not found" for an existing key — silent data loss.

This asymmetry is why bloom filters guarantee zero false negatives. A false positive just means "we checked the disk and the key wasn't there" — the system self-corrects at the cost of one extra I/O. But if a bloom filter could produce false negatives, the database would skip the disk read entirely and incorrectly report the key as missing. That's data corruption, not a performance issue. The entire value of bloom filters in databases depends on this one-sided error guarantee.
:::
