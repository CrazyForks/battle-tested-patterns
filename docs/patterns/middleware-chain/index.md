---
description: "Compose handlers where each wraps the next — pre-process, call next, post-process — forming a bidirectional pipeline."
difficulty: "intermediate"
---

# Pattern: Middleware / Pipeline Chain

<DifficultyBadge />

## One Liner

Compose handlers where each wraps the next — pre-process, call next, post-process — forming a bidirectional pipeline.

<DemoBadge />

## Real-World Analogy

An airport security checkpoint. Your bag goes through X-ray (logging), then a metal detector (auth), then document check (validation). Each station does one thing and passes you to the next. Any station can reject you.

## Core Idea

Each middleware receives a context and a `next()` function. Calling `next()` passes control to the next middleware in the chain. After `next()` returns, the middleware can run post-processing logic. Not calling `next()` short-circuits the chain. This creates an "onion model" where the request flows inward and the response flows outward.

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

| Property | Value |
|----------|-------|
| Composition | O(n) middleware executed per request |
| Short-circuit | Any middleware can skip the rest by not calling `next()` |
| Context sharing | All middleware share the same mutable context object |
| Direction | Bidirectional — pre-process on the way in, post-process on the way out |

**Try it yourself** — send a request through the middleware chain and watch it flow forward then backward:

<MiddlewareChainViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| gRPC-Go | [server.go#L1224-L1260](https://github.com/grpc/grpc-go/blob/master/server.go#L1224-L1260) | `chainUnaryServerInterceptors` (L1224) chains interceptors into a single handler. `getChainUnaryHandler` (L1252) recursively builds the chain — each interceptor receives the request and a `handler` function (equivalent to `next`). Used for authentication, logging, tracing, and rate limiting in production gRPC services. |
| Koa.js | [application.js#L152-L204](https://github.com/koajs/koa/blob/master/lib/application.js#L152-L204) | `use()` (L152-L157) pushes middleware into an array. `callback()` (L168) composes them via `koa-compose` into a single function. `handleRequest` (L198-L205) executes the composed chain. Koa pioneered the async onion model — each `await next()` creates a stack frame, enabling clean try/catch/finally around downstream middleware. |

## Implementation

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

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Build a synchronous middleware pipeline with use/execute and short-circuit | `exercises/typescript/middleware-chain/01-basic.test.ts` |
| Intermediate | Extend with async middleware, error capture, and onion-model cleanup | `exercises/typescript/middleware-chain/02-intermediate.test.ts` |

Run exercises: `pnpm test` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/middleware_chain.rs` · Go `exercises/go/middleware_chain_test.go` · Python `exercises/python/test_middleware_chain.py`

## When to Use

- **HTTP request processing** — authentication, logging, CORS, compression, rate limiting as composable layers (Express, Koa, Gin, ASP.NET)
- **RPC interceptors** — gRPC interceptors for tracing, auth, retry, and metrics that wrap every call without modifying business logic
- **Build/compile pipelines** — Webpack loaders, Babel transforms, PostCSS plugins each process and pass to the next
- **CLI command processing** — argument parsing, validation, help generation as middleware before the actual command handler

## When NOT to Use

- **Event fan-out (one-to-many)** — if you need multiple independent handlers for the same event, use the Observer pattern. Middleware is a chain (one path), not a broadcast.
- **Stateless transformations** — if each step just transforms data without needing to wrap the next step (no pre/post), use a simple `array.map().filter().reduce()` pipeline. Middleware's power is the bidirectional wrapping; without it, you pay complexity for nothing.
- **Performance-critical hot paths** — each middleware adds a function call and closure allocation. In a tight loop processing millions of items, the overhead matters. Use direct function calls.

## More Production Uses

- [Express.js](https://github.com/expressjs/express) — `app.use()` chains middleware for HTTP request processing
- [Redux](https://github.com/reduxjs/redux) — `applyMiddleware` wraps `dispatch` for logging, thunks, sagas
- [ASP.NET Core](https://github.com/dotnet/aspnetcore) — `IApplicationBuilder.Use()` middleware pipeline
- [Gin](https://github.com/gin-gonic/gin) — Go HTTP framework with `Use()` middleware and `c.Next()`/`c.Abort()`

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Iterator](/patterns/iterator/) | Middleware chain iterates through handlers like an iterator over a sequence |
| [Observer](/patterns/observer/) | Middleware can observe and modify requests/responses flowing through the pipeline |
| [Vtable](/patterns/vtable/) | Each middleware is a function pointer implementing a common interface, like a vtable entry |
| [Registry](/patterns/registry/) | Registries can store and manage middleware components in the chain |

## Challenge Questions

::: details Q1: You have middleware A (logging), B (auth), C (handler). A user sends a request with an invalid token. B rejects it by NOT calling next(). What does A's post-processing see?
**Answer:** A's post-processing still runs. When B doesn't call `next()`, C never executes. But B's function returns normally to A (since A called `next()` which invoked B). A's code after its `next()` call executes as usual.

This is the onion model in action: A wraps B wraps C. Even if B short-circuits, A's wrapping is still intact. This is why logging middleware works correctly even for rejected requests — it records the duration and status regardless of whether downstream middleware ran.
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

The async/await model makes the onion pattern natural — try/catch/finally maps directly to setup/handle/cleanup.
:::

::: details Q4: Can you implement middleware ordering that runs some middleware only for specific routes (like Express's `app.get('/api', authMiddleware, handler)`)?
**Answer:** Yes — add a predicate to each middleware that checks the context before executing. The pipeline wraps each middleware in a conditional:

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
