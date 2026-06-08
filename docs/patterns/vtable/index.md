---
description: "Group function pointers into a struct to achieve runtime polymorphism — the manual foundation behind interfaces, traits, and virtual methods."
difficulty: "advanced"
---

# Pattern: Vtable / Ops Dispatch

<DifficultyBadge />

## One Liner

Group function pointers into a struct to achieve runtime polymorphism — the manual foundation behind interfaces, traits, and virtual methods.

<DemoBadge />

## Real-World Analogy

A restaurant menu where each dish links to its own recipe card in the kitchen. The waiter doesn't know how to cook — they just look up the recipe card for the ordered dish and hand it to the right chef. Different restaurants can have different recipe cards for the same dish name.

## Core Idea

A vtable (virtual function table) is a struct of function pointers that defines the operations available on a type. Each "object" stores a pointer to its vtable alongside its data. To call a method, you indirect through the vtable pointer — this is how C achieves polymorphism without classes, and how compilers implement interfaces and virtual methods under the hood.

```text
  Circle                   Rectangle
  ┌──────────┐             ┌──────────┐
  │ data:    │             │ data:    │
  │  r = 5   │             │  w = 4   │
  │          │             │  h = 6   │
  │ vtable ──┼──┐          │ vtable ──┼──┐
  └──────────┘  │          └──────────┘  │
                ▼                        ▼
  ┌──────────────────┐   ┌──────────────────┐
  │  circle_vtable   │   │   rect_vtable    │
  ├──────────────────┤   ├──────────────────┤
  │ area:  pi*r*r    │   │ area:  w*h       │
  │ perim: 2*pi*r    │   │ perim: 2*(w+h)   │
  └──────────────────┘   └──────────────────┘

  Dispatch: shape.vtable.area(shape.data)
```

| Property | Value |
|----------|-------|
| Call overhead | One pointer indirection (vtable lookup) |
| Adding new types | Add a new vtable — no existing code changes |
| Adding new operations | Must update ALL vtables (the expression problem) |
| Memory | One vtable per type (shared across all instances) |

**Try it yourself** — call methods on objects and watch vtable dispatch resolve the implementation:

<VTableViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| Linux Kernel | [fs.h#L2093-L2163](https://github.com/torvalds/linux/blob/master/include/linux/fs.h#L2093-L2163) | `file_operations` struct (L2093) is a vtable of function pointers: `.read`, `.write`, `.open`, `.release`, `.mmap`, `.poll`, etc. Every file system (ext4, btrfs, tmpfs) provides its own `file_operations` instance. The VFS layer dispatches `read()` / `write()` calls through this vtable — one API, many implementations. |
| CPython | [object.h#L250-L340](https://github.com/python/cpython/blob/main/Include/cpython/object.h#L250-L340) | `PyTypeObject` (L250) is the vtable for all Python types. It contains function pointers like `tp_repr`, `tp_hash`, `tp_call`, `tp_getattro`, `tp_richcompare`, and protocol suites (`tp_as_number`, `tp_as_sequence`, `tp_as_mapping`). Every Python `type` object points to a `PyTypeObject` vtable. |

## Implementation

::: code-group

```typescript [TypeScript]
interface ShapeVtable {
  area: (data: number[]) => number;
  perimeter: (data: number[]) => number;
}

interface Shape {
  vtable: ShapeVtable;
  data: number[];
}

const circleVtable: ShapeVtable = {
  area: (d) => Math.PI * d[0] * d[0],
  perimeter: (d) => 2 * Math.PI * d[0],
};

const rectVtable: ShapeVtable = {
  area: (d) => d[0] * d[1],
  perimeter: (d) => 2 * (d[0] + d[1]),
};

function createCircle(r: number): Shape {
  return { vtable: circleVtable, data: [r] };
}

function createRect(w: number, h: number): Shape {
  return { vtable: rectVtable, data: [w, h] };
}

// Polymorphic dispatch — works for any shape
function totalArea(shapes: Shape[]): number {
  return shapes.reduce((sum, s) => sum + s.vtable.area(s.data), 0);
}
```

```rust [Rust]
struct ShapeVtable {
    area: fn(&[f64]) -> f64,
    perimeter: fn(&[f64]) -> f64,
}

struct Shape {
    vtable: &'static ShapeVtable,
    data: Vec<f64>,
}

static CIRCLE_VTABLE: ShapeVtable = ShapeVtable {
    area: |d| std::f64::consts::PI * d[0] * d[0],
    perimeter: |d| 2.0 * std::f64::consts::PI * d[0],
};

static RECT_VTABLE: ShapeVtable = ShapeVtable {
    area: |d| d[0] * d[1],
    perimeter: |d| 2.0 * (d[0] + d[1]),
};

fn create_circle(r: f64) -> Shape {
    Shape { vtable: &CIRCLE_VTABLE, data: vec![r] }
}

fn create_rect(w: f64, h: f64) -> Shape {
    Shape { vtable: &RECT_VTABLE, data: vec![w, h] }
}
```

```go [Go]
type ShapeOps struct {
	Area      func(data []float64) float64
	Perimeter func(data []float64) float64
}

type Shape struct {
	Ops  *ShapeOps
	Data []float64
}

var CircleOps = &ShapeOps{
	Area:      func(d []float64) float64 { return math.Pi * d[0] * d[0] },
	Perimeter: func(d []float64) float64 { return 2 * math.Pi * d[0] },
}

var RectOps = &ShapeOps{
	Area:      func(d []float64) float64 { return d[0] * d[1] },
	Perimeter: func(d []float64) float64 { return 2 * (d[0] + d[1]) },
}

func NewCircle(r float64) Shape { return Shape{Ops: CircleOps, Data: []float64{r}} }
func NewRect(w, h float64) Shape { return Shape{Ops: RectOps, Data: []float64{w, h}} }
```

```python [Python]
from dataclasses import dataclass
from typing import Callable

@dataclass
class ShapeVtable:
    area: Callable[[list[float]], float]
    perimeter: Callable[[list[float]], float]

@dataclass
class Shape:
    vtable: ShapeVtable
    data: list[float]

import math

circle_vtable = ShapeVtable(
    area=lambda d: math.pi * d[0] ** 2,
    perimeter=lambda d: 2 * math.pi * d[0],
)

rect_vtable = ShapeVtable(
    area=lambda d: d[0] * d[1],
    perimeter=lambda d: 2 * (d[0] + d[1]),
)

def create_circle(r: float) -> Shape:
    return Shape(vtable=circle_vtable, data=[r])

def create_rect(w: float, h: float) -> Shape:
    return Shape(vtable=rect_vtable, data=[w, h])
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement vtable dispatch for shapes (area/perimeter) | `exercises/typescript/vtable/01-basic.test.ts` |
| Intermediate | Plugin system with vtable-based extension points | `exercises/typescript/vtable/02-intermediate.test.ts` |

Run exercises: `pnpm test` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/vtable.rs` · Go `exercises/go/vtable_test.go` · Python `exercises/python/test_vtable.py`

## When to Use

- **Plugin architectures** — plugins provide a vtable of callbacks the host calls
- **OS kernel abstractions** — file systems, device drivers, network protocols all use ops structs
- **Language runtimes** — Python types, Ruby classes, Lua metatables are all vtables
- **Database storage engines** — each engine (InnoDB, RocksDB) provides read/write/scan ops
- **Rendering backends** — OpenGL, Vulkan, Metal behind a common vtable interface

## When NOT to Use

- **Single implementation** — if there's only ever one implementation, direct function calls are simpler and faster
- **Hot inner loops** — vtable indirection inhibits inlining and branch prediction; consider monomorphization
- **Few operations, many types** — if you mostly add operations (not types), the expression problem makes vtables painful

## More Production Uses

- [Rust dyn Trait](https://github.com/rust-lang/rust) — trait objects use a vtable pointer for dynamic dispatch
- [Go interfaces](https://github.com/golang/go) — interface values contain an itable (interface table) pointer
- [SQLite VFS](https://github.com/sqlite/sqlite) — Virtual File System layer uses function pointer struct for OS abstraction
- [QEMU](https://github.com/qemu/qemu) — device models provide ops structs for memory-mapped I/O handlers

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Tagged Union](/patterns/tagged-union/) | Both enable polymorphism — vtable via indirection, tagged union via switch |
| [Visitor](/patterns/visitor/) | Visitors dispatch on type, often via vtable-like function pointer lookups |
| [Middleware](/patterns/middleware-chain/) | Each middleware handler is a function pointer, forming a dynamic vtable |

## Challenge Questions

::: details Q1: In C++, every class with virtual methods has a hidden vptr. What's the memory cost for 1 million objects?
**Answer:** Each object stores one vptr (8 bytes on 64-bit systems). For 1 million objects: 8MB just for vtable pointers.

But the vtable itself is shared — one per class, not per instance. If you have 10 classes, that's only 10 vtables (a few hundred bytes total). The per-object cost is the vptr, not the vtable.

Key insight: vtable is per-type, vptr is per-instance. Inheritance depth doesn't change the vptr size — each object has exactly one vptr.
:::

::: details Q2: Linux has ~70 function pointers in file_operations. What happens when a filesystem doesn't support an operation?
**Answer:** The function pointer is set to NULL, and the VFS layer checks for NULL before calling. If NULL, it returns `-EINVAL` or `-EOPNOTSUPP`.

For example, `tmpfs` doesn't support `llseek` on certain files, so its `file_operations` has `.llseek = NULL`. The VFS checks this in `vfs_llseek()` and returns an error. This is the "partial vtable" pattern — not every type needs every operation.
:::

::: details Q3: Rust has both static dispatch (generics) and dynamic dispatch (dyn Trait). When would you choose dynamic?
**Answer:** Dynamic dispatch (`dyn Trait`) when you need heterogeneous collections — e.g., `Vec<Box<dyn Shape>>` holding circles and rectangles together. Static dispatch (generics) when the type is known at compile time and you want the compiler to inline and optimize.

Dynamic dispatch costs ~2-5ns per call (pointer indirection + cache miss risk). Static dispatch is zero-cost but increases binary size through monomorphization. Rule of thumb: hot paths use generics, cold paths and APIs use `dyn Trait`.
:::

::: details Q4: How does CPython's PyTypeObject differ from a C++ vtable?
**Answer:** A C++ vtable is compiler-generated and hidden — you can't modify it at runtime. CPython's `PyTypeObject` is a regular C struct that's fully mutable at runtime.

This enables Python's dynamic nature: you can add/replace methods on a type at runtime by modifying the `PyTypeObject`'s slots. It also supports inheritance by copying parent slots and allowing overrides. The tradeoff: every method call goes through a dict lookup + type slot, making Python method dispatch ~100x slower than C++ virtual calls.
:::
