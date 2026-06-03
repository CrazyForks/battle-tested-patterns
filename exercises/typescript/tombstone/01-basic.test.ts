import { describe, it, expect } from 'vitest';

/**
 * Tombstone Store - Basic: Implement a key-value store with tombstone deletion.
 *
 * TODO: Implement a TombstoneStore with:
 * - put(key, value): Store a key-value pair
 * - get(key): Return value or undefined (treat tombstoned entries as missing)
 * - delete(key): Mark entry as deleted with a tombstone (don't physically remove)
 * - size: Number of live (non-deleted) entries
 */

interface Entry {
  value: string | null;
  deleted: boolean;
}

class TombstoneStore {
  private store = new Map<string, Entry>();

  put(key: string, value: string): void {
    // TODO: implement
    this.store.set(key, { value, deleted: false });
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
    return true;
  }

  get size(): number {
    let count = 0;
    for (const entry of this.store.values()) {
      if (!entry.deleted) count++;
    }
    return count;
  }

  /** Number of tombstoned entries still in the store */
  get tombstoneCount(): number {
    let count = 0;
    for (const entry of this.store.values()) {
      if (entry.deleted) count++;
    }
    return count;
  }
}

// --- Tests (do not modify below this line) ---

describe('Tombstone Store - Basic', () => {
  it('should store and retrieve values', () => {
    const store = new TombstoneStore();
    store.put('a', 'hello');
    store.put('b', 'world');
    expect(store.get('a')).toBe('hello');
    expect(store.get('b')).toBe('world');
  });

  it('should return undefined for missing keys', () => {
    const store = new TombstoneStore();
    expect(store.get('x')).toBeUndefined();
  });

  it('should mark entry as deleted (tombstone)', () => {
    const store = new TombstoneStore();
    store.put('a', 'hello');
    expect(store.delete('a')).toBe(true);
    expect(store.get('a')).toBeUndefined();
  });

  it('should not double-delete', () => {
    const store = new TombstoneStore();
    store.put('a', 'hello');
    expect(store.delete('a')).toBe(true);
    expect(store.delete('a')).toBe(false);
  });

  it('should keep tombstone in internal storage', () => {
    const store = new TombstoneStore();
    store.put('a', 'hello');
    store.delete('a');
    expect(store.size).toBe(0);
    expect(store.tombstoneCount).toBe(1);
  });

  it('should allow re-inserting a tombstoned key', () => {
    const store = new TombstoneStore();
    store.put('a', 'v1');
    store.delete('a');
    store.put('a', 'v2');
    expect(store.get('a')).toBe('v2');
    expect(store.size).toBe(1);
  });
});
