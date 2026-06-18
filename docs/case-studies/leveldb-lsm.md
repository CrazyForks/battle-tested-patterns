---
title: 'Case Study: How LevelDB Composes Three Patterns for a Write-Optimized Store'
description: A deep dive into how LevelDB combines an LSM-tree, Bloom filters, and tombstones so writes stay fast, reads skip irrelevant files, and deletes are cheap — every claim backed by source code at a pinned commit.
---

# Case Study: How LevelDB Composes Three Patterns for a Write-Optimized Store

> **What this is.** Most pattern docs teach one pattern in isolation. This case
> study does the opposite: it dissects how one real system — LevelDB, Google's
> embedded key-value store — composes **three** patterns so that writes stay
> blazingly fast, reads avoid touching files that can't hold the key, and even
> deletes are a cheap append. Every per-pattern claim links to source code at a
> pinned commit; the composition argument is backed by LevelDB's own design docs.

## The Problem LevelDB Solves

A storage engine faces a tension. Random writes to disk are slow — seeking to the
right spot, updating it in place, and keeping an index sorted all cost I/O. A
B-tree (what most databases use) optimizes *reads* by keeping data sorted on disk,
but pays for it on *writes*: every insert may split a page and scatter random
writes across the disk.

LevelDB makes the opposite bet. It **never writes randomly and never overwrites**:
every write — insert, update, *or delete* — is an append. New data lands in memory
first and is later flushed to disk as an immutable, sorted file. This makes writes
sequential and fast, but it pushes the cost onto reads (a key might live in any of
several files) and onto space (old versions pile up). Three patterns work together
to make that trade pay off.

| Question | Pattern | How LevelDB answers it |
|----------|---------|------------------------|
| *How do we make writes fast and never random?* | **LSM-tree** | Write to an in-memory table; flush sorted, immutable files in batches |
| *How does a read avoid scanning blocks that can't hold the key?* | **Bloom filter** | A tiny per-block bit array says "definitely not here" in O(1) |
| *How do we delete without rewriting a file?* | **Tombstone** | A delete is just another append — a marker that hides older versions |

## Pattern 1 — LSM-tree: write to memory, flush in sorted batches

LevelDB never edits a file in place. Every write first goes into an in-memory
sorted table (the *memtable*). `MemTable::Add` is the entry point — and notice
what it does: it encodes the key, a *sequence number* (a write counter that
increases on every operation, used later to tell newer entries from older), and a
*value type* (a tag marking whether this is a real value or a delete marker —
see Pattern 3), then appends the whole entry into an *arena* (a pre-allocated
memory buffer that hands out chunks without a separate `malloc` each time). No disk
seek, no page split.

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

When the memtable fills, LevelDB flushes it to disk as an **SSTable** (Sorted
String Table): an immutable, sorted file written in a single sequential pass —
the fastest possible disk write. Reads check the memtable first, then the SSTables
newest-to-oldest. Over time, background **compaction** merges SSTables, discarding
superseded versions. The result: writes are always sequential, and the sorted-file
invariant is maintained lazily in the background instead of on every write.

::: tip Mental model
A B-tree is like editing a printed encyclopedia: to add an entry you find the
exact page and squeeze it in, possibly reflowing the whole volume. An LSM-tree is
like keeping a desk notepad: you jot new notes at the top (fast), and periodically
a clerk files the notes into sorted binders (compaction). Writing is always cheap;
the filing happens later, in bulk, off the critical path.
:::

→ For the pattern in isolation, see [LSM-tree](/patterns/lsm-tree/).

## Pattern 2 — Bloom filter: skip files that can't hold the key

The LSM trade has a cost: a key might live in the memtable or in *any* SSTable, so
a lookup may have to read several files. Reading a data block from disk just to
discover the key isn't there is wasted I/O. LevelDB stores **Bloom filters** inside
each SSTable — one small bit array per *data block* — that answer "is this key
*possibly* in this block?" in O(1), with no disk read. `KeyMayMatch` is the probe:

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

The logic is asymmetric and that's the point: if *any* of the `k` hashed bit
positions is 0, the key is **definitely not** in this block — return `false`,
skip the block, no disk read. If all `k` bits are 1, the key is *probably*
present, so LevelDB reads the block to confirm. (The `k` bit positions come cheaply
from *one* hash plus a rotated `delta` added each round — a standard trick to
simulate `k` independent hashes without computing `k` of them.) False positives
waste an occasional read; false negatives never happen. So the filter turns "read
every candidate block" into "read only the few that might actually contain the key."

::: tip Mental model
A Bloom filter is a bouncer with a rough guest list. Ask "is Alice inside?" and a
"no" is final — she's definitely not in. A "yes" means "probably, go check." You
only walk into the club (read the file) when the bouncer doesn't rule you out. A
cheap O(1) "no" saves an expensive trip inside.
:::

→ For the pattern in isolation, see [Bloom Filter](/patterns/bloom-filter/).

## Pattern 3 — Tombstone: delete by appending, not erasing

Here's the problem the append-only design creates: if SSTables are immutable, how
do you *delete* a key? You can't open an old file and erase the entry. LevelDB's
answer is to make a delete *look exactly like a write* — it appends a special
marker called a **tombstone**. In the source, this is just a value of an enum:

```cpp
enum ValueType { kTypeDeletion = 0x0, kTypeValue = 0x1 };
```

That one line is the whole idea. Every entry — via the same `MemTable::Add` from
Pattern 1, which takes a `ValueType type` — is tagged either `kTypeValue` (a real
value) or `kTypeDeletion` (a tombstone). A delete writes a tombstone through the
*same fast append path* as any put. On read, LevelDB scans newest-to-oldest and
stops at the first entry for the key: if it's a tombstone, the key is reported as
absent — even though older live versions may still sit in lower SSTables. For
example: `Put(x, 1)` then `Delete(x)`. A later `Get(x)` meets the tombstone first
(it's newest) and reports "not found", even though the old `x=1` entry is still
physically present in an older file. Those stale versions and the tombstone itself
are removed later, during compaction.

::: tip Mental model
You can't un-write ink in a logbook. To "delete" an entry you don't scratch it
out — you write a new line: "entry X is cancelled." Anyone reading top-down sees
the cancellation first and treats X as gone. The old line is still there until
someone recopies the logbook (compaction) and leaves the cancelled entries out.
:::

→ For the pattern in isolation, see [Tombstone](/patterns/tombstone/).

## How the Three Compose

A `Put`, a `Get`, and a `Delete` all flow through the same append-first machinery:

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

The unifying idea is **turn every mutation into a cheap append; pay the cost later,
in the background**. The LSM-tree makes *writes* an append (memory, then a batched
sequential flush). The tombstone makes *deletes* an append too — the very same
code path, distinguished only by a `ValueType`. And the Bloom filter pays down the
*read* cost that this append-everything design creates, by skipping files in O(1).
Remove any one and it breaks: without the LSM-tree there's no fast write path;
without tombstones, deletes would have to rewrite immutable files; without Bloom
filters, every read would have to fetch candidate blocks from disk just to find
the key isn't there.

::: info Architectural inference
The framing of these patterns as a *deliberately composed* design — unified by
"append now, compact later" — rests on LevelDB's own documentation (see Further
Reading), not on any single source file. The per-pattern code links are direct
source-code evidence; the "combined by design" claim is supported by that
design-level material.
:::

## Production Proof

All source links are pinned to LevelDB commit
`99b3c03b3284f5886f9ef9a4ef703d57373e61be` (tag `1.23`). Per-pattern claims are
`source-code` (L1); the composition relationship is backed by official
documentation (`official-doc`).

| Pattern / Claim | Source | Evidence | Role in LevelDB |
|-----------------|--------|----------|-----------------|
| LSM-tree | [memtable.cc#L76-L97](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/db/memtable.cc#L76-L97) | source-code | `MemTable::Add` — a write is an in-memory append, not a disk seek |
| Bloom filter | [bloom.cc#L56-L80](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/util/bloom.cc#L56-L80) | source-code | `KeyMayMatch` — one 0 bit ⇒ "definitely not in this block", skip it |
| Bloom filter (build) | [bloom.cc#L28-L54](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/util/bloom.cc#L28-L54) | source-code | `CreateFilter` — per-SSTable bit array set from k hashes of each key |
| Tombstone | [dbformat.h#L54](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/db/dbformat.h#L54) | source-code | `ValueType { kTypeDeletion, kTypeValue }` — a delete is a value type |
| Composition (by design) | [LevelDB documentation (impl)](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/doc/impl.md) | official-doc | LevelDB's own implementation notes on memtable, SSTables, and compaction |

## Takeaways

- **Patterns rarely ship alone.** A write-optimized store needs a *write* pattern
  (LSM-tree), a *read-acceleration* pattern (Bloom filter), and a *deletion*
  pattern (tombstone) at once — each answering a cost the others create.
- **One idea can unify a system.** "Append now, compact later" is the single
  principle behind the memtable flush, the tombstone, and the lazy background
  merge. Spotting one idea behind three subsystems is what deep source reading buys.
- **A delete being "just a value type" is the elegant core.** `kTypeDeletion` lets
  deletes reuse the entire fast write path; immutability is preserved because
  nothing is ever erased — only superseded.
- **This echoes Git and PostgreSQL.** All three never overwrite: Git adds objects,
  PostgreSQL adds tuple versions, LevelDB appends entries and tombstones. "Append
  new, never mutate" is a cross-domain idea worth recognising everywhere.

## Further Reading

A path from "I read this" to "I can recognise these patterns anywhere":

1. **Start with the design notes** — LevelDB's own
   [implementation doc](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/doc/impl.md)
   describes the memtable, SSTables, and compaction — read this first; the source
   then confirms it.
2. **Understand the file format** — the
   [table format doc](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/doc/table_format.md)
   shows where the Bloom filter ("meta") block lives inside each SSTable.
3. **Then read the source, in this order** — the write append
   ([MemTable::Add](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/db/memtable.cc#L76-L97))
   → the read filter
   ([KeyMayMatch](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/util/bloom.cc#L56-L80))
   → the delete marker
   ([ValueType](https://github.com/google/leveldb/blob/99b3c03b3284f5886f9ef9a4ef703d57373e61be/db/dbformat.h#L54)).
4. **Compare across systems** — read the [PostgreSQL MVCC case study](/case-studies/postgres-mvcc)
   and the [Git commit case study](/case-studies/git-commit), then notice all three
   share "never overwrite, append a new version" with different mechanics.
5. **Practise the recognition** — open the three pattern pages below and look for
   "append now, compact later" in another system.

## Study These Patterns

- [LSM-tree](/patterns/lsm-tree/) — buffer writes in memory, flush sorted files
- [Bloom Filter](/patterns/bloom-filter/) — O(1) "definitely not present" check
- [Tombstone](/patterns/tombstone/) — mark as deleted instead of erasing
