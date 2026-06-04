---
description: "通过原子计数器追踪所有者，归零时自动清理——无需垃圾回收的确定性资源生命周期管理。"
---

# 模式：引用计数 (Reference Counting)

## 一句话

通过原子计数器追踪所有者，归零时自动清理——无需垃圾回收的确定性资源生命周期管理。

<DemoBadge />

## 核心思想

引用计数为每个共享资源分配一个计数器。每个新所有者（clone）使计数加一；每次释放（drop）使计数减一。当计数归零时，资源立即被清理——没有 GC 停顿，没有终结器队列，完全确定性。

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

| 属性 | 值 |
|------|------|
| Clone | O(1) -- 计数器加一 |
| Drop | O(1) -- 计数器减一，条件性清理 |
| 清理触发 | 确定性——最后一个所有者 drop 时立即触发 |
| 线程安全 | 多线程使用需要原子操作（或互斥锁） |

**动手试试** — 丢弃引用减少引用计数，观察 rc=0 时对象被释放：

<ReferenceCountingViz />

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

运行练习：`pnpm test`

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

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [写时复制 (Copy-on-Write)](/zh/patterns/copy-on-write/) | 引用计数决定何时需要复制 CoW 值 |
| [对象池 (Object Pool)](/zh/patterns/object-pool/) | 池提供引用计数的替代方案——归还对象而不是释放 |
| [墓碑 / 延迟删除 (Tombstone)](/zh/patterns/tombstone/) | 墓碑延迟清理，类似引用计数延迟释放 |

## 挑战题

::: details Q1: 对象 A 引用 B，B 引用 A。两者的引用计数都是 2。你释放了对 A 的句柄。会发生什么？
**答案：** 内存泄漏。释放你对 A 的句柄将 A 的引用计数减为 1（B 仍然引用 A）。A 的引用计数永远不会到 0，所以 A 永远不会被释放。由于 A 永远不会被释放，它永远不会释放对 B 的引用，所以 B 的引用计数也永远保持在 1。

这就是**引用循环问题**——引用计数的根本弱点。解决方案：(1) 对反向指针使用弱引用（Rust 的 `Weak<T>`、Python 的 `weakref`），(2) 在上层添加循环检测 GC（CPython 就是这样做的），(3) 重新设计以完全避免循环。
:::

::: details Q2: CPython 使用引用计数作为主要的 GC 策略，但它仍然有循环收集器。为什么不只使用引用计数？
**答案：** 仅靠引用计数无法回收引用循环。任何有相互引用的数据结构（父子关系、图的边、捕获 `self` 的闭包）都会泄漏。

CPython 的循环收集器（`gc` 模块）定期遍历*可能*形成循环的对象（如 list、dict、有 `__dict__` 的对象等容器）并识别不可达的组。引用计数处理约 95% 不参与循环的对象，使循环收集器的工作更轻松。这种混合方法为大多数对象提供确定性清理，同时仍然处理循环。
:::

::: details Q3: Rust 的 `Arc` 在 Clone 时使用 `fetch_add(1, Relaxed)`，但在 Drop 时使用 `fetch_sub(1, Release)`。为什么使用不同的内存序？
**答案：** Clone 只需要确保计数器递增——不访问或释放数据，所以 `Relaxed`（最便宜的内存序）就够了。计数器只需要原子地增加。

Drop 不同：在释放资源之前，所有线程的所有先前写入必须可见。在递减上使用 `Release` 确保执行最终清理的线程（使用 `Acquire` 屏障）能看到每个曾持有引用的线程写入的所有数据。没有这个保证，析构函数可能读到过期数据。

这是经典的性能优化——`Relaxed` 在 x86 上本质上是免费的，而 `Release` 涉及存储屏障。
:::

::: details Q4: 你正在构建一个资源池。应该使用引用计数还是终结器/析构函数？
**答案：** 两者单独都不适合池。引用计数在归零时触发清理，但池化资源的"清理"应该意味着"返回到池中"，而不是"销毁"。

正确的模式是：将池化项包装在引用计数句柄中，其中"清理"回调将项返回到池中而不是释放它。这正是数据库连接池的工作方式——句柄上的 `Drop` 返回连接而不是关闭它。池本身管理实际的销毁（例如在关闭时或连接过期时）。
:::
