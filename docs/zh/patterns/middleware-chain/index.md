# 模式：中间件 / 管道链 (Middleware / Pipeline Chain)

## 一句话

组合处理器，每个包裹下一个——前处理、调用 next、后处理——形成双向管道。

## 核心思想

每个中间件接收一个上下文和一个 `next()` 函数。调用 `next()` 将控制传递给链中下一个中间件。`next()` 返回后，中间件可以运行后处理逻辑。不调用 `next()` 则短路整个链。这创建了一个"洋葱模型"——请求向内流入，响应向外流出。

```text
  请求 ──────────────────────────────────────► 响应

  ┌─────────────────────────────────────────────────┐
  │  中间件 A（日志）                                │
  │  ┌─────────────────────────────────────────┐    │
  │  │  中间件 B（鉴权）                        │    │
  │  │  ┌─────────────────────────────────┐    │    │
  │  │  │  中间件 C（处理器）              │    │    │
  │  │  │                                 │    │    │
  │  │  │  处理请求 → 响应                 │    │    │
  │  │  │                                 │    │    │
  │  │  └─────────────────────────────────┘    │    │
  │  │  后处理（添加鉴权头）                    │    │
  │  └─────────────────────────────────────────┘    │
  │  后处理（记录耗时）                              │
  └─────────────────────────────────────────────────┘

  执行顺序:
  A.pre → B.pre → C.pre → C.post → B.post → A.post
```

| 属性 | 值 |
|------|------|
| 组合 | 每请求执行 O(n) 个中间件 |
| 短路 | 任何中间件可通过不调用 `next()` 跳过后续 |
| 上下文共享 | 所有中间件共享同一个可变上下文对象 |
| 方向 | 双向——进入时前处理，返回时后处理 |

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| gRPC-Go | [server.go](https://github.com/grpc/grpc-go/blob/master/server.go) | `chainUnaryServerInterceptors` 将拦截器链接为单一处理器。每个拦截器接收请求和 `handler` 函数（相当于 `next`）。用于生产 gRPC 服务中的认证、日志、追踪和限流。拦截器可以在请求前和响应后检查/修改数据。 |
| Koa.js | [application.js#L152-L204](https://github.com/koajs/koa/blob/master/lib/application.js#L152-L204) | `use()`（L152-L157）将中间件推入数组。`callback()`（L168）通过 `koa-compose` 将它们组合为单一函数。`handleRequest`（L198-L205）执行组合后的链。Koa 开创了异步洋葱模型——每个 `await next()` 创建一个栈帧，使下游中间件可以使用干净的 try/catch/finally。 |

## 实现

::: code-group

```typescript [TypeScript]
type Middleware<T> = (ctx: T, next: () => void) => void;

class Pipeline<T> {
  private middlewares: Middleware<T>[] = [];

  /** Add a middleware to the end of the chain. */
  use(middleware: Middleware<T>): void {
    this.middlewares.push(middleware);
  }

  /** Execute the middleware chain with the given context. */
  execute(ctx: T): void {
    let index = 0;

    const next = (): void => {
      if (index < this.middlewares.length) {
        const mw = this.middlewares[index]!;
        index++;
        mw(ctx, next);
      }
    };

    next();
  }
}
```

```go [Go]
type Handler func(ctx map[string]any)

type Middleware func(ctx map[string]any, next Handler)

func Chain(middlewares ...Middleware) Handler {
	return func(ctx map[string]any) {
		var run func(i int)
		run = func(i int) {
			if i < len(middlewares) {
				middlewares[i](ctx, func(c map[string]any) {
					run(i + 1)
				})
			}
		}
		run(0)
	}
}
```

```python [Python]
from typing import Any, Callable

Ctx = dict[str, Any]
NextFn = Callable[[], None]
MiddlewareFn = Callable[[Ctx, NextFn], None]

class Pipeline:
    def __init__(self) -> None:
        self._middlewares: list[MiddlewareFn] = []

    def use(self, middleware: MiddlewareFn) -> None:
        self._middlewares.append(middleware)

    def execute(self, ctx: Ctx) -> None:
        index = 0

        def next_fn() -> None:
            nonlocal index
            if index < len(self._middlewares):
                mw = self._middlewares[index]
                index += 1
                mw(ctx, next_fn)

        next_fn()
```

```rust [Rust]
use std::collections::HashMap;

type Ctx = HashMap<String, String>;
type Next<'a> = Box<dyn FnOnce(&mut Ctx) + 'a>;
type MiddlewareFn = Box<dyn Fn(&mut Ctx, Next<'_>)>;

pub struct Pipeline {
    middlewares: Vec<MiddlewareFn>,
}

impl Pipeline {
    pub fn new() -> Self {
        Pipeline { middlewares: Vec::new() }
    }

    pub fn use_mw(&mut self, mw: impl Fn(&mut Ctx, Next<'_>) + 'static) {
        self.middlewares.push(Box::new(mw));
    }

    pub fn execute(&self, ctx: &mut Ctx) {
        self.run(ctx, 0);
    }

    fn run(&self, ctx: &mut Ctx, index: usize) {
        if index < self.middlewares.len() {
            let mw = &self.middlewares[index];
            let next: Next<'_> = Box::new(|c: &mut Ctx| {
                self.run(c, index + 1);
            });
            mw(ctx, next);
        }
    }
}
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 构建带 use/execute 和短路功能的同步中间件管道 | `exercises/typescript/middleware-chain/01-basic.test.ts` |
| 进阶 | 扩展异步中间件、错误捕获和洋葱模型清理 | `exercises/typescript/middleware-chain/02-intermediate.test.ts` |

## 何时使用

- **HTTP 请求处理** -- 认证、日志、CORS、压缩、限流作为可组合层（Express、Koa、Gin、ASP.NET）
- **RPC 拦截器** -- gRPC 拦截器用于追踪、认证、重试和指标，包裹每次调用而不修改业务逻辑
- **构建/编译管道** -- Webpack loader、Babel 转换、PostCSS 插件各自处理后传递给下一个
- **CLI 命令处理** -- 参数解析、验证、帮助生成作为实际命令处理器之前的中间件

## 何时不用

- **事件扇出（一对多）** -- 如果需要多个独立处理器响应同一事件，使用观察者模式。中间件是链（一条路径），不是广播。
- **无状态转换** -- 如果每步只是转换数据而不需要包裹下一步（无前/后处理），使用简单的 `array.map().filter().reduce()` 管道。中间件的力量在于双向包裹；没有它，你付出了复杂性却没有收益。
- **性能关键热路径** -- 每个中间件增加一次函数调用和闭包分配。在处理数百万项的紧密循环中，这些开销很重要。使用直接函数调用。

## 更多生产案例

- [Express.js](https://github.com/expressjs/express) -- `app.use()` 链接中间件用于 HTTP 请求处理
- [Redux](https://github.com/reduxjs/redux) -- `applyMiddleware` 包裹 `dispatch` 用于日志、thunks、sagas
- [ASP.NET Core](https://github.com/dotnet/aspnetcore) -- `IApplicationBuilder.Use()` 中间件管道
- [Gin](https://github.com/gin-gonic/gin) -- Go HTTP 框架，带 `Use()` 中间件和 `c.Next()`/`c.Abort()`

## 挑战题

::: details Q1: You have middleware A (logging), B (auth), C (handler). A user sends a request with an invalid token. B rejects it by NOT calling next(). What does A's post-processing see?
**Answer:** A's post-processing still runs. When B doesn't call `next()`, C never executes. But B's function returns normally to A (since A called `next()` which invoked B). A's code after its `next()` call executes as usual.

This is the onion model in action: A wraps B wraps C. Even if B short-circuits, A's wrapping is still intact. This is why logging middleware works correctly even for rejected requests -- it records the duration and status regardless of whether downstream middleware ran.
:::

::: details Q2: You swap the order of auth middleware and rate-limiter middleware. What security issue can this create?
**Answer:** If rate-limiting runs before auth, unauthenticated requests consume rate-limit quota. An attacker can exhaust the rate limit for legitimate users by sending a flood of invalid requests, causing a denial of service for authenticated users.

If auth runs first, invalid requests are rejected immediately (cheap) and never reach the rate limiter. The rate limiter then only counts authenticated requests, which is the correct behavior. **Middleware ordering is a security concern**, not just a correctness one.
:::

::: details Q3: Koa uses `async/await` middleware. Express uses callback-style `(req, res, next)`. What practical difference does this make for error handling?
**Answer:** In Koa, `await next()` means errors from downstream middleware automatically propagate via promise rejection. A single try/catch in outer middleware catches all downstream errors:

```javascript
app.use(async (ctx, next) => {
  try { await next(); }
  catch (err) { ctx.status = 500; }
});
```

In Express, errors must be explicitly passed via `next(err)`, and a special 4-argument error handler `(err, req, res, next)` must be registered. If a middleware throws synchronously or an async callback rejects without calling `next(err)`, the error is lost and the request hangs.

The async/await model makes the onion pattern natural -- try/catch/finally maps directly to setup/handle/cleanup.
:::

::: details Q4: Can you implement middleware ordering that runs some middleware only for specific routes (like Express's `app.get('/api', authMiddleware, handler)`)?
**Answer:** Yes -- add a predicate to each middleware that checks the context before executing. The pipeline wraps each middleware in a conditional:

```javascript
function routeMiddleware(path, mw) {
  return (ctx, next) => {
    if (ctx.path.startsWith(path)) { mw(ctx, next); }
    else { next(); } // skip this middleware
  };
}
```

Express implements this by maintaining separate middleware stacks per route. When a request arrives, it finds the matching route and only runs that route's middleware chain. This is essentially a tree of pipelines rather than a single flat chain.
:::
