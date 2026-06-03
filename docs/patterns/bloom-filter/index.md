# Pattern: Bloom Filter

## One Liner

Test set membership in O(k) time with zero false negatives — at the cost of a tunable false positive rate.

## Core Idea

A bloom filter is a space-efficient probabilistic data structure. It uses a bit array of size `m` and `k` independent hash functions. To **add** an element, hash it `k` times and set those bit positions. To **test**, hash it `k` times and check if all positions are set.

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

| Property | Value |
|----------|-------|
| False negatives | **Impossible** — added elements always test positive |
| False positives | **Possible** — non-added elements may test positive |
| False positive rate | ≈ `(1 - e^(-kn/m))^k` where `n` = elements inserted |
| Deletion | **Not supported** — clearing bits may affect other elements |

**Try it yourself** — add items and test membership to see false positives in action:

<BloomFilterViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| LevelDB | [bloom.cc#L17-L80](https://github.com/google/leveldb/blob/main/util/bloom.cc#L17-L80) | `BloomFilterPolicy` — uses double-hashing (Kirsch-Mitzenmacher) with rotate-right-17 to set `k` bits per key. `KeyMayMatch` returns false immediately if any probed bit is zero. Avoids disk reads for keys that don't exist. |
| Chromium (Blink) | [selector_filter.h#L149-L175](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/css/selector_filter.h#L149-L175) | 8192-bit bloom filter for CSS ancestor selector fast-rejection — discards 60-70% of CSS rules without full matching. Uses salted hashing (tag/id/class/attr) to prevent cross-type collisions. |

## Implementation

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

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a bloom filter with add/mightContain | `exercises/typescript/bloom-filter/01-basic.test.ts` |
| Intermediate | Spell checker using a bloom filter dictionary | `exercises/typescript/bloom-filter/02-intermediate.test.ts` |

Run exercises: `pnpm test`

## When to Use

- **Database key lookup** — skip disk reads for keys that definitely don't exist (LevelDB, Cassandra, HBase)
- **Web caching** — avoid caching one-hit-wonders by checking if a URL was seen before
- **Network security** — check if a URL is in a malicious list without storing all URLs
- **Spell checkers** — fast "definitely not a word" rejection before dictionary lookup
- **Distributed systems** — reduce inter-node communication by filtering locally first

## When NOT to Use

- **Need deletion** — standard bloom filters don't support removal (use counting bloom filters instead)
- **Need exact membership** — if false positives are unacceptable, use a hash set
- **Small sets** — for < 1000 elements, a hash set uses comparable memory with zero false positives
- **Need to enumerate elements** — bloom filters only answer "is X in the set?", not "what's in the set?"

## More Production Uses

- [PostgreSQL](https://github.com/postgres/postgres/blob/master/contrib/bloom/blutils.c#L265-L293) — bloom index for multi-column filtering
- [Apache Cassandra](https://github.com/apache/cassandra) — SSTable bloom filters to avoid disk reads
- [bits-and-blooms/bloom](https://github.com/bits-and-blooms/bloom/blob/master/bloom.go#L77-L81) — popular Go bloom filter library (7k+ stars)
- [Bitcoin](https://github.com/bitcoin/bitcoin) — SPV bloom filters for lightweight clients

## Challenge Questions

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
