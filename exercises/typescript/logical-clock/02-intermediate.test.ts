import { describe, it, expect } from 'vitest';

/**
 * Logical Clock - Intermediate: Version Vector.
 *
 * TODO: Implement a version vector for tracking causality across
 * N nodes in a distributed system. Each node maintains a counter.
 * increment(nodeId) ticks the local node, merge(other) takes the
 * component-wise max. happensBefore(other) and concurrent(other)
 * detect causal relationships.
 *
 * Real-world use: Amazon DynamoDB conflict detection, Riak CRDTs,
 * distributed version control (git merge-base).
 */

class VersionVector {
  private counters: Map<string, number>;

  constructor() {
    // TODO: implement
    this.counters = new Map();
  }

  /** Increment the counter for a specific node. */
  increment(nodeId: string): void {
    // TODO: implement
    const current = this.counters.get(nodeId) ?? 0;
    this.counters.set(nodeId, current + 1);
  }

  /** Merge with another version vector (component-wise max). */
  merge(other: VersionVector): void {
    // TODO: implement
    for (const [nodeId, count] of other.counters) {
      const current = this.counters.get(nodeId) ?? 0;
      this.counters.set(nodeId, Math.max(current, count));
    }
  }

  /** Get the counter for a specific node (0 if unseen). */
  get(nodeId: string): number {
    return this.counters.get(nodeId) ?? 0;
  }

  /** Returns true if this vector causally happens before other. */
  happensBefore(other: VersionVector): boolean {
    // TODO: implement
    // this <= other (all components) AND this != other
    let strictlyLess = false;

    for (const [nodeId, count] of this.counters) {
      const otherCount = other.get(nodeId);
      if (count > otherCount) return false;
      if (count < otherCount) strictlyLess = true;
    }

    // Check if other has any nodes we don't
    for (const [nodeId] of other.counters) {
      if (!this.counters.has(nodeId)) {
        strictlyLess = true;
      }
    }

    return strictlyLess;
  }

  /** Returns true if neither vector happens before the other. */
  concurrent(other: VersionVector): boolean {
    // TODO: implement
    return !this.happensBefore(other) && !other.happensBefore(this) && !this.equals(other);
  }

  /** Returns true if both vectors are identical. */
  equals(other: VersionVector): boolean {
    if (this.counters.size !== other.counters.size) return false;
    for (const [nodeId, count] of this.counters) {
      if (other.get(nodeId) !== count) return false;
    }
    return true;
  }

  /** Create an independent copy. */
  clone(): VersionVector {
    const copy = new VersionVector();
    for (const [nodeId, count] of this.counters) {
      copy.counters.set(nodeId, count);
    }
    return copy;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Logical Clock - Intermediate: Version Vector', () => {
  it('should detect basic causality (happens-before)', () => {
    const vv1 = new VersionVector();
    vv1.increment('A'); // { A: 1 }

    const vv2 = vv1.clone();
    vv2.increment('A'); // { A: 2 }

    expect(vv1.happensBefore(vv2)).toBe(true);
    expect(vv2.happensBefore(vv1)).toBe(false);
  });

  it('should detect concurrent versions', () => {
    const vv1 = new VersionVector();
    vv1.increment('A'); // { A: 1 }

    const vv2 = new VersionVector();
    vv2.increment('B'); // { B: 1 }

    expect(vv1.concurrent(vv2)).toBe(true);
    expect(vv1.happensBefore(vv2)).toBe(false);
    expect(vv2.happensBefore(vv1)).toBe(false);
  });

  it('should merge by taking component-wise max', () => {
    const vv1 = new VersionVector();
    vv1.increment('A'); // { A: 1 }
    vv1.increment('A'); // { A: 2 }

    const vv2 = new VersionVector();
    vv2.increment('A'); // { A: 1 }
    vv2.increment('B'); // { A: 1, B: 1 }

    vv1.merge(vv2); // { A: 2, B: 1 }
    expect(vv1.get('A')).toBe(2); // max(2, 1)
    expect(vv1.get('B')).toBe(1); // max(0, 1)
  });

  it('should support transitivity of happens-before', () => {
    const vv1 = new VersionVector();
    vv1.increment('A'); // { A: 1 }

    const vv2 = vv1.clone();
    vv2.increment('B'); // { A: 1, B: 1 }

    const vv3 = vv2.clone();
    vv3.increment('C'); // { A: 1, B: 1, C: 1 }

    // Transitivity: vv1 < vv2 < vv3 implies vv1 < vv3
    expect(vv1.happensBefore(vv2)).toBe(true);
    expect(vv2.happensBefore(vv3)).toBe(true);
    expect(vv1.happensBefore(vv3)).toBe(true);
  });

  it('should not be concurrent after merge resolves conflict', () => {
    const vv1 = new VersionVector();
    vv1.increment('A'); // { A: 1 }

    const vv2 = new VersionVector();
    vv2.increment('B'); // { B: 1 }

    expect(vv1.concurrent(vv2)).toBe(true);

    // Merge resolves the concurrency
    const merged = vv1.clone();
    merged.merge(vv2); // { A: 1, B: 1 }
    merged.increment('A'); // { A: 2, B: 1 }

    expect(vv1.happensBefore(merged)).toBe(true);
    expect(vv2.happensBefore(merged)).toBe(true);
    expect(merged.concurrent(vv1)).toBe(false);
  });
});
