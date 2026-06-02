# Node.js 生态系统中的模式

| 模式 | 项目 | 位置 | 作用 |
|------|------|------|------|
| [观察者](/zh/patterns/observer/) | Node.js | `lib/events.js` | `EventEmitter` — Node 事件驱动架构的基础 |
| [观察者](/zh/patterns/observer/) | Redux | `createStore.ts` | `subscribe()` + `dispatch()` — 状态变化通知 |
| [状态机](/zh/patterns/state-machine/) | XState | `StateMachine.ts` | 工业级有限状态机库 |
| [背压](/zh/patterns/backpressure/) | Node.js | `writable.js` | `writeOrBuffer()` — `highWaterMark` + `drain` 事件流控 |
| [迭代器](/zh/patterns/iterator/) | Node.js | `lib/internal/streams/` | 流的异步迭代器 — `for await (const chunk of stream)` |
| [重试退避](/zh/patterns/retry-backoff/) | Node.js | `dns`, `http` | DNS 解析的指数退避重试 |
| [依赖图](/zh/patterns/dependency-graph/) | pnpm | `graph-sequencer` | 工作区包的拓扑排序确定构建顺序 |
| [限流器](/zh/patterns/rate-limiter/) | Express | `express-rate-limit` | API 限流的令牌桶中间件 |
| [熔断器](/zh/patterns/circuit-breaker/) | opossum | `lib/circuit.js` | Node.js 微服务弹性熔断器 |
