# Pattern: Arena Allocator

## One Liner

Allocate objects by bumping a pointer in a pre-allocated region — free everything at once when the region is no longer needed.

## Core Idea

An arena (or bump allocator) pre-allocates a contiguous block of memory and hands out chunks by advancing a pointer. Individual allocations cannot be freed — the entire arena is freed at once. This eliminates per-object allocation overhead, fragmentation, and GC pressure.

```text
  Arena: [                 capacity                    ]
         ┌──────┬──────┬──────┬────────────────────────┐
         │ obj1 │ obj2 │ obj3 │    free space          │
         └──────┴──────┴──────┴────────────────────────┘
                              ▲
                              └── offset (bump pointer)

  alloc(16) → offset: 0→16   (return region 0..16)
  alloc(8)  → offset: 16→24  (return region 16..24)
  reset()   → offset: 0      (all objects freed instantly)
```

| Property | Value |
|----------|-------|
| Allocation speed | O(1) — just bump a pointer |
| Deallocation | O(1) — reset the pointer (frees everything) |
| Individual free | **Not supported** (use free-list or GC for that) |
| Fragmentation | **None** — contiguous allocation, no gaps |

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| Rust bumpalo | [lib.rs#L378-L383](https://github.com/fitzgen/bumpalo/blob/main/src/lib.rs#L378-L383) | `Bump` struct (L378) holds a bump pointer into the current chunk. `try_alloc_layout_fast` (L1330-L1422) is the hot path: read pointer, align, subtract size, check capacity. `reset` (L1059-L1099) bulk-frees all chunks. Used in `wasm-bindgen`, Rust compiler, and Deno. |
| Go stdlib | [arena.go#L44-L67](https://github.com/golang/go/blob/master/src/arena/arena.go#L44-L67) | Experimental `Arena` type — `New[T]()` allocates from the arena, `Free()` releases everything at once bypassing GC. Minimal API wrapping runtime arena primitives. |

## Implementation

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

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a bump allocator with alloc/reset | `exercises/typescript/arena-allocator/01-basic.test.ts` |

Run exercises: `pnpm test`

## When to Use

- **Compilers/parsers** — AST nodes allocated during parsing, freed all at once after compilation
- **Game frame data** — per-frame allocations reset at frame boundary
- **Request-scoped data** — web server allocations tied to a single request lifecycle
- **Serialization** — temporary buffers for encoding/decoding

## When NOT to Use

- **Long-lived objects** — arena frees everything at once; can't free individual objects
- **Variable lifetimes** — if objects have different lifecycles, use a general allocator
- **Memory-constrained** — arenas may waste space if allocation sizes are unpredictable
- **Thread-shared arenas** — without synchronization, arenas are not thread-safe (use thread-local arenas)

## More Production Uses

- [Go arena](https://github.com/golang/go/blob/master/src/arena/arena.go) — experimental arena API in Go standard library
- [V8](https://github.com/nickel-org/nickel.rs) — Zone allocator for temporary AST/IR allocations
- [Zig](https://github.com/ziglang/zig) — `std.mem.ArenaAllocator` as a core allocator pattern
- [ECS game engines](https://github.com/SanderMertens/flecs) — component storage with arena-style allocation

## Challenge Questions

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
