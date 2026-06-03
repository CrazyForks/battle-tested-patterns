# 模式：Arena 分配器 (Arena Allocator)

## 一句话

在预分配区域中通过移动指针分配对象——不再需要时一次性释放所有内存。

## 核心思想

Arena（或 bump 分配器）预分配一块连续内存，通过推进指针分发内存块。单个分配不能释放——整个 arena 一次性释放。这消除了逐对象分配开销、碎片化和 GC 压力。

```text
  Arena: [                 capacity                    ]
         ┌──────┬──────┬──────┬────────────────────────┐
         │ obj1 │ obj2 │ obj3 │    free space          │
         └──────┴──────┴──────┴────────────────────────┘
                              ▲
                              └── offset (bump 指针)

  alloc(16) → offset: 0→16   (返回区域 0..16)
  alloc(8)  → offset: 16→24  (返回区域 16..24)
  reset()   → offset: 0      (所有对象瞬间释放)
```

| 属性 | 值 |
|------|------|
| 分配速度 | O(1) — 仅移动指针 |
| 释放 | O(1) — 重置指针（释放所有内容） |
| 单独释放 | **不支持**（需要用 free-list 或 GC） |
| 碎片化 | **无** — 连续分配，无空隙 |

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Rust bumpalo | [lib.rs#L378-L383](https://github.com/fitzgen/bumpalo/blob/main/src/lib.rs#L378-L383) | `Bump` 结构体（L378）持有指向当前 chunk 的 bump 指针。`try_alloc_layout_fast`（L1330-L1422）是热路径：读指针、对齐、减去大小、检查容量。`reset`（L1059-L1099）批量释放所有 chunk。被 `wasm-bindgen`、Rust 编译器和 Deno 使用。 |
| Go stdlib | [arena.go#L44-L67](https://github.com/golang/go/blob/master/src/arena/arena.go#L44-L67) | 实验性 `Arena` 类型——`New[T]()` 从 arena 分配，`Free()` 一次性释放所有内容绕过 GC。封装运行时 arena 原语的简洁 API。 |

## 实现

::: code-group

```typescript [TypeScript]
class Arena {
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset = 0;

  constructor(capacity: number) {
    this.buffer = new ArrayBuffer(capacity);
    this.view = new DataView(this.buffer);
  }

  alloc(size: number): { start: number; size: number } | null {
    if (this.offset + size > this.buffer.byteLength) return null;
    const start = this.offset;
    this.offset += size;
    return { start, size };
  }

  writeU32(offset: number, value: number): void {
    this.view.setUint32(offset, value);
  }

  readU32(offset: number): number {
    return this.view.getUint32(offset);
  }

  reset(): void { this.offset = 0; }

  get used(): number { return this.offset; }
  get capacity(): number { return this.buffer.byteLength; }
}
```

```rust [Rust]
pub struct Arena {
    buf: Vec<u8>,
    offset: usize,
}

impl Arena {
    pub fn new(capacity: usize) -> Self {
        Arena { buf: vec![0; capacity], offset: 0 }
    }

    pub fn alloc(&mut self, size: usize) -> Option<&mut [u8]> {
        if self.offset + size > self.buf.len() { return None; }
        let start = self.offset;
        self.offset += size;
        Some(&mut self.buf[start..start + size])
    }

    pub fn reset(&mut self) { self.offset = 0; }

    pub fn used(&self) -> usize { self.offset }
}
```

```go [Go]
type Arena struct {
	buf    []byte
	offset int
}

func NewArena(capacity int) *Arena {
	return &Arena{buf: make([]byte, capacity)}
}

func (a *Arena) Alloc(size int) []byte {
	if a.offset+size > len(a.buf) {
		return nil
	}
	start := a.offset
	a.offset += size
	return a.buf[start : start+size]
}

func (a *Arena) Reset() { a.offset = 0 }

func (a *Arena) Used() int { return a.offset }
```

```python [Python]
class Arena:
    def __init__(self, capacity: int):
        self.buf = bytearray(capacity)
        self.offset = 0

    def alloc(self, size: int) -> memoryview | None:
        if self.offset + size > len(self.buf):
            return None
        start = self.offset
        self.offset += size
        return memoryview(self.buf)[start:start + size]

    def reset(self) -> None:
        self.offset = 0

    @property
    def used(self) -> int:
        return self.offset
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带 alloc/reset 的 bump 分配器 | `exercises/typescript/arena-allocator/01-basic.test.ts` |

## 何时使用

- **编译器/解析器** — 解析期间分配 AST 节点，编译后一次性释放
- **游戏帧数据** — 每帧分配在帧边界重置
- **请求级数据** — Web 服务器分配与单个请求生命周期绑定
- **序列化** — 编码/解码的临时缓冲区

## 何时不用

- **长生命周期对象** — arena 一次性释放所有内容，不能释放单个对象
- **不同生命周期** — 如果对象有不同的生命周期，使用通用分配器
- **内存受限** — 如果分配大小不可预测，arena 可能浪费空间
- **线程共享 arena** — 无同步机制时 arena 不是线程安全的（使用线程本地 arena）

## 更多生产案例

- [Go arena](https://github.com/golang/go/blob/master/src/arena/arena.go) — Go 标准库中的实验性 arena API
- [Zig](https://github.com/ziglang/zig) — `std.mem.ArenaAllocator` 作为核心分配器模式
- [ECS 游戏引擎](https://github.com/SanderMertens/flecs) — 使用 arena 风格分配的组件存储

## 挑战题

::: details Q1: An arena allocator never fragments memory. A general-purpose allocator does. Why?
**Answer:** Because the arena allocates contiguously by bumping a pointer forward, and frees everything at once -- there are never gaps between live objects.

Fragmentation happens when objects are allocated and freed individually, leaving holes between live objects that are too small to reuse. An arena avoids this because it never frees individual objects -- it only resets the pointer to zero, reclaiming everything in one shot. The trade-off is that you can't free a single object early; if one allocation in the arena is still needed, the entire arena must stay alive.
:::

::: details Q2: You use an arena for per-HTTP-request allocations. One request triggers a 50MB file upload parsed into the arena. What's the problem?
**Answer:** The arena holds the entire 50MB until the request completes, even if the parsed data is consumed incrementally and could have been freed along the way.

Arenas work best when all allocations have roughly the same lifetime. If you parse a large file into an arena but only need a small summary, the bulk of the data sits in memory until `reset()`. The fix is either to stream-process the file without loading it all into the arena, or use a separate short-lived arena for the parsing pass and copy only the summary to the request arena.
:::

::: details Q3: A colleague suggests replacing Go's garbage collector with arenas everywhere for better performance. What's the flaw in this reasoning?
**Answer:** Arenas require that all objects within them share the same lifetime. Real programs have objects with widely varying lifetimes, which arenas cannot handle.

If object A must outlive object B but they're in the same arena, you can't free B without also freeing A. You'd end up either leaking memory (keeping arenas alive too long) or creating dozens of micro-arenas to match different lifetimes -- which is just reinventing the allocator with more complexity. GC handles arbitrary lifetimes automatically. Arenas excel in specific scopes (per-request, per-frame, per-compilation-pass) where lifetime is uniform.
:::

::: details Q4: Two arenas exist: one for AST nodes during parsing, one for IR nodes during code generation. The IR pass needs to reference AST nodes. What's the danger?
**Answer:** If the AST arena is reset before the IR pass finishes reading from it, the IR holds dangling references into freed memory.

This is the lifetime scoping problem: arena B's objects reference arena A's objects, creating an implicit lifetime dependency. Arena A must not be reset until arena B is done. In Rust, the borrow checker enforces this statically. In C/Go/TypeScript, it's a discipline issue. The solution is either to copy needed data out of arena A before resetting it, or to enforce a strict ordering: reset A only after resetting B.
:::
