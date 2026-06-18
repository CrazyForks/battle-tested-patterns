---
title: '案例研究：LevelDB 如何组合三种模式构建写优化存储'
description: 深入剖析 LevelDB 如何组合 LSM 树、布隆过滤器与墓碑，让写入飞快、读取跳过无关数据块、删除也廉价——每条论断都有锁定提交的源码佐证。
---

# 案例研究：LevelDB 如何组合三种模式构建写优化存储

> **这是什么。** 大多数模式文档孤立地讲一个模式。本案例研究反其道而行：它剖析一个
> 真实系统——LevelDB，Google 的嵌入式键值存储——如何组合**三个**模式，让写入飞快、
> 让读取避开不可能含目标 key 的数据块、连删除都只是一次廉价的追加。每条按模式的论断都
> 链接到锁定提交的源码；组合论证则有 LevelDB 自己的设计文档支撑。

## LevelDB 解决的问题

存储引擎面临一个矛盾。对磁盘的随机写很慢——寻道到正确位置、就地更新、还要保持索引
有序，全都耗 I/O。B 树（多数数据库所用）通过在磁盘上保持数据有序来优化*读*，但代价
落在*写*上：每次插入都可能分裂页面，把随机写散落到磁盘各处。

LevelDB 押了相反的注。它**从不随机写、从不覆盖**：每一次写——插入、更新、*乃至删除*
——都是一次追加。新数据先落入内存，之后作为不可变的有序文件批量刷到磁盘。这让写变成
顺序的、飞快的，但把代价推给了读（一个 key 可能存在于若干文件中的任意一个）和空间
（旧版本越积越多）。三个模式协同工作，让这笔交易划算。

| 问题 | 模式 | LevelDB 如何回答 |
|------|------|------------------|
| *如何让写飞快且永不随机？* | **LSM 树** | 先写内存表；分批刷出有序、不可变的文件 |
| *读取如何避开不可能含 key 的数据块？* | **布隆过滤器** | 每个数据块一个小位数组，O(1) 回答"绝对不在这里" |
| *如何不重写文件就能删除？* | **墓碑** | 删除只是又一次追加——一个隐藏旧版本的标记 |

## 模式 1 —— LSM 树：写入内存，分批刷出有序文件

LevelDB 从不就地编辑文件。每次写都先进入一个内存中的有序表（*memtable*）。
`MemTable::Add` 是入口——注意它做了什么：它把 key、一个*序列号*（一个每次操作都递增
的写入计数器，之后用来区分记录的新旧）、和一个*值类型*（一个标记，表明这是真实值还是
删除标记——见模式 3）编码后，把整条记录追加进一块 *arena*（一块预分配的内存缓冲区，
批量分配内存块，避免每次都单独 `malloc`）。没有磁盘寻道，没有页面分裂。

```cpp
void MemTable::Add(SequenceNumber s, ValueType type, const Slice& key,
                   const Slice& value) {
  // Format of an entry is concatenation of:
  //  key_size, key bytes, value_size, value bytes
  size_t key_size = key.size();
  size_t val_size = value.size();
  size_t internal_key_size = key_size + 8;
  // ...allocate, then EncodeFixed64(p, (s << 8) | type)...
}
```

当 memtable 写满，LevelDB 把它刷到磁盘，成为一个 **SSTable**（Sorted String Table，
有序字符串表）：一个不可变、有序的文件，用单次顺序写一遍写出——这是最快的磁盘写方式。
读取先查 memtable，再从新到旧查各个 SSTable。随时间推移，后台**合并（compaction）**
会归并 SSTable，丢弃被取代的版本。结果是：写永远是顺序的，而"有序文件"这一不变式在
后台惰性维护，而非每次写都维护。

::: tip 心智模型
B 树就像编辑一本印好的百科全书：要加一个词条，你得找到确切那一页塞进去，可能要让整卷
重新排版。LSM 树则像用桌上的便签本：你在最上面随手记新便签（快），定期有个文员把便签
归档进有序的活页夹（compaction）。写永远很便宜；归档之后再做、批量做、在关键路径之外做。
:::

→ 单独看这个模式，见 [LSM 树](/zh/patterns/lsm-tree/)。

## 模式 2 —— 布隆过滤器：跳过不可能含 key 的数据块

LSM 这笔交易有代价：一个 key 可能在 memtable 或*任意*一个 SSTable 里，所以一次查找
可能要读多个文件。仅仅为了发现 key 不在而从磁盘读一个数据块，就是浪费的 I/O。LevelDB
在每个 SSTable 内部存放**布隆过滤器**——每个*数据块*一个小位数组——它们 O(1) 回答
"这个 key *可能*在这个数据块里吗？"且无需读盘。`KeyMayMatch` 就是这次探测：

```cpp
bool KeyMayMatch(const Slice& key, const Slice& bloom_filter) const override {
  const size_t len = bloom_filter.size();
  // ...
  uint32_t h = BloomHash(key);
  const uint32_t delta = (h >> 17) | (h << 15);  // Rotate right 17 bits
  for (size_t j = 0; j < k; j++) {
    const uint32_t bitpos = h % bits;
    if ((array[bitpos / 8] & (1 << (bitpos % 8))) == 0) return false;
    h += delta;
  }
  return true;
}
```

这个逻辑是非对称的，而这正是要点：如果 `k` 个哈希位中*任意一个*为 0，那么 key
**绝对不在**这个数据块里——返回 `false`，跳过这个块，不读盘。如果 `k` 个位全为 1，
key *很可能*存在，于是 LevelDB 读这个块去确认。（这 `k` 个位的位置是廉价得来的：用
*一个*哈希值，每轮再加上一个旋转后的 `delta`——这是用来模拟 `k` 个独立哈希、而不必真
算 `k` 个的标准技巧。）假阳性偶尔浪费一次读；假阴性永不发生。所以过滤器把"读每个候选
数据块"变成了"只读那几个可能真含 key 的"。

::: tip 心智模型
布隆过滤器是个拿着粗略宾客名单的门卫。问"Alice 在里面吗？"——"不在"是确定的（她绝对
没进）。"在"则意味着"可能，去查查看"。只有门卫没把你排除时，你才走进去（读那个块）。
一个廉价的 O(1)"不在"，省下一趟昂贵的进门。
:::

→ 单独看这个模式，见 [布隆过滤器](/zh/patterns/bloom-filter/)。

## 模式 3 —— 墓碑：靠追加删除，而非擦除

这里有个追加式设计自己制造的问题：如果 SSTable 不可变，那怎么*删除*一个 key？你没法
打开一个旧文件擦掉那条记录。LevelDB 的答案是让删除*看起来和写一模一样*——它追加一个
叫**墓碑**的特殊标记。在源码里，这只是一个枚举的取值：

```cpp
enum ValueType { kTypeDeletion = 0x0, kTypeValue = 0x1 };
```

这一行就是全部思想。每一条记录——经由模式 1 里那个接收 `ValueType type` 的同一个
`MemTable::Add`——都被打上 `kTypeValue`（真实值）或 `kTypeDeletion`（墓碑）标签。删除
通过与任何 put *同一条快速追加路径*写下一个墓碑。读取时，LevelDB 从新到旧扫描，在该
key 的第一条记录处停下：如果是墓碑，这个 key 就被报告为不存在——即便更低层的 SSTable
里还躺着更旧的存活版本。举个例子：`Put(x, 1)` 然后 `Delete(x)`。之后的 `Get(x)` 先
碰到墓碑（它最新），于是报告"未找到"，尽管旧的 `x=1` 记录还物理存在于一个更旧的文件里。
那些陈旧版本和墓碑本身，会在之后的 compaction 期间被移除。

::: tip 心智模型
你没法把账本上的墨水擦掉。要"删除"一条记录，你不去涂改它——你写下新的一行："X 条作废"。
任何自上而下读的人都先看到这条作废，于是把 X 当作没了。旧的那行一直在，直到有人重抄
账本（compaction）时把作废的条目略去不抄。
:::

→ 单独看这个模式，见 [墓碑](/zh/patterns/tombstone/)。

## 三者如何组合

一次 `Put`、一次 `Get`、一次 `Delete` 都流经同一套"先追加"的机器：

```text
  Put(k,v)    ──► MemTable::Add(seq, kTypeValue, k, v)   ─┐
  Delete(k)   ──► MemTable::Add(seq, kTypeDeletion, k, "") ┤ same fast append path
                          │                                 │
                          ▼  (memtable full)
                  flush → immutable sorted SSTable  ◄── sequential write
                          │   + Bloom filters (one per data block)
                          ▼
  Get(k) ──► check memtable, then each SSTable newest→oldest:
                  Bloom filter says "not here"? ──► skip block, no disk read
                  says "maybe"? ──► read block; first hit wins
                                    (tombstone ⇒ report "not found")
                          │
                          ▼
              background compaction merges files,
              drops superseded values AND tombstones
```

统一的思想是**把每一次变更都变成廉价的追加；代价之后在后台再付**。LSM 树把*写*变成
追加（内存，然后一次批量顺序刷盘）。墓碑把*删除*也变成追加——就是那同一条代码路径，
只靠一个 `ValueType` 区分。而布隆过滤器偿付的是这种"全部追加"设计制造的*读*代价，
靠 O(1) 跳过数据块。去掉任何一个就崩了：没有 LSM 树就没有快速写路径；没有墓碑，删除
就得重写不可变文件；没有布隆过滤器，每次读都得从磁盘取候选数据块，只为发现 key 不在。

::: info 架构层面的推断
把这些模式诠释为一个*刻意组合*的设计——以"现在追加、之后合并"为统一主线——依据的是
LevelDB 自己的文档（见延伸阅读），而非任何单个源文件。按模式的代码链接是直接的源码
证据；"按设计组合"这一论断由那些设计层面的材料支撑。
:::

## 生产验证

所有源码链接都锁定到 LevelDB 提交
`99b3c03b3284f5886f9ef9a4ef703d57373e61be`（标签 `1.23`）。按模式的论断是
`source-code`（L1）；组合关系由官方文档（`official-doc`）支撑。

| 模式 / 论断 | 来源 | 证据 | 在 LevelDB 中的角色 |
|-------------|------|------|---------------------|
| LSM 树 | [memtable.cc#L76-L97](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/db/memtable.cc#L76-L97) | source-code | `MemTable::Add`——一次写是内存追加，而非磁盘寻道 |
| 布隆过滤器 | [bloom.cc#L56-L80](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/util/bloom.cc#L56-L80) | source-code | `KeyMayMatch`——有一个 0 位 ⇒"绝对不在这个数据块"，跳过它 |
| 布隆过滤器（构建） | [bloom.cc#L28-L54](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/util/bloom.cc#L28-L54) | source-code | `CreateFilter`——位数组由每个 key 的 k 个哈希置位 |
| 墓碑 | [dbformat.h#L54](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/db/dbformat.h#L54) | source-code | `ValueType { kTypeDeletion, kTypeValue }`——删除是一种值类型 |
| 组合（按设计） | [LevelDB documentation (impl)](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/doc/impl.md) | official-doc | LevelDB 自己关于 memtable、SSTable 与 compaction 的实现说明 |

## 要点

- **模式很少单独出现。** 一个写优化存储同时需要一个*写*模式（LSM 树）、一个*读加速*
  模式（布隆过滤器）和一个*删除*模式（墓碑）——每一个回答的都是其他模式制造出的代价。
- **一个思想能统一整个系统。** "现在追加、之后合并"是 memtable 刷盘、墓碑、惰性后台
  归并三件事背后的同一原则。在三个子系统背后认出同一个思想，正是深度读源码的回报。
- **删除"只是一种值类型"是优雅的内核。** `kTypeDeletion` 让删除复用整条快速写路径；
  不可变性得以保持，因为没有任何东西被擦除——只是被取代。
- **这呼应了 Git 和 PostgreSQL。** 三者都从不覆盖：Git 添加对象，PostgreSQL 添加元组
  版本，LevelDB 追加记录和墓碑。"追加新的、绝不修改"是一个值得在各处都认出的跨领域思想。

## 延伸阅读

一条从"我读过这个"到"我能在任何地方认出这些模式"的路径：

1. **先读设计说明**——LevelDB 自己的
   [实现文档](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/doc/impl.md)
   描述了 memtable、SSTable 与 compaction——先读这个；源码随后会确认它。
2. **理解文件格式**——
   [表格式文档](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/doc/table_format.md)
   展示了布隆过滤器（"meta"块）在每个 SSTable 内部的位置。
3. **然后按这个顺序读源码**——写的追加
   ([MemTable::Add](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/db/memtable.cc#L76-L97))
   → 读的过滤
   ([KeyMayMatch](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/util/bloom.cc#L56-L80))
   → 删除标记
   ([ValueType](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/db/dbformat.h#L54))。
4. **跨系统对比**——读 [PostgreSQL MVCC 案例研究](/zh/case-studies/postgres-mvcc)
   和 [Git commit 案例研究](/zh/case-studies/git-commit)，然后注意三者都共享"绝不覆盖、
   追加一个新版本"，只是机制不同。
5. **练习辨认**——打开下面三个模式页，在另一个系统里寻找"现在追加、之后合并"的影子。

## 延伸学习这些模式

- [LSM 树](/zh/patterns/lsm-tree/) —— 把写缓冲在内存里，刷出有序文件
- [布隆过滤器](/zh/patterns/bloom-filter/) —— O(1) 的"绝对不存在"检查
- [墓碑](/zh/patterns/tombstone/) —— 标记为删除，而非擦除
