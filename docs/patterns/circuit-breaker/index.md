---
title: "Pattern: Circuit Breaker"
description: "Stop calling a failing service by tracking errors and tripping open — fail fast instead of piling up timeouts."
difficulty: "intermediate"
---

# Pattern: Circuit Breaker

<DifficultyBadge />

## One Liner

Stop calling a failing service by tracking errors and tripping open — fail fast instead of piling up timeouts.

<DemoBadge />

## Real-World Analogy

An electrical fuse in your home. If too much current flows (repeated failures), the fuse blows and cuts the circuit immediately — protecting the wiring. After cooling down (timeout), you can reset it and try again.

## Core Idea

A circuit breaker wraps remote calls with a state machine that has three states. In the **closed** state, calls pass through normally. After a threshold of consecutive failures, the breaker **trips open** and all calls fail immediately without attempting the operation. After a cooldown period, the breaker enters the **half-open** state, allowing one probe call to test if the downstream service has recovered.

```mermaid
stateDiagram-v2
    [*] --> CLOSED
    CLOSED --> OPEN : failures >= threshold
    OPEN --> HALF_OPEN : timeout elapsed
    HALF_OPEN --> CLOSED : probe succeeds
    HALF_OPEN --> OPEN : probe fails
```

| State | Behavior |
|-------|----------|
| CLOSED | Calls pass through. Count consecutive failures. |
| OPEN | Calls fail immediately (`CircuitOpenError`). Timer running. |
| HALF_OPEN | Allow one probe call. Success → CLOSED. Failure → OPEN. |

| Property | Value |
|----------|-------|
| Call check | O(1) — compare state + failure counter |
| State transitions | O(1) — atomic state change |
| States | 3 — Closed, Open, Half-Open |
| Space | O(1) — counter + timer + state enum |

**Try it yourself** — send successes and failures to see the state machine transitions:

<CircuitBreakerViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| Netflix Hystrix | [HystrixCircuitBreaker.java#L138-L289](https://github.com/Netflix/Hystrix/blob/5ce3bc58c38e7ca60ef2fe0e516e390e294ad941/hystrix-core/src/main/java/com/netflix/hystrix/HystrixCircuitBreaker.java#L138-L289) | `HystrixCircuitBreakerImpl` — the canonical circuit breaker. Three-state enum (L142), `markSuccess`/`markNonSuccess` for HALF_OPEN transitions (L204-L224), `attemptExecution` for OPEN→HALF_OPEN via `compareAndSet` after sleep window (L264-L289). Used across Netflix's entire microservice fleet. |
| Sony gobreaker | [gobreaker.go#L117-L131](https://github.com/sony/gobreaker/blob/fed8e9eb35f9cd3e5c2a67842c924346c3e1fbdd/gobreaker.go#L117-L131) | `CircuitBreaker` struct with state, generation counter, counts, and mutex. `onSuccess`/`onFailure` (L310-L332) drive transitions; generation-based staleness detection (L334-L380) prevents acting on stale state reads. Production use at Sony. |
| Resilience4j | [CircuitBreakerStateMachine.java#L1062-L1107](https://github.com/resilience4j/resilience4j/blob/94982b82577d06e7e76ef5fe0e4a7329b8fb2ddd/resilience4j-circuitbreaker/src/main/java/io/github/resilience4j/circuitbreaker/internal/CircuitBreakerStateMachine.java#L1062-L1107) | `HalfOpenState` inner class — `AtomicInteger permittedNumberOfCalls` initialized from `permittedNumberOfCallsInHalfOpenState` (default 10). `tryAcquirePermission()` atomically decrements the counter via `getAndUpdate`, acting as an explicit permit gate during HALF_OPEN. OPEN→HALF_OPEN transition uses `isOpen.compareAndSet(true, false)` under `ReentrantLock` (L803-L808). Default for Spring Boot/Micronaut services. |

## Implementation

::: code-group

```typescript [TypeScript]
type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

class CircuitBreaker {
  private state: State = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    private threshold: number,
    private resetTimeout: number,
  ) {}

  getState(): State {
    if (this.state === 'OPEN' && Date.now() - this.lastFailureTime >= this.resetTimeout) {
      this.state = 'HALF_OPEN';
    }
    return this.state;
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.getState() === 'OPEN') throw new Error('Circuit is OPEN');
    try {
      const result = await fn();
      this.failureCount = 0;
      this.state = 'CLOSED';
      return result;
    } catch (err) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      if (this.failureCount >= this.threshold) this.state = 'OPEN';
      throw err;
    }
  }
}
```

```rust [Rust]
use std::time::Instant;

pub enum State { Closed, Open, HalfOpen }

pub struct CircuitBreaker {
    threshold: u32,
    reset_timeout_ms: u128,
    state: State,
    failure_count: u32,
    last_failure: Option<Instant>,
}

impl CircuitBreaker {
    pub fn new(threshold: u32, reset_timeout_ms: u128) -> Self {
        CircuitBreaker {
            threshold, reset_timeout_ms,
            state: State::Closed, failure_count: 0, last_failure: None,
        }
    }

    pub fn get_state(&mut self) -> &State {
        if let State::Open = self.state {
            if let Some(t) = self.last_failure {
                if t.elapsed().as_millis() >= self.reset_timeout_ms {
                    self.state = State::HalfOpen;
                }
            }
        }
        &self.state
    }

    pub fn call<T, E>(&mut self, f: impl FnOnce() -> Result<T, E>) -> Result<T, String>
    where E: std::fmt::Display {
        if matches!(self.get_state(), State::Open) {
            return Err("Circuit is OPEN".into());
        }
        match f() {
            Ok(v) => { self.failure_count = 0; self.state = State::Closed; Ok(v) }
            Err(e) => {
                self.failure_count += 1;
                self.last_failure = Some(Instant::now());
                if self.failure_count >= self.threshold { self.state = State::Open; }
                Err(e.to_string())
            }
        }
    }
}
```

```go [Go]
type State int

const (
	StateClosed   State = iota
	StateOpen
	StateHalfOpen
)

type CircuitBreaker struct {
	threshold    int
	resetTimeout int64
	state        State
	failureCount int
	lastFailure  int64
}

func NewCircuitBreaker(threshold int, resetTimeoutMs int64) *CircuitBreaker {
	return &CircuitBreaker{threshold: threshold, resetTimeout: resetTimeoutMs}
}

func now() int64 { return time.Now().UnixMilli() }

func (cb *CircuitBreaker) GetState() State {
	if cb.state == StateOpen && now()-cb.lastFailure >= cb.resetTimeout {
		cb.state = StateHalfOpen
	}
	return cb.state
}

func (cb *CircuitBreaker) Call(fn func() error) error {
	if cb.GetState() == StateOpen {
		return fmt.Errorf("circuit is OPEN")
	}
	if err := fn(); err != nil {
		cb.failureCount++
		cb.lastFailure = now()
		if cb.failureCount >= cb.threshold {
			cb.state = StateOpen
		}
		return err
	}
	cb.failureCount = 0
	cb.state = StateClosed
	return nil
}
```

```python [Python]
import time

class CircuitBreaker:
    def __init__(self, threshold: int = 5, reset_timeout: float = 30.0):
        self.threshold = threshold
        self.reset_timeout = reset_timeout
        self.state = "CLOSED"
        self.failure_count = 0
        self.last_failure_time = 0.0

    def get_state(self) -> str:
        if self.state == "OPEN" and time.time() - self.last_failure_time >= self.reset_timeout:
            self.state = "HALF_OPEN"
        return self.state

    def call(self, fn):
        if self.get_state() == "OPEN":
            raise RuntimeError("Circuit is OPEN")
        try:
            result = fn()
            self.failure_count = 0
            self.state = "CLOSED"
            return result
        except Exception:
            self.failure_count += 1
            self.last_failure_time = time.time()
            if self.failure_count >= self.threshold:
                self.state = "OPEN"
            raise
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a circuit breaker with three states | `exercises/typescript/circuit-breaker/01-basic.test.ts` |
| Intermediate | Circuit breaker with failure rate and rolling window | `exercises/typescript/circuit-breaker/02-intermediate.test.ts` |

Run exercises: `pnpm test:ts` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/circuit_breaker/mod.rs` · Go `exercises/go/circuit_breaker/circuit_breaker_test.go` · Python `exercises/python/circuit_breaker/test_circuit_breaker.py`

## When to Use

- **Microservice calls** — prevent cascading failures when a downstream service goes down
- **Database connections** — stop hammering a database that's overloaded
- **External APIs** — handle third-party service outages gracefully
- **Shared resources** — protect any shared resource that can become temporarily unavailable

## When NOT to Use

- **In-process calls** — circuit breakers add overhead; use error handling for local function calls
- **Idempotency not guaranteed** — if retries after half-open can cause duplicates, add deduplication first
- **Single-consumer systems** — if there's only one caller, backoff/retry is simpler than a full state machine
- **Fire-and-forget** — if you don't wait for a response, there's nothing to circuit-break

## More Production Uses

- [resilience4j](https://github.com/resilience4j/resilience4j) — Java circuit breaker for Spring/Micronaut
- [Polly](https://github.com/App-vNext/Polly) — .NET resilience library with circuit breaker policy
- [Envoy Proxy](https://github.com/envoyproxy/envoy) — outlier detection acts as a distributed circuit breaker
- [AWS SDK](https://github.com/aws/aws-sdk-js-v3) — retry with circuit-breaking for service endpoints

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Retry with Exponential Backoff](/patterns/retry-backoff/) | Circuit breaker prevents retries when the service is known to be down |
| [State Machine](/patterns/state-machine/) | Circuit breaker is a state machine: closed -> open -> half-open |
| [Rate Limiter (Token Bucket)](/patterns/rate-limiter/) | Both protect services — rate limiter controls throughput, circuit breaker stops failures |

## Challenge Questions

::: details Q1: Your circuit breaker has a 30-second reset timeout. The downstream service has an average recovery time of 5 seconds. A colleague suggests lowering the timeout to 5 seconds so requests resume faster. What's the tradeoff?
**Answer:** A shorter timeout means you'll probe the service sooner, but if it hasn't recovered, each failed probe resets the timer and generates additional load on an already-struggling service.

The reset timeout is a tradeoff between recovery speed and protection. If you probe too early and fail, you reopen the circuit and wait another full timeout. Meanwhile, the failed probe adds load to the unhealthy service. A good timeout should be longer than the typical recovery time — 2-3x is common — to give the downstream service breathing room. Some implementations use exponential backoff on the timeout itself.
:::

::: details Q2: Service A calls Service B, which calls Service C. Service C goes down. Without circuit breakers, what happens to Service A even though it doesn't directly depend on C?
**Answer:** Service A's threads pile up waiting for Service B, which is itself blocked waiting for Service C — this is a cascading failure.

Each call from A to B occupies a thread (or connection) while B waits for C's timeout. As B's threads exhaust, B starts timing out too, causing A's threads to pile up. Soon A appears down to its own callers. This is exactly why Netflix built Hystrix: a circuit breaker on each service boundary would let B fail fast on C calls and return errors to A immediately, keeping A's threads free. Without it, one downstream failure can topple an entire call chain.
:::

::: details Q3: Your circuit breaker enters HALF_OPEN and allows one probe request. But in a high-traffic system, 200 concurrent requests arrive in the same millisecond. All 200 see the state as HALF_OPEN and send probe requests simultaneously. How would you prevent this thundering herd?
**Answer:** Use an atomic compare-and-swap (CAS) to gate entry — then explicitly block subsequent arrivals during HALF_OPEN.

The CAS handles the instant of transition: exactly one thread wins `compareAndSet(OPEN, HALF_OPEN)` and becomes the probe. But protection doesn't stop there. Requests arriving *after* the transition find the state already HALF_OPEN — and the CAS fails because the expected value (OPEN) no longer matches. Those callers must also be rejected, and the implementation must ensure the CAS loser path returns `false` (fail fast) rather than proceeding regardless.

Netflix Hystrix demonstrates this in `attemptExecution()`: the `compareAndSet(Status.OPEN, Status.HALF_OPEN)` at [HystrixCircuitBreaker.java#L281](https://github.com/Netflix/Hystrix/blob/5ce3bc58c38e7ca60ef2fe0e516e390e294ad941/hystrix-core/src/main/java/com/netflix/hystrix/HystrixCircuitBreaker.java#L281) is inside an `if/else` — only the winner returns `true`, everyone else returns `false`. `allowRequest()` separately blocks during HALF_OPEN by returning `false` when the state is already HALF_OPEN ([L262-L263](https://github.com/Netflix/Hystrix/blob/5ce3bc58c38e7ca60ef2fe0e516e390e294ad941/hystrix-core/src/main/java/com/netflix/hystrix/HystrixCircuitBreaker.java#L262-L263)), and after a probe failure `markNonSuccess` uses CAS again to transition HALF_OPEN → OPEN ([L219-L224](https://github.com/Netflix/Hystrix/blob/5ce3bc58c38e7ca60ef2fe0e516e390e294ad941/hystrix-core/src/main/java/com/netflix/hystrix/HystrixCircuitBreaker.java#L219-L224)), which restarts the sleep window.

Mature libraries add a **second layer** — an explicit permit counter during HALF_OPEN. Sony's gobreaker gates with `counts.Requests >= maxRequests` ([gobreaker.go#L334-L340](https://github.com/sony/gobreaker/blob/fed8e9eb35f9cd3e5c2a67842c924346c3e1fbdd/gobreaker.go#L334-L340)) as an additional guard alongside its mutex and generation counter. Resilience4j's `CircuitBreakerStateMachine` tracks `permittedNumberOfCalls` via `AtomicInteger` in its `HalfOpenState` inner class — `tryAcquirePermission()` atomically decrements the counter and returns `false` when it hits zero ([CircuitBreakerStateMachine.java#L1064-L1107](https://github.com/resilience4j/resilience4j/blob/94982b82577d06e7e76ef5fe0e4a7329b8fb2ddd/resilience4j-circuitbreaker/src/main/java/io/github/resilience4j/circuitbreaker/internal/CircuitBreakerStateMachine.java#L1064-L1107)).

Getting this wrong has real consequences. Resilience4j v1.7.0 had a confirmed bug ([#1432](https://github.com/resilience4j/resilience4j/issues/1432)) where multiple threads bypassed the CAS gate because threads that lost the CAS still returned `true` — `permittedNumberOfCallsInHalfOpenState` was effectively ignored. Polly v5.0.4 had the same class of bug ([#216](https://github.com/App-vNext/Polly/issues/216)): multiple `Execute()` calls slipped through during half-open. Both were fixed by coupling the CAS result to the permission decision and adding explicit concurrency limiting.

The key insight is that HALF_OPEN requires **two** concurrency controls: (1) CAS for the OPEN → HALF_OPEN transition, and (2) an explicit gate (permit counter, mutex, or CAS-semantics check) that rejects all subsequent arrivals until the probe completes.
:::

::: details Q4: Your team uses a circuit breaker for database calls. A developer notices the breaker trips open during a routine database migration that causes 5 seconds of elevated latency but zero actual errors. Should the circuit breaker be tracking latency, not just errors?
**Answer:** Yes, but carefully. Latency-based tripping protects callers from slow responses, but you need distinct thresholds for "slow" vs "failed" to avoid false trips during normal variance.

A request that takes 10 seconds and eventually succeeds still ties up a thread for 10 seconds. In a thread-pool model, slow responses are functionally equivalent to failures because they exhaust capacity. Hystrix tracked both errors and timeouts as failures. The nuance is choosing the latency threshold: set it too low and normal P99 variance trips the breaker; set it too high and it provides no protection.
:::
