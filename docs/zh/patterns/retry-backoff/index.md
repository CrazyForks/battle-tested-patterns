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

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现可配置退避的重试 | `exercises/typescript/retry-backoff/01-basic.test.ts` |

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

## 挑战题

::: details Q1: You remove jitter from your retry logic to make delays "predictable." Under a thundering herd scenario, what happens?
**Answer:** All clients that failed at the same time retry at exactly the same intervals, repeatedly overloading the recovering service in synchronized waves.

Without jitter, 10,000 clients that got a 503 at t=0 all retry at t=1s, then t=2s, then t=4s -- creating periodic traffic spikes that prevent recovery. Jitter spreads retries across the delay window so the recovering service sees a smooth trickle instead of synchronized bursts. This is why every production retry library includes jitter.
:::

::: details Q2: Your service retries a POST /create-order endpoint that is NOT idempotent. The first attempt times out but actually succeeded on the server. What happens on retry?
**Answer:** The retry creates a duplicate order. The customer gets charged twice.

A timeout does not mean the request failed -- it means you don't know if it succeeded. Retrying a non-idempotent operation risks duplication. The fix is to make the operation idempotent using an idempotency key: the client generates a unique ID and the server deduplicates. Without idempotency, you should not retry write operations.
:::

::: details Q3: A downstream service returns HTTP 400 Bad Request. Should you retry with exponential backoff?
**Answer:** No. A 400 is a client error indicating bad input. Retrying the same request will produce the same error every time.

Retry with backoff is designed for transient failures -- 503 Service Unavailable, 429 Too Many Requests, network timeouts, connection resets. A 400 means "your request is malformed," which won't fix itself with time. Retrying it wastes resources and delays the real fix (correcting the input). Always classify errors before deciding to retry.
:::

::: details Q4: Your retry config uses baseDelay=1s, maxDelay=30s, maxRetries=10. A junior engineer asks: "Why not set maxRetries=1000 so we never lose a request?" What's wrong with that?
**Answer:** With exponential backoff capped at 30s and 1000 retries, the client would spend up to 8+ hours retrying a single request, holding resources the entire time.

High retry counts consume connection pool slots, memory, goroutines/threads, and often hold database transactions or locks open. If the downstream service is truly down, those retries won't help -- you need a circuit breaker to fail fast and shed load. In practice, 3-5 retries with backoff is enough to handle transient blips; anything longer should be handled by a persistent queue with dead-letter semantics.
:::
