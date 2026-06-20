---
title: 'Case Study: How SQLite Composes Three Patterns for Durable, Concurrent Writes'
description: A deep dive into how SQLite combines a write-ahead log, B-trees, and checkpointing so writers never block readers, the database file stays consistent, and a crash can always be recovered — every claim backed by source code at a pinned commit.
---

# Case Study: How SQLite Composes Three Patterns for Durable, Concurrent Writes

> **What this is.** Most pattern docs teach one pattern in isolation. This case
> study does the opposite: it dissects how one real system — SQLite, the most
> widely deployed database engine on earth — composes **three** patterns so that
> a write is durable the instant it commits, readers never block on a writer, and
> a power loss mid-write can always be rolled forward or back. Every per-pattern
> claim links to source code at a pinned commit; the composition argument is
> backed by SQLite's own design documentation.

## The Problem SQLite Solves

A database engine must satisfy two demands that pull against each other. First,
**durability**: once a transaction commits, its data must survive a crash — even
if the power dies one instruction later. Second, **concurrency**: a long-running
reader should not freeze every writer, and a writer should not corrupt what a
reader is in the middle of scanning.

The naive approach — overwrite pages in the main database file in place — fails
both. A crash halfway through overwriting a page leaves the file corrupt, and an
in-place writer must lock out readers to stop them seeing a half-written page.

SQLite's Write-Ahead Logging mode makes a different bet: **never overwrite the
main file during a transaction.** New page images are appended to a separate log
file; the main database is only updated later, in a controlled background step.
This keeps the main file consistent at all times, lets readers keep reading the
old pages while a writer appends new ones, and turns crash recovery into "replay
the log." Three patterns work together to make that bet pay off.

| Question | Pattern | How SQLite answers it |
|----------|---------|-----------------------|
| *How do we commit durably without overwriting the live file?* | **Write-ahead log** | Append each changed page as a *frame* to a `-wal` file; the last frame of a commit carries a commit marker |
| *How do we store rows and indexes so lookups stay logarithmic?* | **B-tree** | Every table and index is a B-tree of fixed-size pages; the "dirty pages" the WAL records are these B-tree pages |
| *How do we fold the log back without blocking readers?* | **Checkpointing** | A checkpoint backfills committed frames into the main file up to the point no active reader still needs |

## Pattern 1 — Write-ahead log: commit by appending, never overwrite

When a transaction modifies pages, SQLite does **not** write them back to the
main database file. Instead each dirty page is encoded as a *WAL frame* — a small
header plus the full page image — and appended to the `-wal` file.
`walWriteOneFrame` is the primitive that writes one such frame:

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

The `nTruncate` argument is the trick: on every frame except the last of a commit
it is `0`; on the final frame it is set to the database size in pages, which
*also* marks that frame as a commit. A reader that scans the WAL stops trusting
frames past the last committed one. So a crash mid-transaction is harmless — the
half-written frames have no commit marker, so recovery simply ignores them. The
main database file was never touched.

::: tip Mental model
Think of the main database file as a printed ledger you refuse to erase. Every
change is written on a sticky note (a WAL frame) and stuck on top in arrival
order. The note that completes a transaction is initialled (the commit marker).
A reader reads the ledger *plus* every initialled note above it; an un-initialled
trailing note (a crash) is just peeled off and thrown away.
:::

→ For the pattern in isolation, see [Write-Ahead Log](/patterns/write-ahead-log/).

## Pattern 2 — B-tree: what the pages actually contain

The "pages" the WAL records are not opaque blobs. Every table and every index in
SQLite is a **B-tree** — a balanced tree of fixed-size pages where interior pages
route and leaf pages hold the data. (Tables use a B+tree variant — row data lives
only in the leaves — while indexes use a plain B-tree; this study links to the
[B+ Tree](/patterns/b-plus-tree/) pattern for the shared "balanced tree of pages"
idea.) `sqlite3BtreeInsert` is the entry point that
adds a row or index entry into the right page:

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

When a leaf page fills, `balance_nonroot` splits it and propagates a separator key
upward — the classic B-tree split that keeps the tree shallow and lookups
`O(log n)`. The crucial connection to Pattern 1: an insert dirties one or more
B-tree pages, and **those dirtied pages are exactly what the WAL appends as
frames**. The B-tree decides *which* pages change; the WAL decides *how* those
changes reach disk durably.

::: tip Mental model
A B-tree is a library's card catalogue: a few index cards at the top point you to
drawers, drawers point to sub-drawers, and the bottom holds the actual cards. Add
a card to a full drawer and you split the drawer in two and file a new pointer
upstairs. SQLite stores every table and index this way; the WAL is just how those
drawer-pages get written down safely.
:::

→ For the pattern in isolation, see [B+ Tree](/patterns/b-plus-tree/).

## Pattern 3 — Checkpointing: folding the log back into the file

The WAL cannot grow forever, and reads get slower the more frames they must scan.
**Checkpointing** is the background step that copies committed frames from the WAL
back into the main database file — *backfilling* — after which the WAL space can
be reused. `walCheckpoint` drives it:

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

The subtle part is `mxSafeFrame`: a checkpoint may only backfill frames up to the
oldest page still needed by an active reader. This is exactly what lets readers
and the checkpointer run concurrently — the checkpointer never overwrites a page
out from under a reader. The modes (`PASSIVE`, `FULL`, `RESTART`) trade off how
hard the checkpoint tries versus how much it may block.

::: tip Mental model
Checkpointing is the clerk who, when the stack of sticky notes gets tall, copies
the settled notes into the ledger and removes them — but only the notes that no
one is currently reading. The ledger (main file) is always valid; the stack (WAL)
stays bounded; nobody reading is ever interrupted.
:::

→ For the pattern in isolation, see [Checkpointing](/patterns/checkpointing/).

## How the Three Compose

Run a transaction and the three patterns hand off in order:

1. **B-tree** decides which pages change: `sqlite3BtreeInsert` locates the leaf,
   inserts the cell, and (if the page overflows) splits it — producing a set of
   *dirty pages*.
2. **Write-ahead log** makes the commit durable: each dirty page is appended to
   the `-wal` file by `walWriteOneFrame`, and the final frame carries the commit
   marker. The main database file is untouched, so readers keep reading.
3. **Checkpointing** reclaims space later: `walCheckpoint` backfills committed
   frames into the main file up to `mxSafeFrame` — never past a page an active
   reader still needs — then the WAL can be reused.

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

The unifying idea is **separate the durable record of change from the place
changes eventually live**. The WAL is the durable, append-only record; the B-tree
file is where data eventually settles; the checkpoint is the controlled bridge
between them that respects readers. Remove any one and it breaks: without the WAL,
a crash mid-write corrupts the file; without the B-tree, there is no efficient
structure to read or to dirty; without checkpointing, the WAL grows without bound
and reads slow to a crawl.

::: info Architectural inference
The framing of these three as a *deliberately composed* design — the WAL mode that
makes SQLite concurrent and crash-safe — rests on SQLite's own WAL documentation
(see Further Reading), not on any single source file. The per-pattern code links
are direct source-code evidence; the "combined by design" claim is supported by
that design-level material.
:::

## Production Proof

All source links are pinned to SQLite commit
`593b55cb78250bf3c8e77911f0daf30e9a59dc5a`. Per-pattern claims are
`source-code` (L1); the composition relationship is backed by official
documentation (`official-doc`).

| Pattern / Claim | Source | Evidence | Role in a WAL-mode transaction |
|-----------------|--------|----------|--------------------------------|
| Write-ahead log | [wal.c#L3963-L3979](https://github.com/sqlite/sqlite/blob/593b55cb78250bf3c8e77911f0daf30e9a59dc5a/src/wal.c#L3963-L3979) | source-code | `walWriteOneFrame` appends one changed page as a WAL frame; the commit flag marks the last frame of a commit |
| B-tree | [btree.c#L9414-L9440](https://github.com/sqlite/sqlite/blob/593b55cb78250bf3c8e77911f0daf30e9a59dc5a/src/btree.c#L9414-L9440) | source-code | `sqlite3BtreeInsert` inserts into the leaf page; `balance_nonroot` splits a full page — these are the dirty pages the WAL records |
| Checkpointing | [wal.c#L2199-L2230](https://github.com/sqlite/sqlite/blob/593b55cb78250bf3c8e77911f0daf30e9a59dc5a/src/wal.c#L2199-L2230) | source-code | `walCheckpoint` backfills committed frames into the main file up to `mxSafeFrame`, never past an active reader |
| Composition (by design) | [SQLite WAL documentation](https://sqlite.org/wal.html) | official-doc | SQLite's own explanation of how writing frames, reading them, and checkpointing combine into concurrent, durable WAL mode |

## Takeaways

- **Patterns rarely ship alone.** Durable concurrent writes need a *durability*
  pattern (write-ahead log), a *structure* pattern (B-tree), and a *space-reclaim*
  pattern (checkpointing) at once — and they hand off in order.
- **The log records change; the tree holds data.** SQLite's WAL frames are page
  images of B-tree pages. Recognising "the thing the log appends is the thing the
  tree dirties" is the whole composition in one sentence.
- **Concurrency falls out of not overwriting.** Because a writer only appends to
  the WAL and the checkpointer respects `mxSafeFrame`, readers never see a
  half-written page — concurrency is a *consequence* of the append-only discipline,
  not a separate locking scheme.
- **This echoes LevelDB.** Both append changes first and reorganise later (WAL +
  checkpoint here; memtable + compaction there). Reading one makes the other's
  write path easier to recognise.

## Further Reading

A path from "I read this" to "I can recognise these patterns anywhere":

1. **Start with the WAL design** — SQLite's official
   [Write-Ahead Logging](https://sqlite.org/wal.html) page explains frames, the
   commit marker, the `-wal`/`-shm` files, and checkpointing. Read this first; the
   source then confirms it.
2. **Then the architecture overview** — [SQLite Architecture](https://sqlite.org/arch.html)
   shows where the B-tree layer, the pager, and the WAL sit relative to each other.
3. **Then the on-disk format** — [SQLite Database File Format](https://sqlite.org/fileformat2.html)
   documents the B-tree page layout that the WAL frames carry.
4. **Then atomic commit** — [Atomic Commit In SQLite](https://sqlite.org/atomiccommit.html)
   explains the durability guarantees the WAL provides (and how rollback-journal
   mode differs).
5. **Compare across systems** — read the [LevelDB LSM case study](/case-studies/leveldb-lsm)
   and note how "append first, reorganise later" appears as memtable + compaction.
   Same idea, different structure.

## Study These Patterns

- [Write-Ahead Log](/patterns/write-ahead-log/) — log every mutation before applying it; replay to recover
- [B+ Tree](/patterns/b-plus-tree/) — balanced tree of pages for `O(log n)` lookups and range scans
- [Checkpointing](/patterns/checkpointing/) — periodically fold the log back into the main store
