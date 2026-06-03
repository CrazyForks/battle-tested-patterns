# 模式：空闲链表 (Free List)

## 一句话

维护一个已释放槽位的链表，使分配和释放都是 O(1)——复用内存而无需调用系统分配器。

## 核心思想

空闲链表通过在空闲槽位内部穿入链表指针（侵入式），或使用独立索引数组（非侵入式）来跟踪可用内存槽位。`alloc()` 从头部弹出；`free()` 推入头部。池内无碎片，无系统调用，可预测的 O(1) 性能。

```text
  空闲链表头
       │
       ▼
  ┌────────┐    ┌────────┐    ┌────────┐
  │ slot 3 │───►│ slot 0 │───►│ slot 7 │───► null
  └────────┘    └────────┘    └────────┘

  alloc() → 返回 slot 3，头指针移到 slot 0
  free(5) → slot 5 成为新头，指向 slot 0
```

| 属性 | 值 |
|------|------|
| alloc | O(1) — 从头部弹出 |
| free | O(1) — 推入头部 |
| 碎片 | 池内无碎片（固定大小槽位） |
| 开销 | 每个空闲槽一个指针（侵入式）或索引数组（非侵入式） |

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Go runtime | [mfixalloc.go#L31-L109](https://github.com/golang/go/blob/master/src/runtime/mfixalloc.go#L31-L109) | `fixalloc` — 固定大小空闲链表分配器。`mlink` 结构体（L49-L52）是覆盖在已释放块上的侵入式链表节点。`alloc()`（L74-L87）从空闲链表弹出；`free()`（L106-L108）推入。经典 LIFO 空闲链表，驱动 Go 的内存子系统。 |
| Linux 内核 (SLUB) | [slub.c#L530-L551](https://github.com/torvalds/linux/blob/master/mm/slub.c#L530-L551) | `get_freepointer` / `set_freepointer` — 读写嵌入在每个空闲 slab 对象内部 `object + s->offset` 处的 next-free 指针。在 `CONFIG_SLAB_FREELIST_HARDENED` 下使用 XOR 编码指针（L504-L528）防御堆损坏攻击。 |

## 实现

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

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带 alloc/free 和计数跟踪的空闲链表分配器 | `exercises/typescript/free-list/01-basic.test.ts` |

## 何时使用

- **游戏引擎** — 实体/组件池的快速分配/释放循环
- **操作系统内核** — 固定大小内核对象的 slab 分配器（inode、task 结构体）
- **嵌入式系统** — 无堆、确定性的分配时序
- **网络协议栈** — 数据包头部的缓冲区池
- **数据库引擎** — B 树节点的页面分配器

## 何时不用

- **可变大小对象** — 空闲链表需要固定大小槽位（用通用分配器替代）
- **很少释放** — 对象永生时空闲链表始终为空（用 bump/arena 分配器）
- **小型池** — 低于约 16 个槽位时管理链表的开销超过收益
- **需要线程安全** — 基本空闲链表需要外部同步（或使用无锁变体）

## 更多生产案例

- [Godot Engine](https://github.com/godotengine/godot/blob/master/core/templates/pooled_list.h#L57-L131) — `PooledList<T>` 非侵入式空闲链表，使用独立索引数组
- [jemalloc](https://github.com/jemalloc/jemalloc) — 小分配的线程缓存空闲链表
- [mimalloc](https://github.com/microsoft/mimalloc) — 分片设计的段级空闲链表
- [Vulkan Memory Allocator](https://github.com/GPUOpen-LibrariesAndSDKs/VulkanMemoryAllocator) — 带空闲链表的子分配池

## 挑战题

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
