---
title: "模式：Merkle 树 (Merkle Tree)"
description: "对叶子节点做哈希，然后逐层向上哈希配对——以 O(log n) 的代价验证任意叶子的完整性，无需重新哈希整个数据集。"
difficulty: "advanced"
---

# 模式：Merkle 树 (Merkle Tree)

<DifficultyBadge />

## 一句话

对叶子节点做哈希，然后逐层向上哈希配对——以 O(log n) 的代价验证任意叶子的完整性，无需重新哈希整个数据集。

<DemoBadge />

## 现实类比

防篡改的运输封条系统。每个箱子贴上独一无二的蜡封。箱子装入板条箱，板条箱的封印由所有箱子的蜡封推导而来。板条箱再装入集装箱，集装箱有自己的总封印。如果其中一件物品被掉包，它上方的每一层封印都会破损——你只需检查 log(n) 个封印就能定位被篡改的箱子，而无需打开所有箱子。

## 核心思想

Merkle 树是一棵哈希二叉树。每个叶子节点包含数据块的哈希值，每个内部节点包含其两个子节点拼接后的哈希值。根哈希是整个数据集的指纹。要验证单个叶子，只需"证明路径"——从叶子到根的兄弟哈希——提供 O(log n) 的验证。

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

| 属性 | 值 |
|------|------|
| 验证代价 | 每个叶子 O(log n) 次哈希 |
| 树构建 | O(n) 次哈希 |
| 证明空间 | O(log n) 个兄弟哈希 |
| 篡改检测 | 任何修改都会改变根哈希 |

**动手试试** — 通过追踪证明路径验证叶节点完整性，或篡改数据查看根哈希变化：

<MerkleTreeViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Git | [tree.c#L136-L171](https://github.com/git/git/blob/1ff279f3404a482a83fb04c7457e41ab26884aea/tree.c#L136-L171) | `parse_tree_gently` 解析 tree 对象，每个对象存储子 blob/tree 的哈希。Git 的对象模型是一个 Merkle DAG——每个 commit、tree 和 blob 都通过 SHA-1 内容寻址。修改任何文件中的一个字节都会改变到根 commit 的所有哈希。这使得高效 diff、fetch（只传输缺失对象）和通过 `git fsck` 进行完整性验证成为可能。 |
| ZFS | [blkptr.c (OpenZFS)](https://github.com/openzfs/zfs/blob/7e054b2e7ea80c7c838f7fd44b7d517eea5c9d18/module/zfs/blkptr.c#L30-L77) | `blkptr_verify` 验证块指针校验和。ZFS 中每个块在父块的指针中存储其内容的校验和——从数据块到 uberblock 形成 Merkle 树。这种自验证结构无需独立的完整性数据库即可检测静默数据损坏（bit rot）。`zpool scrub` 命令遍历此树来验证每个块。 |

## 实现

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

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 构建 Merkle 树，获取根哈希，生成并验证证明 | `exercises/typescript/merkle-tree/01-basic.test.ts` |
| 进阶 | 检测被篡改的叶子并生成最小证明路径 | `exercises/typescript/merkle-tree/02-intermediate.test.ts` |

运行练习：`pnpm test:ts`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

练习文件： Rust `exercises/rust/src/merkle_tree/mod.rs` · Go `exercises/go/merkle_tree/merkle_tree_test.go` · Python `exercises/python/merkle_tree/test_merkle_tree.py`

## 何时使用

- **版本控制** — 内容寻址存储，任何更改都可检测（Git）
- **区块链** — 无需下载完整链即可验证交易（Bitcoin SPV）
- **文件系统** — 静默数据损坏检测（ZFS、Btrfs）
- **点对点网络** — 从不可信对等方验证下载的数据块（BitTorrent、IPFS）
- **证书透明度** — TLS 证书的仅追加 Merkle 日志

## 何时不用

- **小数据集** — 如果可以一次性哈希所有内容，Merkle 树增加了不必要的复杂性
- **频繁变化的数据** — 每次变更都需要 O(log n) 次重新哈希直到根
- **不需要验证的场景** — 如果完全信任数据源，完整性证明是浪费的工作
- **有序访问模式** — Merkle 树不是搜索树；范围查询请用 B+ 树

## 更多生产案例

- [Bitcoin](https://github.com/bitcoin/bitcoin) — 区块头包含所有交易的 Merkle 根
- [Ethereum](https://github.com/ethereum/go-ethereum) — Patricia Merkle Trie 用于状态、交易和收据
- [IPFS](https://github.com/ipfs/kubo) — 内容寻址的 Merkle DAG 用于分布式文件存储
- [Certificate Transparency](https://certificate.transparency.dev/) — 用于审计 TLS 证书的 Merkle 树日志

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [写时复制 (Copy-on-Write)](/zh/patterns/copy-on-write/) | Merkle 树实现高效的写时复制——只需重新哈希变更路径 |
| [预写日志 (Write-Ahead Log)](/zh/patterns/write-ahead-log/) | WAL 记录变更；Merkle 树验证结果状态的一致性 |
| [检查点 (Checkpointing)](/zh/patterns/checkpointing/) | Merkle 根作为检查点快照的完整性证明 |
| [B+ 树 (B+ Tree)](/zh/patterns/b-plus-tree/) | 两者都是树结构——Merkle 用于验证，B+ 用于有序访问 |
| [差分与补丁 (Diff & Patch)](/zh/patterns/diff-patch/) | Merkle 树实现高效的差异检测——只需重新哈希从变更节点到根的路径 |

## 挑战题

::: details Q1: 你的 Merkle 树有 100 万个叶子。客户端想验证第 500,000 个叶子是否真实。客户端需要接收和计算多少个哈希？
**答案：** 大约 20 个哈希（log2(1,000,000) ≈ 20）。客户端接收约 20 个兄弟哈希（证明路径），并计算约 20 次哈希操作从叶子走到根。

这是 Merkle 树的核心价值主张：验证代价与数据集大小呈对数关系。客户端需要叶子数据、证明路径（每层一个兄弟哈希）和已知的根哈希。对于 100 万个叶子，大约是 20 × 32 字节 = 640 字节的证明数据——与重新下载并哈希所有 100 万个叶子相比微不足道。
:::

::: details Q2: Git 使用 SHA-1 作为其 Merkle DAG。如果你修改了仓库深处一个文件中的单个字符，对象数据库中究竟会发生什么变化？
**答案：** blob 哈希改变，导致其父目录的 tree 哈希改变，进而改变直到根 tree 的每个 tree 哈希，最终改变 commit 哈希。所有祖先对象都获得新哈希。

这就是"防篡改"特性：任何叶子的单 bit 变化都会级联到根。在 Git 中，这意味着每个 commit 哈希都是该时刻整个仓库状态的指纹。这也是 Git 能高效确定两个 commit 之间差异的原因——如果两个 tree 哈希匹配，则整个子树相同，Git 在 diff/fetch 操作中可以完全跳过它。
:::

::: details Q3: 你正在构建一棵叶子数为奇数（如 5 个）的 Merkle 树。如何处理每层未配对的叶子？
**答案：** 复制最后一个叶子（与自身哈希）来创建配对。这是 Bitcoin 的 Merkle 树实现中使用的标准方法。

有两种常见策略：(1) 复制未配对的节点并与自身哈希（Bitcoin 的方法），或 (2) 将未配对的节点不变地提升到下一层（某些学术实现）。复制方法更简单，但存在一个微妙的问题：两个不同的数据集（例如 [A, B, C] 和 [A, B, C, C]）可能产生相同的根哈希。Bitcoin 通过额外的验证规则来解决这个问题。提升方法避免了这种歧义，但使证明生成稍微复杂一些。
:::

::: details Q4: 你的 Merkle 树用于点对点文件共享系统。一个恶意节点发送了一个叶子的有效证明，但叶子数据本身是垃圾数据。证明能验证通过吗？
**答案：** 不能。证明不会验证通过，因为 hash(garbage_data) 会产生与原始不同的叶子哈希，计算出的根不会与已知的根匹配。

证明验证从 hash(received_data) 开始重新计算根。如果数据不同，hash(received_data) != hash(original_data)，不匹配会在每一层向上传播。这正是 Merkle 证明适用于不可信数据源的原因——你不需要信任对等方，只需信任根哈希（来自可信来源，如区块链或签名的清单文件）。
:::
