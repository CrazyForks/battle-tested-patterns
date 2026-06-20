---
title: '案例研究：SQLite 如何组合三种模式实现持久且并发安全的写入'
description: 深入剖析 SQLite 如何组合预写日志、B-Tree 与检查点，使写者从不阻塞读者、数据库文件始终一致、崩溃总能恢复——每一处论断都由固定 commit 上的源码佐证。
---

# 案例研究：SQLite 如何组合三种模式实现持久且并发安全的写入

> **这是什么。** 大多数模式文档孤立地讲解一个模式。本案例研究反其道而行：它剖析单个真实系统——SQLite，地球上部署最广的数据库引擎——如何组合 **三种** 模式，使一次写入在提交的瞬间即持久、读者从不因写者而阻塞、且写入中途断电总能向前或向后恢复。每一处针对单个模式的论断都链接到固定 commit 上的源码；组合关系的论证则由 SQLite 自己的设计文档支撑。

## SQLite 解决的问题

一个数据库引擎必须同时满足两个相互拉扯的诉求。第一是 **持久性**：事务一旦提交，其数据必须能在崩溃中幸存——哪怕电源在一条指令之后就断掉。第二是 **并发性**：一个长时间运行的读者不应冻结所有写者，而一个写者也不应破坏读者正在扫描中的内容。

朴素的做法——就地覆写主数据库文件里的页——两者都满足不了。覆写一个页到一半时崩溃会让文件损坏，而就地写入的写者必须锁住读者，以阻止它们看到写了一半的页。

SQLite 的预写日志（WAL）模式下了一个不同的赌注：**在事务期间从不覆写主文件。** 新的页镜像被追加到一个独立的日志文件；主数据库只在之后、由一个受控的后台步骤更新。这让主文件始终保持一致，让读者在写者追加新页时继续读旧页，并把崩溃恢复变成"重放日志"。三种模式协同工作，让这个赌注得以兑现。

| 问题 | 模式 | SQLite 如何回答 |
|----------|---------|-----------------------|
| *如何在不覆写在用文件的前提下持久提交？* | **预写日志** | 把每个改动的页作为一个 *frame* 追加到 `-wal` 文件；一次提交的最后一帧带提交标记 |
| *如何存储行与索引使查找保持对数级？* | **B-Tree** | 每张表、每个索引都是一棵由定长页组成的 B-Tree；WAL 记录的"脏页"正是这些 B-Tree 页 |
| *如何在不阻塞读者的前提下把日志折回？* | **检查点** | 检查点把已提交的 frame 回写进主文件，直到没有活跃读者还需要的那个点为止 |

## 模式 1 —— 预写日志：靠追加来提交，从不覆写

当一个事务修改页时，SQLite **不** 把它们写回主数据库文件。相反，每个脏页被编码成一个 *WAL frame*——一个小头部加上完整的页镜像——并追加到 `-wal` 文件。`walWriteOneFrame` 是写入一个这种 frame 的原语：

```c
static int walWriteOneFrame(
  WalWriter *p,               /* Where to write the frame */
  PgHdr *pPage,               /* The page of the frame to be written */
  int nTruncate,              /* The commit flag.  Usually 0.  >0 for commit */
  sqlite3_int64 iOffset       /* Byte offset at which to write */
){
  int rc;
  void *pData = pPage->pData;
  u8 aFrame[WAL_FRAME_HDRSIZE];
  walEncodeFrame(p->pWal, pPage->pgno, nTruncate, pData, aFrame);
  rc = walWriteToLog(p, aFrame, sizeof(aFrame), iOffset);    /* frame header */
  if( rc ) return rc;
  rc = walWriteToLog(p, pData, p->szPage, iOffset+sizeof(aFrame)); /* page data */
  return rc;
}
```

`nTruncate` 参数是关键：除了一次提交的最后一帧，其余每帧它都是 `0`；在最后一帧它被设为数据库的页数，这 *同时* 把该帧标记为一次提交。一个扫描 WAL 的读者会在最后一个已提交帧之后停止信任。所以事务中途崩溃是无害的——那些写了一半的帧没有提交标记，恢复时直接忽略它们。主数据库文件从未被触碰。

::: tip 心智模型
把主数据库文件想成一本你拒绝擦写的纸质账本。每次改动都写在一张便利贴上（一个 WAL frame），按到达顺序贴在最上面。完成一个事务的那张便利贴会被签名（提交标记）。一个读者读账本 *加上* 它之上每一张签了名的便利贴；一张末尾未签名的便利贴（一次崩溃）只是被揭下来扔掉。
:::

→ 单独了解该模式，见 [Write-Ahead Log](/zh/patterns/write-ahead-log/)。

## 模式 2 —— B-Tree：页里实际装的是什么

WAL 记录的"页"并非不透明的字节块。SQLite 中每张表、每个索引都是一棵 **B-Tree**——一棵由定长页组成的平衡树，内部页负责路由、叶子页持有数据。（表使用 B+Tree 变体——行数据只存在叶子里——而索引使用普通 B-Tree；本案例链接到 [B+ Tree](/zh/patterns/b-plus-tree/) 模式，取其共享的"由页组成的平衡树"思想。）`sqlite3BtreeInsert` 是把一行或一个索引项加入正确页的入口：

```c
int sqlite3BtreeInsert(
  BtCursor *pCur,                /* Insert data into the table of this cursor */
  const BtreePayload *pX,        /* Content of the row to be inserted */
  int flags,                     /* True if this is likely an append */
  int seekResult                 /* Result of prior IndexMoveto() call */
){
  int rc;
  int loc = seekResult;          /* -1: before desired location  +1: after */
  int szNew = 0;
  MemPage *pPage;
  Btree *p = pCur->pBtree;
  /* ...locate the leaf page, then insert the cell; if the page overflows,
     balance_nonroot() splits it and pushes a separator key up... */
}
```

当一个叶子页填满时，`balance_nonroot` 把它分裂并向上传播一个分隔键——这是经典的 B-Tree 分裂，让树保持低矮、查找保持 `O(log n)`。与模式 1 的关键联系：一次插入会弄脏一个或多个 B-Tree 页，而 **那些被弄脏的页正是 WAL 作为 frame 追加的对象**。B-Tree 决定 *哪些* 页改变；WAL 决定这些改变 *如何* 持久地落盘。

::: tip 心智模型
B-Tree 是一个图书馆的卡片目录：顶上几张索引卡指向抽屉，抽屉指向子抽屉，最底层装着真正的卡片。往一个满抽屉里加卡片，你就把抽屉一分为二、并在楼上归档一个新指针。SQLite 把每张表和索引都这样存；WAL 只是这些抽屉页被安全写下来的方式。
:::

→ 单独了解该模式，见 [B+ Tree](/zh/patterns/b-plus-tree/)。

## 模式 3 —— 检查点：把日志折回文件

WAL 不能无限增长，且读者要扫描的帧越多读取越慢。**检查点** 是把已提交的帧从 WAL 复制回主数据库文件的后台步骤——即 *回写（backfill）*——之后 WAL 的空间便可重用。`walCheckpoint` 驱动它：

```c
static int walCheckpoint(
  Wal *pWal,                      /* Wal connection */
  sqlite3 *db,                    /* Check for interrupts on this handle */
  int eMode,                      /* One of PASSIVE, FULL or RESTART */
  int (*xBusy)(void*),            /* Function to call when busy */
  void *pBusyArg,                 /* Context argument for xBusyHandler */
  int sync_flags,                 /* Flags for OsSync() (or 0) */
  u8 *zBuf                        /* Temporary buffer to use */
){
  /* ...compute mxSafeFrame: the last WAL frame safe to copy back without
     overwriting a page some active reader is still using, then backfill
     pages from the WAL into the main database file up to that frame... */
}
```

精妙之处在 `mxSafeFrame`：一次检查点只能回写到仍被某个活跃读者需要的最旧页之前。这正是让读者与检查点器并发运行的原因——检查点器从不在读者眼皮底下覆写一个页。各模式（`PASSIVE`、`FULL`、`RESTART`）在"检查点努力到什么程度"与"它可以阻塞多少"之间权衡。

::: tip 心智模型
检查点是这样一个文员：当便利贴的叠堆变高时，他把已稳定的便利贴抄进账本并撤掉它们——但只撤当前没人正在读的那些。账本（主文件）始终有效；叠堆（WAL）保持有界；任何正在读的人都不会被打断。
:::

→ 单独了解该模式，见 [Checkpointing](/zh/patterns/checkpointing/)。

## 三者如何组合

运行一个事务，三个模式按顺序交接：

1. **B-Tree** 决定哪些页改变：`sqlite3BtreeInsert` 定位叶子、插入单元，并（若页溢出）将其分裂——产出一组 *脏页*。
2. **预写日志** 让提交持久：每个脏页被 `walWriteOneFrame` 追加到 `-wal` 文件，最后一帧带提交标记。主数据库文件未被触碰，所以读者继续读。
3. **检查点** 稍后回收空间：`walCheckpoint` 把已提交的帧回写进主文件，直到 `mxSafeFrame`——绝不越过某个活跃读者仍需要的页——之后 WAL 便可重用。

```text
BEGIN ... INSERT ... COMMIT
        │
        │  (B-tree: sqlite3BtreeInsert dirties leaf/interior pages; balance splits)
        ▼
   dirty B-tree pages
        │  (WAL: walWriteOneFrame appends each as a frame; last frame = commit marker)
        ▼
   -wal file  ──►  durable on COMMIT, main DB file untouched (readers unblocked)
        │
        │  (later, in the background)
        ▼
   checkpoint: walCheckpoint backfills frames into the main DB up to mxSafeFrame
        │        (never overwriting a page an active reader still needs)
        ▼
   main database file updated, WAL space reclaimed
```

统一这一切的思想是 **把"改变的持久记录"与"改变最终落脚的地方"分离**。WAL 是那份持久的、仅追加的记录；B-Tree 文件是数据最终安顿之处；检查点是二者之间那座尊重读者的受控桥梁。去掉其中任意一个它都会崩塌：没有 WAL，写入中途崩溃就损坏文件；没有 B-Tree，就没有高效的结构可读、也没有可弄脏的对象；没有检查点，WAL 会无界增长、读取慢如蜗行。

::: info 架构推断
把这三者描述为一个 *有意组合* 的设计——即让 SQLite 既并发又抗崩溃的 WAL 模式——依据的是 SQLite 自己的 WAL 文档（见延伸阅读），而非任何单个源码文件。针对单个模式的代码链接是直接的源码证据；而"被有意组合在一起"这一论断，由那些设计层级的材料支撑。
:::

## 生产验证

所有源码链接均固定到 SQLite commit `593b55cb78250bf3c8e77911f0daf30e9a59dc5a`。针对单个模式的论断属于 `source-code`（L1）；组合关系则由官方文档（`official-doc`）支撑。

| 模式 / 论断 | 来源 | 证据类型 | 在 WAL 模式事务中的角色 |
|-----------------|--------|----------|--------------------------------|
| 预写日志 | [wal.c#L3963-L3979](https://github.com/sqlite/sqlite/blob/593b55cb78250bf3c8e77911f0daf30e9a59dc5a/src/wal.c#L3963-L3979) | source-code | `walWriteOneFrame` 把一个改动的页作为 WAL frame 追加；提交标记标出一次提交的最后一帧 |
| B-Tree | [btree.c#L9414-L9440](https://github.com/sqlite/sqlite/blob/593b55cb78250bf3c8e77911f0daf30e9a59dc5a/src/btree.c#L9414-L9440) | source-code | `sqlite3BtreeInsert` 插入叶子页；`balance_nonroot` 分裂满页——这些正是 WAL 记录的脏页 |
| 检查点 | [wal.c#L2199-L2230](https://github.com/sqlite/sqlite/blob/593b55cb78250bf3c8e77911f0daf30e9a59dc5a/src/wal.c#L2199-L2230) | source-code | `walCheckpoint` 把已提交的帧回写进主文件，直到 `mxSafeFrame`，绝不越过活跃读者 |
| 组合（有意为之） | [SQLite WAL 文档](https://sqlite.org/wal.html) | official-doc | SQLite 自己对"写帧、读帧、检查点如何组合成并发且持久的 WAL 模式"的解释 |

## 要点

- **模式很少单独出现。** 持久的并发写入同时需要一个 *持久性* 模式（预写日志）、一个 *结构* 模式（B-Tree）和一个 *空间回收* 模式（检查点）——而且它们按顺序交接。
- **日志记录改变；树持有数据。** SQLite 的 WAL 帧是 B-Tree 页的页镜像。把"日志追加的东西就是树弄脏的东西"认出来，就是整个组合的一句话总结。
- **并发性源于不覆写。** 因为写者只往 WAL 追加、检查点器尊重 `mxSafeFrame`，读者从不会看到写了一半的页——并发性是仅追加纪律的 *结果*，而非一套独立的加锁方案。
- **这与 LevelDB 呼应。** 两者都先追加改变、稍后再重组（这里是 WAL + 检查点；那里是 memtable + compaction）。读懂其一，会让另一个的写路径更易识别。

## 延伸阅读

一条从"我读过了"走向"我能在任何地方认出这些模式"的路径：

1. **先从 WAL 设计开始** —— SQLite 官方的 [Write-Ahead Logging](https://sqlite.org/wal.html) 页解释了 frame、提交标记、`-wal`/`-shm` 文件与检查点。先读这个；源码随后都在印证它。
2. **然后是架构总览** —— [SQLite Architecture](https://sqlite.org/arch.html) 展示了 B-Tree 层、pager 与 WAL 彼此的相对位置。
3. **然后是磁盘格式** —— [SQLite Database File Format](https://sqlite.org/fileformat2.html) 记录了 WAL 帧所承载的 B-Tree 页布局。
4. **然后是原子提交** —— [Atomic Commit In SQLite](https://sqlite.org/atomiccommit.html) 解释了 WAL 提供的持久性保证（以及 rollback-journal 模式有何不同）。
5. **跨系统对比** —— 阅读 [LevelDB LSM 案例研究](/zh/case-studies/leveldb-lsm)，注意"先追加、稍后重组"如何表现为 memtable + compaction。同样的思想，不同的结构。

## 延伸学习这些模式

- [Write-Ahead Log](/zh/patterns/write-ahead-log/) —— 在应用每次改动前先记录日志；靠重放恢复
- [B+ Tree](/zh/patterns/b-plus-tree/) —— 由页组成的平衡树，实现 `O(log n)` 查找与范围扫描
- [Checkpointing](/zh/patterns/checkpointing/) —— 周期性地把日志折回主存储
