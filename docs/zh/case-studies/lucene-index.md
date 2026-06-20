---
title: '案例研究：Lucene 如何组合三种模式实现快速全文检索'
description: 深入剖析 Apache Lucene 如何组合多层跳表、归并迭代器与可选的布隆过滤器，使词项查找跳跃前进、段合并保持流式、缺失词项以 O(1) 被拒——每一处论断都由固定 commit 上的源码佐证。
---

# 案例研究：Lucene 如何组合三种模式实现快速全文检索

> **这是什么。** 大多数模式文档孤立地讲解一个模式。本案例研究反其道而行：它剖析单个真实系统——Apache Lucene，Elasticsearch 与 Solr 之下的检索库——如何组合 **三种** 模式，使扫描一条长倒排列表时跳跃前进而非逐条走、合并众多不可变段时保持流式归并、且一个不存在的词项无需触碰词典就被拒绝。每一处针对单个模式的论断都链接到固定 commit 上的源码；组合关系的论证则由 Lucene 自己的架构文档支撑。

## Lucene 解决的问题

全文检索把数据反转过来：Lucene 不存"文档 → 它的词"，而是为每个词项保存一个 *倒排列表（postings list）*——"词 → 包含它的每个文档"。查询 `cat AND dog` 意味着把 `cat` 的倒排列表与 `dog` 的求交。由此带来三个难点：

- **倒排列表很长。** 一个常见词会出现在数百万个文档里。一次一个 doc id 地走列表来找匹配，实在太慢。
- **索引是众多不可变的段。** Lucene 从不就地编辑索引；它写出新的不可变 *段（segment）* 并在后台合并它们。一个词项的完整倒排，必须靠按 doc id 顺序归并它在各段的列表来组装。
- **大多数段并不包含大多数词项。** 一次查找只为发现词项不在某段，却查了该段的词典，这是被浪费的工作——在每个段、每个被查词项上反复发生。

三种模式依次回答这些问题——而第三种是一个 *可选* 组件，你在工作负载值得时才启用它。

| 问题 | 模式 | Lucene 如何回答 |
|----------|---------|-----------------------|
| *如何在一条长倒排列表里向前跳？* | **跳表** | 倒排之上的多层跳表让 `advance(target)` 以 `O(log n)` 跳跃，而非扫描 |
| *如何跨众多段按序读取同一词项？* | **归并迭代器** | 一个优先队列驱动的归并，按全局顺序吐出所有段倒排的 doc id |
| *如何在不查词典的前提下拒绝一个不存在的词项？* | **布隆过滤器** | 一个可选的、每段一份的布隆过滤器以 `O(1)` 回答"一定不在这里" |

## 模式 1 —— 跳表：跳跃前进，而非扫描

像 `cat AND dog` 这样的查询会反复问 `cat` 的倒排列表"给我你第一个 ≥ 我刚从 `dog` 拿到的那个的 doc id"。靠一次一个文档地向前扫描来回答是 `O(n)`。Lucene 转而在每条倒排列表之上建一个 **多层跳表**，让 `advance`/`skipTo` 能跳。`MultiLevelSkipListReader.skipTo` 是其核心：

```java
public int skipTo(int target) throws IOException {
  // walk up the levels until highest level is found that has a skip for this target
  int level = 0;
  while (level < numberOfSkipLevels - 1 && target > skipDoc[level + 1]) {
    level++;
  }
  while (level >= 0) {
    if (target > skipDoc[level]) {
      if (!loadNextSkip(level)) continue;
    } else {
      // go down one level
      if (level > 0 && lastChildPointer > skipStream[level - 1].getFilePointer()) {
        seekChild(level - 1);
      }
      level--;
    }
  }
  return numSkipped[0] - skipInterval[0] - 1;
}
```

结构是一座链表之塔：最高层跨越巨大的跨度，每个更低层跨越更小的跨度。`skipTo(target)` 爬到其下一跳仍超过 `target` 的最高层，然后下降，在每层取不超过 `target` 的最大跳跃。效果是经典的跳表 `O(log n)` 查找——Redis 用于有序集合的同一结构，这里被应用到 doc id 倒排上。

::: tip 心智模型
跳表是铺在普通线之上的一张特快列车线路图。顶层轨道只停大站（大跳跃）；更低层停得更频繁。要到某一站，你乘不会坐过站的最快线路，再换乘下行。倒排列表是普通线；跳表层是特快。
:::

→ 单独了解该模式，见 [Skip List](/zh/patterns/skip-list/)。

## 模式 2 —— 归并迭代器：跨众多段按序读取同一词项

因为 Lucene 写不可变段、并惰性合并它们，一个词项的完整倒排散落在若干段中。要合并段——或跨段读取一个词项——Lucene 必须按单个升序流从所有段产出 doc id。`MappingMultiPostingsEnum.nextDoc` 是跨段倒排的归并迭代器：

```java
public int nextDoc() throws IOException {
  current = docIDMerger.next();
  if (current == null) {
    return NO_MORE_DOCS;
  } else {
    return current.mappedDocID;
  }
}
```

`docIDMerger` 是一个以 doc id 为键的优先队列：每次 `next()` 弹出当前停在最小 doc id 的子迭代器，让它前进，再重新调整堆。结果是一个单一迭代器，按全局 doc id 顺序流式吐出归并后的倒排，而无需把它们全部物化在内存里——教科书级的 **k 路归并**。`mappedDocID` 这一步把 id 重新编号进合并后段的地址空间。

::: tip 心智模型
合并段就像把几摞已排序的卡片交错并成一摞已排序的卡片。你反复取任意一摞顶上显示的最小卡片放下，然后翻开那一摞的下一张。一个优先队列追踪"哪一摞显示的卡片最小"，于是每一步都廉价。你从不需要把所有卡片一次拿在手里。
:::

→ 单独了解该模式，见 [Merge Iterator](/zh/patterns/merge-iterator/)。

## 模式 3 —— 布隆过滤器：以 O(1) 拒绝不存在的词项

查找一个词项意味着查某段的词典。如果该词项不在那个段，这次查找就被浪费了——而跨众多段、众多被查词项，这种浪费会累积。Lucene 提供一个 **可选的** `BloomFilteringPostingsFormat`（在 `lucene-codecs` 模块，不是默认 codec），它保有一个每字段一份的布隆过滤器，使一个确定不存在的词项在任何词典工作之前就被拒绝。`FuzzySet.contains` 是那次测试：

```java
public ContainsResult contains(BytesRef value) {
  long hash = hashFunction.hash(value);
  int msb = (int) (hash >>> Integer.SIZE);
  int lsb = (int) hash;
  for (int i = 0; i < hashCount; i++) {
    int bloomPos = (lsb + i * msb);     // k hashes via one hash + delta rotation
    if (!mayContainValue(bloomPos)) {
      return ContainsResult.NO;         // definitely not present — skip the dictionary
    }
  }
  return ContainsResult.MAYBE;          // possibly present — go check the dictionary
}
```

注意 `lsb + i * msb` 这个技巧：Lucene 不去计算 `hashCount` 个独立的哈希函数，而是从单个 64 位哈希拆成的两半派生出全部 `k` 个比特位置——与 LevelDB 用的双哈希捷径相同。契约是非对称的：`NO` 是确定的（完全跳过词典），`MAYBE` 意味着"去做真正的查找"。因为它是可选的，所以是一个纯粹的速度/空间权衡，你只在许多查询探测的词项在大多数段中缺失时才启用它。

::: tip 心智模型
布隆过滤器是一个把宾客名单压进几个比特的门卫。问"`xyzzy` 在里面吗？"，一个 `NO` 是终局的——别费劲开门（词典）了。一个 `MAYBE` 只意味着"去查真正的名单"。门卫永远不会错误地拒掉一位真宾客（没有假阴性），只会偶尔放进一个非宾客（假阳性）。
:::

→ 单独了解该模式，见 [Bloom Filter](/zh/patterns/bloom-filter/)。

## 三者如何组合

对一个由众多段组成的索引运行一个多词项查询，三个模式依次交接：

1. **布隆过滤器**（`FuzzySet.contains`）在启用时，置于每段词项查找之前：一个 `NO` 就对该词项完全跳过那个段的词典。
2. **跳表**（`MultiLevelSkipListReader.skipTo`）加速段内的倒排扫描：`advance(target)` 以 `O(log n)` 向前跳，而非逐文档走——这正是让 `AND` 求交变快的原因。
3. **归并迭代器**（`MappingMultiPostingsEnum.nextDoc`）按全局 doc id 顺序跨所有段流式吐出一个词项的倒排——既在查询时，也在维持索引健康的后台段合并中。

```text
query: cat AND dog   (index = many immutable segments)
        │
        │  (bloom: FuzzySet.contains → NO ⇒ skip this segment's dictionary for the term)
        ▼
   per-segment term lookup (only where MAYBE)
        │  (skip list: skipTo(target) leaps ahead in the postings — O(log n) advance)
        ▼
   per-segment postings iterators
        │  (merge iterator: docIDMerger.next() yields doc ids in global order)
        ▼
   single ascending doc-id stream  ──►  intersect for AND, score, return
```

统一这一切的思想是 **让每次扫描都跳过它能证明无必要的工作**。布隆过滤器跳过整个装不下该词项的段；跳表跳过倒排列表里装不下目标的跨度；归并迭代器靠每一步只流式吐出最小者，避免物化全部倒排。去掉其中任意一个它都会退化：没有跳表，求交就要走过每一个倒排项；没有归并迭代器，跨段读取就要缓冲一切；没有（可选的）布隆过滤器，每次缺失词项的探测都要付一次词典查找。

::: info 架构推断
把这三者描述为一个 *有意组合* 的设计——跳跃加速的倒排、流式的段合并，以及可选的布隆过滤词项查找——依据的是 Lucene 的 codec/段架构文档与核心 committer 的论述（见延伸阅读），而非任何单个源码文件。针对单个模式的代码链接是直接的源码证据；而"被有意组合在一起"这一论断，由那些设计层级的材料支撑。布隆过滤器明确是一个 *可选* 的 codec，并非默认索引的一部分。
:::

## 生产验证

所有源码链接均固定到 Apache Lucene commit `e913796758de3d9b9440669384b29bec07e6a5cd`（release 9.12.0）。针对单个模式的论断属于 `source-code`（L1）；组合关系则由官方文档（`official-doc`）与核心 committer 的论述（`official-blog`）支撑。

| 模式 / 论断 | 来源 | 证据类型 | 在查询 / 合并中的角色 |
|-----------------|--------|----------|-------------------------|
| 跳表 | [MultiLevelSkipListReader.java#L112-L135](https://github.com/apache/lucene/blob/e913796758de3d9b9440669384b29bec07e6a5cd/lucene/core/src/java/org/apache/lucene/codecs/MultiLevelSkipListReader.java#L112-L135) | source-code | `skipTo` 借助多层跳表结构以 `O(log n)` 跨过一条倒排列表 |
| 归并迭代器 | [MappingMultiPostingsEnum.java#L99-L107](https://github.com/apache/lucene/blob/e913796758de3d9b9440669384b29bec07e6a5cd/lucene/core/src/java/org/apache/lucene/index/MappingMultiPostingsEnum.java#L99-L107) | source-code | `nextDoc` 从跨段倒排的优先队列归并中弹出最小 doc id |
| 布隆过滤器（可选） | [FuzzySet.java#L152-L163](https://github.com/apache/lucene/blob/e913796758de3d9b9440669384b29bec07e6a5cd/lucene/codecs/src/java/org/apache/lucene/codecs/bloom/FuzzySet.java#L152-L163) | source-code | `contains` 返回 `NO`/`MAYBE`，使一个缺失词项跳过词典；属可选的 `BloomFilteringPostingsFormat` |
| 组合（有意为之） | [Lucene codecs 包文档](https://lucene.apache.org/core/9_12_0/core/org/apache/lucene/codecs/package-summary.html) | official-doc | Lucene 自己对这些模式所服务的 codec/倒排/段架构的描述 |
| 组合（有意为之） | [Changing Bits（Michael McCandless）](https://blog.mikemccandless.com/) | official-blog | 一位 Lucene 核心 committer 关于段合并与跳表的论述 |

## 要点

- **模式很少单独出现。** 快速检索同时需要一个 *跳跃* 模式（跳表）、一个 *流式归并* 模式（归并迭代器）和一个 *避免查找* 模式（布隆过滤器）——而且它们沿查询路径交接。
- **每一层都跳过可证明无必要的工作。** 布隆跳过整个段，跳表跳过倒排列表的跨度，归并迭代器跳过物化一切。这个组合就是"证明它不需要，然后就不做"，重复三遍。
- **可选就是可选——要讲清楚。** Lucene 的布隆过滤器是一个你按需启用的 codec；把它描述成始终开启会误导。诚实地界定范围是论断的一部分。
- **这与 LevelDB 和 Kafka 呼应。** 归并迭代器就是驱动 LSM compaction 的同一个 k 路归并；布隆过滤器用的是 LevelDB 完全相同的双哈希技巧。读懂其一，会让另外两个的读路径更易识别。

## 延伸阅读

一条从"我读过了"走向"我能在任何地方认出这些模式"的路径：

1. **先从 codec 架构开始** —— Lucene 的 [codecs 包文档](https://lucene.apache.org/core/9_12_0/core/org/apache/lucene/codecs/package-summary.html) 解释了倒排格式、段模型，以及跳表数据与布隆过滤器各自的位置。先读这个；源码随后都在印证它。
2. **然后是一位 committer 的视角** —— [Changing Bits](https://blog.mikemccandless.com/)，Michael McCandless 的博客，从内部讲述段合并与跳表。
3. **然后浏览 API** —— [Lucene 9.12.0 Javadoc](https://lucene.apache.org/core/9_12_0/index.html) 让你追踪 `advance`、`PostingsEnum` 与各 codec 接口。
4. **跨系统对比** —— 阅读 [LevelDB LSM 案例研究](/zh/case-studies/leveldb-lsm)，注意同样的 k 路归并与布隆双哈希如何出现在一个键值存储里。同样的模式，不同的领域。

## 延伸学习这些模式

- [Skip List](/zh/patterns/skip-list/) —— 用于 `O(log n)` 查找与跳跃的概率性多层链表
- [Merge Iterator](/zh/patterns/merge-iterator/) —— 借助堆把 k 个有序输入流式归并成一个有序输出
- [Bloom Filter](/zh/patterns/bloom-filter/) —— 一个以 `O(1)` 回答"一定不存在"的微小位数组
