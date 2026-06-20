---
title: "模式：限流器 / 令牌桶 (Rate Limiter)"
description: "通过维护一个按固定速率补充的令牌桶来控制吞吐量——每次操作消耗一个令牌，桶空时拒绝请求。"
difficulty: "intermediate"
---

# 模式：限流器 / 令牌桶 (Rate Limiter)

<DifficultyBadge />

## 一句话

通过维护一个按固定速率补充的令牌桶来控制吞吐量——每次操作消耗一个令牌，桶空时拒绝请求。

<DemoBadge />

## 现实类比

地铁站的闸机。每次刷卡放一个人通过，节奏可控。人群涌来时排队。闸机不会加速——它强制执行稳定的速率。

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

| 属性 | 值 |
|------|---|
| allow() 检查 | O(1) — 计算已过令牌数并比较 |
| 突发容忍 | 最多 `capacity` 个请求可瞬时通过 |
| 持续速率 | 每秒 `refillRate` 个请求 |
| 空间 | O(1) — 每个限流器一个令牌计数 + 时间戳 |

**动手试试** — 发送请求观察令牌从桶中消耗，然后启动自动补充：

<RateLimiterViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Go x/time/rate | [rate.go#L57-L66](https://github.com/golang/time/blob/812b343c8714c317b0dad633efa6d103e554c006/rate/rate.go#L57-L66) | `Limiter` 结构体——含 `tokens`、`limit`、`burst` 和 `last` 时间戳的令牌桶。`reserveN`（L337-L381）是核心算法：按经过时间推进令牌，减去请求的 `n`，计算等待时长。整个 Go 生态广泛使用。 |
| Nginx | [ngx_http_limit_req_module.c#L405-L532](https://github.com/nginx/nginx/blob/d994f5b8220847eb8f7e4400be5f7e6eb4538e46/src/http/modules/ngx_http_limit_req_module.c#L405-L532) | `ngx_http_limit_req_lookup` — 漏桶实现。L454：`excess = lr->excess - ctx->rate * ms / 1000 + 1000` 按经过时间排空 excess 并添加一个请求。驱动保护数百万 Nginx 服务器的 `limit_req` 指令。 |

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

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现令牌桶限流器 | `exercises/typescript/rate-limiter/01-basic.test.ts` |
| 进阶 | 滑动窗口计数限流器 | `exercises/typescript/rate-limiter/02-intermediate.test.ts` |

运行练习：`pnpm test:ts`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

练习文件： Rust `exercises/rust/src/rate_limiter/mod.rs` · Go `exercises/go/rate_limiter/rate_limiter_test.go` · Python `exercises/python/rate_limiter/test_rate_limiter.py`

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

- [Linux TBF](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/net/sched/sch_tbf.c#L98-L114) — 内核令牌桶过滤器用于流量控制
- [Guava RateLimiter](https://github.com/google/guava/blob/3e65944ec9207ca652128969fd1334e9920dde07/guava/src/com/google/common/util/concurrent/SmoothRateLimiter.java#L357-L369) — 带预热的平滑限流
- [Envoy](https://github.com/envoyproxy/envoy) — 服务网格的本地/全局限流
- [AWS API Gateway](https://github.com/aws/aws-sdk-js-v3) — API 端点的令牌桶节流

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [信号量 / 有界并发 (Semaphore)](/zh/patterns/semaphore/) | 信号量限制并发；限流器限制时间维度的吞吐量 |
| [背压 / 流控 (Backpressure)](/zh/patterns/backpressure/) | 限流是在系统边界应用的一种背压形式 |
| [熔断器 (Circuit Breaker)](/zh/patterns/circuit-breaker/) | 熔断器在故障时停止所有流量；限流器控制正常流量 |
| [一致性哈希 (Consistent Hashing)](/zh/patterns/consistent-hashing/) | 一致性哈希将速率限制状态分布到多个节点 |
| [指数退避重试 (Retry with Backoff)](/zh/patterns/retry-backoff/) | 指数退避重试根据速率限制器的反馈调整客户端行为 |

## 挑战题

::: details Q1: 你的 API 使用固定窗口计数器允许每分钟 100 个请求。在 11:00:59 客户端发送了 100 个请求，在 11:01:01 又发送了 100 个请求。两个窗口都允许。这 2 秒内的实际速率是多少？令牌桶会如何不同地处理这个问题？
**答案：** 客户端在 2 秒内发送了 200 个请求（有效速率 6,000/分钟），远超 100/分钟的限制。令牌桶会拒绝第二次突发的大部分请求，因为只补充了约 3 个令牌。

这是固定窗口计数器的"边界突发"问题。窗口在尖锐边界处重置，允许在接缝处出现双倍突发。容量为 100、速率为 100/分钟的令牌桶以约 1.67 令牌/秒的速度补充。在 11:00:59 耗尽到 0 后，11:01:01 时只有约 3 个令牌可用——其余 97 个请求会被拒绝。滑动窗口计数器也通过在相邻窗口之间插值来解决这个问题。
:::

::: details Q2: 你运行了 8 个 API 服务器实例，每个都有自己的令牌桶，允许 100 请求/秒。一个客户端发现了这一点并将请求分布到所有 8 个服务器。它们体验到的有效速率限制是多少？
**答案：** 客户端可以达到 800 请求/秒——预期限制的 8 倍——因为每节点的令牌桶不强制全局速率。

分布式限流需要共享状态。常见解决方案：(1) 使用 Redis 等集中存储配合原子 `INCR` 和 `EXPIRE`，(2) 专用限流服务（Envoy、Kong），或 (3) "分割预算"方式，每个节点获得总速率的 1/n（100/8 = 12.5 请求/秒/节点）。选项 3 简单但脆弱——如果流量分布不均匀，一些节点会浪费预算而其他节点拒绝有效请求。
:::

::: details Q3: 你的令牌桶容量为 50，补充速率为 10/秒。一个合法的批处理任务需要一次性发送 50 个请求，然后等待 10 秒，再发送 50 个。令牌桶能适应这种模式吗？还是应该使用不同的算法？
**答案：** 令牌桶完美处理这种情况——它设计用来允许不超过容量的突发同时强制平均速率。

开始时，桶满有 50 个令牌，允许整个批次。接下来 10 秒补充 100 个令牌但上限为 50（容量）。第二批 50 个再次耗尽桶。平均速率是 100 请求 / 10 秒 = 10/秒，恰好匹配补充速率。这种对突发友好的行为是令牌桶在突发但有界的工作负载中优于漏桶的原因。漏桶会强制 50 个请求以 10/秒的速率流出，需要 5 秒——不适合批处理模式。
:::

::: details Q4: Nginx 对 `limit_req` 使用漏桶。Go 的 `x/time/rate` 使用令牌桶。两者都限制请求速率。你何时会选择漏桶而非令牌桶？
**答案：** 当你需要将流量平滑为稳定的流时选择漏桶，防止任何突发到达下游服务。

令牌桶允许不超过容量的突发——非常适合偶尔有突发流量的面向用户的 API。漏桶强制恒定的流出速率，保护无法处理任何流量尖峰的后端（例如在并发写入下性能降低的数据库）。Nginx 使用漏桶因为反向代理位于需要可预测、稳态负载的后端前面。权衡：漏桶在突发时增加延迟（请求排队），而令牌桶立即拒绝多余请求。
:::
