# Git 中的模式

| 模式 | 位置 | 作用 |
|------|------|------|
| [写时复制](/zh/patterns/copy-on-write/) | `object-file.c` | 内容寻址不可变对象，分支共享数据 |
| [差异/补丁](/zh/patterns/diff-patch/) | `diff.c`, `xdiff/` | Myers 差异算法 |
| [位掩码](/zh/patterns/bitmask/) | `cache.h` | `CE_*` 缓存条目标志——暂存、有效、intent-to-add |
| [布隆过滤器](/zh/patterns/bloom-filter/) | `bloom.c` | 变更路径布隆过滤器，加速 `git log -- <path>` |
| [Trie 前缀树](/zh/patterns/trie/) | `read-cache.c` | 名称哈希表用于快速目录级路径查找 |
| [LRU 缓存](/zh/patterns/lru-cache/) | `pack-objects.c` | Delta 基础缓存，复用已计算的 delta |
| [默克尔树](/zh/patterns/merkle-tree/) | `tree.c` | 内容寻址 Merkle DAG——每个 commit、tree、blob 均哈希，改一字节则所有哈希上推至根 |
