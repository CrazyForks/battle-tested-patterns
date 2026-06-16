---
title: '案例研究：React Fiber 如何组合三种模式'
description: 深入剖析 React 的 Fiber 协调器如何组合 bitmask 标志、min-heap 调度器与协作式调度——每一处论断都由固定 commit 上的源码佐证。
---

# 案例研究：React Fiber 如何组合三种模式

> **这是什么。** 大多数模式文档孤立地讲解一个模式。本案例研究反其道而行：它剖析单个真实系统——React 的 Fiber 协调器——如何组合 **三种** 模式，从而在不冻结主线程的前提下完成渲染。每一处针对单个模式的论断都链接到固定 commit 上的源码；组合关系的论证则由 React 团队自己的设计文献支撑。

## Fiber 解决的问题

在 Fiber 之前（React 15 及更早），协调过程是递归且**同步**的：一旦 React 开始遍历组件树以计算更新，就必须一直走到结束、无法中途停下。在大型树上，这个不可中断的单一任务可能占用主线程数十毫秒——足以丢掉动画帧、让输入产生卡顿感。

Fiber（在 React 16 发布、经 React 18 不断打磨）重新架构了协调过程，使工作能够被**拆分为单元、暂停、恢复并区分优先级**。要做到这一点，需要三种各自独立的技术协同工作。它们单独看都不新颖——真正有启发性的是*它们如何组合*。

| 模式 | 在 Fiber 中的职责 |
|---------|--------------|
| **Bitmask** | 紧凑地编码每个 fiber 待处理的副作用，并低成本地向上冒泡到树 |
| **Min-heap** | 始终以 O(1) 的 peek 取出优先级最高的待处理任务 |
| **协作式调度** | 每隔几毫秒把主线程交还给浏览器 |

## 模式 1 —— Bitmask：编码副作用

每个 fiber 节点带有一个 `flags` 字段，描述它需要做哪些工作：放置、更新、删除、ref 挂载等等。React 把这些存为一个 **bitmask**——一个整数，其中每一位代表一种独立的副作用。

```js
export const NoFlags = /*        */ 0b0000000000000000000000000000000;
export const Placement = /*      */ 0b0000000000000000000000000000010;
export const Update = /*         */ 0b0000000000000000000000000000100;
export const ChildDeletion = /*  */ 0b0000000000000000000000000010000;
```

两个特性使它成为协调过程中的正确选择：

- 用一次 `|=` 就能在一个节点上**组合**多种副作用。
- 用 `parent.subtreeFlags |= child.subtreeFlags | child.flags` 把子树的副作用**冒泡**到父节点，然后用一次 `subtreeFlags !== NoFlags` 比较来回答"这棵子树还需要做工作吗？"——而不是在每帧跨数千个节点去遍历字符串数组。

→ 单独了解该模式，见 [Bitmask](/zh/patterns/bitmask/)。

## 模式 2 —— Min-heap：为工作排序

Fiber 的调度器维护一个任务队列，每个任务都带有一个优先级（一个过期时间）。下一个要运行的任务永远是最快过期的那个。**min-heap** 能以 O(1) 访问该最小值、以 O(log n) 插入/移除——对于一个不断添加和弹出任务的队列来说，这是合适的权衡。

```js
export function push(heap, node) { /* append + siftUp */ }
export function peek(heap) { return heap.length === 0 ? null : heap[0]; }
export function pop(heap)  { /* swap root with last + siftDown */ }
```

`peek()` 是热路径：在每个调度 tick 上，工作循环都会 peek 这个堆来决定下一步做什么。整个堆实现约 75 行。

→ 单独了解该模式，见 [Min Heap](/zh/patterns/min-heap/)。

## 模式 3 —— 协作式调度：交还线程

工作循环从堆里取出优先级最高的任务并运行它——但**在每个工作单元之间检查时钟**。如果当前时间片（约 5ms）已经用完且任务尚未过期，它会 `break` 出循环并安排一个延续（continuation），把主线程交还给浏览器，让它能够绘制并处理输入。

```js
function workLoop(initialTime) {
  let currentTime = initialTime;
  currentTask = peek(taskQueue);            // ← uses the min-heap
  while (currentTask !== null) {
    if (currentTask.expirationTime > currentTime && shouldYieldToHost()) {
      break;                                // ← cooperative yield
    }
    // ...run the task's callback...
  }
}
```

这是自愿的、协作式的让出：没有任何东西抢占 React；是 React 自己决定停下来。正是 `shouldYieldToHost()` 这个检查，使长时间的渲染不会阻塞帧。

→ 单独了解该模式，见 [Cooperative Scheduling](/zh/patterns/cooperative-scheduling/)。

## 三者如何组合

再读一遍上面的 `workLoop`——它正是三者交汇之处：

1. **Min-heap** 决定*接下来运行什么*（`peek(taskQueue)`）。
2. **协作式调度** 决定*何时停下*（`shouldYieldToHost()`）。
3. **Bitmask** 是*每个工作单元所操作的对象*——当循环处理一个 fiber 时，它读写该 fiber 的 `flags`，并把 `subtreeFlags` 向根冒泡，好让后续遍历知道哪里还有工作没做完。

最终结果是一个这样的渲染器：它处理一个带优先级的队列，以可中断的切片方式运行，而"还有什么没做完"的状态只是每个节点上一个廉价的整数。去掉其中任意一个模式，整个设计都会崩塌：没有堆就没有优先级；不让出就退回到阻塞；没有 bitmask，跨大型树冒泡副作用就变成了逐节点的数组合并。

::: info 架构推断
把这三者描述为一个*有意组合*的设计——而非三个互相独立的实现细节——这一论断依据的是 React 团队自己的设计文献，而非任何单个源码文件。见下方的组合关系证据（React Fiber Architecture 与 React 18 工作组）。针对单个模式的代码链接是直接的源码证据；而"它们是被有意组合在一起的"这一论断，由那些设计层级的材料支撑。
:::

## 生产验证

所有源码链接均固定到 React commit `34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4`。针对单个模式的论断属于 `source-code`（L1）。组合关系则由设计层级的证据（`official-doc`）支撑。

| 模式 / 论断 | 来源 | 证据类型 | 在 Fiber 中的角色 |
|-----------------|--------|----------|---------------|
| Bitmask | [ReactFiberFlags.js#L14-L36](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/react-reconciler/src/ReactFiberFlags.js#L14-L36) | source-code | 以位编码的副作用标志（`Placement`、`Update`、`ChildDeletion`…） |
| Min-heap | [SchedulerMinHeap.js#L17-L90](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/scheduler/src/SchedulerMinHeap.js#L17-L90) | source-code | `push`/`peek`/`pop` + `siftUp`/`siftDown`；以 O(1) peek 取出优先级最高的任务 |
| 协作式调度 | [Scheduler.js#L188-L258](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/scheduler/src/forks/Scheduler.js#L188-L258) | source-code | `workLoop` peek 堆、运行任务，并在时间片用完时让出 |
| 组合（有意为之） | [react-fiber-architecture](https://github.com/acdlite/react-fiber-architecture) | official-doc | Andrew Clark 的权威 Fiber 设计文献，描述工作单元 + 优先级模型 |
| 组合（有意为之） | [React 18 Working Group](https://github.com/reactwg/react-18/discussions/27) | official-doc | React 团队关于 React 18 协作式渲染 / 时间切片的讨论 |

## 要点

- **模式很少单独出现。** 一个真实的渲染器同时需要一个*数据*模式（bitmask）、一个*排序*模式（min-heap）和一个*控制流*模式（协作式调度）。
- **每个模式都凭一项特性赢得自己的位置。** Bitmask：廉价的组合 + 冒泡。Min-heap：O(1) peek 最小值。协作式调度：有界的主线程占用。
- **热路径揭示架构。** `workLoop` 约 30 行却触及全部三者——读一个真实系统的热路径，往往是理解其模式如何咬合的最快方式。

## 延伸学习这些模式

- [Bitmask](/zh/patterns/bitmask/) —— 紧凑的标志编码
- [Min Heap](/zh/patterns/min-heap/) —— 具备 O(1) peek 的优先级队列
- [Cooperative Scheduling](/zh/patterns/cooperative-scheduling/) —— 让出线程
