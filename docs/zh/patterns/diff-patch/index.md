# 模式：差异/补丁 (Diff / Patch)

## 一句话

比较两个序列，计算将一个转换为另一个所需的最小操作集（插入、删除、移动）。

## 核心思想

给定旧列表和新列表，diff 算法确定哪些元素被添加、删除或移动。结果是一个"补丁"— 一组最小的变更操作。

```mermaid
flowchart LR
    subgraph 旧列表
        A1[A] --> B1[B] --> C1[C] --> D1[D]
    end
    subgraph 新列表
        A2[A] --> C2[C] --> E2[E] --> D2[D]
    end
    旧列表 -->|diff| P["补丁:\n- 保留 A\n- 删除 B\n- 保留 C\n- 插入 E\n- 保留 D"]
    P -->|apply| 新列表
```

React 的协调器用此确定要创建、更新或删除哪些 DOM 节点。Git 用此显示提交之间的变更。

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| React | [ReactChildFiber.js#L1169-L1340](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactChildFiber.js#L1169-L1340) | `reconcileChildrenArray` 对比新旧子节点，~行1294 调用 `mapRemainingChildren` 构建 key→fiber 映射，检测移动、插入和删除。 |
| Git | [diff.c#L5020-L5060](https://github.com/git/git/blob/master/diff.c#L5020-L5060) | `run_diff` 分派文件对比，`builtin_diff`（行3839）处理实际 diff。Git 内部使用优化版 Myers 算法（在 `xdiff/` 中）。 |

## 实现

::: info 关于算法
下面的实现使用**贪心前向扫描**——简单清晰，适合学习。生产系统如 Git 使用 [Myers 差异算法](https://blog.jcoglan.com/2017/02/12/the-myers-diff-algorithm-part-1/)保证最小编辑序列。React 使用基于 key 的方法，专为 UI 列表协调优化。
:::

::: code-group

```typescript [TypeScript]
type Op<T> =
  | { type: 'keep'; value: T }
  | { type: 'insert'; value: T }
  | { type: 'delete'; value: T };

function diff<T>(oldList: T[], newList: T[]): Op<T>[] {
  const ops: Op<T>[] = [];
  let oi = 0, ni = 0;
  while (oi < oldList.length && ni < newList.length) {
    if (oldList[oi] === newList[ni]) {
      ops.push({ type: 'keep', value: oldList[oi]! }); oi++; ni++;
    } else if (!newList.slice(ni).includes(oldList[oi]!)) {
      ops.push({ type: 'delete', value: oldList[oi]! }); oi++;
    } else {
      ops.push({ type: 'insert', value: newList[ni]! }); ni++;
    }
  }
  while (oi < oldList.length) { ops.push({ type: 'delete', value: oldList[oi]! }); oi++; }
  while (ni < newList.length) { ops.push({ type: 'insert', value: newList[ni]! }); ni++; }
  return ops;
}

function patch<T>(ops: Op<T>[]): T[] {
  return ops.filter(op => op.type !== 'delete').map(op => op.value);
}
```

```rust [Rust]
#[derive(Debug, PartialEq)]
pub enum Op<T> { Keep(T), Insert(T), Delete(T) }

pub fn diff<T: PartialEq + Clone>(old: &[T], new: &[T]) -> Vec<Op<T>> {
    let mut ops = Vec::new();
    let (mut oi, mut ni) = (0, 0);
    while oi < old.len() && ni < new.len() {
        if old[oi] == new[ni] {
            ops.push(Op::Keep(old[oi].clone())); oi += 1; ni += 1;
        } else if !new[ni..].contains(&old[oi]) {
            ops.push(Op::Delete(old[oi].clone())); oi += 1;
        } else {
            ops.push(Op::Insert(new[ni].clone())); ni += 1;
        }
    }
    while oi < old.len() { ops.push(Op::Delete(old[oi].clone())); oi += 1; }
    while ni < new.len() { ops.push(Op::Insert(new[ni].clone())); ni += 1; }
    ops
}
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现产生 keep/insert/delete 操作的列表 diff | `exercises/typescript/diff-patch/01-basic.test.ts` |
| 进阶 | 应用补丁从旧列表重建新列表 | `exercises/typescript/diff-patch/02-patch-apply.test.ts` |

## 何时使用

- **UI 协调** — 通过 diff 虚拟树最小化 DOM 变更
- **版本控制** — 计算提交之间的文件变更
- **协同编辑** — 通过操作转换或 CRDT diff 合并并发编辑
- **状态同步** — 通过网络仅发送增量而非完整状态

## 何时不用

- **完全不同的列表** — 如果超过 80% 的元素变化，直接替换整个列表
- **无序集合** — diff 假设顺序重要；对集合使用交集/差集
- **大列表无 key** — 没有稳定标识符时，diff 退化为 O(n²)

## 更多生产案例

- [VS Code](https://github.com/microsoft/vscode) — text buffer diff
- [jsdiff](https://github.com/kpdecker/jsdiff)
- [Vue 3](https://github.com/vuejs/core) — template diff

## 挑战题

::: details Q1: React's diff produces insert/delete/update ops but not "move." How does it handle a list that was merely reordered?
**Answer:** React does not emit explicit "move" operations. Instead, it reuses existing DOM nodes and repositions them via `insertBefore`.

Without keys, React compares children by position — reordering looks like every element changed. With keys, React builds a map of `key -> fiber`, matches old and new children by key, and reuses existing DOM nodes. It tracks a `lastPlacedIndex` and flags fibers that need repositioning — the browser moves the DOM node rather than destroying and recreating it. This is simpler than computing a minimum-edit-distance move sequence but produces near-optimal DOM mutations for typical UI lists.
:::

::: details Q2: The greedy diff algorithm in this pattern is O(n*m) worst case. What causes this, and how does Myers' algorithm improve it?
**Answer:** The greedy algorithm's `some()` call scans the remaining new list for each old item, creating O(n*m) comparisons. Myers' algorithm runs in O((n+m) * d) where d is the edit distance.

Myers' key insight is that it searches for the shortest edit script by exploring diagonals in an edit graph. When the two lists are similar (small d), it runs in nearly O(n+m). The greedy approach has no such optimization — it doesn't minimize the edit sequence and degrades badly when the lists have many differences scattered throughout.
:::

::: details Q3: Two developers independently edit the same file. Developer A deletes line 5; Developer B modifies line 5. How does a diff-based merge handle this conflict?
**Answer:** This is a true conflict that cannot be auto-resolved — the merge tool must flag it for human review.

Three-way merge computes two diffs: (base -> A) and (base -> B). If both diffs touch the same region, they conflict. A's diff says "delete line 5," B's diff says "replace line 5." These are mutually exclusive operations on the same hunk. The merge tool inserts conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) and the developer decides. Non-overlapping changes in different regions merge cleanly.
:::

::: details Q4: You need to sync state between a server and 10,000 connected clients. Should you diff the full state and send patches, or use a different approach?
**Answer:** Diffing the full state per client does not scale. Use event sourcing or operational transforms to send individual mutations as they happen.

Computing a diff requires holding both old and new state, and the diff cost is proportional to state size. With 10,000 clients, you'd compute 10,000 diffs per update. Instead, capture each mutation as a small operation (e.g., "set user.name = X") and broadcast it. Clients apply operations incrementally. Diff-patch is better suited for periodic reconciliation (like React's render cycle) or offline sync, not real-time high-fan-out distribution.
:::
