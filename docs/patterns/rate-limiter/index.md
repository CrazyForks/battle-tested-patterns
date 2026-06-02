# Pattern: Rate Limiter (Token Bucket)

## One Liner

Protect services from overload by draining tokens from a bucket that refills at a fixed rate — reject requests when empty.

## Core Idea

A token bucket starts full with `capacity` tokens and refills at `rate` tokens per second. Each request consumes one token. If the bucket is empty, the request is either rejected or delayed. This naturally allows bursts (up to capacity) while enforcing an average rate.

```text
  Token Bucket (capacity=5, rate=2/sec)

  Time 0s:   [●][●][●][●][●]  5 tokens (full)
  Request:   [●][●][●][●][ ]  4 tokens (consumed 1)
  Request:   [●][●][●][ ][ ]  3 tokens
  Request:   [●][●][ ][ ][ ]  2 tokens

  +1 sec:    [●][●][●][●][ ]  4 tokens (refilled 2)
  +2 sec:    [●][●][●][●][●]  5 tokens (capped at capacity)
```

| Variant | Behavior |
|---------|----------|
| **Token Bucket** | Tokens accumulate; allows bursts up to capacity |
| **Leaky Bucket** | Requests drain at constant rate; smooths bursts |
| **Sliding Window** | Counts requests in a time window; no burst control |
| **Fixed Window** | Counts requests per time interval; boundary burst problem |

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| Go x/time/rate | [rate.go#L57-L66](https://github.com/golang/time/blob/master/rate/rate.go#L57-L66) | `Limiter` struct — token bucket with `tokens`, `limit`, `burst`, and `last` timestamp. `reserveN` (L337-L381) is the core algorithm: advances tokens by elapsed time, subtracts requested `n`, computes wait duration. Used across Go ecosystem. |
| Nginx | [ngx_http_limit_req_module.c#L405-L532](https://github.com/nginx/nginx/blob/master/src/http/modules/ngx_http_limit_req_module.c#L405-L532) | `ngx_http_limit_req_lookup` — leaky bucket implementation. L454: `excess = lr->excess - ctx->rate * ms / 1000 + 1000` drains excess by elapsed time and adds one request. Powers `limit_req` directive protecting millions of Nginx servers. |

## Implementation

::: code-group

```typescript [TypeScript]
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillRate: number,
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  tryAcquire(tokens = 1): boolean {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }
}
```

```go [Go]
type TokenBucket struct {
	capacity   float64
	refillRate float64
	tokens     float64
	lastRefill time.Time
}

func NewTokenBucket(capacity, refillRate float64) *TokenBucket {
	return &TokenBucket{capacity: capacity, refillRate: refillRate, tokens: capacity, lastRefill: time.Now()}
}

func (tb *TokenBucket) TryAcquire() bool {
	now := time.Now()
	elapsed := now.Sub(tb.lastRefill).Seconds()
	tb.tokens = min(tb.capacity, tb.tokens+elapsed*tb.refillRate)
	tb.lastRefill = now
	if tb.tokens >= 1 {
		tb.tokens--
		return true
	}
	return false
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
```

```python [Python]
import time

class TokenBucket:
    def __init__(self, capacity: float, refill_rate: float):
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.tokens = capacity
        self.last_refill = time.time()

    def _refill(self):
        now = time.time()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now

    def try_acquire(self, tokens: float = 1) -> bool:
        self._refill()
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False
```

```rust [Rust]
use std::time::Instant;

pub struct TokenBucket {
    capacity: f64,
    refill_rate: f64,
    tokens: f64,
    last_refill: Instant,
}

impl TokenBucket {
    pub fn new(capacity: f64, refill_rate: f64) -> Self {
        TokenBucket { capacity, refill_rate, tokens: capacity, last_refill: Instant::now() }
    }

    fn refill(&mut self) {
        let elapsed = self.last_refill.elapsed().as_secs_f64();
        self.tokens = (self.tokens + elapsed * self.refill_rate).min(self.capacity);
        self.last_refill = Instant::now();
    }

    pub fn try_acquire(&mut self, n: f64) -> bool {
        self.refill();
        if self.tokens >= n {
            self.tokens -= n;
            true
        } else {
            false
        }
    }
}
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a token bucket rate limiter | `exercises/typescript/rate-limiter/01-basic.test.ts` |

Run exercises: `pnpm test`

## When to Use

- **API rate limiting** — protect endpoints from abuse (GitHub, Twitter, Stripe)
- **Network traffic shaping** — control bandwidth allocation (Linux tc, Nginx)
- **Resource protection** — limit database queries, file I/O, or CPU-intensive operations
- **Fair usage** — ensure multi-tenant systems give equitable access

## When NOT to Use

- **Binary access control** — if you just need allow/deny, use authentication, not rate limiting
- **Exact counting** — token bucket is approximate; use a counter for exact limits
- **Distributed without coordination** — per-node token buckets don't enforce a global rate (use Redis-backed limiter)
- **Latency-sensitive paths** — the refill calculation adds overhead on every request

## More Production Uses

- [Linux TBF](https://github.com/torvalds/linux/blob/master/net/sched/sch_tbf.c#L98-L114) — kernel token bucket filter for traffic control
- [Guava RateLimiter](https://github.com/google/guava/blob/master/guava/src/com/google/common/util/concurrent/SmoothRateLimiter.java#L357-L369) — smooth rate limiting with warm-up
- [Envoy](https://github.com/envoyproxy/envoy) — local/global rate limiting for service mesh
- [AWS API Gateway](https://github.com/aws/aws-sdk-js-v3) — token bucket throttling for API endpoints
