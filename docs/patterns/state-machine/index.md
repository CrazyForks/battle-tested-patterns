---
description: "Model an entity's lifecycle as a set of states with explicit transitions, making impossible states unrepresentable and every state change auditable."
difficulty: "beginner"
---

# Pattern: State Machine

<DifficultyBadge />

## One Liner

Model an entity's lifecycle as a set of states with explicit transitions, making impossible states unrepresentable and every state change auditable.

<DemoBadge />

## Real-World Analogy

A vending machine. It has clearly defined states: idle, coin-inserted, dispensing. You can't dispense without inserting a coin, and you can't insert a coin while it's already dispensing. Every button press is only valid in certain states.

## Core Idea

A state machine defines a finite set of states an entity can be in, and the transitions between them. At any point, the entity is in exactly one state. Transitions are triggered by events and can have guard conditions.

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> loading : FETCH
    loading --> success : RESOLVE
    loading --> error : REJECT
    error --> loading : RETRY
    success --> idle : RESET
```

The power: **impossible transitions don't exist**. You can't go from `success` to `error` because no such transition is defined. The compiler (or runtime) enforces this.

| Property | Value |
|----------|-------|
| Transition | O(1) — lookup in state×event table |
| Current state | O(1) — single variable |
| Valid events | Enumerable per state — enables exhaustive checking |
| Space | O(states × events) for the transition table |

**Try it yourself** — click events to trigger transitions and observe which events are valid in each state:

<StateMachineViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| XState | [StateMachine.ts#L58-L120](https://github.com/statelyai/xstate/blob/main/packages/core/src/StateMachine.ts#L58-L120) | `StateMachine` class — `transition()` takes current state + event, evaluates guard conditions, returns next state config. Supports hierarchical states via nested `states` property with parallel regions and history nodes. |
| Linux Kernel | [tcp_input.c#L4865-L4920](https://github.com/torvalds/linux/blob/master/net/ipv4/tcp_input.c#L4865-L4920) | TCP connection state machine — the `switch (sk->sk_state)` block implements the TCP state transitions (LISTEN → SYN_SENT → ESTABLISHED → FIN_WAIT, etc.) that every internet connection uses. |

## Implementation

::: code-group

```typescript [TypeScript]
type StateConfig<S extends string, E extends string> = {
  [state in S]: {
    on: Partial<Record<E, S>>;
  };
};

class StateMachine<S extends string, E extends string> {
  private current: S;

  constructor(
    private config: StateConfig<S, E>,
    initial: S,
  ) {
    this.current = initial;
  }

  get state(): S {
    return this.current;
  }

  send(event: E): S {
    const transitions = this.config[this.current].on;
    const next = transitions[event];
    if (next !== undefined) {
      this.current = next;
    }
    return this.current;
  }

  can(event: E): boolean {
    return this.config[this.current].on[event] !== undefined;
  }
}
```

```rust [Rust]
use std::collections::HashMap;

pub struct StateMachine {
    current: String,
    transitions: HashMap<(String, String), String>,
}

impl StateMachine {
    pub fn new(initial: &str) -> Self {
        StateMachine {
            current: initial.to_string(),
            transitions: HashMap::new(),
        }
    }

    pub fn add_transition(&mut self, from: &str, event: &str, to: &str) {
        self.transitions.insert(
            (from.to_string(), event.to_string()),
            to.to_string(),
        );
    }

    pub fn send(&mut self, event: &str) -> &str {
        let key = (self.current.clone(), event.to_string());
        if let Some(next) = self.transitions.get(&key) {
            self.current = next.clone();
        }
        &self.current
    }

    pub fn state(&self) -> &str {
        &self.current
    }
}
```

```go [Go]
type StateMachine struct {
	current     string
	transitions map[string]map[string]string // state -> event -> next
}

func New(initial string) *StateMachine {
	return &StateMachine{
		current:     initial,
		transitions: make(map[string]map[string]string),
	}
}

func (sm *StateMachine) AddTransition(from, event, to string) {
	if sm.transitions[from] == nil {
		sm.transitions[from] = make(map[string]string)
	}
	sm.transitions[from][event] = to
}

func (sm *StateMachine) Send(event string) string {
	if next, ok := sm.transitions[sm.current][event]; ok {
		sm.current = next
	}
	return sm.current
}

func (sm *StateMachine) State() string { return sm.current }
```

```python [Python]
class StateMachine:
    def __init__(self, config: dict, initial: str):
        self._config = config
        self._current = initial

    @property
    def state(self) -> str:
        return self._current

    def send(self, event: str) -> str:
        transitions = self._config.get(self._current, {}).get("on", {})
        if event in transitions:
            self._current = transitions[event]
        return self._current

    def can(self, event: str) -> bool:
        return event in self._config.get(self._current, {}).get("on", {})

# Usage
traffic_light = StateMachine({
    "green":  {"on": {"TIMER": "yellow"}},
    "yellow": {"on": {"TIMER": "red"}},
    "red":    {"on": {"TIMER": "green"}},
}, initial="green")

traffic_light.send("TIMER")  # "yellow"
traffic_light.send("TIMER")  # "red"
traffic_light.send("TIMER")  # "green"
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a state machine with send/can | `exercises/typescript/state-machine/01-basic.test.ts` |
| Intermediate | Traffic light controller with timed transitions | `exercises/typescript/state-machine/02-intermediate.test.ts` |

Run exercises: `pnpm test` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/state_machine.rs` · Go `exercises/go/state_machine_test.go` · Python `exercises/python/test_state_machine.py`

## When to Use

- **Protocol implementation** — TCP, HTTP, WebSocket state transitions
- **UI flow management** — multi-step forms, authentication flows, modals
- **Game logic** — character states (idle, walking, attacking, dead)
- **Workflow engines** — approval chains, deployment pipelines
- **Parsing** — tokenizers, regex engines, protocol decoders

## When NOT to Use

- **Simple boolean toggles** — a `true`/`false` doesn't need a state machine
- **Unbounded states** — if the state space is continuous (positions, scores), use plain variables
- **No invalid transitions** — if any state can transition to any other, you don't need constraints
- **Combinatorial explosion** — 5 independent toggles = 32 states; model orthogonal concerns as parallel machines or use statecharts

## More Production Uses

- [RE2](https://github.com/google/re2/blob/main/re2/nfa.cc) — NFA-based regex engine using Thompson's algorithm
- HTTP/2 stream states ([RFC 7540](https://datatracker.ietf.org/doc/html/rfc7540))
- [Kubernetes](https://github.com/kubernetes/kubernetes/blob/master/pkg/kubelet/lifecycle/handlers.go) — pod lifecycle state transitions
- [Godot Engine](https://github.com/godotengine/godot/blob/master/scene/animation/animation_tree.cpp) — animation state machine for game characters

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Actor Model](/patterns/actor-model/) | Actors often use state machines to manage their internal behavior |
| [Circuit Breaker](/patterns/circuit-breaker/) | Circuit breaker is a classic state machine: closed -> open -> half-open |
| [Visitor](/patterns/visitor/) | Visitors can dispatch differently based on state machine's current state |

## Challenge Questions

::: details Q1: A form has 4 steps, each with a "valid" and "invalid" sub-state, plus a "submitting" and "submitted" state. That's 4 × 2 + 2 = 10 states. If you add a "dirty/clean" dimension, it doubles to 20. How do you avoid this state explosion?
**Answer:** Use parallel (orthogonal) state machines — one for the form step, one for validation status, one for dirty tracking — instead of one flat machine with every combination.

This is exactly what statecharts (Harel's extension of FSMs) solve. Each concern runs as an independent region: the step machine handles `NEXT`/`BACK`, the validation machine handles `VALIDATE`/`INVALIDATE`, the dirty machine handles `CHANGE`/`SAVE`. They compose without multiplying. XState supports this via `type: 'parallel'`. The total states are 4 + 2 + 2 = 8 instead of 4 × 2 × 2 = 16.
:::

::: details Q2: In the traffic light example, you want the light to stay red for 60s but yellow for only 5s. Where does this timing logic belong — in the state machine or outside it?
**Answer:** The timing lives outside the machine as the event source; the machine only defines which transitions are valid.

A state machine is not a scheduler — it defines *what* can happen, not *when*. An external timer fires a `TIMER` event after the appropriate delay. The machine receives the event and transitions. This separation is important: the same machine definition works whether timers are real (production), instant (tests), or manual (debugging). Putting delays inside transitions couples the machine to time, making it harder to test and reason about.
:::

::: details Q3: You add a guard condition: "only transition from `loading` to `success` if the response has status 200." What happens if no guard matches — is the event silently dropped?
**Answer:** Yes, in most implementations the event is silently ignored and the machine stays in its current state.

This is by design — an unhandled event is not an error in state machine semantics. If no transition matches (because no guard passes), the machine remains stable. This is safer than throwing an exception, because events often arrive asynchronously and may be irrelevant to the current state. If you need to handle "no transition matched" explicitly, model it as a catch-all transition to an error state, or use an `onEvent` hook to log unhandled events.
:::

::: details Q4: TCP has 11 states and ~25 transitions. Could you replace the state machine with a series of `if/else` checks on boolean flags like `isConnected`, `isSynSent`, `isFinWait`?
**Answer:** Technically yes, but you lose the guarantee that impossible states are unrepresentable — boolean flags allow invalid combinations like `isConnected && isFinWait`.

With 11 booleans you have 2^11 = 2048 possible combinations, of which only 11 are valid. Every `if/else` must guard against the 2037 invalid states. A state machine makes this impossible by construction: the entity is always in exactly one state, and only defined transitions can change it. The TCP spec itself is defined as a state diagram, not as boolean logic, because the state machine representation is provably correct while the boolean approach is provably fragile.
:::
