---
title: '案例研究：Go 如何组合三种模式来调度 Goroutine'
description: 深入剖析 Go 运行时如何组合协作式调度器、工作窃取与 per-P 对象池，在少量线程上运行数百万 goroutine——每一处论断都由固定 commit 上的源码佐证。
---

# 案例研究：Go 如何组合三种模式来调度 Goroutine

> **这是什么。** 大多数模式文档孤立地讲解一个模式。本案例研究反其道而行：它剖析单个真实系统——Go 运行时调度器（GMP 模型）——如何组合 **三种** 模式，使数百万 goroutine 运行在少数几个 OS 线程上，且快路径无锁。每一处针对单个模式的论断都链接到固定 commit 上的源码；组合关系的论证则由 Go 自己的设计文档支撑。

## Go 解决的问题

goroutine 本应是"自由"的：`go func()` 应当几乎零开销，一个程序应能轻松创建数十万个。但 OS 线程很昂贵（兆字节级的栈、内核调度开销），所以 Go 无法把一个 goroutine 映射到一个线程。它必须把*许多* goroutine 多路复用到*少量*线程上——而且不能用一把每个 `go` 语句都要争抢的全局锁。

Go 的答案是 **GMP 模型**：**G**oroutine 运行在 **M**（OS 线程）上，每个 M 由一个 **P**（逻辑处理器）驱动，而每个 P 拥有一个本地运行队列。要让它快——创建廉价、负载均衡、争用极小——需要三种模式协同工作。它们单独看都不新颖；真正有启发性的是*它们如何组合*。

| 问题 | 模式 | Go 如何回答 |
|----------|---------|-------------------|
| *一个线程如何挑选接下来运行什么？* | **协作式调度** | `schedule()` 循环，找到一个可运行的 G，而 G 在安全点让出 |
| *如何在没有全局锁的前提下让所有线程都忙起来？* | **工作窃取** | 空闲的 P 从另一个 P 的队列里窃取 goroutine |
| *如何避免每次复用都重新分配？* | **对象池** | per-P 的 `sync.Pool` 分片无锁地交还缓存对象 |

## 模式 1 —— 协作式调度：每线程的循环

每个 M（线程）运行 `schedule()`，它是运行时的心脏。它找到下一个可运行的 goroutine 并切换过去。常见情况下，goroutine 在安全点（函数序言、channel 操作、系统调用）**协作式**地让出；自 Go 1.14 起，运行时*还*支持基于信号的**异步抢占**，所以即便一个 goroutine 卡在没有安全点的紧循环里，也仍能被停下。下面的调度循环是其中协作的那一半——你读它，是为了理解一个线程如何挑选它的下一个 goroutine。

```go
func schedule() {
  mp := getg().m
  // ...guards: not holding locks, not in cgo, handle locked g...
  // find a runnable goroutine (local queue, global queue, or steal),
  // then execute it on this M.
}
```

这个循环的职责是"在*这个*线程上接下来运行什么"。它先检查 P 自己的本地运行队列（廉价、常见的情况），再看全局队列，只有当两者都空时才求助于下一个模式。（两个供好奇者了解的细节：每第 61 次调度 tick 它会*先*查全局队列，于是一个永不清空本地队列的 P 也不会饿死全局工作；`findRunnable` 还会轮询网络 poller、并可能运行一个 GC worker。"本地→全局→窃取"这个梗概是主干，而非全貌。）

::: tip 心智模型
把每个 P 想成一个有自己待办清单（本地运行队列）的工人。`schedule()` 就是这个工人反复从自己清单上取下一个任务。因为清单是 P-本地的，取任务无需全局锁——这正是给每个 P 一个独立队列的全部意义。
:::

→ 单独了解该模式，见 [Cooperative Scheduling](/zh/patterns/cooperative-scheduling/)。

## 模式 2 —— 工作窃取：无需中央队列的负载均衡

如果每个 P 永远只排空自己的队列，倒霉的 P 可能干坐着空闲，而另一个 P 却超载。一个共享队列能解决均衡，但会重新引入全局锁。Go 的解法是 **工作窃取**：当一个 P 的本地队列为空时，它尝试从另一个 P *窃取* goroutine。

```go
func stealWork(now int64) (gp *g, inheritTime bool, rnow, pollUntil int64, newWork bool) {
  pp := getg().m.p.ptr()
  const stealTries = 4
  for i := 0; i < stealTries; i++ {
    // walk other Ps in a randomized order; try to grab half of a victim's queue
    for enum := stealOrder.start(cheaprand()); !enum.done(); enum.next() {
      // ...runqsteal from allp[enum.position()]...
    }
  }
}
```

几个关键设计选择：受害者的遍历顺序是**随机化**的（这样窃取者不会全都涌向 P0），它窃取受害者队列的**一半**（这样工作量、以及未来的窃取都被摊薄），且它只在**慢路径**上发生——当一个 P 自己无事可做时。因此争用是被有意设计成罕见情况的。

::: tip 心智模型
工作窃取是"空闲的工人主动去帮忙碌的工人"。没有管理者分派工作；一个空手的 P 走到一个随机同事那里，拿走他一半的活儿。快路径（你自己的队列）保持无锁；锁只在罕见的窃取时出现。
:::

→ 单独了解该模式，见 [Work Stealing](/zh/patterns/work-stealing/)。

## 模式 3 —— 对象池：避免分配的 per-P 缓存

调度数百万 goroutine 意味着不断产生短命的临时对象（`fmt`、`encoding/json` 等里的缓冲区）。逐个分配再让 GC 回收会主导开销。`sync.Pool` 用与调度器**相同的 per-P 分片思想**解决它：每个 P 有自己的池分片，所以 `Get`/`Put` 在快路径上无锁。

```go
type Pool struct {
  noCopy noCopy
  local     unsafe.Pointer // per-P fixed-size pool, actual type is [P]poolLocal
  localSize uintptr        // size of the local array
  victim     unsafe.Pointer // local from previous GC cycle
  victimSize uintptr
  New func() any           // optional factory when the pool is empty
}
```

`local` 字段是一个按 P 索引的数组。运行在 P*i* 上的 goroutine 只接触 `local[i]`，所以来自不同 P 的并发 `Get`/`Put` 永不争用。`victim` 字段是一个跨一个 GC 周期的宽限缓冲，用来在 GC 之间平滑复用。

::: tip 心智模型
`sync.Pool` 是把调度器的 per-P 哲学应用到*内存*而非*工作*上：按 P 分片，让常见情况无锁，只在争用或 GC 时回退到共享/慢路径。在两个子系统里认出同一个分片思想，是深读运行时的标志。
:::

→ 单独了解该模式，见 [Object Pool](/zh/patterns/object-pool/)。

## 三者如何组合

启动 `go func()`，三个模式围绕 P 依次交接：

1. **协作式调度**（`schedule()`）排空*这个* P 的本地运行队列——处理绝大多数切换的无锁快路径。
2. **工作窃取**（`stealWork()`）只在本地队列为空时触发，通过抓取一个随机受害者 P 队列的一半来再平衡负载。
3. **对象池**（`sync.Pool`）按*同一个* P 分片，于是调度和用户代码churn 出的临时对象被复用，无需分配、无需全局锁。

```text
go func()  ──► enqueue G on current P's local run queue
                         │
                         ▼
        schedule() drains P-local queue   ◄── fast path, lock-free
                         │  (empty?)
                         ▼
        stealWork(): grab half of a random P's queue  ◄── slow path, rare
                         │
        (running goroutines reuse temporaries via)
                         ▼
        sync.Pool local[P]  ◄── per-P shard, lock-free Get/Put
```

统一这一切的思想是 **per-P 所有权**：给每个逻辑处理器它自己的运行队列和它自己的池分片，于是常见情况只接触 P-本地状态、无需锁。全局结构（或锁）只出现在罕见的慢路径上——P 跑空时的窃取，或 GC 下的共享池。去掉其中任意一个模式它都会崩塌：没有协作式的 per-P 循环就没有无锁快路径；没有窃取，负载不均会饿死某些 P；没有 per-P 池，分配与 GC 会主导调度器本想让其廉价的那些工作负载。

::: info 架构推断
把这些模式描述为一个*有意组合*的设计——以 per-P 所有权为统一原则——依据的是 Go 自己的调度器设计文档（见延伸阅读），而非任何单个源码文件。针对单个模式的代码链接是直接的源码证据；而"被有意组合在一起"这一论断，由那些设计层级的材料支撑。
:::

## 生产验证

所有源码链接均固定到 Go commit `f5cdf4745455415c7a43cfc7d925214d4511489b`。针对单个模式的论断属于 `source-code`（L1）；组合关系则由官方文档（`official-doc`）支撑。

| 模式 / 论断 | 来源 | 证据类型 | 在 GMP 调度中的角色 |
|-----------------|--------|----------|------------------------|
| 协作式调度 | [proc.go#L4143-L4200](https://github.com/golang/go/blob/f5cdf4745455415c7a43cfc7d925214d4511489b/src/runtime/proc.go#L4143-L4200) | source-code | `schedule()`——找到并运行下一个 goroutine 的 per-M 循环 |
| 工作窃取 | [proc.go#L3836-L3903](https://github.com/golang/go/blob/f5cdf4745455415c7a43cfc7d925214d4511489b/src/runtime/proc.go#L3836-L3903) | source-code | `stealWork()`——空闲 P 窃取一个随机受害者 P 队列的一半 |
| 对象池 | [sync/pool.go#L52-L97](https://github.com/golang/go/blob/f5cdf4745455415c7a43cfc7d925214d4511489b/src/sync/pool.go#L52-L97) | source-code | `Pool` 结构体——per-P 的 `local` 分片带来无锁的 `Get`/`Put` |
| 组合（有意为之） | [proc.go#L25-L36 (scheduler design comment)](https://github.com/golang/go/blob/f5cdf4745455415c7a43cfc7d925214d4511489b/src/runtime/proc.go#L25-L36) | source-code | 运行时自己的头部注释，定义了这三种模式所服务的 G/M/P 模型 |
| Goroutine 与并发 | [Effective Go — Concurrency](https://go.dev/doc/effective_go#concurrency) | official-doc | 官方对 goroutine 多路复用到 OS 线程的解释 |

## 要点

- **模式很少单独出现。** 一个运行时调度器同时需要一个*控制流*模式（协作式调度）、一个*均衡*模式（工作窃取）和一个*内存*模式（对象池）——而且它们围绕 P 交接。
- **一个思想能统一一个子系统。** per-P 所有权是本地运行队列*和* `sync.Pool` 分片背后的同一个原则。在两处认出同一个思想，正是深读源码的收获。
- **把快路径设计成无锁；让争用成为罕见情况。** Go 调度器之所以快，不是因为窃取快，而是因为窃取几乎从不发生——P-本地的快路径主导了一切。
- **这与 React Fiber 呼应。** 两者都协作式地调度工作（在安全点让出而非硬抢占）。跨语言对比这两个协作式调度器，能磨利对该模式的理解。

## 延伸阅读

一条从"我读过了"走向"我能在任何地方认出这些模式"的路径：

1. **先从设计注释开始** —— 运行时自己的 [proc.go 中的 G/M/P 头部注释](https://github.com/golang/go/blob/f5cdf4745455415c7a43cfc7d925214d4511489b/src/runtime/proc.go#L25-L36) 定义了该模型，并解释了*为什么*调度器状态要按 P 分布。先读这个；其余源码随后都在印证它。
2. **掌握并发模型** —— [Effective Go：Concurrency](https://go.dev/doc/effective_go#concurrency) 把 goroutine 框定为廉价的、多路复用到线程上的执行体。
3. **然后按这个顺序读源码** —— per-P 循环（[schedule](https://github.com/golang/go/blob/f5cdf4745455415c7a43cfc7d925214d4511489b/src/runtime/proc.go#L4143-L4200)）→ 空闲 P 如何再平衡（[stealWork](https://github.com/golang/go/blob/f5cdf4745455415c7a43cfc7d925214d4511489b/src/runtime/proc.go#L3836-L3903)）→ 把同一个 per-P 思想应用到内存（[sync.Pool](https://github.com/golang/go/blob/f5cdf4745455415c7a43cfc7d925214d4511489b/src/sync/pool.go#L52-L97)）。
4. **跨语言对比** —— 阅读 [React Fiber 案例研究](/zh/case-studies/react-fiber)，把它的协作式调度器与 Go 的对比。同样的模式，不同的约束（浏览器帧预算 vs. OS 线程）。
5. **练习这种识别力** —— 打开下面三个模式页，在你熟悉的另一个系统里寻找"按 P 分片、无锁快路径、罕见慢路径"。
6. **读运行时自己的笔记** —— [runtime/HACKING.md](https://github.com/golang/go/blob/f5cdf4745455415c7a43cfc7d925214d4511489b/src/runtime/HACKING.md) 文档用维护者自己的话解释了调度器的约定（P、M、work、parking）。

## 延伸学习这些模式

- [Cooperative Scheduling](/zh/patterns/cooperative-scheduling/) —— 在安全点让出
- [Work Stealing](/zh/patterns/work-stealing/) —— 空闲工人从忙碌工人处窃取
- [Object Pool](/zh/patterns/object-pool/) —— 复用而非分配
