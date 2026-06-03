import { describe, it, expect } from 'vitest';

/**
 * Tombstone Store - Intermediate: Time-based compaction.
 *
 * TODO: Extend the TombstoneStore with:
 * - Timestamps on all entries (put and delete)
 * - compact(maxAgeMs): Remove tombstones older than maxAgeMs, return count removed
 * - pendingTombstones: Number of tombstones awaiting compaction
 *
 * Real-world use: LSM-tree compaction in LevelDB, Cassandra gc_grace_seconds.
 */

interface Entry {
  value: string | null;
  deleted: boolean;
  timestamp: number;
}

class TombstoneStore {
  private store = new Map<string, Entry>();
  private _tombstoneCount = 0;

  put(key: string, value: string): void {
    // TODO: implement
    this.store.set(key, { value, deleted: false, timestamp: Date.now() });
  }

  get(key: string): string | undefined {
    // TODO: implement
    const entry = this.store.get(key);
    if (!entry || entry.deleted) return undefined;
    return entry.value!;
  }

  delete(key: string): boolean {
    // TODO: implement
    const entry = this.store.get(key);
    if (!entry || entry.deleted) return false;
    entry.deleted = true;
    entry.value = null;
    entry.timestamp = Date.now();
    this._tombstoneCount++;
    return true;
  }

  /** Remove tombstones older than maxAgeMs. Returns number removed. */
  compact(maxAgeMs: number): number {
    // TODO: implement
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;
    for (const [key, entry] of this.store) {
      if (entry.deleted && entry.timestamp < cutoff) {
        this.store.delete(key);
        removed++;
        this._tombstoneCount--;
      }
    }
    return removed;
  }

  get size(): number {
    let count = 0;
    for (const entry of this.store.values()) {
      if (!entry.deleted) count++;
    }
    return count;
  }

  get pendingTombstones(): number {
    return this._tombstoneCount;
  }
}

// --- Tests (do not modify below this line) ---

describe('Tombstone Store - Intermediate: Compaction', () => {
  it('should compact old tombstones', async () => {
    const store = new TombstoneStore();
    store.put('a', 'v1');
    store.put('b', 'v2');
    store.delete('a');
    store.delete('b');

    expect(store.pendingTombstones).toBe(2);

    // Wait for tombstones to age
    await new Promise((r) => setTimeout(r, 50));

    const removed = store.compact(30); // remove tombstones older than 30ms
    expect(removed).toBe(2);
    expect(store.pendingTombstones).toBe(0);
  });

  it('should not compact recent tombstones', () => {
    const store = new TombstoneStore();
    store.put('a', 'v1');
    store.delete('a');

    const removed = store.compact(10_000); // 10 second window
    expect(removed).toBe(0);
    expect(store.pendingTombstones).toBe(1);
  });

  it('should only compact tombstones, not live entries', async () => {
    const store = new TombstoneStore();
    store.put('live', 'value');
    store.put('dead', 'value');
    store.delete('dead');

    await new Promise((r) => setTimeout(r, 50));
    store.compact(30);

    expect(store.get('live')).toBe('value');
    expect(store.size).toBe(1);
  });

  it('should handle mixed ages of tombstones', async () => {
    const store = new TombstoneStore();
    store.put('old', 'v1');
    store.delete('old');

    await new Promise((r) => setTimeout(r, 60));

    store.put('new', 'v2');
    store.delete('new');

    // Only compact tombstones older than 40ms
    const removed = store.compact(40);
    expect(removed).toBe(1); // only 'old' compacted
    expect(store.pendingTombstones).toBe(1); // 'new' still pending
  });

  it('should track tombstone count correctly through lifecycle', () => {
    const store = new TombstoneStore();
    store.put('a', '1');
    store.put('b', '2');
    store.put('c', '3');
    expect(store.pendingTombstones).toBe(0);

    store.delete('a');
    expect(store.pendingTombstones).toBe(1);

    store.delete('b');
    expect(store.pendingTombstones).toBe(2);

    // Re-insert 'a' — replaces tombstone with live entry
    store.put('a', 'new');
    expect(store.get('a')).toBe('new');
    expect(store.size).toBe(2); // a (live), c (live) — b still tombstoned
  });
});
