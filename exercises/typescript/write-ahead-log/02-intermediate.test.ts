import { describe, it, expect } from 'vitest';

/**
 * Write-Ahead Log - Intermediate: Checkpoint Recovery.
 *
 * TODO: Implement a WAL with checkpoint() and recover().
 * checkpoint() marks a point in the log. recover() replays
 * only entries AFTER the last checkpoint — entries before it
 * are considered already persisted and safe.
 *
 * Real-world use: PostgreSQL checkpoints, SQLite WAL mode,
 * Redis AOF rewrite.
 */

interface WalEntry {
  id: number;
  operation: string;
  data: Record<string, unknown>;
}

class CheckpointWAL {
  private entries: WalEntry[] = [];
  private nextId = 1;
  private lastCheckpointIndex = -1; // index into entries, -1 means no checkpoint

  // TODO: implement

  /** Append an entry to the log. */
  append(operation: string, data: Record<string, unknown>): number {
    // TODO: implement
    const id = this.nextId++;
    this.entries.push({ id, operation, data });
    return id;
  }

  /** Mark the current log position as a checkpoint. */
  checkpoint(): void {
    // TODO: implement
    this.lastCheckpointIndex = this.entries.length - 1;
  }

  /**
   * Recover by replaying only entries after the last checkpoint.
   * Returns the number of entries replayed.
   */
  recover(applyFn: (entry: WalEntry) => void): number {
    // TODO: implement
    const startIndex = this.lastCheckpointIndex + 1;
    let count = 0;
    for (let i = startIndex; i < this.entries.length; i++) {
      applyFn(this.entries[i]);
      count++;
    }
    return count;
  }

  get length(): number {
    return this.entries.length;
  }

  get entriesSinceCheckpoint(): number {
    return this.entries.length - (this.lastCheckpointIndex + 1);
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Write-Ahead Log - Intermediate: Checkpoint Recovery', () => {
  it('should recover all entries when no checkpoint exists', () => {
    const wal = new CheckpointWAL();
    wal.append('SET', { key: 'a', value: 1 });
    wal.append('SET', { key: 'b', value: 2 });

    const state: Record<string, unknown> = {};
    const count = wal.recover((entry) => {
      state[entry.data.key as string] = entry.data.value;
    });

    expect(count).toBe(2);
    expect(state).toEqual({ a: 1, b: 2 });
  });

  it('should skip entries before checkpoint on recovery', () => {
    const wal = new CheckpointWAL();
    wal.append('SET', { key: 'old1', value: 1 });
    wal.append('SET', { key: 'old2', value: 2 });
    wal.checkpoint(); // entries before here are "safe"

    wal.append('SET', { key: 'new1', value: 3 });
    wal.append('SET', { key: 'new2', value: 4 });

    const state: Record<string, unknown> = {};
    const count = wal.recover((entry) => {
      state[entry.data.key as string] = entry.data.value;
    });

    expect(count).toBe(2);
    expect(state).toEqual({ new1: 3, new2: 4 });
    expect(wal.entriesSinceCheckpoint).toBe(2);
  });

  it('should handle multiple checkpoints — only replay after last', () => {
    const wal = new CheckpointWAL();
    wal.append('SET', { key: 'a', value: 1 });
    wal.checkpoint();

    wal.append('SET', { key: 'b', value: 2 });
    wal.checkpoint();

    wal.append('SET', { key: 'c', value: 3 });

    const state: Record<string, unknown> = {};
    const count = wal.recover((entry) => {
      state[entry.data.key as string] = entry.data.value;
    });

    expect(count).toBe(1);
    expect(state).toEqual({ c: 3 });
  });

  it('should recover nothing from empty WAL', () => {
    const wal = new CheckpointWAL();
    let count = 0;
    const recovered = wal.recover(() => { count++; });

    expect(recovered).toBe(0);
    expect(count).toBe(0);
  });

  it('should recover nothing when checkpoint is at the end', () => {
    const wal = new CheckpointWAL();
    wal.append('SET', { key: 'a', value: 1 });
    wal.append('SET', { key: 'b', value: 2 });
    wal.checkpoint(); // checkpoint right at the end

    const state: Record<string, unknown> = {};
    const count = wal.recover((entry) => {
      state[entry.data.key as string] = entry.data.value;
    });

    expect(count).toBe(0);
    expect(state).toEqual({});
    expect(wal.entriesSinceCheckpoint).toBe(0);
  });
});
