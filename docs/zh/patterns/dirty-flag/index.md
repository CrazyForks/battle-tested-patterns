---
description: '在变更时将对象标记为"脏"，延迟昂贵的重计算直到值真正被需要时再执行，然后清除标记。'
difficulty: "beginner"
---

# 模式：脏标记 (Dirty Flag)

<DifficultyBadge />

## 一句话

在变更时将对象标记为"脏"，延迟昂贵的重计算直到值真正被需要时再执行，然后清除标记。

<DemoBadge />

## 现实类比

酒店房间门上的「需要打扫」标牌。客房服务只进标记为脏的房间。如果客人没用过房间，标牌保持干净，客房服务直接跳过——零浪费。

## 核心思想

脏标记模式通过追踪派生状态是否过期来避免冗余计算。当源值改变时，不立即重新计算所有依赖值，而只是设置一个"脏"标记。昂贵的重计算仅在派生值被实际请求时才发生。重计算后清除标记。这以每次读取时的布尔检查换取可能永远不需要的昂贵计算。

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

| 属性 | 值 |
|------|------|
| 变更代价 | O(1) -- 仅设置布尔标记 |
| 读取代价（干净） | O(1) -- 返回缓存值 |
| 读取代价（脏） | O(recompute) -- 计算 + 缓存 + 清除标记 |
| 空间 | 每个追踪值 O(1) -- 一个布尔标记 |

**动手试试** — 移动实体将其标记为脏，然后重新计算观察优化节省：

<DirtyFlagViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Chromium/Blink | [layout_object.h#L1425-L1430](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/layout/layout_object.h#L1425-L1430) | `NeedsLayout()` 返回布局对象的几何是否脏。CSS 属性变更时，`SetNeedsLayout()` 将节点及祖先标记为脏。布局计算仅在下一个布局阶段执行——不会在每次样式变更时触发。这将数百次 DOM 变更批处理为单次布局计算。 |
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

运行练习：`pnpm test`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

Exercise files: Rust `exercises/rust/src/dirty_flag.rs` · Go `exercises/go/dirty_flag_test.go` · Python `exercises/python/test_dirty_flag.py`

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
- [Qt Framework](https://github.com/qt/qtbase/blob/dev/src/widgets/kernel/qwidget.cpp) -- `QWidget::update()` 标记区域为脏；绘制在下一次事件循环迭代中发生
- [Make](https://www.gnu.org/software/make/) -- 文件修改时间作为脏标记；仅重建源文件更新的目标
- [Excel/Google Sheets](https://support.google.com) -- 带脏传播的单元格依赖图；仅重计算变化的子图

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [观察者 / 发布-订阅 (Observer / Pub-Sub)](/zh/patterns/observer/) | 观察者在状态变更时通知；脏标记将反应延迟到需要时 |
| [位掩码 (Bitmask)](/zh/patterns/bitmask/) | 脏标记作为位掩码中的位高效存储 |
| [依赖图 (Dependency Graph)](/zh/patterns/dependency-graph/) | 脏传播沿依赖图边标记下游节点 |
| [双缓冲 (Double Buffering)](/zh/patterns/double-buffering/) | 脏标记追踪哪个缓冲区已更改并需要交换 |

## 挑战题

::: details Q1: 一个场景图有 1000 个节点。根节点移动，使所有子孙节点变脏。但本帧实际只渲染 3 个节点。会发生多少次重新计算？
**答案：** 3 次重新计算（加上每个被渲染节点的祖先节点）。

将 1000 个节点标记为脏的开销是 O(1000)——只是翻转布尔值。但重新计算只在节点的 `getWorldPosition()` 被调用时才发生。只有 3 个被渲染的节点会触发重新计算，每个节点向上遍历到根节点计算其变换链。如果这 3 个节点共享祖先节点，那些祖先只计算一次并缓存（标记清除）。

这是关键洞察：脏标记的开销与**被读取**的节点数成正比，而非与**被标脏**的节点数成正比。
:::

::: details Q2: React 用 Placement|Update 等标志标记 fiber 节点。为什么使用 Bitmask 标志而不是简单的布尔脏标记？
**答案：** 多种正交的"脏"类型。

一个 fiber 节点可能需要 placement（新 DOM 节点）、update（props 变更）、deletion、ref 更新或 layout effect——全都是独立的。单个布尔值只能说"有东西变了"。Bitmask 标志编码了**什么**变了，这样 commit 阶段可以分别处理每种工作而无需重新检查 fiber。

这是 Dirty Flag 模式和 Bitmask 模式的组合——每个位是针对特定关注点的独立脏标记。
:::

::: details Q3: 你的脏标记缓存有一个 bug：`get()` 返回了过期数据。标记设置是正确的。什么出了问题？
**答案：** 计算函数捕获了过期的闭包或引用。

常见原因：

1. 计算函数闭包捕获了一个后来被重新赋值的变量（例如 React 中的过期闭包）。
2. 计算函数从一个本身就是过期的缓存/记忆化源中读取。
3. 脏标记在计算完成之前就被清除了（异步计算）。

修复：确保计算函数在调用时读取当前值，而不是注册时捕获的值。在 React 中，这就是为什么 `useMemo` 需要依赖数组——当依赖变化时它会创建新的计算函数。
:::

::: details Q4: 你的构建系统使用文件修改时间戳作为脏标记。一个开发者切换到旧分支，导致文件时间戳被重置为"当前时间"。构建系统将所有文件视为"脏"并触发完整重建。你如何修复？
**答案：** 用内容哈希替代（或辅以）时间戳作为脏标记。

时间戳检查成本低但语义脆弱——它追踪的是文件*何时*变更，而非*是否*真正变更。Git checkout、文件复制、CI 产物解压和时钟偏移都会产生误导性时间戳。基于内容的脏标记（如文件的 SHA-256）不受这些问题影响：如果哈希匹配，文件就没有变更，不管它的时间戳是什么。这就是 Bazel 和 Buck 使用内容哈希而非时间戳的原因。权衡在于计算哈希比 `stat()` 更昂贵，但对构建系统而言，不必要的重编译成本远超哈希计算成本。
:::
