import { describe, it, expect } from 'vitest';

/**
 * Consistent Hashing - Intermediate: Virtual Nodes.
 *
 * TODO: Implement a consistent hash ring with configurable virtual nodes
 * per physical node. More vnodes = better distribution. Supports add,
 * remove, and lookup with a nodeCount accessor.
 *
 * Real-world use: DynamoDB partitioning, Cassandra vnodes, load balancers.
 */

class VNodeHashRing {
  private ring = new Map<number, string>();
  private sortedHashes: number[] = [];
  private nodes = new Set<string>();

  constructor(private vnodeCount: number = 150) {} // TODO: implement

  private hash(key: string): number {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** Add a physical node with its virtual nodes. */
  addNode(node: string): void {
    // TODO: implement
    if (this.nodes.has(node)) return;
    this.nodes.add(node);
    for (let i = 0; i < this.vnodeCount; i++) {
      const h = this.hash(`${node}#${i}`);
      this.ring.set(h, node);
    }
    this.rebuildSorted();
  }

  /** Remove a physical node and all its virtual nodes. */
  removeNode(node: string): void {
    // TODO: implement
    if (!this.nodes.has(node)) return;
    this.nodes.delete(node);
    for (let i = 0; i < this.vnodeCount; i++) {
      const h = this.hash(`${node}#${i}`);
      this.ring.delete(h);
    }
    this.rebuildSorted();
  }

  /** Find which node owns the given key. */
  getNode(key: string): string | undefined {
    // TODO: implement
    if (this.sortedHashes.length === 0) return undefined;
    const h = this.hash(key);

    // Binary search for first hash >= h
    let lo = 0;
    let hi = this.sortedHashes.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.sortedHashes[mid]! < h) lo = mid + 1;
      else hi = mid;
    }

    const idx = lo < this.sortedHashes.length ? lo : 0;
    return this.ring.get(this.sortedHashes[idx]!);
  }

  /** Number of physical nodes in the ring. */
  get nodeCount(): number {
    return this.nodes.size;
  }

  private rebuildSorted(): void {
    this.sortedHashes = Array.from(this.ring.keys()).sort((a, b) => a - b);
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Consistent Hashing - Intermediate: Virtual Nodes', () => {
  it('should achieve better distribution with more vnodes', () => {
    const fewVnodes = new VNodeHashRing(3);
    const manyVnodes = new VNodeHashRing(200);

    for (const ring of [fewVnodes, manyVnodes]) {
      ring.addNode('A');
      ring.addNode('B');
      ring.addNode('C');
    }

    const count = (ring: VNodeHashRing) => {
      const c: Record<string, number> = { A: 0, B: 0, C: 0 };
      for (let i = 0; i < 3000; i++) {
        const n = ring.getNode(`key-${i}`)!;
        c[n] = (c[n] ?? 0) + 1;
      }
      return c;
    };

    const fewCounts = count(fewVnodes);
    const manyCounts = count(manyVnodes);

    // With many vnodes, std deviation should be lower (better distribution)
    const stddev = (c: Record<string, number>) => {
      const vals = Object.values(c);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      return Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
    };

    expect(stddev(manyCounts)).toBeLessThan(stddev(fewCounts));
  });

  it('should only remap affected keys on node removal', () => {
    const ring = new VNodeHashRing(150);
    ring.addNode('node-alpha');
    ring.addNode('node-beta');
    ring.addNode('node-gamma');

    const keys = Array.from({ length: 1000 }, (_, i) => `item-${i}`);
    const before = keys.map((k) => ring.getNode(k));

    ring.removeNode('node-beta');
    const after = keys.map((k) => ring.getNode(k));

    let changed = 0;
    for (let i = 0; i < keys.length; i++) {
      if (before[i] !== after[i]) changed++;
    }

    // Only keys that were on node-beta should remap (roughly 1/3 of 1000)
    // With consistent hashing, far fewer than all keys should change
    expect(changed).toBeLessThan(600);
    expect(changed).toBeGreaterThan(0); // some must change

    // No key should be mapped to removed node
    for (const node of after) {
      expect(node).not.toBe('node-beta');
    }
  });

  it('should redistribute proportionally when adding a node', () => {
    const ring = new VNodeHashRing(150);
    ring.addNode('A');
    ring.addNode('B');

    const keys = Array.from({ length: 600 }, (_, i) => `data-${i}`);
    const before = keys.map((k) => ring.getNode(k));

    ring.addNode('C');
    const after = keys.map((k) => ring.getNode(k));

    let remapped = 0;
    for (let i = 0; i < keys.length; i++) {
      if (before[i] !== after[i]) remapped++;
    }

    // Adding 1 node to 2 should remap roughly 1/3
    expect(remapped).toBeGreaterThan(50);
    expect(remapped).toBeLessThan(400);
  });

  it('should produce deterministic mapping', () => {
    const ring = new VNodeHashRing(50);
    ring.addNode('X');
    ring.addNode('Y');

    const results = Array.from({ length: 5 }, () => ring.getNode('stable-key'));
    // All lookups of the same key should return the same node
    expect(new Set(results).size).toBe(1);
  });

  it('should return undefined for empty ring', () => {
    const ring = new VNodeHashRing(100);
    expect(ring.getNode('anything')).toBeUndefined();
    expect(ring.nodeCount).toBe(0);
  });
});
