---
title: 'Case Study: How Go Composes Three Patterns to Schedule Goroutines'
description: A deep dive into how Go's runtime combines a cooperative scheduler, work stealing, and per-P object pools to run millions of goroutines on a few threads — every claim backed by source code at a pinned commit.
---

# Case Study: How Go Composes Three Patterns to Schedule Goroutines

> **What this is.** Most pattern docs teach one pattern in isolation. This case
> study does the opposite: it dissects how one real system — Go's runtime
> scheduler (the GMP model) — composes **three** patterns so that millions of
> goroutines run on a handful of OS threads, lock-free on the fast path. Every
> per-pattern claim links to source code at a pinned commit; the composition
> argument is backed by Go's own design documentation.

## The Problem Go Solves

A goroutine is supposed to feel free: `go func()` should cost almost nothing, and
a program should be able to spawn hundreds of thousands of them. But OS threads
are expensive (megabytes of stack, kernel scheduling overhead), so Go cannot map
one goroutine to one thread. It must multiplex *many* goroutines onto *few*
threads — and do so without a global lock that every `go` statement contends on.

Go's answer is the **GMP model**: **G**oroutines run on **M** OS threads, each
driven by a **P** (logical processor) that owns a local run queue. Making this
fast — cheap spawning, balanced load, minimal contention — requires three
patterns working together. None is novel alone; what is instructive is *how they
compose*.

| Question | Pattern | How Go answers it |
|----------|---------|-------------------|
| *How does one thread pick what to run next?* | **Cooperative scheduling** | `schedule()` loops, finds a runnable G, and Gs yield at safe points |
| *How do we keep all threads busy without a global lock?* | **Work stealing** | An idle P steals goroutines from another P's queue |
| *How do we avoid allocating on every reuse?* | **Object pool** | Per-P `sync.Pool` shards hand back cached objects lock-free |

## Pattern 1 — Cooperative scheduling: the per-thread loop

Each M (thread) runs `schedule()`, the heart of the runtime. It finds the next
runnable goroutine and switches to it; goroutines give the thread back at safe
points (function preludes, channel ops, syscalls) rather than being hard-preempted
on every instruction.

```go
func schedule() {
  mp := getg().m
  // ...guards: not holding locks, not in cgo, handle locked g...
  // find a runnable goroutine (local queue, global queue, or steal),
  // then execute it on this M.
}
```

The loop's job is "what runs next on *this* thread". It first checks the P's own
local run queue (the cheap, common case), then the global queue, and only if both
are empty does it reach for the next pattern.

::: tip Mental model
Think of each P as a worker with its own to-do list (the local run queue).
`schedule()` is the worker repeatedly grabbing the next task off its own list.
Because the list is P-local, taking a task needs no global lock — that is the
whole point of giving each P its own queue.
:::

→ For the pattern in isolation, see [Cooperative Scheduling](/patterns/cooperative-scheduling/).

## Pattern 2 — Work stealing: balancing without a central queue

If every P only ever drained its own queue, an unlucky P could sit idle while
another is overloaded. A single shared queue would fix balance but reintroduce
the global lock. Go's resolution is **work stealing**: when a P's local queue is
empty, it tries to *steal* goroutines from another P.

```go
func stealWork(now int64) (gp *g, inheritTime bool, rnow, pollUntil int64, newWork bool) {
  pp := getg().m.p.ptr()
  const stealTries = 4
  for i := 0; i < stealTries; i++ {
    // walk other Ps in a randomized order; try to grab half of a victim's queue
    for enum := stealOrder.start(cheaprand()); !enum.done(); enum.next() {
      // ...runqsteal from allp[enum.position()]...
    }
  }
}
```

The key design choices: the victim order is **randomized** (so thieves don't all
pile onto P0), it steals **half** the victim's queue (so the work, and future
steals, are amortized), and it only happens **on the slow path** — when a P has
nothing of its own to do. Contention is therefore the rare case *by design*.

::: tip Mental model
Work stealing is "idle workers help busy ones, on their own initiative." No
manager hands out work; an empty-handed P walks over to a random colleague and
takes half their pile. The fast path (your own queue) stays lock-free; the lock
only appears during the rare steal.
:::

→ For the pattern in isolation, see [Work Stealing](/patterns/work-stealing/).

## Pattern 3 — Object pool: per-P caches that avoid allocation

Scheduling millions of goroutines means churning through short-lived temporary
objects (buffers in `fmt`, `encoding/json`, etc.). Allocating and GC-ing each one
would dominate the cost. `sync.Pool` solves this with the **same per-P sharding
idea** as the scheduler: each P has its own pool shard, so `Get`/`Put` are
lock-free on the fast path.

```go
type Pool struct {
  noCopy noCopy
  local     unsafe.Pointer // per-P fixed-size pool, actual type is [P]poolLocal
  localSize uintptr        // size of the local array
  victim     unsafe.Pointer // local from previous GC cycle
  victimSize uintptr
  New func() any           // optional factory when the pool is empty
}
```

The `local` field is an array indexed by P. A goroutine running on P*i* touches
only `local[i]`, so concurrent `Get`/`Put` from different Ps never contend. The
`victim` field is a one-GC-cycle grace buffer that smooths out reuse across GC.

::: tip Mental model
`sync.Pool` is the scheduler's per-P philosophy applied to *memory* instead of
*work*: shard by P so the common case is lock-free, and only fall back to a
shared/slow path under contention or GC. Recognising the same sharding idea in
two subsystems is the mark of reading a runtime deeply.
:::

→ For the pattern in isolation, see [Object Pool](/patterns/object-pool/).

## How the Three Compose

Launch `go func()` and the three patterns hand off around the P:

1. **Cooperative scheduling** (`schedule()`) drains *this* P's local run queue —
   the lock-free fast path that handles the overwhelming majority of switches.
2. **Work stealing** (`stealWork()`) only fires when that local queue is empty,
   rebalancing load by grabbing half of a random victim P's queue.
3. **Object pool** (`sync.Pool`) shards by the *same* P, so the temporary objects
   that scheduling and user code churn through are reused without allocation or a
   global lock.

```text
go func()  ──► enqueue G on current P's local run queue
                         │
                         ▼
        schedule() drains P-local queue   ◄── fast path, lock-free
                         │  (empty?)
                         ▼
        stealWork(): grab half of a random P's queue  ◄── slow path, rare
                         │
        (running goroutines reuse temporaries via)
                         ▼
        sync.Pool local[P]  ◄── per-P shard, lock-free Get/Put
```

The unifying idea is **per-P ownership**: give each logical processor its own run
queue and its own pool shard, so the common case touches only P-local state and
needs no lock. A global structure (or lock) only appears on the rare slow paths —
stealing when a P runs dry, or the shared pool under GC. Remove any one pattern
and it breaks: without the cooperative per-P loop there is no lock-free fast path;
without stealing, load imbalance starves some Ps; without per-P pools, allocation
and GC dominate the very workloads the scheduler is trying to make cheap.

::: info Architectural inference
The framing of these patterns as a *deliberately composed* design — unified by
per-P ownership — rests on Go's own scheduler design documentation (see Further
Reading), not on any single source file. The per-pattern code links are direct
source-code evidence; the "combined by design" claim is supported by that
design-level material.
:::

## Production Proof

All source links are pinned to Go commit
`f5cdf4745455415c7a43cfc7d925214d4511489b`. Per-pattern claims are
`source-code` (L1); the composition relationship is backed by official
documentation (`official-doc`).

| Pattern / Claim | Source | Evidence | Role in GMP scheduling |
|-----------------|--------|----------|------------------------|
| Cooperative scheduling | [proc.go#L4143-L4200](https://github.com/golang/go/blob/f5cdf4745455415c7a43cfc7d925214d4511489b/src/runtime/proc.go#L4143-L4200) | source-code | `schedule()` — the per-M loop that finds and runs the next goroutine |
| Work stealing | [proc.go#L3836-L3903](https://github.com/golang/go/blob/f5cdf4745455415c7a43cfc7d925214d4511489b/src/runtime/proc.go#L3836-L3903) | source-code | `stealWork()` — an idle P steals half of a random victim P's run queue |
| Object pool | [sync/pool.go#L52-L97](https://github.com/golang/go/blob/f5cdf4745455415c7a43cfc7d925214d4511489b/src/sync/pool.go#L52-L97) | source-code | `Pool` struct — per-P `local` shards give lock-free `Get`/`Put` |
| Composition (by design) | [proc.go#L25-L36 (scheduler design comment)](https://github.com/golang/go/blob/f5cdf4745455415c7a43cfc7d925214d4511489b/src/runtime/proc.go#L25-L36) | source-code | The runtime's own header comment defining the G/M/P model the three patterns serve |
| Goroutines & concurrency | [Effective Go — Concurrency](https://go.dev/doc/effective_go#concurrency) | official-doc | Official explanation of goroutines multiplexed onto OS threads |

## Takeaways

- **Patterns rarely ship alone.** A runtime scheduler needs a *control-flow*
  pattern (cooperative scheduling), a *balancing* pattern (work stealing), and a
  *memory* pattern (object pool) at once — and they hand off around the P.
- **One idea can unify a subsystem.** Per-P ownership is the single principle
  behind the local run queue *and* the `sync.Pool` shard. Spotting one idea in
  two places is what deep source reading buys you.
- **Design the fast path lock-free; let contention be the rare case.** Go's
  scheduler is fast not because stealing is fast, but because stealing almost
  never happens — the P-local fast path dominates.
- **This echoes React Fiber.** Both schedule work cooperatively (yield at safe
  points rather than hard-preempt). Comparing the two cooperative schedulers
  across languages sharpens the pattern.

## Further Reading

A path from "I read this" to "I can recognise these patterns anywhere":

1. **Start with the design comment** — the runtime's own
   [G/M/P header comment in proc.go](https://github.com/golang/go/blob/f5cdf4745455415c7a43cfc7d925214d4511489b/src/runtime/proc.go#L25-L36)
   defines the model and explains *why* scheduler state is distributed per-P.
   Read this first; the rest of the source then confirms it.
2. **Get the concurrency model** — [Effective Go: Concurrency](https://go.dev/doc/effective_go#concurrency)
   frames goroutines as cheap, multiplexed onto threads.
3. **Then read the source, in this order** — the per-P loop
   ([schedule](https://github.com/golang/go/blob/f5cdf4745455415c7a43cfc7d925214d4511489b/src/runtime/proc.go#L4143-L4200))
   → how an idle P rebalances
   ([stealWork](https://github.com/golang/go/blob/f5cdf4745455415c7a43cfc7d925214d4511489b/src/runtime/proc.go#L3836-L3903))
   → the same per-P idea applied to memory
   ([sync.Pool](https://github.com/golang/go/blob/f5cdf4745455415c7a43cfc7d925214d4511489b/src/sync/pool.go#L52-L97)).
4. **Compare across languages** — read the [React Fiber case study](/case-studies/react-fiber)
   and contrast its cooperative scheduler with Go's. Same pattern, different
   constraints (browser frame budget vs. OS threads).
5. **Practise the recognition** — open the three pattern pages below and look for
   "shard by worker, lock-free fast path, rare slow path" in another system.

## Study These Patterns

- [Cooperative Scheduling](/patterns/cooperative-scheduling/) — yield at safe points
- [Work Stealing](/patterns/work-stealing/) — idle workers steal from busy ones
- [Object Pool](/patterns/object-pool/) — reuse instead of allocate
