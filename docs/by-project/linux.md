# Patterns from Linux Kernel

The Linux kernel has been refined over 30+ years. These patterns have survived decades of real-world use across millions of devices.

| Pattern | Where in Linux | What It Does |
|---------|---------------|--------------|
| [Bitmask](/patterns/bitmask/) | `include/uapi/linux/stat.h` | File permission bits (`rwxrwxrwx`) |
| [Min Heap](/patterns/min-heap/) | `kernel/sched/fair.c` (CFS) | Completely Fair Scheduler — pick task with lowest vruntime |
| [Ring Buffer](/patterns/ring-buffer/) | `include/linux/ring_buffer.h` | ftrace event logging, per-CPU lock-free buffers |
| [State Machine](/patterns/state-machine/) | `net/ipv4/tcp_input.c` | TCP connection state machine (SYN_SENT → ESTABLISHED → FIN_WAIT) |

## Further Reading

- [Linux Source Code (GitHub mirror)](https://github.com/torvalds/linux)
- [Linux Kernel Documentation](https://www.kernel.org/doc/html/latest/)
