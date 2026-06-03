# 模式时间线

这些模式横跨 80 多年的计算历史——从最早的存储程序计算机到现代分布式系统。

```text
  1943 ━━━━ State Machine
  1945 ━━━━ Bitmask
  1953 ━━━━ Double Buffering
  1956 ━━━━ Batch Processing
  1958 ━━━━ Free List, Cooperative Scheduling
  1959 ━━━━ Trie
  1960 ━━━━ Reference Counting (Collins), Interning (LISP symbols)
  1962 ━━━━ Dependency Graph (Kahn's toposort)
  1964 ━━━━ Min Heap (Williams)
  1965 ━━━━ Semaphore (Dijkstra), Dirty Flag (virtual memory)
  1966 ━━━━ LRU Cache (Belady), Tagged Union (Algol 68)
  1967 ━━━━ Vtable (Simula), Event Loop (early GUIs)
  1970 ━━━━ Bloom Filter, B+ Tree (Bayer & McCreight)
  1971 ━━━━ Copy-on-Write
  1973 ━━━━ Actor Model, Retry with Backoff (Ethernet)
  1974 ━━━━ Diff/Patch, Backpressure (TCP)
  1975 ━━━━ Iterator (CLU), Tombstone (database deletion)
  1976 ━━━━ Write-Ahead Log, Checkpointing (System R)
  1978 ━━━━ MVCC (David Reed), Logical Clock (Lamport)
  1979 ━━━━ Observer / Pub-Sub (MVC), Merkle Tree (Merkle)
  1981 ━━━━ Work Stealing
  1986 ━━━━ Rate Limiter / Token Bucket
  1989 ━━━━ Skip List (Pugh)
  1990 ━━━━ Flyweight
  1993 ━━━━ Middleware Chain (web frameworks), Registry (COM)
  1994 ━━━━ Object Pool (slab allocator), Visitor (GoF)
  1996 ━━━━ LSM Tree (O'Neil et al.)
  1997 ━━━━ Consistent Hashing (Karger)
  2003 ━━━━ Merge Iterator (LevelDB-style K-way merge)
  2007 ━━━━ Circuit Breaker (Nygard)
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
| 约1960年代 | [环形缓冲区](/zh/patterns/ring-buffer/) | 用于电信和实时 I/O 系统；无单一发明者 |
| 约1960年代 | [Arena 分配器](/zh/patterns/arena-allocator/) | 编译器中的区域分配；Knuth 在 TAOCP（1968）中讨论了池分配 |
| 1960 | [引用计数](/zh/patterns/reference-counting/) | George Collins 描述了用于自动存储回收的引用计数 |
| 约1960年代 | [驻留](/zh/patterns/interning/) | LISP 从最早期实现就驻留符号；该技术早于其名称 |
| 1962 | [依赖图](/zh/patterns/dependency-graph/) | Kahn 在 CACM 发表"大型网络的拓扑排序" |
| 1964 | [最小堆](/zh/patterns/min-heap/) | Williams 为堆排序发明二叉堆；Floyd 同年改进 |
| 1965 | [信号量](/zh/patterns/semaphore/) | Dijkstra 为 THE 操作系统发明了 P() 和 V() |
| 约1965 | [脏标记](/zh/patterns/dirty-flag/) | 虚拟内存系统使用"脏位"跟踪已修改的页面；该模式后来泛化为任何延迟重算场景 |
| 1966 | [LRU 缓存](/zh/patterns/lru-cache/) | Belady 的"虚拟存储计算机替换算法研究"（IBM 系统期刊） |
| 约1966 | [标签联合](/zh/patterns/tagged-union/) | Algol 68 形式化了判别联合体；更早的汇编程序员非正式地使用类型标签 |
| 1967 | [虚函数表](/zh/patterns/vtable/) | Simula 67 通过方法表引入虚方法分派；C++ 后来使其流行，并使用"vtable"这一名称 |
| 约1967 | [事件循环](/zh/patterns/event-loop/) | 早期交互系统使用事件驱动分派；由 Smalltalk（1980）和 X Window 系统（1984）推广 |
| 1970 | [布隆过滤器](/zh/patterns/bloom-filter/) | Burton Bloom 发表"带允许误差的哈希编码中的空间/时间权衡"（CACM） |
| 约1970 | [B+ 树](/zh/patterns/b-plus-tree/) | Bayer & McCreight 发明 B 树（1970）；叶节点链接的 B+ 变体于 1972 年左右出现，用于数据库索引 |
| ~1971 | [写时复制](/zh/patterns/copy-on-write/) | IBM VM/370 虚拟内存；后被 BSD Unix 的 fork() 采用 |
| 1973 | [Actor 模型](/zh/patterns/actor-model/) | Hewitt, Bishop, Steiger："人工智能的通用模块化 Actor 形式主义" |
| 1973 | [指数退避重试](/zh/patterns/retry-backoff/) | Metcalfe 的以太网为 CSMA/CD 引入截断二进制指数退避 |
| 1974 | [差异/补丁](/zh/patterns/diff-patch/) | McIlroy 在贝尔实验室为 Unix V5 创建了 diff |
| ~1974 | [背压](/zh/patterns/backpressure/) | TCP 流控（Cerf & Kahn）——计算中最早的背压生产实例 |
| 1975 | [迭代器](/zh/patterns/iterator/) | Liskov 的 CLU 语言将迭代器引入为一等抽象 |
| 约1975 | [墓碑](/zh/patterns/tombstone/) | 数据库系统中用于删除标记；对 B 树删除和后来的 LSM 树至关重要 |
| ~1976 | [预写日志](/zh/patterns/write-ahead-log/) | IBM System R，第一个 SQL 关系数据库；在 ARIES（1992）中形式化 |
| ~1976 | [检查点](/zh/patterns/checkpointing/) | 与 System R 中的 WAL 一起用于崩溃恢复；在 ARIES 中形式化 |
| 1978 | [MVCC](/zh/patterns/mvcc/) | David Reed 的 MIT 博士论文，多版本并发控制 |
| 1978 | [逻辑时钟](/zh/patterns/logical-clock/) | Lamport 的"分布式系统中的时间、时钟和事件排序"—— Lamport 时间戳 |
| 1979 | [观察者](/zh/patterns/observer/) | Reenskaug 在 Xerox PARC 为 Smalltalk 设计的 MVC 模式 |
| 1979 | [默克尔树](/zh/patterns/merkle-tree/) | Ralph Merkle 为大型数据结构的高效安全验证申请了哈希树专利 |
| 1981 | [工作窃取](/zh/patterns/work-stealing/) | Burton & Sleep 描述了并行图归约的任务窃取 |
| ~1986 | [限流器](/zh/patterns/rate-limiter/) | Turner 描述了网络流量整形的漏桶算法 |
| 1989 | [跳表](/zh/patterns/skip-list/) | Pugh："跳表：平衡树的概率替代方案"（CACM） |
| 1990 | [享元](/zh/patterns/flyweight/) | Calder & Linton："字形：用户界面的享元对象"（USENIX） |
| 约1993 | [中间件链](/zh/patterns/middleware-chain/) | 责任链（GoF 1994）泛化为 Web 框架的中间件管道；CORBA 中间件更早出现 |
| 约1993 | [注册表](/zh/patterns/registry/) | COM（1993）和 CORBA 使用注册表进行组件发现；GoF 的抽象工厂与之相关 |
| ~1994 | [对象池](/zh/patterns/object-pool/) | Bonwick 的 Solaris slab 分配器；数据库连接池使其普及 |
| 1994 | [访问者](/zh/patterns/visitor/) | GoF《设计模式》形式化了访问者模式，用于对象结构上的双重分派 |
| 1996 | [LSM 树](/zh/patterns/lsm-tree/) | O'Neil 等人："日志结构合并树"——在内存中缓冲写入，刷入有序文件 |
| 1997 | [一致性哈希](/zh/patterns/consistent-hashing/) | Karger 等人："一致性哈希和随机树"（STOC） |
| 约2003 | [归并迭代器](/zh/patterns/merge-iterator/) | 通过最小堆实现 K 路有序流合并；在 LevelDB/BigTable 时代系统中形式化 |
| 2007 | [熔断器](/zh/patterns/circuit-breaker/) | Nygard 在《Release It!》中描述——借鉴自电气工程 |

> **注：** 标有 ~ 的年份是近似值——这些概念从工程实践中自然涌现，而非源于单篇发表。

## 这告诉我们什么

1. **基础模式非常古老。** 信号量（1965）、堆（1964）、状态机（1943）已经被实战验证了 60-80 年。使用它们时，你站在数十年经过验证的工程之上。

2. **大多数"新"模式是组合。** React 的协调器（2017）组合了位掩码 + 最小堆 + 协作调度 + 差异/补丁 + 双缓冲——全部发明于 1943 到 1974 年之间。

3. **从发明到广泛采用的间隔在缩短。** 布隆过滤器从论文（1970）到数据库广泛使用（2000s）花了 30 年。熔断器从书籍（2007）到 Netflix Hystrix（2012）只花了 5 年。

4. **模式比使其流行的技术更长寿。** 写时复制于 1971 年为 IBM 大型机发明——现在它在 Git、Rust 和每个现代操作系统内核中使用。
