---
description: "A monotonically increasing counter that orders events without wall-clock time — enabling consistent snapshots and staleness detection."
difficulty: "advanced"
---

# Pattern: Logical Clock / Epoch

<DifficultyBadge />

## One Liner

A monotonically increasing counter that orders events without wall-clock time — enabling consistent snapshots and staleness detection.

<DemoBadge />

## Real-World Analogy

Numbering messages in a group chat where everyone is in different time zones. Instead of using wall-clock time (which differs), you stamp each message with a sequence number that respects 'I saw your message before sending mine' — causal order, not clock order.

## Core Idea

Wall clocks are unreliable in distributed systems — they drift, jump on NTP sync, and differ across machines. A logical clock is a simple integer that only goes up. Lamport's rule: increment on local event, take `max(local, remote) + 1` on message receive. This guarantees: if event A causally precedes event B, then `clock(A) < clock(B)`.

```text
  Process P1          Process P2
  ─────────           ─────────
  tick → 1
  tick → 2
  send(2) ──────────► receive(2)
                      max(0, 2)+1 = 3
                      tick → 4
  receive(4) ◄─────── send(4)
  max(2, 4)+1 = 5
  tick → 6

  Causal order: P1:1 → P1:2 → P2:3 → P2:4 → P1:5 → P1:6
```

| Property | Value |
|----------|-------|
| Increment | O(1) — counter++ |
| Receive | O(1) — max + 1 |
| Guarantees | If A → B (causally), then clock(A) < clock(B) |
| Limitation | Converse is NOT true: clock(A) < clock(B) does not imply A → B |

**Try it yourself** — perform local events and send messages between processes to see Lamport clocks:

<LogicalClockViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| etcd | [kvstore.go#L53-L72](https://github.com/etcd-io/etcd/blob/main/server/storage/mvcc/kvstore.go#L53-L72) | `store` struct (L53) with `currentRev int64` (L72) — a monotonic revision counter. Incremented in [kvstore_txn.go#L214](https://github.com/etcd-io/etcd/blob/main/server/storage/mvcc/kvstore_txn.go#L214) (`tw.s.currentRev++`) on every write transaction. Watches and snapshots use this revision for consistent reads — "give me everything after revision 42." |
| LevelDB | [dbformat.h#L62-L66](https://github.com/google/leveldb/blob/main/db/dbformat.h#L62-L66) | `SequenceNumber` (L62) is a `uint64_t` incremented on every write operation. `kMaxSequenceNumber` (L66) reserves 8 bits for packing type info alongside the sequence. Used to order writes in the WAL, determine snapshot visibility, and resolve key conflicts during compaction. |

## Implementation

::: code-group

```typescript [TypeScript]
class LamportClock {
  private time = 0;

  /** Increment the clock for a local event. */
  tick(): void {
    this.time++;
  }

  /** Record a send event and return the timestamp. */
  send(): number {
    this.time++;
    return this.time;
  }

  /** Receive a message with a remote timestamp. */
  receive(remoteTimestamp: number): void {
    this.time = Math.max(this.time, remoteTimestamp) + 1;
  }

  /** Current clock value. */
  now(): number {
    return this.time;
  }
}
```

```rust [Rust]
use std::sync::atomic::{AtomicU64, Ordering};

pub struct LamportClock {
    time: AtomicU64,
}

impl LamportClock {
    pub fn new() -> Self {
        LamportClock { time: AtomicU64::new(0) }
    }

    pub fn tick(&self) -> u64 {
        self.time.fetch_add(1, Ordering::SeqCst) + 1
    }

    pub fn send(&self) -> u64 {
        self.tick()
    }

    pub fn receive(&self, remote: u64) -> u64 {
        loop {
            let current = self.time.load(Ordering::SeqCst);
            let new_time = std::cmp::max(current, remote) + 1;
            if self.time.compare_exchange(
                current, new_time, Ordering::SeqCst, Ordering::SeqCst
            ).is_ok() {
                return new_time;
            }
        }
    }

    pub fn now(&self) -> u64 {
        self.time.load(Ordering::SeqCst)
    }
}
```

```go [Go]
type LamportClock struct {
	mu   sync.Mutex
	time uint64
}

func (c *LamportClock) Tick() uint64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.time++
	return c.time
}

func (c *LamportClock) Send() uint64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.time++
	return c.time
}

func (c *LamportClock) Receive(remote uint64) uint64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	if remote > c.time {
		c.time = remote
	}
	c.time++
	return c.time
}

func (c *LamportClock) Now() uint64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.time
}
```

```python [Python]
class LamportClock:
    def __init__(self) -> None:
        self._time = 0

    def tick(self) -> None:
        self._time += 1

    def send(self) -> int:
        self._time += 1
        return self._time

    def receive(self, remote_timestamp: int) -> None:
        self._time = max(self._time, remote_timestamp) + 1

    def now(self) -> int:
        return self._time
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a Lamport clock with tick/send/receive | `exercises/typescript/logical-clock/01-basic.test.ts` |
| Intermediate | Build a version vector for multi-node causality tracking | `exercises/typescript/logical-clock/02-intermediate.test.ts` |

Run exercises: `pnpm test` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/logical_clock.rs` · Go `exercises/go/logical_clock_test.go` · Python `exercises/python/test_logical_clock.py`

## When to Use

- **Database revision tracking** — etcd, CockroachDB, and Spanner use monotonic revisions for consistent snapshots and watch APIs
- **Cache invalidation** — epoch-based invalidation: "if your cached epoch < current epoch, your data is stale"
- **Distributed event ordering** — ordering messages across nodes without synchronized clocks (message queues, event sourcing)
- **MVCC (multi-version concurrency control)** — each transaction gets a sequence number; readers see a consistent snapshot at a point-in-time
- **Optimistic concurrency** — "update this row only if the version matches" (compare-and-swap with logical timestamps)

## When NOT to Use

- **Wall-clock time is needed** — if you need "this happened at 2:30 PM" for user-facing timestamps, a logical clock gives you ordering but not real time. Use Hybrid Logical Clocks (HLC) or TrueTime.
- **Detecting concurrent events** — a Lamport clock cannot determine if two events are concurrent or causally related when `clock(A) < clock(B)`. You need vector clocks for that.
- **Single-process sequential code** — if everything runs in one thread with no distribution, a simple counter or array index suffices. The Lamport machinery adds nothing.

## More Production Uses

- [CockroachDB](https://github.com/cockroachdb/cockroach) — Hybrid Logical Clock (HLC) combining wall clock + logical counter for serializable transactions
- [Amazon DynamoDB](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) — vector clocks for conflict detection across replicas
- [Kafka](https://github.com/apache/kafka) — offsets as monotonic logical positions in a partition log
- [Raft consensus](https://github.com/etcd-io/raft) — `term` is a logical epoch; higher term wins leader election

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [MVCC (Multi-Version Concurrency Control)](/patterns/mvcc/) | MVCC uses logical timestamps as version identifiers |
| [Write-Ahead Log (WAL)](/patterns/write-ahead-log/) | WAL entries are ordered by logical clock sequence numbers |
| [Checkpointing](/patterns/checkpointing/) | Checkpoints are taken at specific logical clock positions |

## Challenge Questions

::: details Q1: Process A has Lamport clock 5, Process B has clock 3. Can you determine which event happened first?
**Answer:** No. Lamport clocks only guarantee: if A causally precedes B, then `clock(A) < clock(B)`. The converse is NOT guaranteed.

`clock(A) = 5 > clock(B) = 3` does NOT mean A happened after B. They could be concurrent events on different machines that never communicated. To detect concurrency, you need a **vector clock** — one counter per node, with component-wise comparison.
:::

::: details Q2: How does a Hybrid Logical Clock (HLC) improve on a pure Lamport clock?
**Answer:** An HLC combines a physical timestamp (wall clock) with a logical counter. The physical part gives you real-time proximity — "this happened around 2:30 PM." The logical part breaks ties and maintains the Lamport guarantee.

Rule: `hlc = max(local_wall_clock, local_hlc, remote_hlc)`. If the wall clock advances, the logical part resets. If the wall clock is behind (NTP hasn't caught up), the logical part increments.

CockroachDB uses HLC because it needs both: causal ordering for consistency AND real-time bounds for transaction deadlines. A pure Lamport clock gives ordering but the numbers are meaningless as time. A pure wall clock gives time but can go backward.
:::

::: details Q3: Your cache uses an epoch counter for invalidation. A server restarts and the epoch resets to 0. What breaks?
**Answer:** Stale cache entries appear valid. A client with cached epoch 5 sees the server's epoch 0 and might incorrectly conclude it has newer data (or, depending on the protocol, force a full re-fetch).

Solutions: (1) persist the epoch to disk and restore on restart, (2) use a combination of server ID + epoch so restarts are distinguishable, (3) use a timestamp-based epoch that only increases. etcd solves this with persistent revision + a member ID that changes on rejoin.
:::

::: details Q4: You're building an event sourcing system. Should you use Lamport clocks or sequence numbers as event IDs?
**Answer:** Sequence numbers are better for a single-writer event store. A Lamport clock adds unnecessary complexity when there's only one source of events — a simple auto-incrementing integer is a perfectly valid logical clock.

Lamport clocks shine when multiple independent writers exist (distributed systems). For single-writer: use a sequence number. For multi-writer with one coordinating node: use a centralized sequence (like Kafka partition offsets). For truly distributed multi-writer: use Lamport or vector clocks. Match the tool to the distribution model.
:::
