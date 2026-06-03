import { describe, it, expect } from 'vitest';

/**
 * Reference Counting - Basic: Ref-Counted Value.
 *
 * TODO: Implement a RefCounted<T> wrapper that tracks how many owners
 * share a value. clone() creates a new owner (increments the count),
 * drop() releases ownership (decrements). When the count reaches zero,
 * a cleanup callback is invoked. Dropping more than once is a no-op.
 *
 * Real-world use: Rust's Rc<T>, Python object lifecycle, shared GPU buffers.
 */

type CleanupFn<T> = (value: T) => void;

interface RefCountedInner<T> {
  value: T;
  count: number;
  dropped: boolean;
  cleanup: CleanupFn<T>;
}

class RefCounted<T> {
  private inner: RefCountedInner<T>;
  private owned: boolean;

  constructor(value: T, cleanup: CleanupFn<T>) {
    // TODO: implement
    this.inner = { value, count: 1, dropped: false, cleanup };
    this.owned = true;
  }

  private constructor_clone(inner: RefCountedInner<T>) {
    this.inner = inner;
    this.owned = true;
  }

  /** Create a new owner sharing the same value. */
  clone(): RefCounted<T> {
    // TODO: implement
    if (!this.owned) throw new Error('Cannot clone a dropped reference');
    this.inner.count++;
    const cloned = Object.create(RefCounted.prototype) as RefCounted<T>;
    cloned.inner = this.inner;
    cloned.owned = true;
    return cloned;
  }

  /** Release this owner's reference. Triggers cleanup when count hits 0. */
  drop(): void {
    // TODO: implement
    if (!this.owned) return; // double-drop is a no-op
    this.owned = false;
    this.inner.count--;
    if (this.inner.count === 0 && !this.inner.dropped) {
      this.inner.dropped = true;
      this.inner.cleanup(this.inner.value);
    }
  }

  /** Current number of live owners. */
  refCount(): number {
    return this.inner.count;
  }

  /** Access the underlying value. Throws if this reference was dropped. */
  value(): T {
    if (!this.owned) throw new Error('Reference has been dropped');
    return this.inner.value;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Reference Counting - Basic', () => {
  it('should start with refCount 1', () => {
    const rc = new RefCounted(42, () => {});
    expect(rc.refCount()).toBe(1);
    expect(rc.value()).toBe(42);
  });

  it('should increment refCount on clone', () => {
    const rc = new RefCounted('hello', () => {});
    const rc2 = rc.clone();
    expect(rc.refCount()).toBe(2);
    expect(rc2.refCount()).toBe(2);
    expect(rc2.value()).toBe('hello');
  });

  it('should decrement refCount on drop', () => {
    const rc = new RefCounted(10, () => {});
    const rc2 = rc.clone();
    expect(rc.refCount()).toBe(2);
    rc2.drop();
    expect(rc.refCount()).toBe(1);
  });

  it('should trigger cleanup when last owner drops', () => {
    const cleaned: string[] = [];
    const rc = new RefCounted('resource', (v) => cleaned.push(v));
    const rc2 = rc.clone();

    rc.drop();
    expect(cleaned).toEqual([]); // still one owner
    rc2.drop();
    expect(cleaned).toEqual(['resource']); // last owner gone
  });

  it('should be safe to double-drop', () => {
    let cleanupCount = 0;
    const rc = new RefCounted(99, () => cleanupCount++);

    rc.drop();
    expect(cleanupCount).toBe(1);
    rc.drop(); // no-op
    rc.drop(); // no-op
    expect(cleanupCount).toBe(1);
  });
});
