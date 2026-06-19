---
title: "Pattern: Event Loop / Reactor"
description: "A single-threaded loop that multiplexes I/O via epoll/kqueue, dispatching ready events to callbacks — thousands of connections without threads."
difficulty: "intermediate"
---

# Pattern: Event Loop / Reactor

<DifficultyBadge />

## One Liner

A single-threaded loop that multiplexes I/O via epoll/kqueue, dispatching ready events to callbacks — thousands of connections without threads.

<DemoBadge />

## Real-World Analogy

A single receptionist handling a busy office. She can't talk to two callers simultaneously, but she puts each on hold, handles quick tasks, and circles back to each caller in turn. Nothing stalls — if a task takes time, she notes it and moves on.

## Core Idea

Instead of dedicating one thread per connection (expensive context switches, high memory), the reactor pattern uses a single thread that blocks on an OS polling mechanism (`epoll`, `kqueue`, `IOCP`). When any registered file descriptor becomes ready, the loop dispatches to the associated callback. This is how Node.js handles 10,000+ concurrent connections on a single thread.

```text
  ┌─────────────────────────────────────────────────┐
  │                  Event Loop                     │
  │                                                 │
  │  ┌──────────┐    ┌──────────┐    ┌──────────┐   │
  │  │ Register │    │  Poll    │    │ Dispatch │   │
  │  │ interest │───►│ (block)  │───►│ ready    │   │
  │  │ (fds)    │    │          │    │ handlers │   │
  │  └──────────┘    └──────────┘    └────┬─────┘   │
  │       ▲                               │         │
  │       └───────────────────────────────┘         │
  │                   repeat                        │
  └─────────────────────────────────────────────────┘

  Phase detail (libuv model):
  ┌────────┐  ┌──────────┐  ┌──────┐  ┌───────┐  ┌───────┐
  │ Timers │─►│ Pending  │─►│ Poll │─►│ Check │─►│ Close │──► next iteration
  │        │  │ callbacks│  │      │  │       │  │       │
  └────────┘  └──────────┘  └──────┘  └───────┘  └───────┘
```

| Property | Value |
|----------|-------|
| Concurrency model | Single-threaded, non-blocking I/O |
| Connections | Thousands per thread (limited by file descriptors, not threads) |
| Latency | Low for I/O-bound work; one slow callback blocks everything |
| Memory | O(connections) for state, not O(connections * stack_size) |

**Try it yourself** — add tasks to the call stack and queues, then step through the event loop execution order:

<EventLoopViz />

::: tip Two "event loops", one name
This page covers the **reactor** sense of the event loop: the OS-level loop in
libuv/Redis that multiplexes I/O across phases (`timers → poll → check → …`),
proven in the source links below. JavaScript's language-level loop is a
*narrower* slice of the same idea — a call stack draining **microtasks**
(`Promise.then`) and **macrotasks** (`setTimeout`) in a fixed order. To build
intuition for that JS slice specifically, [JSV9000](https://www.jsv9000.app/)
is an excellent interactive visualizer: paste JS and watch the call stack,
microtask queue, and macrotask queue drain step by step.
:::

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| libuv | [core.c#L427-L492](https://github.com/libuv/libuv/blob/f6b713398e464a9f166328765be1703fd860981f/src/unix/core.c#L427-L492) | `uv_run` (L427-L492) is the main event loop function used by Node.js. Processes timers, pending callbacks, polls for I/O (`uv__io_poll`), runs check handles, and closes handles in a single `while` loop. Supports three run modes: `UV_RUN_DEFAULT` (run until no more active handles), `UV_RUN_ONCE`, `UV_RUN_NOWAIT`. |
| Redis | [ae.c#L360-L468](https://github.com/redis/redis/blob/df63a65d4d4ee33ae67e9f101885074febe0bccb/src/ae.c#L360-L468) | `aeProcessEvents` (L360-L468) is Redis's event loop core. Calculates the nearest timer, calls `aeApiPoll` (epoll/kqueue/select abstraction) with that timeout, then dispatches file events and timer events. Redis achieves 100K+ ops/sec on a single thread because the event loop never blocks on individual operations. |

## Implementation

::: code-group

```typescript [TypeScript]
type Handler = () => void;

class EventLoop {
  private handlers = new Map<number, Handler>();

  /** Register a handler for a file descriptor. */
  addHandler(fd: number, callback: Handler): void {
    this.handlers.set(fd, callback);
  }

  /** Remove a handler for a file descriptor. */
  removeHandler(fd: number): void {
    this.handlers.delete(fd);
  }

  /** Execute one tick: call all registered handlers once. */
  tick(): number {
    const count = this.handlers.size;
    for (const [, handler] of this.handlers) {
      handler();
    }
    return count;
  }

  /** Run the event loop for up to maxTicks. Stops early if no handlers. */
  run(maxTicks: number): number {
    let ticksRun = 0;
    for (let i = 0; i < maxTicks; i++) {
      if (this.handlers.size === 0) break;
      this.tick();
      ticksRun++;
    }
    return ticksRun;
  }

  get handlerCount(): number {
    return this.handlers.size;
  }
}
```

```rust [Rust]
use std::collections::HashMap;

pub struct EventLoop {
    handlers: HashMap<i32, Box<dyn FnMut()>>,
}

impl EventLoop {
    pub fn new() -> Self {
        EventLoop { handlers: HashMap::new() }
    }

    pub fn add_handler(&mut self, fd: i32, handler: impl FnMut() + 'static) {
        self.handlers.insert(fd, Box::new(handler));
    }

    pub fn remove_handler(&mut self, fd: i32) {
        self.handlers.remove(&fd);
    }

    pub fn tick(&mut self) -> usize {
        let count = self.handlers.len();
        for handler in self.handlers.values_mut() {
            handler();
        }
        count
    }

    pub fn run(&mut self, max_ticks: usize) -> usize {
        let mut ticks_run = 0;
        for _ in 0..max_ticks {
            if self.handlers.is_empty() {
                break;
            }
            self.tick();
            ticks_run += 1;
        }
        ticks_run
    }
}
```

```go [Go]
type EventLoop struct {
	handlers map[int]func()
}

func NewEventLoop() *EventLoop {
	return &EventLoop{handlers: make(map[int]func())}
}

func (el *EventLoop) AddHandler(fd int, handler func()) {
	el.handlers[fd] = handler
}

func (el *EventLoop) RemoveHandler(fd int) {
	delete(el.handlers, fd)
}

func (el *EventLoop) Tick() int {
	count := len(el.handlers)
	for _, handler := range el.handlers {
		handler()
	}
	return count
}

func (el *EventLoop) Run(maxTicks int) int {
	ticksRun := 0
	for i := 0; i < maxTicks; i++ {
		if len(el.handlers) == 0 {
			break
		}
		el.Tick()
		ticksRun++
	}
	return ticksRun
}
```

```python [Python]
from typing import Callable

class EventLoop:
    def __init__(self) -> None:
        self._handlers: dict[int, Callable[[], None]] = {}

    def add_handler(self, fd: int, callback: Callable[[], None]) -> None:
        self._handlers[fd] = callback

    def remove_handler(self, fd: int) -> None:
        self._handlers.pop(fd, None)

    def tick(self) -> int:
        count = len(self._handlers)
        for handler in list(self._handlers.values()):
            handler()
        return count

    def run(self, max_ticks: int) -> int:
        ticks_run = 0
        for _ in range(max_ticks):
            if not self._handlers:
                break
            self.tick()
            ticks_run += 1
        return ticks_run
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a mini event loop with handler registration and tick/run | `exercises/typescript/event-loop/01-basic.test.ts` |
| Intermediate | Extend with timer support (one-shot timers interleaved with I/O) | `exercises/typescript/event-loop/02-intermediate.test.ts` |

Run exercises: `pnpm test:exercises` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/event_loop/mod.rs` · Go `exercises/go/event_loop/event_loop_test.go` · Python `exercises/python/event_loop/test_event_loop.py`

## When to Use

- **High-connection servers** — web servers, chat servers, API gateways where thousands of connections are mostly idle (waiting for I/O)
- **I/O-bound workloads** — network proxies, load balancers, database connection pools where CPU work per request is minimal
- **Real-time communication** — WebSocket servers, game servers, notification systems where low latency per-message matters more than throughput
- **Embedded/resource-constrained** — when you can't afford the memory overhead of one thread per connection (each thread = 1-8 MB stack)

## When NOT to Use

- **CPU-bound work** — a single-threaded event loop blocks on computation. If you need to hash passwords, resize images, or run ML inference, use thread pools or worker processes alongside the event loop.
- **Simple request-response** — if you have < 100 concurrent connections and each request is straightforward, threads-per-request is simpler and debuggable. The event loop adds complexity (callback management, state machines) without benefit.
- **Strict ordering requirements** — when events must be processed in exact arrival order with no interleaving, a simple sequential loop or queue consumer is clearer.

## More Production Uses

- [Node.js](https://github.com/nodejs/node) — libuv-based event loop powering the entire Node.js runtime
- [Nginx](https://github.com/nginx/nginx) — worker processes each run an event loop with epoll/kqueue
- [Tokio](https://github.com/tokio-rs/tokio) — Rust async runtime built on mio (cross-platform reactor)
- [Netty](https://github.com/netty/netty) — Java NIO event loop for high-performance networking

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Cooperative Scheduling](/patterns/cooperative-scheduling/) | Event loops require cooperative scheduling — handlers must not block |
| [Observer](/patterns/observer/) | Event loops dispatch events to registered observers/callbacks |
| [Ring Buffer (Circular Buffer)](/patterns/ring-buffer/) | Event queues are typically implemented as ring buffers |
| [Actor Model](/patterns/actor-model/) | Each actor is essentially a single-threaded event loop over its mailbox |
| [Min-Heap / Priority Queue](/patterns/min-heap/) | Event loops use min-heaps to schedule timer callbacks by earliest deadline |

## Challenge Questions

::: details Q1: Your Node.js server handles 5,000 WebSocket connections fine, but adding a single endpoint that computes a Fibonacci number blocks ALL connections. Why?
**Answer:** The event loop is single-threaded. While computing Fibonacci (CPU-bound, synchronous), the event loop cannot process any I/O events. All 5,000 WebSocket connections are frozen until the computation completes.

Solutions: (1) offload CPU work to a `worker_threads` pool, (2) break computation into chunks with `setImmediate()` to yield back to the event loop between chunks, (3) use a separate microservice for heavy computation. This is the fundamental tradeoff of the event loop model — cooperative multitasking means one bad actor blocks everyone.
:::

::: details Q2: Redis uses a single-threaded event loop for command execution (with optional I/O threads since Redis 6.0), yet it handles 100K+ operations per second. How?
**Answer:** Redis operations are extremely fast — most are O(1) hash table lookups or O(log N) sorted set operations that take microseconds. The event loop overhead is negligible compared to network I/O time.

The bottleneck is not CPU but network: reading/writing to sockets, parsing the protocol, and serializing responses. Since Redis uses non-blocking I/O via `aeProcessEvents`, it processes one command per event (read → parse → execute → write) and immediately moves to the next ready socket. There's no context switching, no lock contention, and the entire dataset fits in memory — pure sequential throughput.
:::

::: details Q3: libuv's `uv_run` has three modes: DEFAULT, ONCE, NOWAIT. When would you use each?
**Answer:**

- **DEFAULT**: Normal operation — run until all handles/requests are done. This is what `node app.js` uses. The process stays alive until there are no more timers, servers, or pending callbacks.
- **ONCE**: Process one round of events, then return. Useful for embedding libuv in another event loop (e.g., a game engine's main loop that also needs to handle Node.js events).
- **NOWAIT**: Like ONCE but never blocks on I/O poll. Only processes already-ready events. Useful for polling in a tight loop where blocking would cause missed frames or deadlines.

The key difference: DEFAULT blocks indefinitely, ONCE blocks for one iteration, NOWAIT never blocks.
:::

::: details Q4: Why does Nginx use multiple worker processes each with its own event loop, rather than one single event loop?
**Answer:** One event loop on one CPU core wastes the other cores. Nginx spawns N worker processes (typically one per CPU core), each running its own independent event loop.

This gives you: (1) multi-core utilization without shared-state threading bugs, (2) process isolation — one crashed worker doesn't take down others, (3) zero-downtime reload — new workers start with new config while old workers drain. The `SO_REUSEPORT` socket option lets all workers accept connections on the same port, with the kernel load-balancing across them.
:::
