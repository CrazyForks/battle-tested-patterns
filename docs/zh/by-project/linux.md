---
title: "Linux 内核中的模式"
description: "Linux 内核中的编程模式：位掩码、信号量、环形缓冲区、Trie、LRU 缓存、空闲链表、虚函数表等。"
---

# Linux 内核中的模式

Linux 内核经过 30 多年打磨，这些模式经受住了数十年在数百万设备上的真实考验。

| 模式 | Linux 中的位置 | 作用 |
|------|---------------|------|
| [位掩码](/zh/patterns/bitmask/) | [`include/uapi/linux/stat.h`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/include/uapi/linux/stat.h#L25-L33) | 文件权限位 (`rwxrwxrwx`) |
| [最小堆](/zh/patterns/min-heap/) | [`kernel/sched/fair.c` (CFS)](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/kernel/sched/fair.c#L1407-L1460) | 完全公平调度器——选择最低 vruntime 的任务 |
| [环形缓冲区](/zh/patterns/ring-buffer/) | [`include/linux/ring_buffer.h`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/include/linux/ring_buffer.h#L12-L70) | ftrace 事件记录，per-CPU 无锁缓冲区 |
| [状态机](/zh/patterns/state-machine/) | [`net/ipv4/tcp_input.c`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/net/ipv4/tcp_input.c#L4865-L4920) | TCP 连接状态机 |
| [信号量](/zh/patterns/semaphore/) | [`include/linux/semaphore.h`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/include/linux/semaphore.h#L15-L55) | 内核计数信号量 `down()`/`up()` |
| [背压](/zh/patterns/backpressure/) | [`net/ipv4/tcp_output.c`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/net/ipv4/tcp_output.c) | TCP 拥塞窗口（`cwnd`）— 流控背压 |
| [空闲链表](/zh/patterns/free-list/) | [`mm/slub.c`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/mm/slub.c#L530-L551) | SLUB slab 分配器——侵入式空闲链表，带 XOR 加固指针 |
| [Trie 前缀树](/zh/patterns/trie/) | [`net/ipv4/fib_trie.c`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/net/ipv4/fib_trie.c#L80-L120) | IP 路由表实现为压缩 trie（LC-trie） |
| [虚函数表](/zh/patterns/vtable/) | [`include/linux/fs.h`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/include/linux/fs.h#L1926-L1970) | `file_operations` 结构体——VFS 分发的函数指针虚表（`.read`、`.write`、`.open`） |
| [批处理](/zh/patterns/batch-processing/) | [`block/blk-merge.c`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/block/blk-merge.c#L350-L395) | 块层合并相邻 I/O 请求以均摊寻道时间 |
| [限流器](/zh/patterns/rate-limiter/) | [`net/sched/sch_tbf.c`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/net/sched/sch_tbf.c#L98-L114) | 内核流量控制的令牌桶过滤器 |
| [引用计数](/zh/patterns/reference-counting/) | [`lib/kobject.c`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/lib/kobject.c) | `kref` 为内核对象提供引用计数 |

## 模式如何组合：读取文件

当进程调用 `read()` 时，多个模式在同一个系统调用中协同工作：

<CompositionFlow variant="linux-read" />

"一切皆文件"的抽象之所以有效，是因为虚函数表分发让内核可以统一处理 ext4 文件、网络套接字和 `/proc` 条目。位掩码权限检查无论文件系统类型如何都只执行一次。而引用计数确保没有资源在使用中被释放——即使另一个进程删除了该文件。

## 延伸阅读

- [Linux 源码 (GitHub 镜像)](https://github.com/torvalds/linux)
- [Linux 内核文档](https://www.kernel.org/doc/html/latest/)
