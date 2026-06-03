# 模式时间线

这些模式横跨 80 多年的计算历史——从最早的存储程序计算机到现代分布式系统。

```mermaid
timeline
    title 模式首次出现的时间
    ~1943 : State Machine (McCulloch & Pitts)
    ~1945 : Bitmask (von Neumann EDVAC)
    ~1953 : Double Buffering (IBM mainframes)
    ~1956 : Batch Processing (GM-NAA I/O)
    1958 : Free List (McCarthy's LISP)
         : Cooperative Scheduling (Conway's coroutines)
    1959 : Trie (de la Briandais)
    1962 : Dependency Graph / Toposort (Kahn)
    1964 : Min Heap (Williams' heapsort)
    1965 : Semaphore (Dijkstra, THE OS)
    1966 : LRU Cache (Belady, IBM)
    1970 : Bloom Filter (Burton Bloom)
    ~1971 : Copy-on-Write (IBM VM/370)
    1973 : Actor Model (Hewitt, Bishop, Steiger)
         : Retry with Backoff (Metcalfe's Ethernet)
    1974 : Diff / Patch (McIlroy, Unix V5)
         : Backpressure (TCP, Cerf & Kahn)
    1975 : Iterator (Liskov's CLU)
    ~1976 : Write-Ahead Log (IBM System R)
         : Checkpointing (database recovery)
    1978 : MVCC (David Reed, MIT)
    1979 : Observer / Pub-Sub (MVC, Xerox PARC)
    1981 : Work Stealing (Burton & Sleep)
    ~1986 : Rate Limiter / Token Bucket (Turner)
    1989 : Skip List (William Pugh)
    1990 : Flyweight (Calder & Linton)
    ~1994 : Object Pool (Bonwick's slab allocator)
    1997 : Consistent Hashing (Karger et al.)
    2007 : Circuit Breaker (Nygard, "Release It!")
```

## 完整表格

| 年份 | 模式 | 起源 |
|------|------|------|
| ~1943 | [状态机](/zh/patterns/state-machine/) | McCulloch & Pitts 将神经元建模为有限自动机；Mealy（1955）和 Moore（1956）形式化了两种经典类型 |
| ~1945 | [位掩码](/zh/patterns/bitmask/) | 存储程序计算机固有特性；von Neumann 的 EDVAC 报告描述了位级操作 |
| ~1953 | [双缓冲](/zh/patterns/double-buffering/) | IBM 701/709 I/O 子系统中用于计算与数据传输重叠 |
| ~1956 | [批处理](/zh/patterns/batch-processing/) | GM-NAA I/O 监控器（IBM 704）——首个有文档记录的批处理系统 |
| 1958 | [空闲链表](/zh/patterns/free-list/) | McCarthy 的 LISP 使用空闲链表管理 cons cell 分配 |
| 1958 | [协作调度](/zh/patterns/cooperative-scheduling/) | Melvin Conway 描述了协程（1963 年发表），形式化了自愿让出 |
| 1959 | [Trie 前缀树](/zh/patterns/trie/) | Rene de la Briandais 描述了 trie；Fredkin 于 1960 年命名（取自 retrieval） |
| ~1960s | [环形缓冲区](/zh/patterns/ring-buffer/) | 用于电信和实时 I/O 系统；无单一发明者 |
| ~1960s | [Arena 分配器](/zh/patterns/arena-allocator/) | 编译器中的区域分配；Knuth 在 TAOCP（1968）中讨论了池分配 |
| 1962 | [依赖图](/zh/patterns/dependency-graph/) | Kahn 在 CACM 发表"大型网络的拓扑排序" |
| 1964 | [最小堆](/zh/patterns/min-heap/) | Williams 为堆排序发明二叉堆；Floyd 同年改进 |
| 1965 | [信号量](/zh/patterns/semaphore/) | Dijkstra 为 THE 操作系统发明了 P() 和 V() |
| 1966 | [LRU 缓存](/zh/patterns/lru-cache/) | Belady 的"虚拟存储计算机替换算法研究"（IBM 系统期刊） |
| 1970 | [布隆过滤器](/zh/patterns/bloom-filter/) | Burton Bloom 发表"带允许误差的哈希编码中的空间/时间权衡"（CACM） |
| ~1971 | [写时复制](/zh/patterns/copy-on-write/) | IBM VM/370 虚拟内存；后被 BSD Unix 的 fork() 采用 |
| 1973 | [Actor 模型](/zh/patterns/actor-model/) | Hewitt, Bishop, Steiger："人工智能的通用模块化 Actor 形式主义" |
| 1973 | [指数退避重试](/zh/patterns/retry-backoff/) | Metcalfe 的以太网为 CSMA/CD 引入截断二进制指数退避 |
| 1974 | [差异/补丁](/zh/patterns/diff-patch/) | McIlroy 在贝尔实验室为 Unix V5 创建了 diff |
| ~1974 | [背压](/zh/patterns/backpressure/) | TCP 流控（Cerf & Kahn）——计算中最早的背压生产实例 |
| 1975 | [迭代器](/zh/patterns/iterator/) | Liskov 的 CLU 语言将迭代器引入为一等抽象 |
| ~1976 | [预写日志](/zh/patterns/write-ahead-log/) | IBM System R，第一个 SQL 关系数据库；在 ARIES（1992）中形式化 |
| ~1976 | [检查点](/zh/patterns/checkpointing/) | 与 System R 中的 WAL 一起用于崩溃恢复；在 ARIES 中形式化 |
| 1978 | [MVCC](/zh/patterns/mvcc/) | David Reed 的 MIT 博士论文，多版本并发控制 |
| 1979 | [观察者](/zh/patterns/observer/) | Reenskaug 在 Xerox PARC 为 Smalltalk 设计的 MVC 模式 |
| 1981 | [工作窃取](/zh/patterns/work-stealing/) | Burton & Sleep 描述了并行图归约的任务窃取 |
| ~1986 | [限流器](/zh/patterns/rate-limiter/) | Turner 描述了网络流量整形的漏桶算法 |
| 1989 | [跳表](/zh/patterns/skip-list/) | Pugh："跳表：平衡树的概率替代方案"（CACM） |
| 1990 | [享元](/zh/patterns/flyweight/) | Calder & Linton："字形：用户界面的享元对象"（USENIX） |
| ~1994 | [对象池](/zh/patterns/object-pool/) | Bonwick 的 Solaris slab 分配器；数据库连接池使其普及 |
| 1997 | [一致性哈希](/zh/patterns/consistent-hashing/) | Karger 等人："一致性哈希和随机树"（STOC） |
| 2007 | [熔断器](/zh/patterns/circuit-breaker/) | Nygard 在《Release It!》中描述——借鉴自电气工程 |

> **注：** 标有 ~ 的年份是近似值——这些概念从工程实践中自然涌现，而非源于单篇发表。

## 这告诉我们什么

1. **基础模式非常古老。** 信号量（1965）、堆（1964）、状态机（1943）已经被实战验证了 60-80 年。使用它们时，你站在数十年经过验证的工程之上。

2. **大多数"新"模式是组合。** React 的协调器（2017）组合了位掩码 + 最小堆 + 协作调度 + 差异/补丁 + 双缓冲——全部发明于 1943 到 1974 年之间。

3. **从发明到广泛采用的间隔在缩短。** 布隆过滤器从论文（1970）到数据库广泛使用（2000s）花了 30 年。熔断器从书籍（2007）到 Netflix Hystrix（2012）只花了 5 年。

4. **模式比使其流行的技术更长寿。** 写时复制于 1971 年为 IBM 大型机发明——现在它在 Git、Rust 和每个现代操作系统内核中使用。
