# Pattern: Dirty Flag

## One Liner

Mark objects as "dirty" on mutation, defer expensive recomputation until the value is actually needed, then clear the flag.

## Core Idea

The dirty flag pattern avoids redundant computation by tracking whether derived state is out of date. When a source value changes, instead of immediately recomputing all dependent values, we simply set a "dirty" flag. The expensive recomputation only happens when the derived value is actually requested. After recomputation, the flag is cleared. This trades a boolean check on every read for potentially expensive computations that may never be needed.

```text
  Mutation cycle:

  ┌─────────┐   set()     ┌─────────────┐
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

| Property | Value |
|----------|-------|
| Mutation cost | O(1) -- just set a boolean flag |
| Read cost (clean) | O(1) -- return cached value |
| Read cost (dirty) | O(recompute) -- compute + cache + clear flag |
| Space | O(1) per tracked value -- one boolean flag |

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| Chromium/Blink | [layout_object.h (NeedsLayout)](https://github.com/nicedoc/chromium/blob/main/third_party/blink/renderer/core/layout/layout_object.h#L900-L950) | `NeedsLayout()` returns whether the layout object's geometry is dirty. When CSS properties change, `SetNeedsLayout()` marks the node and ancestors dirty. Layout computation only happens during the next layout pass -- not on every style change. This batches hundreds of DOM mutations into a single layout computation. |
| React | [ReactFiberFlags.js#L18-L22](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberFlags.js#L18-L22) | Fiber flags like `Placement`, `Update`, `Deletion` are dirty flags on fiber nodes. When state changes, fibers are marked with flags. The commit phase only processes fibers with non-zero flags, skipping unchanged subtrees entirely. |

## Implementation

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

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a dirty-flag-based lazy computation wrapper | `exercises/typescript/dirty-flag/01-basic.test.ts` |
| Intermediate | Build a transform hierarchy with dirty-flag world position caching | `exercises/typescript/dirty-flag/02-intermediate.test.ts` |

Run exercises: `pnpm test`

## When to Use

- **UI layout engines** -- mark nodes dirty on style change, batch layout computation
- **Game scene graphs** -- dirty world transforms cascade from parent to children; recompute only when rendered
- **Spreadsheet cells** -- mark dependent cells dirty on input change, recompute on display
- **Build systems** -- mark targets dirty when source files change, rebuild only what's needed
- **Derived state caching** -- any computed property that's expensive and read less often than its inputs change

## When NOT to Use

- **Recomputation is cheap** -- if the computation takes nanoseconds, the flag check adds overhead for no benefit
- **Every mutation requires the result** -- if you always read after every write, you're just adding a flag check to every operation
- **Concurrency without synchronization** -- dirty flags are inherently mutable shared state; concurrent reads and writes need locks or atomics

## More Production Uses

- [Unity Engine](https://github.com/Unity-Technologies/UnityCsReference) -- `Transform.hasChanged` flag defers world matrix recomputation
- [Qt Framework](https://github.com/nicedoc/nicedoc.io) -- `QWidget::update()` marks regions dirty; painting happens in the next event loop iteration
- [Make](https://www.gnu.org/software/make/) -- file modification times as dirty flags; only rebuild targets newer than sources
- [Excel/Google Sheets](https://support.google.com) -- cell dependency graph with dirty propagation; only recalculates changed subgraph

## Challenge Questions

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
