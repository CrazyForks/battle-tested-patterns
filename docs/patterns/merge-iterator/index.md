---
title: "Pattern: Merge Iterator (K-Way Merge)"
description: 'Combine K sorted streams into one sorted output using a min-heap — the universal "unified view" over multiple data sources.'
difficulty: "advanced"
---

# Pattern: Merge Iterator (K-Way Merge)

<DifficultyBadge />

## One Liner

Combine K sorted streams into one sorted output using a min-heap — the universal "unified view" over multiple data sources.

<DemoBadge />

## Real-World Analogy

Merging sorted stacks of exam papers from different classrooms. You look at the top paper of each stack, pick the one with the lowest student number, place it in the merged pile, and repeat. You only ever compare the top papers.

## Core Idea

A merge iterator maintains a min-heap of size K, where each entry tracks the current element and which stream it came from. On each `next()` call, it pops the smallest element, advances that stream, and pushes the next element from that stream back into the heap. This produces a globally sorted output in O(n log K) time, where n is the total number of elements.

```text
  Stream 0: [1, 5, 9]
  Stream 1: [2, 6, 7]
  Stream 2: [3, 4, 8]

  Min-Heap (tracks smallest from each stream):
  ┌─────────────────────────┐
  │  pop min → push next    │
  │  ┌───┐                  │
  │  │ 1 │ ← Stream 0      │
  │  ├───┤                  │
  │  │ 2 │ ← Stream 1      │
  │  ├───┤                  │
  │  │ 3 │ ← Stream 2      │
  │  └───┘                  │
  └─────────────────────────┘

  Output: 1, 2, 3, 4, 5, 6, 7, 8, 9
```

| Property | Value |
|----------|-------|
| Time complexity | O(n log K) for n total elements, K streams |
| Space complexity | O(K) for the heap |
| Stream requirement | Each input stream must be sorted |
| Output guarantee | Globally sorted, stable within equal keys |

**Try it yourself** — add sorted streams and merge them into one globally sorted output:

<MergeIteratorViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| LevelDB | [merger.cc#L17-L100](https://github.com/google/leveldb/blob/7ee830d02b623e8ffe0b95d59a74db1e58da04c5/table/merger.cc#L17-L100) | `MergingIterator` merges multiple sorted table iterators (memtable + multiple SSTable levels) into a single sorted view. `FindSmallest()` (L84-L100) scans children to find the iterator with the smallest current key. This is the core read path of LevelDB — every `Get()` and `Seek()` goes through this merger to present a unified view of data spread across multiple files and memory. |
| RocksDB | [merge_helper.cc#L87-L156](https://github.com/facebook/rocksdb/blob/7affaee1c49ebc80cb213ad86fe7d2a3ad447da2/db/merge_helper.cc#L87-L156) | `TimedFullMerge` implements the merge operator that combines multiple versions of the same key. During compaction, `MergeHelper::MergeUntil` walks through an iterator of sorted entries, merging values for duplicate keys. This is how RocksDB supports user-defined merge operations (e.g., append, increment) efficiently during compaction. |

## Implementation

::: code-group

```typescript [TypeScript]
class MinHeap<T> {
  private data: T[] = [];
  constructor(private compare: (a: T, b: T) => number) {}

  push(val: T): void {
    this.data.push(val);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0]!;
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  get size(): number { return this.data.length; }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.data[i]!, this.data[parent]!) >= 0) break;
      [this.data[i], this.data[parent]] = [this.data[parent]!, this.data[i]!];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.compare(this.data[left]!, this.data[smallest]!) < 0) smallest = left;
      if (right < n && this.compare(this.data[right]!, this.data[smallest]!) < 0) smallest = right;
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest]!, this.data[i]!];
      i = smallest;
    }
  }
}

function mergeKSorted(streams: number[][]): number[] {
  const heap = new MinHeap<{ val: number; stream: number; index: number }>(
    (a, b) => a.val - b.val,
  );

  for (let s = 0; s < streams.length; s++) {
    if (streams[s]!.length > 0) {
      heap.push({ val: streams[s]![0]!, stream: s, index: 0 });
    }
  }

  const result: number[] = [];
  while (heap.size > 0) {
    const { val, stream, index } = heap.pop()!;
    result.push(val);
    const nextIndex = index + 1;
    if (nextIndex < streams[stream]!.length) {
      heap.push({ val: streams[stream]![nextIndex]!, stream, index: nextIndex });
    }
  }
  return result;
}
```

```rust [Rust]
use std::collections::BinaryHeap;
use std::cmp::Reverse;

pub fn merge_k_sorted(streams: &[Vec<i32>]) -> Vec<i32> {
    // (value, stream_index, element_index)
    let mut heap: BinaryHeap<Reverse<(i32, usize, usize)>> = BinaryHeap::new();

    for (s, stream) in streams.iter().enumerate() {
        if !stream.is_empty() {
            heap.push(Reverse((stream[0], s, 0)));
        }
    }

    let mut result = Vec::new();
    while let Some(Reverse((val, stream_idx, elem_idx))) = heap.pop() {
        result.push(val);
        let next_idx = elem_idx + 1;
        if next_idx < streams[stream_idx].len() {
            heap.push(Reverse((streams[stream_idx][next_idx], stream_idx, next_idx)));
        }
    }
    result
}
```

```go [Go]
package mergeiter

type heapEntry struct {
	val    int
	stream int
	index  int
}

type minHeap struct {
	data []heapEntry
}

func (h *minHeap) Len() int            { return len(h.data) }
func (h *minHeap) Less(i, j int) bool  { return h.data[i].val < h.data[j].val }
func (h *minHeap) Swap(i, j int)       { h.data[i], h.data[j] = h.data[j], h.data[i] }
func (h *minHeap) Push(x heapEntry)    { h.data = append(h.data, x); h.bubbleUp(len(h.data) - 1) }

func (h *minHeap) Pop() heapEntry {
	top := h.data[0]
	last := h.data[len(h.data)-1]
	h.data = h.data[:len(h.data)-1]
	if len(h.data) > 0 {
		h.data[0] = last
		h.sinkDown(0)
	}
	return top
}

func (h *minHeap) bubbleUp(i int) {
	for i > 0 {
		parent := (i - 1) / 2
		if h.data[i].val >= h.data[parent].val {
			break
		}
		h.data[i], h.data[parent] = h.data[parent], h.data[i]
		i = parent
	}
}

func (h *minHeap) sinkDown(i int) {
	n := len(h.data)
	for {
		smallest := i
		left, right := 2*i+1, 2*i+2
		if left < n && h.data[left].val < h.data[smallest].val {
			smallest = left
		}
		if right < n && h.data[right].val < h.data[smallest].val {
			smallest = right
		}
		if smallest == i {
			break
		}
		h.data[i], h.data[smallest] = h.data[smallest], h.data[i]
		i = smallest
	}
}

func MergeKSorted(streams [][]int) []int {
	h := &minHeap{}
	for s, stream := range streams {
		if len(stream) > 0 {
			h.Push(heapEntry{val: stream[0], stream: s, index: 0})
		}
	}

	var result []int
	for h.Len() > 0 {
		entry := h.Pop()
		result = append(result, entry.val)
		nextIdx := entry.index + 1
		if nextIdx < len(streams[entry.stream]) {
			h.Push(heapEntry{val: streams[entry.stream][nextIdx], stream: entry.stream, index: nextIdx})
		}
	}
	return result
}
```

```python [Python]
import heapq

def merge_k_sorted(streams: list[list[int]]) -> list[int]:
    heap: list[tuple[int, int, int]] = []  # (value, stream_idx, element_idx)

    for s, stream in enumerate(streams):
        if stream:
            heapq.heappush(heap, (stream[0], s, 0))

    result: list[int] = []
    while heap:
        val, stream_idx, elem_idx = heapq.heappop(heap)
        result.append(val)
        next_idx = elem_idx + 1
        if next_idx < len(streams[stream_idx]):
            heapq.heappush(heap, (streams[stream_idx][next_idx], stream_idx, next_idx))

    return result
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Merge K sorted arrays into one sorted array | `exercises/typescript/merge-iterator/01-basic.test.ts` |
| Intermediate | Merge with deduplication (latest-wins by key) | `exercises/typescript/merge-iterator/02-intermediate.test.ts` |

Run exercises: `pnpm test:ts` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/merge_iterator/mod.rs` · Go `exercises/go/merge_iterator/merge_iterator_test.go` · Python `exercises/python/merge_iterator/test_merge_iterator.py`

## When to Use

- **LSM-tree reads** — merge memtable + multiple SSTable levels into one sorted view (LevelDB, RocksDB)
- **External sorting** — merge sorted runs that don't fit in memory
- **Log aggregation** — combine time-sorted logs from multiple services
- **Database joins** — merge-join of pre-sorted tables
- **Search engines** — merge posting lists from multiple index segments

## When NOT to Use

- **Unsorted inputs** — K-way merge requires pre-sorted streams; sort first or use a different approach
- **K = 2** — simple two-pointer merge is simpler and avoids heap overhead
- **Random access patterns** — merge iterators are for sequential scans, not point lookups
- **Very large K with tiny streams** — heap overhead dominates when streams are very short

## More Production Uses

- [TiKV](https://github.com/tikv/tikv) — merge iterator over multiple RocksDB column families
- [Apache Lucene](https://github.com/apache/lucene) — merge segments during index optimization
- [ClickHouse](https://github.com/ClickHouse/ClickHouse) — MergingSortedTransform for merging sorted data parts
- [CockroachDB](https://github.com/cockroachdb/cockroach) — merge joins and range scan across multiple ranges

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Min Heap](/patterns/min-heap/) | The min-heap is the core data structure powering K-way merge |
| [LSM Tree (Log-Structured Merge Tree)](/patterns/lsm-tree/) | LSM compaction merges multiple sorted SSTables using merge iterators |
| [Iterator](/patterns/iterator/) | Merge iterator is a composition of the iterator pattern across multiple sources |
| [Skip List](/patterns/skip-list/) | Skip lists provide the sorted input streams that merge iterators consume |
| [B+ Tree](/patterns/b-plus-tree/) | Merge iterators combine sorted ranges from multiple B+ tree leaf scans |

## Challenge Questions

::: details Q1: You're merging 100 sorted streams, each with 1 million elements. What's the total number of heap operations, and why is this better than sorting all 100 million elements?
**Answer:** About 200 million heap operations (each element is pushed and popped once), each costing O(log 100) ~ 7 comparisons. Total: ~1.4 billion comparisons. Sorting 100M elements with merge sort: O(100M × log(100M)) ~ 100M × 27 ~ 2.7 billion comparisons. K-way merge is roughly 2x faster.

The key advantage isn't just fewer comparisons — it's the streaming nature. K-way merge uses O(K) memory regardless of total data size. You can merge terabytes of sorted data from disk using only a few KB of heap space. Full sorting would require loading everything into memory or implementing multi-pass external sort, which is essentially K-way merge anyway.
:::

::: details Q2: LevelDB's MergingIterator uses a linear scan (FindSmallest) instead of a heap to find the minimum. When is this actually faster than a heap?
**Answer:** When K is small (typically K < 10). Linear scan over K elements costs O(K) comparisons per next() but has better cache locality and no pointer chasing. A heap costs O(log K) but has worse constant factors.

LevelDB typically merges 2-7 levels, so K is very small. At K=4, linear scan does 4 comparisons per next() vs. ~2 for a heap, but avoids heap bookkeeping and has better branch prediction. For large K (hundreds of streams, like in external sort), a heap is clearly better. This is a classic micro-optimization where knowing your typical K matters more than asymptotic complexity.
:::

::: details Q3: Your merge iterator is combining streams from different database shards. Two shards return the same key "user:123" but with different values and timestamps. How should the merger handle this?
**Answer:** Use the timestamp as a tiebreaker: when keys are equal, the entry with the latest timestamp wins. Pop all entries with the same key, keep only the newest.

This is the "latest-wins" deduplication strategy used by LSM trees. During merge, when you encounter duplicate keys, you compare sequence numbers or timestamps and keep only the most recent value. In LevelDB, newer entries (higher sequence numbers) shadow older ones. This must be done during the merge — not after — because you need to know which stream each entry came from to determine recency.
:::

::: details Q4: You're using a merge iterator for real-time log aggregation from 50 microservices. Each service produces ~1000 events/second. The merge output suddenly falls behind. What's happening?
**Answer:** One slow/stalled stream is blocking the merge. The heap can't emit any element larger than the smallest current element across all streams, so if one stream stops producing, the merge stalls waiting for it.

This is the "straggler problem" in streaming merges. Solutions: (1) set a timeout per stream — if no data arrives within T ms, skip that stream temporarily; (2) use watermarks — emit all events below a certain timestamp even if some streams haven't reported; (3) buffer and re-sort in windows rather than strict global ordering. Apache Flink and Google Dataflow use watermark-based approaches for exactly this reason.
:::
