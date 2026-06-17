---
title: '案例研究：Git 如何在一次提交中组合三种模式'
description: 深入剖析 Git 的提交机制如何组合内容寻址的写时复制对象、Merkle DAG 与 Myers diff——每一处论断都由固定 commit 上的源码佐证。
---

# 案例研究：Git 如何在一次提交中组合三种模式

> **这是什么。** 大多数模式文档孤立地讲解一个模式。本案例研究反其道而行：它剖析单个真实系统——Git 的对象存储——如何组合 **三种** 模式，使一次提交同时做到节省空间、可防篡改、且易于比较。每一处针对单个模式的论断都链接到固定 commit 上的源码；组合关系的论证则由 Git 自己的文档支撑。

## Git 解决的问题

版本控制系统必须存储一个项目的完整历史，并让你在其中任意两点之间瞬间切换。朴素的做法意味着为每个版本保留每个文件的完整副本——这会让磁盘爆炸——或者把增量存成一条长到检出旧版本都变慢的链条。Git 还有第二个、更难的要求：历史必须 **可防篡改**。如果任何一个历史文件被悄悄改了一个字节，Git 必须能察觉。

Git 的答案是一个 **以内容自身哈希作为地址** 的对象存储。要同时做到"磁盘占用小 + 可证明未被改动 + 比较快"，需要三种模式协同工作。它们单独看都不新颖——真正有启发性的是 *它们如何组合*。

| 问题 | 模式 | Git 如何回答 |
|----------|---------|--------------------|
| *如何避免复制未改动的数据？* | **写时复制** | 内容寻址的对象；相同内容只存一次并共享 |
| *如何证明没有任何东西被篡改？* | **Merkle 树** | 每个对象的名字就是其内容（含子节点哈希）的哈希 |
| *如何展示版本之间改了什么？* | **Diff / Patch** | Myers diff 按需计算最小编辑脚本 |

## 模式 1 —— 写时复制：内容寻址的对象

Git 从不把文件存在它的路径下。它把文件的 *内容* 存在 **该内容的哈希** 之下。把字节变成名字的函数是 `hash_object_file`：

```c
void hash_object_file(const struct git_hash_algo *algo, const void *buf,
                      unsigned long len, enum object_type type,
                      struct object_id *oid)
{
  char hdr[MAX_HEADER_LEN];
  int hdrlen = sizeof(hdr);
  write_object_file_prepare(algo, buf, len, type, oid, hdr, &hdrlen);
}
```

它产出的 `oid`（对象 id）*就是* 存储键。这白白带来了写时复制：如果两个提交包含同一个文件，它们引用同一个对象 id，于是这些字节只存 **一次**。一个新提交只写入内容确实变了的对象；其余一切都通过引用共享。

::: tip 心智模型
把对象存储想成一个以内容为键的哈希表：`oid → bytes`。"编辑"一个文件从不修改某个对象——它创建一个 *新* 对象、起一个 *新* 名字，旧的原封不动。旧提交继续指向旧名字，因此不受影响。这种不可变性正是写时复制的含义。
:::

→ 单独了解该模式，见 [Copy-on-Write](/zh/patterns/copy-on-write/)。

## 模式 2 —— Merkle 树：向上冒泡的哈希

为单个文件做内容寻址很容易。精妙之处在于 Git 如何为一个 *目录* 命名。一个 tree 对象列出它的条目——每个条目是一个 mode、一个名字，以及它 **子对象的 object id**——然后对这个列表求哈希。子节点的哈希是父节点内容的一部分，因此父节点的哈希依赖于它：

```c
strbuf_addf(&buffer, "%o %.*s%c", mode, entlen, path + baselen, '\0');
strbuf_add(&buffer, oid->hash, the_hash_algo->rawsz);   // ← child hash goes in
/* ...for every entry... */
hash_object_file(the_hash_algo, buffer.buf, buffer.len, OBJ_TREE, &it->oid);
```

这是一个 **Merkle DAG**：改动某个文件中的一个字节，它的对象 id 就变了；这个新 id 改变了包含它的 tree 的哈希；进而改变其上每一层 tree 的哈希，一直到 commit。因此一个 commit 哈希为从它可达的 *整棵* 内容树打上指纹。

::: tip 心智模型
Merkle 性质把"完整性"变成一次比较。要检查两棵庞大的目录树是否相同，你 **不必** 遍历它们——只比较它们的顶层哈希。哈希相等 ⇒ 内容自上而下完全相同。这也是你无法悄悄篡改旧历史的原因：那样做会改变一个被下游一切所承诺的哈希。
:::

→ 单独了解该模式，见 [Merkle Tree](/zh/patterns/merkle-tree/)。

## 模式 3 —— Diff / Patch：按需计算变化

因为对象是不可变且内容寻址的，Git **不** 存储"改了什么"——它存储完整的快照，并在你询问时（`git diff`、`git log -p`、重命名检测）*计算* 差异。`run_diff` 是产出两个 blob 之间编辑脚本的入口：

```c
static void run_diff(struct diff_filepair *p, struct diff_options *o)
{
  struct diff_filespec *one = p->one;   // old version
  struct diff_filespec *two = p->two;   // new version
  /* ...resolve paths, fill oid info, then run the diff algorithm... */
  diff_fill_oid_info(one, o->repo->index);
}
```

其底层运行的是 Myers 风格的最小编辑距离 diff（在 `xdiff/` 中），把"快照 A"和"快照 B"转化为能解释该变化的、最小的一组行插入/删除。

::: warning 逻辑模型 vs. 磁盘存储
"存储完整快照"是**逻辑**模型：每个版本都是一个完整的、内容寻址的对象。在磁盘上，Git 随后会把这些对象重打包进 *packfile*，对相似对象做 delta 压缩（zlib + delta 链），所以它并非真的为每个版本保留一份完整未压缩副本。二者并不矛盾——diff 仍然是从逻辑快照按需计算的；打包只是一项独立的存储优化。
:::

::: tip 心智模型
快照是真相之源；diff 是从它们计算出的 *视图*。这反转了朴素设计（存增量、重建快照）：Git 通过共享廉价地存储快照，只在人类真的想看变化时才付出 diff 的代价。
:::

→ 单独了解该模式，见 [Diff / Patch](/zh/patterns/diff-patch/)。

## 三者如何组合

运行 `git commit`，三个模式按顺序交接：

1. **Diff / Patch** 是你 *用来* 决定暂存什么时所看的东西——但它是一个视图，不是存储。提交本身存储的是快照。
2. **写时复制** 只为内容变了的部分写入新对象；每个未改动的 blob 和子树都通过其已有的对象 id 复用。
3. **Merkle 树** 自底向上地对新 tree 求哈希——每个父节点的哈希都折入其子节点的哈希——产出一个为整个快照打指纹的 commit 哈希。

```text
edit files
    │  (diff/patch: a *view* of what changed — not stored)
    ▼
write changed blobs only ───► content-addressed objects (copy-on-write)
    │                             identical content shared by oid
    ▼
build tree objects bottom-up
    │  each entry embeds child oid.hash, then hash_object_file(OBJ_TREE)
    ▼
commit hash = fingerprint of the entire reachable tree (Merkle DAG)
```

最终结果：一次提交是 **廉价的**（只写入变了的对象）、**可验证的**（一个哈希覆盖一切可达内容）、且 **可比较的**（任意两个提交可按需比较）。去掉其中任意一个模式它都会崩塌：没有内容寻址就没有共享、也没有稳定的名字；没有 Merkle 结构，一个哈希就无法覆盖整棵树，篡改便无从察觉；没有按需 diff，Git 就只能在"存臃肿的快照"和"存臃肿的增量"之间二选一。

::: info 架构推断
把这三者描述为一个 *有意组合* 的设计，依据的是 Git 自己对其对象模型的文档（见证据表与延伸阅读），而非任何单个源码文件。针对单个模式的代码链接是直接的源码证据；而"被有意组合在一起"这一论断，由那些设计层级的材料支撑。
:::

## 生产验证

所有源码链接均固定到 Git commit `1ff279f3404a482a83fb04c7457e41ab26884aea`。针对单个模式的论断属于 `source-code`（L1）；组合关系则由官方文档（`official-doc`）支撑。

| 模式 / 论断 | 来源 | 证据类型 | 在 `git commit` 中的角色 |
|-----------------|--------|----------|----------------------|
| 写时复制 | [object-file.c#L719-L730](https://github.com/git/git/blob/1ff279f3404a482a83fb04c7457e41ab26884aea/object-file.c#L719-L730) | source-code | `hash_object_file` 以内容哈希命名内容 → 相同内容只存一次 |
| Merkle 树 | [cache-tree.c#L435-L458](https://github.com/git/git/blob/1ff279f3404a482a83fb04c7457e41ab26884aea/cache-tree.c#L435-L458) | source-code | 每个 tree 条目嵌入其子节点的 `oid->hash`，随后对 tree 本身求哈希 |
| Diff / Patch | [diff.c#L5020-L5060](https://github.com/git/git/blob/1ff279f3404a482a83fb04c7457e41ab26884aea/diff.c#L5020-L5060) | source-code | `run_diff` 按需计算两个 blob 版本之间的编辑脚本 |
| 组合（有意为之） | [Pro Git — Git Objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects) | official-doc | 官方对提交所基于的内容寻址对象模型的解释 |

## 要点

- **模式很少单独出现。** 一个版本控制对象存储同时需要一个 *存储* 模式（写时复制）、一个 *完整性* 模式（Merkle 树）和一个 *比较* 模式（diff/patch）——而且它们按顺序交接。
- **存储快照、计算 diff。** Git 反转了朴素的"存增量"设计：不可变性 + 共享让快照变得廉价，而 diff 成为只在需要时才产生的视图。
- **对内容求哈希是统一三者的关键。** 内容寻址同时是共享键（写时复制）和完整性指纹（Merkle）——一种原语做两件事，正如 React Fiber 案例研究里的位掩码。
- **跟随数据，而非命令。** `git commit` 读起来像一个动作，但追踪它 *写入* 了什么，会揭示三个模式相互咬合。

## 延伸阅读

一条从"我读过了"走向"我能在任何地方认出这些模式"的路径：

1. **先从对象模型开始** —— [Pro Git：Git Objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects) 把 blob、tree、commit 解释为内容寻址的对象。先读这个；其余一切都在印证它。
2. **然后按这个顺序读源码** —— 内容哈希（[object-file.c](https://github.com/git/git/blob/1ff279f3404a482a83fb04c7457e41ab26884aea/object-file.c#L719-L730)）→ tree 如何把子节点哈希向上折叠（[cache-tree.c](https://github.com/git/git/blob/1ff279f3404a482a83fb04c7457e41ab26884aea/cache-tree.c#L435-L458)）→ 按需 diff（[diff.c](https://github.com/git/git/blob/1ff279f3404a482a83fb04c7457e41ab26884aea/diff.c#L5020-L5060)）。
3. **本地动手实验** —— 运行 `git cat-file -p HEAD^{tree}` 看一个真实 tree 对象的条目，然后 `git hash-object` 一个文件、观察相同内容返回相同的名字。看到哈希保持稳定，会让写时复制和 Merkle 性质变得具体。
4. **练习这种识别力** —— 打开下面三个模式页；然后在你熟悉的另一个系统里，寻找同样的三种角色（存储 / 完整性 / 比较），比如一个内容寻址缓存或一条区块链。
5. **换个角度看它的讲解** —— Julia Evans 的 [Inside .git](https://jvns.ca/blog/2024/01/26/inside-git/) 交互式地走了一遍同一个对象模型，是阅读源码的绝佳补充。

## 延伸学习这些模式

- [Copy-on-Write](/zh/patterns/copy-on-write/) —— 共享，直到一次写入迫使复制
- [Merkle Tree](/zh/patterns/merkle-tree/) —— 让篡改可被察觉的哈希
- [Diff / Patch](/zh/patterns/diff-patch/) —— 版本间的最小编辑脚本
