# Linux 内核中的模式

Linux 内核经过 30 多年打磨，这些模式经受住了数十年在数百万设备上的真实考验。

| 模式 | Linux 中的位置 | 作用 |
|------|---------------|------|
| [位掩码](/zh/patterns/bitmask/) | `include/uapi/linux/stat.h` | 文件权限位 (`rwxrwxrwx`) |
| [最小堆](/zh/patterns/min-heap/) | `kernel/sched/fair.c` (CFS) | 完全公平调度器——选择最低 vruntime 的任务 |
| [环形缓冲区](/zh/patterns/ring-buffer/) | `include/linux/ring_buffer.h` | ftrace 事件记录，per-CPU 无锁缓冲区 |
| [状态机](/zh/patterns/state-machine/) | `net/ipv4/tcp_input.c` | TCP 连接状态机 |
| [信号量](/zh/patterns/semaphore/) | `include/linux/semaphore.h` | 内核计数信号量 `down()`/`up()` |
| [背压](/zh/patterns/backpressure/) | `net/ipv4/tcp_output.c` | TCP 拥塞窗口（`cwnd`）— 流控背压 |
| [空闲链表](/zh/patterns/free-list/) | `mm/slub.c` | SLUB slab 分配器——侵入式空闲链表，带 XOR 加固指针 |
| [Trie 前缀树](/zh/patterns/trie/) | `net/ipv4/fib_trie.c` | IP 路由表实现为压缩 trie（LC-trie） |
| [虚函数表](/zh/patterns/vtable/) | `include/linux/fs.h` | `file_operations` 结构体——VFS 分发的函数指针虚表（`.read`、`.write`、`.open`） |

## 延伸阅读

- [Linux 源码 (GitHub 镜像)](https://github.com/torvalds/linux)
- [Linux 内核文档](https://www.kernel.org/doc/html/latest/)
