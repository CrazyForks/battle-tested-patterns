import { describe, it, expect } from 'vitest';

/**
 * Free List - Basic: Implement a free list allocator.
 *
 * TODO: Implement a FreeList that manages a pool of fixed-size slots.
 * alloc() returns a slot from the free list (or creates new).
 * free() returns a slot to the free list for reuse.
 */

class FreeList {
  private freeSlots: number[] = [];
  private nextSlot: number;

  constructor(private capacity: number) {
    // TODO: implement
    this.nextSlot = 0;
  }

  alloc(): number | null {
    // TODO: implement
    if (this.freeSlots.length > 0) {
      return this.freeSlots.pop()!;
    }
    if (this.nextSlot >= this.capacity) return null;
    return this.nextSlot++;
  }

  free(slot: number): void {
    // TODO: implement
    this.freeSlots.push(slot);
  }

  get available(): number {
    return this.freeSlots.length + (this.capacity - this.nextSlot);
  }

  get allocated(): number {
    return this.nextSlot - this.freeSlots.length;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Free List - Basic', () => {
  it('should allocate sequential slots', () => {
    const fl = new FreeList(10);
    expect(fl.alloc()).toBe(0);
    expect(fl.alloc()).toBe(1);
    expect(fl.alloc()).toBe(2);
  });

  it('should reuse freed slots', () => {
    const fl = new FreeList(10);
    const a = fl.alloc()!;
    fl.alloc();
    fl.free(a);
    const c = fl.alloc()!;
    expect(c).toBe(a);
  });

  it('should return null when exhausted', () => {
    const fl = new FreeList(2);
    fl.alloc();
    fl.alloc();
    expect(fl.alloc()).toBeNull();
  });

  it('should track available and allocated counts', () => {
    const fl = new FreeList(5);
    fl.alloc();
    fl.alloc();
    expect(fl.allocated).toBe(2);
    expect(fl.available).toBe(3);

    fl.free(0);
    expect(fl.allocated).toBe(1);
    expect(fl.available).toBe(4);
  });

  it('should allow reallocation after free', () => {
    const fl = new FreeList(2);
    fl.alloc();
    const b = fl.alloc()!;
    expect(fl.alloc()).toBeNull();

    fl.free(b);
    expect(fl.alloc()).toBe(b);
  });
});
