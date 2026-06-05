---
description: "Git 的模式运用：写时复制对象、默克尔树完整性验证和差异/补丁最小变更。"
---

# Git 中的模式

Git 的数据模型建立在写时复制的不可变对象和高效差异比较之上。

| 模式 | 位置 | 作用 |
|------|------|------|
| [写时复制](/zh/patterns/copy-on-write/) | [`object-file.c`](https://github.com/git/git/blob/master/object-file.c#L719-L730) | 内容寻址不可变对象，分支共享数据 |
| [差异/补丁](/zh/patterns/diff-patch/) | [`diff.c`](https://github.com/git/git/blob/master/diff.c#L5020-L5060), `xdiff/` | Myers 差异算法 |
| [位掩码](/zh/patterns/bitmask/) | [`read-cache-ll.h`](https://github.com/git/git/blob/master/read-cache-ll.h) | `CE_*` 缓存条目标志——暂存、有效、intent-to-add |
| [布隆过滤器](/zh/patterns/bloom-filter/) | [`bloom.c`](https://github.com/git/git/blob/master/bloom.c) | 变更路径布隆过滤器，加速 `git log -- <path>` |
| [Trie 前缀树](/zh/patterns/trie/) | [`read-cache.c`](https://github.com/git/git/blob/master/read-cache.c) | 名称哈希表用于快速目录级路径查找 |
| [LRU 缓存](/zh/patterns/lru-cache/) | [`pack-objects.c`](https://github.com/git/git/blob/master/pack-objects.c) | Delta 基础缓存，复用已计算的 delta |
| [默克尔树](/zh/patterns/merkle-tree/) | [`tree.c`](https://github.com/git/git/blob/master/tree.c#L136-L171) | 内容寻址 Merkle DAG——每个 commit、tree、blob 均哈希，改一字节则所有哈希上推至根 |

## 模式如何组合：`git commit`

当你执行 `git commit` 时，多个模式协同工作，创建一个不可变、可验证的快照：

<CompositionFlow variant="git-commit" />

核心洞察是写时复制 + Merkle 哈希同时赋予了 Git 空间效率（共享对象）和完整性验证（防篡改哈希），两者之间没有任何权衡。

## 延伸阅读

- [Git Source Code (GitHub)](https://github.com/git/git)
