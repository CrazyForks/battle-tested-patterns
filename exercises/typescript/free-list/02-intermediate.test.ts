import { describe, it, expect } from 'vitest';

/**
 * Free List - Intermediate: Generation Pool.
 *
 * TODO: Implement a generational free list where each allocation
 * returns a Handle containing a slot index AND a generation counter.
 * When a slot is freed and reallocated, the generation increments.
 * Accessing a slot with a stale (old generation) handle returns an error.
 *
 * Real-world use: ECS (Entity Component Systems), GPU resource handles,
 * game engine object references (Bevy, Unity DOTS).
 */

interface Handle {
  index: number;
  generation: number;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

class GenerationPool<T> {
  private slots: Array<{ value: T | null; generation: number; occupied: boolean }> = [];
  private freeList: number[] = [];

  constructor(private capacity: number) {
    // TODO: implement
    for (let i = 0; i < capacity; i++) {
      this.slots.push({ value: null, generation: 0, occupied: false });
      this.freeList.push(i);
    }
  }

  /** Allocate a slot, store value, return a handle with current generation. */
  alloc(value: T): Handle | null {
    // TODO: implement
    if (this.freeList.length === 0) return null;
    const index = this.freeList.pop()!;
    const slot = this.slots[index];
    slot.value = value;
    slot.occupied = true;
    return { index, generation: slot.generation };
  }

  /** Free a slot. Increments generation so old handles become stale. */
  free(handle: Handle): boolean {
    // TODO: implement
    const slot = this.slots[handle.index];
    if (!slot || !slot.occupied) return false;
    if (slot.generation !== handle.generation) return false;
    slot.value = null;
    slot.occupied = false;
    slot.generation++;
    this.freeList.push(handle.index);
    return true;
  }

  /** Get value by handle. Returns error if handle is stale or slot is empty. */
  get(handle: Handle): Result<T> {
    // TODO: implement
    const slot = this.slots[handle.index];
    if (!slot) return { ok: false, error: 'invalid index' };
    if (!slot.occupied) return { ok: false, error: 'slot is empty' };
    if (slot.generation !== handle.generation) {
      return { ok: false, error: 'stale handle' };
    }
    return { ok: true, value: slot.value! };
  }

  get allocated(): number {
    return this.slots.filter((s) => s.occupied).length;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Free List - Intermediate: Generation Pool', () => {
  it('should increment generation on reuse', () => {
    const pool = new GenerationPool<string>(4);
    const h1 = pool.alloc('first')!;
    expect(h1.generation).toBe(0);

    pool.free(h1);
    const h2 = pool.alloc('second')!;

    // Same slot reused, but generation incremented
    expect(h2.index).toBe(h1.index);
    expect(h2.generation).toBe(1);
  });

  it('should detect stale handles', () => {
    const pool = new GenerationPool<string>(4);
    const h1 = pool.alloc('hello')!;

    pool.free(h1);
    pool.alloc('world'); // reuses same slot

    // Old handle is now stale
    const result = pool.get(h1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('stale handle');
  });

  it('should allow access with fresh handle', () => {
    const pool = new GenerationPool<number>(4);
    const h1 = pool.alloc(42)!;
    pool.free(h1);

    const h2 = pool.alloc(99)!;
    const result = pool.get(h2);
    expect(result).toEqual({ ok: true, value: 99 });
  });

  it('should handle double-free safely', () => {
    const pool = new GenerationPool<string>(4);
    const h = pool.alloc('test')!;

    expect(pool.free(h)).toBe(true);
    // Second free should fail — slot is already free
    expect(pool.free(h)).toBe(false);
    expect(pool.allocated).toBe(0);
  });

  it('should reuse freed slots for new allocations', () => {
    const pool = new GenerationPool<string>(2);
    const h1 = pool.alloc('a')!;
    const h2 = pool.alloc('b')!;
    expect(pool.alloc('c')).toBeNull(); // full

    pool.free(h1);
    const h3 = pool.alloc('c')!;
    expect(h3).not.toBeNull();
    expect(pool.get(h3)).toEqual({ ok: true, value: 'c' });
    expect(pool.allocated).toBe(2);
  });
});
