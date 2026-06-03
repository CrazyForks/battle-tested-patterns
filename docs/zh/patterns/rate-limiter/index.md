# 模式：限流器 / 令牌桶 (Rate Limiter)

## 一句话

通过维护一个按固定速率补充的令牌桶来控制吞吐量——每次操作消耗一个令牌，桶空时拒绝请求。

## 核心思想

令牌桶初始满载 `capacity` 个令牌，以 `rate` 个/秒的速度补充。每个请求消耗一个令牌。桶空时请求被拒绝或延迟。这天然允许突发（最多到容量）同时限制平均速率。

```text
  令牌桶 (capacity=5, rate=2/sec)

  时间 0s:   [●][●][●][●][●]  5 令牌 (满)
  请求:      [●][●][●][●][ ]  4 令牌 (消耗 1)
  请求:      [●][●][●][ ][ ]  3 令牌
  请求:      [●][●][ ][ ][ ]  2 令牌

  +1 秒:     [●][●][●][●][ ]  4 令牌 (补充 2)
  +2 秒:     [●][●][●][●][●]  5 令牌 (封顶)
```

| 变体 | 行为 |
|------|------|
| **令牌桶** | 令牌累积；允许突发到容量上限 |
| **漏桶** | 请求以恒定速率流出；平滑突发 |
| **滑动窗口** | 统计时间窗口内请求数；无突发控制 |
| **固定窗口** | 按时间间隔统计请求数；边界突发问题 |

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Go x/time/rate | [rate.go#L57-L66](https://github.com/golang/time/blob/master/rate/rate.go#L57-L66) | `Limiter` 结构体——含 `tokens`、`limit`、`burst` 和 `last` 时间戳的令牌桶。`reserveN`（L337-L381）是核心算法：按经过时间推进令牌，减去请求的 `n`，计算等待时长。整个 Go 生态广泛使用。 |
| Nginx | [ngx_http_limit_req_module.c#L405-L532](https://github.com/nginx/nginx/blob/master/src/http/modules/ngx_http_limit_req_module.c#L405-L532) | `ngx_http_limit_req_lookup` — 漏桶实现。L454：`excess = lr->excess - ctx->rate * ms / 1000 + 1000` 按经过时间排空 excess 并添加一个请求。驱动保护数百万 Nginx 服务器的 `limit_req` 指令。 |

## 实现

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

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现令牌桶限流器 | `exercises/typescript/rate-limiter/01-basic.test.ts` |

## 何时使用

- **API 限流** — 保护端点免受滥用（GitHub、Twitter、Stripe）
- **网络流量整形** — 控制带宽分配（Linux tc、Nginx）
- **资源保护** — 限制数据库查询、文件 I/O 或 CPU 密集操作
- **公平使用** — 确保多租户系统提供公平的访问

## 何时不用

- **二元访问控制** — 如果只需要允许/拒绝，用认证而非限流
- **精确计数** — 令牌桶是近似的；精确限制用计数器
- **无协调的分布式** — 每节点令牌桶不能执行全局速率（用 Redis 支持的限流器）
- **延迟敏感路径** — 每次请求的补充计算增加开销

## 更多生产案例

- [Linux TBF](https://github.com/torvalds/linux/blob/master/net/sched/sch_tbf.c#L98-L114) — 内核令牌桶过滤器用于流量控制
- [Guava RateLimiter](https://github.com/google/guava/blob/master/guava/src/com/google/common/util/concurrent/SmoothRateLimiter.java#L357-L369) — 带预热的平滑限流
- [Envoy](https://github.com/envoyproxy/envoy) — 服务网格的本地/全局限流
- [AWS API Gateway](https://github.com/aws/aws-sdk-js-v3) — API 端点的令牌桶节流

## 挑战题

::: details Q1: Your API allows 100 requests per minute using a fixed-window counter. At 11:00:59 a client sends 100 requests, and at 11:01:01 sends another 100 requests. Both windows allow it. What is the actual rate over that 2-second span, and how would a token bucket handle this differently?
**Answer:** The client sent 200 requests in 2 seconds (6,000/min effective rate), far exceeding the 100/min limit. A token bucket would reject most of the second burst because it would only have ~3 tokens refilled.

This is the "boundary burst" problem with fixed-window counters. The window resets at sharp boundaries, allowing a double-burst at the seam. A token bucket with capacity=100 and rate=100/min refills at ~1.67 tokens/second. After draining to 0 at 11:00:59, only ~3 tokens would be available at 11:01:01 — the remaining 97 requests would be rejected. Sliding window counters also solve this by interpolating between adjacent windows.
:::

::: details Q2: You run 8 API server instances, each with its own token bucket allowing 100 requests/second. A client discovers this and distributes requests across all 8 servers. What is the effective rate limit they experience?
**Answer:** The client can achieve 800 requests/second — 8x the intended limit — because per-node token buckets don't enforce a global rate.

Distributed rate limiting requires shared state. Common solutions: (1) a centralized store like Redis with atomic `INCR` and `EXPIRE`, (2) a dedicated rate-limiting service (Envoy, Kong), or (3) a "split budget" approach where each node gets 1/n of the total rate (100/8 = 12.5 req/s per node). Option 3 is simple but fragile — if traffic isn't evenly distributed, some nodes waste their budget while others reject valid requests.
:::

::: details Q3: Your token bucket has capacity=50 and refill rate=10/second. A legitimate batch job needs to send 50 requests at once, then wait 10 seconds, then send 50 more. Will the token bucket accommodate this pattern or should you use a different algorithm?
**Answer:** The token bucket handles this perfectly — it's designed to allow bursts up to capacity while enforcing an average rate.

At the start, the bucket is full with 50 tokens, allowing the entire batch. Over the next 10 seconds, 100 tokens are refilled but capped at 50 (the capacity). The second batch of 50 drains the bucket again. The average rate is 100 requests / 10 seconds = 10/sec, exactly matching the refill rate. This burst-friendly behavior is why token bucket is preferred over leaky bucket for bursty-but-bounded workloads. A leaky bucket would force the 50 requests to drain at 10/sec, taking 5 seconds — unsuitable for batch patterns.
:::

::: details Q4: Nginx uses a leaky bucket for `limit_req`. Go's `x/time/rate` uses a token bucket. Both limit request rates. When would you choose leaky bucket over token bucket?
**Answer:** Choose a leaky bucket when you need to smooth traffic into a steady stream, preventing any bursts from reaching the downstream service.

A token bucket allows bursts up to capacity — great for user-facing APIs where occasional burst traffic is normal. A leaky bucket forces a constant drain rate, which protects backends that can't handle any traffic spikes (e.g., a database that degrades under concurrent writes). Nginx uses leaky bucket because reverse proxies sit in front of backends that need predictable, steady-state load. The tradeoff: leaky bucket adds latency during bursts (requests queue), while token bucket rejects excess requests instantly.
:::
