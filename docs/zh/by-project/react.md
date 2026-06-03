# React 中的模式

React 的协调器是低级模式组合的典范。前五个模式全部出现在同一个渲染周期中。

## 渲染周期模式

| 模式 | React 中的位置 | 作用 |
|------|---------------|------|
| [位掩码](/zh/patterns/bitmask/) | [`ReactFiberFlags.js`](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberFlags.js#L14-L36) | Fiber 节点上的副作用标志 |
| [双缓冲](/zh/patterns/double-buffering/) | [Fiber `current` / `alternate`](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiber.js#L327-L355) | 协调过程中的原子树切换 |
| [协作调度](/zh/patterns/cooperative-scheduling/) | [`workLoopConcurrent`](https://github.com/facebook/react/blob/main/packages/scheduler/src/forks/Scheduler.js#L188-L258) | 每 5ms 让出以保持 UI 响应 |
| [最小堆](/zh/patterns/min-heap/) | [`SchedulerMinHeap.js`](https://github.com/facebook/react/blob/main/packages/scheduler/src/SchedulerMinHeap.js#L17-L90) | 调度任务的优先队列 |
| [差异/补丁](/zh/patterns/diff-patch/) | [`ReactChildFiber.js`](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactChildFiber.js#L1169-L1340) | 协调新旧子节点列表 |

参见[模式如何协作](/zh/guide/pattern-connections)了解这五个模式如何在一次渲染周期中组合。

## React 中的更多模式

| 模式 | React 中的位置 | 作用 |
|------|---------------|------|
| [批处理](/zh/patterns/batch-processing/) | `unstable_batchedUpdates` | 多次 `setState` 调用合并为一次重渲染 |
| [脏标记](/zh/patterns/dirty-flag/) | [`ReactFiberFlags.js`](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberFlags.js#L18-L22) | Fiber 标志（`Placement`、`Update`、`Deletion`）标记需要处理的子树 |
| [观察者](/zh/patterns/observer/) | `useEffect` cleanup 模式 | 挂载时订阅，清理时取消订阅——解耦的状态观察 |

## 延伸阅读

- [React 源码 (GitHub)](https://github.com/facebook/react)
- [React Fiber 架构](https://github.com/acdlite/react-fiber-architecture)
