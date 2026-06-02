# How Patterns Connect

These patterns don't exist in isolation. The most interesting insight is how production systems **compose** them together.

## React: All Five Patterns in One System

React's reconciler is a masterclass in pattern composition. Here's how the five patterns from this collection work together in a single render cycle:

```mermaid
flowchart TD
    A["User triggers setState"] --> B["Scheduler (Min Heap)"]
    B -->|"picks highest-priority task"| C["workLoopConcurrent (Cooperative Scheduling)"]
    C -->|"yields every 5ms"| D{"shouldYield?"}
    D -->|"no"| E["Process next fiber"]
    D -->|"yes"| F["Yield to browser"] --> C
    E --> G["Compare old vs new children (Diff/Patch)"]
    G --> H["Mark fiber flags (Bitmask)"]
    H --> I["Bubble subtreeFlags up"]
    I --> C
    C -->|"all fibers processed"| J["Commit phase"]
    J --> K["Swap current ↔ workInProgress (Double Buffering)"]
```

| Step | Pattern | What happens |
|------|---------|-------------|
| 1 | **Min Heap** | `setState` enqueues an update. The scheduler's min heap picks the task with the earliest expiration time. |
| 2 | **Cooperative Scheduling** | `workLoopConcurrent` processes fibers one by one, checking `shouldYieldToHost()` every iteration. If 5ms have passed, it yields and reschedules. |
| 3 | **Diff / Patch** | For each fiber, `reconcileChildFibers` diffs the old and new children, deciding which to keep, insert, or delete. |
| 4 | **Bitmask** | Side effects are recorded as bit flags (`Placement \| Update \| Ref`). `subtreeFlags` bubble up via OR so the commit phase can skip clean subtrees. |
| 5 | **Double Buffering** | React maintains two fiber trees — `current` and `workInProgress`. After all work is done, they swap atomically. The old current becomes the new workInProgress (recycled, not GC'd). |

## Why This Matters

Understanding individual patterns is useful. Understanding how they **compose** is what separates a senior engineer from a junior one.

When you see a performance problem, you don't think "I need a bitmask." You think "I need to track multiple states cheaply (bitmask), skip work that hasn't changed (subtree flags), process work incrementally (cooperative scheduling), prioritize urgent work (min heap), and avoid allocation on the hot path (double buffering)."

That's what React's team built. That's what you can learn from here.

## Beyond React: Patterns Across Systems

The remaining five patterns show up in completely different domains, yet often compose with the ones above:

```mermaid
flowchart TD
    subgraph "Server / Backend"
        OP["Object Pool"] -->|"reuse connections"| RB["Ring Buffer"]
        RB -->|"buffer log events"| OB["Observer"]
        OB -->|"notify subscribers"| SM["State Machine"]
    end
    subgraph "Data Layer"
        COW["Copy-on-Write"] -->|"branch on mutation"| SM
    end
```

| Pattern | Composes With | Example |
|---------|--------------|---------|
| **Object Pool** | Ring Buffer | A pool of pre-allocated buffers fed into a ring buffer for zero-alloc I/O (LMAX Disruptor does exactly this) |
| **Ring Buffer** | Observer | Log events written to a ring buffer, observers consume them asynchronously (Linux ftrace) |
| **State Machine** | Observer | State transitions emit events; observers react to state changes (XState + React) |
| **Copy-on-Write** | Double Buffering | Both defer the cost of duplication — CoW at the data level, double buffering at the structure level (Git + React Fiber) |
| **Observer** | State Machine | Subscribers listen for state transitions; the machine emits events on each change (Redux = state machine + observer) |

## The Bigger Picture

These 10 patterns aren't 10 isolated tricks. They're a **toolkit** that production systems mix and match:

- **React** uses 5 of them in a single render cycle
- **LMAX Disruptor** combines object pool + ring buffer for 6M orders/sec
- **Git** uses copy-on-write + diff/patch for its entire data model
- **Linux kernel** uses bitmask + min heap + ring buffer + state machine across subsystems

Understanding how they compose is what makes the difference between knowing a pattern and knowing when to reach for it.
