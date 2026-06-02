# Linux 内核中的模式

Linux 内核经过 30 多年打磨，这些模式经受住了数十年在数百万设备上的真实考验。

| 模式 | Linux 中的位置 | 作用 |
|------|---------------|------|
| [位掩码](/zh/patterns/bitmask/) | `include/uapi/linux/stat.h` | 文件权限位 (`rwxrwxrwx`) |
| [最小堆](/zh/patterns/min-heap/) | `kernel/sched/fair.c` (CFS) | 完全公平调度器——选择最低 vruntime 的任务 |
| [环形缓冲区](/zh/patterns/ring-buffer/) | `include/linux/ring_buffer.h` | ftrace 事件记录，per-CPU 无锁缓冲区 |
| [状态机](/zh/patterns/state-machine/) | `net/ipv4/tcp_input.c` | TCP 连接状态机 |

## 延伸阅读

- [Linux 源码 (GitHub 镜像)](https://github.com/torvalds/linux)
- [Linux 内核文档](https://www.kernel.org/doc/html/latest/)
