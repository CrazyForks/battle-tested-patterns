# Patterns from Node.js Ecosystem

Node.js, Redux, and XState demonstrate event-driven and state management patterns at scale.

| Pattern | Project | Where | What It Does |
|---------|---------|-------|--------------|
| [Observer / Pub-Sub](/patterns/observer/) | Node.js | `lib/events.js` | `EventEmitter` — foundation of Node's event-driven architecture |
| [Observer / Pub-Sub](/patterns/observer/) | Redux | `createStore.ts` | `subscribe()` + `dispatch()` — state change notification |
| [State Machine](/patterns/state-machine/) | XState | `StateMachine.ts` | Industry-standard finite state machine library |
| [Backpressure](/patterns/backpressure/) | Node.js | `writable.js` | `writeOrBuffer()` — `highWaterMark` + `drain` event flow control |
| [Iterator / Lazy Eval](/patterns/iterator/) | Node.js | `lib/internal/streams/` | Async iterators for streams — `for await (const chunk of stream)` |
| [Retry Backoff](/patterns/retry-backoff/) | Node.js | `dns`, `http` | DNS resolution retry with exponential backoff |
| [Dependency Graph](/patterns/dependency-graph/) | pnpm | `graph-sequencer` | Topological sort of workspace packages for build order |
| [Rate Limiter](/patterns/rate-limiter/) | Express | `express-rate-limit` | Token bucket middleware for API rate limiting |
| [Circuit Breaker](/patterns/circuit-breaker/) | opossum | `lib/circuit.js` | Node.js circuit breaker for microservice resilience |

## Further Reading

- [Node.js (GitHub)](https://github.com/nodejs/node) · [Redux (GitHub)](https://github.com/reduxjs/redux) · [XState (GitHub)](https://github.com/statelyai/xstate)
- [pnpm (GitHub)](https://github.com/pnpm/pnpm)
