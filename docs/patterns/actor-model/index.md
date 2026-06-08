---
description: "Each actor has a mailbox and processes messages sequentially — no shared state, no locks, just message passing for safe concurrency."
difficulty: "advanced"
---

# Pattern: Actor Model

<DifficultyBadge />

## One Liner

Each actor has a mailbox and processes messages sequentially — no shared state, no locks, just message passing for safe concurrency.

<DemoBadge />

## Real-World Analogy

Coworkers communicating only through sealed envelopes in mailboxes. No one walks into another's office — you write a message, drop it in their mailbox, and go back to your own work. Each person processes their mail one message at a time.

## Core Idea

An actor is a lightweight process with private state and a mailbox (message queue). Actors communicate exclusively by sending asynchronous messages. Each actor processes one message at a time, updating its state and optionally sending messages to other actors. This eliminates shared-state concurrency bugs by design.

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

| Property | Value |
|----------|-------|
| Concurrency | No shared state — message passing only |
| Processing | Sequential per actor (one message at a time) |
| Failure isolation | Actor crash doesn't corrupt other actors |
| Scalability | Millions of lightweight actors (Erlang: 2KB per process) |

**Try it yourself** — send messages between actors and observe mailbox processing and state isolation:

<ActorModelViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| Akka (Scala) | [Actor.scala#L476-L547](https://github.com/akka/akka-core/blob/main/akka-actor/src/main/scala/akka/actor/Actor.scala#L476-L547) | `trait Actor` — the core actor interface. Defines `context`, `self`, `sender()`, and `def receive: Actor.Receive` (L528) where every Akka actor specifies its message-handling behavior via a partial function. `aroundReceive` (L540-L546) is the dispatch hook. |
| Erlang/OTP | [erl_process.h#L1043-L1205](https://github.com/erlang/otp/blob/master/erts/emulator/beam/erl_process.h#L1043-L1205) | `struct process` — the BEAM VM's representation of an Erlang process (actor). Key fields: `sig_qs` (L1107, signal/message queues — the mailbox), `sig_inq` (L1168, concurrent signal input queue), `state` (L1165, atomic process state flags). Each process is a lightweight actor with its own heap and mailbox. |

## Implementation

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

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement an actor with mailbox and message processing | `exercises/typescript/actor-model/01-basic.test.ts` |
| Intermediate | Actor supervision — parent restarts crashed children | `exercises/typescript/actor-model/02-intermediate.test.ts` |

Run exercises: `pnpm test` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/actor_model.rs` · Go `exercises/go/actor_model_test.go` · Python `exercises/python/test_actor_model.py`

## When to Use

- **Distributed systems** — actors map naturally to network nodes (Erlang/OTP, Akka Cluster)
- **Game servers** — each entity (player, NPC, room) as an independent actor
- **IoT** — each device as an actor processing sensor events
- **Telecom** — Erlang's origin: millions of concurrent call sessions
- **Chat systems** — each conversation/room as an actor

## When NOT to Use

- **Tight data coupling** — if components need shared mutable state, message passing adds latency
- **Simple request-response** — a function call is simpler than an actor roundtrip
- **Computation-heavy, no concurrency** — actor overhead without concurrency benefit
- **Strong consistency** — actors provide eventual consistency; use transactions for ACID

## More Production Uses

- [Orleans (C#)](https://github.com/dotnet/orleans/blob/main/src/Orleans.Runtime/Catalog/ActivationData.cs#L31-L55) — virtual actor ("grain") with `RunMessageLoop` dispatch at L980-L1012
- [Proto.Actor (Go)](https://github.com/asynkron/protoactor-go/blob/dev/actor/message.go#L12-L14) — minimal `Actor` interface with single `Receive(c Context)` method
- [Actix (Rust)](https://github.com/actix/actix) — actor framework for Rust with typed messages
- [Microsoft DAPR](https://github.com/dapr/dapr) — virtual actors for microservices

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Observer](/patterns/observer/) | Actors communicate via messages, similar to observer's publish/subscribe pattern |
| [Event Loop](/patterns/event-loop/) | Each actor processes its mailbox sequentially, like a single-threaded event loop |
| [State Machine](/patterns/state-machine/) | Actor behavior often follows a state machine pattern for its internal logic |

## Challenge Questions

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

A goroutine starts at 2KB stack (since Go 1.4), so 1 million goroutines cost ~2GB of stack memory alone. Each buffered channel adds its buffer size times the element size. Since Go 1.14, goroutines are asynchronously preempted via signals, so CPU-bound actors won't starve others. The deeper difference is Erlang's per-process garbage collection — each actor's GC pause is independent and microsecond-scale. Go's GC is global but concurrent, with STW pauses typically sub-millisecond (often under 100μs since Go 1.8+). The real tradeoff is that Erlang's per-process GC keeps pause impact localized, while Go's concurrent GC traverses the entire heap — meaningful at extreme actor counts. For truly massive actor counts, Erlang's BEAM VM was purpose-built for this; Go can approximate it but with different GC tradeoffs.
:::
