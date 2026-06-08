---
description: "维护一个已释放槽位的链表，使分配和释放都是 O(1)——复用内存而无需调用系统分配器。"
difficulty: "intermediate"
---

# 模式：空闲链表 (Free List)

<DifficultyBadge />

## 一句话

维护一个已释放槽位的链表，使分配和释放都是 O(1)——复用内存而无需调用系统分配器。

<DemoBadge />

## 现实类比

一个用记事板记录空位的停车场。有车来，直接分配清单顶部的空位。有车走，空出的位置记回清单顶部。无需扫描整个停车场。

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

**动手试试** — 分配和释放块，观察空闲链表如何连接可用槽位：

<FreeListViz />

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

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带 alloc/free 和计数跟踪的空闲链表分配器 | `exercises/typescript/free-list/01-basic.test.ts` |
| 进阶 | 带过期句柄检测的代际池 | `exercises/typescript/free-list/02-intermediate.test.ts` |

运行练习：`pnpm test`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

练习文件： Rust `exercises/rust/src/free_list.rs` · Go `exercises/go/free_list_test.go` · Python `exercises/python/test_free_list.py`

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

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [Arena 分配器 (Arena Allocator)](/zh/patterns/arena-allocator/) | Arena 批量释放；空闲链表回收单个槽位实现 O(1) 复用 |
| [对象池 (Object Pool)](/zh/patterns/object-pool/) | 对象池内部使用空闲链表追踪可用对象 |
| [环形缓冲区 (Ring Buffer)](/zh/patterns/ring-buffer/) | 两者都提供 O(1) 槽位管理——环形缓冲区通过模索引，空闲链表通过链表 |
| [LRU 缓存 (LRU Cache)](/zh/patterns/lru-cache/) | LRU 缓存使用空闲链表回收被淘汰的节点槽位以实现 O(1) 复用 |
| [跳表 (Skip List)](/zh/patterns/skip-list/) | 跳表可以使用空闲链表回收已删除节点的槽位 |
| [墓碑 / 软删除 (Tombstone)](/zh/patterns/tombstone/) | 墓碑式删除推迟槽位回收；空闲链表负责回收这些槽位 |
| [工作窃取 (Work Stealing)](/zh/patterns/work-stealing/) | 工作窃取队列可以使用空闲链表管理任务节点分配 |

## 挑战题

::: details Q1: 一个 bug 导致 `free(slot)` 对同一个槽位被调用了两次。在简单的 Free List 中会发生什么？生产系统如何检测这种情况？
**答案：** 该槽位在空闲链表中出现两次。两次后续的 `alloc()` 调用返回同一个槽位，两个调用者写入重叠的内存，导致数据损坏。

双重释放是最危险的内存 bug 之一。检测技术包括：使用位图追踪哪些槽位已分配（释放前检查）、在已释放的槽位中写入毒值（检测该值是否已经是毒值），以及 Linux SLUB 分配器的方法——用每缓存的随机值对空闲链表指针做 XOR 编码，以便在下次分配时检测到损坏。一些分配器在双重释放时立即中止，而不是静默损坏。
:::

::: details Q2: 侵入式空闲链表将"next"指针存储在空闲槽位本身内部。相比单独的索引数组，它有什么优势？风险是什么？
**答案：** 侵入式链表不使用额外内存——next 指针占用的空间本来就是闲置的（槽位是空闲的）。风险在于使用后释放（use-after-free）的 bug 可能覆盖 next 指针，破坏整个空闲链表。

使用非侵入式设计（单独的索引数组）时，破坏已释放槽位的数据不会破坏空闲链表结构。使用侵入式设计时，如果代码意外写入已释放的槽位，它会覆盖 next 指针导致空闲链表断裂——后续的分配可能返回垃圾地址。这就是为什么 Linux 的 SLUB 使用 `CONFIG_SLAB_FREELIST_HARDENED` 对指针做 XOR 编码。
:::

::: details Q3: 空闲链表返回最近释放的槽位（LIFO）。为什么这比返回最早释放的槽位（FIFO）性能更好？
**答案：** 最近释放的槽位很可能仍在 CPU 缓存中。立即复用它比返回很久以前释放的槽位有更好的缓存命中率。

LIFO 复用是一种有意为之的缓存优化。当你释放槽位 N 并立即分配时，你会得到槽位 N——它刚刚被访问过，很可能仍在 L1/L2 缓存中。FIFO 会返回很多操作之前释放的槽位，它很可能已被逐出缓存。对于热分配路径（游戏引擎每帧进行数千次分配/释放），这种缓存局部性差异是可测量的。
:::

::: details Q4: 你有一个 1,000 个槽位的空闲链表池。监控显示在稳定状态下池已分配 95%，`alloc()` 经常返回 null。你应该增加池的大小吗？
**答案：** 不一定。首先检查已分配的槽位是否确实在使用中，还是被泄漏了（分配后从未释放）。

一个常见的 bug 是忘记对不再需要的槽位调用 `free()`，导致池慢慢耗尽。增加更多槽位只是延迟了不可避免的耗尽。检查 `allocated` 计数随时间的变化——如果它单调递增，你有泄漏。如果它在 950 附近波动偶尔飙升到 1000，那么池确实太小了，应该增加。
:::
