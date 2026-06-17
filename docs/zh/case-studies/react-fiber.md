---
title: '案例研究：React Fiber 如何组合三种模式'
description: 深入剖析 React 的 Fiber 协调器如何组合 bitmask 标志、min-heap 调度器与协作式调度——每一处论断都由固定 commit 上的源码佐证。
---

# 案例研究：React Fiber 如何组合三种模式

> **这是什么。** 大多数模式文档孤立地讲解一个模式。本案例研究反其道而行：它剖析单个真实系统——React 的 Fiber 协调器——如何组合 **三种** 模式，从而在不冻结主线程的前提下完成渲染。每一处针对单个模式的论断都链接到固定 commit 上的源码；组合关系的论证则由 React 团队自己的设计文献支撑。

## Fiber 解决的问题

在 Fiber 之前（React 15 及更早），协调过程是递归且**同步**的：一旦 React 开始遍历组件树以计算更新，就必须一直走到结束、无法中途停下。在大型树上，这个不可中断的单一调用栈可能占用主线程数十毫秒——足以丢掉动画帧、延迟点击、让输入产生卡顿感。浏览器只有一个主线程；React 占着它，其它一切（绘制、输入、布局）都做不了。

Fiber（在 React 16 发布、经 React 18 不断打磨）围绕一个核心思想重构了协调过程：**让渲染可被中断**。要中断工作、之后再恢复，React 必须不再依赖 JavaScript 调用栈（你无法暂停它），转而把工作建模为它能掌控的**数据**。一个"fiber"正是如此——一个表示单个工作单元的普通对象，带有指向父、子、兄弟节点的指针，于是 React 可以用循环而非递归来遍历整棵树。

一旦工作变成循环里的数据，就会冒出三个问题，而每一个都由一个经典模式来回答：

| 问题 | 模式 | Fiber 如何回答 |
|----------|---------|----------------------|
| *每个工作单元需要做什么？* | **Bitmask** | 每个 fiber 一个 `flags` 整数；一位代表一种副作用，并向上冒泡到树 |
| *接下来运行哪个工作？* | **Min-heap** | 一个以过期时间为键的优先级队列；以 O(1) peek 取出最紧急者 |
| *何时停下来让浏览器喘口气？* | **协作式调度** | 一个工作循环，在工作单元之间检查截止时间并让出 |

本案例研究接下来逐个展开——先讲模式，再讲它在 Fiber 中的确切角色并附源码佐证——最后展示那一个约 30 行、三者交汇的函数。

## 模式 1 —— Bitmask：表达"需要做什么"的语言

Bitmask 在 Fiber 中出现了**两次**，承担两种不同的职责。看清这两处，是理解 React 为何如此频繁使用它的最快方式。

### 1a. 副作用标志（side-effect flags）

每个 fiber 节点带有一个 `flags` 字段，描述它在 commit 阶段需要做的工作：放置、更新、删除、ref 挂载等等。React 把这些存为一个 **bitmask**——一个整数，其中每一位代表一种独立的副作用。

```js
export const NoFlags = /*        */ 0b0000000000000000000000000000000;
export const Placement = /*      */ 0b0000000000000000000000000000010;
export const Update = /*         */ 0b0000000000000000000000000000100;
export const ChildDeletion = /*  */ 0b0000000000000000000000000010000;
```

两个特性使它成为协调过程中的正确编码：

- 用一次 `|=` 就能在一个节点上**组合**多种副作用——无数组、无去重、无分配。
- 把子树的副作用**冒泡**向根，让后续遍历用一次比较就知道整棵子树能否被跳过。

这个冒泡不是空话——它就是 `completeWork` 里一段实打实的循环。当 React 完成每个 fiber 时，`bubbleProperties` 把每个子节点的 flags OR 进父节点的 `subtreeFlags`：

```js
function bubbleProperties(completedWork) {
  let subtreeFlags = NoFlags;
  let child = completedWork.child;
  while (child !== null) {
    subtreeFlags |= child.subtreeFlags;   // child's whole subtree
    subtreeFlags |= child.flags;          // child itself
    child = child.sibling;
  }
  completedWork.subtreeFlags |= subtreeFlags;
}
```

于是 commit 阶段可以用一次掩码比较——`finishedWork.subtreeFlags & MutationMask`——来回答"这棵子树里有任何 mutation 吗？"，并剪掉所有无工作的分支。在数千节点的树上，这正是"逐节点数组合并"与"几次整数 OR"之间的差距。

::: tip 心智模型
把 `flags` 想成一个节点的*待办清单*，被压缩进一个整数；把 `subtreeFlags` 想成它下方所有待办清单的*缓存摘要*。正是这个摘要让 React 能以 O(1) 跳过干净的分支，而不必重新遍历它们。
:::

### 1b. Lane 优先级

同样的思想也用来编码**优先级**。React 的"lanes（车道）"模型把更新优先级表示为一个整数中的位——31 条 lane，从 `SyncLane`（最紧急）一直到空闲工作：

```js
export const TotalLanes = 31;
export const NoLanes      = 0b0000000000000000000000000000000;
export const SyncLane     = 0b0000000000000000000000000000010;
export const DefaultLane  = 0b0000000000000000000000000100000;
```

因为 lane 是位，React 能把*一组待处理的优先级*装进一个整数、用 OR 合并它们、再用位运算技巧（`getHighestPriorityLanes`）提取出最紧急的那个。这里其实有**两层**优先级：reconciler 用 *lane* 思考，然后把选中的 lane 映射到 Scheduler 的某个粗粒度优先级*等级*（如 `ImmediatePriority`、`NormalPriority`）；Scheduler 再把该等级转成一个具体的**过期时间**，这才是它的 min-heap 用来排序的 `sortIndex`。所以交接链是：**bitmask（lanes）挑出优先级；该优先级映射到一个 Scheduler 等级；heap 按由此得到的过期时间排序。**

→ 单独了解该模式，见 [Bitmask](/zh/patterns/bitmask/)。

## 模式 2 —— Min-heap：为工作排序

Fiber 的调度器维护一个任务队列，每个任务带有一个 `sortIndex`（由 lane 的过期时间推导而来）。下一个要运行的任务永远是最快过期的那个。**min-heap** 能以 O(1) 访问该最小值、以 O(log n) 插入/移除——对于一个不断添加和弹出任务的队列来说，这是合适的权衡。

```js
export function push(heap, node) { /* append + siftUp */ }
export function peek(heap) { return heap.length === 0 ? null : heap[0]; }
export function pop(heap)  { /* swap root with last + siftDown */ }
```

`peek()` 是热路径：在每个调度 tick 上，工作循环都会 peek 这个堆来决定下一步做什么，无需付出重新排序的代价。整个堆约 75 行——`push` 把新节点向上 sift，`pop` 把根与最后一个元素交换再向下 sift。没有平衡、没有指针，只是一个数组。

::: tip 心智模型
为什么用堆而不是有序数组？有序数组同样给 O(1) peek，但插入是 O(n)（要移动所有元素）。React *不断地*插入和移除任务，所以它既需要廉价插入**又**需要廉价 peek——这正是堆的权衡所在。（平衡二叉搜索树也能用，但每次操作开销更大、且对缓存不友好；CFS 与 React 的对比详见 Min Heap 模式页的 Challenge Questions。）
:::

→ 单独了解该模式，见 [Min Heap](/zh/patterns/min-heap/)。

## 模式 3 —— 协作式调度：交还线程

工作循环从堆里取出优先级最高的任务并运行它——但**在工作单元之间检查一个截止时间**。如果当前时间片（约 5ms）已经用完且任务尚未过期，它会 `break` 出循环并安排一个延续（continuation），把主线程交还给浏览器，让它在 React 恢复之前能够绘制并处理输入。

```js
function workLoop(initialTime) {
  let currentTime = initialTime;
  currentTask = peek(taskQueue);            // ← uses the min-heap
  while (currentTask !== null) {
    if (currentTask.expirationTime > currentTime && shouldYieldToHost()) {
      break;                                // ← cooperative yield
    }
    // ...run the task's callback; if it returns a continuation, keep it...
    currentTask = peek(taskQueue);
  }
}
```

这是**自愿的**让出：没有任何东西抢占 React——是 React 自己决定停下来。两个条件共同把关这个决定：一个已经*过期*的任务会被运行到底（紧急工作永不被饿死），而未过期的工作则在 `shouldYieldToHost()` 判定时间片用完的那一刻让出。延续通过 `MessageChannel` 投递，因此浏览器能在 React 接着上次的位置继续之前，真正获得一个执行轮次。

::: tip 心智模型
协作式调度就是"渲染一点、抬头看看、再渲染一点"。把它与一个霸占 CPU 的长任务对比：操作系统可以*抢占*一个线程，但浏览器无法抢占你的 JavaScript。于是 React 通过自己检查时钟、主动选择停下，来模拟抢占——用协作代替中断。
:::

→ 单独了解该模式，见 [Cooperative Scheduling](/zh/patterns/cooperative-scheduling/)。

## 三者如何组合

再读一遍上面的 `workLoop`——它正是三者交汇之处，而交接的顺序就是整个设计的精髓：

1. **Bitmask（lanes）** 把"改了什么、有多紧急"转化为一个优先级，这个优先级再变成任务的过期时间。
2. **Min-heap** 按该过期时间为任务排序，并以 O(1) 回答*接下来运行什么*（`peek(taskQueue)`）。
3. **协作式调度** 在有界的时间片内运行该任务，并决定*何时停下*（`shouldYieldToHost()`）。
4. **Bitmask（flags）** 是*每个工作单元所操作的对象*——当循环处理一个 fiber 时，它读写该 fiber 的 `flags`，而 `bubbleProperties` 把 `subtreeFlags` 向根 OR，好让后续的 commit 阶段用一次掩码比较就知道究竟该处理哪些分支。

```text
lane priority (bitmask)
        │  becomes expirationTime
        ▼
   min-heap  ──peek()──►  highest-priority task
        ▲                        │
        │                        ▼
   push/pop            workLoop runs it in ≤5ms slices
   as work arrives              │  shouldYieldToHost()? → break, continue later
                                ▼
                    fiber.flags / subtreeFlags (bitmask)
                    mark + bubble what the commit phase must do
```

最终结果是一个这样的渲染器：它处理一个带**优先级**的队列，以**可中断**的切片方式运行，而"还有什么没做完"的状态只是每个节点上一个**廉价的整数**。去掉其中任意一个模式，整个设计都会崩塌：没有 lanes 就没有可供排序的优先级；没有堆就没有廉价的"谁最紧急"；不让出就退回到阻塞；没有 flags bitmask，commit 阶段就只能靠遍历整棵树来重新发现工作。

::: info 架构推断
把这些模式描述为一个*有意组合*的设计——而非互相独立的实现细节——这一论断依据的是 React 团队自己的设计文献（见下方的延伸阅读与组合关系证据行），而非任何单个源码文件。针对单个模式的代码链接是直接的源码证据；而"被有意组合在一起"这一论断，由那些设计层级的材料支撑。
:::

## 生产验证

所有源码链接均固定到 React commit `34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4`。针对单个模式的论断属于 `source-code`（L1）；组合关系则由设计层级的证据（`official-doc`）支撑。

| 模式 / 论断 | 来源 | 证据类型 | 在 Fiber 中的角色 |
|-----------------|--------|----------|---------------|
| Bitmask（flags） | [ReactFiberFlags.js#L14-L36](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/react-reconciler/src/ReactFiberFlags.js#L14-L36) | source-code | 以位编码的副作用标志（`Placement`、`Update`、`ChildDeletion`…） |
| Bitmask（冒泡） | [ReactFiberCompleteWork.js#L791-L815](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/react-reconciler/src/ReactFiberCompleteWork.js#L791-L815) | source-code | `bubbleProperties` 把子节点的 `subtreeFlags`/`flags` OR 进父节点 |
| Bitmask（lanes） | [ReactFiberLane.js#L41-L54](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/react-reconciler/src/ReactFiberLane.js#L41-L54) | source-code | 以位编码的 31 条优先级 lane（`SyncLane`、`DefaultLane`…） |
| Lane → 优先级选择 | [ReactFiberLane.js#L249-L321](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/react-reconciler/src/ReactFiberLane.js#L249-L321) | source-code | `getNextLanes` 用位运算技巧挑出优先级最高的待处理 lane |
| Min-heap | [SchedulerMinHeap.js#L17-L90](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/scheduler/src/SchedulerMinHeap.js#L17-L90) | source-code | `push`/`peek`/`pop` + `siftUp`/`siftDown`；以 O(1) peek 取出优先级最高的任务 |
| 协作式调度 | [Scheduler.js#L188-L258](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/scheduler/src/forks/Scheduler.js#L188-L258) | source-code | `workLoop` peek 堆、运行任务，并在时间片用完时让出 |
| 组合（有意为之） | [react-fiber-architecture](https://github.com/acdlite/react-fiber-architecture) | official-doc | Andrew Clark 的权威 Fiber 设计文献：工作单元 + 优先级模型 |
| 组合（有意为之） | [React 18 Working Group #27](https://github.com/reactwg/react-18/discussions/27) | official-doc | React 团队关于协作式渲染 / 时间切片的讨论 |
| render 与 commit 两阶段 | [react.dev — Render and Commit](https://react.dev/learn/render-and-commit) | official-doc | 官方对 flags bitmask 所连接的两个阶段的解释 |

## 要点

- **模式很少单独出现。** 一个真实的渲染器同时需要一个*数据*模式（bitmask）、一个*排序*模式（min-heap）和一个*控制流*模式（协作式调度）——而且它们以特定的顺序彼此交接。
- **同一种原语可以做两件事。** Bitmask 既编码一个节点*需要什么工作*（flags），又编码一个更新*有多紧急*（lanes）。在两种角色中认出同一种原语，是深读源码的标志。
- **每个模式都凭一项特性赢得自己的位置。** Flags：廉价的组合 + 冒泡。Lanes：一个整数装下一组优先级。Heap：O(1) peek 最小值。协作式调度：有界的主线程占用。
- **热路径揭示架构。** `workLoop` 约 30 行却触及全部三者——读一个真实系统的热路径，往往是理解其模式如何咬合的最快方式。

## 延伸阅读

一条从"我读过了"走向"我能在任何代码库里认出这些模式"的建议路径：

1. **先建立心智模型** —— [react.dev：Render and Commit](https://react.dev/learn/render-and-commit) 给出官方的两阶段框架（render = 计算，commit = 应用），这正是 flags bitmask 所连接的。
2. **读权威设计文档** —— Andrew Clark（React 核心维护者）写的 [react-fiber-architecture](https://github.com/acdlite/react-fiber-architecture) 解释了*为什么*工作变成了数据、以及什么是"工作单元"。这是组合关系论断的来源。
3. **跟随 React 18 的推理** —— [React 18 Working Group #27](https://github.com/reactwg/react-18/discussions/27) 展示了 React 团队关于协作式渲染与时间切片的原话。
4. **然后按这个顺序读源码** —— flags（[ReactFiberFlags.js](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/react-reconciler/src/ReactFiberFlags.js#L14-L36)）→ 它们如何冒泡（[bubbleProperties](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/react-reconciler/src/ReactFiberCompleteWork.js#L791-L815)）→ 堆（[SchedulerMinHeap.js](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/scheduler/src/SchedulerMinHeap.js#L17-L90)）→ 把它们串起来的循环（[Scheduler.js workLoop](https://github.com/facebook/react/blob/34b78a2897cc208260a88e6b62ecaf9ca2a9dfe4/packages/scheduler/src/forks/Scheduler.js#L188-L258)）。在建立模型*之后*再读代码，意味着每个函数都在印证你已经预期的东西，而不是一堵陌生名字砌成的墙。
5. **练习这种识别力** —— 打开下面三个模式页并完成它们的练习；然后试着在你熟悉的另一个系统里，找出同样的三种角色（数据 / 排序 / 控制流）。

## 延伸学习这些模式

- [Bitmask](/zh/patterns/bitmask/) —— 紧凑的标志编码
- [Min Heap](/zh/patterns/min-heap/) —— 具备 O(1) peek 的优先级队列
- [Cooperative Scheduling](/zh/patterns/cooperative-scheduling/) —— 让出线程
