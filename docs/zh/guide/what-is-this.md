---
description: "Battle-Tested Patterns：46 个生产验证的编程模式，来自 React、Linux、Go、Chromium，配有交互式可视化。"
---

# 这是什么？

**Battle-Tested Patterns** 收集的编程模式具有以下特点：

1. **经过生产验证** — 在 React、Linux 内核、Go 运行时、Chromium 等顶级项目中使用
2. **交互式可视化** — 每个模式都配有可点击、可拖拽的 SVG 可视化，动手操作建立直觉
3. **跨语言通用** — TypeScript、Rust、Go、Python 的地道实现
4. **代码级技巧** — 可以立即应用的具体技术，而非抽象的架构概念

## 为什么做这个

市面上有大量"设计模式"书籍和"算法"仓库，但存在一个空白：

| 现有资源 | 缺失的部分 |
|---------|-----------|
| 设计模式 (GoF) | 太抽象，过于面向对象 |
| 算法仓库 | 脱离工程实践 |
| 系统设计指南 | 架构层面，不涉及代码级技巧 |
| "Awesome" 列表 | 链接集合，没有教学内容 |
| 交互式教程 | 通常是独立项目，不成体系 |

本项目填补这个空白：**从生产源码中提取的代码级技巧，配备交互式可视化和可验证的精确引用**。

## 什么是"经过实战检验"？

本集合中的每个模式必须满足：

- **≥ 2 个生产验证** — 精确到行号的 GitHub 链接，展示模式的实际使用
- **多语言实现** — TypeScript + 至少一种其他语言的地道代码
- **可运行练习** — 渐进式难度，配套测试用例

我们绝不编造源码链接。如果找不到可验证的引用，就不收录该模式。

## 推荐学习路径

根据你的背景选择一条路径，或自由浏览。

### 前端开发者

从你已经在用（可能没意识到）的模式开始：

1. [Diff / Patch (差异/补丁)](/zh/patterns/diff-patch/) — React 虚拟 DOM 协调
2. [Bitmask (位掩码)](/zh/patterns/bitmask/) — React Fiber 标志位
3. [Cooperative Scheduling (协作调度)](/zh/patterns/cooperative-scheduling/) — React 为什么每 5ms 让出
4. [Observer (观察者)](/zh/patterns/observer/) — Redux、EventEmitter
5. [Double Buffering (双缓冲)](/zh/patterns/double-buffering/) — React Fiber 的 `current` / `workInProgress`

然后看它们如何组合：[React 中的模式](/zh/by-project/react)

### 后端 / 系统开发者

从数据库和分布式系统中的模式开始：

1. [Write-Ahead Log (预写日志)](/zh/patterns/write-ahead-log/) — PostgreSQL、etcd 的崩溃恢复
2. [MVCC](/zh/patterns/mvcc/) — 读者如何永不阻塞写者
3. [Circuit Breaker (熔断器)](/zh/patterns/circuit-breaker/) — 微服务中的快速失败
4. [Rate Limiter (限流器)](/zh/patterns/rate-limiter/) — 令牌桶控制吞吐量
5. [Consistent Hashing (一致性哈希)](/zh/patterns/consistent-hashing/) — 跨节点分配键

然后看完整图景：[分布式系统中的模式](/zh/by-project/distributed-systems)

### 性能 / 底层开发者

从内存和并发模式开始：

1. [Arena Allocator (Arena 分配器)](/zh/patterns/arena-allocator/) — 推进指针分配，一次性释放
2. [Object Pool (对象池)](/zh/patterns/object-pool/) — 避免 GC 压力
3. [Free List (空闲链表)](/zh/patterns/free-list/) — O(1) 分配/释放
4. [Work Stealing (工作窃取)](/zh/patterns/work-stealing/) — Go runtime、Tokio 调度器
5. [Ring Buffer (环形缓冲区)](/zh/patterns/ring-buffer/) — 无锁队列

然后看它们如何组合：[Go Runtime 中的模式](/zh/by-project/go-runtime) · [Linux 中的模式](/zh/by-project/linux)

## 如何使用

- **玩转可视化** — 每个模式页面都有交互式 SVG 可视化，点击、拖拽，建立直觉
- **浏览模式** — 阅读概念，研究生产验证，然后尝试练习
- **本地运行练习** — TypeScript: `pnpm test` · Rust: `cargo test` · Go: `go test`
- **在线尝试** — 将代码复制到官方 Playground 运行：[TypeScript](https://www.typescriptlang.org/play) · [Go](https://go.dev/play/) · [Rust](https://play.rust-lang.org/) · [Python](https://www.online-python.com/)
- **参与贡献** — 参见[如何贡献](./how-to-contribute)
