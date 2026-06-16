---
title: 'Case Study: How React Fiber Composes Three Patterns'
description: A deep dive into how React's Fiber reconciler combines bitmask flags, a min-heap scheduler, and cooperative scheduling — every claim backed by source code at a pinned commit.
---

# Case Study: How React Fiber Composes Three Patterns

> **What this is.** Most pattern docs teach one pattern in isolation. This case
> study does the opposite: it dissects how a single real system — React's Fiber
> reconciler — composes **three** patterns to render without freezing the main
> thread. Every per-pattern claim links to source code at a pinned commit; the
> composition argument is backed by the React team's own design writing.

## The Problem Fiber Solves

Before Fiber (React 15 and earlier), reconciliation was recursive and
**synchronous**: once React started walking the component tree to compute
updates, it could not stop until it finished. On a large tree, that single
uninterruptible task could occupy the main thread for tens of milliseconds —
long enough to drop animation frames and make input feel laggy.

Fiber (shipped in React 16, refined through React 18) re-architected
reconciliation so that work can be **split into units, paused, resumed, and
prioritised**. Achieving that required three distinct techniques working
together. None of them is novel on its own — what is instructive is *how they
compose*.

| Pattern | Job in Fiber |
|---------|--------------|
| **Bitmask** | Encode each fiber's pending side-effects compactly, and bubble them up the tree cheaply |
| **Min-heap** | Always pick the highest-priority pending task next, in O(1) peek |
| **Cooperative scheduling** | Yield the main thread back to the browser every few milliseconds |

## Pattern 1 — Bitmask: encoding side-effects

Each fiber node carries a `flags` field describing what work it needs:
placement, update, deletion, ref attachment, and so on. React stores these as a
**bitmask** — one integer where each bit is a distinct effect.

```js
export const NoFlags = /*        */ 0b0000000000000000000000000000000;
export const Placement = /*      */ 0b0000000000000000000000000000010;
export const Update = /*         */ 0b0000000000000000000000000000100;
export const ChildDeletion = /*  */ 0b0000000000000000000000000010000;
```

Two properties make this the right choice during reconciliation:

- **Combine** multiple effects on one node with a single `|=`.
- **Bubble** a subtree's effects into its parent with `parent.subtreeFlags |= child.subtreeFlags | child.flags`, then ask "does this subtree need any work?" with one `subtreeFlags !== NoFlags` comparison — instead of walking arrays of strings across thousands of nodes per frame.

→ For the pattern in isolation, see [Bitmask](/patterns/bitmask/).

## Pattern 2 — Min-heap: ordering the work

Fiber's scheduler maintains a queue of tasks, each tagged with a priority
(an expiration time). The next task to run is always the one expiring soonest.
A **min-heap** gives O(1) access to that minimum and O(log n) insert/remove —
the right trade-off for a queue where tasks are constantly added and popped.

```js
export function push(heap, node) { /* append + siftUp */ }
export function peek(heap) { return heap.length === 0 ? null : heap[0]; }
export function pop(heap)  { /* swap root with last + siftDown */ }
```

`peek()` is the hot path: on every scheduling tick, the work loop peeks the
heap to decide what to do next. The entire heap is ~75 lines.

→ For the pattern in isolation, see [Min Heap](/patterns/min-heap/).

## Pattern 3 — Cooperative scheduling: yielding the thread

The work loop pulls the highest-priority task off the heap and runs it — but
**checks the clock between units of work**. If the current time slice (~5ms) has
elapsed and the task has not expired, it `break`s out of the loop and schedules
a continuation, handing the main thread back to the browser so it can paint and
process input.

```js
function workLoop(initialTime) {
  let currentTime = initialTime;
  currentTask = peek(taskQueue);            // ← uses the min-heap
  while (currentTask !== null) {
    if (currentTask.expirationTime > currentTime && shouldYieldToHost()) {
      break;                                // ← cooperative yield
    }
    // ...run the task's callback...
  }
}
```

This is voluntary, cooperative yielding: nothing preempts React; React itself
decides to stop. The `shouldYieldToHost()` check is what keeps long renders
from blocking the frame.

→ For the pattern in isolation, see [Cooperative Scheduling](/patterns/cooperative-scheduling/).

## How the Three Compose

Read the `workLoop` above again — it is where all three meet:

1. **Min-heap** decides *what* runs next (`peek(taskQueue)`).
2. **Cooperative scheduling** decides *when to stop* (`shouldYieldToHost()`).
3. **Bitmask** is *what each unit of work manipulates* — as the loop processes a
   fiber, it reads and writes that fiber's `flags`, and bubbles `subtreeFlags`
   toward the root so a later pass knows where work remains.

The result is a renderer that processes a prioritised queue, in interruptible
slices, where the state of "what still needs doing" is a cheap integer per node.
Remove any one pattern and the design collapses: without the heap there is no
prioritisation; without yielding it is back to blocking; without the bitmask,
bubbling effects across a large tree becomes a per-node array merge.

::: info Architectural inference
The framing of these three as a *deliberately composed* design — rather than
three independent implementation details — rests on the React team's own design
writing, not on any single source file. See the composition evidence below
(React Fiber Architecture and the React 18 working group). The per-pattern code
links are direct source-code evidence; the "they were combined by design" claim
is supported by that design-level material.
:::

## Production Proof

All source links are pinned to React commit
`34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4`. Per-pattern claims are
`source-code` (L1). The composition relationship is backed by design-level
evidence (`official-doc`).

| Pattern / Claim | Source | Evidence | Role in Fiber |
|-----------------|--------|----------|---------------|
| Bitmask | [ReactFiberFlags.js#L14-L36](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/react-reconciler/src/ReactFiberFlags.js#L14-L36) | source-code | Side-effect flags encoded as bits (`Placement`, `Update`, `ChildDeletion`…) |
| Min-heap | [SchedulerMinHeap.js#L17-L90](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/scheduler/src/SchedulerMinHeap.js#L17-L90) | source-code | `push`/`peek`/`pop` + `siftUp`/`siftDown`; O(1) peek of highest-priority task |
| Cooperative scheduling | [Scheduler.js#L188-L258](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/scheduler/src/forks/Scheduler.js#L188-L258) | source-code | `workLoop` peeks the heap, runs tasks, and yields when the time slice elapses |
| Composition (by design) | [react-fiber-architecture](https://github.com/acdlite/react-fiber-architecture) | official-doc | Andrew Clark's canonical Fiber design write-up describing the unit-of-work + priority model |
| Composition (by design) | [React 18 Working Group](https://github.com/reactwg/react-18/discussions/27) | official-doc | React team discussion of cooperative rendering / time-slicing in React 18 |

## Takeaways

- **Patterns rarely ship alone.** A real renderer needs a *data* pattern
  (bitmask), an *ordering* pattern (min-heap), and a *control-flow* pattern
  (cooperative scheduling) at once.
- **Each pattern earns its place by a property.** Bitmask: cheap combine +
  bubble. Min-heap: O(1) peek of the min. Cooperative scheduling: bounded
  main-thread occupancy.
- **The hot path reveals the architecture.** `workLoop` is ~30 lines and touches
  all three — reading the hot path of a real system is often the fastest way to
  understand how its patterns interlock.

## Study These Patterns

- [Bitmask](/patterns/bitmask/) — compact flag encoding
- [Min Heap](/patterns/min-heap/) — priority queue with O(1) peek
- [Cooperative Scheduling](/patterns/cooperative-scheduling/) — yielding the thread
