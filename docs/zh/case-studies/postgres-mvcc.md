---
title: '案例研究：PostgreSQL 如何组合三种模式支撑并发事务'
description: 深入剖析 PostgreSQL 如何组合 MVCC、事务 ID 逻辑时钟与预写日志，让读不阻塞写、写不阻塞读，且崩溃不丢任何已提交数据——每条论断都有锁定提交的源码佐证。
---

# 案例研究：PostgreSQL 如何组合三种模式支撑并发事务

> **这是什么。** 大多数模式文档孤立地讲一个模式。本案例研究反其道而行：它剖析一个
> 真实系统——PostgreSQL——如何组合**三个**模式，让许多事务同时读写同一张表而互不
> 阻塞，且事务执行到一半崩溃也不会丢失任何数据。每条按模式的论断都链接到锁定提交的
> 源码；组合论证则有 PostgreSQL 自己的文档支撑。

## PostgreSQL 解决的问题

数据库必须让许多事务*并发*操作同一批行，同时表现得仿佛每个事务都独自运行(隔离性)；
而且必须在崩溃后不丢失任何已提交数据(持久性)。获得隔离性的朴素办法是加锁：读者锁住
一行，使写者无法在读到一半时改它；写者锁住一行，使读者看不到写到一半的值。但锁让一切
串行化——在高负载下，读者和写者把时间都花在互相等待上。

PostgreSQL 的答案几乎完全避开了读写锁。诀窍是**永不就地覆盖一行**：一次更新写入一个
*新版本*，并保留旧版本。读者和写者于是操作*不同的版本*，因此不会冲突。让这一切成立
——并且做到崩溃安全——需要三个模式协同工作。

| 问题 | 模式 | PostgreSQL 如何回答 |
|------|------|---------------------|
| *读者和写者如何能同时碰同一行而不阻塞？* | **MVCC** | 保留多个行版本；每个版本用 `xmin`/`xmax` 打戳 |
| *这个事务该看到哪个版本？* | **逻辑时钟** | 事务 ID(XID)是一个单调时钟；快照说明"谁在我之前" |
| *如何在崩溃后不丢失一次提交？* | **预写日志** | 把变更追加到 WAL 缓冲区；提交时刷盘的是 WAL(而非数据文件) |

## 模式 1 —— MVCC：多版本，绝不就地覆盖

PostgreSQL 从不就地编辑一行。每个行版本(一个*元组*)携带两个隐藏的系统列：`xmin`
(创建它的事务的 XID)和 `xmax`(删除/取代它的事务的 XID，或 0)。一次 `UPDATE` 实际上
是插入一个新元组，外加给旧元组打上 `xmax`——于是两个版本并存。

举个具体的例子：假设某行作为版本 V1 存在，`xmin=10`。现在事务 20 执行 `UPDATE`，而
事务 25 *同时*对这一行执行 `SELECT`。更新写入 V2(`xmin=20`)并给 V1 打上 `xmax=20`；
但在事务 20 提交之前，事务 25 的快照仍把 20 当作"还没完成"，于是它照常读到 V1。没有
锁、没有等待——读者和写者自始至终看的就是不同的版本。"这个版本对我可见吗？"这个问题
由 `HeapTupleSatisfiesMVCC` 回答，它把元组的 `xmin`/`xmax` 与调用者的快照做比较。

```c
HeapTupleSatisfiesMVCC(HeapTuple htup, Snapshot snapshot,
                       Buffer buffer)
{
    HeapTupleHeader tuple = htup->t_data;
    // ...
    if (!HeapTupleHeaderXminCommitted(tuple))
    {
        if (HeapTupleHeaderXminInvalid(tuple))
            return false;
        // ...is xmin in my snapshot? committed before I started?...
    }
    // ...is xmax set and committed? then this version is gone for me...
}
```

简化后的规则：一个版本可见，当且仅当它的 `xmin` 在我的快照拍下*之前*已提交，**并且**
它的 `xmax` 要么未设置、要么属于一个在我快照拍下时*尚未*提交的事务。读者因此看到一组
一致的版本——它快照那一刻已提交的那些——而并发的写者正忙着创建*更新的*版本，读者
直接忽略。读者从不阻塞写者，写者从不阻塞读者。

> MVCC 消除的是*读/写*冲突，而非所有冲突。两个事务 `UPDATE` **同一行**时仍会串行化：
> 后一个会在行级锁上等待，直到前一个提交或回滚。MVCC 的承诺恰恰是读和写互不阻塞——
> 同一行上的写/写争用仍由加锁来解决。

::: tip 心智模型
把每一行想成一摞带日期的照片，而不是一块你擦了重写的白板。一次更新不抹掉白板——它在
最上面别上一张新照片，并给旧照片写上一个结束日期。每个读者带着一个时间戳，沿着这摞
照片往下找在*它*的时间点"当前"的那张。两个在不同时间读取的人看到同一行的不同照片，
而谁都不会拦住写者别上下一张。
:::

→ 单独看这个模式，见 [MVCC](/zh/patterns/mvcc/)。

## 模式 2 —— 逻辑时钟：事务 ID 给世界排序

"在我快照之前提交"只有当事务能被*排序*时才有意义。PostgreSQL 给每个事务从一个单调
递增的计数器分配一个**事务 ID(XID)**——一个**逻辑时钟**。一个由 `GetSnapshotData`
构建的*快照*捕获了某一瞬间的时钟：仍在运行的最小 XID(`xmin`)、下一个尚未分配的 XID
(`xmax`)、以及进行中的 XID 列表。这个三元组足以判定任意元组的创建/删除事务相对于这个
快照算不算"在过去"。

```c
GetSnapshotData(Snapshot snapshot)
{
    ProcArrayStruct *arrayP = procArray;
    TransactionId *other_xids = ProcGlobal->xids;
    TransactionId xmin;
    TransactionId xmax;
    // ...scan the array of running transactions, record xmin/xmax/xip[]...
}
```

快照是模式 1 和时钟之间的桥梁：`HeapTupleSatisfiesMVCC` 不比较原始时间戳，而是问
"这个元组的 XID *在这个快照里可见吗*？"因为 XID 是逻辑时钟，"之前"和"之后"只是整数
比较(用模 2³² 算术完成，这样计数器可以绕回而不让时间看起来倒流)。

::: tip 心智模型
XID 计数器是熟食店的取号机：每个事务取下一个号。一个快照就是你记下"我是 50 号，而
47 号和 48 号还在被服务"。由此你确切知道谁的工作算作在你之前完成(≤46 号里不是 47/48
的那些)、谁的不算。无需墙上时钟——只需号码被发出的先后顺序。
:::

→ 单独看这个模式，见 [逻辑时钟](/zh/patterns/logical-clock/)。

## 模式 3 —— 预写日志：不刷全部数据也能持久

MVCC 在*内存里*保证并发正确，但一次提交必须挺过崩溃。每次提交都把所有被修改的数据页
刷到磁盘会慢得离谱(随机写散落在整个堆上)。PostgreSQL 转而遵循**预写日志**规则：在
变更碰到数据文件之前，必须先把一条描述该变更的记录追加到 WAL。`XLogInsert` 是组装
这样一条记录、并把它插入内存中 WAL 缓冲区的入口。

```c
XLogRecPtr
XLogInsert(RmgrId rmid, uint8 info)
{
    XLogRecPtr  EndPos;

    /* XLogBeginInsert() must have been called. */
    if (!begininsert_called)
        elog(ERROR, "XLogBeginInsert was not called");
    // ...assemble the record, then insert it into the WAL buffers...
}
```

插入缓冲区还不算持久——那是另一个独立步骤。提交时，`XLogFlush` 用 `fsync`(一个让
操作系统真正把字节落盘、而不只是缓存的系统调用)把直到这条记录为止的 WAL 强制写到
磁盘。WAL 是一个单一的*顺序*文件，所以追加很快，一次 `fsync` 就能让许多事务同时变得
持久。关键在于：提交时只需刷 WAL，数据页可以之后惰性写入。如果服务器崩溃，恢复会
**重放** WAL——*前滚*，也叫 REDO：它按日志顺序，把每个还没到达其数据页的已提交变更
重新应用一遍。所以崩溃永远不会丢失一个已提交事务，也不会留下一个应用到一半的事务。

::: tip 心智模型
WAL 是厨师的点菜单。在烹饪(改动菜品)之前，厨师按到达顺序把点单插在签子上。如果厨房
在营业途中烧毁，签子上的单子还在，厨师就照单、按顺序重新做出当初点的菜。写一张单子
远比把每道菜都摆盘存盘便宜——而让订单"作数"的是单子，不是盘子。
:::

→ 单独看这个模式，见 [预写日志](/zh/patterns/write-ahead-log/)。

## 三者如何组合

一次 `UPDATE ... ; COMMIT;` 会走过全部三个模式：

```text
UPDATE row              ──► MVCC: write a NEW tuple (xmin = my XID),
                                  stamp old tuple's xmax = my XID
                                         │
            (but first, before the heap page is changed)
                                         ▼
                            WAL: XLogInsert the change into the WAL buffer;
                                 XLogFlush fsyncs it to disk on commit
                                         │
   meanwhile, a concurrent SELECT        ▼
   takes a snapshot ──► LOGICAL CLOCK: GetSnapshotData records the XID frontier
                                         │
                                         ▼
   for each tuple ──► MVCC: HeapTupleSatisfiesMVCC compares xmin/xmax
                            against that snapshot → sees the OLD version,
                            unbothered by the in-flight UPDATE
```

统一的思想是**有序 + 多版本，绝不覆盖**。MVCC 给每行多个版本，让读者和写者碰不同的
版本；XID 逻辑时钟给出一个全序，让每个快照能判定哪个版本"对我而言是当前的"；而 WAL
把这个顺序持久地记录下来，让崩溃可以重放它。去掉任何一个就崩了：没有版本(MVCC)，
读者和写者就会冲突，又回到加锁；没有逻辑时钟，"哪个版本可见"就无从回答；没有 WAL，
提交与数据页刷盘之间的崩溃就会丢失那个事务。

::: info 架构层面的推断
把这些模式诠释为一个*刻意组合*的设计——以"有序 + 多版本，绝不覆盖"为统一主线——依据
的是 PostgreSQL 自己的文档(见延伸阅读)，而非任何单个源文件。按模式的代码链接是直接
的源码证据；"按设计组合"这一论断由那些设计层面的材料支撑。
:::

## 生产验证

所有源码链接都锁定到 PostgreSQL 提交
`6304632eaa2107bb1763d29e213ff166ff6104c0`(标签 `REL_17_2`)。按模式的论断是
`source-code`(L1)；组合关系由官方文档(`official-doc`)支撑。

| 模式 / 论断 | 来源 | 证据 | 在 PostgreSQL 中的角色 |
|-------------|------|------|------------------------|
| MVCC | [heapam_visibility.c#L960-L975](https://github.com/postgres/postgres/blob/6304632eaa2107bb1763d29e213ff166ff6104c0/src/backend/access/heap/heapam_visibility.c#L960-L975) | source-code | `HeapTupleSatisfiesMVCC`——用 `xmin`/`xmax` 判定元组版本是否可见 |
| 逻辑时钟 | [procarray.c#L2177-L2182](https://github.com/postgres/postgres/blob/6304632eaa2107bb1763d29e213ff166ff6104c0/src/backend/storage/ipc/procarray.c#L2177-L2182) | source-code | `GetSnapshotData`——把运行中的 XID 边界捕获进一个快照 |
| 预写日志 | [xloginsert.c#L473-L490](https://github.com/postgres/postgres/blob/6304632eaa2107bb1763d29e213ff166ff6104c0/src/backend/access/transam/xloginsert.c#L473-L490) | source-code | `XLogInsert`——在碰数据之前把一条变更记录追加到 WAL |
| MVCC(导引) | [Concurrency Control — Introduction](https://www.postgresql.org/docs/current/mvcc-intro.html) | official-doc | 官方声明 PostgreSQL 用 MVCC 让读者/写者互不阻塞 |
| WAL(按设计) | [Write-Ahead Logging (WAL)](https://www.postgresql.org/docs/current/wal-intro.html) | official-doc | 官方解释"先日志后数据"规则与 REDO 恢复 |

## 要点

- **模式很少单独出现。** 并发、崩溃安全的事务同时需要一个*版本化*模式(MVCC)、一个
  *排序*模式(逻辑时钟)和一个*持久化*模式(WAL)——每一个回答一个不同的问题。
- **一个思想能统一整个系统。** "有序 + 多版本，绝不覆盖"是保留旧元组、比较 XID、追加
  日志三件事背后的同一原则。在三个子系统背后认出同一个思想，正是深度读源码的回报。
- **"绝不覆盖"把冲突变成了非事件。** 因为一次更新创建一个新版本而非修改旧版本，经典的
  读者-写者冲突根本不会出现——读者自始至终看的就是另一个版本。
- **这呼应了 Git。** Git 同样从不覆盖——一次提交添加新的内容寻址对象并移动一个指针。
  把 PostgreSQL 的 MVCC 与 Git 的不可变对象对比，能看到"只追加新的、绝不修改"是一个
  跨领域的思想。

## 延伸阅读

一条从"我读过这个"到"我能在任何地方认出这些模式"的路径：

1. **先理解模型**——
   [并发控制导引](https://www.postgresql.org/docs/current/mvcc-intro.html)
   陈述了 PostgreSQL *为何*用 MVCC：读者不阻塞写者，反之亦然。先读这个；源码随后
   会展示*如何*做到。
2. **理解可见性**——
   [事务隔离文档](https://www.postgresql.org/docs/current/transaction-iso.html)
   解释了隔离级别，而这正是 `HeapTupleSatisfiesMVCC` 对着快照所执行的规则。
3. **理解持久性**——
   [预写日志文档](https://www.postgresql.org/docs/current/wal-intro.html)
   描述了 WAL 提供的"先日志后数据"规则与 REDO 恢复。
4. **然后按这个顺序读源码**——可见性
   ([HeapTupleSatisfiesMVCC](https://github.com/postgres/postgres/blob/6304632eaa2107bb1763d29e213ff166ff6104c0/src/backend/access/heap/heapam_visibility.c#L960-L975))
   → 它查询的快照
   ([GetSnapshotData](https://github.com/postgres/postgres/blob/6304632eaa2107bb1763d29e213ff166ff6104c0/src/backend/storage/ipc/procarray.c#L2177-L2182))
   → 底层的持久性
   ([XLogInsert](https://github.com/postgres/postgres/blob/6304632eaa2107bb1763d29e213ff166ff6104c0/src/backend/access/transam/xloginsert.c#L473-L490))。
5. **跨系统对比**——读 [Git commit 案例研究](/zh/case-studies/git-commit)，把它的
   内容寻址不可变性与 PostgreSQL 的元组版本对比。同一个"只追加新的、绝不覆盖"思想，
   不同领域。
6. **练习辨认**——打开下面三个模式页，在另一个系统里寻找"保留版本、给它们排序、记录
   这个顺序"的影子。

## 延伸学习这些模式

- [MVCC](/zh/patterns/mvcc/) —— 多版本让读者与写者互不阻塞
- [逻辑时钟](/zh/patterns/logical-clock/) —— 不用墙上时钟也能给事件排序
- [预写日志](/zh/patterns/write-ahead-log/) —— 应用变更之前先记录它
