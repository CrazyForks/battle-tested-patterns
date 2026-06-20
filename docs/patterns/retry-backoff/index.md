---
title: "Pattern: Retry with Exponential Backoff"
description: "When an operation fails, retry it with progressively longer delays plus random jitter to avoid thundering herd."
difficulty: "beginner"
---

# Pattern: Retry with Exponential Backoff

<DifficultyBadge />

## One Liner

When an operation fails, retry it with progressively longer delays plus random jitter to avoid thundering herd.

<DemoBadge />

## Real-World Analogy

Calling a busy restaurant for a reservation. You try once, get a busy signal, wait a minute, try again. Still busy? Wait two minutes. Then four. You also vary the timing slightly so that everyone who got a busy signal isn't calling back at the exact same moment.

## Core Idea

Instead of retrying immediately (which overloads the failing service) or giving up (which loses the request), exponential backoff doubles the wait time on each retry. Adding jitter randomizes the delay so thousands of clients don't retry simultaneously.

```text
  Time ────────────────────────────────────────────────►

  Attempt 1  ✗ ├─┤ 1s
  Attempt 2  ✗ ├───┤ 2s
  Attempt 3  ✗ ├───────┤ 4s
  Attempt 4  ✗ ├───────────────┤ 8s
  Attempt 5  ✗ ├───────────────────────────────┤ 16s (cap)
  Attempt 6  ✓

  Each bar = wait before next retry (doubles each time)
  + jitter: randomize within each bar to avoid thundering herd
```

The formula: `delay = min(base * 2^attempt + random(0, jitter), maxDelay)`

| Property | Value |
|----------|-------|
| Delay growth | Exponential — doubles each attempt |
| Max delay | Capped (typically 30–60 s) to bound worst-case wait |
| Jitter | Randomized to prevent thundering herd |
| Total attempts | Bounded (typically 3–10) to avoid infinite loops |

**Try it yourself** — send a request and watch exponential backoff with jitter in action:

<RetryBackoffViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| Kubernetes | [backoff.go#L30-L50](https://github.com/kubernetes/kubernetes/blob/586cc904093af4fe7492e564908a796f0b107f97/staging/src/k8s.io/apimachinery/pkg/util/wait/backoff.go#L30-L50) | `Backoff` struct defines `Duration`, `Factor`, `Jitter`, `Steps`, `Cap`. `ExponentialBackoff` (line 475) retries with this config. Used for pod restart backoff, API server retries, controller reconciliation. |
| gRPC-Go | [backoff.go#L56-L75](https://github.com/grpc/grpc-go/blob/f1864955bbb48efa131f6652933fa8b2189d9305/internal/backoff/backoff.go#L56-L75) | `Exponential.Backoff()` — computes exponential delay with jitter. Base delay doubles per retry, capped at `MaxDelay`. `RunF` (L86-L109) is the retry orchestration loop with context cancellation and `ErrResetBackoff` support. |

## Implementation

::: code-group

```typescript [TypeScript]
interface BackoffConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitter: number; // 0-1
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: BackoffConfig = { maxRetries: 5, baseDelay: 1000, maxDelay: 30000, jitter: 0.5 },
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt === config.maxRetries) break;

      const exponential = config.baseDelay * Math.pow(2, attempt);
      const jitter = exponential * config.jitter * Math.random();
      const delay = Math.min(exponential + jitter, config.maxDelay);

      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}
```

```rust [Rust]
use std::time::Duration;

pub struct Backoff {
    pub max_retries: u32,
    pub base_delay: Duration,
    pub max_delay: Duration,
}

impl Backoff {
    pub fn delay_for(&self, attempt: u32) -> Duration {
        let exponential = self.base_delay.as_millis() as u64 * 2u64.pow(attempt);
        let capped = exponential.min(self.max_delay.as_millis() as u64);
        Duration::from_millis(capped)
    }
}
```

```go [Go]
package backoff

import (
	"math"
	"math/rand"
	"time"
)

type Config struct {
	MaxRetries int
	BaseDelay  time.Duration
	MaxDelay   time.Duration
	Jitter     float64
}

func Retry(fn func() error, cfg Config) error {
	var lastErr error
	for attempt := 0; attempt <= cfg.MaxRetries; attempt++ {
		lastErr = fn()
		if lastErr == nil {
			return nil
		}
		if attempt == cfg.MaxRetries {
			break
		}
		exp := float64(cfg.BaseDelay) * math.Pow(2, float64(attempt))
		jitter := exp * cfg.Jitter * rand.Float64()
		delay := time.Duration(math.Min(exp+jitter, float64(cfg.MaxDelay)))
		time.Sleep(delay)
	}
	return lastErr
}
```

```python [Python]
import time
import random

def retry_with_backoff(fn, max_retries=5, base_delay=1.0, max_delay=30.0, jitter=0.5):
    last_error = None
    for attempt in range(max_retries + 1):
        try:
            return fn()
        except Exception as e:
            last_error = e
            if attempt == max_retries:
                break
            exponential = base_delay * (2 ** attempt)
            delay = min(exponential + exponential * jitter * random.random(), max_delay)
            time.sleep(delay)
    raise last_error
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement retry with configurable backoff | `exercises/typescript/retry-backoff/01-basic.test.ts` |
| Intermediate | Retry with circuit breaker integration | `exercises/typescript/retry-backoff/02-intermediate.test.ts` |

Run exercises: `pnpm test:ts` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/retry_backoff/mod.rs` · Go `exercises/go/retry_backoff/retry_backoff_test.go` · Python `exercises/python/retry_backoff/test_retry_backoff.py`

## When to Use

- **Network requests** — HTTP calls, database connections, RPC
- **Distributed systems** — service-to-service calls that may transiently fail
- **Rate-limited APIs** — back off when hitting rate limits (often 429 responses)
- **Queue consumers** — retry failed message processing

## When NOT to Use

- **Non-transient errors** — 400 Bad Request won't succeed on retry; validate input instead
- **Idempotency not guaranteed** — retrying a non-idempotent POST could create duplicates
- **User-facing latency** — exponential backoff means 30+ second waits; show an error instead
- **Local operations** — file not found, parse error — these won't fix themselves on retry

## More Production Uses

- [AWS SDK](https://github.com/aws/aws-sdk-js-v3)
- [Azure SDK](https://github.com/Azure/azure-sdk-for-js)
- [Google Cloud](https://github.com/googleapis/google-cloud-node)
- [Envoy](https://github.com/envoyproxy/envoy) — proxy
- [Celery](https://github.com/celery/celery) — Python task queue

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Circuit Breaker](/patterns/circuit-breaker/) | Circuit breaker tells you when to stop retrying entirely |
| [Batch Processing](/patterns/batch-processing/) | Failed batch items can be retried with backoff independently |
| [Rate Limiter (Token Bucket)](/patterns/rate-limiter/) | Jittered backoff prevents retry storms, similar to rate limiting's goal |

## Challenge Questions

::: details Q1: You remove jitter from your retry logic to make delays "predictable." Under a thundering herd scenario, what happens?
**Answer:** All clients that failed at the same time retry at exactly the same intervals, repeatedly overloading the recovering service in synchronized waves.

Without jitter, 10,000 clients that got a 503 at t=0 all retry at t=1s, then t=2s, then t=4s — creating periodic traffic spikes that prevent recovery. Jitter spreads retries across the delay window so the recovering service sees a smooth trickle instead of synchronized bursts. This is why every production retry library includes jitter.
:::

::: details Q2: Your service retries a POST /create-order endpoint that is NOT idempotent. The first attempt times out but actually succeeded on the server. What happens on retry?
**Answer:** The retry creates a duplicate order. The customer gets charged twice.

A timeout does not mean the request failed — it means you don't know if it succeeded. Retrying a non-idempotent operation risks duplication. The fix is to make the operation idempotent using an idempotency key: the client generates a unique ID and the server deduplicates. Without idempotency, you should not retry write operations.
:::

::: details Q3: A downstream service returns HTTP 400 Bad Request. Should you retry with exponential backoff?
**Answer:** No. A 400 is a client error indicating bad input. Retrying the same request will produce the same error every time.

Retry with backoff is designed for transient failures — 503 Service Unavailable, 429 Too Many Requests, network timeouts, connection resets. A 400 means "your request is malformed," which won't fix itself with time. Retrying it wastes resources and delays the real fix (correcting the input). Always classify errors before deciding to retry.
:::

::: details Q4: Your retry config uses baseDelay=1s, maxDelay=30s, maxRetries=10. A junior engineer asks: "Why not set maxRetries=1000 so we never lose a request?" What's wrong with that?
**Answer:** With exponential backoff capped at 30s and 1000 retries, the client would spend up to 8+ hours retrying a single request, holding resources the entire time.

High retry counts consume connection pool slots, memory, goroutines/threads, and often hold database transactions or locks open. If the downstream service is truly down, those retries won't help — you need a circuit breaker to fail fast and shed load. In practice, 3-5 retries with backoff is enough to handle transient blips; anything longer should be handled by a persistent queue with dead-letter semantics.
:::
