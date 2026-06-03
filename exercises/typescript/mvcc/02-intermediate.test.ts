import { describe, it, expect } from 'vitest';

/**
 * MVCC - Intermediate: Snapshot Transactions.
 *
 * TODO: Build on basic MVCC to support beginTransaction() that captures
 * a snapshot timestamp. All reads within the transaction see consistent
 * data as of the snapshot, regardless of concurrent writes. Commits
 * advance the global timestamp.
 */

interface Version<T> {
  timestamp: number;
  value: T;
  deleted: boolean;
}

class SnapshotStore<T> {
  private store = new Map<string, Version<T>[]>();
  private clock = 0;

  /** Get the current global timestamp */
  get now(): number {
    return this.clock; // TODO: implement
  }

  /** Advance and return a new timestamp */
  private tick(): number {
    return ++this.clock; // TODO: implement
  }

  /** Write a value directly (outside transaction) */
  put(key: string, value: T): number {
    const ts = this.tick(); // TODO: implement
    if (!this.store.has(key)) this.store.set(key, []);
    this.store.get(key)!.push({ timestamp: ts, value, deleted: false });
    return ts;
  }

  /** Read the latest version visible at a given timestamp */
  getAt(key: string, timestamp: number): T | undefined {
    const versions = this.store.get(key); // TODO: implement
    if (!versions) return undefined;
    let result: Version<T> | undefined;
    for (const v of versions) {
      if (v.timestamp <= timestamp && (!result || v.timestamp > result.timestamp)) {
        result = v;
      }
    }
    if (!result || result.deleted) return undefined;
    return result.value;
  }

  /** Apply a batch of writes atomically at a single timestamp */
  applyWrites(writes: Map<string, { value: T; deleted: boolean }>): number {
    const ts = this.tick(); // TODO: implement
    for (const [key, entry] of writes) {
      if (!this.store.has(key)) this.store.set(key, []);
      this.store.get(key)!.push({ timestamp: ts, value: entry.value, deleted: entry.deleted });
    }
    return ts;
  }

  /** Begin a snapshot transaction */
  beginTransaction(): Transaction<T> {
    return new Transaction(this, this.clock); // TODO: implement
  }
}

class Transaction<T> {
  private snapshotTs: number;
  private store: SnapshotStore<T>;
  private localWrites = new Map<string, { value: T; deleted: boolean }>();
  private committed = false;

  constructor(store: SnapshotStore<T>, snapshotTs: number) {
    this.store = store; // TODO: implement
    this.snapshotTs = snapshotTs;
  }

  /** Read a key: local writes first, then snapshot */
  get(key: string): T | undefined {
    if (this.localWrites.has(key)) { // TODO: implement
      const local = this.localWrites.get(key)!;
      return local.deleted ? undefined : local.value;
    }
    return this.store.getAt(key, this.snapshotTs);
  }

  /** Buffer a write within this transaction */
  put(key: string, value: T): void {
    this.localWrites.set(key, { value, deleted: false }); // TODO: implement
  }

  /** Buffer a delete within this transaction */
  delete(key: string): void {
    this.localWrites.set(key, { value: undefined as T, deleted: true }); // TODO: implement
  }

  /** Commit all buffered writes atomically */
  commit(): number {
    if (this.committed) throw new Error('Transaction already committed'); // TODO: implement
    this.committed = true;
    if (this.localWrites.size === 0) return this.snapshotTs;
    return this.store.applyWrites(this.localWrites);
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('MVCC - Intermediate: Snapshot Transactions', () => {
  it('should read own writes within a transaction', () => {
    const store = new SnapshotStore<string>();
    store.put('name', 'original');

    const tx = store.beginTransaction();
    tx.put('name', 'modified');
    expect(tx.get('name')).toBe('modified');

    // Store still sees original until commit
    expect(store.getAt('name', store.now)).toBe('original');

    tx.commit();
  });

  it('should provide snapshot isolation from concurrent writes', () => {
    const store = new SnapshotStore<number>();
    store.put('counter', 1);

    // Start transaction — sees counter=1
    const tx = store.beginTransaction();
    expect(tx.get('counter')).toBe(1);

    // Another write happens outside the transaction
    store.put('counter', 42);

    // Transaction still sees its snapshot value
    expect(tx.get('counter')).toBe(1);

    tx.commit();
  });

  it('should advance timestamp on commit', () => {
    const store = new SnapshotStore<string>();
    store.put('a', 'v1'); // ts=1

    const tx = store.beginTransaction();
    tx.put('a', 'v2');
    const commitTs = tx.commit();

    // Commit creates a new timestamp
    expect(commitTs).toBeGreaterThan(1);

    // Reading at the new timestamp sees the committed value
    expect(store.getAt('a', commitTs)).toBe('v2');

    // Reading at the old timestamp still sees the old value
    expect(store.getAt('a', 1)).toBe('v1');
  });

  it('should support multiple concurrent transactions with isolation', () => {
    const store = new SnapshotStore<number>();
    store.put('x', 10);
    store.put('y', 20);

    const tx1 = store.beginTransaction();
    const tx2 = store.beginTransaction();

    // tx1 modifies x
    tx1.put('x', 100);
    // tx2 still sees original x
    expect(tx2.get('x')).toBe(10);

    tx1.commit();

    // tx2 still sees snapshot (before tx1 committed)
    expect(tx2.get('x')).toBe(10);
    expect(tx2.get('y')).toBe(20);

    // tx2 modifies y and commits
    tx2.put('y', 200);
    const ts2 = tx2.commit();

    // After both commits, latest values are visible
    expect(store.getAt('x', ts2)).toBe(100);
    expect(store.getAt('y', ts2)).toBe(200);
  });
});
