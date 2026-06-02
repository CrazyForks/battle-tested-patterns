# Patterns from React

React's source code is a goldmine of production-proven patterns. Here are the ones we've extracted:

| Pattern | Where in React | What It Does |
|---------|---------------|--------------|
| [Bitmask](/patterns/bitmask/) | `ReactFiberFlags.js` | Side-effect flags on fiber nodes |
| [Double Buffering](/patterns/double-buffering/) | Fiber `current` / `alternate` | Atomic tree swap during reconciliation |
| [Cooperative Scheduling](/patterns/cooperative-scheduling/) | `workLoopConcurrent` | Yield every 5ms to keep UI responsive |
| [Min Heap](/patterns/min-heap/) | `SchedulerMinHeap.js` | Priority queue for scheduled tasks |
| [Diff / Patch](/patterns/diff-patch/) | `ReactChildFiber.js` | Reconcile old and new children lists |

## Further Reading

- [React Source Code (GitHub)](https://github.com/facebook/react)
- [React Fiber Architecture](https://github.com/acdlite/react-fiber-architecture)
