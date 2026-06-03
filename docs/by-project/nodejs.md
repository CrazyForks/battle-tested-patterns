# Patterns from Node.js Ecosystem

Node.js, Redux, and XState demonstrate event-driven and state management patterns at scale.

| Pattern | Project | Where | What It Does |
|---------|---------|-------|--------------|
| [Observer / Pub-Sub](/patterns/observer/) | Node.js | [`lib/events.js`](https://github.com/nodejs/node/blob/main/lib/events.js#L456-L520) | `EventEmitter` — foundation of Node's event-driven architecture |
| [Observer / Pub-Sub](/patterns/observer/) | Redux | [`createStore.ts`](https://github.com/reduxjs/redux/blob/master/src/createStore.ts#L211-L280) | `subscribe()` + `dispatch()` — state change notification |
| [State Machine](/patterns/state-machine/) | XState | [`StateMachine.ts`](https://github.com/statelyai/xstate/blob/main/packages/core/src/StateMachine.ts#L58-L120) | Industry-standard finite state machine library |
| [Backpressure](/patterns/backpressure/) | Node.js | [`writable.js`](https://github.com/nodejs/node/blob/main/lib/internal/streams/writable.js#L548-L585) | `writeOrBuffer()` — `highWaterMark` + `drain` event flow control |
| [Iterator / Lazy Eval](/patterns/iterator/) | Node.js | [`lib/internal/streams/`](https://github.com/nodejs/node/tree/main/lib/internal/streams) | Async iterators for streams — `for await (const chunk of stream)` |
| [Retry Backoff](/patterns/retry-backoff/) | Node.js | [`dns`](https://github.com/nodejs/node/blob/main/lib/dns.js), [`http`](https://github.com/nodejs/node/blob/main/lib/http.js) | DNS resolution retry with exponential backoff |
| [Dependency Graph](/patterns/dependency-graph/) | pnpm | [`graph-sequencer`](https://github.com/pnpm/pnpm/blob/main/deps/graph-sequencer/src/index.ts#L22-L125) | Topological sort of workspace packages for build order |
| [Rate Limiter](/patterns/rate-limiter/) | Express | [`express-rate-limit`](https://github.com/express-rate-limit/express-rate-limit) | Token bucket middleware for API rate limiting |
| [Circuit Breaker](/patterns/circuit-breaker/) | opossum | [`lib/circuit.js`](https://github.com/nodeshift/opossum/blob/main/lib/circuit.js) | Node.js circuit breaker for microservice resilience |
| [Event Loop](/patterns/event-loop/) | Node.js (libuv) | [`deps/uv/src/unix/core.c`](https://github.com/nodejs/node/blob/main/deps/uv/src/unix/core.c) | `uv_run()` — single-threaded I/O multiplexing via epoll/kqueue |
| [Middleware Chain](/patterns/middleware-chain/) | Koa.js | [`koa-compose`](https://github.com/koajs/compose/blob/master/index.js) | Compose middleware into an onion-model pipeline with `async/await` |

## Further Reading

- [Node.js (GitHub)](https://github.com/nodejs/node) · [Redux (GitHub)](https://github.com/reduxjs/redux) · [XState (GitHub)](https://github.com/statelyai/xstate)
- [pnpm (GitHub)](https://github.com/pnpm/pnpm)
