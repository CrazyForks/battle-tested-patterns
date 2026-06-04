---
description: "Hash leaves, then hash pairs upward to a root — verify any leaf's integrity in O(log n) without re-hashing the entire dataset."
difficulty: "advanced"
---

# Pattern: Merkle Tree

<DifficultyBadge />

## One Liner

Hash leaves, then hash pairs upward to a root -- verify any leaf's integrity in O(log n) without re-hashing the entire dataset.

<DemoBadge />

## Real-World Analogy

A tamper-evident shipping seal system. Each box gets a unique wax seal. Boxes are grouped into crates, each crate sealed with a stamp derived from all its box seals. Crates go into containers with their own master seal. If one item is swapped, every seal above it breaks — and you can find the tampered box by checking just log(n) seals instead of opening every box.

## Core Idea

A Merkle tree is a binary tree of hashes. Each leaf node contains the hash of a data block. Each internal node contains the hash of its two children concatenated. The root hash is a fingerprint of the entire dataset. To verify a single leaf, you only need the "proof path" -- the sibling hashes along the path from the leaf to the root -- giving O(log n) verification.

```text
                    Root Hash
                   H(H12 + H34)
                  /             \
              H12                H34
           H(H1+H2)          H(H3+H4)
            /    \             /    \
          H1      H2        H3      H4
          |       |         |       |
        Data A  Data B    Data C  Data D

  Verify Data C:
  ┌──────────────────────────────────────┐
  │ Need: H4 (sibling), H12 (uncle)     │
  │ Compute: H3 = hash(Data C)          │
  │          H34 = hash(H3 + H4)        │
  │          root = hash(H12 + H34)     │
  │ Compare: root == known root? ✓      │
  └──────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Verification cost | O(log n) hashes per leaf |
| Tree construction | O(n) hashes |
| Space for proof | O(log n) sibling hashes |
| Tamper detection | Any change flips the root hash |

**Try it yourself** — verify a leaf's integrity by tracing the proof path, or tamper with data to see the root hash change:

<MerkleTreeViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| Git | [tree.c#L136-L171](https://github.com/git/git/blob/master/tree.c#L136-L171) | `parse_tree_gently` parses tree objects, each storing hashes of child blobs/trees. Git's object model is a Merkle DAG -- every commit, tree, and blob is content-addressed by SHA-1. Changing a single byte in any file changes all hashes up to the root commit. This enables efficient diff, fetch (only transfer missing objects), and integrity verification with `git fsck`. |
| ZFS | [blkptr.c (OpenZFS)](https://github.com/openzfs/zfs/blob/master/module/zfs/blkptr.c#L30-L77) | `blkptr_verify` validates block pointer checksums. Every block in ZFS stores a checksum of its contents in the parent block's pointer -- forming a Merkle tree from data blocks up to the uberblock. This self-validating structure detects silent data corruption (bit rot) without a separate integrity database. The `zpool scrub` command walks this tree to verify every block. |

## Implementation

::: code-group

```typescript [TypeScript]
function hash(data: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
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
        const right = current[i + 1] ?? left; // duplicate last if odd
        next.push(hash(left + right));
      }
      this.layers.push(next);
      current = next;
    }
  }

  get root(): string {
    return this.layers[this.layers.length - 1]![0]!;
  }

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
```

```go [Go]
package merkle

import (
	"crypto/sha256"
	"encoding/hex"
)

func hashStr(data string) string {
	h := sha256.Sum256([]byte(data))
	return hex.EncodeToString(h[:])
}

type ProofStep struct {
	Hash     string
	Position string // "left" or "right"
}

type MerkleTree struct {
	layers [][]string
}

func NewMerkleTree(data []string) *MerkleTree {
	leaves := make([]string, len(data))
	for i, d := range data {
		leaves[i] = hashStr(d)
	}
	t := &MerkleTree{layers: [][]string{leaves}}
	t.buildTree()
	return t
}

func (t *MerkleTree) buildTree() {
	current := t.layers[0]
	for len(current) > 1 {
		next := make([]string, 0, (len(current)+1)/2)
		for i := 0; i < len(current); i += 2 {
			left := current[i]
			right := left
			if i+1 < len(current) {
				right = current[i+1]
			}
			next = append(next, hashStr(left+right))
		}
		t.layers = append(t.layers, next)
		current = next
	}
}

func (t *MerkleTree) Root() string {
	top := t.layers[len(t.layers)-1]
	return top[0]
}

func (t *MerkleTree) GetProof(index int) []ProofStep {
	var proof []ProofStep
	idx := index
	for i := 0; i < len(t.layers)-1; i++ {
		layer := t.layers[i]
		isRight := idx%2 == 1
		siblingIdx := idx + 1
		if isRight {
			siblingIdx = idx - 1
		}
		if siblingIdx < len(layer) {
			pos := "right"
			if isRight {
				pos = "left"
			}
			proof = append(proof, ProofStep{Hash: layer[siblingIdx], Position: pos})
		} else {
			proof = append(proof, ProofStep{Hash: layer[idx], Position: "right"})
		}
		idx = idx / 2
	}
	return proof
}

func Verify(leaf string, proof []ProofStep, root string) bool {
	current := hashStr(leaf)
	for _, step := range proof {
		if step.Position == "left" {
			current = hashStr(step.Hash + current)
		} else {
			current = hashStr(current + step.Hash)
		}
	}
	return current == root
}
```

```python [Python]
import hashlib

def sha256_hash(data: str) -> str:
    return hashlib.sha256(data.encode()).hexdigest()

class MerkleTree:
    def __init__(self, data: list[str]):
        self._leaves = [sha256_hash(d) for d in data]
        self._layers: list[list[str]] = [self._leaves[:]]
        self._build_tree()

    def _build_tree(self) -> None:
        current = self._leaves
        while len(current) > 1:
            next_layer: list[str] = []
            for i in range(0, len(current), 2):
                left = current[i]
                right = current[i + 1] if i + 1 < len(current) else left
                next_layer.append(sha256_hash(left + right))
            self._layers.append(next_layer)
            current = next_layer

    @property
    def root(self) -> str:
        return self._layers[-1][0]

    def get_proof(self, index: int) -> list[dict[str, str]]:
        proof: list[dict[str, str]] = []
        idx = index
        for i in range(len(self._layers) - 1):
            layer = self._layers[i]
            is_right = idx % 2 == 1
            sibling_idx = idx - 1 if is_right else idx + 1
            if sibling_idx < len(layer):
                pos = "left" if is_right else "right"
                proof.append({"hash": layer[sibling_idx], "position": pos})
            else:
                proof.append({"hash": layer[idx], "position": "right"})
            idx = idx // 2
        return proof

    @staticmethod
    def verify(leaf: str, proof: list[dict[str, str]], root: str) -> bool:
        current = sha256_hash(leaf)
        for step in proof:
            if step["position"] == "left":
                current = sha256_hash(step["hash"] + current)
            else:
                current = sha256_hash(current + step["hash"])
        return current == root
```

```rust [Rust]
fn hash_str(data: &str) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in data.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", h)
}

pub struct ProofStep {
    pub hash: String,
    pub position: String, // "left" or "right"
}

pub struct MerkleTree {
    layers: Vec<Vec<String>>,
}

impl MerkleTree {
    pub fn new(data: &[&str]) -> Self {
        let leaves: Vec<String> = data.iter().map(|d| hash_str(d)).collect();
        let mut tree = MerkleTree { layers: vec![leaves] };
        tree.build_tree();
        tree
    }

    fn build_tree(&mut self) {
        let mut current = self.layers[0].clone();
        while current.len() > 1 {
            let mut next = Vec::new();
            for i in (0..current.len()).step_by(2) {
                let left = &current[i];
                let right = if i + 1 < current.len() { &current[i + 1] } else { left };
                next.push(hash_str(&format!("{}{}", left, right)));
            }
            self.layers.push(next.clone());
            current = next;
        }
    }

    pub fn root(&self) -> &str {
        &self.layers.last().unwrap()[0]
    }

    pub fn get_proof(&self, index: usize) -> Vec<ProofStep> {
        let mut proof = Vec::new();
        let mut idx = index;
        for i in 0..self.layers.len() - 1 {
            let layer = &self.layers[i];
            let is_right = idx % 2 == 1;
            let sibling_idx = if is_right { idx - 1 } else { idx + 1 };
            if sibling_idx < layer.len() {
                let pos = if is_right { "left" } else { "right" };
                proof.push(ProofStep {
                    hash: layer[sibling_idx].clone(),
                    position: pos.to_string(),
                });
            } else {
                proof.push(ProofStep {
                    hash: layer[idx].clone(),
                    position: "right".to_string(),
                });
            }
            idx /= 2;
        }
        proof
    }

    pub fn verify(leaf: &str, proof: &[ProofStep], root: &str) -> bool {
        let mut current = hash_str(leaf);
        for step in proof {
            if step.position == "left" {
                current = hash_str(&format!("{}{}", step.hash, current));
            } else {
                current = hash_str(&format!("{}{}", current, step.hash));
            }
        }
        current == root
    }
}
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Build a Merkle tree, get root hash, generate and verify proof | `exercises/typescript/merkle-tree/01-basic.test.ts` |
| Intermediate | Detect tampered leaf and generate minimal proof path | `exercises/typescript/merkle-tree/02-intermediate.test.ts` |

Run exercises: `pnpm test` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/merkle_tree.rs` · Go `exercises/go/merkle_tree_test.go` · Python `exercises/python/test_merkle_tree.py`

## When to Use

- **Version control** -- content-addressed storage where any change is detectable (Git)
- **Blockchain** -- transaction verification without downloading the full chain (Bitcoin SPV)
- **File systems** -- silent data corruption detection (ZFS, Btrfs)
- **Peer-to-peer** -- verify downloaded chunks from untrusted peers (BitTorrent, IPFS)
- **Certificate transparency** -- append-only Merkle log of TLS certificates

## When NOT to Use

- **Small datasets** -- if you can hash everything at once, a Merkle tree adds needless complexity
- **Frequently changing data** -- every mutation requires O(log n) rehashes up to the root
- **Non-verifiable context** -- if you trust the data source entirely, integrity proofs are wasted work
- **Ordered access patterns** -- Merkle trees are not search trees; use B+ trees for range queries

## More Production Uses

- [Bitcoin](https://github.com/bitcoin/bitcoin) -- block header contains Merkle root of all transactions
- [Ethereum](https://github.com/ethereum/go-ethereum) -- Patricia Merkle Trie for state, transactions, and receipts
- [IPFS](https://github.com/ipfs/kubo) -- content-addressed Merkle DAG for distributed file storage
- [Certificate Transparency](https://certificate.transparency.dev/) -- Merkle tree log for auditing TLS certificates

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Copy-on-Write (CoW)](/patterns/copy-on-write/) | Merkle trees enable efficient copy-on-write — only rehash the changed path |
| [Write-Ahead Log (WAL)](/patterns/write-ahead-log/) | WAL records changes; Merkle trees verify the resulting state is consistent |
| [Checkpointing](/patterns/checkpointing/) | Merkle roots serve as integrity proofs for checkpoint snapshots |
| [B+ Tree](/patterns/b-plus-tree/) | Both are tree structures — Merkle for verification, B+ for ordered access |
| [Diff & Patch](/patterns/diff-patch/) | Merkle trees enable efficient diff detection — only rehash paths to changed nodes |

## Challenge Questions

::: details Q1: Your Merkle tree has 1 million leaves. A client wants to verify that leaf #500,000 is authentic. How many hashes does the client need to receive and compute?
**Answer:** About 20 hashes (log2(1,000,000) ~ 20). The client receives ~20 sibling hashes (the proof path) and computes ~20 hash operations to walk from the leaf to the root.

This is the core value proposition of Merkle trees: verification cost is logarithmic in the dataset size. The client needs the leaf data, the proof path (one sibling hash per tree level), and the known root hash. For 1 million leaves, that's roughly 20 * 32 bytes = 640 bytes of proof data -- trivial compared to re-downloading and hashing all 1 million leaves.
:::

::: details Q2: Git uses SHA-1 for its Merkle DAG. If you change a single character in a file deep in the repository, what exactly changes in the object database?
**Answer:** The blob hash changes, which changes the tree hash of its parent directory, which changes every tree hash up to the root tree, which changes the commit hash. All ancestor objects get new hashes.

This is the "tamper-evident" property: a single-bit change at any leaf cascades all the way to the root. In Git, this means every commit hash is a fingerprint of the entire repository state at that point. It's also why Git can efficiently determine what changed between two commits -- if two tree hashes match, the entire subtree is identical, so Git can skip it entirely during diff/fetch operations.
:::

::: details Q3: You're building a Merkle tree with an odd number of leaves (e.g., 5). How do you handle the unpaired leaf at each level?
**Answer:** Duplicate the last leaf (hash it with itself) to create a pair. This is the standard approach used in Bitcoin's Merkle tree implementation.

There are two common strategies: (1) duplicate the unpaired node and hash it with itself (Bitcoin's approach), or (2) promote the unpaired node to the next level unchanged (some academic implementations). The duplication approach is simpler but creates a subtle issue: two different datasets (e.g., [A, B, C] and [A, B, C, C]) could produce the same root hash. Bitcoin addresses this with additional validation rules. The promote approach avoids this ambiguity but makes proof generation slightly more complex.
:::

::: details Q4: Your Merkle tree is used in a peer-to-peer file sharing system. A malicious peer sends you a valid proof for a leaf, but the leaf data itself is garbage. Does the proof verify?
**Answer:** No. The proof won't verify because hash(garbage_data) will produce a different leaf hash than the original, and the computed root won't match the known root.

The proof verification recomputes the root starting from hash(received_data). If the data is different, hash(received_data) != hash(original_data), and the mismatch propagates up through every level. This is exactly why Merkle proofs work for untrusted data sources -- you don't need to trust the peer, only the root hash (which comes from a trusted source like the blockchain or a signed manifest).
:::
