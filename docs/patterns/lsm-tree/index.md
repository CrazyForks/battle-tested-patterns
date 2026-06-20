---
title: "Pattern: LSM Tree (Log-Structured Merge Tree)"
description: "Buffer writes in memory, flush to sorted files on disk, merge files in background — trading read amplification for fast writes."
difficulty: "advanced"
---

# Pattern: LSM Tree (Log-Structured Merge Tree)

<DifficultyBadge />

## One Liner

Buffer writes in memory, flush to sorted files on disk, merge files in background — trading read amplification for fast writes.

<DemoBadge />

## Real-World Analogy

A filing system where you first write notes on a sticky pad (memtable), then periodically file them into sorted folders (SSTables). Over time, you merge small folders into bigger ones during quiet hours (compaction).

## Core Idea

An LSM tree absorbs writes into an in-memory sorted structure (the memtable). When the memtable reaches a size threshold, it is flushed to disk as an immutable sorted run (SSTable). Background compaction merges multiple sorted runs to bound the number of files and reclaim space from deleted/overwritten keys. Reads check the memtable first, then each level of sorted runs.

```text
  Write Path                          Read Path
  ──────────                          ─────────
  PUT k=v ──►  ┌────────────┐         GET k
               │  Memtable  │ ◄──── 1. Check memtable
               │ (sorted,   │
               │  in-memory)│
               └─────┬──────┘
          flush when  │
          size > limit│
                      ▼
               ┌────────────┐
               │  Level 0   │ ◄──── 2. Check L0 files
               │  (SSTables)│
               └─────┬──────┘
          compact     │
          when full   │
                      ▼
               ┌────────────┐
               │  Level 1   │ ◄──── 3. Check L1 files
               │  (merged)  │
               └─────┬──────┘
                      ▼
                     ...
```

| Property | Value |
|----------|-------|
| Write amplification | O(level_count) due to compaction |
| Read amplification | O(level_count) in worst case |
| Write throughput | Very high — sequential I/O only |
| Space amplification | Temporary duplication during compaction |

**Try it yourself** — write keys to the memtable, watch it flush to SSTables, and compact levels:

<LSMTreeViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| LevelDB | [db_impl.cc#L1241-L1368](https://github.com/google/leveldb/blob/7ee830d02b623e8ffe0b95d59a74db1e58da04c5/db/db_impl.cc#L1241-L1368) | `DBImpl::Write` — the core write path. Batches writes into a group (L1241-L1288), appends to WAL (L1311), inserts into memtable (L1337-L1354). When memtable exceeds `write_buffer_size`, `MakeRoomForWrite` (L1368) triggers a flush: the current memtable becomes immutable and a new one is created. Background compaction then merges SSTable files across levels. |
| RocksDB | [memtable.cc#L458-L534](https://github.com/facebook/rocksdb/blob/7affaee1c49ebc80cb213ad86fe7d2a3ad447da2/db/memtable.cc#L458-L534) | `MemTable::Add` inserts a key-value pair with sequence number and type into the skip-list backed memtable. The memtable is the first destination for all writes. When it reaches `write_buffer_size`, it's made immutable and scheduled for flush to an L0 SST file. RocksDB extends LevelDB's design with concurrent memtable writes, column families, and pluggable memtable implementations. |

## Implementation

::: code-group

```typescript [TypeScript]
interface KVEntry {
  key: string;
  value: string | null; // null = tombstone (deleted)
  seq: number;
}

class Memtable {
  private entries: Map<string, KVEntry> = new Map();
  private _size = 0;

  put(key: string, value: string, seq: number): void {
    this.entries.set(key, { key, value, seq });
    this._size++;
  }

  delete(key: string, seq: number): void {
    this.entries.set(key, { key, value: null, seq });
    this._size++;
  }

  get(key: string): KVEntry | undefined {
    return this.entries.get(key);
  }

  get size(): number { return this._size; }

  flush(): KVEntry[] {
    const sorted = [...this.entries.values()].sort((a, b) => a.key.localeCompare(b.key));
    this.entries.clear();
    this._size = 0;
    return sorted;
  }
}

type SortedRun = KVEntry[];

class LSMTree {
  private memtable = new Memtable();
  private runs: SortedRun[] = []; // L0 sorted runs, newest first
  private seq = 0;
  private readonly flushThreshold: number;
  private readonly maxRuns: number;

  constructor(flushThreshold = 4, maxRuns = 4) {
    this.flushThreshold = flushThreshold;
    this.maxRuns = maxRuns;
  }

  put(key: string, value: string): void {
    this.memtable.put(key, value, this.seq++);
    if (this.memtable.size >= this.flushThreshold) {
      this.flushMemtable();
    }
  }

  delete(key: string): void {
    this.memtable.delete(key, this.seq++);
    if (this.memtable.size >= this.flushThreshold) {
      this.flushMemtable();
    }
  }

  get(key: string): string | undefined {
    // Check memtable first
    const memEntry = this.memtable.get(key);
    if (memEntry) return memEntry.value ?? undefined;

    // Check sorted runs (newest first)
    for (const run of this.runs) {
      const entry = this.binarySearch(run, key);
      if (entry) return entry.value ?? undefined;
    }
    return undefined;
  }

  private binarySearch(run: SortedRun, key: string): KVEntry | undefined {
    let lo = 0, hi = run.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const cmp = run[mid]!.key.localeCompare(key);
      if (cmp === 0) return run[mid];
      if (cmp < 0) lo = mid + 1;
      else hi = mid - 1;
    }
    return undefined;
  }

  private flushMemtable(): void {
    const run = this.memtable.flush();
    this.runs.unshift(run); // newest first
    if (this.runs.length > this.maxRuns) {
      this.compact();
    }
  }

  private compact(): void {
    // Merge all runs into one
    const merged = new Map<string, KVEntry>();
    // Process oldest first so newest wins
    for (let i = this.runs.length - 1; i >= 0; i--) {
      for (const entry of this.runs[i]!) {
        merged.set(entry.key, entry);
      }
    }
    // Remove tombstones and sort
    const compacted = [...merged.values()]
      .filter((e) => e.value !== null)
      .sort((a, b) => a.key.localeCompare(b.key));
    this.runs = compacted.length > 0 ? [compacted] : [];
  }

  get runCount(): number { return this.runs.length; }
}
```

```rust [Rust]
use std::collections::BTreeMap;

#[derive(Clone, Debug)]
pub struct KVEntry {
    pub key: String,
    pub value: Option<String>, // None = tombstone
    pub seq: usize,
}

pub struct Memtable {
    entries: BTreeMap<String, KVEntry>,
    size: usize,
}

impl Memtable {
    pub fn new() -> Self {
        Memtable { entries: BTreeMap::new(), size: 0 }
    }

    pub fn put(&mut self, key: &str, value: &str, seq: usize) {
        self.entries.insert(key.to_string(), KVEntry {
            key: key.to_string(), value: Some(value.to_string()), seq,
        });
        self.size += 1;
    }

    pub fn delete(&mut self, key: &str, seq: usize) {
        self.entries.insert(key.to_string(), KVEntry {
            key: key.to_string(), value: None, seq,
        });
        self.size += 1;
    }

    pub fn get(&self, key: &str) -> Option<&KVEntry> {
        self.entries.get(key)
    }

    pub fn size(&self) -> usize { self.size }

    pub fn flush(&mut self) -> Vec<KVEntry> {
        let result: Vec<KVEntry> = self.entries.values().cloned().collect();
        self.entries.clear();
        self.size = 0;
        result
    }
}

pub struct LSMTree {
    memtable: Memtable,
    runs: Vec<Vec<KVEntry>>,
    seq: usize,
    flush_threshold: usize,
    max_runs: usize,
}

impl LSMTree {
    pub fn new(flush_threshold: usize, max_runs: usize) -> Self {
        LSMTree {
            memtable: Memtable::new(),
            runs: Vec::new(),
            seq: 0,
            flush_threshold,
            max_runs,
        }
    }

    pub fn put(&mut self, key: &str, value: &str) {
        self.memtable.put(key, value, self.seq);
        self.seq += 1;
        if self.memtable.size() >= self.flush_threshold {
            self.flush_memtable();
        }
    }

    pub fn delete(&mut self, key: &str) {
        self.memtable.delete(key, self.seq);
        self.seq += 1;
        if self.memtable.size() >= self.flush_threshold {
            self.flush_memtable();
        }
    }

    pub fn get(&self, key: &str) -> Option<&str> {
        if let Some(entry) = self.memtable.get(key) {
            return entry.value.as_deref();
        }
        for run in &self.runs {
            if let Ok(idx) = run.binary_search_by(|e| e.key.as_str().cmp(key)) {
                return run[idx].value.as_deref();
            }
        }
        None
    }

    fn flush_memtable(&mut self) {
        let run = self.memtable.flush();
        self.runs.insert(0, run);
        if self.runs.len() > self.max_runs {
            self.compact();
        }
    }

    fn compact(&mut self) {
        let mut merged = BTreeMap::new();
        for run in self.runs.iter().rev() {
            for entry in run {
                merged.insert(entry.key.clone(), entry.clone());
            }
        }
        let result: Vec<KVEntry> = merged.into_values()
            .filter(|e| e.value.is_some())
            .collect();
        self.runs = if result.is_empty() { vec![] } else { vec![result] };
    }

    pub fn run_count(&self) -> usize { self.runs.len() }
}
```

```go [Go]
package lsm

import "sort"

type KVEntry struct {
	Key   string
	Value *string // nil = tombstone
	Seq   int
}

type Memtable struct {
	entries map[string]KVEntry
	size    int
}

func NewMemtable() *Memtable {
	return &Memtable{entries: make(map[string]KVEntry)}
}

func (m *Memtable) Put(key, value string, seq int) {
	m.entries[key] = KVEntry{Key: key, Value: &value, Seq: seq}
	m.size++
}

func (m *Memtable) Delete(key string, seq int) {
	m.entries[key] = KVEntry{Key: key, Value: nil, Seq: seq}
	m.size++
}

func (m *Memtable) Get(key string) (KVEntry, bool) {
	e, ok := m.entries[key]
	return e, ok
}

func (m *Memtable) Flush() []KVEntry {
	result := make([]KVEntry, 0, len(m.entries))
	for _, e := range m.entries {
		result = append(result, e)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Key < result[j].Key
	})
	m.entries = make(map[string]KVEntry)
	m.size = 0
	return result
}

type LSMTree struct {
	memtable       *Memtable
	runs           [][]KVEntry
	seq            int
	flushThreshold int
	maxRuns        int
}

func NewLSMTree(flushThreshold, maxRuns int) *LSMTree {
	return &LSMTree{
		memtable:       NewMemtable(),
		flushThreshold: flushThreshold,
		maxRuns:        maxRuns,
	}
}

func (t *LSMTree) Put(key, value string) {
	t.memtable.Put(key, value, t.seq)
	t.seq++
	if t.memtable.size >= t.flushThreshold {
		t.flushMemtable()
	}
}

func (t *LSMTree) Delete(key string) {
	t.memtable.Delete(key, t.seq)
	t.seq++
	if t.memtable.size >= t.flushThreshold {
		t.flushMemtable()
	}
}

func (t *LSMTree) Get(key string) (string, bool) {
	if e, ok := t.memtable.Get(key); ok {
		if e.Value == nil {
			return "", false
		}
		return *e.Value, true
	}
	for _, run := range t.runs {
		if e := binarySearch(run, key); e != nil {
			if e.Value == nil {
				return "", false
			}
			return *e.Value, true
		}
	}
	return "", false
}

func binarySearch(run []KVEntry, key string) *KVEntry {
	lo, hi := 0, len(run)-1
	for lo <= hi {
		mid := (lo + hi) / 2
		if run[mid].Key == key {
			return &run[mid]
		}
		if run[mid].Key < key {
			lo = mid + 1
		} else {
			hi = mid - 1
		}
	}
	return nil
}

func (t *LSMTree) flushMemtable() {
	run := t.memtable.Flush()
	t.runs = append([][]KVEntry{run}, t.runs...)
	if len(t.runs) > t.maxRuns {
		t.compact()
	}
}

func (t *LSMTree) compact() {
	merged := make(map[string]KVEntry)
	for i := len(t.runs) - 1; i >= 0; i-- {
		for _, e := range t.runs[i] {
			merged[e.Key] = e
		}
	}
	result := make([]KVEntry, 0)
	for _, e := range merged {
		if e.Value != nil {
			result = append(result, e)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Key < result[j].Key
	})
	if len(result) > 0 {
		t.runs = [][]KVEntry{result}
	} else {
		t.runs = nil
	}
}

func (t *LSMTree) RunCount() int {
	return len(t.runs)
}
```

```python [Python]
from dataclasses import dataclass, field
from bisect import bisect_left

@dataclass
class KVEntry:
    key: str
    value: str | None  # None = tombstone
    seq: int = 0

class Memtable:
    def __init__(self):
        self._entries: dict[str, KVEntry] = {}
        self._size = 0

    def put(self, key: str, value: str, seq: int) -> None:
        self._entries[key] = KVEntry(key=key, value=value, seq=seq)
        self._size += 1

    def delete(self, key: str, seq: int) -> None:
        self._entries[key] = KVEntry(key=key, value=None, seq=seq)
        self._size += 1

    def get(self, key: str) -> KVEntry | None:
        return self._entries.get(key)

    @property
    def size(self) -> int:
        return self._size

    def flush(self) -> list[KVEntry]:
        result = sorted(self._entries.values(), key=lambda e: e.key)
        self._entries.clear()
        self._size = 0
        return result

class LSMTree:
    def __init__(self, flush_threshold: int = 4, max_runs: int = 4):
        self._memtable = Memtable()
        self._runs: list[list[KVEntry]] = []
        self._seq = 0
        self._flush_threshold = flush_threshold
        self._max_runs = max_runs

    def put(self, key: str, value: str) -> None:
        self._memtable.put(key, value, self._seq)
        self._seq += 1
        if self._memtable.size >= self._flush_threshold:
            self._flush()

    def delete(self, key: str) -> None:
        self._memtable.delete(key, self._seq)
        self._seq += 1
        if self._memtable.size >= self._flush_threshold:
            self._flush()

    def get(self, key: str) -> str | None:
        entry = self._memtable.get(key)
        if entry is not None:
            return entry.value

        for run in self._runs:
            entry = self._binary_search(run, key)
            if entry is not None:
                return entry.value
        return None

    def _binary_search(self, run: list[KVEntry], key: str) -> KVEntry | None:
        keys = [e.key for e in run]
        i = bisect_left(keys, key)
        if i < len(run) and run[i].key == key:
            return run[i]
        return None

    def _flush(self) -> None:
        run = self._memtable.flush()
        self._runs.insert(0, run)
        if len(self._runs) > self._max_runs:
            self._compact()

    def _compact(self) -> None:
        merged: dict[str, KVEntry] = {}
        for run in reversed(self._runs):
            for entry in run:
                merged[entry.key] = entry
        result = [e for e in merged.values() if e.value is not None]
        result.sort(key=lambda e: e.key)
        self._runs = [result] if result else []

    @property
    def run_count(self) -> int:
        return len(self._runs)
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | In-memory memtable with flush to sorted runs | `exercises/typescript/lsm-tree/01-basic.test.ts` |
| Intermediate | Multi-level compaction with size-triggered merge | `exercises/typescript/lsm-tree/02-intermediate.test.ts` |

Run exercises: `pnpm test:ts` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/lsm_tree/mod.rs` · Go `exercises/go/lsm_tree/lsm_tree_test.go` · Python `exercises/python/lsm_tree/test_lsm_tree.py`

## When to Use

- **Write-heavy workloads** — logging, time-series data, event streams
- **Key-value stores** — LevelDB, RocksDB, Cassandra, HBase
- **Embedded databases** — space-efficient, simple to implement
- **Append-mostly data** — IoT sensor data, analytics events
- **SSD-optimized storage** — sequential writes maximize SSD lifespan

## When NOT to Use

- **Read-heavy workloads** — reads may check multiple levels; use B+ trees for fast reads
- **Small datasets** — LSM overhead (compaction, multiple files) isn't worth it for data that fits in a B+ tree
- **Range scans with strict latency** — compaction can cause latency spikes
- **Update-heavy with point reads** — repeated updates to the same key create write amplification during compaction

## More Production Uses

- [Apache Cassandra](https://github.com/apache/cassandra) — LSM-based distributed NoSQL database
- [ScyllaDB](https://github.com/scylladb/scylladb) — high-performance Cassandra-compatible LSM store
- [BadgerDB](https://github.com/dgraph-io/badger) — Go-native LSM key-value store with value separation
- [SQLite LSM extension](https://www.sqlite.org/lsm.html) — LSM-based storage backend for SQLite

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Skip List](/patterns/skip-list/) | Skip lists serve as the in-memory sorted buffer (memtable) in LSM trees |
| [Bloom Filter](/patterns/bloom-filter/) | Bloom filters on each SSTable avoid unnecessary disk reads during lookups |
| [Merge Iterator (K-Way Merge)](/patterns/merge-iterator/) | Compaction merges multiple sorted SSTables using merge iterators |
| [Write-Ahead Log (WAL)](/patterns/write-ahead-log/) | WAL ensures memtable writes survive crashes before flushing to SSTables |
| [Tombstone](/patterns/tombstone/) | LSM trees use tombstones to mark deletions that are cleaned up during compaction |
| [B+ Tree](/patterns/b-plus-tree/) | B+ trees provide read-optimized indexing; LSM trees optimize for write-heavy workloads |

## Challenge Questions

::: details Q1: Your LSM tree has 5 levels (L0-L4). A read for key "user:999" finds nothing. How many files did it potentially have to check?
**Answer:** In the worst case, all files across all levels. L0 files can overlap, so you check all L0 files. L1-L4 files are non-overlapping within a level, so you check at most one file per level. Total: all L0 files + 4 (one per remaining level).

This is "read amplification" — the fundamental trade-off of LSM trees. Solutions: (1) Bloom filters on each SSTable to skip files that definitely don't contain the key (LevelDB/RocksDB do this); (2) minimize L0 files by compacting aggressively; (3) use a prefix-based index to skip entire levels. RocksDB's Bloom filter typically reduces reads to 1-2 file reads even with many levels.
:::

::: details Q2: You delete a key from the LSM tree. The key still exists in an older SSTable on disk. Is the space freed immediately?
**Answer:** No. The delete writes a tombstone marker to the memtable. The original key-value pair remains in the old SSTable until compaction merges that SSTable and encounters the tombstone, at which point both are discarded.

This is why LSM trees have "space amplification." Deleted data occupies disk space until compaction reaches it. In extreme cases (delete-heavy workloads), the disk usage can temporarily exceed the logical data size significantly. RocksDB addresses this with periodic compaction filters and manual compaction triggers. The tombstone itself also occupies space and must be kept long enough to shadow all older copies of the key across all levels.
:::

::: details Q3: Your LSM tree is receiving 100K writes/second. Compaction can't keep up — L0 is accumulating files faster than they're merged. What happens and how do you fix it?
**Answer:** Write stalls. When L0 exceeds its file limit, the system must throttle or pause incoming writes until compaction catches up. This causes latency spikes.

LevelDB's `MakeRoomForWrite` explicitly checks L0 file count and sleeps if it exceeds `kL0_SlowdownWritesTrigger` (8 files) or stops writes entirely at `kL0_StopWritesTrigger` (12 files). Solutions: (1) increase compaction parallelism (RocksDB supports concurrent compaction threads); (2) use leveled compaction instead of size-tiered to bound L0 growth; (3) increase memtable size to flush less often; (4) use write rate limiting to smooth out bursts rather than hitting hard stops.
:::

::: details Q4: LevelDB uses a single-threaded compaction model. RocksDB switched to multi-threaded compaction. What problem does this solve, and what new problem does it create?
**Answer:** Multi-threaded compaction solves the throughput bottleneck — compaction can keep up with higher write rates by running multiple merge operations in parallel. The new problem: concurrent compaction of overlapping key ranges can cause write conflicts and requires careful coordination.

With single-threaded compaction, one slow merge blocks all others — write stalls become common under high load. Multi-threaded compaction allows L0→L1 and L2→L3 merges to happen simultaneously. However, two compaction jobs touching the same key range would produce conflicting outputs. RocksDB solves this by tracking which key ranges are "locked" by active compactions and only scheduling non-overlapping compaction jobs. This coordination adds complexity but dramatically improves sustained write throughput.
:::
