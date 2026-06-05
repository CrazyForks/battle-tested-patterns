---
description: "Node.js 生态模式：观察者（EventEmitter）、背压（Streams）、状态机（XState）和中间件链（Koa）。"
---

# Node.js 生态系统中的模式

Node.js、Redux 和 XState 展示了大规模事件驱动与状态管理模式。

| 模式 | 项目 | 位置 | 作用 |
|------|------|------|------|
| [观察者](/zh/patterns/observer/) | Node.js | [`lib/events.js`](https://github.com/nodejs/node/blob/main/lib/events.js#L456-L520) | `EventEmitter` — Node 事件驱动架构的基础 |
| [观察者](/zh/patterns/observer/) | Redux | [`createStore.ts`](https://github.com/reduxjs/redux/blob/master/src/createStore.ts#L211-L280) | `subscribe()` + `dispatch()` — 状态变化通知 |
| [状态机](/zh/patterns/state-machine/) | XState | [`StateMachine.ts`](https://github.com/statelyai/xstate/blob/main/packages/core/src/StateMachine.ts#L58-L120) | 工业级有限状态机库 |
| [背压](/zh/patterns/backpressure/) | Node.js | [`writable.js`](https://github.com/nodejs/node/blob/main/lib/internal/streams/writable.js#L548-L585) | `writeOrBuffer()` — `highWaterMark` + `drain` 事件流控 |
| [迭代器](/zh/patterns/iterator/) | Node.js | [`lib/internal/streams/`](https://github.com/nodejs/node/tree/main/lib/internal/streams) | 流的异步迭代器 — `for await (const chunk of stream)` |
| [重试退避](/zh/patterns/retry-backoff/) | Node.js | [`dns`](https://github.com/nodejs/node/blob/main/lib/dns.js), [`http`](https://github.com/nodejs/node/blob/main/lib/http.js) | DNS 解析的指数退避重试 |
| [依赖图](/zh/patterns/dependency-graph/) | pnpm | [`graph-sequencer`](https://github.com/pnpm/pnpm/blob/main/deps/graph-sequencer/src/index.ts#L22-L125) | 工作区包的拓扑排序确定构建顺序 |
| [限流器](/zh/patterns/rate-limiter/) | Express | [`express-rate-limit`](https://github.com/express-rate-limit/express-rate-limit) | API 限流的令牌桶中间件 |
| [熔断器](/zh/patterns/circuit-breaker/) | opossum | [`lib/circuit.js`](https://github.com/nodeshift/opossum/blob/main/lib/circuit.js) | Node.js 微服务弹性熔断器 |
| [事件循环](/zh/patterns/event-loop/) | Node.js (libuv) | [`deps/uv/src/unix/core.c`](https://github.com/nodejs/node/blob/main/deps/uv/src/unix/core.c) | `uv_run()` — 通过 epoll/kqueue 实现单线程 I/O 多路复用 |
| [中间件链](/zh/patterns/middleware-chain/) | Koa.js | [`koa-compose`](https://github.com/koajs/compose/blob/master/index.js) | 通过 `async/await` 将中间件组合为洋葱模型管道 |

## 模式如何组合：一次 HTTP 请求

当 Express/Koa 服务器处理请求时，模式从网络层到响应层逐级组合：

<CompositionFlow variant="nodejs-request" />

Event Loop 是基石：所有逻辑运行在单线程上，I/O 从不阻塞。这就是 Node.js 能处理数千并发连接的原因——每个请求使用模式（中间件、观察者、背压）而非创建线程。

## 延伸阅读

- [Node.js (GitHub)](https://github.com/nodejs/node) · [Redux (GitHub)](https://github.com/reduxjs/redux) · [XState (GitHub)](https://github.com/statelyai/xstate)
- [pnpm (GitHub)](https://github.com/pnpm/pnpm)
