import { describe, it, expect } from 'vitest';

/**
 * Arena Allocator - Intermediate: String Arena.
 *
 * TODO: Implement an arena that allocates strings by bumping an offset
 * into a pre-allocated buffer. alloc(str) stores the string and returns
 * a numeric handle. get(handle) retrieves the string. reset() frees all
 * allocations at once. Returns null when capacity is exhausted.
 *
 * Real-world use: compilers (string tables), game engines, parsers.
 */

class StringArena {
  private buffer: string[] = [];
  private totalBytes = 0;

  constructor(private capacityBytes: number) {} // TODO: implement

  /**
   * Allocate a string in the arena.
   * Returns a handle (index) or null if capacity exhausted.
   * Each character counts as 1 byte for simplicity.
   */
  alloc(str: string): number | null {
    // TODO: implement
    if (this.totalBytes + str.length > this.capacityBytes) return null;
    const handle = this.buffer.length;
    this.buffer.push(str);
    this.totalBytes += str.length;
    return handle;
  }

  /** Retrieve a string by handle. Returns undefined for invalid handles. */
  get(handle: number): string | undefined {
    // TODO: implement
    if (handle < 0 || handle >= this.buffer.length) return undefined;
    return this.buffer[handle];
  }

  /** Free all allocations at once. */
  reset(): void {
    // TODO: implement
    this.buffer = [];
    this.totalBytes = 0;
  }

  /** Number of bytes currently allocated. */
  get used(): number {
    return this.totalBytes;
  }

  /** Total capacity in bytes. */
  get capacity(): number {
    return this.capacityBytes;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Arena Allocator - Intermediate: String Arena', () => {
  it('should allocate strings sequentially', () => {
    const arena = new StringArena(100);
    const h0 = arena.alloc('hello');
    const h1 = arena.alloc('world');

    expect(h0).toBe(0);
    expect(h1).toBe(1);
    expect(arena.used).toBe(10); // 5 + 5
  });

  it('should retrieve correct strings by handle', () => {
    const arena = new StringArena(100);
    const h0 = arena.alloc('alpha');
    const h1 = arena.alloc('beta');
    const h2 = arena.alloc('gamma');

    expect(arena.get(h0!)).toBe('alpha');
    expect(arena.get(h1!)).toBe('beta');
    expect(arena.get(h2!)).toBe('gamma');
    expect(arena.get(999)).toBeUndefined();
  });

  it('should free all allocations on reset', () => {
    const arena = new StringArena(50);
    arena.alloc('first');
    arena.alloc('second');
    expect(arena.used).toBe(11);

    arena.reset();
    expect(arena.used).toBe(0);
    expect(arena.get(0)).toBeUndefined();
    expect(arena.get(1)).toBeUndefined();
  });

  it('should allow re-allocation after reset', () => {
    const arena = new StringArena(20);
    arena.alloc('abcdefghij'); // 10 bytes
    arena.alloc('klmnopqrst'); // 10 bytes — full
    expect(arena.alloc('x')).toBeNull(); // no space

    arena.reset();
    const h = arena.alloc('new-string'); // 10 bytes — fits again
    expect(h).toBe(0);
    expect(arena.get(h!)).toBe('new-string');
    expect(arena.used).toBe(10);
  });

  it('should return null when capacity is exhausted', () => {
    const arena = new StringArena(8);
    const h0 = arena.alloc('abcd'); // 4 bytes
    expect(h0).toBe(0);

    const h1 = arena.alloc('efgh'); // 4 bytes — exactly fills
    expect(h1).toBe(1);

    const h2 = arena.alloc('x'); // 1 byte — no room
    expect(h2).toBeNull();
    expect(arena.used).toBe(8);
    expect(arena.capacity).toBe(8);
  });
});
