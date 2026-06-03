import { describe, it, expect, vi } from 'vitest';

/**
 * Dirty Flag - Basic: Lazy computation wrapper.
 *
 * TODO: Implement a DirtyFlag wrapper that:
 * - Takes a compute function in the constructor
 * - get(): Returns the computed value, recomputing only if dirty
 * - markDirty(): Marks the value as needing recomputation
 * - isDirty: Boolean indicating whether recomputation is pending
 *
 * The initial state should be dirty (first get() triggers compute).
 */

class DirtyFlag<T> {
  private dirty = true;
  private cached: T | undefined;

  constructor(private compute: () => T) {}

  markDirty(): void {
    // TODO: implement
    this.dirty = true;
  }

  get(): T {
    // TODO: implement
    if (this.dirty) {
      this.cached = this.compute();
      this.dirty = false;
    }
    return this.cached!;
  }

  get isDirty(): boolean {
    return this.dirty;
  }
}

// --- Tests (do not modify below this line) ---

describe('Dirty Flag - Basic', () => {
  it('should compute on first get', () => {
    const compute = vi.fn(() => 42);
    const flag = new DirtyFlag(compute);
    expect(flag.isDirty).toBe(true);
    expect(flag.get()).toBe(42);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(flag.isDirty).toBe(false);
  });

  it('should cache value on subsequent gets', () => {
    const compute = vi.fn(() => 'expensive');
    const flag = new DirtyFlag(compute);
    flag.get();
    flag.get();
    flag.get();
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('should recompute after markDirty', () => {
    let counter = 0;
    const compute = vi.fn(() => ++counter);
    const flag = new DirtyFlag(compute);

    expect(flag.get()).toBe(1);
    expect(flag.get()).toBe(1); // cached

    flag.markDirty();
    expect(flag.isDirty).toBe(true);
    expect(flag.get()).toBe(2); // recomputed
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('should not recompute if not dirty', () => {
    const compute = vi.fn(() => Math.random());
    const flag = new DirtyFlag(compute);
    const first = flag.get();
    const second = flag.get();
    expect(first).toBe(second);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple dirty-clean cycles', () => {
    let val = 'a';
    const compute = vi.fn(() => val);
    const flag = new DirtyFlag(compute);

    expect(flag.get()).toBe('a');

    val = 'b';
    flag.markDirty();
    expect(flag.get()).toBe('b');

    val = 'c';
    flag.markDirty();
    expect(flag.get()).toBe('c');

    expect(compute).toHaveBeenCalledTimes(3);
  });
});
