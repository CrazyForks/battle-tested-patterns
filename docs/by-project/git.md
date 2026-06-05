---
description: "Git's pattern usage: copy-on-write objects, Merkle trees for integrity, and diff/patch for minimal changes."
---

# Patterns from Git

Git's data model is built on copy-on-write immutable objects and efficient diffing.

| Pattern | Where | What It Does |
|---------|-------|--------------|
| [Copy-on-Write](/patterns/copy-on-write/) | [`object-file.c`](https://github.com/git/git/blob/master/object-file.c#L719-L730) | Content-addressed immutable objects; branches share data, copy only on change |
| [Diff / Patch](/patterns/diff-patch/) | [`diff.c`](https://github.com/git/git/blob/master/diff.c#L5020-L5060), `xdiff/` | Myers' diff algorithm for minimal edit distance between file versions |
| [Bitmask](/patterns/bitmask/) | [`read-cache-ll.h`](https://github.com/git/git/blob/master/read-cache-ll.h) | `CE_*` cache entry flags — staged, valid, intent-to-add |
| [Bloom Filter](/patterns/bloom-filter/) | [`bloom.c`](https://github.com/git/git/blob/master/bloom.c) | Changed-path bloom filters for faster `git log -- <path>` |
| [Trie](/patterns/trie/) | [`read-cache.c`](https://github.com/git/git/blob/master/read-cache.c) | Name hash table for fast directory-level path lookup |
| [LRU Cache](/patterns/lru-cache/) | [`pack-objects.c`](https://github.com/git/git/blob/master/pack-objects.c) | Delta base cache for reusing computed deltas during pack |
| [Merkle Tree](/patterns/merkle-tree/) | [`tree.c`](https://github.com/git/git/blob/master/tree.c#L136-L171) | Content-addressed Merkle DAG — every commit, tree, blob is hashed; changing one byte changes all hashes up to root |

## How They Compose: `git commit`

When you run `git commit`, multiple patterns work together to create an immutable, verifiable snapshot:

<CompositionFlow variant="git-commit" />

The core insight is that copy-on-write + Merkle hashing gives Git both space efficiency (shared objects) and integrity verification (tamper-evident hashes) with no trade-off between the two.

## Further Reading

- [Git Source Code (GitHub)](https://github.com/git/git)
