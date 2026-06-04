---
description: "Maintain a linked list of freed slots so allocation and deallocation are O(1) — reuse memory without calling the system allocator."
difficulty: "intermediate"
---

# Pattern: Free List

<DifficultyBadge />

## One Liner

Maintain a linked list of freed slots so allocation and deallocation are O(1) — reuse memory without calling the system allocator.

<DemoBadge />

## Real-World Analogy

A parking lot that keeps a linked list of empty spots. When a car arrives, you hand out the first empty spot instantly. When a car leaves, its spot goes back to the front of the list. No scanning needed.

## Core Idea

A free list tracks available memory slots in a linked list threaded through the free slots themselves (intrusive) or via a separate index array (non-intrusive). `alloc()` pops the head; `free()` pushes onto the head. No fragmentation within the pool, no system calls, predictable O(1) performance.

```text
  Free List Head
       │
       ▼
  ┌────────┐    ┌────────┐    ┌────────┐
  │ slot 3 │───►│ slot 0 │───►│ slot 7 │───► null
  └────────┘    └────────┘    └────────┘

  alloc() → returns slot 3, head moves to slot 0
  free(5) → slot 5 becomes new head, points to slot 0
```

| Property | Value |
|----------|-------|
| alloc | O(1) — pop from head |
| free | O(1) — push to head |
| Fragmentation | None within pool (fixed-size slots) |
| Overhead | One pointer per free slot (intrusive) or index array (non-intrusive) |

**Try it yourself** — allocate and free blocks, observe how the free list links available slots:

<FreeListViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| Go runtime | [mfixalloc.go#L31-L109](https://github.com/golang/go/blob/master/src/runtime/mfixalloc.go#L31-L109) | `fixalloc` — fixed-size free-list allocator. `mlink` struct (L49-L52) is the intrusive list node overlaid on freed blocks. `alloc()` (L74-L87) pops from the free list; `free()` (L106-L108) pushes onto it. Classic LIFO free list powering Go's memory subsystem. |
| Linux kernel (SLUB) | [slub.c#L530-L551](https://github.com/torvalds/linux/blob/master/mm/slub.c#L530-L551) | `get_freepointer` / `set_freepointer` — reads/writes the next-free pointer embedded inside each free slab object at `object + s->offset`. Uses XOR-encoded pointers (L504-L528) under `CONFIG_SLAB_FREELIST_HARDENED` to defend against heap corruption attacks. |

## Implementation

::: code-group

```typescript [TypeScript]
class FreeList {
  private freeSlots: number[] = [];
  private nextSlot: number;

  constructor(private capacity: number) {
    this.nextSlot = 0;
  }

  alloc(): number | null {
    if (this.freeSlots.length > 0) {
      return this.freeSlots.pop()!;
    }
    if (this.nextSlot >= this.capacity) return null;
    return this.nextSlot++;
  }

  free(slot: number): void {
    this.freeSlots.push(slot);
  }

  get available(): number {
    return this.freeSlots.length + (this.capacity - this.nextSlot);
  }

  get allocated(): number {
    return this.nextSlot - this.freeSlots.length;
  }
}
```

```go [Go]
type FreeList struct {
	capacity int
	nextSlot int
	free     []int
}

func NewFreeList(capacity int) *FreeList {
	return &FreeList{capacity: capacity, free: nil}
}

func (fl *FreeList) Alloc() (int, bool) {
	if len(fl.free) > 0 {
		slot := fl.free[len(fl.free)-1]
		fl.free = fl.free[:len(fl.free)-1]
		return slot, true
	}
	if fl.nextSlot >= fl.capacity {
		return 0, false
	}
	slot := fl.nextSlot
	fl.nextSlot++
	return slot, true
}

func (fl *FreeList) Free(slot int) {
	fl.free = append(fl.free, slot)
}

func (fl *FreeList) Available() int {
	return len(fl.free) + (fl.capacity - fl.nextSlot)
}

func (fl *FreeList) Allocated() int {
	return fl.nextSlot - len(fl.free)
}
```

```python [Python]
class FreeList:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self._next_slot = 0
        self._free: list[int] = []

    def alloc(self) -> int | None:
        if self._free:
            return self._free.pop()
        if self._next_slot >= self.capacity:
            return None
        slot = self._next_slot
        self._next_slot += 1
        return slot

    def free(self, slot: int) -> None:
        self._free.append(slot)

    @property
    def available(self) -> int:
        return len(self._free) + (self.capacity - self._next_slot)

    @property
    def allocated(self) -> int:
        return self._next_slot - len(self._free)
```

```rust [Rust]
pub struct FreeList {
    capacity: usize,
    next_slot: usize,
    free: Vec<usize>,
}

impl FreeList {
    pub fn new(capacity: usize) -> Self {
        FreeList { capacity, next_slot: 0, free: Vec::new() }
    }

    pub fn alloc(&mut self) -> Option<usize> {
        if let Some(slot) = self.free.pop() {
            return Some(slot);
        }
        if self.next_slot >= self.capacity {
            return None;
        }
        let slot = self.next_slot;
        self.next_slot += 1;
        Some(slot)
    }

    pub fn free(&mut self, slot: usize) {
        self.free.push(slot);
    }

    pub fn available(&self) -> usize {
        self.free.len() + (self.capacity - self.next_slot)
    }

    pub fn allocated(&self) -> usize {
        self.next_slot - self.free.len()
    }
}
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a free list allocator with alloc/free and tracking | `exercises/typescript/free-list/01-basic.test.ts` |
| Intermediate | Generational pool with stale-handle detection | `exercises/typescript/free-list/02-intermediate.test.ts` |

Run exercises: `pnpm test` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/free_list.rs` · Go `exercises/go/free_list_test.go` · Python `exercises/python/test_free_list.py`

## When to Use

- **Game engines** — entity/component pools with rapid alloc/free cycles
- **OS kernels** — slab allocators for fixed-size kernel objects (inodes, task structs)
- **Embedded systems** — no heap, deterministic allocation timing
- **Network stacks** — buffer pools for packet headers
- **Database engines** — page allocators for B-tree nodes

## When NOT to Use

- **Variable-size objects** — free list requires fixed-size slots (use a general-purpose allocator)
- **Rarely freed** — if objects live forever, the free list stays empty (use bump/arena allocator)
- **Small pools** — overhead of managing the list outweighs benefits below ~16 slots
- **Thread-safe required** — basic free list needs external synchronization (or use lock-free variants)

## More Production Uses

- [Godot Engine](https://github.com/godotengine/godot/blob/master/core/templates/pooled_list.h#L57-L131) — `PooledList<T>` non-intrusive free list with separate index array
- [jemalloc](https://github.com/jemalloc/jemalloc) — thread-cache free lists for small allocations
- [mimalloc](https://github.com/microsoft/mimalloc) — segment-level free lists with sharded design
- [Vulkan Memory Allocator](https://github.com/GPUOpen-LibrariesAndSDKs/VulkanMemoryAllocator) — sub-allocation pools with free lists

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Arena Allocator](/patterns/arena-allocator/) | Arena bulk-frees; free lists recycle individual slots for O(1) reuse |
| [Object Pool](/patterns/object-pool/) | Object pools use free lists internally to track available objects |
| [Ring Buffer (Circular Buffer)](/patterns/ring-buffer/) | Both provide O(1) slot management — ring buffers via modular index, free lists via linked chain |
| [LRU Cache](/patterns/lru-cache/) | LRU caches use free lists to recycle evicted node slots for O(1) reuse |
| [Skip List](/patterns/skip-list/) | Skip lists can use free lists to recycle deleted node slots |
| [Tombstone / Soft Delete](/patterns/tombstone/) | Tombstone-based deletion defers slot recycling; free lists reclaim those slots |
| [Work Stealing](/patterns/work-stealing/) | Work-stealing queues can use free lists to manage task node allocation |

## Challenge Questions

::: details Q1: A bug causes `free(slot)` to be called twice on the same slot. What happens with a naive free list, and how do production systems detect this?
**Answer:** The slot appears twice in the free list. Two subsequent `alloc()` calls return the same slot, and two callers write to overlapping memory, causing data corruption.

Double-free is one of the most dangerous memory bugs. Detection techniques include: a bitmap tracking which slots are allocated (check before freeing), poison values written into freed slots (detect if the value is already the poison), and the Linux SLUB allocator's approach of XOR-encoding free list pointers with a per-cache random value so corruption is detected on the next alloc. Some allocators abort immediately on double-free rather than silently corrupting.
:::

::: details Q2: An intrusive free list stores the "next" pointer inside the free slot itself. What's the advantage over a separate index array, and what's the risk?
**Answer:** Intrusive lists use zero extra memory -- the next pointer occupies space that's unused anyway (the slot is free). The risk is that a use-after-free bug can overwrite the next pointer, corrupting the entire free list.

With a non-intrusive design (separate array of indices), corrupting a freed slot's data doesn't break the free list structure. With intrusive design, if code accidentally writes to a freed slot, it overwrites the next pointer and the free list chain breaks -- subsequent allocs may return garbage addresses. This is why Linux's SLUB uses `CONFIG_SLAB_FREELIST_HARDENED` to XOR-encode the pointers.
:::

::: details Q3: Free lists return the most recently freed slot (LIFO). Why is this better for performance than returning the oldest freed slot (FIFO)?
**Answer:** The most recently freed slot is likely still in CPU cache. Reusing it immediately gives better cache hit rates than returning a slot freed long ago.

LIFO reuse is a deliberate cache optimization. When you free slot N and immediately alloc, you get slot N back -- which was just accessed and is likely still in L1/L2 cache. FIFO would return a slot freed many operations ago, which has probably been evicted from cache. For hot allocation paths (game engines doing thousands of alloc/free per frame), this cache locality difference is measurable.
:::

::: details Q4: You have a free list pool of 1,000 slots. Monitoring shows the pool is 95% allocated at steady state, and alloc() frequently returns null. Should you increase the pool size?
**Answer:** Not necessarily. First check whether allocated slots are actually in use or are being leaked (allocated but never freed).

A common bug is forgetting to call `free()` on slots that are no longer needed, causing the pool to slowly drain. Adding more slots just delays the inevitable exhaustion. Check the `allocated` count over time -- if it monotonically increases, you have a leak. If it fluctuates around 950 with occasional spikes to 1000, then the pool is genuinely too small and should be increased.
:::
