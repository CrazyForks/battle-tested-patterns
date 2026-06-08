---
description: "当消费者跟不上时减慢生产者——用有界缓冲区和需求信号防止资源耗尽。"
difficulty: "intermediate"
---

# 模式：背压 / 流控 (Backpressure)

<DifficultyBadge />

## 一句话

当消费者跟不上时减慢生产者——用有界缓冲区和需求信号防止资源耗尽。

<DemoBadge />

## 现实类比

服务员告诉厨房「慢点做，桌子都满了。」与其让菜堆在窗口变凉，服务员发信号让厨房降低出菜速度，等食客吃完再加速。消费者控制生产者的节奏。

## 核心思想

背压是一种流控机制，消费者通知生产者减速或停止。没有背压时，快速生产者会压垮慢速消费者，导致无限内存增长、消息丢失或系统崩溃。关键：**有界缓冲区** + **满时阻塞/通知**。

```text
  Producer                     Bounded Buffer                Consumer
  ─────────                   ──────────────                ─────────
  emit(data) ──────────►  ┌──┬──┬──┬──┬──┐  ──────────►  process(data)
                          │ 5│ 4│ 3│ 2│ 1│
  ◄─ WAIT (buffer full)   └──┴──┴──┴──┴──┘  request(n) ──►
                            capacity = 5
```

| 策略 | 工作方式 |
|------|---------|
| **阻塞** | 生产者等待直到缓冲区有空间（Go channel、Node.js streams） |
| **丢弃** | 缓冲满时丢弃最新/最旧项（有损，适用于指标） |
| **信号** | 消费者发送 `request(n)` 精确拉取 n 项（Reactive Streams） |
| **限流** | 限制生产者速率（令牌桶/漏桶） |

**动手试试** — 启动生产者和消费者，观察生产速度超过消费速度时会发生什么：

<BackpressureViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Node.js Streams | [writable.js#L548-L585](https://github.com/nodejs/node/blob/main/lib/internal/streams/writable.js#L548-L585) | `writeOrBuffer()` — L576 检查 `state.length < state.highWaterMark`；缓冲区超过阈值时，L579 设置 `kNeedDrain` 标志，L585 返回 `false`，通知生产者暂停直到 `drain` 事件触发。 |
| Reactive Streams | [Subscription.java#L14-L37](https://github.com/reactive-streams/reactive-streams-jvm/blob/master/api/src/main/java/org/reactivestreams/Subscription.java#L14-L37) | `request(long n)`（L29）— 消费者显式从生产者请求 `n` 项。"在通过此方法发出需求信号之前，Publisher 不会发送任何事件。" 是 RxJava Flowable、Project Reactor 和 Akka Streams 的基础。 |

## 实现

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

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带流控的有界异步队列 | `exercises/typescript/backpressure/01-basic.test.ts` |
| 进阶 | 带阻塞 send/receive 的有界异步通道 | `exercises/typescript/backpressure/02-intermediate.test.ts` |

运行练习：`pnpm test`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

练习文件： Rust `exercises/rust/src/backpressure.rs` · Go `exercises/go/backpressure_test.go` · Python `exercises/python/test_backpressure.py`

## 何时使用

- **流处理** — 防止快速数据源压垮处理器
- **微服务** — 保护下游服务免受过载
- **I/O 管道** — 磁盘读取快于网络写入（或反之）
- **事件驱动系统** — 生产者触发事件快于处理器能处理的速度

## 何时不用

- **允许丢失** — 如果丢数据可以接受（指标、采样），直接丢弃无需阻塞
- **同速系统** — 如果生产者和消费者以相同速度运行，背压增加不必要的复杂度
- **发射后不管** — 如果生产者不需要等待，使用无界队列加监控
- **实时约束** — 阻塞生产者可能违反延迟 SLA

## 更多生产案例

- [RxJava Flowable](https://github.com/ReactiveX/RxJava) — 背压感知的响应式流
- [Kafka](https://github.com/apache/kafka) — 生产者 `buffer.memory` 和 `max.block.ms` 用于流控
- [Linux TCP](https://github.com/torvalds/linux/blob/master/net/ipv4/tcp_output.c) — 拥塞窗口（`cwnd`）作为背压
- [gRPC](https://github.com/grpc/grpc) — HTTP/2 中的流控窗口

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [环形缓冲区 (Ring Buffer)](/zh/patterns/ring-buffer/) | 有界环形缓冲区是实现背压的常见机制 |
| [限流器 / 令牌桶 (Rate Limiter)](/zh/patterns/rate-limiter/) | 限流控制摄入速度；背压信号生产者减速 |
| [信号量 / 有界并发 (Semaphore)](/zh/patterns/semaphore/) | 信号量可以通过限制未完成工作来实现背压 |
| [批处理 (Batch Processing)](/zh/patterns/batch-processing/) | 批处理平滑突发输入，补充背压机制 |

## 挑战题

::: details Q1: 你的有界队列已满。应该阻塞生产者还是丢弃最新的消息？如何决定？
**答案：** 取决于数据丢失是否可以接受。当每条数据都重要时阻塞（金融交易、用户操作）。当新鲜度比完整性更重要时丢弃（监控指标、传感器遥测）。

阻塞保留了所有数据但会向上游传播延迟——如果消费者持续缓慢，生产者会停滞，整个管道都会停止。丢弃会丢失数据但保持生产者的响应能力。常见的混合策略是：监控仪表盘用"丢弃最旧的"（你需要最新的读数），事件溯源用"阻塞"（不能丢失事件）。这个选择是业务决策，而非技术决策。
:::

::: details Q2: 你将 Node.js stream 的 highWaterMark 设为 1MB。流量突增时，500 个并发流导致内存飙升到 500MB。出了什么问题？
**答案：** 每个流分配自己的 highWaterMark 大小的缓冲区，所以 500 个流 x 1MB = 500MB 缓冲内存。highWaterMark 是每个流独立的，而非全局的。

highWaterMark 不是系统级别的限制——它是每个独立流在 `write()` 返回 `false` 时的阈值。当有大量并发流时，总内存 = `并发数 x highWaterMark`。修复方法是降低 highWaterMark（16KB-64KB 是典型值）、限制并发数，或使用全局内存预算来动态调整每个流的阈值。
:::

::: details Q3: 背压和限流有什么区别？一个队友说它们是同一个东西。
**答案：** 限流以固定速率限制吞吐量，不考虑消费者的实际能力。背压则根据消费者的实际处理能力动态调整。

限流说的是"最多每秒 100 个请求"，即使消费者能处理 200 个。背压说的是"以消费者当前能处理的速度发送，不管那个速度是多少"。限流是一种策略；背压是一种反馈机制。它们可以互补：在 API 网关处限流，在处理管道内部使用背压。但它们解决的是不同的问题——限流防止滥用，背压防止资源耗尽。
:::

::: details Q4: 一个 Go 开发者说"我不需要背压，我用带缓冲的 channel 就行了。"这个说法正确吗？
**答案：** 带缓冲的 channel 就是背压。有界 channel 在满时阻塞发送者，这正是"阻塞"式背压策略。

这位开发者已经在使用背压了——只是没有意识到而已。`ch := make(chan int, 10)` 创建了一个容量为 10 的有界缓冲区。当缓冲区满时，`ch <- item` 会阻塞 goroutine，迫使生产者放慢到与消费者匹配的速度。关键问题是缓冲区大小是否选择得当：太小会在小突发时产生不必要的阻塞；太大则会延迟反馈信号，导致内存增长。
:::
