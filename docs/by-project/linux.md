# Patterns from Linux Kernel

The Linux kernel has been refined over 30+ years. These patterns have survived decades of real-world use across millions of devices.

| Pattern | Where in Linux | What It Does |
|---------|---------------|--------------|
| [Bitmask](/patterns/bitmask/) | [`include/uapi/linux/stat.h`](https://github.com/torvalds/linux/blob/master/include/uapi/linux/stat.h#L25-L33) | File permission bits (`rwxrwxrwx`) |
| [Min Heap](/patterns/min-heap/) | [`kernel/sched/fair.c` (CFS)](https://github.com/torvalds/linux/blob/master/kernel/sched/fair.c#L1407-L1460) | Completely Fair Scheduler — pick task with lowest vruntime |
| [Ring Buffer](/patterns/ring-buffer/) | [`include/linux/ring_buffer.h`](https://github.com/torvalds/linux/blob/master/include/linux/ring_buffer.h#L12-L70) | ftrace event logging, per-CPU lock-free buffers |
| [State Machine](/patterns/state-machine/) | [`net/ipv4/tcp_input.c`](https://github.com/torvalds/linux/blob/master/net/ipv4/tcp_input.c#L4865-L4920) | TCP connection state machine (SYN_SENT → ESTABLISHED → FIN_WAIT) |
| [Semaphore](/patterns/semaphore/) | [`include/linux/semaphore.h`](https://github.com/torvalds/linux/blob/master/include/linux/semaphore.h#L15-L55) | Kernel counting semaphore with `down()`/`up()` |
| [Backpressure](/patterns/backpressure/) | [`net/ipv4/tcp_output.c`](https://github.com/torvalds/linux/blob/master/net/ipv4/tcp_output.c) | TCP congestion window (`cwnd`) — flow control backpressure |
| [Free List](/patterns/free-list/) | [`mm/slub.c`](https://github.com/torvalds/linux/blob/master/mm/slub.c#L530-L551) | SLUB slab allocator — intrusive free list with XOR-hardened pointers |
| [Trie](/patterns/trie/) | [`net/ipv4/fib_trie.c`](https://github.com/torvalds/linux/blob/master/net/ipv4/fib_trie.c#L80-L120) | IP routing table as a compressed trie (LC-trie) |
| [Vtable](/patterns/vtable/) | [`include/linux/fs.h`](https://github.com/torvalds/linux/blob/master/include/linux/fs.h#L2093-L2163) | `file_operations` struct — function pointer vtable for VFS dispatch (`.read`, `.write`, `.open`) |
| [Batch Processing](/patterns/batch-processing/) | [`block/blk-merge.c`](https://github.com/torvalds/linux/blob/master/block/blk-merge.c#L350-L395) | Block layer merges adjacent I/O requests to amortize seek time |
| [Rate Limiter](/patterns/rate-limiter/) | [`net/sched/sch_tbf.c`](https://github.com/torvalds/linux/blob/master/net/sched/sch_tbf.c#L98-L114) | Token bucket filter for kernel traffic control |
| [Reference Counting](/patterns/reference-counting/) | [`lib/kobject.c`](https://github.com/torvalds/linux/blob/master/lib/kobject.c) | `kref` provides reference counting for kernel objects |

## Further Reading

- [Linux Source Code (GitHub mirror)](https://github.com/torvalds/linux)
- [Linux Kernel Documentation](https://www.kernel.org/doc/html/latest/)
