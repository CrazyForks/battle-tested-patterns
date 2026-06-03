import { describe, it, expect } from 'vitest';

/**
 * B+ Tree - Intermediate: Range queries with linked leaf traversal.
 *
 * TODO: Extend the B+ tree with:
 * - rangeQuery(start, end): Return all values with keys in [start, end]
 *   by following the linked leaf chain.
 *
 * Real-world use: SQL `WHERE x BETWEEN a AND b` on an indexed column.
 */

class BPlusLeaf {
  keys: number[] = [];
  values: string[] = [];
  next: BPlusLeaf | null = null;
}

class BPlusInternal {
  keys: number[] = [];
  children: (BPlusInternal | BPlusLeaf)[] = [];
}

type BPlusNode = BPlusInternal | BPlusLeaf;

class BPlusTree {
  private root: BPlusNode;

  constructor(private order: number) {
    this.root = new BPlusLeaf();
  }

  search(key: number): string | undefined {
    let node = this.root;
    while (node instanceof BPlusInternal) {
      let i = 0;
      while (i < node.keys.length && key >= node.keys[i]!) i++;
      node = node.children[i]!;
    }
    const leaf = node as BPlusLeaf;
    const idx = leaf.keys.indexOf(key);
    return idx >= 0 ? leaf.values[idx]! : undefined;
  }

  insert(key: number, value: string): void {
    const result = this.insertNode(this.root, key, value);
    if (result) {
      const newRoot = new BPlusInternal();
      newRoot.keys = [result.key];
      newRoot.children = [this.root, result.node];
      this.root = newRoot;
    }
  }

  /** Return all values with keys in [start, end] using linked leaf traversal. */
  rangeQuery(start: number, end: number): string[] {
    // TODO: implement
    let node = this.root;
    while (node instanceof BPlusInternal) {
      let i = 0;
      while (i < node.keys.length && start >= node.keys[i]!) i++;
      node = node.children[i]!;
    }
    const results: string[] = [];
    let leaf: BPlusLeaf | null = node as BPlusLeaf;
    while (leaf) {
      for (let i = 0; i < leaf.keys.length; i++) {
        if (leaf.keys[i]! > end) return results;
        if (leaf.keys[i]! >= start) results.push(leaf.values[i]!);
      }
      leaf = leaf.next;
    }
    return results;
  }

  private insertNode(
    node: BPlusNode,
    key: number,
    value: string,
  ): { key: number; node: BPlusNode } | null {
    if (node instanceof BPlusLeaf) {
      let i = 0;
      while (i < node.keys.length && node.keys[i]! < key) i++;
      if (i < node.keys.length && node.keys[i]! === key) {
        node.values[i] = value;
        return null;
      }
      node.keys.splice(i, 0, key);
      node.values.splice(i, 0, value);
      if (node.keys.length >= this.order) return this.splitLeaf(node);
      return null;
    }
    const internal = node as BPlusInternal;
    let i = 0;
    while (i < internal.keys.length && key >= internal.keys[i]!) i++;
    const result = this.insertNode(internal.children[i]!, key, value);
    if (!result) return null;
    internal.keys.splice(i, 0, result.key);
    internal.children.splice(i + 1, 0, result.node);
    if (internal.keys.length >= this.order) return this.splitInternal(internal);
    return null;
  }

  private splitLeaf(leaf: BPlusLeaf) {
    const mid = Math.ceil(leaf.keys.length / 2);
    const newLeaf = new BPlusLeaf();
    newLeaf.keys = leaf.keys.splice(mid);
    newLeaf.values = leaf.values.splice(mid);
    newLeaf.next = leaf.next;
    leaf.next = newLeaf;
    return { key: newLeaf.keys[0]!, node: newLeaf as BPlusNode };
  }

  private splitInternal(node: BPlusInternal) {
    const mid = Math.floor(node.keys.length / 2);
    const promoteKey = node.keys[mid]!;
    const newNode = new BPlusInternal();
    newNode.keys = node.keys.splice(mid + 1);
    newNode.children = node.children.splice(mid + 1);
    node.keys.pop();
    return { key: promoteKey, node: newNode as BPlusNode };
  }
}

// --- Tests (do not modify below this line) ---

describe('B+ Tree - Intermediate: Range Queries', () => {
  it('should return all values in range', () => {
    const tree = new BPlusTree(3);
    for (let i = 1; i <= 20; i++) {
      tree.insert(i, `v${i}`);
    }
    const result = tree.rangeQuery(5, 10);
    expect(result).toEqual(['v5', 'v6', 'v7', 'v8', 'v9', 'v10']);
  });

  it('should return empty array for no matches', () => {
    const tree = new BPlusTree(3);
    tree.insert(1, 'a');
    tree.insert(10, 'b');
    expect(tree.rangeQuery(5, 8)).toEqual([]);
  });

  it('should handle range covering all keys', () => {
    const tree = new BPlusTree(4);
    tree.insert(3, 'c');
    tree.insert(1, 'a');
    tree.insert(2, 'b');
    expect(tree.rangeQuery(1, 3)).toEqual(['a', 'b', 'c']);
  });

  it('should handle single key in range', () => {
    const tree = new BPlusTree(3);
    for (let i = 1; i <= 10; i++) {
      tree.insert(i * 10, `val-${i * 10}`);
    }
    expect(tree.rangeQuery(50, 50)).toEqual(['val-50']);
  });

  it('should handle large range across many leaf nodes', () => {
    const tree = new BPlusTree(3);
    for (let i = 1; i <= 100; i++) {
      tree.insert(i, `v${i}`);
    }
    const result = tree.rangeQuery(25, 75);
    expect(result.length).toBe(51);
    expect(result[0]).toBe('v25');
    expect(result[result.length - 1]).toBe('v75');
  });
});
