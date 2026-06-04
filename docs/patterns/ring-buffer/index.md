---
description: "A fixed-size buffer that wraps around using modular arithmetic, enabling constant-time enqueue and dequeue without memory allocation."
difficulty: "beginner"
---

# Pattern: Ring Buffer (Circular Buffer)

<DifficultyBadge />

## One Liner

A fixed-size buffer that wraps around using modular arithmetic, enabling constant-time enqueue and dequeue without memory allocation.

<DemoBadge />

## Real-World Analogy

A sushi conveyor belt in a restaurant. The belt has a fixed number of plates. The chef places new plates at one end, and diners take plates as they pass. When the belt is full, the chef must wait. When it's empty, diners must wait. The belt loops back around endlessly.

## Core Idea

A ring buffer uses a fixed array with two pointers — `head` (next read position) and `tail` (next write position). When either pointer reaches the end, it wraps to the beginning. No shifting, no resizing, no allocation.

```text
  Capacity: 8       head=2, tail=6

  ┌───┬───┬───┬───┬───┬───┬───┬───┐
  │   │   │ A │ B │ C │ D │   │   │
  └───┴───┴─▲─┴───┴───┴───┴─▲─┴───┘
            │               │
          head            tail

  Write 'E' at tail (index 6), then tail = (6+1) % 8 = 7
  Read 'A' at head (index 2), then head = (2+1) % 8 = 3
```

The wrap-around `index % capacity` is what makes it "ring" — it never runs out of space in the array, it just overwrites old data (or blocks, depending on the implementation).

**Try it yourself** — enqueue and dequeue items to see how head/tail pointers wrap around:

<RingBufferViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| LMAX Disruptor | [RingBuffer.java#L84-L130](https://github.com/LMAX-Exchange/disruptor/blob/master/src/main/java/com/lmax/disruptor/RingBuffer.java#L84-L130) | The Disruptor's `RingBuffer` is the core data structure behind LMAX Exchange — processes 6 million orders per second. Uses power-of-2 sizing for bitwise modulo (`sequence & (bufferSize - 1)`). |
| Linux Kernel | [ring_buffer.h#L12-L70](https://github.com/torvalds/linux/blob/master/include/linux/ring_buffer.h#L12-L70) | `ring_buffer_event` struct with `type_len` packed into 5 bits + 27-bit timestamp delta. Per-CPU ring buffers — `ring_buffer_read`/`ring_buffer_consume` advance a read pointer without locks. Overflow silently overwrites oldest events. |

## Implementation

::: code-group

```typescript [TypeScript]
class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private tail = 0;
  private count = 0;
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  enqueue(item: T): boolean {
    if (this.count === this.capacity) return false;
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    this.count++;
    return true;
  }

  dequeue(): T | undefined {
    if (this.count === 0) return undefined;
    const item = this.buffer[this.head];
    this.buffer[this.head] = undefined;
    this.head = (this.head + 1) % this.capacity;
    this.count--;
    return item;
  }

  peek(): T | undefined {
    return this.count > 0 ? this.buffer[this.head] : undefined;
  }

  get size(): number { return this.count; }
  get isFull(): boolean { return this.count === this.capacity; }
  get isEmpty(): boolean { return this.count === 0; }
}
```

```rust [Rust]
pub struct RingBuffer<T> {
    buffer: Vec<Option<T>>,
    head: usize,
    tail: usize,
    count: usize,
    capacity: usize,
}

impl<T> RingBuffer<T> {
    pub fn new(capacity: usize) -> Self {
        let mut buffer = Vec::with_capacity(capacity);
        buffer.resize_with(capacity, || None);
        RingBuffer { buffer, head: 0, tail: 0, count: 0, capacity }
    }

    pub fn enqueue(&mut self, item: T) -> bool {
        if self.count == self.capacity { return false; }
        self.buffer[self.tail] = Some(item);
        self.tail = (self.tail + 1) % self.capacity;
        self.count += 1;
        true
    }

    pub fn dequeue(&mut self) -> Option<T> {
        if self.count == 0 { return None; }
        let item = self.buffer[self.head].take();
        self.head = (self.head + 1) % self.capacity;
        self.count -= 1;
        item
    }

    pub fn len(&self) -> usize { self.count }
    pub fn is_full(&self) -> bool { self.count == self.capacity }
}
```

```go [Go]
type RingBuffer[T any] struct {
	buf  []T
	head int
	tail int
	cnt  int
	cap  int
}

func NewRingBuffer[T any](capacity int) *RingBuffer[T] {
	return &RingBuffer[T]{buf: make([]T, capacity), cap: capacity}
}

func (r *RingBuffer[T]) Enqueue(item T) bool {
	if r.cnt == r.cap { return false }
	r.buf[r.tail] = item
	r.tail = (r.tail + 1) % r.cap
	r.cnt++
	return true
}

func (r *RingBuffer[T]) Dequeue() (T, bool) {
	var zero T
	if r.cnt == 0 { return zero, false }
	item := r.buf[r.head]
	r.head = (r.head + 1) % r.cap
	r.cnt--
	return item, true
}

func (r *RingBuffer[T]) Len() int { return r.cnt }
```

```python [Python]
class RingBuffer:
    def __init__(self, capacity: int):
        self._buf = [None] * capacity
        self._head = 0
        self._tail = 0
        self._count = 0
        self._cap = capacity

    def enqueue(self, item) -> bool:
        if self._count == self._cap:
            return False
        self._buf[self._tail] = item
        self._tail = (self._tail + 1) % self._cap
        self._count += 1
        return True

    def dequeue(self):
        if self._count == 0:
            return None
        item = self._buf[self._head]
        self._head = (self._head + 1) % self._cap
        self._count -= 1
        return item

    def __len__(self):
        return self._count
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a ring buffer with enqueue/dequeue | `exercises/typescript/ring-buffer/01-basic.test.ts` |
| Intermediate | Streaming moving average over last N values | `exercises/typescript/ring-buffer/02-intermediate.test.ts` |

Run exercises: `pnpm test` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/ring_buffer.rs` · Go `exercises/go/ring_buffer_test.go` · Python `exercises/python/test_ring_buffer.py`

## When to Use

- **Fixed-size queues** — bounded producer-consumer buffers
- **Streaming data** — log buffers, audio/video frames, network packets
- **Lock-free concurrency** — with atomic head/tail, enables wait-free SPSC queues
- **Overwrite-oldest semantics** — telemetry, recent-N caches
- **Embedded / real-time** — no heap allocation, deterministic timing

## When NOT to Use

- **Unbounded growth** — if you can't predict maximum size, use a linked list or `Vec`/`deque`
- **Random access by key** — ring buffers are sequential; use a hash map
- **Variable-size elements** — packing different-sized items is complex; use a message queue

## More Production Uses

- Linux [io_uring](https://github.com/axboe/liburing)
- [ZeroMQ](https://github.com/zeromq/libzmq)
- [Kafka](https://github.com/apache/kafka) — log segments
- [PortAudio](https://github.com/portaudio/portaudio/blob/master/src/common/pa_ringbuffer.c) — lock-free SPSC ring buffer for real-time audio

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Backpressure](/patterns/backpressure/) | Bounded ring buffers naturally create backpressure when full |
| [Event Loop](/patterns/event-loop/) | Event loops use ring buffers for I/O event queues |
| [Double Buffering](/patterns/double-buffering/) | Both avoid allocation — ring buffers reuse slots, double buffering swaps pointers |
| [Batch Processing](/patterns/batch-processing/) | Ring buffers accumulate events for batch consumption |
| [Free List](/patterns/free-list/) | Both provide O(1) slot management — ring buffers via modular index, free lists via linked chain |

## Challenge Questions

::: details Q1: You implement a ring buffer with capacity 8, but without a separate `count` field — you only track `head` and `tail`. When `head === tail`, you can't tell if the buffer is completely full or completely empty. How do production systems solve this?
**Answer:** The most common solution is to either keep a separate count, or allocate capacity + 1 slots and treat `(tail + 1) % capacity === head` as full.

With only `head` and `tail`, both the empty and full states look identical (`head === tail`). LMAX Disruptor uses sequence numbers that grow monotonically rather than wrapping pointers, so `tail - head` directly gives the count. The "waste one slot" approach sacrifices one element of capacity but avoids the overhead of maintaining an atomic counter in concurrent scenarios.
:::

::: details Q2: The LMAX Disruptor requires ring buffer capacity to be a power of 2. Your colleague says any size works since you're using `% capacity` anyway. Why does LMAX insist on power-of-2?
**Answer:** Power-of-2 sizing lets you replace the modulo operation with a bitwise AND (`index & (capacity - 1)`), which is significantly faster.

The modulo operator `%` compiles to a division instruction, which takes 20-40 CPU cycles on most architectures. A bitwise AND takes 1 cycle. In a system processing 6 million events per second, this optimization on every enqueue and dequeue adds up. It only works because `n & (2^k - 1)` is mathematically equivalent to `n % 2^k` when the divisor is a power of 2.
:::

::: details Q3: Your logging system uses a ring buffer for recent log entries. During a production incident, you notice the oldest logs you need for debugging have already been overwritten. Increasing the buffer size to "large enough" is not practical. What architectural change would you make?
**Answer:** Add a drain/consumer that flushes entries to persistent storage before they're overwritten, turning the ring buffer into a staging area rather than the final store.

A ring buffer is inherently bounded — that's its strength (predictable memory) and its limitation (data loss under sustained load). The pattern used by Linux's `io_uring` and kernel trace buffers is to have a consumer that reads entries and persists them. The ring buffer absorbs bursts, and the consumer handles steady-state throughput. This separates the write-fast concern from the store-everything concern.
:::

::: details Q4: You're building a single-producer, single-consumer (SPSC) ring buffer for an audio pipeline. The producer writes 48,000 samples/sec and the consumer reads in 1024-sample blocks. Occasionally the consumer stalls for 50ms (e.g., disk I/O). What capacity do you choose, and what happens if you get it wrong?
**Answer:** At least 48000 * 0.05 = 2,400 samples to survive a 50ms stall, rounded up to the next power of 2 (4,096). In practice, double or quadruple that (8,192 or 16,384) to handle back-to-back stalls.

If the buffer is too small, the producer overwrites unread samples (audio glitches) or blocks (pipeline stall). If too large, you add latency -- the consumer is always reading samples that were written further in the past. Audio systems typically size the buffer to 2-3x the maximum expected stall duration as a safety margin. This is the fundamental ring buffer tradeoff: capacity = maximum burst tolerance, and every extra slot adds one sample period of worst-case latency.
:::
