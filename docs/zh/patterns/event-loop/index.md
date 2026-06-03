# 模式：事件循环 / 反应器 (Event Loop / Reactor)

## 一句话

单线程循环通过 epoll/kqueue 多路复用 I/O，将就绪事件分发给回调——无需线程即可处理数千连接。

## 核心思想

与其为每个连接分配一个线程（昂贵的上下文切换、高内存开销），反应器模式使用单线程阻塞在操作系统的轮询机制（`epoll`、`kqueue`、`IOCP`）上。当任何注册的文件描述符就绪时，循环将事件分发给关联的回调。这就是 Node.js 在单线程上处理 10,000+ 并发连接的原理。

```text
  ┌─────────────────────────────────────────────────┐
  │                  事件循环                         │
  │                                                  │
  │  ┌──────────┐    ┌──────────┐    ┌──────────┐   │
  │  │ 注册兴趣 │    │   轮询   │    │ 分发就绪 │   │
  │  │  (fds)   │───►│  (阻塞)  │───►│  处理器  │   │
  │  └──────────┘    └──────────┘    └────┬─────┘   │
  │       ▲                               │         │
  │       └───────────────────────────────┘         │
  │                   重复                           │
  └─────────────────────────────────────────────────┘

  阶段详情（libuv 模型）:
  ┌────────┐  ┌─────────┐  ┌──────┐  ┌───────┐  ┌───────┐
  │ 定时器 │─►│ 待处理  │─►│ 轮询 │─►│ 检查  │─►│ 关闭  │──► 下一轮
  │        │  │  回调    │  │      │  │       │  │       │
  └────────┘  └─────────┘  └──────┘  └───────┘  └───────┘
```

| 属性 | 值 |
|------|------|
| 并发模型 | 单线程，非阻塞 I/O |
| 连接数 | 每线程数千（受文件描述符限制，非线程限制） |
| 延迟 | I/O 密集型工作延迟低；一个慢回调会阻塞所有 |
| 内存 | O(连接数) 用于状态，非 O(连接数 * 栈大小) |

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| libuv | [core.c#L427-L492](https://github.com/libuv/libuv/blob/v1.x/src/unix/core.c#L427-L492) | `uv_run`（L427-L492）是 Node.js 使用的主事件循环函数。在单个 `while` 循环中处理定时器、待处理回调、I/O 轮询（`uv__io_poll`）、check 句柄和关闭句柄。支持三种运行模式：`UV_RUN_DEFAULT`（运行直到没有活跃句柄）、`UV_RUN_ONCE`、`UV_RUN_NOWAIT`。 |
| Redis | [ae.c#L360-L468](https://github.com/redis/redis/blob/unstable/src/ae.c#L360-L468) | `aeProcessEvents`（L360-L468）是 Redis 事件循环的核心。计算最近的定时器，以该超时调用 `aeApiPoll`（epoll/kqueue/select 抽象），然后分发文件事件和定时器事件。Redis 在单线程上实现 100K+ ops/sec，因为事件循环从不阻塞在单个操作上。 |

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

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带处理器注册和 tick/run 的迷你事件循环 | `exercises/typescript/event-loop/01-basic.test.ts` |
| 进阶 | 扩展定时器支持（一次性定时器与 I/O 交错） | `exercises/typescript/event-loop/02-intermediate.test.ts` |

## 何时使用

- **高连接服务器** -- Web 服务器、聊天服务器、API 网关，数千连接大多空闲（等待 I/O）
- **I/O 密集型工作** -- 网络代理、负载均衡器、数据库连接池，每请求 CPU 工作量极少
- **实时通信** -- WebSocket 服务器、游戏服务器、通知系统，低延迟比吞吐量更重要
- **嵌入式/资源受限** -- 无法承受每连接一线程的内存开销（每线程 = 1-8 MB 栈空间）

## 何时不用

- **CPU 密集型工作** -- 单线程事件循环会在计算上阻塞。如果需要哈希密码、缩放图片或运行 ML 推理，在事件循环旁使用线程池或工作进程。
- **简单请求-响应** -- 如果并发连接 < 100 且每个请求都很简单，每请求一线程更简单且易调试。事件循环增加了复杂性（回调管理、状态机）却没有收益。
- **严格排序要求** -- 当事件必须按精确到达顺序处理且无交错时，简单的顺序循环或队列消费者更清晰。

## 更多生产案例

- [Node.js](https://github.com/nodejs/node) -- 基于 libuv 的事件循环驱动整个 Node.js 运行时
- [Nginx](https://github.com/nginx/nginx) -- 每个工作进程运行带 epoll/kqueue 的事件循环
- [Tokio](https://github.com/tokio-rs/tokio) -- 基于 mio（跨平台反应器）的 Rust 异步运行时
- [Netty](https://github.com/netty/netty) -- 高性能网络的 Java NIO 事件循环

## 挑战题

::: details Q1: Your Node.js server handles 5,000 WebSocket connections fine, but adding a single endpoint that computes a Fibonacci number blocks ALL connections. Why?
**Answer:** The event loop is single-threaded. While computing Fibonacci (CPU-bound, synchronous), the event loop cannot process any I/O events. All 5,000 WebSocket connections are frozen until the computation completes.

Solutions: (1) offload CPU work to a `worker_threads` pool, (2) break computation into chunks with `setImmediate()` to yield back to the event loop between chunks, (3) use a separate microservice for heavy computation. This is the fundamental tradeoff of the event loop model -- cooperative multitasking means one bad actor blocks everyone.
:::

::: details Q2: Redis is single-threaded and uses an event loop, yet it handles 100K+ operations per second. How?
**Answer:** Redis operations are extremely fast -- most are O(1) hash table lookups or O(log N) sorted set operations that take microseconds. The event loop overhead is negligible compared to network I/O time.

The bottleneck is not CPU but network: reading/writing to sockets, parsing the protocol, and serializing responses. Since Redis uses non-blocking I/O via `aeProcessEvents`, it processes one command per event (read -> parse -> execute -> write) and immediately moves to the next ready socket. There's no context switching, no lock contention, and the entire dataset fits in memory -- pure sequential throughput.
:::

::: details Q3: libuv's `uv_run` has three modes: DEFAULT, ONCE, NOWAIT. When would you use each?
**Answer:**

- **DEFAULT**: Normal operation -- run until all handles/requests are done. This is what `node app.js` uses. The process stays alive until there are no more timers, servers, or pending callbacks.
- **ONCE**: Process one round of events, then return. Useful for embedding libuv in another event loop (e.g., a game engine's main loop that also needs to handle Node.js events).
- **NOWAIT**: Like ONCE but never blocks on I/O poll. Only processes already-ready events. Useful for polling in a tight loop where blocking would cause missed frames or deadlines.

The key difference: DEFAULT blocks indefinitely, ONCE blocks for one iteration, NOWAIT never blocks.
:::

::: details Q4: Why does Nginx use multiple worker processes each with its own event loop, rather than one single event loop?
**Answer:** One event loop on one CPU core wastes the other cores. Nginx spawns N worker processes (typically one per CPU core), each running its own independent event loop.

This gives you: (1) multi-core utilization without shared-state threading bugs, (2) process isolation -- one crashed worker doesn't take down others, (3) zero-downtime reload -- new workers start with new config while old workers drain. The `SO_REUSEPORT` socket option lets all workers accept connections on the same port, with the kernel load-balancing across them.
:::
