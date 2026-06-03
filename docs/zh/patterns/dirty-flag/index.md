# 模式：脏标记 (Dirty Flag)

## 一句话

在变更时将对象标记为"脏"，延迟昂贵的重计算直到值真正被需要时再执行，然后清除标记。

## 核心思想

脏标记模式通过追踪派生状态是否过期来避免冗余计算。当源值改变时，不立即重新计算所有依赖值，而只是设置一个"脏"标记。昂贵的重计算仅在派生值被实际请求时才发生。重计算后清除标记。这以每次读取时的布尔检查换取可能永远不需要的昂贵计算。

```text
  Mutation cycle:

  ┌─────────┐   set()    ┌─────────────┐
  │  Clean  │ ──────────► │    Dirty    │
  │ (valid  │             │ (stale      │
  │  cache) │             │  cache)     │
  └─────────┘             └──────┬──────┘
       ▲                         │
       │         get()           │
       │    (recompute + clear)  │
       └─────────────────────────┘

  Timeline:
  set(x)  set(y)  set(z)  get()     set(w)  get()
    │       │       │       │          │       │
    ▼       ▼       ▼       ▼          ▼       ▼
   dirty  dirty   dirty  recompute  dirty  recompute
                          (1 time)          (1 time)
                           ▲                  ▲
            3 mutations,   │   1 mutation,    │
            1 computation ─┘   1 computation ─┘
```

| 属性 | 值 |
|------|------|
| 变更代价 | O(1) -- 仅设置布尔标记 |
| 读取代价（干净） | O(1) -- 返回缓存值 |
| 读取代价（脏） | O(recompute) -- 计算 + 缓存 + 清除标记 |
| 空间 | 每个追踪值 O(1) -- 一个布尔标记 |

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Chromium/Blink | [layout_object.h (NeedsLayout)](https://github.com/nicedoc/chromium/blob/main/third_party/blink/renderer/core/layout/layout_object.h#L900-L950) | `NeedsLayout()` 返回布局对象的几何是否脏。CSS 属性变更时，`SetNeedsLayout()` 将节点及祖先标记为脏。布局计算仅在下一个布局阶段执行——不会在每次样式变更时触发。这将数百次 DOM 变更批处理为单次布局计算。 |
| React | [ReactFiberFlags.js#L18-L22](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberFlags.js#L18-L22) | Fiber 标志如 `Placement`、`Update`、`Deletion` 是 fiber 节点上的脏标记。状态变更时，fiber 被标记。提交阶段仅处理具有非零标志的 fiber，完全跳过未变化的子树。 |

## 实现

::: code-group

```typescript [TypeScript]
class DirtyFlag<T> {
  private dirty = true;
  private cached: T | undefined;

  constructor(private compute: () => T) {}

  /** Mark as dirty — next get() will recompute. */
  markDirty(): void {
    this.dirty = true;
  }

  /** Get the value. Recomputes only if dirty. */
  get(): T {
    if (this.dirty) {
      this.cached = this.compute();
      this.dirty = false;
    }
    return this.cached!;
  }

  get isDirty(): boolean {
    return this.dirty;
  }
}

/** A transform node with dirty-flag-based world matrix caching. */
class TransformNode {
  private localX = 0;
  private localY = 0;
  private worldDirty = true;
  private worldX = 0;
  private worldY = 0;
  private children: TransformNode[] = [];
  private parent: TransformNode | null = null;

  setPosition(x: number, y: number): void {
    this.localX = x;
    this.localY = y;
    this.markWorldDirty();
  }

  getWorldPosition(): { x: number; y: number } {
    if (this.worldDirty) {
      if (this.parent) {
        const pw = this.parent.getWorldPosition();
        this.worldX = pw.x + this.localX;
        this.worldY = pw.y + this.localY;
      } else {
        this.worldX = this.localX;
        this.worldY = this.localY;
      }
      this.worldDirty = false;
    }
    return { x: this.worldX, y: this.worldY };
  }

  addChild(child: TransformNode): void {
    child.parent = this;
    this.children.push(child);
    child.markWorldDirty();
  }

  private markWorldDirty(): void {
    this.worldDirty = true;
    for (const child of this.children) {
      child.markWorldDirty();
    }
  }
}
```

```go [Go]
type DirtyFlag[T any] struct {
	dirty   bool
	cached  T
	compute func() T
}

func NewDirtyFlag[T any](compute func() T) *DirtyFlag[T] {
	return &DirtyFlag[T]{dirty: true, compute: compute}
}

func (d *DirtyFlag[T]) MarkDirty() {
	d.dirty = true
}

func (d *DirtyFlag[T]) Get() T {
	if d.dirty {
		d.cached = d.compute()
		d.dirty = false
	}
	return d.cached
}

func (d *DirtyFlag[T]) IsDirty() bool {
	return d.dirty
}
```

```python [Python]
from typing import TypeVar, Generic, Callable

T = TypeVar("T")

class DirtyFlag(Generic[T]):
    def __init__(self, compute: Callable[[], T]):
        self._compute = compute
        self._dirty = True
        self._cached: T | None = None

    def mark_dirty(self) -> None:
        self._dirty = True

    def get(self) -> T:
        if self._dirty:
            self._cached = self._compute()
            self._dirty = False
        return self._cached  # type: ignore

    @property
    def is_dirty(self) -> bool:
        return self._dirty
```

```rust [Rust]
pub struct DirtyFlag<T, F: Fn() -> T> {
    dirty: bool,
    cached: Option<T>,
    compute: F,
}

impl<T, F: Fn() -> T> DirtyFlag<T, F> {
    pub fn new(compute: F) -> Self {
        DirtyFlag { dirty: true, cached: None, compute }
    }

    pub fn mark_dirty(&mut self) {
        self.dirty = true;
    }

    pub fn get(&mut self) -> &T {
        if self.dirty {
            self.cached = Some((self.compute)());
            self.dirty = false;
        }
        self.cached.as_ref().unwrap()
    }

    pub fn is_dirty(&self) -> bool {
        self.dirty
    }
}
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现基于脏标记的惰性计算包装器 | `exercises/typescript/dirty-flag/01-basic.test.ts` |
| 进阶 | 构建带脏标记世界坐标缓存的变换层级 | `exercises/typescript/dirty-flag/02-intermediate.test.ts` |

## 何时使用

- **UI 布局引擎** -- 样式变更时标记节点为脏，批量执行布局计算
- **游戏场景图** -- 脏世界变换从父节点级联到子节点；仅在渲染时重计算
- **电子表格单元格** -- 输入变化时标记依赖单元格为脏，显示时重计算
- **构建系统** -- 源文件变化时标记目标为脏，仅重建需要的部分
- **派生状态缓存** -- 任何计算昂贵且读取频率低于输入变化频率的计算属性

## 何时不用

- **重计算成本低** -- 如果计算只需纳秒级，标记检查反而增加了无益的开销
- **每次变更都需要结果** -- 如果每次写入后都要读取，你只是在每个操作上增加了标记检查
- **无同步的并发** -- 脏标记本质上是可变共享状态；并发读写需要锁或原子操作

## 更多生产案例

- [Unity Engine](https://github.com/Unity-Technologies/UnityCsReference) -- `Transform.hasChanged` 标记延迟世界矩阵重计算
- [Qt Framework](https://github.com/nicedoc/nicedoc.io) -- `QWidget::update()` 标记区域为脏；绘制在下一次事件循环迭代中发生
- [Make](https://www.gnu.org/software/make/) -- 文件修改时间作为脏标记；仅重建源文件更新的目标
- [Excel/Google Sheets](https://support.google.com) -- 带脏传播的单元格依赖图；仅重计算变化的子图

## 挑战题

::: details Q1: A scene graph has 1000 nodes. The root moves, making all descendants dirty. But only 3 nodes are actually rendered this frame. How many recomputations happen?
**Answer:** 3 recomputations (plus ancestors of each rendered node).

Setting 1000 nodes dirty costs O(1000) -- just flipping booleans. But recomputation only happens when `getWorldPosition()` is called on a node. Only the 3 rendered nodes trigger recomputation, and each walks up to the root to compute its chain. If the 3 nodes share ancestors, those ancestors are recomputed once and cached (flag cleared).

This is the key insight: dirty-flag cost is proportional to nodes **read**, not nodes **dirtied**.
:::

::: details Q2: React marks fiber nodes with flags like Placement|Update. Why use bitmask flags instead of a simple boolean dirty flag?
**Answer:** Multiple orthogonal kinds of "dirty."

A fiber node can need a placement (new DOM node), an update (changed props), a deletion, a ref update, or a layout effect -- all independently. A single boolean can only say "something changed." Bitmask flags encode **what** changed, so the commit phase can process each kind of work separately without re-examining the fiber.

This is a combination of the Dirty Flag pattern and the Bitmask pattern -- each bit is an independent dirty flag for a specific concern.
:::

::: details Q3: Your dirty-flag cache has a bug: `get()` returns stale data. The flag is set correctly. What's wrong?
**Answer:** The compute function captures stale closures or references.

Common causes:

1. The compute function closes over a variable that has since been reassigned (stale closure in React, for example).
2. The compute function reads from a cached/memoized source that is itself stale.
3. The dirty flag is cleared before the computation finishes (async compute).

Fix: ensure the compute function reads current values at call time, not captured values from registration time. In React, this is why `useMemo` takes a dependency array -- it creates a new compute function when dependencies change.
:::
