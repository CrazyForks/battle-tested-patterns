import { describe, it, expect } from 'vitest';

/**
 * Skip List - Intermediate: Range Query.
 *
 * TODO: Implement a skip list with a range(low, high) method that
 * returns all values whose keys fall within [low, high] (inclusive).
 * Results must be sorted by key ascending.
 *
 * Real-world use: database index scans, time-series range queries,
 * Redis sorted sets (ZRANGEBYSCORE).
 */

class SkipNode {
  forward: (SkipNode | null)[];
  constructor(
    public key: number,
    public value: string,
    level: number,
  ) {
    this.forward = new Array(level + 1).fill(null);
  }
}

class RangeSkipList {
  private maxLevel = 16;
  private level = 0;
  private header: SkipNode;
  private p = 0.5;

  constructor() {
    // TODO: implement
    this.header = new SkipNode(-Infinity, '', this.maxLevel);
  }

  private randomLevel(): number {
    let lvl = 0;
    while (lvl < this.maxLevel && Math.random() < this.p) lvl++;
    return lvl;
  }

  insert(key: number, value: string): void {
    // TODO: implement
    const update: (SkipNode | null)[] = new Array(this.maxLevel + 1).fill(null);
    let current = this.header;

    for (let i = this.level; i >= 0; i--) {
      while (current.forward[i] && current.forward[i]!.key < key) {
        current = current.forward[i]!;
      }
      update[i] = current;
    }

    const next = current.forward[0];
    if (next && next.key === key) {
      next.value = value;
      return;
    }

    const newLevel = this.randomLevel();
    if (newLevel > this.level) {
      for (let i = this.level + 1; i <= newLevel; i++) update[i] = this.header;
      this.level = newLevel;
    }

    const node = new SkipNode(key, value, newLevel);
    for (let i = 0; i <= newLevel; i++) {
      node.forward[i] = update[i]!.forward[i] ?? null;
      update[i]!.forward[i] = node;
    }
  }

  /**
   * Return all values whose keys are in [low, high] (inclusive),
   * sorted by key ascending.
   */
  range(low: number, high: number): string[] {
    // TODO: implement
    const results: string[] = [];

    // Use skip list levels to find starting position
    let current = this.header;
    for (let i = this.level; i >= 0; i--) {
      while (current.forward[i] && current.forward[i]!.key < low) {
        current = current.forward[i]!;
      }
    }

    // Walk level 0 from here, collecting values in range
    current = current.forward[0]!;
    while (current && current.key <= high) {
      results.push(current.value);
      current = current.forward[0]!;
    }

    return results;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Skip List - Intermediate: Range Query', () => {
  it('should return values in a basic range', () => {
    const sl = new RangeSkipList();
    sl.insert(10, 'ten');
    sl.insert(20, 'twenty');
    sl.insert(30, 'thirty');
    sl.insert(40, 'forty');
    sl.insert(50, 'fifty');

    expect(sl.range(20, 40)).toEqual(['twenty', 'thirty', 'forty']);
  });

  it('should return empty array when no keys in range', () => {
    const sl = new RangeSkipList();
    sl.insert(1, 'one');
    sl.insert(2, 'two');
    sl.insert(10, 'ten');

    expect(sl.range(5, 9)).toEqual([]);
    expect(sl.range(100, 200)).toEqual([]);
  });

  it('should return all values for a full range', () => {
    const sl = new RangeSkipList();
    sl.insert(3, 'c');
    sl.insert(1, 'a');
    sl.insert(2, 'b');

    expect(sl.range(1, 3)).toEqual(['a', 'b', 'c']);
    expect(sl.range(0, 100)).toEqual(['a', 'b', 'c']);
  });

  it('should handle range containing a single element', () => {
    const sl = new RangeSkipList();
    sl.insert(5, 'five');
    sl.insert(15, 'fifteen');
    sl.insert(25, 'twenty-five');

    expect(sl.range(15, 15)).toEqual(['fifteen']);
    expect(sl.range(5, 5)).toEqual(['five']);
  });

  it('should include boundary values (inclusive range)', () => {
    const sl = new RangeSkipList();
    sl.insert(10, 'start');
    sl.insert(11, 'mid-a');
    sl.insert(12, 'mid-b');
    sl.insert(13, 'mid-c');
    sl.insert(14, 'end');

    const result = sl.range(10, 14);
    expect(result[0]).toBe('start');
    expect(result[result.length - 1]).toBe('end');
    expect(result).toHaveLength(5);
  });
});
