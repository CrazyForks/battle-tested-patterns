# Patterns from React

React's reconciler is a masterclass in combining low-level patterns. The first five patterns all appear in a single render cycle.

## Render Cycle Patterns

| Pattern | Where in React | What It Does |
|---------|---------------|--------------|
| [Bitmask](/patterns/bitmask/) | [`ReactFiberFlags.js`](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberFlags.js#L14-L36) | Side-effect flags on fiber nodes |
| [Double Buffering](/patterns/double-buffering/) | [Fiber `current` / `alternate`](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiber.js#L327-L355) | Atomic tree swap during reconciliation |
| [Cooperative Scheduling](/patterns/cooperative-scheduling/) | [`workLoopConcurrent`](https://github.com/facebook/react/blob/main/packages/scheduler/src/forks/Scheduler.js#L188-L258) | Yield every 5ms to keep UI responsive |
| [Min Heap](/patterns/min-heap/) | [`SchedulerMinHeap.js`](https://github.com/facebook/react/blob/main/packages/scheduler/src/SchedulerMinHeap.js#L17-L90) | Priority queue for scheduled tasks |
| [Diff / Patch](/patterns/diff-patch/) | [`ReactChildFiber.js`](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactChildFiber.js#L1169-L1340) | Reconcile old and new children lists |

See [Pattern Connections](/guide/pattern-connections) for how these five compose in a single render cycle.

## More Patterns in React

| Pattern | Where in React | What It Does |
|---------|---------------|--------------|
| [Batch Processing](/patterns/batch-processing/) | `unstable_batchedUpdates` | Multiple `setState` calls batched into a single re-render |
| [Dirty Flag](/patterns/dirty-flag/) | [`ReactFiberFlags.js`](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberFlags.js#L18-L22) | Fiber flags (`Placement`, `Update`, `Deletion`) mark which subtrees need work |
| [Observer](/patterns/observer/) | `useEffect` cleanup pattern | Subscribe on mount, unsubscribe on cleanup — decoupled state observation |

## Further Reading

- [React Source Code (GitHub)](https://github.com/facebook/react)
- [React Fiber Architecture](https://github.com/acdlite/react-fiber-architecture)
