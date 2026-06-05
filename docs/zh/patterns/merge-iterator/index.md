---
description: '使用最小堆将 K 个有序流合并为一个有序输出——跨多个数据源创建"统一视图"的通用方法。'
difficulty: "advanced"
---

# 模式：合并迭代器 (Merge Iterator / K-Way Merge)

<DifficultyBadge />

## 一句话

使用最小堆将 K 个有序流合并为一个有序输出——跨多个数据源创建"统一视图"的通用方法。

<DemoBadge />

## 现实类比

合并来自不同教室的已排序试卷。看每一叠最上面那张，挑学号最小的，放入合并堆，重复。你始终只比较各叠的顶部。

## 核心思想

合并迭代器维护一个大小为 K 的最小堆，每个条目跟踪当前元素和它来自哪个流。每次调用 `next()` 时，弹出最小元素，推进该流，并将该流的下一个元素推回堆中。这以 O(n log K) 的时间复杂度产生全局有序输出，其中 n 是元素总数。

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

| 属性 | 值 |
|------|------|
| 时间复杂度 | 总共 n 个元素、K 个流：O(n log K) |
| 空间复杂度 | 堆 O(K) |
| 流的要求 | 每个输入流必须有序 |
| 输出保证 | 全局有序，相同键内稳定 |

**动手试试** — 添加有序流并将它们合并为一个全局有序的输出：

<MergeIteratorViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| LevelDB | [merger.cc#L17-L100](https://github.com/google/leveldb/blob/main/table/merger.cc#L17-L100) | `MergingIterator` 将多个有序表迭代器（memtable + 多个 SSTable 层级）合并为单一有序视图。`FindSmallest()`（L84-L100）扫描子迭代器找到具有最小当前键的迭代器。这是 LevelDB 的核心读取路径——每个 `Get()` 和 `Seek()` 都通过此合并器来呈现分布在多个文件和内存中的数据的统一视图。 |
| RocksDB | [merge_helper.cc#L87-L156](https://github.com/facebook/rocksdb/blob/main/db/merge_helper.cc#L87-L156) | `TimedFullMerge` 实现合并操作符，将同一键的多个版本组合起来。在 compaction 期间，`MergeHelper::MergeUntil` 遍历有序条目的迭代器，合并重复键的值。这就是 RocksDB 在 compaction 期间高效支持用户自定义合并操作（如 append、increment）的方式。 |

## 实现

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

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 将 K 个有序数组合并为一个有序数组 | `exercises/typescript/merge-iterator/01-basic.test.ts` |
| 进阶 | 带去重的合并（按 key 取最新值） | `exercises/typescript/merge-iterator/02-intermediate.test.ts` |

运行练习：`pnpm test`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

练习文件： Rust `exercises/rust/src/merge_iterator.rs` · Go `exercises/go/merge_iterator_test.go` · Python `exercises/python/test_merge_iterator.py`

## 何时使用

- **LSM 树读取** -- 将 memtable + 多个 SSTable 层级合并为一个有序视图（LevelDB、RocksDB）
- **外部排序** -- 合并无法放入内存的有序段
- **日志聚合** -- 合并来自多个服务的按时间排序的日志
- **数据库连接** -- 预排序表的归并连接
- **搜索引擎** -- 合并来自多个索引段的倒排列表

## 何时不用

- **无序输入** -- K 路归并需要预排序的流；先排序或使用其他方法
- **K = 2** -- 简单的双指针归并更简单，避免堆的开销
- **随机访问模式** -- 合并迭代器用于顺序扫描，不适合点查询
- **K 很大但流很短** -- 当流很短时堆的开销占主导

## 更多生产案例

- [TiKV](https://github.com/tikv/tikv) -- 跨多个 RocksDB column family 的合并迭代器
- [Apache Lucene](https://github.com/apache/lucene) -- 索引优化期间合并段
- [ClickHouse](https://github.com/ClickHouse/ClickHouse) -- MergingSortedTransform 用于合并有序数据部分
- [CockroachDB](https://github.com/cockroachdb/cockroach) -- 归并连接和跨多个 range 的范围扫描

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [最小堆 / 优先队列 (Min Heap)](/zh/patterns/min-heap/) | 最小堆是驱动 K 路合并的核心数据结构 |
| [LSM 树 (Log-Structured Merge Tree)](/zh/patterns/lsm-tree/) | LSM 压缩使用合并迭代器合并多个有序 SSTable |
| [迭代器 / 惰性求值 (Iterator)](/zh/patterns/iterator/) | 合并迭代器是迭代器模式在多个源上的组合 |
| [跳表 (Skip List)](/zh/patterns/skip-list/) | 跳表提供合并迭代器消费的有序输入流 |
| [B+ 树 (B+ Tree)](/zh/patterns/b-plus-tree/) | 合并迭代器组合来自多个 B+ 树叶子扫描的有序范围 |

## 挑战题

::: details Q1: 你正在合并 100 个有序流，每个有 100 万个元素。堆操作的总数是多少？为什么这比对所有 1 亿个元素排序更好？
**答案：** 大约 2 亿次堆操作（每个元素各推入和弹出一次），每次代价 O(log 100) ≈ 7 次比较。总计约 14 亿次比较。用归并排序对 1 亿个元素排序：O(1亿 × log(1亿)) ≈ 1亿 × 27 ≈ 27 亿次比较。K 路归并大约快 2 倍。

关键优势不仅仅是更少的比较——而是流式处理的特性。K 路归并使用 O(K) 内存，不受数据总量影响。你可以用几 KB 的堆空间合并 TB 级的有序数据。完全排序需要将所有数据加载到内存中，或实现多遍外部排序——这本质上就是 K 路归并。
:::

::: details Q2: LevelDB 的 MergingIterator 使用线性扫描（FindSmallest）而不是堆来找最小值。什么时候这实际上比堆更快？
**答案：** 当 K 很小时（通常 K < 10）。线性扫描 K 个元素每次 next() 代价 O(K) 次比较，但有更好的缓存局部性且没有指针追踪。堆代价 O(log K) 但常数因子更大。

LevelDB 通常合并 2-7 个层级，所以 K 非常小。在 K=4 时，线性扫描每次 next() 做 4 次比较，堆约 2 次，但避免了堆的簿记开销且有更好的分支预测。对于大 K（数百个流，如外部排序），堆明显更好。这是典型的微优化：了解你的典型 K 值比渐近复杂度更重要。
:::

::: details Q3: 你的合并迭代器正在合并来自不同数据库分片的流。两个分片返回相同的键 "user:123" 但值和时间戳不同。合并器应该如何处理？
**答案：** 使用时间戳作为决胜条件：当键相同时，时间戳最新的条目获胜。弹出所有具有相同键的条目，只保留最新的。

这是 LSM 树使用的"最新获胜"去重策略。在合并期间，当遇到重复键时，比较序列号或时间戳，只保留最新的值。在 LevelDB 中，较新的条目（更高的序列号）遮蔽较旧的。这必须在合并期间完成——而不是之后——因为你需要知道每个条目来自哪个流以确定新旧。
:::

::: details Q4: 你正在使用合并迭代器对 50 个微服务进行实时日志聚合。每个服务产生约 1000 事件/秒。合并输出突然落后了。发生了什么？
**答案：** 一个慢/停滞的流阻塞了合并。堆不能输出任何大于所有流中当前最小元素的元素，所以如果一个流停止产生数据，合并就会停滞等待它。

这就是流式合并中的"掉队者问题"。解决方案：(1) 为每个流设置超时——如果 T 毫秒内没有数据到达，临时跳过该流；(2) 使用水位线——即使某些流尚未报告，也输出低于某个时间戳的所有事件；(3) 使用窗口缓冲和重排序而非严格的全局排序。Apache Flink 和 Google Dataflow 正是因为这个原因使用基于水位线的方法。
:::
