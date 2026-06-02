# Patterns from Linux Kernel

The Linux kernel has been refined over 30+ years. These patterns have survived decades of real-world use:

| Pattern | Where in Linux | What It Does |
|---------|---------------|--------------|
| [Bitmask](/patterns/bitmask/) | `include/uapi/linux/stat.h` | File permission bits (`rwxrwxrwx`) |
| [Min Heap](/patterns/min-heap/) | CFS scheduler | Completely Fair Scheduler run queue |

## Further Reading

- [Linux Source Code (GitHub mirror)](https://github.com/torvalds/linux)
- [Linux Kernel Documentation](https://www.kernel.org/doc/html/latest/)
