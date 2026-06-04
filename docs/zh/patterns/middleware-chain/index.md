---
description: "组合处理器，每个包裹下一个——前处理、调用 next、后处理——形成双向管道。"
difficulty: "intermediate"
---

# 模式：中间件 / 管道链 (Middleware / Pipeline Chain)

<DifficultyBadge />

## 一句话

组合处理器，每个包裹下一个——前处理、调用 next、后处理——形成双向管道。

<DemoBadge />

## 现实类比

机场安检通道。你的包先过 X 光机（日志记录），然后过金属探测器（身份认证），再查验证件（参数校验）。每个关卡只做一件事，然后送你到下一个。任何一个关卡都可以拒绝你。

## 核心思想

每个中间件接收一个上下文和一个 `next()` 函数。调用 `next()` 将控制传递给链中下一个中间件。`next()` 返回后，中间件可以运行后处理逻辑。不调用 `next()` 则短路整个链。这创建了一个"洋葱模型"——请求向内流入，响应向外流出。

```text
  Request ──────────────────────────────────────► Response

  ┌─────────────────────────────────────────────────┐
  │  Middleware A (logging)                         │
  │  ┌─────────────────────────────────────────┐    │
  │  │  Middleware B (auth)                    │    │
  │  │  ┌─────────────────────────────────┐    │    │
  │  │  │  Middleware C (handler)         │    │    │
  │  │  │                                 │    │    │
  │  │  │  process request → response     │    │    │
  │  │  │                                 │    │    │
  │  │  └─────────────────────────────────┘    │    │
  │  │  post-process (add auth headers)        │    │
  │  └─────────────────────────────────────────┘    │
  │  post-process (log duration)                    │
  └─────────────────────────────────────────────────┘

  Execution order:
  A.pre → B.pre → C.pre → C.post → B.post → A.post
```

| 属性 | 值 |
|------|------|
| 组合 | 每请求执行 O(n) 个中间件 |
| 短路 | 任何中间件可通过不调用 `next()` 跳过后续 |
| 上下文共享 | 所有中间件共享同一个可变上下文对象 |
| 方向 | 双向——进入时前处理，返回时后处理 |

**动手试试** — 发送请求通过中间件链，观察请求和响应的正向与反向流转：

<MiddlewareChainViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| gRPC-Go | [server.go#L1224-L1260](https://github.com/grpc/grpc-go/blob/master/server.go#L1224-L1260) | `chainUnaryServerInterceptors`（L1224）将拦截器链接为单一处理器。`getChainUnaryHandler`（L1252）递归构建链——每个拦截器接收请求和 `handler` 函数（相当于 `next`）。用于生产 gRPC 服务中的认证、日志、追踪和限流。 |
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

运行练习：`pnpm test`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

Exercise files: Rust `exercises/rust/src/middleware_chain.rs` · Go `exercises/go/middleware_chain_test.go` · Python `exercises/python/test_middleware_chain.py`

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

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [迭代器 / 惰性求值 (Iterator)](/zh/patterns/iterator/) | 中间件链像迭代器遍历序列一样遍历处理器 |
| [观察者 / 发布-订阅 (Observer / Pub-Sub)](/zh/patterns/observer/) | 中间件可以观察和修改流经管道的请求/响应 |
| [虚函数表 / 操作分发 (Vtable / Ops Dispatch)](/zh/patterns/vtable/) | 每个中间件是实现通用接口的函数指针，类似虚函数表条目 |
| [注册表 (Registry)](/zh/patterns/registry/) | 注册表可以存储和管理链中的中间件组件 |

## 挑战题

::: details Q1: 你有中间件 A（日志）、B（认证）、C（处理器）。用户发送了一个带无效 token 的请求。B 通过不调用 next() 来拒绝它。A 的后处理会看到什么？
**答案：** A 的后处理仍然会运行。当 B 不调用 `next()` 时，C 永远不会执行。但 B 的函数正常返回给 A（因为 A 调用了 `next()` 来调用 B）。A 在 `next()` 调用之后的代码照常执行。

这就是洋葱模型的运作方式：A 包裹 B，B 包裹 C。即使 B 短路了，A 的包裹仍然完好。这就是为什么日志中间件即使对被拒绝的请求也能正确工作——它记录持续时间和状态，无论下游中间件是否运行。
:::

::: details Q2: 你交换了认证中间件和限流中间件的顺序。这会产生什么安全问题？
**答案：** 如果限流在认证之前运行，未认证的请求会消耗限流配额。攻击者可以通过发送大量无效请求来耗尽合法用户的限流配额，对已认证用户造成拒绝服务。

如果认证先运行，无效请求会被立即拒绝（开销低）且永远不会到达限流器。限流器则只计算已认证的请求，这才是正确的行为。**中间件顺序是安全问题**，而不仅仅是正确性问题。
:::

::: details Q3: Koa 使用 `async/await` 中间件。Express 使用回调风格的 `(req, res, next)`。这对错误处理有什么实际区别？
**答案：** 在 Koa 中，`await next()` 意味着下游中间件的错误会通过 Promise rejection 自动传播。外层中间件中的单个 try/catch 即可捕获所有下游错误：

```javascript
app.use(async (ctx, next) => {
  try { await next(); }
  catch (err) { ctx.status = 500; }
});
```

在 Express 中，错误必须通过 `next(err)` 显式传递，且必须注册一个特殊的 4 参数错误处理器 `(err, req, res, next)`。如果中间件同步抛出异常或异步回调 reject 但没有调用 `next(err)`，错误就会丢失且请求挂起。

async/await 模型使洋葱模式自然契合——try/catch/finally 直接映射到设置/处理/清理。
:::

::: details Q4: 你能实现只对特定路由运行某些中间件的中间件排序吗（像 Express 的 `app.get('/api', authMiddleware, handler)`）？
**答案：** 可以——为每个中间件添加一个在执行前检查上下文的谓词。管道将每个中间件包裹在条件判断中：

```javascript
function routeMiddleware(path, mw) {
  return (ctx, next) => {
    if (ctx.path.startsWith(path)) { mw(ctx, next); }
    else { next(); } // skip this middleware
  };
}
```

Express 通过为每个路由维护单独的中间件栈来实现这一点。当请求到达时，它找到匹配的路由并只运行该路由的中间件链。这本质上是管道的树形结构而非单一的扁平链。
:::
