import { describe, it, expect } from 'vitest';

/**
 * B+ Tree - Basic: Implement a B+ tree with insert and search.
 *
 * TODO: Implement a BPlusTree with:
 * - insert(key, value): Insert a key-value pair, splitting nodes when full
 * - search(key): Find a value by key, returning undefined if not found
 *
 * The tree should maintain sorted order and handle node splitting
 * when a node exceeds `order` keys.
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
    // TODO: implement
    this.root = new BPlusLeaf();
  }

  search(key: number): string | undefined {
    // TODO: implement
    let node = this.root;
    while (node instanceof BPlusInternal) {
      let i = 0;
      while (i < node.keys.length && key >= node.keys[i]!) i++;
      node = node.children[i]!;
    }
    const leaf = node as BPlusLeaf;
    const idx = leaf.keys.indexOf(key);
    return idx >= 0 ? leaf.values[idx] : undefined;
  }

  insert(key: number, value: string): void {
    // TODO: implement
    const result = this.insertNode(this.root, key, value);
    if (result) {
      const newRoot = new BPlusInternal();
      newRoot.keys = [result.key];
      newRoot.children = [this.root, result.node];
      this.root = newRoot;
    }
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
      if (node.keys.length >= this.order) {
        return this.splitLeaf(node);
      }
      return null;
    }
    const internal = node as BPlusInternal;
    let i = 0;
    while (i < internal.keys.length && key >= internal.keys[i]!) i++;
    const result = this.insertNode(internal.children[i]!, key, value);
    if (!result) return null;
    internal.keys.splice(i, 0, result.key);
    internal.children.splice(i + 1, 0, result.node);
    if (internal.keys.length >= this.order) {
      return this.splitInternal(internal);
    }
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

describe('B+ Tree - Basic', () => {
  it('should insert and search single key', () => {
    const tree = new BPlusTree(3);
    tree.insert(10, 'ten');
    expect(tree.search(10)).toBe('ten');
  });

  it('should return undefined for missing key', () => {
    const tree = new BPlusTree(3);
    tree.insert(10, 'ten');
    expect(tree.search(5)).toBeUndefined();
  });

  it('should handle multiple inserts in sorted order', () => {
    const tree = new BPlusTree(4);
    tree.insert(10, 'a');
    tree.insert(20, 'b');
    tree.insert(30, 'c');
    expect(tree.search(10)).toBe('a');
    expect(tree.search(20)).toBe('b');
    expect(tree.search(30)).toBe('c');
  });

  it('should handle inserts that cause splits', () => {
    const tree = new BPlusTree(3); // split after 3 keys
    for (let i = 1; i <= 10; i++) {
      tree.insert(i, `val-${i}`);
    }
    for (let i = 1; i <= 10; i++) {
      expect(tree.search(i)).toBe(`val-${i}`);
    }
  });

  it('should update value on duplicate key', () => {
    const tree = new BPlusTree(3);
    tree.insert(5, 'old');
    tree.insert(5, 'new');
    expect(tree.search(5)).toBe('new');
  });

  it('should handle reverse-order inserts', () => {
    const tree = new BPlusTree(3);
    for (let i = 20; i >= 1; i--) {
      tree.insert(i, `val-${i}`);
    }
    for (let i = 1; i <= 20; i++) {
      expect(tree.search(i)).toBe(`val-${i}`);
    }
  });
});
