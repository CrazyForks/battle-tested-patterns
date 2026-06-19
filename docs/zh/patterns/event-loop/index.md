---
title: "模式：事件循环 / 反应器 (Event Loop / Reactor)"
description: "单线程循环通过 epoll/kqueue 多路复用 I/O，将就绪事件分发给回调——无需线程即可处理数千连接。"
difficulty: "intermediate"
---

# 模式：事件循环 / 反应器 (Event Loop / Reactor)

<DifficultyBadge />

## 一句话

单线程循环通过 epoll/kqueue 多路复用 I/O，将就绪事件分发给回调——无需线程即可处理数千连接。

<DemoBadge />

## 现实类比

一个人处理整个办公室电话的前台。她不能同时和两个人说话，但她把每个电话放在等待中，处理快速事务，然后轮流回拨。没有阻塞——如果某件事耗时，她记下来继续处理下一件。

## 核心思想

与其为每个连接分配一个线程（昂贵的上下文切换、高内存开销），反应器模式使用单线程阻塞在操作系统的轮询机制（`epoll`、`kqueue`、`IOCP`）上。当任何注册的文件描述符就绪时，循环将事件分发给关联的回调。这就是 Node.js 在单线程上处理 10,000+ 并发连接的原理。

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

| 属性 | 值 |
|------|------|
| 并发模型 | 单线程，非阻塞 I/O |
| 连接数 | 每线程数千（受文件描述符限制，非线程限制） |
| 延迟 | I/O 密集型工作延迟低；一个慢回调会阻塞所有 |
| 内存 | O(连接数) 用于状态，非 O(连接数 * 栈大小) |

**动手试试** — 向调用栈和队列添加任务，然后逐步执行事件循环的执行顺序：

<EventLoopViz />

::: tip 同名的两个"事件循环"
本页讲的是事件循环的 **反应器（reactor）** 含义：libuv/Redis 中那个操作系统层的循环，按阶段（`timers → poll → check → …`）多路复用 I/O，由下方的源码链接佐证。JavaScript 语言层的循环是同一思想的一个 *更窄* 的切片——一个调用栈，按固定顺序排空 **微任务**（`Promise.then`）与 **宏任务**（`setTimeout`）。若想专门建立对 JS 这一层的直觉，[JSV9000](https://www.jsv9000.app/) 是一个很好的交互式可视化工具：粘贴 JS 代码，逐步观察调用栈、微任务队列与宏任务队列的排空过程。
:::

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| libuv | [core.c#L427-L492](https://github.com/libuv/libuv/blob/f6b713398e464a9f166328765be1703fd860981f/src/unix/core.c#L427-L492) | `uv_run`（L427-L492）是 Node.js 使用的主事件循环函数。在单个 `while` 循环中处理定时器、待处理回调、I/O 轮询（`uv__io_poll`）、check 句柄和关闭句柄。支持三种运行模式：`UV_RUN_DEFAULT`（运行直到没有活跃句柄）、`UV_RUN_ONCE`、`UV_RUN_NOWAIT`。 |
| Redis | [ae.c#L360-L468](https://github.com/redis/redis/blob/df63a65d4d4ee33ae67e9f101885074febe0bccb/src/ae.c#L360-L468) | `aeProcessEvents`（L360-L468）是 Redis 事件循环的核心。计算最近的定时器，以该超时调用 `aeApiPoll`（epoll/kqueue/select 抽象），然后分发文件事件和定时器事件。Redis 在单线程上实现 100K+ ops/sec，因为事件循环从不阻塞在单个操作上。 |

## 实现

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

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带处理器注册和 tick/run 的迷你事件循环 | `exercises/typescript/event-loop/01-basic.test.ts` |
| 进阶 | 扩展定时器支持（一次性定时器与 I/O 交错） | `exercises/typescript/event-loop/02-intermediate.test.ts` |

运行练习：`pnpm test:exercises`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

练习文件： Rust `exercises/rust/src/event_loop/mod.rs` · Go `exercises/go/event_loop/event_loop_test.go` · Python `exercises/python/event_loop/test_event_loop.py`

## 何时使用

- **高连接服务器** — Web 服务器、聊天服务器、API 网关，数千连接大多空闲（等待 I/O）
- **I/O 密集型工作** — 网络代理、负载均衡器、数据库连接池，每请求 CPU 工作量极少
- **实时通信** — WebSocket 服务器、游戏服务器、通知系统，低延迟比吞吐量更重要
- **嵌入式/资源受限** — 无法承受每连接一线程的内存开销（每线程 = 1-8 MB 栈空间）

## 何时不用

- **CPU 密集型工作** — 单线程事件循环会在计算上阻塞。如果需要哈希密码、缩放图片或运行 ML 推理，在事件循环旁使用线程池或工作进程。
- **简单请求-响应** — 如果并发连接 < 100 且每个请求都很简单，每请求一线程更简单且易调试。事件循环增加了复杂性（回调管理、状态机）却没有收益。
- **严格排序要求** — 当事件必须按精确到达顺序处理且无交错时，简单的顺序循环或队列消费者更清晰。

## 更多生产案例

- [Node.js](https://github.com/nodejs/node) — 基于 libuv 的事件循环驱动整个 Node.js 运行时
- [Nginx](https://github.com/nginx/nginx) — 每个工作进程运行带 epoll/kqueue 的事件循环
- [Tokio](https://github.com/tokio-rs/tokio) — 基于 mio（跨平台反应器）的 Rust 异步运行时
- [Netty](https://github.com/netty/netty) — 高性能网络的 Java NIO 事件循环

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [协作调度 (Cooperative Scheduling)](/zh/patterns/cooperative-scheduling/) | 事件循环要求协作调度——处理器不能阻塞 |
| [观察者 / 发布-订阅 (Observer / Pub-Sub)](/zh/patterns/observer/) | 事件循环将事件分发给注册的观察者/回调 |
| [环形缓冲区 (Ring Buffer)](/zh/patterns/ring-buffer/) | 事件队列通常实现为环形缓冲区 |
| [Actor 模型](/zh/patterns/actor-model/) | 每个 Actor 本质上是其信箱上的单线程事件循环 |
| [最小堆 / 优先队列 (Min-Heap)](/zh/patterns/min-heap/) | 事件循环使用最小堆按最早截止时间调度定时器回调 |

## 挑战题

::: details Q1: 你的 Node.js 服务器处理 5,000 个 WebSocket 连接没有问题，但添加了一个计算 Fibonacci 数的端点后，所有连接都被阻塞了。为什么？
**答案：** 事件循环是单线程的。在计算 Fibonacci（CPU 密集型、同步操作）时，事件循环无法处理任何 I/O 事件。所有 5,000 个 WebSocket 连接都会冻结，直到计算完成。

解决方案：(1) 将 CPU 工作卸载到 `worker_threads` 池，(2) 使用 `setImmediate()` 将计算分成小块，在块之间让出控制权给事件循环，(3) 使用单独的微服务进行密集计算。这是事件循环模型的根本权衡——协作式多任务意味着一个坏参与者会阻塞所有人。
:::

::: details Q2: Redis 使用单线程事件循环执行命令（自 Redis 6.0 起可选地使用 I/O 线程），但它能处理每秒 10 万以上的操作。它是怎么做到的？
**答案：** Redis 的操作极快——大多数是 O(1) 的哈希表查找或 O(log N) 的有序集合操作，耗时在微秒级别。与网络 I/O 时间相比，事件循环的开销微不足道。

瓶颈不在 CPU 而在网络：读写 socket、解析协议、序列化响应。由于 Redis 通过 `aeProcessEvents` 使用非阻塞 I/O，它每个事件处理一个命令（读取 -> 解析 -> 执行 -> 写入）并立即转向下一个就绪的 socket。没有上下文切换，没有锁竞争，整个数据集都在内存中——纯粹的顺序吞吐。
:::

::: details Q3: libuv 的 `uv_run` 有三种模式：DEFAULT、ONCE、NOWAIT。你何时使用每种？
**答案：**

- **DEFAULT**：正常运行——运行直到所有句柄/请求完成。这是 `node app.js` 使用的模式。进程保持存活直到没有更多计时器、服务器或待处理的回调。
- **ONCE**：处理一轮事件然后返回。适用于将 libuv 嵌入到另一个事件循环中（例如游戏引擎的主循环也需要处理 Node.js 事件）。
- **NOWAIT**：类似 ONCE 但永不阻塞在 I/O 轮询上。只处理已就绪的事件。适用于在紧密循环中轮询，这种情况下阻塞会导致丢帧或超期。

关键区别：DEFAULT 无限期阻塞，ONCE 阻塞一次迭代，NOWAIT 永不阻塞。
:::

::: details Q4: 为什么 Nginx 使用多个工作进程且每个都有自己的事件循环，而不是使用单一事件循环？
**答案：** 一个事件循环在一个 CPU 核上运行会浪费其他核。Nginx 启动 N 个工作进程（通常每个 CPU 核一个），每个运行自己独立的事件循环。

这带来了：(1) 多核利用率而无共享状态线程 bug，(2) 进程隔离——一个崩溃的 worker 不会拖垮其他的，(3) 零停机重载——新 worker 使用新配置启动，旧 worker 排空连接。`SO_REUSEPORT` socket 选项让所有 worker 在同一端口上接受连接，由内核在它们之间负载均衡。
:::
