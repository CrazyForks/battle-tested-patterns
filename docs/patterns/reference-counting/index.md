---
title: "Pattern: Reference Counting"
description: "Track owners via atomic counter, auto-cleanup at zero — deterministic resource lifetime without garbage collection."
difficulty: "beginner"
---

# Pattern: Reference Counting

<DifficultyBadge />

## One Liner

Track owners via atomic counter, auto-cleanup at zero — deterministic resource lifetime without garbage collection.

<DemoBadge />

## Real-World Analogy

A shared Netflix account. You keep track of how many people are actively using it. When the last person cancels, the subscription is terminated. No background check needed — the count reaching zero is the signal.

## Core Idea

Reference counting assigns each shared resource a counter. Every new owner (clone) increments it; every release (drop) decrements it. When the counter reaches zero, the resource is immediately cleaned up — no GC pause, no finalizer queue, fully deterministic.

```text
  ┌────────────┐
  │  Resource  │   refcount = 1
  │  (value)   │
  └─────┬──────┘
        │
     owner A

  A.clone() → B
  ┌────────────┐
  │  Resource  │   refcount = 2
  │  (value)   │
  └──┬─────┬───┘
     │     │
  owner A  owner B

  A.drop()
  ┌────────────┐
  │  Resource  │   refcount = 1
  │  (value)   │
  └─────┬──────┘
        │
     owner B

  B.drop()
  ┌────────────┐
  │  Resource  │   refcount = 0 → cleanup()!
  │  (value)   │
  └────────────┘
```

| Property | Value |
|----------|-------|
| Clone | O(1) — increment counter |
| Drop | O(1) — decrement counter, conditionally cleanup |
| Cleanup trigger | Deterministic — exactly when last owner drops |
| Thread safety | Requires atomic operations (or mutex) for multi-threaded use |

**Try it yourself** — drop references to decrement ref counts and watch objects get freed at rc=0:

<ReferenceCountingViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| CPython | [refcount.h#L255-L310](https://github.com/python/cpython/blob/ff64d8de66ab7f8e56b5d410796a7d76c955280c/Include/refcount.h#L255-L310) | `Py_INCREF` (L255-L310) is the inline function that increments `ob_refcnt`. `Py_DECREF` (L417-L430) decrements and calls `_Py_Dealloc` at zero. Every Python object carries `ob_refcnt` in `PyObject` ([object.h#L127-L150](https://github.com/python/cpython/blob/ff64d8de66ab7f8e56b5d410796a7d76c955280c/Include/object.h#L127-L150)). This is the primary memory management mechanism — GC only exists to break reference cycles. |
| Rust std | [sync.rs#L269-L276](https://github.com/rust-lang/rust/blob/ab26b175979ee7b2cb3302dce204b99df96f7efb/library/alloc/src/sync.rs#L269-L276) | `Arc<T>` (Atomic Reference Counted) struct at L269. `Drop` impl (L2799-L2875) calls `fetch_sub(1, Release)` on strong count, Acquire fence, then `drop_slow()` at zero. Used pervasively across Tokio, Actix, and OS-level Rust code. |

## Implementation

::: code-group

```typescript [TypeScript]
type CleanupFn<T> = (value: T) => void;

interface RefCountedInner<T> {
  value: T;
  count: number;
  dropped: boolean;
  cleanup: CleanupFn<T>;
}

class RefCounted<T> {
  private inner: RefCountedInner<T>;
  private owned: boolean;

  constructor(value: T, cleanup: CleanupFn<T>) {
    this.inner = { value, count: 1, dropped: false, cleanup };
    this.owned = true;
  }

  /** Create a new owner sharing the same value. */
  clone(): RefCounted<T> {
    if (!this.owned) throw new Error('Cannot clone a dropped reference');
    this.inner.count++;
    const cloned = Object.create(RefCounted.prototype) as RefCounted<T>;
    cloned.inner = this.inner;
    cloned.owned = true;
    return cloned;
  }

  /** Release this owner's reference. Triggers cleanup when count hits 0. */
  drop(): void {
    if (!this.owned) return; // double-drop is a no-op
    this.owned = false;
    this.inner.count--;
    if (this.inner.count === 0 && !this.inner.dropped) {
      this.inner.dropped = true;
      this.inner.cleanup(this.inner.value);
    }
  }

  refCount(): number { return this.inner.count; }

  value(): T {
    if (!this.owned) throw new Error('Reference has been dropped');
    return this.inner.value;
  }
}
```

```rust [Rust]
use std::cell::Cell;

struct RcInner<T> {
    value: T,
    count: Cell<usize>,
}

pub struct Rc<T> {
    inner: *const RcInner<T>,
}

impl<T> Rc<T> {
    pub fn new(value: T) -> Self {
        let inner = Box::into_raw(Box::new(RcInner {
            value,
            count: Cell::new(1),
        }));
        Rc { inner }
    }

    pub fn strong_count(&self) -> usize {
        unsafe { (*self.inner).count.get() }
    }

    pub fn value(&self) -> &T {
        unsafe { &(*self.inner).value }
    }
}

impl<T> Clone for Rc<T> {
    fn clone(&self) -> Self {
        unsafe {
            let c = (*self.inner).count.get();
            (*self.inner).count.set(c + 1);
        }
        Rc { inner: self.inner }
    }
}

impl<T> Drop for Rc<T> {
    fn drop(&mut self) {
        unsafe {
            let c = (*self.inner).count.get();
            (*self.inner).count.set(c - 1);
            if c == 1 {
                drop(Box::from_raw(self.inner as *mut RcInner<T>));
            }
        }
    }
}
```

```go [Go]
type RefCounted[T any] struct {
	mu      sync.Mutex
	value   T
	count   int
	cleanup func(T)
}

func NewRefCounted[T any](value T, cleanup func(T)) *RefCounted[T] {
	return &RefCounted[T]{value: value, count: 1, cleanup: cleanup}
}

func (rc *RefCounted[T]) Clone() *RefCounted[T] {
	rc.mu.Lock()
	defer rc.mu.Unlock()
	rc.count++
	return rc // same pointer, shared state
}

func (rc *RefCounted[T]) Drop() {
	rc.mu.Lock()
	defer rc.mu.Unlock()
	rc.count--
	if rc.count == 0 {
		rc.cleanup(rc.value)
	}
}

func (rc *RefCounted[T]) Count() int {
	rc.mu.Lock()
	defer rc.mu.Unlock()
	return rc.count
}
```

```python [Python]
from typing import TypeVar, Generic, Callable, Optional

T = TypeVar("T")

class RefCounted(Generic[T]):
    def __init__(self, value: T, cleanup: Callable[[T], None]):
        self._value = value
        self._count = 1
        self._dropped = False
        self._cleanup = cleanup
        self._owned = True

    def clone(self) -> "RefCounted[T]":
        if not self._owned:
            raise RuntimeError("Cannot clone a dropped reference")
        self._count += 1
        copy = object.__new__(RefCounted)
        # Share internal state by reference
        copy.__dict__ = self.__dict__
        copy._owned = True
        return copy

    def drop(self) -> None:
        if not self._owned:
            return
        self._owned = False
        self._count -= 1
        if self._count == 0 and not self._dropped:
            self._dropped = True
            self._cleanup(self._value)

    @property
    def ref_count(self) -> int:
        return self._count

    @property
    def value(self) -> T:
        if not self._owned:
            raise RuntimeError("Reference has been dropped")
        return self._value
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a ref-counted value with clone/drop and cleanup callback | `exercises/typescript/reference-counting/01-basic.test.ts` |
| Intermediate | Extend with weak references that don't prevent cleanup | `exercises/typescript/reference-counting/02-intermediate.test.ts` |

Run exercises: `pnpm test:ts` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/reference_counting/mod.rs` · Go `exercises/go/reference_counting/reference_counting_test.go` · Python `exercises/python/reference_counting/test_reference_counting.py`

## When to Use

- **Shared ownership with deterministic cleanup** — multiple parts of code need the same resource, and you need it freed the moment the last user is done (file handles, GPU buffers, database connections)
- **Avoiding GC pauses** — real-time systems (games, audio) where stop-the-world GC is unacceptable
- **Interop between languages** — CPython's refcount lets C extensions manage Python objects naturally; COM uses `AddRef`/`Release` across DLL boundaries
- **Short-lived shared state** — when objects are mostly owned by one place but occasionally shared briefly (Rust's `Rc`/`Arc` pattern)

## When NOT to Use

- **Cyclic data structures** — parent-child cycles (e.g., doubly linked lists, graph nodes) leak because the count never reaches zero. Use weak references or a tracing GC.
- **High-contention sharing** — if many threads constantly clone/drop the same object, the atomic counter becomes a cache-line bottleneck. Consider epoch-based reclamation or hazard pointers.
- **Bulk allocation patterns** — if you allocate/free thousands of small objects, per-object counters add overhead. Use arena allocation instead.

## More Production Uses

- [Swift ARC](https://github.com/apple/swift) — Swift's entire memory model is built on automatic reference counting (compiler-inserted retain/release)
- [COM IUnknown](https://learn.microsoft.com/en-us/windows/win32/api/unknwn/nn-unknwn-iunknown) — `AddRef`/`Release` across every COM object in Windows
- [Linux kernel kobject](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/lib/kobject.c) — `kref` provides reference counting for kernel objects
- [Objective-C ARC](https://clang.llvm.org/docs/AutomaticReferenceCounting.html) — compiler-managed `retain`/`release` calls

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Copy-on-Write (CoW)](/patterns/copy-on-write/) | Reference counting determines when a CoW value needs to be copied |
| [Object Pool](/patterns/object-pool/) | Pools provide an alternative to reference counting — return objects instead of freeing |
| [Tombstone](/patterns/tombstone/) | Tombstones defer cleanup like reference counting defers deallocation |
| [Arena Allocator](/patterns/arena-allocator/) | Arenas avoid per-object reference counting by freeing everything at scope end |

## Challenge Questions

::: details Q1: Object A references B, and B references A. Both have refcount 2. You drop your handle to A. What happens?
**Answer:** Memory leak. Dropping your handle to A decrements A's refcount to 1 (B still references A). A's refcount never reaches 0, so A is never freed. Since A is never freed, it never drops its reference to B, so B's refcount stays at 1 forever.

This is the **reference cycle problem** — the fundamental weakness of reference counting. Solutions: (1) use weak references for back-pointers (Rust's `Weak<T>`, Python's `weakref`), (2) add a cycle-detecting GC on top (CPython does this), (3) redesign to avoid cycles entirely.
:::

::: details Q2: CPython uses refcounting as its primary GC strategy, yet it still has a cycle collector. Why not just use refcounting alone?
**Answer:** Reference counting alone cannot reclaim reference cycles. Any data structure with mutual references (parent-child, graph edges, closures capturing `self`) would leak.

CPython's cycle collector (`gc` module) periodically walks objects that *could* form cycles (containers like lists, dicts, objects with `__dict__`) and identifies unreachable groups. The refcount handles the ~95% of objects that don't participate in cycles, making the cycle collector's job lighter. This hybrid approach gives deterministic cleanup for most objects while still handling cycles.
:::

::: details Q3: Rust's `Arc` uses `fetch_add(1, Relaxed)` for Clone but `fetch_sub(1, Release)` for Drop. Why different memory orderings?
**Answer:** Clone only needs to ensure the counter is incremented — no data is accessed or freed, so `Relaxed` (cheapest ordering) suffices. The counter just needs to go up atomically.

Drop is different: before freeing the resource, all previous writes by all threads must be visible. `Release` on the decrement ensures that the thread doing the final cleanup (which uses an `Acquire` fence) sees all data written by every thread that ever held a reference. Without this, the destructor might read stale data.

On x86 (Total Store Ordering), both `Relaxed` and `Release` RMW operations compile to the same `lock xadd` instruction — the distinction is free on x86. The ordering matters on weakly-ordered architectures like ARM, where `Release` requires a store barrier. Rust uses `Relaxed` for clone and `Release` for drop to ensure correctness across all architectures.
:::

::: details Q4: You're building a resource pool. Should you use reference counting or a finalizer/destructor?
**Answer:** Neither alone is ideal for pools. Reference counting triggers cleanup at zero, but "cleanup" for a pooled resource should mean "return to pool," not "destroy."

The correct pattern is: wrap the pool item in a ref-counted handle where the "cleanup" callback returns the item to the pool instead of freeing it. This is exactly how database connection pools work — `Drop` on the handle returns the connection rather than closing it. The pool itself manages actual destruction (e.g., on shutdown or when connections are stale).
:::
