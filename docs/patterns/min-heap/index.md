# Pattern: Min Heap / Priority Queue

## One Liner

A binary tree stored in an array where the smallest element is always at the root, enabling O(1) peek and O(log n) insert/remove.

## Core Idea

A min heap is a complete binary tree where every parent is smaller than its children. By storing it in a flat array (parent at `i`, children at `2i+1` and `2i+2`), you avoid pointer overhead and get cache-friendly access.

```mermaid
graph TD
    A["1 (root = min)"] --> B["3"]
    A --> C["2"]
    B --> D["7"]
    B --> E["5"]
    C --> F["4"]
    C --> G["6"]
```

Two operations maintain the invariant:

- **sift up** — after inserting at the end, bubble the element up until the parent is smaller
- **sift down** — after removing the root (swap with last element), push the new root down until both children are larger

Array layout: `[1, 3, 2, 7, 5, 4, 6]` — the tree above stored flat.

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| React | [SchedulerMinHeap.js#L17-L90](https://github.com/facebook/react/blob/main/packages/scheduler/src/SchedulerMinHeap.js#L17-L90) | React's scheduler stores scheduled tasks in a min heap sorted by `sortIndex` (expiration time). `peek()` returns the highest-priority task in O(1). The entire implementation is ~75 lines. |
| Linux Kernel | [fair.c](https://github.com/torvalds/linux/blob/master/kernel/sched/fair.c#L1) | The CFS (Completely Fair Scheduler) uses a red-black tree (which provides min-heap-like O(log n) operations) to track processes by virtual runtime. The leftmost node is the next process to run. |

## Implementation

::: code-group

```typescript [TypeScript]
interface HeapNode {
  sortIndex: number;
  id: number;
}

class MinHeap<T extends HeapNode> {
  private heap: T[] = [];

  peek(): T | null {
    return this.heap[0] ?? null;
  }

  push(node: T): void {
    this.heap.push(node);
    this.siftUp(this.heap.length - 1);
  }

  pop(): T | null {
    if (this.heap.length === 0) return null;
    const first = this.heap[0]!;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return first;
  }

  get size(): number {
    return this.heap.length;
  }

  private siftUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >>> 1;
      if (this.compare(this.heap[i]!, this.heap[parent]!) < 0) {
        this.swap(i, parent);
        i = parent;
      } else break;
    }
  }

  private siftDown(i: number): void {
    const len = this.heap.length;
    const half = len >>> 1;
    while (i < half) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < len && this.compare(this.heap[left]!, this.heap[smallest]!) < 0) smallest = left;
      if (right < len && this.compare(this.heap[right]!, this.heap[smallest]!) < 0) smallest = right;
      if (smallest !== i) {
        this.swap(i, smallest);
        i = smallest;
      } else break;
    }
  }

  private compare(a: T, b: T): number {
    const diff = a.sortIndex - b.sortIndex;
    return diff !== 0 ? diff : a.id - b.id;
  }

  private swap(i: number, j: number): void {
    [this.heap[i], this.heap[j]] = [this.heap[j]!, this.heap[i]!];
  }
}
```

```rust [Rust]
pub struct MinHeap<T: Ord> {
    data: Vec<T>,
}

impl<T: Ord> MinHeap<T> {
    pub fn new() -> Self { MinHeap { data: Vec::new() } }

    pub fn peek(&self) -> Option<&T> { self.data.first() }

    pub fn push(&mut self, val: T) {
        self.data.push(val);
        self.sift_up(self.data.len() - 1);
    }

    pub fn pop(&mut self) -> Option<T> {
        if self.data.is_empty() { return None; }
        let last = self.data.len() - 1;
        self.data.swap(0, last);
        let val = self.data.pop();
        if !self.data.is_empty() { self.sift_down(0); }
        val
    }

    fn sift_up(&mut self, mut i: usize) {
        while i > 0 {
            let parent = (i - 1) / 2;
            if self.data[i] < self.data[parent] {
                self.data.swap(i, parent);
                i = parent;
            } else { break; }
        }
    }

    fn sift_down(&mut self, mut i: usize) {
        let len = self.data.len();
        loop {
            let (left, right) = (2 * i + 1, 2 * i + 2);
            let mut smallest = i;
            if left < len && self.data[left] < self.data[smallest] { smallest = left; }
            if right < len && self.data[right] < self.data[smallest] { smallest = right; }
            if smallest != i { self.data.swap(i, smallest); i = smallest; }
            else { break; }
        }
    }
}
```

```go [Go]
type HeapNode struct {
	SortIndex int
	ID        int
}

type MinHeap struct {
	data []HeapNode
}

func (h *MinHeap) Peek() (HeapNode, bool) {
	if len(h.data) == 0 { return HeapNode{}, false }
	return h.data[0], true
}

func (h *MinHeap) Push(node HeapNode) {
	h.data = append(h.data, node)
	h.siftUp(len(h.data) - 1)
}

func (h *MinHeap) Pop() (HeapNode, bool) {
	if len(h.data) == 0 { return HeapNode{}, false }
	val := h.data[0]
	last := len(h.data) - 1
	h.data[0] = h.data[last]
	h.data = h.data[:last]
	if len(h.data) > 0 { h.siftDown(0) }
	return val, true
}

func (h *MinHeap) siftUp(i int) {
	for i > 0 {
		parent := (i - 1) / 2
		if h.less(i, parent) { h.data[i], h.data[parent] = h.data[parent], h.data[i]; i = parent } else { break }
	}
}

func (h *MinHeap) siftDown(i int) {
	n := len(h.data)
	for {
		left, right, smallest := 2*i+1, 2*i+2, i
		if left < n && h.less(left, smallest) { smallest = left }
		if right < n && h.less(right, smallest) { smallest = right }
		if smallest != i { h.data[i], h.data[smallest] = h.data[smallest], h.data[i]; i = smallest } else { break }
	}
}

func (h *MinHeap) less(i, j int) bool {
	if h.data[i].SortIndex != h.data[j].SortIndex { return h.data[i].SortIndex < h.data[j].SortIndex }
	return h.data[i].ID < h.data[j].ID
}
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement push, pop, peek with sift operations | `exercises/typescript/min-heap/01-basic.test.ts` |
| Intermediate | Build a React-style task scheduler using min heap | `exercises/typescript/min-heap/02-task-scheduler.test.ts` |

Run exercises: `pnpm test` · `cargo test` · `go test ./...`

## When to Use

- **Task scheduling** — always process the highest-priority (lowest deadline) task first
- **Event-driven systems** — timer heaps for scheduling callbacks at specific times
- **Graph algorithms** — Dijkstra's shortest path, Prim's MST
- **Streaming top-K** — maintain the K smallest/largest elements from a stream
- **OS schedulers** — CFS uses a tree with min-heap properties for fair CPU distribution

## When NOT to Use

- **Need O(1) arbitrary lookup** — heaps only guarantee O(1) for the minimum; use a hash map for lookups
- **Sorted iteration** — if you need all elements in order, sort once; repeated pop is O(n log n)
- **Small fixed sets** — for < 10 elements, a linear scan is simpler and often faster
- **Need stable ordering** — equal-priority items may change order across operations
