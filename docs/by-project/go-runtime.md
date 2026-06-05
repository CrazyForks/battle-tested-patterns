---
description: "Go runtime patterns: work stealing, object pool, cooperative scheduling, semaphore, free list, flyweight, and arena allocator."
---

# Patterns from Go

Go's runtime and standard library demonstrate clean, practical pattern implementations.

| Pattern | Where in Go | What It Does |
|---------|------------|--------------|
| [Cooperative Scheduling](/patterns/cooperative-scheduling/) | [`runtime/proc.go`](https://github.com/golang/go/blob/master/src/runtime/proc.go#L4143-L4200) | Goroutine scheduling with cooperative preemption points |
| [Bitmask](/patterns/bitmask/) | [`os/types.go`](https://github.com/golang/go/blob/master/src/os/types.go#L32-L46) | `FileMode` — Unix permission flags via typed constants with `iota` |
| [Object Pool](/patterns/object-pool/) | [`sync/pool.go`](https://github.com/golang/go/blob/master/src/sync/pool.go#L52-L97) | `sync.Pool` — per-P local pools with lock-free fast path, used in `fmt`, `encoding/json` |
| [Work Stealing](/patterns/work-stealing/) | [`runtime/proc.go`](https://github.com/golang/go/blob/master/src/runtime/proc.go#L3836-L3903) | `stealWork` — goroutine scheduler steals from other P's run queues via `runqsteal`/`runqgrab` |
| [Free List](/patterns/free-list/) | [`runtime/mfixalloc.go`](https://github.com/golang/go/blob/master/src/runtime/mfixalloc.go#L31-L109) | `fixalloc` — fixed-size free-list allocator with intrusive `mlink` nodes |
| [LRU Cache](/patterns/lru-cache/) | [groupcache `lru/lru.go`](https://github.com/golang/groupcache/blob/master/lru/lru.go#L23-L104) | `Cache` struct with doubly linked list + hash map, by Brad Fitzpatrick |
| [Consistent Hashing](/patterns/consistent-hashing/) | [groupcache `consistenthash.go`](https://github.com/golang/groupcache/blob/master/consistenthash/consistenthash.go#L28-L81) | Hash ring with virtual nodes for distributed caching |
| [Rate Limiter](/patterns/rate-limiter/) | [`x/time/rate`](https://github.com/golang/time/blob/master/rate/rate.go#L57-L66) | Token bucket rate limiter in the extended standard library |
| [Semaphore](/patterns/semaphore/) | [`x/sync/semaphore`](https://github.com/golang/sync/blob/master/semaphore/semaphore.go#L28-L107) | Weighted semaphore — used internally by `errgroup` for goroutine concurrency limiting |
| [Flyweight](/patterns/flyweight/) | [`sync/pool.go`](https://github.com/golang/go/blob/master/src/sync/pool.go#L52-L97) | `sync.Pool` as flyweight — `Get()` returns a cached instance instead of allocating, `Put()` returns it for reuse |
| [Arena Allocator](/patterns/arena-allocator/) | [`arena/arena.go`](https://github.com/golang/go/blob/master/src/arena/arena.go#L44-L67) | Experimental arena allocator — `New[T]()` allocates, `Free()` releases everything at once bypassing GC |

## How They Compose: Goroutine Scheduling

When you launch `go func()`, multiple patterns work together to run millions of goroutines on a few OS threads:

<CompositionFlow variant="go-goroutine" />

The GMP model (Goroutines, M threads, P processors) is the glue: each P owns a local run queue, a free-list allocator, and a sync.Pool shard. Work stealing only kicks in when a P runs dry. This design means most operations are lock-free on the fast path, and contention only happens during stealing — which is the rare case by design.

## Further Reading

- [Go Source Code (GitHub)](https://github.com/golang/go)
- [Go Runtime Package Docs](https://pkg.go.dev/runtime)
