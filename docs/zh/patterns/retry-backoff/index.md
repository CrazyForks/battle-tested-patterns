---
description: "操作失败时以指数增长的延迟重试，加随机抖动避免惊群效应。"
---

# 模式：指数退避重试 (Retry with Backoff)

## 一句话

操作失败时以指数增长的延迟重试，加随机抖动避免惊群效应。

## 核心思想

不立即重试（会压垮故障服务），也不直接放弃，而是每次重试加倍等待时间。加抖动让成千上万客户端不同时重试。

```text
  Time ────────────────────────────────────────────────►

  Attempt 1  ✗ ├─┤ 1s
  Attempt 2  ✗ ├───┤ 2s
  Attempt 3  ✗ ├───────┤ 4s
  Attempt 4  ✗ ├───────────────┤ 8s
  Attempt 5  ✗ ├───────────────────────────────┤ 16s (cap)
  Attempt 6  ✓

  bar = retry wait (doubles each time)
  + jitter: randomize to avoid thundering herd
```

**动手试试** — 发送请求，观察指数退避与抖动的实际效果：

<RetryBackoffViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Kubernetes | [backoff.go#L30-L50](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/apimachinery/pkg/util/wait/backoff.go#L30-L50) | `Backoff` 结构定义退避参数。`ExponentialBackoff`（行475）实现重试。用于 pod 重启、API 服务器重试。 |
| gRPC-Go | [backoff.go#L56-L75](https://github.com/grpc/grpc-go/blob/master/internal/backoff/backoff.go#L56-L75) | `Exponential.Backoff()` — 计算带抖动的指数延迟。基础延迟每次重试翻倍，上限为 `MaxDelay`。`RunF`（L86-L109）是带上下文取消的重试编排循环。 |

## 实现

::: code-group

```typescript [TypeScript]
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 5, baseDelay = 1000, maxDelay = 30000,
): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i <= maxRetries; i++) {
    try { return await fn(); }
    catch (err) {
      lastError = err as Error;
      if (i === maxRetries) break;
      const delay = Math.min(baseDelay * Math.pow(2, i), maxDelay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
```

```python [Python]
import time, random

def retry_with_backoff(fn, max_retries=5, base=1.0, cap=30.0):
    for attempt in range(max_retries + 1):
        try: return fn()
        except Exception as e:
            if attempt == max_retries: raise
            delay = min(base * 2**attempt + random.random(), cap)
            time.sleep(delay)
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

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现可配置退避的重试 | `exercises/typescript/retry-backoff/01-basic.test.ts` |
| 进阶 | 集成熔断器的重试机制 | `exercises/typescript/retry-backoff/02-intermediate.test.ts` |

运行练习：`pnpm test`

## 何时使用

- **网络请求** — HTTP、数据库连接、RPC
- **分布式系统** — 可能暂时失败的服务间调用
- **限流 API** — 命中频率限制时退避（429 响应）

## 何时不用

- **非瞬时错误** — 400 Bad Request 重试也不会成功
- **非幂等操作** — 重试非幂等 POST 可能创建重复数据
- **用户等待场景** — 指数退避意味着 30+ 秒等待

## 更多生产案例

- [AWS SDK](https://github.com/aws/aws-sdk-js-v3)
- [Azure SDK](https://github.com/Azure/azure-sdk-for-js)
- [Google Cloud](https://github.com/googleapis/google-cloud-node)
- [Envoy](https://github.com/envoyproxy/envoy) — proxy
- [Celery](https://github.com/celery/celery) — Python task queue

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [熔断器 (Circuit Breaker)](/zh/patterns/circuit-breaker/) | 熔断器告诉你何时完全停止重试 |
| [批处理 (Batch Processing)](/zh/patterns/batch-processing/) | 失败的批处理项可以独立地进行退避重试 |
| [限流器 / 令牌桶 (Rate Limiter)](/zh/patterns/rate-limiter/) | 抖动退避防止重试风暴，目标与限流类似 |

## 挑战题

::: details Q1: 你从重试逻辑中移除了抖动（jitter）以使延迟"可预测"。在惊群场景下，会发生什么？
**答案：** 所有在同一时间失败的客户端会以完全相同的间隔重试，以同步的波次反复过载正在恢复的服务。

没有抖动，10,000 个在 t=0 收到 503 的客户端全部在 t=1s 重试，然后 t=2s，然后 t=4s——产生周期性的流量尖峰阻止恢复。抖动将重试分散到延迟窗口内，使恢复中的服务看到平滑的涓流而非同步的爆发。这就是为什么每个生产级重试库都包含抖动。
:::

::: details Q2: 你的服务重试一个非幂等的 POST /create-order 端点。第一次尝试超时但实际上已在服务器上成功。重试时会发生什么？
**答案：** 重试创建了一个重复订单。客户被收费两次。

超时不意味着请求失败——它意味着你不知道是否成功了。重试非幂等操作有重复的风险。修复方法是使用幂等键使操作幂等：客户端生成唯一 ID，服务器进行去重。没有幂等性保证，就不应该重试写操作。
:::

::: details Q3: 下游服务返回 HTTP 400 Bad Request。你应该用指数退避重试吗？
**答案：** 不应该。400 是客户端错误，表示输入有误。重试相同的请求每次都会产生相同的错误。

指数退避重试是为瞬态故障设计的——503 Service Unavailable、429 Too Many Requests、网络超时、连接重置。400 意味着"你的请求格式错误"，它不会随时间自行修复。重试它浪费资源并延迟真正的修复（纠正输入）。在决定重试之前，始终先对错误分类。
:::

::: details Q4: 你的重试配置使用 baseDelay=1s、maxDelay=30s、maxRetries=10。一个初级工程师问："为什么不设 maxRetries=1000 这样我们就永远不会丢失请求？"这有什么问题？
**答案：** 指数退避上限为 30s 加上 1000 次重试，客户端将花费 8 小时以上重试单个请求，整个过程一直占用资源。

高重试次数消耗连接池槽位、内存、goroutine/线程，并且通常持有数据库事务或锁。如果下游服务确实宕机了，这些重试不会有帮助——你需要熔断器来快速失败并卸载负载。实践中，3-5 次带退避的重试足以处理瞬态抖动；更长时间的情况应该由带死信语义的持久队列来处理。
:::
