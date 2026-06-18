---
title: '案例研究：Redis 如何组合三种模式在单线程上保持高速'
description: 深入剖析 Redis 如何组合事件循环、写时复制 fork 快照与 LRU 淘汰，让单线程服务器既快、又能持久化、还能限定内存——每条论断都有锁定提交的源码佐证。
---

# 案例研究：Redis 如何组合三种模式在单线程上保持高速

> **这是什么。** 大多数模式文档孤立地讲一个模式。本案例研究反其道而行：它剖析
> 一个真实系统——Redis 这个内存数据存储——如何组合**三个**模式，让一个*单线程*
> 服务器既能每秒处理数十万次操作，又能把数据快照到磁盘而不暂停，还能保持内存有界。
> 每条按模式的论断都链接到锁定提交的源码；组合论证则有 Redis 自己的文档支撑。

## Redis 解决的问题

Redis 把整个数据集放在内存里，并在**一个线程**上执行命令。这听起来像瓶颈，但
Redis 却常常胜过多线程、磁盘后端的数据库。单线程恰恰是它速度的来源：没有锁、没有
上下文切换、核心间没有缓存行争用。一条命令就是一次内存操作，而内存操作是纳秒级的。

> Redis 6+ 可以用额外线程做*网络 I/O*(读取和解析请求、写回复——`io-threads`
> 选项)。但真正修改数据的部分——**命令执行**——仍然严格单线程。本案例研究讲的
> 正是这个线程。

但单线程也是个软肋。一旦*任何事情*阻塞了这个线程——等待一个慢客户端套接字、把
数 GB 的快照写入磁盘、或扫描数百万个 key 来释放内存——*整个服务器*就会停顿。所以
Redis 真正的工程难题是：**如何在永不阻塞那唯一执行命令的线程的前提下，完成数据库
该做的一切(I/O、持久化、内存管理)？** 三个模式回答了这个问题的三个侧面。

| 问题 | 模式 | Redis 如何回答 |
|------|------|----------------|
| *一个线程如何在不被 I/O 阻塞的情况下服务上千客户端？* | **事件循环** | `aeMain` 循环，向内核(epoll/kqueue)询问哪些套接字就绪 |
| *如何把 GB 级数据快照到磁盘而不暂停命令执行？* | **写时复制** | `fork()` 出一个子进程；OS 共享内存页，只复制被修改的页 |
| *如何在不做昂贵全局扫描的情况下限定内存？* | **LRU 淘汰** | 采样若干 key，估算空闲时间，在 `maxmemory` 下淘汰最冷的 |

## 模式 1 —— 事件循环：一个线程，多个套接字

Redis 的核心是 `aeMain`：一个单一的 `while` 循环，运行到服务器停止为止。每一轮都
调用 `aeProcessEvents`，它向内核询问"我的哪些套接字就绪了？"并分发就绪的那些。

```c
void aeMain(aeEventLoop *eventLoop) {
    eventLoop->stop = 0;
    while (!eventLoop->stop) {
        aeProcessEvents(eventLoop, AE_ALL_EVENTS|
                                   AE_CALL_BEFORE_SLEEP|
                                   AE_CALL_AFTER_SLEEP);
    }
}
```

"哪些套接字就绪"这个问题由 **I/O 多路复用** 回答。在 `aeProcessEvents` 内部，
Redis 调用 `aeApiPoll`——一层对 `epoll`(Linux)、`kqueue`(BSD/macOS)或
`select` 的薄封装。这些都是操作系统提供的设施，让一个线程能同时盯住成千上万个
套接字，并阻塞到其中*任意*一个有数据为止。内核*只*在至少有一个套接字就绪时才阻塞
线程，随后返回就绪集合。线程从不空转，也从不在单个慢客户端上阻塞。

```c
int aeProcessEvents(aeEventLoop *eventLoop, int flags)
{
    int processed = 0, numevents;
    // ...
    numevents = aeApiPoll(eventLoop, tvp);  // epoll/kqueue: who's ready?
    // ...dispatch each ready fd to its handler...
}
```

::: tip 心智模型
想象整个餐厅只有一个服务员。他不会站在一桌前等它吃完(阻塞)，而是扫视*所有*桌，
只走向那些举手的桌。`aeApiPoll` 就是那次扫视；内核负责"举手"。一个线程能服务所有人，
正是因为它从不为任何单独一桌干等。
:::

→ 单独看这个模式，见 [事件循环](/zh/patterns/event-loop/)。

## 模式 2 —— 写时复制：不暂停就能快照

Redis 通过把内存快照到 `.rdb` 文件来持久化。把数 GB 写入磁盘要花几秒——对命令线程
而言是一个世纪。阻塞它会冻结所有客户端。Redis 的答案是*根本不从主线程写*：它调用
`fork()`，让**子进程**写快照，而**父进程**继续服务命令。

```c
int rdbSaveBackground(int req, char *filename, rdbSaveInfo *rsi, int rdbflags) {
    pid_t childpid;
    // ...
    if ((childpid = redisFork(CHILD_TYPE_RDB)) == 0) {
        /* Child */
        int retval = rdbSave(req, filename, rsi, rdbflags);
        if (retval == C_OK) {
            sendChildCowInfo(CHILD_INFO_TYPE_RDB_COW_SIZE, "RDB");
        }
        exitFromChild((retval == C_OK) ? 0 : 1);
    } else {
        /* Parent keeps serving clients... */
    }
}
```

奥妙在于 OS 提供的**写时复制**。`redisFork()`(对 `fork()` 系统调用的薄封装)
*不*复制数据集；父子进程共享同一批物理内存页，标记为只读。子进程读这些页来写快照。
只有当父进程*修改*某个 key 时，内核才复制那一个页——于是 Redis 会跟踪有多少页被
复制，并报告为 `RDB_COW_SIZE`，这是衡量保存期间数据集改动量的有用信号。对一个
10 GB 数据集的快照在微秒内就启动，且只复制保存期间发生变化的那些页，而不是全部
10 GB。

::: tip 心智模型
`fork()` 并不给子进程一份真正的内存拷贝——它给的是*同一批*页，共享且被冻结为只读。
子进程从容地把这些共享页写到磁盘；而父进程一旦修改某个 key，内核就悄悄复制那一个页，
好让子进程仍看到旧值。命令线程从不为 I/O 暂停。
:::

→ 单独看这个模式，见 [写时复制](/zh/patterns/copy-on-write/)。

## 模式 3 —— LRU 淘汰：不做全局扫描就能限定内存

RAM 是有限的。当配置了淘汰策略、且 Redis 触及 `maxmemory` 上限时，必须先释放空间
才能接受新写入。(默认策略是 `noeviction`，此时它只会以错误拒绝写入；但当设置了
`allkeys-lru` 这类策略时，Redis 就必须淘汰。)它承担不起把*所有* key 按访问时间
排序(那是 O(n) 且会阻塞线程)。于是它改为**采样**：挑出一小撮 key，估算每个空闲了
多久，淘汰最冷的。

```c
int performEvictions(void) {
    if (!isSafeToPerformEvictions()) return EVICT_OK;
    int keys_freed = 0;
    size_t mem_reported, mem_tofree;
    // ...while over maxmemory: sample keys into a pool, evict the best candidate...
}
```

"这个 key 有多冷"这个问题用**近似 LRU 时钟**回答。每个对象存一个粗粒度时间戳；
`estimateObjectIdleTime` 用一个全局时钟减去它来估算空闲时间——热路径上无需逐次访问
记账，也无需维护链表。(这个全局时钟是一个定宽计数器，会绕回到零，所以下面的
`else` 分支处理的是回绕的情况。)

```c
unsigned long long estimateObjectIdleTime(robj *o) {
    unsigned long long lruclock = LRU_CLOCK();
    if (lruclock >= o->lru) {
        return (lruclock - o->lru) * LRU_CLOCK_RESOLUTION;
    } else {
        return (lruclock + (LRU_CLOCK_MAX - o->lru)) *
                    LRU_CLOCK_RESOLUTION;
    }
}
```

Redis 用精确性换速度：它不保证淘汰*全局*最冷的 key，只保证从一个小样本里淘汰一个
*非常冷*的。默认采样若干 key，外加一个跨调用保留的最佳候选池，这种近似已经很接近
真正的 LRU——而每次淘汰是 O(1) 而非 O(n)。

::: tip 心智模型
真正的 LRU 维护一个有序链表，每次访问都要付出代价。Redis 则随手抓一把随机 key，
淘汰*这些里面*最冷的。这就像清理桌面时瞥一眼随机五张纸、扔掉积灰最多的那张——不完美，
但快，而且在大规模下足够好。采样把 O(n) 的排序变成了 O(1) 的活儿。
:::

→ 单独看这个模式，见 [LRU 缓存](/zh/patterns/lru-cache/)。

## 三者如何组合

这些模式每一个都为了保护*同一个*稀缺资源：那唯一的命令线程。它们在三条不同战线上
守护它。

```text
            ┌──────────────────────────────────────────────┐
            │           the one command thread             │
            └──────────────────────────────────────────────┘
                 ▲                ▲                  ▲
   I/O won't ────┘   persistence ─┘    memory growth ┘ won't
   block it:         won't block it:    block it:
   EVENT LOOP        COPY-ON-WRITE      LRU EVICTION
   (aeApiPoll waits  (fork(): child     (sample + evict,
    in the kernel,    writes snapshot;   O(1), never an
    never on one      parent keeps       O(n) global scan)
    slow socket)      serving)
```

1. **事件循环**把 *I/O* 挡在关键路径之外：线程在内核里阻塞，等待*任意*就绪的套接字，
   而非某个慢客户端。
2. **写时复制**把*持久化*挡在关键路径之外：fork 出的子进程对着一张廉价的、共享页的
   内存定格照片写快照，父线程则继续执行命令。
3. **LRU 淘汰**把*内存管理*挡在关键路径之外：采样让"释放一些内存"成为 O(1) 操作，
   而非会拖停线程的 O(n) 扫描。

统一的思想是**永不阻塞那唯一的线程**。单线程执行正是 Redis 快的原因(无锁、无争用)，
但它能成立的前提是：每一个潜在的慢操作要么被*委派*(I/O 交给内核、快照交给子进程)，
要么被*近似*(淘汰用采样而非排序)。去掉任何一个，模型就崩了：没有事件循环，一个慢
套接字会冻结所有人；没有 COW，每次保存都会暂停服务器数秒；没有采样淘汰，当淘汰
策略触及 `maxmemory` 时会触发拖停命令的 O(n) 扫描。

::: info 架构层面的推断
把这些模式诠释为一个*刻意组合*的设计——以"保护单线程"为统一主线——依据的是 Redis
自己的文档(见延伸阅读)，而非任何单个源文件。按模式的代码链接是直接的源码证据；
"按设计组合"这一论断由那些设计层面的材料支撑。
:::

## 生产验证

所有源码链接都锁定到 Redis 提交
`e91a340e241cf0abe3c6a0c254214fbe4aa1d95f`(标签 `8.0.0`)。按模式的论断是
`source-code`(L1)；组合关系由官方文档(`official-doc`)支撑。

| 模式 / 论断 | 来源 | 证据 | 在 Redis 中的角色 |
|-------------|------|------|-------------------|
| 事件循环 | [ae.c#L492-L499](https://github.com/redis/redis/blob/e91a340e241cf0abe3c6a0c254214fbe4aa1d95f/src/ae.c#L492-L499) | source-code | `aeMain`——驱动整个服务器的那个单一 `while` 循环 |
| 事件循环(I/O 多路复用) | [ae.c#L360-L398](https://github.com/redis/redis/blob/e91a340e241cf0abe3c6a0c254214fbe4aa1d95f/src/ae.c#L360-L398) | source-code | `aeProcessEvents` 调用 `aeApiPoll`(epoll/kqueue)找出就绪套接字 |
| 写时复制 | [rdb.c#L1642-L1662](https://github.com/redis/redis/blob/e91a340e241cf0abe3c6a0c254214fbe4aa1d95f/src/rdb.c#L1642-L1662) | source-code | `rdbSaveBackground`——`redisFork()` 让子进程借 OS 写时复制做快照 |
| LRU 淘汰 | [evict.c#L521-L530](https://github.com/redis/redis/blob/e91a340e241cf0abe3c6a0c254214fbe4aa1d95f/src/evict.c#L521-L530) | source-code | `performEvictions`——在 `maxmemory` 下通过采样候选释放内存 |
| LRU 淘汰(空闲估算) | [evict.c#L73-L79](https://github.com/redis/redis/blob/e91a340e241cf0abe3c6a0c254214fbe4aa1d95f/src/evict.c#L73-L79) | source-code | `estimateObjectIdleTime`——用对象上粗粒度时钟近似 LRU |
| 单线程设计 | [Redis FAQ — single threaded](https://redis.io/docs/latest/develop/reference/faq/) | official-doc | 官方解释为何命令执行是单线程的 |

## 要点

- **模式很少单独出现。** 在单线程上保持高速需要同时用到一个 *I/O* 模式(事件循环)、
  一个*持久化*模式(写时复制)和一个*内存*模式(LRU 淘汰)——每一个都消除了线程可能
  被阻塞的一种途径。
- **一个约束能统一整个系统。** "永不阻塞单线程"是把 I/O 委派给内核、把快照委派给
  子进程、把淘汰交给采样这三件事背后的同一原则。在三个子系统背后认出同一个思想，
  正是深度读源码的回报。
- **要么委派、要么近似——别阻塞。** 慢活儿要么被交出去(I/O 交给内核、保存交给 fork
  出的子进程)，要么靠近似变廉价(采样淘汰)。Redis 快是因为线程总有*此刻*就能做的事。
- **这呼应了 Node.js。** 两者都建立在基于 epoll/kqueue 的单线程事件循环之上。把
  Redis(一个数据库)与 Node(一个运行时)对比，能看到同一个 reactor 模式在解决不同
  问题。

## 延伸阅读

一条从"我读过这个"到"我能在任何地方认出这些模式"的路径：

1. **先理解模型**——
   [Redis 关于单线程的 FAQ](https://redis.io/docs/latest/develop/reference/faq/)
   解释了*为何*命令执行用一个线程，这是其他一切所保护的前提。先读这个；源码随后
   会展示*如何*保护它。
2. **理解持久化**——
   [Redis 持久化文档](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)
   描述了 RDB 快照，以及为何由 fork 出的子进程(写时复制)来负责写入。
3. **理解淘汰**——
   [key 淘汰文档](https://redis.io/docs/latest/develop/reference/eviction/)
   涵盖了 `maxmemory`、LRU/LFU 策略以及采样近似。
4. **然后按这个顺序读源码**——循环
   ([aeMain](https://github.com/redis/redis/blob/e91a340e241cf0abe3c6a0c254214fbe4aa1d95f/src/ae.c#L492-L499))
   → 快照 fork
   ([rdbSaveBackground](https://github.com/redis/redis/blob/e91a340e241cf0abe3c6a0c254214fbe4aa1d95f/src/rdb.c#L1642-L1662))
   → 内存限定
   ([performEvictions](https://github.com/redis/redis/blob/e91a340e241cf0abe3c6a0c254214fbe4aa1d95f/src/evict.c#L521-L530))。
5. **跨系统对比**——读 [Node.js 请求案例研究](/zh/case-studies/nodejs-request)，
   把它的事件循环和 Redis 的对比。同一个 reactor 模式，不同用途(一个服务回调的运行时
   vs. 一个服务命令的数据库)。
6. **练习辨认**——打开下面三个模式页，在另一个系统里寻找"把慢活儿委派出去、保持热
   路径空闲"的影子。

## 延伸学习这些模式

- [事件循环](/zh/patterns/event-loop/) —— 一个线程靠多路复用服务多个套接字
- [写时复制](/zh/patterns/copy-on-write/) —— 共享页，仅在修改时复制
- [LRU 缓存](/zh/patterns/lru-cache/) —— 淘汰最冷的，用采样做近似
