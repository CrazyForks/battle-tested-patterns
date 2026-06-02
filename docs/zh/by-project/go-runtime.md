# Go 中的模式

Go 的运行时和标准库展示了干净、实用的模式实现。

| 模式 | Go 中的位置 | 作用 |
|------|------------|------|
| [协作调度](/zh/patterns/cooperative-scheduling/) | `runtime/proc.go` | 带协作抢占点的 goroutine 调度 |
| [位掩码](/zh/patterns/bitmask/) | `os/types.go` | `FileMode` — 通过 `iota` 类型常量实现的 Unix 权限标志 |
| [对象池](/zh/patterns/object-pool/) | `sync/pool.go` | `sync.Pool` — per-P 本地池，无锁快速路径，广泛用于 `fmt`、`encoding/json` |

## 延伸阅读

- [Go 源码 (GitHub)](https://github.com/golang/go)
- [Go Runtime 包文档](https://pkg.go.dev/runtime)
