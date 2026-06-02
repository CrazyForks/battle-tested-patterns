# Patterns from Go Runtime

Go's runtime is written in Go and assembly, implementing sophisticated scheduling and memory management:

| Pattern | Where in Go | What It Does |
|---------|------------|--------------|
| [Cooperative Scheduling](/patterns/cooperative-scheduling/) | `runtime/proc.go` | Goroutine scheduling with preemption points |

## Further Reading

- [Go Source Code (GitHub)](https://github.com/golang/go)
- [Go Runtime Package Docs](https://pkg.go.dev/runtime)
