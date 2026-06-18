import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';

/**
 * Merkle Tree - Basic: Build a Merkle tree, get root hash, verify proof.
 *
 * TODO: Implement a MerkleTree that:
 * - Constructs a binary hash tree from data blocks
 * - Returns the root hash (fingerprint of entire dataset)
 * - Generates a proof path for any leaf
 * - Verifies a leaf against the root using a proof
 */

function hash(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

class MerkleTree {
  private leaves: string[];
  private layers: string[][];

  constructor(data: string[]) {
    // TODO: hash each data item to form leaf layer, then build tree
    this.leaves = data.map((d) => hash(d));
    this.layers = [this.leaves];
    this.buildTree();
  }

  private buildTree(): void {
    // TODO: hash pairs upward until reaching a single root
    let current = this.leaves;
    while (current.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < current.length; i += 2) {
        const left = current[i]!;
        const right = current[i + 1] ?? left; // duplicate last if odd
        next.push(hash(left + right));
      }
      this.layers.push(next);
      current = next;
    }
  }

  get root(): string {
    // TODO: return the root hash
    return this.layers[this.layers.length - 1]![0]!;
  }

  getProof(index: number): Array<{ hash: string; position: 'left' | 'right' }> {
    // TODO: return sibling hashes from leaf to root
    const proof: Array<{ hash: string; position: 'left' | 'right' }> = [];
    let idx = index;
    for (let i = 0; i < this.layers.length - 1; i++) {
      const layer = this.layers[i]!;
      const isRight = idx % 2 === 1;
      const siblingIdx = isRight ? idx - 1 : idx + 1;
      if (siblingIdx < layer.length) {
        proof.push({
          hash: layer[siblingIdx]!,
          position: isRight ? 'left' : 'right',
        });
      } else {
        proof.push({ hash: layer[idx]!, position: 'right' });
      }
      idx = Math.floor(idx / 2);
    }
    return proof;
  }

  static verify(
    leaf: string,
    proof: Array<{ hash: string; position: 'left' | 'right' }>,
    root: string,
  ): boolean {
    // TODO: walk proof from leaf hash to root, compare
    let current = hash(leaf);
    for (const step of proof) {
      if (step.position === 'left') {
        current = hash(step.hash + current);
      } else {
        current = hash(current + step.hash);
      }
    }
    return current === root;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Merkle Tree - Basic', () => {
  it('should build a tree and produce a root hash', () => {
    const tree = new MerkleTree(['a', 'b', 'c', 'd']);
    expect(tree.root).toBeDefined();
    expect(typeof tree.root).toBe('string');
    expect(tree.root.length).toBe(64); // SHA-256 hex
  });

  it('should produce different roots for different data', () => {
    const tree1 = new MerkleTree(['a', 'b', 'c', 'd']);
    const tree2 = new MerkleTree(['a', 'b', 'c', 'e']);
    expect(tree1.root).not.toBe(tree2.root);
  });

  it('should produce same root for same data', () => {
    const tree1 = new MerkleTree(['x', 'y', 'z']);
    const tree2 = new MerkleTree(['x', 'y', 'z']);
    expect(tree1.root).toBe(tree2.root);
  });

  it('should generate a valid proof for a leaf', () => {
    const data = ['alpha', 'beta', 'gamma', 'delta'];
    const tree = new MerkleTree(data);

    const proof = tree.getProof(0);
    expect(proof.length).toBeGreaterThan(0);

    const valid = MerkleTree.verify('alpha', proof, tree.root);
    expect(valid).toBe(true);
  });

  it('should verify all leaves in a 4-leaf tree', () => {
    const data = ['w', 'x', 'y', 'z'];
    const tree = new MerkleTree(data);

    for (let i = 0; i < data.length; i++) {
      const proof = tree.getProof(i);
      expect(MerkleTree.verify(data[i]!, proof, tree.root)).toBe(true);
    }
  });

  it('should reject tampered data', () => {
    const data = ['a', 'b', 'c', 'd'];
    const tree = new MerkleTree(data);
    const proof = tree.getProof(1);

    // Verify original passes
    expect(MerkleTree.verify('b', proof, tree.root)).toBe(true);
    // Verify tampered fails
    expect(MerkleTree.verify('TAMPERED', proof, tree.root)).toBe(false);
  });

  it('should handle odd number of leaves', () => {
    const data = ['a', 'b', 'c'];
    const tree = new MerkleTree(data);

    expect(tree.root.length).toBe(64);
    for (let i = 0; i < data.length; i++) {
      const proof = tree.getProof(i);
      expect(MerkleTree.verify(data[i]!, proof, tree.root)).toBe(true);
    }
  });

  it('should handle single-element tree', () => {
    const tree = new MerkleTree(['only']);
    expect(tree.root).toBe(hash('only'));
  });
});
