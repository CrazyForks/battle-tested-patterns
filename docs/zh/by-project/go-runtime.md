---
description: "Go 运行时模式：工作窃取、对象池、协作调度、信号量、空闲链表、享元和 Arena 分配器。"
---

# Go 中的模式

Go 的运行时和标准库展示了干净、实用的模式实现。

| 模式 | Go 中的位置 | 作用 |
|------|------------|------|
| [协作调度](/zh/patterns/cooperative-scheduling/) | [`runtime/proc.go`](https://github.com/golang/go/blob/master/src/runtime/proc.go#L4143-L4200) | 带协作抢占点的 goroutine 调度 |
| [位掩码](/zh/patterns/bitmask/) | [`os/types.go`](https://github.com/golang/go/blob/master/src/os/types.go#L32-L46) | `FileMode` — 通过 `iota` 类型常量实现的 Unix 权限标志 |
| [对象池](/zh/patterns/object-pool/) | [`sync/pool.go`](https://github.com/golang/go/blob/master/src/sync/pool.go#L52-L97) | `sync.Pool` — per-P 本地池，无锁快速路径，广泛用于 `fmt`、`encoding/json` |
| [工作窃取](/zh/patterns/work-stealing/) | [`runtime/proc.go`](https://github.com/golang/go/blob/master/src/runtime/proc.go#L3836-L3903) | `stealWork` — goroutine 调度器通过 `runqsteal`/`runqgrab` 从其他 P 的运行队列窃取 |
| [空闲链表](/zh/patterns/free-list/) | [`runtime/mfixalloc.go`](https://github.com/golang/go/blob/master/src/runtime/mfixalloc.go#L31-L109) | `fixalloc` — 固定大小空闲链表分配器，侵入式 `mlink` 节点 |
| [LRU 缓存](/zh/patterns/lru-cache/) | [groupcache `lru/lru.go`](https://github.com/golang/groupcache/blob/master/lru/lru.go#L23-L104) | `Cache` 结构体，双向链表 + 哈希表，Brad Fitzpatrick 作品 |
| [一致性哈希](/zh/patterns/consistent-hashing/) | [groupcache `consistenthash.go`](https://github.com/golang/groupcache/blob/master/consistenthash/consistenthash.go#L28-L81) | 带虚拟节点的哈希环，用于分布式缓存 |
| [限流器](/zh/patterns/rate-limiter/) | [`x/time/rate`](https://github.com/golang/time/blob/master/rate/rate.go#L57-L66) | 扩展标准库中的令牌桶限流器 |
| [信号量](/zh/patterns/semaphore/) | [`x/sync/semaphore`](https://github.com/golang/sync/blob/master/semaphore/semaphore.go#L28-L107) | 加权信号量——被 `errgroup` 内部使用以限制 goroutine 并发 |
| [享元 (Flyweight)](/zh/patterns/flyweight/) | [`sync/pool.go`](https://github.com/golang/go/blob/master/src/sync/pool.go#L52-L97) | `sync.Pool` 作为享元——`Get()` 返回缓存实例而非分配新对象，`Put()` 归还以复用 |
| [Arena 分配器](/zh/patterns/arena-allocator/) | [`arena/arena.go`](https://github.com/golang/go/blob/master/src/arena/arena.go#L44-L67) | 实验性 arena 分配器——`New[T]()` 分配，`Free()` 一次性释放绕过 GC |

## 模式如何协作：Goroutine 调度

当你执行 `go func()` 时，多个模式协同工作，在少量 OS 线程上运行数百万个 goroutine：

<CompositionFlow variant="go-goroutine" />

GMP 模型（Goroutine、M 线程、P 处理器）是粘合剂：每个 P 拥有本地运行队列、空闲链表分配器和 sync.Pool 分片。工作窃取只在 P 耗尽时才启动。这种设计意味着快速路径上大部分操作是无锁的，竞争只在窃取时发生——而窃取本身就是设计中的罕见情况。

## 延伸阅读

- [Go 源码 (GitHub)](https://github.com/golang/go)
- [Go Runtime 包文档](https://pkg.go.dev/runtime)
