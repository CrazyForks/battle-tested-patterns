# 模式：引用计数 (Reference Counting)

## 一句话

通过原子计数器追踪所有者，归零时自动清理——无需垃圾回收的确定性资源生命周期管理。

## 核心思想

引用计数为每个共享资源分配一个计数器。每个新所有者（clone）使计数加一；每次释放（drop）使计数减一。当计数归零时，资源立即被清理——没有 GC 停顿，没有终结器队列，完全确定性。

```text
  ┌────────────┐
  │  Resource   │   refcount = 1
  │  (value)    │
  └─────┬──────┘
        │
     owner A

  A.clone() → B
  ┌────────────┐
  │  Resource   │   refcount = 2
  │  (value)    │
  └──┬─────┬───┘
     │     │
  owner A  owner B

  A.drop()
  ┌────────────┐
  │  Resource   │   refcount = 1
  │  (value)    │
  └─────┬──────┘
        │
     owner B

  B.drop()
  ┌────────────┐
  │  Resource   │   refcount = 0 → cleanup()!
  │  (value)    │
  └────────────┘
```

| 属性 | 值 |
|------|------|
| Clone | O(1) -- 计数器加一 |
| Drop | O(1) -- 计数器减一，条件性清理 |
| 清理触发 | 确定性——最后一个所有者 drop 时立即触发 |
| 线程安全 | 多线程使用需要原子操作（或互斥锁） |

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| CPython | [refcount.h#L255-L310](https://github.com/python/cpython/blob/main/Include/refcount.h#L255-L310) | `Py_INCREF`（L255-L310）是递增 `ob_refcnt` 的内联函数。`Py_DECREF`（L417-L430）递减并在归零时调用 `_Py_Dealloc`。每个 Python 对象在 `PyObject`（[object.h](https://github.com/python/cpython/blob/main/Include/object.h)）中携带 `ob_refcnt`。这是主要的内存管理机制——GC 仅用于打破引用循环。 |
| Rust std | [sync.rs#L269-L276](https://github.com/rust-lang/rust/blob/master/library/alloc/src/sync.rs#L269-L276) | `Arc<T>`（原子引用计数）结构体定义在 L269。`Drop` 实现（L2799-L2875）对强计数调用 `fetch_sub(1, Release)`，Acquire 屏障，归零时调用 `drop_slow()`。在 Tokio、Actix 和操作系统级 Rust 代码中广泛使用。 |

## 实现

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

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带 clone/drop 和清理回调的引用计数值 | `exercises/typescript/reference-counting/01-basic.test.ts` |
| 进阶 | 扩展弱引用，不阻止清理 | `exercises/typescript/reference-counting/02-intermediate.test.ts` |

## 何时使用

- **需要确定性清理的共享所有权** -- 代码的多个部分需要同一资源，且需要在最后一个用户完成时立即释放（文件句柄、GPU 缓冲区、数据库连接）
- **避免 GC 停顿** -- 实时系统（游戏、音频）中无法接受 stop-the-world GC
- **跨语言互操作** -- CPython 的引用计数让 C 扩展自然管理 Python 对象；COM 在 DLL 边界使用 `AddRef`/`Release`
- **短期共享状态** -- 对象主要由一处拥有但偶尔短暂共享（Rust 的 `Rc`/`Arc` 模式）

## 何时不用

- **循环数据结构** -- 父子循环（如双向链表、图节点）会泄漏，因为计数永远不会归零。使用弱引用或追踪式 GC。
- **高竞争共享** -- 如果多个线程频繁 clone/drop 同一对象，原子计数器会成为缓存行瓶颈。考虑基于 epoch 的回收或风险指针。
- **批量分配模式** -- 如果分配/释放数千个小对象，每个对象的计数器增加额外开销。使用 arena 分配替代。

## 更多生产案例

- [Swift ARC](https://github.com/apple/swift) -- Swift 的整个内存模型基于自动引用计数（编译器插入的 retain/release）
- [COM IUnknown](https://learn.microsoft.com/en-us/windows/win32/api/unknwn/nn-unknwn-iunknown) -- Windows 中每个 COM 对象的 `AddRef`/`Release`
- [Linux kernel kobject](https://github.com/torvalds/linux/blob/master/lib/kobject.c) -- `kref` 为内核对象提供引用计数
- [Objective-C ARC](https://clang.llvm.org/docs/AutomaticReferenceCounting.html) -- 编译器管理的 `retain`/`release` 调用

## 挑战题

::: details Q1: Object A references B, and B references A. Both have refcount 2. You drop your handle to A. What happens?
**Answer:** Memory leak. Dropping your handle to A decrements A's refcount to 1 (B still references A). A's refcount never reaches 0, so A is never freed. Since A is never freed, it never drops its reference to B, so B's refcount stays at 1 forever.

This is the **reference cycle problem** -- the fundamental weakness of reference counting. Solutions: (1) use weak references for back-pointers (Rust's `Weak<T>`, Python's `weakref`), (2) add a cycle-detecting GC on top (CPython does this), (3) redesign to avoid cycles entirely.
:::

::: details Q2: CPython uses refcounting as its primary GC strategy, yet it still has a cycle collector. Why not just use refcounting alone?
**Answer:** Reference counting alone cannot reclaim reference cycles. Any data structure with mutual references (parent-child, graph edges, closures capturing `self`) would leak.

CPython's cycle collector (`gc` module) periodically walks objects that *could* form cycles (containers like lists, dicts, objects with `__dict__`) and identifies unreachable groups. The refcount handles the ~95% of objects that don't participate in cycles, making the cycle collector's job lighter. This hybrid approach gives deterministic cleanup for most objects while still handling cycles.
:::

::: details Q3: Rust's `Arc` uses `fetch_add(1, Relaxed)` for Clone but `fetch_sub(1, Release)` for Drop. Why different memory orderings?
**Answer:** Clone only needs to ensure the counter is incremented -- no data is accessed or freed, so `Relaxed` (cheapest ordering) suffices. The counter just needs to go up atomically.

Drop is different: before freeing the resource, all previous writes by all threads must be visible. `Release` on the decrement ensures that the thread doing the final cleanup (which uses an `Acquire` fence) sees all data written by every thread that ever held a reference. Without this, the destructor might read stale data.

This is a classic performance optimization -- `Relaxed` is essentially free on x86, while `Release` involves a store barrier.
:::

::: details Q4: You're building a resource pool. Should you use reference counting or a finalizer/destructor?
**Answer:** Neither alone is ideal for pools. Reference counting triggers cleanup at zero, but "cleanup" for a pooled resource should mean "return to pool," not "destroy."

The correct pattern is: wrap the pool item in a ref-counted handle where the "cleanup" callback returns the item to the pool instead of freeing it. This is exactly how database connection pools work -- `Drop` on the handle returns the connection rather than closing it. The pool itself manages actual destruction (e.g., on shutdown or when connections are stale).
:::
