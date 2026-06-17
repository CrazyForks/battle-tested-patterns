---
title: '案例研究：Node.js 如何组合三种模式来服务一个请求'
description: 深入剖析 Node.js 如何通过组合 libuv 的事件循环、EventEmitter 观察者与流的背压来处理一个 HTTP 请求——每一处论断都由固定 commit 上的源码佐证。
---

# 案例研究：Node.js 如何组合三种模式来服务一个请求

> **这是什么。** 大多数模式文档孤立地讲解一个模式。本案例研究反其道而行：它剖析单个真实系统——Node.js——如何组合 **三种** 模式，使单个线程能在不阻塞的前提下服务成千上万个并发 HTTP 连接、在数据到达时通知代码、并避免用数据淹没一个慢速客户端。每一处针对单个模式的论断都链接到固定 commit 上的源码；组合关系的论证则由 Node 与 libuv 自己的文档支撑。

## Node.js 解决的问题

一个服务器必须同时处理许多连接。经典答案——每连接一个线程（或进程）——为每个客户端付出一个栈和一个内核调度槽，所以到几千连接就不再 scale。Node.js 下了相反的赌注：**一个线程，永不阻塞**。这个单线程必须：

- **同时等待成千上万个套接字**，而不为每个分配一个线程，并仅在某个真正就绪时被唤醒；
- 在不让代码轮询的前提下，**告诉应用代码**"数据到了"/"请求结束"/"响应完成"；
- **不让快的生产者压垮慢的消费者**——如果一个客户端读得慢，服务器必须停止在内存里无限缓冲数据。

要同时做到这三点，需要三种模式协同工作。它们单独看都不新颖——真正有启发性的是*它们如何组合*。

| 问题 | 模式 | Node 如何回答 |
|----------|---------|---------------------|
| *一个线程如何等待成千上万个套接字？* | **事件循环** | libuv 的 `uv_run` 轮询 OS（epoll/kqueue）并分发就绪事件 |
| *代码如何得知一个事件发生了？* | **观察者** | `EventEmitter.emit` 调用每个已注册的监听器（`'data'`、`'end'`…） |
| *如何不压垮慢的消费者？* | **背压** | `writeOrBuffer` 超过 `highWaterMark` 时返回 `false`；调用方等待 `'drain'` |

## 模式 1 —— 事件循环：一个线程，多个套接字

Node 的核心是 libuv 的 `uv_run`：一个循环，它问 OS"这成千上万个文件描述符里哪些就绪了？"（Linux 上经 `epoll`，macOS 上经 `kqueue`），运行就绪者的回调，然后再次循环。没有任何描述符获得一个线程；线程仅阻塞在那*一次* poll 调用里。

```c
int uv_run(uv_loop_t* loop, uv_run_mode mode) {
  /* ...setup... */
  while (r != 0 && loop->stop_flag == 0) {
    uv__run_timers(loop);
    /* ...run pending, idle, prepare handles... */
    uv__io_poll(loop, timeout);   // ← block here on epoll/kqueue until ready
    /* ...run check & close handles... */
    r = uv__loop_alive(loop);
  }
  return r;
}
```

这个循环（对一个服务器而言）永远运行，且**仅**阻塞在 `uv__io_poll` 里。当一个套接字有字节时，`epoll` 返回，libuv 运行那个套接字的回调，线程继续前进。空闲连接几乎不耗成本——它们只是内核正在监视的文件描述符。

::: tip 心智模型
事件循环是服务满座餐厅的单个服务员。不是每桌一个服务员（每连接一个线程），而是一个服务员绕着房间走，只在举手的桌子（就绪的套接字）前停下。"举手"是 `epoll`；"绕圈"是 `while` 循环。空闲的桌子不耗服务员任何成本。
:::

→ 单独了解该模式，见 [Event Loop](/zh/patterns/event-loop/)。

## 模式 2 —— 观察者：把就绪转成回调

事件循环知道一个套接字*就绪了*，但应用代码想说"当一个请求 emit 数据时，运行我的处理器"。Node 用**观察者**模式把两者桥接起来：`EventEmitter`。一个套接字/请求是一个 emitter；你的代码注册监听器；当循环送来就绪信号，emitter 通过 `emit` 调用每个监听器。

```js
EventEmitter.prototype.emit = function emit(type, ...args) {
  // ...special-case 'error'...
  const handler = events[type];
  if (handler === undefined) return false;
  // call each registered listener with the event's args
  // (single listener fast path, or loop over the array)
};
```

这正是 `req.on('data', …)`、`req.on('end', …)`、`res.on('finish', …)` 所挂靠的东西：HTTP 层把底层套接字的就绪转成具名事件，`emit` 再把它们扇出给监听器。把生产者（套接字）与消费者（你的处理器）解耦，正是观察者模式的职责。

::: tip 心智模型
`EventEmitter` 是一张订阅清单。套接字不知道谁在听；它只是喊一声 `emit('data', chunk)`，所有用 `on('data', …)` 订阅过的人都听见。随意增删监听器——emitter 既不知道也不在乎。正是这种解耦，让 Node 的整个 I/O 表面都是事件驱动的。
:::

→ 单独了解该模式，见 [Observer](/zh/patterns/observer/)。

## 模式 3 —— 背压：别跑赢慢的消费者

一个响应（`res`）是一个可写流。如果你的处理器产生数据的速度快过客户端能接收的速度（一个慢速移动连接在下载一个大文件），朴素地全部缓冲会撑爆内存。Node 的可写流实现了**背压**：`writeOrBuffer` 跟踪排队了多少，一旦越过 `highWaterMark`，就返回 `false` 来告诉调用方"停下来等等"。

```js
function writeOrBuffer(stream, state, chunk, encoding, callback) {
  const len = (state[kState] & kObjectMode) !== 0 ? 1 : chunk.length;
  state.length += len;
  // ...buffer the chunk if the stream is busy, else write through...
  const ret = state.length < state.highWaterMark;
  // ret === false  →  caller should wait for the 'drain' event
  return ret;
}
```

调用方被要求尊重这个信号：当 `write()` 返回 `false` 时，停止写入并等待 `'drain'` 事件再继续。正是这个契约，让一个快服务器和一个慢客户端在不引起无限内存增长的前提下保持平衡。

::: tip 心智模型
背压是柜台上的一块"请稍候"牌子。`write()` 返回 `false` 意味着"我的队列满了——在我喊 `'drain'` 之前别再给我活儿"。一个守规矩的生产者会等；无视这块牌子，就会把数据一直堆进内存直到进程死掉。`highWaterMark` 只是这块牌子翻起来的那个点。
:::

→ 单独了解该模式，见 [Backpressure](/zh/patterns/backpressure/)。

## 三者如何组合

服务一个 HTTP 请求，三个模式以一个循环交接：

1. **事件循环**（`uv_run`）阻塞在 `epoll` 里，直到客户端套接字有字节，然后运行该套接字的回调——没有线程被花在等待上。
2. **观察者**（`emit`）把那次就绪转成具名事件：请求流（`IncomingMessage`，一个由 `llhttp` 解析器驱动的 Readable）emit `'data'` 和 `'end'`，你的 `on(...)` 监听器随之运行。
3. **背压**（`writeOrBuffer`）治理回复：当客户端慢时 `res.write()` 返回 `false`，于是处理器暂停直到 `'drain'`——而那个 `'drain'` 本身也是由循环经 emitter 送达的一个事件。

```text
client socket ready
        │  (event loop: uv__io_poll wakes on epoll/kqueue)
        ▼
   run socket callback ──► HTTP parser
        │  (observer: emit('data'/'end') → your req.on(...) listeners)
        ▼
   handler writes response (res.write)
        │  (backpressure: writeOrBuffer returns false past highWaterMark)
        ▼
   wait for 'drain'  ◄── delivered as an event by the loop + emitter, looping back
```

统一这一切的思想是 **一个完全由事件驱动的单线程**：循环决定*何时*运行代码（仅在就绪时），观察者决定*什么*代码运行（具名事件的监听器），背压决定数据*能多快*流动（满了就暂停、`'drain'` 就恢复）。去掉其中任意一个它都会崩塌：没有循环，你就退回到每连接一个线程；没有观察者，循环就没有办法触及应用代码；没有背压，一个慢客户端就能耗尽服务器的内存。

::: info 架构推断
把这三者描述为一个*有意组合*的事件驱动设计，依据的是 Node 与 libuv 自己的文档（见延伸阅读），而非任何单个源码文件。针对单个模式的代码链接是直接的源码证据；而"被有意组合在一起"这一论断，由那些设计层级的材料支撑。
:::

## 生产验证

源码链接均固定到 Node.js commit `19c46abbefdb8711b913d7237b3c1299367f87d7`（libuv 代码位于 `deps/uv` 下）。针对单个模式的论断属于 `source-code`（L1）；组合关系则由官方文档（`official-doc`）支撑。

| 模式 / 论断 | 来源 | 证据类型 | 在服务一个请求中的角色 |
|-----------------|--------|----------|---------------------------|
| 事件循环 | [core.c#L427-L492](https://github.com/nodejs/node/blob/19c46abbefdb8711b913d7237b3c1299367f87d7/deps/uv/src/unix/core.c#L427-L492) | source-code | `uv_run`——阻塞在 `uv__io_poll`（epoll/kqueue）并分发就绪事件的循环 |
| 观察者 | [events.js#L456-L520](https://github.com/nodejs/node/blob/19c46abbefdb8711b913d7237b3c1299367f87d7/lib/events.js#L456-L520) | source-code | `EventEmitter.prototype.emit`——把一个事件扇出给每个已注册监听器 |
| 背压 | [writable.js#L548-L585](https://github.com/nodejs/node/blob/19c46abbefdb8711b913d7237b3c1299367f87d7/lib/internal/streams/writable.js#L548-L585) | source-code | `writeOrBuffer`——超过 `highWaterMark` 时返回 `false`，示意调用方等待 `'drain'` |
| 组合（有意为之） | [Node.js Stream docs](https://nodejs.org/api/stream.html) | official-doc | 官方对流、`'drain'` 契约与事件驱动 I/O 模型的解释 |
| 组合（有意为之） | [libuv design overview](https://docs.libuv.org/en/v1.x/design.html) | official-doc | libuv 自己对事件循环以及 I/O 如何被多路复用的描述 |

## 要点

- **模式很少单独出现。** 服务一个请求同时需要一个*调度*模式（事件循环）、一个*通知*模式（观察者）和一个*流控*模式（背压）——而且它们以一个循环、而非一条直线交接。
- **一个线程 + 事件，胜过每连接一个线程。** Node 能 scale 到许多连接，不是靠把活儿干得更快，而是靠永不阻塞它仅有的那个线程——空闲套接字是免费的。
- **背压是一个契约，不是魔法。** `write()` 返回 `false` 只有在调用方等待 `'drain'` 时才有用。无视它，只是把"每连接一个线程"的问题换成了一个内存耗尽的问题。
- **这与 React Fiber 和 Go 的案例呼应。** 三者都是协作式、事件/循环驱动的调度器；对比各自如何让出与恢复，能跨越非常不同的运行时磨利对该模式的理解。

## 延伸阅读

一条从"我读过了"走向"我能在任何地方认出这些模式"的路径：

1. **先从循环的设计开始** —— libuv 的 [design overview](https://docs.libuv.org/en/v1.x/design.html) 解释了事件循环、I/O poll 阶段和线程池。先读这个；`uv_run` 源码随后都在印证它。
2. **掌握流 + 背压契约** —— Node 官方的 [Backpressuring in Streams](https://nodejs.org/en/learn/modules/backpressuring-in-streams) 指南与 [Stream API 文档](https://nodejs.org/api/stream.html) 解释了 `write()` 返回 `false` 与 `'drain'` 事件。
3. **然后按这个顺序读源码** —— 循环（[uv_run](https://github.com/nodejs/node/blob/19c46abbefdb8711b913d7237b3c1299367f87d7/deps/uv/src/unix/core.c#L427-L492)）→ 就绪如何变成回调（[emit](https://github.com/nodejs/node/blob/19c46abbefdb8711b913d7237b3c1299367f87d7/lib/events.js#L456-L520)）→ 写入如何被节流（[writeOrBuffer](https://github.com/nodejs/node/blob/19c46abbefdb8711b913d7237b3c1299367f87d7/lib/internal/streams/writable.js#L548-L585)）。
4. **跨运行时对比** —— 阅读 [Go 调度器](/zh/case-studies/go-scheduler) 与 [React Fiber](/zh/case-studies/react-fiber) 两篇案例；三者都是事件/循环驱动的协作式调度器，只是约束不同。
5. **练习这种识别力** —— 打开下面三个模式页，在你熟悉的另一个系统里寻找"一个循环轮询就绪""向订阅者 emit""满了就暂停、drain 就恢复"。

## 延伸学习这些模式

- [Event Loop](/zh/patterns/event-loop/) —— 一个线程轮询许多来源
- [Observer](/zh/patterns/observer/) —— 向解耦的订阅者 emit 事件
- [Backpressure](/zh/patterns/backpressure/) —— 为慢消费者暂停快生产者
