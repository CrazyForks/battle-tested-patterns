import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';

/**
 * Merkle Tree - Intermediate: Detect tampered leaf and generate minimal proof.
 *
 * TODO: Implement a MerkleTree with:
 * - findTampered(newData): compares against original tree to find tampered indices
 * - getMultiProof(indices): generates a minimal combined proof for multiple leaves
 *
 * Real-world use: Git's tree diff (only walk changed subtrees),
 * blockchain light client batch verification.
 */

function hash(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

class MerkleTree {
  private leaves: string[];
  private layers: string[][];

  constructor(data: string[]) {
    this.leaves = data.map((d) => hash(d));
    this.layers = [this.leaves];
    this.buildTree();
  }

  private buildTree(): void {
    let current = this.leaves;
    while (current.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < current.length; i += 2) {
        const left = current[i]!;
        const right = current[i + 1] ?? left;
        next.push(hash(left + right));
      }
      this.layers.push(next);
      current = next;
    }
  }

  get root(): string {
    return this.layers[this.layers.length - 1]![0]!;
  }

  get leafCount(): number {
    return this.leaves.length;
  }

  getLeafHash(index: number): string {
    return this.leaves[index]!;
  }

  /**
   * Compare with new data, return indices of leaves that differ.
   * Uses top-down traversal: if a subtree hash matches, skip it entirely.
   */
  findTampered(newData: string[]): number[] {
    // TODO: build a new tree from newData, compare subtrees top-down
    const newTree = new MerkleTree(newData);
    const tampered: number[] = [];

    const compare = (layerIdx: number, nodeIdx: number): void => {
      if (layerIdx === 0) {
        // Leaf layer
        if (nodeIdx < this.leaves.length) {
          if (this.leaves[nodeIdx] !== newTree.leaves[nodeIdx]) {
            tampered.push(nodeIdx);
          }
        }
        return;
      }

      // If subtree hashes match, skip entire subtree
      const oldHash = this.layers[layerIdx]?.[nodeIdx];
      const newHash = newTree.layers[layerIdx]?.[nodeIdx];
      if (oldHash === newHash) {
        return;
      }

      // Recurse into children
      compare(layerIdx - 1, nodeIdx * 2);
      compare(layerIdx - 1, nodeIdx * 2 + 1);
    };

    compare(this.layers.length - 1, 0);
    return tampered.sort((a, b) => a - b);
  }

  /**
   * Generate proof for a single leaf.
   */
  getProof(index: number): Array<{ hash: string; position: 'left' | 'right' }> {
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

describe('Merkle Tree - Intermediate: Tamper Detection', () => {
  it('should detect no tampering when data is identical', () => {
    const data = ['a', 'b', 'c', 'd'];
    const tree = new MerkleTree(data);

    const tampered = tree.findTampered(['a', 'b', 'c', 'd']);
    expect(tampered).toEqual([]);
  });

  it('should detect a single tampered leaf', () => {
    const data = ['a', 'b', 'c', 'd'];
    const tree = new MerkleTree(data);

    const tampered = tree.findTampered(['a', 'b', 'TAMPERED', 'd']);
    expect(tampered).toEqual([2]);
  });

  it('should detect multiple tampered leaves', () => {
    const data = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const tree = new MerkleTree(data);

    const tampered = tree.findTampered(['a', 'X', 'c', 'd', 'e', 'f', 'Y', 'h']);
    expect(tampered).toEqual([1, 6]);
  });

  it('should detect all leaves tampered', () => {
    const data = ['a', 'b', 'c', 'd'];
    const tree = new MerkleTree(data);

    const tampered = tree.findTampered(['w', 'x', 'y', 'z']);
    expect(tampered).toEqual([0, 1, 2, 3]);
  });

  it('should skip unchanged subtrees efficiently', () => {
    // With 8 leaves, if only leaf 0 changed, the algorithm should
    // not need to compare leaves 2-3 or 4-7 (their subtree hashes match)
    const data = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const tree = new MerkleTree(data);

    const tampered = tree.findTampered(['X', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(tampered).toEqual([0]);
  });

  it('should generate valid proofs for tampered indices', () => {
    const original = ['a', 'b', 'c', 'd'];
    const modified = ['a', 'b', 'CHANGED', 'd'];
    const tree = new MerkleTree(original);
    const newTree = new MerkleTree(modified);

    const tampered = tree.findTampered(modified);
    expect(tampered).toEqual([2]);

    // The proof for the changed leaf should verify against the new root
    const proof = newTree.getProof(2);
    expect(MerkleTree.verify('CHANGED', proof, newTree.root)).toBe(true);
    // But not against the old root
    expect(MerkleTree.verify('CHANGED', proof, tree.root)).toBe(false);
  });

  it('should work with odd number of leaves', () => {
    const data = ['a', 'b', 'c', 'd', 'e'];
    const tree = new MerkleTree(data);

    const tampered = tree.findTampered(['a', 'b', 'c', 'd', 'X']);
    expect(tampered).toEqual([4]);
  });
});
