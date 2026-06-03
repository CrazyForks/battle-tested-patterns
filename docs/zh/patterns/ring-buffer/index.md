# 模式：环形缓冲区 (Ring Buffer)

## 一句话

固定大小的缓冲区通过模运算实现循环，提供常数时间的入队出队且无需内存分配。

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

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| LMAX Disruptor | [RingBuffer.java#L84-L130](https://github.com/LMAX-Exchange/disruptor/blob/master/src/main/java/com/lmax/disruptor/RingBuffer.java#L84-L130) | Disruptor 的核心数据结构，支撑 LMAX 交易所每秒处理 600 万笔订单。使用 2 的幂大小以位运算取模。 |
| Linux 内核 | [ring_buffer.h#L12-L70](https://github.com/torvalds/linux/blob/master/include/linux/ring_buffer.h#L12-L70) | 内核 tracing 子系统 (ftrace) 使用环形缓冲区进行无锁事件记录，per-CPU 缓冲区实现零竞争。 |

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
    this.head = (this.head + 1) % this.capacity;
    this.count--;
    return item;
  }
}
```

```python [Python]
class RingBuffer:
    def __init__(self, capacity):
        self._buf = [None] * capacity
        self._head = self._tail = self._count = 0
        self._cap = capacity

    def enqueue(self, item):
        if self._count == self._cap: return False
        self._buf[self._tail] = item
        self._tail = (self._tail + 1) % self._cap
        self._count += 1
        return True

    def dequeue(self):
        if self._count == 0: return None
        item = self._buf[self._head]
        self._head = (self._head + 1) % self._cap
        self._count -= 1
        return item
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现环形缓冲区 enqueue/dequeue | `exercises/typescript/ring-buffer/01-basic.test.ts` |

## 何时使用

- **固定大小队列** — 有界生产者-消费者缓冲区
- **流数据** — 日志缓冲、音视频帧、网络包
- **无锁并发** — 原子 head/tail 实现 wait-free SPSC 队列
- **覆盖最旧** — 遥测数据、最近 N 条缓存

## 何时不用

- **无界增长** — 无法预测最大大小时用链表或 deque
- **按 key 随机访问** — 环形缓冲区是顺序的，用哈希表

## 更多生产案例

- Linux [io_uring](https://github.com/axboe/liburing)
- [ZeroMQ](https://github.com/zeromq/libzmq)
- [Kafka](https://github.com/apache/kafka) — log segments
- Audio DSP buffers

## 挑战题

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
