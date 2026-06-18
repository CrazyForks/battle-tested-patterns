---
title: 'Case Study: How Redis Composes Three Patterns to Stay Fast on One Thread'
description: A deep dive into how Redis combines an event loop, copy-on-write fork snapshots, and LRU eviction so a single-threaded server stays fast, persists data, and bounds memory — every claim backed by source code at a pinned commit.
---

# Case Study: How Redis Composes Three Patterns to Stay Fast on One Thread

> **What this is.** Most pattern docs teach one pattern in isolation. This case
> study does the opposite: it dissects how one real system — Redis, the
> in-memory data store — composes **three** patterns so that a *single-threaded*
> server can serve hundreds of thousands of operations per second, snapshot its
> data to disk without pausing, and keep memory bounded. Every per-pattern claim
> links to source code at a pinned commit; the composition argument is backed by
> Redis's own documentation.

## The Problem Redis Solves

Redis keeps the entire dataset in RAM and executes commands on **one thread**.
That sounds like a bottleneck, yet Redis routinely beats multi-threaded,
disk-backed databases. The single thread is actually the source of its speed: no
locks, no context switches, no cache-line contention between cores. A command is
just a memory operation, and memory operations are nanoseconds.

> Redis 6+ can use extra threads for *network I/O* (reading and parsing requests,
> writing replies — the `io-threads` option). But the part that mutates data —
> **command execution** — is still strictly single-threaded. That is the thread
> this case study is about.

But one thread is also a liability. If *anything* blocks that thread — waiting on
a slow client socket, writing a multi-gigabyte snapshot to disk, or scanning
millions of keys to free memory — the *whole server* stalls. So Redis's real
engineering problem is: **how do you do everything a database must do (I/O,
persistence, memory management) without ever blocking the one thread that runs
commands?** Three patterns answer three halves of that question.

| Question | Pattern | How Redis answers it |
|----------|---------|----------------------|
| *How does one thread serve thousands of clients without blocking on I/O?* | **Event loop** | `aeMain` loops, asking the kernel (epoll/kqueue) which sockets are ready |
| *How do we snapshot GBs to disk without pausing command execution?* | **Copy-on-write** | `fork()` a child; the OS shares pages and copies only what changes |
| *How do we keep memory bounded without an expensive global scan?* | **LRU eviction** | Sample keys, approximate idle time, evict the coldest under `maxmemory` |

## Pattern 1 — Event loop: one thread, many sockets

The heart of Redis is `aeMain`: a single `while` loop that runs until the server
stops. Each turn calls `aeProcessEvents`, which asks the kernel "which of my
sockets are ready?" and dispatches the ready ones.

```c
void aeMain(aeEventLoop *eventLoop) {
    eventLoop->stop = 0;
    while (!eventLoop->stop) {
        aeProcessEvents(eventLoop, AE_ALL_EVENTS|
                                   AE_CALL_BEFORE_SLEEP|
                                   AE_CALL_AFTER_SLEEP);
    }
}
```

The "which sockets are ready" question is answered by **I/O multiplexing**. Inside
`aeProcessEvents`, Redis calls `aeApiPoll` — a thin wrapper over `epoll` (Linux),
`kqueue` (BSD/macOS), or `select`. These are OS facilities that let one thread
watch thousands of sockets at once and block until *any* of them has data. The
kernel blocks the thread *only* until at least one socket is ready, then returns
the ready set. The thread never spins, and never blocks on a single slow client.

```c
int aeProcessEvents(aeEventLoop *eventLoop, int flags)
{
    int processed = 0, numevents;
    // ...
    numevents = aeApiPoll(eventLoop, tvp);  // epoll/kqueue: who's ready?
    // ...dispatch each ready fd to its handler...
}
```

::: tip Mental model
Picture one waiter for a whole restaurant. Instead of standing at one table until
it finishes (blocking), the waiter scans *all* tables and only walks over to the
ones with a raised hand. `aeApiPoll` is that scan; the kernel raises the hands.
One thread serves everyone because it never waits on any single table.
:::

→ For the pattern in isolation, see [Event Loop](/patterns/event-loop/).

## Pattern 2 — Copy-on-write: snapshot without pausing

Redis persists by snapshotting RAM to an `.rdb` file. Writing gigabytes to disk
takes seconds — an eternity for the command thread. Blocking it would freeze
every client. Redis's answer is to *not write from the main thread at all*: it
calls `fork()`, and the **child** process writes the snapshot while the **parent**
keeps serving commands.

```c
int rdbSaveBackground(int req, char *filename, rdbSaveInfo *rsi, int rdbflags) {
    pid_t childpid;
    // ...
    if ((childpid = redisFork(CHILD_TYPE_RDB)) == 0) {
        /* Child */
        int retval = rdbSave(req, filename, rsi, rdbflags);
        if (retval == C_OK) {
            sendChildCowInfo(CHILD_INFO_TYPE_RDB_COW_SIZE, "RDB");
        }
        exitFromChild((retval == C_OK) ? 0 : 1);
    } else {
        /* Parent keeps serving clients... */
    }
}
```

The magic is **copy-on-write**, provided by the OS. `redisFork()` (a thin wrapper
over the `fork()` system call) does *not* copy the dataset; parent and child share
the same physical memory pages, marked read-only. The child reads them to write
the snapshot. Only when the parent *modifies* a key does the kernel copy that one
page — so Redis tracks how much got copied and reports it as `RDB_COW_SIZE`, a
useful signal of how much the dataset churned during the save. A snapshot of a
10 GB dataset starts in microseconds and copies only the pages that change during
the save, not all 10 GB.

::: tip Mental model
`fork()` does not hand the child a real copy of memory — it hands it the *same*
pages, shared and frozen read-only. The child writes those shared pages to disk at
its leisure; the moment the parent mutates a key, the kernel quietly duplicates
just that one page so the child still sees the old value. The command thread never
pauses for I/O.
:::

→ For the pattern in isolation, see [Copy-on-write](/patterns/copy-on-write/).

## Pattern 3 — LRU eviction: bound memory without a global scan

RAM is finite. When an eviction policy is configured and Redis reaches its
`maxmemory` limit, it must free space before accepting new writes. (The default
policy is `noeviction`, which simply rejects writes with an error instead — but
when a policy like `allkeys-lru` is set, Redis must evict.) It cannot afford to
sort *all* keys by access time (that would be O(n) and block the thread). Instead
it **samples**: pick a handful of keys, estimate how long each has been idle, and
evict the coldest.

```c
int performEvictions(void) {
    if (!isSafeToPerformEvictions()) return EVICT_OK;
    int keys_freed = 0;
    size_t mem_reported, mem_tofree;
    // ...while over maxmemory: sample keys into a pool, evict the best candidate...
}
```

The "how cold is this key" question uses an **approximate LRU clock**. Each object
stores a coarse timestamp; `estimateObjectIdleTime` subtracts it from a global
clock to estimate idle time — no per-access bookkeeping, no linked list to
maintain on the hot path. (The global clock is a fixed-width counter that wraps
around back to zero, so the `else` branch below handles the wraparound case.)

```c
unsigned long long estimateObjectIdleTime(robj *o) {
    unsigned long long lruclock = LRU_CLOCK();
    if (lruclock >= o->lru) {
        return (lruclock - o->lru) * LRU_CLOCK_RESOLUTION;
    } else {
        return (lruclock + (LRU_CLOCK_MAX - o->lru)) *
                    LRU_CLOCK_RESOLUTION;
    }
}
```

Redis trades exactness for speed: it does not guarantee evicting the *globally*
coldest key, just a *very cold* one from a small sample. With a default sample of
a few keys plus a pool of best candidates carried across calls, the approximation
is close to true LRU — at O(1) per eviction instead of O(n).

::: tip Mental model
True LRU keeps a sorted list and pays on every access. Redis instead grabs a
random handful of keys and evicts the coldest of *those*. It's like clearing your
desk by glancing at five random papers and tossing the dustiest — not perfect,
but fast, and good enough at scale. Sampling turns an O(n) sort into O(1) work.
:::

→ For the pattern in isolation, see [LRU Cache](/patterns/lru-cache/).

## How the Three Compose

Every one of these patterns exists to protect the *same* scarce resource: the
single command thread. They guard it on three different fronts.

```text
            ┌──────────────────────────────────────────────┐
            │           the one command thread             │
            └──────────────────────────────────────────────┘
                 ▲                ▲                  ▲
   I/O won't ────┘   persistence ─┘    memory growth ┘ won't
   block it:         won't block it:    block it:
   EVENT LOOP        COPY-ON-WRITE      LRU EVICTION
   (aeApiPoll waits  (fork(): child     (sample + evict,
    in the kernel,    writes snapshot;   O(1), never an
    never on one      parent keeps       O(n) global scan)
    slow socket)      serving)
```

1. **Event loop** keeps *I/O* off the critical path: the thread blocks in the
   kernel waiting for *any* ready socket, never on one slow client.
2. **Copy-on-write** keeps *persistence* off the critical path: a forked child
   writes the snapshot against a cheap, shared-page photograph of memory while the
   parent thread keeps executing commands.
3. **LRU eviction** keeps *memory management* off the critical path: sampling
   makes "free some memory" an O(1) operation instead of an O(n) scan that would
   stall the thread.

The unifying idea is **never block the one thread**. Single-threaded execution is
what makes Redis fast (lock-free, no contention), but it only works if every
potentially slow operation is either *delegated* (I/O to the kernel, snapshots to
a child process) or *approximated* (eviction by sampling instead of sorting).
Remove any one and the model breaks: without the event loop, one slow socket
freezes everyone; without COW, every save pauses the server for seconds; without
sampled eviction, an eviction policy hitting `maxmemory` would trigger an O(n) scan
that stalls commands.

::: info Architectural inference
The framing of these patterns as a *deliberately composed* design — unified by
"protect the single thread" — rests on Redis's own documentation (see Further
Reading), not on any single source file. The per-pattern code links are direct
source-code evidence; the "combined by design" claim is supported by that
design-level material.
:::

## Production Proof

All source links are pinned to Redis commit
`e91a340e241cf0abe3c6a0c254214fbe4aa1d95f` (tag `8.0.0`). Per-pattern claims are
`source-code` (L1); the composition relationship is backed by official
documentation (`official-doc`).

| Pattern / Claim | Source | Evidence | Role in Redis |
|-----------------|--------|----------|---------------|
| Event loop | [ae.c#L492-L499](https://github.com/redis/redis/blob/e91a340e241cf0abe3c6a0c254214fbe4aa1d95f/src/ae.c#L492-L499) | source-code | `aeMain` — the single `while` loop driving the whole server |
| Event loop (I/O multiplexing) | [ae.c#L360-L398](https://github.com/redis/redis/blob/e91a340e241cf0abe3c6a0c254214fbe4aa1d95f/src/ae.c#L360-L398) | source-code | `aeProcessEvents` calls `aeApiPoll` (epoll/kqueue) to find ready sockets |
| Copy-on-write | [rdb.c#L1642-L1662](https://github.com/redis/redis/blob/e91a340e241cf0abe3c6a0c254214fbe4aa1d95f/src/rdb.c#L1642-L1662) | source-code | `rdbSaveBackground` — `redisFork()` lets a child snapshot via OS copy-on-write |
| LRU eviction | [evict.c#L521-L530](https://github.com/redis/redis/blob/e91a340e241cf0abe3c6a0c254214fbe4aa1d95f/src/evict.c#L521-L530) | source-code | `performEvictions` — free memory under `maxmemory` by sampling candidates |
| LRU eviction (idle estimate) | [evict.c#L73-L79](https://github.com/redis/redis/blob/e91a340e241cf0abe3c6a0c254214fbe4aa1d95f/src/evict.c#L73-L79) | source-code | `estimateObjectIdleTime` — approximate LRU from a coarse per-object clock |
| Single-threaded design | [Redis FAQ — single threaded](https://redis.io/docs/latest/develop/reference/faq/) | official-doc | Official explanation of why command execution is single-threaded |

## Takeaways

- **Patterns rarely ship alone.** Staying fast on one thread needs an *I/O*
  pattern (event loop), a *persistence* pattern (copy-on-write), and a *memory*
  pattern (LRU eviction) at once — each removing a different way the thread could
  block.
- **One constraint can unify a system.** "Never block the single thread" is the
  single principle behind delegating I/O to the kernel, snapshots to a child, and
  eviction to sampling. Spotting one idea behind three subsystems is what deep
  source reading buys you.
- **Delegate or approximate — don't block.** Slow work is either handed off (I/O
  to the kernel, saves to a forked child) or made cheap by approximation
  (sampled eviction). Redis is fast because the thread always has something it can
  do *right now*.
- **This echoes Node.js.** Both build on a single-threaded event loop over
  epoll/kqueue. Comparing Redis (a database) with Node (a runtime) shows the same
  reactor pattern solving different problems.

## Further Reading

A path from "I read this" to "I can recognise these patterns anywhere":

1. **Start with the model** — the
   [Redis FAQ on single-threading](https://redis.io/docs/latest/develop/reference/faq/)
   explains *why* command execution uses one thread, the premise everything else
   protects. Read this first; the source then shows *how* it's protected.
2. **Understand persistence** — the
   [Redis persistence docs](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)
   describe RDB snapshots and why a forked child (copy-on-write) does the writing.
3. **Understand eviction** — the
   [key-eviction docs](https://redis.io/docs/latest/develop/reference/eviction/)
   cover `maxmemory`, the LRU/LFU policies, and the sampling approximation.
4. **Then read the source, in this order** — the loop
   ([aeMain](https://github.com/redis/redis/blob/e91a340e241cf0abe3c6a0c254214fbe4aa1d95f/src/ae.c#L492-L499))
   → the snapshot fork
   ([rdbSaveBackground](https://github.com/redis/redis/blob/e91a340e241cf0abe3c6a0c254214fbe4aa1d95f/src/rdb.c#L1642-L1662))
   → memory bounding
   ([performEvictions](https://github.com/redis/redis/blob/e91a340e241cf0abe3c6a0c254214fbe4aa1d95f/src/evict.c#L521-L530)).
5. **Compare across systems** — read the [Node.js request case study](/case-studies/nodejs-request)
   and contrast its event loop with Redis's. Same reactor pattern, different
   purpose (a runtime serving callbacks vs. a database serving commands).
6. **Practise the recognition** — open the three pattern pages below and look for
   "delegate the slow work, keep the hot path free" in another system.

## Study These Patterns

- [Event Loop](/patterns/event-loop/) — one thread, many sockets via multiplexing
- [Copy-on-write](/patterns/copy-on-write/) — share pages, copy only on mutation
- [LRU Cache](/patterns/lru-cache/) — evict the coldest, approximate with sampling
