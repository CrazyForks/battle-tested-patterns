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

Before Fiber (React 15 and earlier), reconciliation — React's process of
diffing the new component tree against the old one to decide which DOM nodes to
change — was recursive and **synchronous**: once React started walking the
component tree to compute updates, it could not stop until it finished. On a
large tree, that single uninterruptible call stack could occupy the main thread
for tens of milliseconds — long enough to drop animation frames, delay clicks,
and introduce visible input latency. The browser has one main thread; if React
holds it, nothing else (paint, input, layout) can happen.

Fiber (shipped in React 16, refined through React 18) re-architected
reconciliation around one idea: **make rendering interruptible**. To interrupt
work and resume it later, React needed to stop relying on the JavaScript call
stack (which you cannot pause) and instead model work as **data** it controls.
A "fiber" is exactly that — a plain object representing one unit of work, with
pointers to its parent, child, and sibling, so React can walk the tree with a
loop instead of recursion.

Once work is data in a loop, three questions appear, and each is answered by a
classic pattern:

| Question | Pattern | How Fiber answers it |
|----------|---------|----------------------|
| *What does each unit of work need doing?* | **Bitmask** | A `flags` integer per fiber; one bit per effect, bubbled up the tree |
| *Which work runs next?* | **Min-heap** | A priority queue keyed by expiration time; O(1) peek of the most urgent |
| *When do we stop and let the browser breathe?* | **Cooperative scheduling** | A work loop that checks a deadline between units and yields |

The rest of this study takes each in turn — first the pattern, then its exact
role in Fiber with the source to prove it — and finally shows the one ~30-line
function where all three meet.

## Pattern 1 — Bitmask: the language of "what needs doing"

Bitmask shows up in Fiber **twice**, for two different jobs. Seeing both is the
fastest way to understand why React reaches for it so often.

### 1a. Side-effect flags

Each fiber node carries a `flags` field describing the work it needs in the
commit phase: placement, update, deletion, ref attachment, and so on. React
stores these as a **bitmask** — one integer where each bit is a distinct effect.

```js
export const NoFlags = /*        */ 0b0000000000000000000000000000000;
export const Placement = /*      */ 0b0000000000000000000000000000010;
export const Update = /*         */ 0b0000000000000000000000000000100;
export const ChildDeletion = /*  */ 0b0000000000000000000000000010000;
```

Two properties make this the right encoding during reconciliation:

- **Combine** several effects on one node with a single `|=` — no array, no
  dedup, no allocation.
- **Bubble** a subtree's effects toward the root so a later pass knows, in one
  comparison, whether a whole subtree can be skipped.

The bubbling is not hand-waving — it is a literal loop in `completeWork`. As
React finishes each fiber, `bubbleProperties` ORs every child's flags into the
parent's `subtreeFlags`:

```js
function bubbleProperties(completedWork) {
  let subtreeFlags = NoFlags;
  let child = completedWork.child;
  while (child !== null) {
    subtreeFlags |= child.subtreeFlags;   // child's whole subtree
    subtreeFlags |= child.flags;          // child itself
    child = child.sibling;
  }
  completedWork.subtreeFlags |= subtreeFlags;
}
```

Now the commit phase can ask "does this subtree contain any mutations?" with a
single masked compare — `finishedWork.subtreeFlags & MutationMask` — and prune
entire branches that have no work. On a tree of thousands of nodes, that is the
difference between a per-node array merge and a handful of integer ORs.

::: tip Mental model
Think of `flags` as a node's *to-do list* compressed into one integer, and
`subtreeFlags` as a *cached summary* of every to-do list beneath it. The summary
is what lets React skip clean branches in O(1) instead of re-walking them.
:::

### 1b. Lane priorities

The same idea encodes **priority**. React's "lanes" model represents update
priorities as bits in an integer — 31 lanes, from `SyncLane` (most urgent) down
to idle work:

```js
export const TotalLanes = 31;
export const NoLanes      = 0b0000000000000000000000000000000;
export const SyncLane     = 0b0000000000000000000000000000010;
export const DefaultLane  = 0b0000000000000000000000000100000;
```

Because lanes are bits, React can hold *a set of pending priorities* in one
integer, merge them with OR, and extract the most urgent with bit tricks
(`getHighestPriorityLanes`). The priority then flows through **three steps**
before it reaches the heap:

1. **lane** — the reconciler reasons in lanes (a bitmask).
2. **Scheduler level** — the chosen lane maps to one of the Scheduler's coarse
   priority levels (e.g. `ImmediatePriority`, `NormalPriority`).
3. **expiration time** — the Scheduler turns that level into a concrete
   expiration time, which becomes the task's `sortIndex` — the key the
   min-heap (next section) orders on.

So the hand-off is: **bitmask (lanes) picks the priority; the heap orders by the
resulting expiration time.**

For a concrete trace: a click handler's update is tagged `SyncLane` → maps to
`ImmediatePriority` → becomes a very small (near-zero) expiration time → so its
task sorts to the very top of the min-heap and runs before any
lower-priority work. A background update would get a larger expiration time and
sit lower in the heap.

→ For the pattern in isolation, see [Bitmask](/patterns/bitmask/).

## Pattern 2 — Min-heap: ordering the work

Fiber's scheduler keeps a queue of tasks, each tagged with a `sortIndex`
(derived from the lane's expiration time). The next task to run is always the
one expiring soonest. A **min-heap** gives O(1) access to that minimum and
O(log n) insert/remove — the right trade-off for a queue where tasks are
constantly added and popped.

```js
export function push(heap, node) { /* append + siftUp */ }
export function peek(heap) { return heap.length === 0 ? null : heap[0]; }
export function pop(heap)  { /* swap root with last + siftDown */ }
```

`peek()` is the hot path: on every scheduling tick the work loop peeks the heap
to decide what to do next, without paying to re-sort. The whole heap is ~75
lines — `push` sifts a new node up, `pop` swaps the root with the last element
and sifts down. No balancing, no pointers, just an array.

::: tip Mental model
Why a heap and not a sorted array? A sorted array gives O(1) peek too, but O(n)
insert (shift everything). React inserts and removes tasks *constantly*, so it
needs cheap insert **and** cheap peek — that is precisely a heap's trade. (A
balanced BST would also work but costs more per operation and is cache-hostile;
see the Min Heap pattern's Challenge Questions for the CFS-vs-React contrast.)
:::

→ For the pattern in isolation, see [Min Heap](/patterns/min-heap/).

## Pattern 3 — Cooperative scheduling: yielding the thread

The work loop pulls the highest-priority task off the heap and runs it — but
**checks a deadline between units of work**. If the current time slice (~5ms)
has elapsed and the task has not expired, it `break`s out of the loop and
schedules a continuation, handing the main thread back to the *host* (the
browser environment) so it can paint and process input before React resumes.

```js
function workLoop(initialTime) {
  let currentTime = initialTime;
  currentTask = peek(taskQueue);            // ← uses the min-heap
  while (currentTask !== null) {
    if (currentTask.expirationTime > currentTime && shouldYieldToHost()) {
      break;                                // ← cooperative yield
    }
    // ...run the task's callback; if it returns a continuation, keep it...
    currentTask = peek(taskQueue);
  }
}
```

This is **voluntary** yielding: nothing preempts React — React itself decides to
stop. Two things gate the decision: a task that has already *expired* runs to
completion regardless (urgent work is never starved), while non-expired work
yields the moment `shouldYieldToHost()` says the slice is up. The continuation
is posted via `MessageChannel`, so the browser gets a real turn before React
picks up where it left off.

> The snippet above is simplified. The real condition also checks
> `hasTimeRemaining`, and the ~5ms slice is `shouldYieldToHost()`'s own deadline
> (the `frameInterval`), not the `expirationTime > currentTime` comparison —
> that comparison only decides whether *this* task may be deferred at all.

::: tip Mental model
Cooperative scheduling is "render a little, look up, render a little." Compare it
to a long-running task that hogs the CPU: the OS can *preempt* a thread, but the
browser cannot preempt your JavaScript. So React simulates preemption by
checking the clock itself and choosing to stop — cooperation in place of
interruption.
:::

→ For the pattern in isolation, see [Cooperative Scheduling](/patterns/cooperative-scheduling/).

## How the Three Compose

Read the `workLoop` above once more — it is where all three meet, and the order
of the hand-offs is the whole design:

1. **Bitmask (lanes)** turns "what changed and how urgent" into a priority,
   which becomes a task's expiration time.
2. **Min-heap** orders tasks by that expiration time and answers *what runs
   next* in O(1) (`peek(taskQueue)`).
3. **Cooperative scheduling** runs that task in bounded slices and decides *when
   to stop* (`shouldYieldToHost()`).
4. **Bitmask (flags)** is *what each unit of work manipulates* — as the loop
   processes a fiber it reads and writes that fiber's `flags`, and
   `bubbleProperties` ORs `subtreeFlags` toward the root so the later commit
   phase knows, in one masked compare, exactly which branches to touch.

```text
lane priority (bitmask)
        │  becomes expirationTime
        ▼
   min-heap  ──peek()──►  highest-priority task
        ▲                        │
        │                        ▼
   push/pop            workLoop runs it in ≤5ms slices
   as work arrives              │  shouldYieldToHost()? → break, continue later
                                ▼
                    fiber.flags / subtreeFlags (bitmask)
                    mark + bubble what the commit phase must do
```

The result is a renderer that processes a **prioritised** queue, in
**interruptible** slices, where the state of "what still needs doing" is a
**cheap integer** per node. Remove any one pattern and the design collapses:
without lanes there is no priority to sort on; without the heap there is no
cheap "what's most urgent"; without yielding it is back to blocking; without the
flags bitmask, the commit phase must re-discover work by walking the whole tree.

::: info Architectural inference
The framing of these patterns as a *deliberately composed* design — rather than
independent implementation details — rests on the React team's own design
writing (see Further Reading and the composition rows below), not on any single
source file. The per-pattern code links are direct source-code evidence; the
"combined by design" claim is supported by that design-level material.
:::

## Production Proof

All source links are pinned to React commit
`34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4`. Per-pattern claims are
`source-code` (L1); the composition relationship is backed by design-level
evidence (`official-doc`).

| Pattern / Claim | Source | Evidence | Role in Fiber |
|-----------------|--------|----------|---------------|
| Bitmask (flags) | [ReactFiberFlags.js#L14-L36](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/react-reconciler/src/ReactFiberFlags.js#L14-L36) | source-code | Side-effect flags encoded as bits (`Placement`, `Update`, `ChildDeletion`…) |
| Bitmask (bubble) | [ReactFiberCompleteWork.js#L791-L815](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/react-reconciler/src/ReactFiberCompleteWork.js#L791-L815) | source-code | `bubbleProperties` ORs child `subtreeFlags`/`flags` into the parent |
| Bitmask (lanes) | [ReactFiberLane.js#L41-L54](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/react-reconciler/src/ReactFiberLane.js#L41-L54) | source-code | 31 priority lanes encoded as bits (`SyncLane`, `DefaultLane`…) |
| Lane → priority selection | [ReactFiberLane.js#L249-L321](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/react-reconciler/src/ReactFiberLane.js#L249-L321) | source-code | `getNextLanes` picks the highest-priority pending lanes via bit tricks |
| Min-heap | [SchedulerMinHeap.js#L17-L90](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/scheduler/src/SchedulerMinHeap.js#L17-L90) | source-code | `push`/`peek`/`pop` + `siftUp`/`siftDown`; O(1) peek of highest-priority task |
| Cooperative scheduling | [Scheduler.js#L188-L258](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/scheduler/src/forks/Scheduler.js#L188-L258) | source-code | `workLoop` peeks the heap, runs tasks, and yields when the time slice elapses |
| Composition (by design) | [react-fiber-architecture](https://github.com/acdlite/react-fiber-architecture) | official-doc | Andrew Clark's canonical Fiber design write-up: unit-of-work + priority model |
| Composition (by design) | [React 18 Working Group #27](https://github.com/reactwg/react-18/discussions/27) | official-doc | React team discussion of cooperative rendering / time-slicing |
| Render vs commit phases | [react.dev — Render and Commit](https://react.dev/learn/render-and-commit) | official-doc | Official explanation of the two phases the flags bitmask connects |

## Takeaways

- **Patterns rarely ship alone.** A real renderer needs a *data* pattern
  (bitmask), an *ordering* pattern (min-heap), and a *control-flow* pattern
  (cooperative scheduling) at once — and they hand off to each other in a
  specific order.
- **The same primitive can do two jobs.** Bitmask encodes both *what work* a
  node needs (flags) and *how urgent* an update is (lanes). Recognising one
  primitive in two roles is a mark of reading source deeply.
- **Each pattern earns its place by a property.** Flags: cheap combine + bubble.
  Lanes: a priority set in one integer. Heap: O(1) peek of the min. Cooperative
  scheduling: bounded main-thread occupancy.
- **The hot path reveals the architecture.** `workLoop` is ~30 lines and touches
  all three — reading the hot path of a real system is often the fastest way to
  understand how its patterns interlock.

## Further Reading

A suggested path to go from "I read this" to "I can see these patterns in any
codebase":

1. **Start with the mental model** — [react.dev: Render and Commit](https://react.dev/learn/render-and-commit)
   gives the official two-phase framing (render = compute, commit = apply) that
   the flags bitmask connects.
2. **Read the canonical design doc** — [react-fiber-architecture](https://github.com/acdlite/react-fiber-architecture)
   by Andrew Clark (a React core maintainer) explains *why* work became data and
   what a "unit of work" is. This is the source for the composition claim.
3. **Follow the React 18 reasoning** — [React 18 Working Group #27](https://github.com/reactwg/react-18/discussions/27)
   shows the team's own words on cooperative rendering and time-slicing.
4. **Then read the source, in this order** — flags
   ([ReactFiberFlags.js](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/react-reconciler/src/ReactFiberFlags.js#L14-L36))
   → how they bubble
   ([bubbleProperties](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/react-reconciler/src/ReactFiberCompleteWork.js#L791-L815))
   → the heap
   ([SchedulerMinHeap.js](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/scheduler/src/SchedulerMinHeap.js#L17-L90))
   → the loop that ties them together
   ([Scheduler.js workLoop](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/scheduler/src/forks/Scheduler.js#L188-L258)).
   Reading code *after* the model means each function confirms something you
   already expect, instead of being a wall of unfamiliar names.
5. **Practise the recognition** — open the three pattern pages below and do their
   exercises; then try to spot the same three roles (data / ordering /
   control-flow) in another system you know.
6. **Go deeper into the mental model** — Dan Abramov's
   [React as a UI Runtime](https://overreacted.io/react-as-a-ui-runtime/)
   (a React core author) frames the whole reconciler as a runtime, which makes
   *why* Fiber needs these three patterns click.

## Study These Patterns

- [Bitmask](/patterns/bitmask/) — compact flag encoding
- [Min Heap](/patterns/min-heap/) — priority queue with O(1) peek
- [Cooperative Scheduling](/patterns/cooperative-scheduling/) — yielding the thread
