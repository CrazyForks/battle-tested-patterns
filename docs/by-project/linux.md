---
title: "Patterns from Linux Kernel"
description: "Programming patterns from the Linux kernel: bitmask, semaphore, ring buffer, trie, LRU cache, free list, vtable, and more."
---

# Patterns from Linux Kernel

The Linux kernel has been refined over 30+ years. These patterns have survived decades of real-world use across millions of devices.

| Pattern | Where in Linux | What It Does |
|---------|---------------|--------------|
| [Bitmask](/patterns/bitmask/) | [`include/uapi/linux/stat.h`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/include/uapi/linux/stat.h#L25-L33) | File permission bits (`rwxrwxrwx`) |
| [Min Heap](/patterns/min-heap/) | [`kernel/sched/fair.c` (CFS)](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/kernel/sched/fair.c#L1407-L1460) | Completely Fair Scheduler — pick task with lowest vruntime |
| [Ring Buffer](/patterns/ring-buffer/) | [`include/linux/ring_buffer.h`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/include/linux/ring_buffer.h#L12-L70) | ftrace event logging, per-CPU lock-free buffers |
| [State Machine](/patterns/state-machine/) | [`net/ipv4/tcp_input.c`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/net/ipv4/tcp_input.c#L4865-L4920) | TCP connection state machine (SYN_SENT → ESTABLISHED → FIN_WAIT) |
| [Semaphore](/patterns/semaphore/) | [`include/linux/semaphore.h`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/include/linux/semaphore.h#L15-L55) | Kernel counting semaphore with `down()`/`up()` |
| [Backpressure](/patterns/backpressure/) | [`net/ipv4/tcp_output.c`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/net/ipv4/tcp_output.c) | TCP congestion window (`cwnd`) — flow control backpressure |
| [Free List](/patterns/free-list/) | [`mm/slub.c`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/mm/slub.c#L530-L551) | SLUB slab allocator — intrusive free list with XOR-hardened pointers |
| [Trie](/patterns/trie/) | [`net/ipv4/fib_trie.c`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/net/ipv4/fib_trie.c#L80-L120) | IP routing table as a compressed trie (LC-trie) |
| [Vtable](/patterns/vtable/) | [`include/linux/fs.h`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/include/linux/fs.h#L1926-L1970) | `file_operations` struct — function pointer vtable for VFS dispatch (`.read`, `.write`, `.open`) |
| [Batch Processing](/patterns/batch-processing/) | [`block/blk-merge.c`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/block/blk-merge.c#L350-L395) | Block layer merges adjacent I/O requests to amortize seek time |
| [Rate Limiter](/patterns/rate-limiter/) | [`net/sched/sch_tbf.c`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/net/sched/sch_tbf.c#L98-L114) | Token bucket filter for kernel traffic control |
| [Reference Counting](/patterns/reference-counting/) | [`lib/kobject.c`](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/lib/kobject.c) | `kref` provides reference counting for kernel objects |

## How They Compose: Reading a File

When a process calls `read()`, multiple patterns activate in a single syscall:

<CompositionFlow variant="linux-read" />

The "everything is a file" abstraction works because vtable dispatch lets the kernel treat ext4 files, network sockets, and `/proc` entries identically. The bitmask permission check happens once regardless of filesystem type. And reference counting ensures no resource is freed while in use — even if another process deletes the file.

## Further Reading

- [Linux Source Code (GitHub mirror)](https://github.com/torvalds/linux)
- [Linux Kernel Documentation](https://www.kernel.org/doc/html/latest/)
