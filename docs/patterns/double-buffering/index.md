---
description: "Maintain two copies of state and atomically swap between them so readers always see a consistent snapshot."
---

# Pattern: Double Buffering

## One Liner

Maintain two copies of state and atomically swap between them so readers always see a consistent snapshot.

<DemoBadge />

## Core Idea

Double buffering keeps two versions of a data structure: one "current" (being read) and one "work-in-progress" (being written). When the write is complete, the two are swapped atomically. This avoids tearing — readers never see a half-updated state.

```mermaid
stateDiagram-v2
    state "Buffer A" as A
    state "Buffer B" as B

    [*] --> A : current (read)
    [*] --> B : work-in-progress (write)
    A --> B : swap
    B --> A : swap
```

After swap: old "current" becomes new "work-in-progress" (reused, not GC'd). The same two objects are recycled forever — **zero allocation** on the hot path.

**Try it yourself** — draw frames and swap buffers to see double buffering prevent tearing:

<DoubleBufferingViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| React | [ReactFiber.js#L327-L355](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiber.js#L327-L355) | `createWorkInProgress` — creates or reuses an alternate fiber. The comment says: *"We use a double buffering pooling technique because we know that we'll only ever need at most two versions of a tree."* `current.alternate = workInProgress` and `workInProgress.alternate = current` establish the mutual link. |
| SDL | [SDL_render.c#L5535-L5570](https://github.com/libsdl-org/SDL/blob/main/src/render/SDL_render.c#L5535-L5570) | `SDL_RenderPresent` — flushes queued render commands, calls the backend's `RenderPresent` to swap front/back buffers for tear-free frame presentation, and handles vsync simulation. |

## Implementation

::: code-group

```typescript [TypeScript]
class DoubleBuffer<T> {
  private buffers: [T, T];
  private currentIndex: 0 | 1 = 0;

  constructor(createBuffer: () => T) {
    this.buffers = [createBuffer(), createBuffer()];
  }

  current(): T {
    return this.buffers[this.currentIndex];
  }

  next(): T {
    return this.buffers[this.currentIndex === 0 ? 1 : 0];
  }

  swap(): void {
    this.currentIndex = this.currentIndex === 0 ? 1 : 0;
  }
}

// React-style fiber double buffering
interface Fiber {
  tag: string;
  pendingProps: Record<string, unknown>;
  memoizedState: unknown;
  alternate: Fiber | null;
}

function createWorkInProgress(current: Fiber, pendingProps: Record<string, unknown>): Fiber {
  let wip = current.alternate;

  if (wip === null) {
    // First render: create the alternate
    wip = {
      tag: current.tag,
      pendingProps,
      memoizedState: current.memoizedState,
      alternate: current,
    };
    current.alternate = wip;
  } else {
    // Subsequent renders: reuse the alternate (zero allocation)
    wip.pendingProps = pendingProps;
    wip.memoizedState = current.memoizedState;
  }

  return wip;
}
```

```rust [Rust]
pub struct DoubleBuffer<T> {
    buffers: [T; 2],
    current: usize,
}

impl<T: Default + Clone> DoubleBuffer<T> {
    pub fn new(init: T) -> Self {
        DoubleBuffer {
            buffers: [init.clone(), init],
            current: 0,
        }
    }

    pub fn current(&self) -> &T {
        &self.buffers[self.current]
    }

    pub fn next(&mut self) -> &mut T {
        &mut self.buffers[1 - self.current]
    }

    pub fn swap(&mut self) {
        self.current = 1 - self.current;
    }
}
```

```go [Go]
type DoubleBuffer[T any] struct {
	buffers [2]T
	current int
}

func NewDoubleBuffer[T any](init T, clone func(T) T) *DoubleBuffer[T] {
	return &DoubleBuffer[T]{
		buffers: [2]T{clone(init), init},
		current: 0,
	}
}

func (db *DoubleBuffer[T]) Current() *T {
	return &db.buffers[db.current]
}

func (db *DoubleBuffer[T]) Next() *T {
	return &db.buffers[1-db.current]
}

func (db *DoubleBuffer[T]) Swap() {
	db.current = 1 - db.current
}
```

```python [Python]
class DoubleBuffer:
    def __init__(self, create_buffer):
        self._buffers = [create_buffer(), create_buffer()]
        self._current = 0

    def current(self):
        return self._buffers[self._current]

    def next(self):
        return self._buffers[1 - self._current]

    def swap(self):
        self._current = 1 - self._current

# Usage
buf = DoubleBuffer(lambda: {"pixels": [0, 0]})
buf.next()["pixels"] = [255, 128]  # write to back buffer
assert buf.current()["pixels"] == [0, 0]  # front unchanged
buf.swap()
assert buf.current()["pixels"] == [255, 128]  # now visible
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a generic double buffer with swap | `exercises/typescript/double-buffering/01-basic.test.ts` |
| Intermediate | Build React-style fiber alternates | `exercises/typescript/double-buffering/02-fiber-alternate.test.ts` |

Run exercises: `pnpm test`

## When to Use

- **Render pipelines** — GPU front/back buffer, game frame rendering
- **Concurrent reads and writes** — readers see consistent state while writers prepare the next version
- **Tree reconciliation** — React's fiber architecture uses this to diff old and new trees
- **Zero-allocation hot paths** — reuse two buffers forever instead of allocating new ones
- **Database MVCC** — readers see a snapshot while writers prepare a new version

## When NOT to Use

- **Simple state updates** — if your state is a single value and updates are atomic, double buffering adds unnecessary complexity
- **Memory-constrained environments** — you're paying 2x memory cost
- **Frequent partial reads** — if readers need real-time access to in-progress writes, double buffering hides updates until the swap

## More Production Uses

- [OpenGL](https://www.khronos.org/opengl/) / Vulkan — swap chains
- [PostgreSQL](https://github.com/postgres/postgres) — MVCC snapshot isolation
- Unreal Engine — frame rendering

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Copy-on-Write (CoW)](/patterns/copy-on-write/) | Both defer mutation costs — double buffering swaps whole copies, CoW copies on write |
| [Ring Buffer (Circular Buffer)](/patterns/ring-buffer/) | Ring buffers can be seen as multi-slot generalizations of double buffering |
| [Dirty Flag](/patterns/dirty-flag/) | Dirty flags track which buffer has changed and needs to be swapped |

## Challenge Questions

::: details Q1: If double buffering eliminates tearing, why do GPUs use triple buffering?
**Answer:** Triple buffering decouples the swap timing from vsync, reducing input latency without reintroducing tearing.

With double buffering and vsync enabled, if the GPU finishes a frame early, it must wait for the next vsync interval before swapping — the CPU/GPU pipeline stalls. A third buffer lets the GPU keep rendering into a spare back buffer while the front buffer waits for vsync. The display always gets the most recently completed frame, so latency drops while tearing stays eliminated.
:::

::: details Q2: A junior developer proposes calling `swap()` in the middle of writing to the back buffer to "publish partial progress." What goes wrong?
**Answer:** This reintroduces the exact tearing problem double buffering is designed to prevent.

The whole point of double buffering is that the swap happens only after the back buffer is fully written. If you swap mid-write, readers now see a half-updated buffer — some pixels from the old frame, some from the new. The invariant is: the back buffer is private to the writer until the swap makes it public atomically.
:::

::: details Q3: React's fiber tree uses double buffering, but it never actually swaps two screen buffers. What is being "swapped" and why does it still qualify?
**Answer:** React swaps which fiber tree is "current" and which is "work-in-progress" by reassigning a single pointer (`root.current = finishedWork`).

The pattern is structural, not visual. React maintains two fiber trees linked via `.alternate`. During rendering, it builds the work-in-progress tree without affecting what is displayed. On commit, it atomically designates the WIP tree as "current." The old current becomes the next WIP tree (recycled, not GC'd). This is the same principle as GPU buffer swapping: prepare privately, publish atomically, recycle the old version.
:::

::: details Q4: Double buffering uses 2x memory. Under what condition does this cost become zero effective overhead?
**Answer:** When you would have needed a separate "scratch" buffer anyway to prepare the next state.

If the alternative to double buffering is allocating a new buffer every frame and discarding the old one, double buffering actually saves memory by reusing two fixed buffers forever. The 2x cost only hurts when compared to an in-place update scenario — and in-place updates risk tearing. So the real cost comparison is: 2 persistent buffers vs. N short-lived allocations plus GC pressure.
:::
