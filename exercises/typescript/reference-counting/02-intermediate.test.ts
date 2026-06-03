import { describe, it, expect } from 'vitest';

/**
 * Reference Counting - Intermediate: Weak References.
 *
 * TODO: Extend reference counting with WeakHandle<T> — a non-owning
 * reference that does not prevent cleanup. upgrade() returns the value
 * if strong references still exist, or undefined if the value has been
 * cleaned up. This prevents reference cycles and enables caches.
 *
 * Real-world use: Rust's Weak<T>, Java's WeakReference, weak caches.
 */

type CleanupFn<T> = (value: T) => void;

interface SharedInner<T> {
  value: T;
  strongCount: number;
  dropped: boolean;
  cleanup: CleanupFn<T>;
}

class StrongRef<T> {
  private inner: SharedInner<T>;
  private owned: boolean;

  constructor(value: T, cleanup: CleanupFn<T>) {
    // TODO: implement
    this.inner = { value, count: 1, dropped: false, cleanup } as unknown as SharedInner<T>;
    this.inner.strongCount = 1;
    this.owned = true;
  }

  clone(): StrongRef<T> {
    // TODO: implement
    if (!this.owned) throw new Error('Cannot clone a dropped reference');
    this.inner.strongCount++;
    const cloned = Object.create(StrongRef.prototype) as StrongRef<T>;
    cloned.inner = this.inner;
    cloned.owned = true;
    return cloned;
  }

  drop(): void {
    // TODO: implement
    if (!this.owned) return;
    this.owned = false;
    this.inner.strongCount--;
    if (this.inner.strongCount === 0 && !this.inner.dropped) {
      this.inner.dropped = true;
      this.inner.cleanup(this.inner.value);
    }
  }

  /** Create a weak (non-owning) handle to this value. */
  downgrade(): WeakHandle<T> {
    // TODO: implement
    if (!this.owned) throw new Error('Cannot downgrade a dropped reference');
    return new WeakHandle(this.inner);
  }

  strongCount(): number {
    return this.inner.strongCount;
  }

  value(): T {
    if (!this.owned) throw new Error('Reference has been dropped');
    return this.inner.value;
  }
}

class WeakHandle<T> {
  private inner: SharedInner<T>;

  constructor(inner: SharedInner<T>) {
    // TODO: implement
    this.inner = inner;
  }

  /** Returns the value if still alive, undefined if cleaned up. */
  upgrade(): T | undefined {
    // TODO: implement
    if (this.inner.dropped) return undefined;
    return this.inner.value;
  }

  /** Check if the underlying value is still alive. */
  isAlive(): boolean {
    return !this.inner.dropped;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Reference Counting - Intermediate: Weak References', () => {
  it('should access value through weak ref while strong ref alive', () => {
    const strong = new StrongRef('data', () => {});
    const weak = strong.downgrade();

    expect(weak.upgrade()).toBe('data');
    expect(weak.isAlive()).toBe(true);
  });

  it('should return undefined from weak ref after last strong drops', () => {
    const cleaned: string[] = [];
    const strong = new StrongRef('resource', (v) => cleaned.push(v));
    const weak = strong.downgrade();

    strong.drop();
    expect(weak.upgrade()).toBeUndefined();
    expect(weak.isAlive()).toBe(false);
    expect(cleaned).toEqual(['resource']);
  });

  it('should support multiple weak refs to the same value', () => {
    const strong = new StrongRef(42, () => {});
    const w1 = strong.downgrade();
    const w2 = strong.downgrade();

    expect(w1.upgrade()).toBe(42);
    expect(w2.upgrade()).toBe(42);

    strong.drop();
    expect(w1.upgrade()).toBeUndefined();
    expect(w2.upgrade()).toBeUndefined();
  });

  it('should keep value alive while any strong ref exists', () => {
    const strong1 = new StrongRef('shared', () => {});
    const strong2 = strong1.clone();
    const weak = strong1.downgrade();

    strong1.drop();
    expect(weak.upgrade()).toBe('shared'); // strong2 still alive

    strong2.drop();
    expect(weak.upgrade()).toBeUndefined(); // all strong refs gone
  });

  it('weak ref does not prevent cleanup', () => {
    let cleanedUp = false;
    const strong = new StrongRef('temp', () => { cleanedUp = true; });
    const _weak = strong.downgrade();

    // Weak ref exists but should not prevent cleanup
    expect(strong.strongCount()).toBe(1);
    strong.drop();
    expect(cleanedUp).toBe(true);
  });
});
