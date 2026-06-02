# Patterns from Go

Go's runtime and standard library demonstrate clean, practical pattern implementations.

| Pattern | Where in Go | What It Does |
|---------|------------|--------------|
| [Cooperative Scheduling](/patterns/cooperative-scheduling/) | `runtime/proc.go` | Goroutine scheduling with cooperative preemption points |
| [Bitmask](/patterns/bitmask/) | `os/types.go` | `FileMode` — Unix permission flags via typed constants with `iota` |
| [Object Pool](/patterns/object-pool/) | `sync/pool.go` | `sync.Pool` — per-P local pools with lock-free fast path, used in `fmt`, `encoding/json` |

## Further Reading

- [Go Source Code (GitHub)](https://github.com/golang/go)
- [Go Runtime Package Docs](https://pkg.go.dev/runtime)
