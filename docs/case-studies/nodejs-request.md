---
title: 'Case Study: How Node.js Composes Three Patterns to Serve a Request'
description: A deep dive into how Node.js handles an HTTP request by combining libuv's event loop, the EventEmitter observer, and stream backpressure — every claim backed by source code at a pinned commit.
---

# Case Study: How Node.js Composes Three Patterns to Serve a Request

> **What this is.** Most pattern docs teach one pattern in isolation. This case
> study does the opposite: it dissects how one real system — Node.js — composes
> **three** patterns so that a single thread can serve thousands of concurrent
> HTTP connections without blocking, notify code when data arrives, and avoid
> drowning a slow client in data. Every per-pattern claim links to source code
> at a pinned commit; the composition argument is backed by Node's and libuv's
> own documentation.

## The Problem Node.js Solves

A server must handle many connections at once. The classic answer — one thread
(or process) per connection — costs a stack and a kernel scheduling slot per
client, so it stops scaling at a few thousand connections. Node.js takes the
opposite bet: **one thread, never blocked**. That single thread must:

- **wait on thousands of sockets at once** without a thread each, and wake only
  when one is actually ready;
- **tell application code** that "data arrived" / "request ended" / "response
  finished" without the code polling;
- **not let a fast producer overwhelm a slow consumer** — if a client reads
  slowly, the server must stop buffering unbounded data in memory.

Achieving all three needs three patterns working together. None is novel alone —
what is instructive is *how they compose*.

| Question | Pattern | How Node answers it |
|----------|---------|---------------------|
| *How does one thread wait on thousands of sockets?* | **Event loop** | libuv's `uv_run` polls the OS (epoll/kqueue) and dispatches ready events |
| *How does code learn an event happened?* | **Observer** | `EventEmitter.emit` calls every registered listener (`'data'`, `'end'`…) |
| *How do we not overwhelm a slow consumer?* | **Backpressure** | `writeOrBuffer` returns `false` past `highWaterMark`; caller waits for `'drain'` |

## Pattern 1 — Event loop: one thread, many sockets

At Node's core is libuv's `uv_run`: a loop that asks the OS "which of these
thousands of file descriptors are ready?" (via `epoll` on Linux, `kqueue` on
macOS), runs the callbacks for the ready ones, then loops again. No descriptor
gets a thread; the thread blocks only inside the *one* poll call.

```c
int uv_run(uv_loop_t* loop, uv_run_mode mode) {
  /* ...setup... */
  while (r != 0 && loop->stop_flag == 0) {
    uv__run_timers(loop);
    /* ...run pending, idle, prepare handles... */
    uv__io_poll(loop, timeout);   // ← block here on epoll/kqueue until ready
    /* ...run check & close handles... */
    r = uv__loop_alive(loop);
  }
  return r;
}
```

The loop runs forever (for a server) and blocks **only** in `uv__io_poll`. When
a socket has bytes, `epoll` returns, libuv runs that socket's callback, and the
thread moves on. Idle connections cost almost nothing — they are just file
descriptors the kernel is watching.

::: tip Mental model
The event loop is a single waiter serving a full restaurant. Instead of one
waiter per table (thread per connection), one waiter circles the room, stopping
only at tables that have raised a hand (ready sockets). The "raise a hand" is
`epoll`; the circling is the `while` loop. Idle tables cost the waiter nothing.
:::

→ For the pattern in isolation, see [Event Loop](/patterns/event-loop/).

## Pattern 2 — Observer: turning readiness into callbacks

The event loop knows *that* a socket is ready, but application code wants to say
"when a request emits data, run my handler". Node bridges the two with the
**observer** pattern: `EventEmitter`. A socket/request is an emitter; your code
registers listeners; when the loop delivers readiness, the emitter calls every
listener via `emit`.

```js
EventEmitter.prototype.emit = function emit(type, ...args) {
  // ...special-case 'error'...
  const handler = events[type];
  if (handler === undefined) return false;
  // call each registered listener with the event's args
  // (single listener fast path, or loop over the array)
};
```

This is what `req.on('data', …)`, `req.on('end', …)`, and `res.on('finish', …)`
hang off of: the HTTP layer turns low-level socket readiness into named events,
and `emit` fans them out to listeners. Decoupling the producer (the socket) from
consumers (your handlers) is exactly the observer pattern's job.

::: tip Mental model
`EventEmitter` is a subscription list. The socket does not know who is listening;
it just shouts `emit('data', chunk)`, and everyone who subscribed with
`on('data', …)` hears it. Add or remove listeners freely — the emitter neither
knows nor cares. That decoupling is why Node's whole I/O surface is event-driven.
:::

→ For the pattern in isolation, see [Observer](/patterns/observer/).

## Pattern 3 — Backpressure: don't outrun a slow consumer

A response (`res`) is a writable stream. If your handler generates data faster
than the client can receive it (a slow mobile connection downloading a big
file), naively buffering everything blows up memory. Node's writable streams
implement **backpressure**: `writeOrBuffer` tracks how much is queued and, once
it crosses `highWaterMark`, returns `false` to tell the caller "stop and wait".

```js
function writeOrBuffer(stream, state, chunk, encoding, callback) {
  const len = (state[kState] & kObjectMode) !== 0 ? 1 : chunk.length;
  state.length += len;
  // ...buffer the chunk if the stream is busy, else write through...
  const ret = state.length < state.highWaterMark;
  // ret === false  →  caller should wait for the 'drain' event
  return ret;
}
```

The caller is expected to honour the signal: when `write()` returns `false`, stop
writing and wait for the `'drain'` event before continuing. That is the contract
that keeps a fast server and a slow client in balance without unbounded memory
growth.

::: tip Mental model
Backpressure is a "please wait" sign at a counter. `write()` returning `false`
means "my queue is full — stop handing me work until I say `'drain'`." A
well-behaved producer waits; ignoring the sign means piling data into memory
until the process dies. The `highWaterMark` is just where the sign flips on.
:::

→ For the pattern in isolation, see [Backpressure](/patterns/backpressure/).

## How the Three Compose

Serve one HTTP request and the three patterns hand off in a cycle:

1. **Event loop** (`uv_run`) blocks in `epoll` until the client's socket has
   bytes, then runs the socket's callback — no thread was spent waiting.
2. **Observer** (`emit`) turns that readiness into named events: the request
   stream (`IncomingMessage`, a Readable driven by the `llhttp` parser) emits
   `'data'` and `'end'`, and your `on(...)` listeners run.
3. **Backpressure** (`writeOrBuffer`) governs the reply: `res.write()` returns
   `false` when the client is slow, so the handler pauses until `'drain'` — and
   that `'drain'` is itself an event delivered by the loop via the emitter.

```text
client socket ready
        │  (event loop: uv__io_poll wakes on epoll/kqueue)
        ▼
   run socket callback ──► HTTP parser
        │  (observer: emit('data'/'end') → your req.on(...) listeners)
        ▼
   handler writes response (res.write)
        │  (backpressure: writeOrBuffer returns false past highWaterMark)
        ▼
   wait for 'drain'  ◄── delivered as an event by the loop + emitter, looping back
```

The unifying idea is **a single thread driven entirely by events**: the loop
decides *when* to run code (only on readiness), the observer decides *what* code
runs (listeners for named events), and backpressure decides *how fast* data may
flow (pause on `false`, resume on `'drain'`). Remove any one and it breaks:
without the loop, you are back to a thread per connection; without the observer,
the loop has no way to reach application code; without backpressure, one slow
client can exhaust the server's memory.

::: info Architectural inference
The framing of these three as a *deliberately composed* event-driven design
rests on Node's and libuv's own documentation (see Further Reading), not on any
single source file. The per-pattern code links are direct source-code evidence;
the "combined by design" claim is supported by that design-level material.
:::

## Production Proof

All source links are pinned to Node.js commit
`19c46abbefdb8711b913d7237b3c1299367f87d7` (libuv code lives under `deps/uv`).
Per-pattern claims are `source-code` (L1); the composition relationship is
backed by official documentation (`official-doc`).

| Pattern / Claim | Source | Evidence | Role in serving a request |
|-----------------|--------|----------|---------------------------|
| Event loop | [core.c#L427-L492](https://github.com/nodejs/node/blob/19c46abbefdb8711b913d7237b3c1299367f87d7/deps/uv/src/unix/core.c#L427-L492) | source-code | `uv_run` — the loop that blocks in `uv__io_poll` (epoll/kqueue) and dispatches ready events |
| Observer | [events.js#L456-L520](https://github.com/nodejs/node/blob/19c46abbefdb8711b913d7237b3c1299367f87d7/lib/events.js#L456-L520) | source-code | `EventEmitter.prototype.emit` — fans an event out to every registered listener |
| Backpressure | [writable.js#L548-L585](https://github.com/nodejs/node/blob/19c46abbefdb8711b913d7237b3c1299367f87d7/lib/internal/streams/writable.js#L548-L585) | source-code | `writeOrBuffer` — returns `false` past `highWaterMark`, signalling the caller to await `'drain'` |
| Composition (by design) | [Node.js Stream docs](https://nodejs.org/api/stream.html) | official-doc | Official explanation of streams, the `'drain'` contract, and the event-driven I/O model |
| Composition (by design) | [libuv design overview](https://docs.libuv.org/en/v1.x/design.html) | official-doc | libuv's own description of the event loop and how I/O is multiplexed |

## Takeaways

- **Patterns rarely ship alone.** Serving a request needs a *scheduling* pattern
  (event loop), a *notification* pattern (observer), and a *flow-control* pattern
  (backpressure) at once — and they hand off in a cycle, not a line.
- **One thread + events beats one thread per connection.** Node scales to many
  connections not by doing work faster, but by never blocking the one thread it
  has — idle sockets are free.
- **Backpressure is a contract, not magic.** `write()` returning `false` only
  helps if the caller waits for `'drain'`. Ignoring it trades a
  thread-per-connection problem for an out-of-memory one.
- **This echoes the React Fiber and Go studies.** All three are cooperative,
  event/loop-driven schedulers; comparing how each yields and resumes sharpens
  the pattern across very different runtimes.

## Further Reading

A path from "I read this" to "I can recognise these patterns anywhere":

1. **Start with the loop's design** — libuv's
   [design overview](https://docs.libuv.org/en/v1.x/design.html) explains the
   event loop, the I/O poll phase, and the thread pool. Read this first; the
   `uv_run` source then confirms it.
2. **Get the stream + backpressure contract** — Node's official
   [Backpressuring in Streams](https://nodejs.org/en/learn/modules/backpressuring-in-streams)
   guide and the [Stream API docs](https://nodejs.org/api/stream.html) explain
   `write()` returning `false` and the `'drain'` event.
3. **Then read the source, in this order** — the loop
   ([uv_run](https://github.com/nodejs/node/blob/19c46abbefdb8711b913d7237b3c1299367f87d7/deps/uv/src/unix/core.c#L427-L492))
   → how readiness becomes callbacks
   ([emit](https://github.com/nodejs/node/blob/19c46abbefdb8711b913d7237b3c1299367f87d7/lib/events.js#L456-L520))
   → how writes are throttled
   ([writeOrBuffer](https://github.com/nodejs/node/blob/19c46abbefdb8711b913d7237b3c1299367f87d7/lib/internal/streams/writable.js#L548-L585)).
4. **Compare across runtimes** — read the [Go scheduler](/case-studies/go-scheduler)
   and [React Fiber](/case-studies/react-fiber) studies; all three are
   event/loop-driven cooperative schedulers with different constraints.
5. **Practise the recognition** — open the three pattern pages below and look for
   "one loop polling readiness", "emit to subscribers", and "pause on full,
   resume on drain" in another system you know.

## Study These Patterns

- [Event Loop](/patterns/event-loop/) — one thread polling many sources
- [Observer](/patterns/observer/) — emit events to decoupled subscribers
- [Backpressure](/patterns/backpressure/) — pause a fast producer for a slow consumer
