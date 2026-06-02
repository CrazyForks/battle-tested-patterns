# Patterns from Git

Git's data model is built on copy-on-write immutable objects and efficient diffing.

| Pattern | Where | What It Does |
|---------|-------|--------------|
| [Copy-on-Write](/patterns/copy-on-write/) | `object-file.c` | Content-addressed immutable objects; branches share data, copy only on change |
| [Diff / Patch](/patterns/diff-patch/) | `diff.c`, `xdiff/` | Myers' diff algorithm for minimal edit distance between file versions |
| [Bitmask](/patterns/bitmask/) | `cache.h` | `CE_*` cache entry flags — staged, valid, intent-to-add |
| [Bloom Filter](/patterns/bloom-filter/) | `bloom.c` | Changed-path bloom filters for faster `git log -- <path>` |
| [Trie](/patterns/trie/) | `read-cache.c` | Name hash table for fast directory-level path lookup |
| [LRU Cache](/patterns/lru-cache/) | `pack-objects.c` | Delta base cache for reusing computed deltas during pack |

## Further Reading

- [Git Source Code (GitHub)](https://github.com/git/git)
