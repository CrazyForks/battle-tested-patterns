# 模式：Actor 模型

## 一句话

每个 Actor 拥有一个信箱并按顺序处理消息——没有共享状态，没有锁，仅通过消息传递实现安全并发。

## 核心思想

Actor 是拥有私有状态和信箱（消息队列）的轻量级进程。Actor 之间仅通过发送异步消息通信。每个 Actor 一次处理一条消息，更新状态并可选地向其他 Actor 发送消息。这从设计上消除了共享状态并发 bug。

```text
  Actor A                    Actor B                    Actor C
  ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
  │ State: count=3   │      │ State: items=[]  │      │ State: total=0   │
  │                  │      │                  │      │                  │
  │ Mailbox:         │      │ Mailbox:         │      │ Mailbox:         │
  │ ┌──┬──┬──┐       │ send │ ┌──┬──┐          │      │ ┌──┐             │
  │ │m1│m2│m3│       │─────►│ │m4│m5│          │      │ │m6│             │
  │ └──┴──┴──┘       │      │ └──┴──┘          │      │ └──┘             │
  │ Processing: m1   │      │ Processing: m4   │      │ Idle             │
  └──────────────────┘      └──────────────────┘      └──────────────────┘
```

| 属性 | 值 |
|------|------|
| 并发 | 无共享状态 — 仅消息传递 |
| 处理 | 每个 Actor 串行（一次一条消息） |
| 故障隔离 | Actor 崩溃不会损坏其他 Actor |
| 可扩展性 | 数百万轻量级 Actor（Erlang: 每进程 2KB） |

**动手试试** — 在 Actor 之间发送消息，观察邮箱处理和状态隔离：

<ActorModelViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Akka (Scala) | [Actor.scala#L476-L547](https://github.com/akka/akka-core/blob/main/akka-actor/src/main/scala/akka/actor/Actor.scala#L476-L547) | `trait Actor` — 核心 Actor 接口。定义 `context`、`self`、`sender()` 和 `def receive: Actor.Receive`（L528），每个 Akka Actor 通过偏函数指定其消息处理行为。`aroundReceive`（L540-L546）是分发钩子。 |
| Erlang/OTP | [erl_process.h#L1043-L1205](https://github.com/erlang/otp/blob/master/erts/emulator/beam/erl_process.h#L1043-L1205) | `struct process` — BEAM 虚拟机中 Erlang 进程（Actor）的表示。关键字段：`sig_qs`（L1107，信号/消息队列 — 信箱）、`sig_inq`（L1168，并发信号输入队列）、`state`（L1165，原子进程状态标志）。每个进程是拥有自己堆和信箱的轻量级 Actor。 |

## 实现

::: code-group

```typescript [TypeScript]
type MessageHandler<S> = (state: S, msg: unknown) => S;

class Actor<S> {
  private state: S;
  private mailbox: unknown[] = [];
  private processing = false;

  constructor(initialState: S, private handler: MessageHandler<S>) {
    this.state = initialState;
  }

  send(msg: unknown): void {
    this.mailbox.push(msg);
    if (!this.processing) this.processMailbox();
  }

  private processMailbox(): void {
    this.processing = true;
    while (this.mailbox.length > 0) {
      const msg = this.mailbox.shift()!;
      this.state = this.handler(this.state, msg);
    }
    this.processing = false;
  }

  getState(): S {
    return this.state;
  }
}
```

```go [Go]
type Actor struct {
	state   interface{}
	mailbox chan interface{}
	handler func(state interface{}, msg interface{}) interface{}
}

func NewActor(initial interface{}, handler func(interface{}, interface{}) interface{}) *Actor {
	a := &Actor{
		state:   initial,
		mailbox: make(chan interface{}, 100),
		handler: handler,
	}
	go a.run()
	return a
}

func (a *Actor) Send(msg interface{}) {
	a.mailbox <- msg
}

func (a *Actor) run() {
	for msg := range a.mailbox {
		a.state = a.handler(a.state, msg)
	}
}
```

```python [Python]
from collections import deque
from typing import Any, Callable

class Actor:
    def __init__(self, initial_state: Any, handler: Callable[[Any, Any], Any]):
        self.state = initial_state
        self.handler = handler
        self._mailbox: deque[Any] = deque()
        self._processing = False

    def send(self, msg: Any) -> None:
        self._mailbox.append(msg)
        if not self._processing:
            self._process_mailbox()

    def _process_mailbox(self) -> None:
        self._processing = True
        while self._mailbox:
            msg = self._mailbox.popleft()
            self.state = self.handler(self.state, msg)
        self._processing = False

    def get_state(self) -> Any:
        return self.state
```

```rust [Rust]
pub struct Actor<S> {
    state: S,
    mailbox: Vec<Box<dyn std::any::Any>>,
}

impl<S> Actor<S> {
    pub fn new(initial_state: S) -> Self {
        Actor { state: initial_state, mailbox: Vec::new() }
    }

    pub fn send<M: std::any::Any>(&mut self, msg: M) {
        self.mailbox.push(Box::new(msg));
    }

    pub fn process<F>(&mut self, handler: F)
    where F: Fn(&S, &dyn std::any::Any) -> S {
        while let Some(msg) = if self.mailbox.is_empty() { None } else { Some(self.mailbox.remove(0)) } {
            self.state = handler(&self.state, msg.as_ref());
        }
    }

    pub fn state(&self) -> &S {
        &self.state
    }
}
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带信箱和消息处理的 Actor | `exercises/typescript/actor-model/01-basic.test.ts` |
| 进阶 | Actor 监督 — 父 Actor 重启崩溃的子 Actor | `exercises/typescript/actor-model/02-intermediate.test.ts` |

## 何时使用

- **分布式系统** — Actor 自然映射到网络节点（Erlang/OTP、Akka Cluster）
- **游戏服务器** — 每个实体（玩家、NPC、房间）作为独立 Actor
- **物联网** — 每个设备作为处理传感器事件的 Actor
- **电信** — Erlang 的起源：数百万并发通话会话
- **聊天系统** — 每个对话/聊天室作为一个 Actor

## 何时不用

- **紧密数据耦合** — 组件需要共享可变状态时，消息传递增加延迟
- **简单请求-响应** — 函数调用比 Actor 往返更简单
- **计算密集无并发** — 没有并发收益的 Actor 开销
- **强一致性** — Actor 提供最终一致性；ACID 需要事务

## 更多生产案例

- [Orleans (C#)](https://github.com/dotnet/orleans/blob/main/src/Orleans.Runtime/Catalog/ActivationData.cs#L31-L55) — 虚拟 Actor（"grain"），`RunMessageLoop` 消息分发在 L980-L1012
- [Proto.Actor (Go)](https://github.com/asynkron/protoactor-go/blob/dev/actor/message.go#L12-L14) — 极简 `Actor` 接口，仅一个 `Receive(c Context)` 方法
- [Actix (Rust)](https://github.com/actix/actix) — Rust 的类型化消息 Actor 框架
- [Microsoft DAPR](https://github.com/dapr/dapr) — 微服务的虚拟 Actor

## 挑战题

::: details Q1: Actor 之间只通过异步消息通信，没有共享状态和锁。一位同事声称"Actor 不会死锁，因为没有锁"。这个说法正确吗？
**答案：** 即使没有锁，Actor 仍然可能因为循环消息依赖而发生死锁。

如果 Actor A 向 Actor B 发送消息并等待回复，同时 Actor B 也向 Actor A 发送消息并等待回复，那么双方都无法处理对方的消息——两个邮箱中各有一条未处理的消息，而处理它需要对方先响应。这在逻辑上等价于基于锁的死锁。缓解措施包括：避免 Actor 之间的同步请求-应答模式、为所有消息交换设置超时，或者将消息流设计为 DAG（有向无环图）而非环形结构。
:::

::: details Q2: 你的 Actor 系统中，一个高速生产者 Actor 以每秒 10,000 条消息的速率发送，而消费者 Actor 每秒只能处理 100 条。消费者的邮箱无限增长。Actor 系统应该如何处理这种背压？
**答案：** 使用有界邮箱并配合显式的背压信号——当邮箱满时，发送方必须丢弃消息、阻塞或收到拒绝信号。

无界邮箱是 Actor 系统中常见的陷阱——它用内存换取活性，最终会导致 OOM 崩溃。Akka 提供了 `BoundedMailbox`，在邮箱满时阻塞发送方，并通过 Akka Streams 实现流控（响应式流背压）。Erlang 进程的邮箱在设计上是无界的，但依赖 OTP 监督树来重启内存消耗过大的进程。架构层面的洞察是：背压是系统设计问题，而不仅仅是单个 Actor 的问题——你需要在每个生产者-消费者边界上决定当消费者跟不上时该怎么办。
:::

::: details Q3: 一个正在处理支付消息的 Actor 由于 bug 在执行过程中崩溃。支付被部分处理（资金已扣除但未入账）。Erlang/OTP 如何在不破坏系统的情况下处理 Actor 崩溃？
**答案：** OTP 的监督树会用全新的状态重启崩溃的 Actor——关键洞察是 Actor 状态是临时的，真正的数据源在别处（数据库、消息日志）。

Erlang 的"任其崩溃"哲学意味着 Actor 不会尝试从意外错误中恢复——它们直接终止，由 supervisor 进程重启。但这只在 Actor 的副作用是幂等的或事务性的情况下才有效。对于支付场景，扣款和入账应该包裹在数据库事务中，或者 Actor 应该使用 outbox 模式：先将意图写入持久化日志，再执行操作。如果在执行过程中崩溃，重启后的 Actor 会重放日志。Actor 模型隔离了崩溃（其他 Actor 不受影响），但持久性和一致性仍然需要显式设计。
:::

::: details Q4: Erlang 可以在单台机器上运行数百万个 Actor（进程），每个仅占用约 2KB 内存。本文档中的 Go 实现使用 goroutine 配合 channel 邮箱。你能以同样的方式运行 100 万个 Go Actor 吗？
**答案：** 就 goroutine 数量而言可以（Go 支持数百万个 goroutine），但实现中每个 channel 分配了 100 个元素的缓冲区，累积的 channel 开销是显著的。

一个 goroutine 的初始栈约 2-4KB（与 Erlang 类似），因此 100 万个 goroutine 仅栈内存就需要约 2-4GB。每个带缓冲的 channel 还会额外占用"缓冲区大小 x 元素大小"的内存。自 Go 1.14 起，goroutine 通过信号实现异步抢占，因此 CPU 密集型 Actor 不会饿死其他 Actor。更深层的区别在于 Erlang 的按进程垃圾回收——每个 Actor 的 GC 暂停是独立的且在微秒级别，而 Go 的 GC 是全局的，可能暂停所有 Actor。对于真正大规模的 Actor 数量，Erlang 的 BEAM VM 是专门为此构建的；Go 可以近似实现，但有不同的 GC 权衡。
:::
