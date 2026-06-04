---
description: "Slow down producers when consumers can't keep up — use bounded buffers and demand signals to prevent resource exhaustion."
---

# Pattern: Backpressure / Flow Control

## One Liner

Slow down producers when consumers can't keep up — use bounded buffers and demand signals to prevent resource exhaustion.

<DemoBadge />

## Core Idea

Backpressure is a flow control mechanism where the consumer signals the producer to slow down or stop. Without it, a fast producer overwhelms a slow consumer, causing unbounded memory growth, dropped messages, or system crashes. The key: **bounded buffers** + **blocking/signaling when full**.

```text
  Producer                     Bounded Buffer                Consumer
  ─────────                   ──────────────                ─────────
  emit(data) ──────────►  ┌──┬──┬──┬──┬──┐  ──────────►  process(data)
                          │ 5│ 4│ 3│ 2│ 1│
  ◄─ WAIT (buffer full)   └──┴──┴──┴──┴──┘  request(n) ──►
                            capacity = 5
```

| Strategy | How it works |
|----------|-------------|
| **Block** | Producer waits until buffer has space (Go channels, Node.js streams) |
| **Drop** | Discard newest/oldest items when buffer is full (lossy, for metrics) |
| **Signal** | Consumer sends `request(n)` to pull exactly n items (Reactive Streams) |
| **Throttle** | Rate-limit the producer (token bucket / leaky bucket) |

**Try it yourself** — start the producer and consumer to see what happens when production outpaces consumption:

<BackpressureViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| Node.js Streams | [writable.js#L548-L585](https://github.com/nodejs/node/blob/main/lib/internal/streams/writable.js#L548-L585) | `writeOrBuffer()` — L576 checks `state.length < state.highWaterMark`; when buffer exceeds the threshold, L579 sets `kNeedDrain` flag and L585 returns `false`, signaling the producer to pause until the `drain` event fires. |
| Reactive Streams | [Subscription.java#L14-L37](https://github.com/reactive-streams/reactive-streams-jvm/blob/master/api/src/main/java/org/reactivestreams/Subscription.java#L14-L37) | `request(long n)` (L29) — the consumer explicitly requests `n` items from the producer. "No events will be sent by a Publisher until demand is signaled via this method." Foundation of RxJava Flowable, Project Reactor, and Akka Streams. |

## Implementation

::: code-group

```typescript [TypeScript]
class BoundedQueue<T> {
  private buffer: T[] = [];
  private pushWaiters: Array<() => void> = [];
  private pullWaiters: Array<(value: T) => void> = [];

  constructor(private capacity: number) {}

  async push(item: T): Promise<void> {
    if (this.pullWaiters.length > 0) {
      this.pullWaiters.shift()!(item);
      return;
    }
    if (this.buffer.length >= this.capacity) {
      await new Promise<void>((r) => this.pushWaiters.push(r));
    }
    this.buffer.push(item);
  }

  async pull(): Promise<T> {
    if (this.buffer.length > 0) {
      const item = this.buffer.shift()!;
      if (this.pushWaiters.length > 0) this.pushWaiters.shift()!();
      return item;
    }
    return new Promise<T>((r) => this.pullWaiters.push(r));
  }
}
```

```go [Go]
// Go: bounded channels provide backpressure natively
func producer(ch chan<- int) {
	for i := 0; ; i++ {
		ch <- i // blocks when channel is full
	}
}

func consumer(ch <-chan int) {
	for v := range ch {
		fmt.Println(v) // process at consumer's pace
	}
}

func Run() {
	ch := make(chan int, 10) // bounded buffer of 10
	go producer(ch)
	consumer(ch)
}
```

```python [Python]
import asyncio

async def producer(queue: asyncio.Queue[int]):
    for i in range(100):
        await queue.put(i)  # blocks when queue is full

async def consumer(queue: asyncio.Queue[int]):
    while True:
        item = await queue.get()  # blocks when queue is empty
        await asyncio.sleep(0.1)  # simulate slow processing

async def main():
    queue: asyncio.Queue[int] = asyncio.Queue(maxsize=5)  # bounded
    await asyncio.gather(producer(queue), consumer(queue))
```

```rust [Rust]
use std::sync::{Arc, Mutex, Condvar};

pub struct BoundedQueue<T> {
    data: Mutex<Vec<T>>,
    capacity: usize,
    not_full: Condvar,
    not_empty: Condvar,
}

impl<T> BoundedQueue<T> {
    pub fn new(capacity: usize) -> Self {
        BoundedQueue {
            data: Mutex::new(Vec::new()),
            capacity,
            not_full: Condvar::new(),
            not_empty: Condvar::new(),
        }
    }

    pub fn push(&self, item: T) {
        let mut buf = self.data.lock().unwrap();
        while buf.len() >= self.capacity {
            buf = self.not_full.wait(buf).unwrap();
        }
        buf.push(item);
        self.not_empty.notify_one();
    }

    pub fn pull(&self) -> T {
        let mut buf = self.data.lock().unwrap();
        while buf.is_empty() {
            buf = self.not_empty.wait(buf).unwrap();
        }
        let item = buf.remove(0);
        self.not_full.notify_one();
        item
    }
}
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a bounded async queue with flow control | `exercises/typescript/backpressure/01-basic.test.ts` |
| Intermediate | Bounded async channel with blocking send/receive | `exercises/typescript/backpressure/02-intermediate.test.ts` |

Run exercises: `pnpm test`

## When to Use

- **Stream processing** — prevent fast data sources from overwhelming processors
- **Microservices** — protect downstream services from overload
- **I/O pipelines** — disk reads faster than network writes (or vice versa)
- **Event-driven systems** — producers fire events faster than handlers can process

## When NOT to Use

- **Lossy is acceptable** — if dropping data is fine (metrics, sampling), just drop without blocking
- **Single-speed systems** — if producer and consumer run at the same speed, backpressure adds unnecessary complexity
- **Fire-and-forget** — if the producer doesn't need to wait, use an unbounded queue with monitoring
- **Real-time constraints** — blocking the producer may violate latency SLAs

## More Production Uses

- [RxJava Flowable](https://github.com/ReactiveX/RxJava) — backpressure-aware reactive streams
- [Kafka](https://github.com/apache/kafka) — producer `buffer.memory` and `max.block.ms` for flow control
- [Linux TCP](https://github.com/torvalds/linux/blob/master/net/ipv4/tcp_output.c) — congestion window (`cwnd`) as backpressure
- [gRPC](https://github.com/grpc/grpc) — flow control windows in HTTP/2

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Ring Buffer (Circular Buffer)](/patterns/ring-buffer/) | Bounded ring buffers are a common mechanism for implementing backpressure |
| [Rate Limiter (Token Bucket)](/patterns/rate-limiter/) | Rate limiting controls intake speed; backpressure signals the producer to slow down |
| [Semaphore](/patterns/semaphore/) | Semaphores can implement backpressure by limiting outstanding work |
| [Batch Processing](/patterns/batch-processing/) | Batching smooths bursty input, complementing backpressure mechanisms |

## Challenge Questions

::: details Q1: Your bounded queue is full. Should you block the producer or drop the newest item? How do you decide?
**Answer:** It depends on whether data loss is acceptable. Block when every item matters (financial transactions, user actions). Drop when freshness matters more than completeness (metrics, sensor telemetry).

Blocking preserves all data but propagates slowness upstream -- if the consumer is permanently slow, the producer stalls and the whole pipeline stops. Dropping loses data but keeps the producer responsive. A common hybrid is "drop oldest" for monitoring dashboards (you want the latest readings) and "block" for event sourcing (you can't lose events). The choice is a business decision, not a technical one.
:::

::: details Q2: You set Node.js stream highWaterMark to 1MB. Traffic spikes and memory usage jumps to 500MB with 500 concurrent streams. What went wrong?
**Answer:** Each stream allocates its own highWaterMark-sized buffer, so 500 streams x 1MB = 500MB of buffer memory. The highWaterMark is per-stream, not global.

highWaterMark is not a system-wide limit -- it's the threshold per individual stream at which `write()` returns `false`. With many concurrent streams, total memory is `concurrency x highWaterMark`. The fix is either to lower the highWaterMark (16KB-64KB is typical), limit concurrency, or use a global memory budget that dynamically adjusts per-stream thresholds.
:::

::: details Q3: How is backpressure different from rate limiting? A teammate says they're the same thing.
**Answer:** Rate limiting caps throughput at a fixed rate regardless of consumer capacity. Backpressure dynamically adjusts based on the consumer's actual ability to keep up.

Rate limiting says "max 100 requests/second" even if the consumer could handle 200. Backpressure says "send as fast as the consumer can process, whatever that speed is right now." Rate limiting is a policy; backpressure is a feedback mechanism. They can complement each other: rate limiting at the API gateway, backpressure inside the processing pipeline. But they solve different problems -- rate limiting protects against abuse, backpressure prevents resource exhaustion.
:::

::: details Q4: A Go developer says "I don't need backpressure, I just use buffered channels." Is that correct?
**Answer:** Buffered channels ARE backpressure. A bounded channel blocks the sender when full, which is exactly the "block" backpressure strategy.

The developer is already using backpressure -- they just don't recognize it by name. `ch := make(chan int, 10)` creates a bounded buffer of 10. When the buffer fills, `ch <- item` blocks the goroutine, slowing the producer to match the consumer. The key question is whether the buffer size is well-chosen: too small and you get unnecessary blocking on small bursts; too large and you delay the feedback signal, allowing memory to grow.
:::
