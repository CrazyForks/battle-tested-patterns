---
title: 'Case Study: How PostgreSQL Composes Three Patterns for Concurrent Transactions'
description: A deep dive into how PostgreSQL combines MVCC, a transaction-ID logical clock, and write-ahead logging so readers never block writers, writers never block readers, and a crash loses nothing — every claim backed by source code at a pinned commit.
---

# Case Study: How PostgreSQL Composes Three Patterns for Concurrent Transactions

> **What this is.** Most pattern docs teach one pattern in isolation. This case
> study does the opposite: it dissects how one real system — PostgreSQL — composes
> **three** patterns so that many transactions read and write the same table at
> once without blocking each other, while a crash mid-transaction loses nothing.
> Every per-pattern claim links to source code at a pinned commit; the
> composition argument is backed by PostgreSQL's own documentation.

## The Problem PostgreSQL Solves

A database must let many transactions touch the same rows *concurrently* and
still behave as if each ran alone (isolation), and it must survive a crash with
no committed data lost (durability). The naive way to get isolation is locking:
a reader locks a row so no writer can change it mid-read, a writer locks it so no
reader sees a half-written value. But locks serialize everything — under load,
readers and writers spend their time waiting for each other.

PostgreSQL's answer avoids read/write locks almost entirely. The trick is to
**never overwrite a row in place**: an update writes a *new version* and leaves
the old one. Readers and writers then operate on *different versions*, so they
don't collide. Making that work — and making it crash-safe — requires three
patterns working together.

| Question | Pattern | How PostgreSQL answers it |
|----------|---------|---------------------------|
| *How can a reader and a writer touch the same row without blocking?* | **MVCC** | Keep multiple row versions; each version is stamped with `xmin`/`xmax` |
| *Which version should this transaction see?* | **Logical clock** | Transaction IDs (XIDs) are a monotonic clock; a snapshot says "who came before me" |
| *How do we survive a crash without losing a commit?* | **Write-ahead log** | Append the change to the WAL buffer; flush the WAL (not the data file) on commit |

## Pattern 1 — MVCC: many versions, no in-place overwrite

PostgreSQL never edits a row in place. Every row version (a *tuple*) carries two
hidden system columns: `xmin` (the XID of the transaction that created it) and
`xmax` (the XID of the transaction that deleted/superseded it, or 0). An `UPDATE`
is really an insert of a new tuple plus stamping `xmax` on the old one — so both
versions coexist.

For a concrete picture: suppose a row exists as version V1 with `xmin=10`. Now
transaction 20 runs `UPDATE`, and transaction 25 runs `SELECT` on that row *at the
same time*. The update writes V2 (`xmin=20`) and stamps V1's `xmax=20`; but until
transaction 20 commits, transaction 25's snapshot still treats 20 as "not done",
so it reads V1 unbothered. No lock, no wait — the reader and writer were looking
at different versions all along. The question "is this version visible to me?" is
answered by `HeapTupleSatisfiesMVCC`, comparing the tuple's `xmin`/`xmax` against
the caller's snapshot.

```c
HeapTupleSatisfiesMVCC(HeapTuple htup, Snapshot snapshot,
                       Buffer buffer)
{
    HeapTupleHeader tuple = htup->t_data;
    // ...
    if (!HeapTupleHeaderXminCommitted(tuple))
    {
        if (HeapTupleHeaderXminInvalid(tuple))
            return false;
        // ...is xmin in my snapshot? committed before I started?...
    }
    // ...is xmax set and committed? then this version is gone for me...
}
```

The rule, simplified: a version is visible if its `xmin` committed *before* my
snapshot was taken **and** its `xmax` is either unset or belongs to a transaction
that had *not* committed when my snapshot was taken. A reader therefore sees a
consistent set of versions — the ones that were committed as of its snapshot —
while a concurrent writer is busy creating *newer* versions the reader simply
ignores. Readers never block writers, writers never block readers.

> MVCC removes the *read/write* conflict, not every conflict. Two transactions
> that `UPDATE` the **same row** still serialize: the second one waits on a
> row-level lock until the first commits or aborts. MVCC's promise is precisely
> that reads and writes don't block each other — write/write contention on one row
> is still resolved by locking.

::: tip Mental model
Think of each row as a stack of dated photographs, not a whiteboard you erase. An
update doesn't wipe the board — it pins a new photo on top and writes an end-date
on the old one. Each reader carries a timestamp and looks down the stack for the
photo that was "current" at *its* time. Two people reading at different times see
different photos of the same row, and neither stops a writer from pinning the
next one.
:::

→ For the pattern in isolation, see [MVCC](/patterns/mvcc/).

## Pattern 2 — Logical clock: transaction IDs order the world

"Committed before my snapshot" only means something if transactions can be
*ordered*. PostgreSQL assigns each transaction a **transaction ID (XID)** from a
monotonically increasing counter — a **logical clock**. A *snapshot*, built by
`GetSnapshotData`, captures the clock at an instant: the smallest still-running
XID (`xmin`), the next-unassigned XID (`xmax`), and the list of XIDs in progress.
That triple is enough to decide, for any tuple, whether its creating/deleting
transaction counts as "in the past" relative to this snapshot.

```c
GetSnapshotData(Snapshot snapshot)
{
    ProcArrayStruct *arrayP = procArray;
    TransactionId *other_xids = ProcGlobal->xids;
    TransactionId xmin;
    TransactionId xmax;
    // ...scan the array of running transactions, record xmin/xmax/xip[]...
}
```

The snapshot is the bridge between Pattern 1 and the clock: `HeapTupleSatisfiesMVCC`
doesn't compare raw timestamps, it asks "is this tuple's XID *visible in this
snapshot*?" Because XIDs are a logical clock, "before" and "after" are just
integer comparisons (done in modulo-2³² arithmetic so the counter can wrap around
without time appearing to reverse).

::: tip Mental model
The XID counter is a ticket dispenser at a deli: every transaction takes the next
number. A snapshot is you noting "I'm ticket 50, and tickets 47 and 48 are still
being served." From that you know exactly whose work counts as finished-before-you
(tickets ≤ 46 that aren't 47/48) and whose doesn't. No wall-clock time needed —
just the order the tickets were handed out.
:::

→ For the pattern in isolation, see [Logical Clock](/patterns/logical-clock/).

## Pattern 3 — Write-ahead log: durability without flushing everything

MVCC keeps concurrency correct *in memory*, but a commit must survive a crash.
Flushing every modified data page to disk on each commit would be ruinously slow
(random writes scattered across the heap). PostgreSQL instead follows the
**write-ahead logging** rule: before a change touches a data file, a record
describing that change must be appended to the WAL. `XLogInsert` is the entry
point that assembles such a record and inserts it into the in-memory WAL buffers.

```c
XLogRecPtr
XLogInsert(RmgrId rmid, uint8 info)
{
    XLogRecPtr  EndPos;

    /* XLogBeginInsert() must have been called. */
    if (!begininsert_called)
        elog(ERROR, "XLogBeginInsert was not called");
    // ...assemble the record, then insert it into the WAL buffers...
}
```

Inserting into the buffer is not yet durable — that is a separate step. At commit
time, `XLogFlush` forces the WAL up to this record out to disk with `fsync` (a
syscall that makes the OS actually persist the bytes, not just cache them). The
WAL is a single, *sequential* file, so appending is fast and one `fsync` can make
many transactions durable at once. Crucially, only the WAL needs flushing on
commit; the data pages can be written lazily later. If the server crashes,
recovery **replays** the WAL — *roll-forward*, also called REDO: it re-applies, in
log order, every committed change that hadn't yet reached its data page. So a
crash never loses a committed transaction, and never leaves a half-applied one.

::: tip Mental model
WAL is a chef's order ticket. Before cooking (changing the dish), the chef writes
the order on a spike in arrival order. If the kitchen burns down mid-service, the
tickets survive, and the chef re-cooks exactly what was ordered, in order. Writing
one ticket is far cheaper than plating every dish to disk — and the ticket, not
the plate, is what makes the order "official."
:::

→ For the pattern in isolation, see [Write-Ahead Log](/patterns/write-ahead-log/).

## How the Three Compose

A single `UPDATE ... ; COMMIT;` walks through all three patterns:

```text
UPDATE row              ──► MVCC: write a NEW tuple (xmin = my XID),
                                  stamp old tuple's xmax = my XID
                                         │
            (but first, before the heap page is changed)
                                         ▼
                            WAL: XLogInsert the change into the WAL buffer;
                                 XLogFlush fsyncs it to disk on commit
                                         │
   meanwhile, a concurrent SELECT        ▼
   takes a snapshot ──► LOGICAL CLOCK: GetSnapshotData records the XID frontier
                                         │
                                         ▼
   for each tuple ──► MVCC: HeapTupleSatisfiesMVCC compares xmin/xmax
                            against that snapshot → sees the OLD version,
                            unbothered by the in-flight UPDATE
```

The unifying idea is **order plus versions, never overwrite**. MVCC gives every
row multiple versions so readers and writers touch different ones; the XID logical
clock gives a total order so each snapshot can decide which version is "current
for me"; and the WAL records that order durably so a crash can replay it. Remove
any one and it breaks: without versions (MVCC), readers and writers collide and
you're back to locking; without the logical clock, "which version is visible" has
no answer; without the WAL, a crash between commit and data-page flush loses the
transaction.

::: info Architectural inference
The framing of these patterns as a *deliberately composed* design — unified by
"order plus versions, never overwrite" — rests on PostgreSQL's own documentation
(see Further Reading), not on any single source file. The per-pattern code links
are direct source-code evidence; the "combined by design" claim is supported by
that design-level material.
:::

## Production Proof

All source links are pinned to PostgreSQL commit
`6304632eaa2107bb1763d29e213ff166ff6104c0` (tag `REL_17_2`). Per-pattern claims
are `source-code` (L1); the composition relationship is backed by official
documentation (`official-doc`).

| Pattern / Claim | Source | Evidence | Role in PostgreSQL |
|-----------------|--------|----------|--------------------|
| MVCC | [heapam_visibility.c#L960-L975](https://github.com/postgres/postgres/blob/6304632eaa2107bb1763d29e213ff166ff6104c0/src/backend/access/heap/heapam_visibility.c#L960-L975) | source-code | `HeapTupleSatisfiesMVCC` — decides if a tuple version is visible via `xmin`/`xmax` |
| Logical clock | [procarray.c#L2177-L2182](https://github.com/postgres/postgres/blob/6304632eaa2107bb1763d29e213ff166ff6104c0/src/backend/storage/ipc/procarray.c#L2177-L2182) | source-code | `GetSnapshotData` — captures the running-XID frontier into a snapshot |
| Write-ahead log | [xloginsert.c#L473-L490](https://github.com/postgres/postgres/blob/6304632eaa2107bb1763d29e213ff166ff6104c0/src/backend/access/transam/xloginsert.c#L473-L490) | source-code | `XLogInsert` — append a change record to the WAL before touching data |
| MVCC (intro) | [Concurrency Control — Introduction](https://www.postgresql.org/docs/current/mvcc-intro.html) | official-doc | Official statement that PostgreSQL uses MVCC so readers/writers don't block |
| WAL (by design) | [Write-Ahead Logging (WAL)](https://www.postgresql.org/docs/current/wal-intro.html) | official-doc | Official explanation of the log-before-data rule and REDO recovery |

## Takeaways

- **Patterns rarely ship alone.** Concurrent, crash-safe transactions need a
  *versioning* pattern (MVCC), an *ordering* pattern (logical clock), and a
  *durability* pattern (WAL) at once — each answering a different question.
- **One idea can unify a system.** "Order plus versions, never overwrite" is the
  single principle behind keeping old tuples, comparing XIDs, and appending to the
  log. Spotting one idea behind three subsystems is what deep source reading buys.
- **"Never overwrite" turns conflicts into non-events.** Because an update creates
  a new version instead of mutating the old one, the classic reader-writer
  conflict simply doesn't arise — the reader was looking at a different version
  all along.
- **This echoes Git.** Git also never overwrites — a commit adds new
  content-addressed objects and moves a pointer. Comparing PostgreSQL's MVCC with
  Git's immutable objects shows "append new, never mutate" as a cross-domain idea.

## Further Reading

A path from "I read this" to "I can recognise these patterns anywhere":

1. **Start with the model** — the
   [Concurrency Control introduction](https://www.postgresql.org/docs/current/mvcc-intro.html)
   states *why* PostgreSQL uses MVCC: readers don't block writers and vice versa.
   Read this first; the source then shows *how*.
2. **Understand visibility** — the
   [Transaction Isolation docs](https://www.postgresql.org/docs/current/transaction-iso.html)
   explain isolation levels, which are exactly the rules `HeapTupleSatisfiesMVCC`
   enforces against a snapshot.
3. **Understand durability** — the
   [Write-Ahead Logging docs](https://www.postgresql.org/docs/current/wal-intro.html)
   describe the log-before-data rule and REDO recovery the WAL provides.
4. **Then read the source, in this order** — visibility
   ([HeapTupleSatisfiesMVCC](https://github.com/postgres/postgres/blob/6304632eaa2107bb1763d29e213ff166ff6104c0/src/backend/access/heap/heapam_visibility.c#L960-L975))
   → the snapshot it consults
   ([GetSnapshotData](https://github.com/postgres/postgres/blob/6304632eaa2107bb1763d29e213ff166ff6104c0/src/backend/storage/ipc/procarray.c#L2177-L2182))
   → the durability underneath
   ([XLogInsert](https://github.com/postgres/postgres/blob/6304632eaa2107bb1763d29e213ff166ff6104c0/src/backend/access/transam/xloginsert.c#L473-L490)).
5. **Compare across systems** — read the [Git commit case study](/case-studies/git-commit)
   and contrast its content-addressed immutability with PostgreSQL's tuple
   versions. Same "append new, never overwrite" idea, different domain.
6. **Practise the recognition** — open the three pattern pages below and look for
   "keep versions, order them, log the order" in another system.

## Study These Patterns

- [MVCC](/patterns/mvcc/) — multiple versions so readers and writers don't block
- [Logical Clock](/patterns/logical-clock/) — order events without wall-clock time
- [Write-Ahead Log](/patterns/write-ahead-log/) — log the change before applying it
