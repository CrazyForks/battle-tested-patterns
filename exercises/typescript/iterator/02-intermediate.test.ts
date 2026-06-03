import { describe, it, expect } from 'vitest';

/**
 * Iterator - Intermediate: Lazy Pipeline.
 *
 * TODO: Implement a composable lazy iterator with flatMap, take, and reduce.
 * Track how many times the source is evaluated to prove laziness —
 * chaining should NOT eagerly consume the entire source.
 *
 * Real-world use: Rust's Iterator trait, Java Streams, LINQ.
 */

class LazyIter<T> {
  constructor(private source: () => Generator<T>) {}

  static from<T>(items: T[]): LazyIter<T> {
    // TODO: implement
    return new LazyIter(function* () { yield* items; });
  }

  static infinite(start = 0): LazyIter<number> {
    // TODO: implement — infinite counter starting at `start`
    return new LazyIter(function* () {
      let i = start;
      while (true) yield i++;
    });
  }

  map<U>(fn: (x: T) => U): LazyIter<U> {
    // TODO: implement
    const source = this.source;
    return new LazyIter(function* () {
      for (const item of source()) yield fn(item);
    });
  }

  filter(pred: (x: T) => boolean): LazyIter<T> {
    // TODO: implement
    const source = this.source;
    return new LazyIter(function* () {
      for (const item of source()) if (pred(item)) yield item;
    });
  }

  flatMap<U>(fn: (x: T) => U[]): LazyIter<U> {
    // TODO: implement — lazily expand each item into multiple items
    const source = this.source;
    return new LazyIter(function* () {
      for (const item of source()) {
        yield* fn(item);
      }
    });
  }

  take(n: number): LazyIter<T> {
    // TODO: implement — stop after n items
    const source = this.source;
    return new LazyIter(function* () {
      let count = 0;
      for (const item of source()) {
        if (count++ >= n) break;
        yield item;
      }
    });
  }

  reduce<U>(init: U, fn: (acc: U, x: T) => U): U {
    // TODO: implement — terminal operation
    let acc = init;
    for (const item of this.source()) {
      acc = fn(acc, item);
    }
    return acc;
  }

  collect(): T[] {
    return [...this.source()];
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Iterator - Intermediate: Lazy Pipeline', () => {
  it('should evaluate chained ops lazily', () => {
    let evalCount = 0;
    const tracked = new LazyIter(function* () {
      for (const x of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        evalCount++;
        yield x;
      }
    });

    const result = tracked
      .filter((x) => x % 2 === 0)
      .map((x) => x * 10)
      .take(2)
      .collect();

    expect(result).toEqual([20, 40]);
    // Should NOT have iterated all 10 items — laziness means early stop
    expect(evalCount).toBeLessThan(10);
  });

  it('should flatMap to expand each item', () => {
    const result = LazyIter.from([1, 2, 3])
      .flatMap((x) => [x, x * 10])
      .collect();

    expect(result).toEqual([1, 10, 2, 20, 3, 30]);
  });

  it('should take short-circuit an infinite source', () => {
    const result = LazyIter.infinite(1)
      .take(5)
      .collect();

    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('should reduce as a terminal operation', () => {
    const sum = LazyIter.from([1, 2, 3, 4, 5])
      .filter((x) => x > 2)
      .reduce(0, (acc, x) => acc + x);

    expect(sum).toBe(12); // 3 + 4 + 5
  });

  it('should handle infinite source with filter + take + reduce', () => {
    // Sum of first 4 even numbers starting from 0: 0+2+4+6 = 12
    const sum = LazyIter.infinite(0)
      .filter((x) => x % 2 === 0)
      .take(4)
      .reduce(0, (acc, x) => acc + x);

    expect(sum).toBe(12);
  });
});
