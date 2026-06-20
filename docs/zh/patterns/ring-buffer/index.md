---
title: "模式：环形缓冲区 (Ring Buffer)"
description: "固定大小的缓冲区通过模运算实现循环，提供常数时间的入队出队且无需内存分配。"
difficulty: "beginner"
---

# 模式：环形缓冲区 (Ring Buffer)

<DifficultyBadge />

## 一句话

固定大小的缓冲区通过模运算实现循环，提供常数时间的入队出队且无需内存分配。

<DemoBadge />

## 现实类比

回转寿司的传送带。传送带上只能放固定数量的盘子。厨师在一头放新盘子，食客在经过时拿走。传送带满了厨师等，空了食客等。传送带循环往复，永不停歇。

## 核心思想

环形缓冲区使用固定数组加两个指针——`head`（下次读取位置）和 `tail`（下次写入位置）。当指针到达末尾时回绕到开头。无移位、无扩容、无分配。

```text
  容量: 8       head=2, tail=6

  ┌───┬───┬───┬───┬───┬───┬───┬───┐
  │   │   │ A │ B │ C │ D │   │   │
  └───┴───┴─▲─┴───┴───┴───┴─▲─┴───┘
            │               │
          head            tail

  写入 'E' 到 tail (索引 6)，然后 tail = (6+1) % 8 = 7
  读取 'A' 从 head (索引 2)，然后 head = (2+1) % 8 = 3
```

`index % capacity` 的回绕使其成为"环"——永远不会用完数组空间。

| 属性 | 值 |
|------|------|
| 入队/写入 | O(1) — 在 tail 写入，推进指针 |
| 出队/读取 | O(1) — 在 head 读取，推进指针 |
| 空间 | O(容量) — 固定，预分配 |
| 溢出策略 | 阻塞（有界队列）或覆盖最旧数据（日志缓冲区） |

**动手试试** — 入队和出队操作，观察 head/tail 指针如何环绕：

<RingBufferViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| LMAX Disruptor | [RingBuffer.java#L84-L130](https://github.com/LMAX-Exchange/disruptor/blob/c871ca49826a6be7ada6957f6fbafcfecf7b1f87/src/main/java/com/lmax/disruptor/RingBuffer.java#L84-L130) | Disruptor 的核心数据结构，支撑 LMAX 交易所每秒处理 600 万笔订单。使用 2 的幂大小以位运算取模。 |
| Linux 内核 | [ring_buffer.h#L12-L70](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/include/linux/ring_buffer.h#L12-L70) | 内核 tracing 子系统 (ftrace) 使用环形缓冲区进行无锁事件记录，per-CPU 缓冲区实现零竞争。 |

## 实现

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

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现环形缓冲区 enqueue/dequeue | `exercises/typescript/ring-buffer/01-basic.test.ts` |
| 进阶 | 基于环形缓冲区的流式移动平均 | `exercises/typescript/ring-buffer/02-intermediate.test.ts` |

运行练习：`pnpm test:ts`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

练习文件： Rust `exercises/rust/src/ring_buffer/mod.rs` · Go `exercises/go/ring_buffer/ring_buffer_test.go` · Python `exercises/python/ring_buffer/test_ring_buffer.py`

## 何时使用

- **固定大小队列** — 有界生产者-消费者缓冲区
- **流数据** — 日志缓冲、音视频帧、网络包
- **无锁并发** — 原子 head/tail 实现 wait-free SPSC 队列
- **覆盖最旧** — 遥测数据、最近 N 条缓存
- **嵌入式/实时** — 无堆分配、确定性时序

## 何时不用

- **无界增长** — 无法预测最大大小时用链表或 deque
- **按 key 随机访问** — 环形缓冲区是顺序的，用哈希表
- **变长元素** — 打包不同大小的项很复杂；用消息缓冲区

## 更多生产案例

- Linux [io_uring](https://github.com/axboe/liburing)
- [ZeroMQ](https://github.com/zeromq/libzmq)
- [Kafka](https://github.com/apache/kafka) — log segments
- [PortAudio](https://github.com/portaudio/portaudio/blob/b0fe9de7ec86ebe5a26086f1d662ab74d7ebfae4/src/common/pa_ringbuffer.c) — 实时音频无锁 SPSC 环形缓冲区

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [背压 / 流控 (Backpressure)](/zh/patterns/backpressure/) | 有界环形缓冲区满时自然产生背压 |
| [事件循环 / 反应器 (Event Loop / Reactor)](/zh/patterns/event-loop/) | 事件循环使用环形缓冲区作为 I/O 事件队列 |
| [双缓冲 (Double Buffering)](/zh/patterns/double-buffering/) | 两者都避免分配——环形缓冲区复用槽位，双缓冲交换指针 |
| [批处理 (Batch Processing)](/zh/patterns/batch-processing/) | 环形缓冲区累积事件供批量消费 |
| [空闲链表 (Free List)](/zh/patterns/free-list/) | 两者都提供 O(1) 的槽位管理——环形缓冲区通过模索引，空闲链表通过链式链接 |

## 挑战题

::: details Q1: 你实现了一个容量为 8 的环形缓冲区，但没有单独的 `count` 字段——你只追踪 `head` 和 `tail`。当 `head === tail` 时，你无法区分缓冲区是完全满还是完全空。生产系统如何解决这个问题？
**答案：** 最常见的解决方案是维护一个单独的计数，或者分配 capacity + 1 个槽位并将 `(tail + 1) % capacity === head` 视为满。

只用 `head` 和 `tail` 时，空和满两种状态看起来一样（`head === tail`）。LMAX Disruptor 使用单调递增的序列号而非回绕指针，因此 `tail - head` 直接给出计数。"浪费一个槽位"的方法牺牲了一个元素的容量，但避免了在并发场景中维护原子计数器的开销。
:::

::: details Q2: LMAX Disruptor 要求环形缓冲区容量必须是 2 的幂。你的同事说用 `% capacity` 就行所以任何大小都可以。为什么 LMAX 坚持要求 2 的幂？
**答案：** 2 的幂大小让你可以用位与运算（`index & (capacity - 1)`）替代取模运算，这要快得多。

取模运算符 `%` 编译为除法指令，在大多数架构上需要 20-40 个 CPU 周期。位与运算只需 1 个周期。在每秒处理 600 万个事件的系统中，每次入队和出队的这个优化累积起来很可观。这之所以可行是因为当除数是 2 的幂时，`n & (2^k - 1)` 在数学上等价于 `n % 2^k`。
:::

::: details Q3: 你的日志系统使用环形缓冲区存储最近的日志条目。在一次生产事故中，你发现调试所需的最旧日志已经被覆盖了。将缓冲区大小增加到"足够大"是不现实的。你会做什么架构上的改变？
**答案：** 添加一个在条目被覆盖之前将其刷写到持久存储的消费者，把环形缓冲区变成暂存区而非最终存储。

环形缓冲区天生是有界的——这既是它的优势（可预测的内存）也是它的局限（持续高负载下的数据丢失）。Linux 的 `io_uring` 和内核跟踪缓冲区使用的模式是有一个消费者读取条目并持久化。环形缓冲区吸收突发，消费者处理稳态吞吐。这将"写入要快"的关注点与"存储一切"的关注点分离开来。
:::

::: details Q4: 你正在为音频管线构建一个单生产者单消费者（SPSC）环形缓冲区。生产者每秒写入 48,000 个采样，消费者以 1024 个采样为一块读取。消费者偶尔会因磁盘 I/O 停顿 50ms。你如何选择容量？选错了会怎样？
**答案：** 至少 48000 × 0.05 = 2,400 个采样才能扛住 50ms 停顿，向上取整到下一个 2 的幂（4,096）。实践中翻倍或四倍（8,192 或 16,384）以应对连续停顿。

缓冲区太小，生产者会覆盖未读采样（音频爆音）或阻塞（管线停顿）。太大则增加延迟——消费者读到的总是更早写入的采样。音频系统通常将缓冲区设为最大预期停顿时长的 2-3 倍作为安全裕度。这是环形缓冲区的根本权衡：容量 = 最大突发承受力，每多一个槽位就多一个采样周期的最坏延迟。
:::
