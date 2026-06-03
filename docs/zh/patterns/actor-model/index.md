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
  │ 信箱:            │      │ 信箱:            │      │ 信箱:            │
  │ ┌──┬──┬──┐       │ send │ ┌──┬──┐          │      │ ┌──┐             │
  │ │m1│m2│m3│       │─────►│ │m4│m5│          │      │ │m6│             │
  │ └──┴──┴──┘       │      │ └──┴──┘          │      │ └──┘             │
  │ 处理中: m1       │      │ 处理中: m4       │      │ 空闲             │
  └──────────────────┘      └──────────────────┘      └──────────────────┘
```

| 属性 | 值 |
|------|------|
| 并发 | 无共享状态 — 仅消息传递 |
| 处理 | 每个 Actor 串行（一次一条消息） |
| 故障隔离 | Actor 崩溃不会损坏其他 Actor |
| 可扩展性 | 数百万轻量级 Actor（Erlang: 每进程 2KB） |

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Akka (Scala) | [Actor.scala#L476-L547](https://github.com/akka/akka/blob/main/akka-actor/src/main/scala/akka/actor/Actor.scala#L476-L547) | `trait Actor` — 核心 Actor 接口。定义 `context`、`self`、`sender()` 和 `def receive: Actor.Receive`（L528），每个 Akka Actor 通过偏函数指定其消息处理行为。`aroundReceive`（L540-L546）是分发钩子。 |
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

::: details Q1: Actors communicate only via asynchronous messages, with no shared state or locks. A colleague claims "actors can't deadlock since there are no locks." Is this true?
**Answer:** Actors can still deadlock through circular message dependencies, even without any locks.

If Actor A sends a message to Actor B and waits for a response, while Actor B sends a message to Actor A and waits for a response, neither can process the other's message — both mailboxes contain an unprocessed message that requires the other to proceed. This is logically equivalent to a lock-based deadlock. The mitigation is to avoid synchronous request-reply patterns between actors, use timeouts on all message exchanges, or design message flows as DAGs (directed acyclic graphs) rather than cycles.
:::

::: details Q2: Your actor system has a fast producer actor sending 10,000 messages/second to a slow consumer actor that processes 100 messages/second. The consumer's mailbox grows unboundedly. How should an actor system handle this back pressure?
**Answer:** Bounded mailboxes with explicit back-pressure signals — when the mailbox is full, the sender must either drop messages, block, or receive a rejection signal.

Unbounded mailboxes are a common pitfall in actor systems — they trade memory for liveness, eventually causing OOM crashes. Akka offers `BoundedMailbox` which blocks senders when full, and flow-control via Akka Streams (reactive streams back-pressure). Erlang processes have unbounded mailboxes by design but rely on the OTP supervision tree to restart processes that consume too much memory. The architectural insight is that back-pressure is a system design concern, not just an actor concern — you need to decide at each producer-consumer boundary what happens when the consumer can't keep up.
:::

::: details Q3: An actor processing a payment message crashes mid-execution due to a bug. The payment was partially processed (funds debited but not credited). How does Erlang/OTP handle actor crashes without corrupting the system?
**Answer:** OTP's supervision tree restarts the crashed actor with fresh state — the key insight is that actor state is ephemeral and the source of truth lives elsewhere (database, message log).

Erlang's "let it crash" philosophy means actors don't try to recover from unexpected errors — they die, and a supervisor process restarts them. But this only works if the actor's side effects are either idempotent or transactional. For the payment case, the debit and credit should be wrapped in a database transaction, or the actor should use an outbox pattern: write the intent to a durable log first, then execute. If it crashes mid-execution, the restarted actor replays the log. The actor model isolates the crash (other actors are unaffected), but durability and consistency still require explicit design.
:::

::: details Q4: Erlang can run millions of actors (processes) on a single machine, each with only ~2KB of memory. The Go implementation in this doc uses goroutines with a channel mailbox. Could you run 1 million Go actors the same way?
**Answer:** Yes for the goroutine count (Go supports millions of goroutines), but each channel in the implementation allocates a buffer of 100 elements, and the combined channel overhead is significant.

A goroutine starts at ~2-4KB stack (similar to Erlang), so 1 million goroutines cost ~2-4GB of stack memory alone. Each buffered channel adds its buffer size times the element size. Since Go 1.14, goroutines are asynchronously preempted via signals, so CPU-bound actors won't starve others. The deeper difference is Erlang's per-process garbage collection — each actor's GC pause is independent and microsecond-scale, while Go's GC is global and can pause all actors. For truly massive actor counts, Erlang's BEAM VM was purpose-built for this; Go can approximate it but with different GC tradeoffs.
:::
