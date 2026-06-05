---
description: "Compare two sequences to compute the minimal set of operations (insert, delete, move) needed to transform one into the other."
difficulty: "intermediate"
---

# Pattern: Diff / Patch

<DifficultyBadge />

## One Liner

Compare two sequences to compute the minimal set of operations (insert, delete, move) needed to transform one into the other.

<DemoBadge />

## Real-World Analogy

A track-changes document in Word. Instead of sending the whole document, you send just the red-lined changes: 'delete paragraph 3, insert this sentence after paragraph 5.' The recipient applies the patch to their copy.

## Core Idea

Given an old list and a new list, the diff algorithm determines which items were added, removed, or moved. The result is a "patch" — a minimal set of mutations to apply.

```mermaid
flowchart LR
    subgraph Old["Old List"]
        A1[A] --> B1[B] --> C1[C] --> D1[D]
    end
    subgraph New["New List"]
        A2[A] --> C2[C] --> E2[E] --> D2[D]
    end
    Old -->|diff| P["Patch:\n- keep A\n- delete B\n- keep C\n- insert E\n- keep D"]
    P -->|apply| New
```

React's reconciler uses this to determine which DOM nodes to create, update, or remove. Git uses it to show what changed between commits.

| Property | Value |
|----------|-------|
| Diff (Myers') | O(n·d) where d = edit distance; O(n) when similar |
| Diff (list with keys) | O(n) — key-based matching avoids quadratic search |
| Patch apply | O(patch size) — each operation is O(1) |
| Space | O(n) — for the edit script / patch |

**Try it yourself** — edit old and new text, then compute and apply the diff:

<DiffPatchViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| React | [ReactChildFiber.js#L1169-L1340](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactChildFiber.js#L1169-L1340) | `reconcileChildrenArray` diffs old and new children. Line ~1294 calls `mapRemainingChildren` to build a key→fiber map, then iterates new children via `updateFromMap` to detect moves, insertions, and deletions. |
| Git | [diff.c#L5020-L5060](https://github.com/git/git/blob/master/diff.c#L5020-L5060) | `run_diff` dispatches file-pair comparisons. `builtin_diff` (line 3839) handles the actual diffing, producing the familiar `+`/`-` patch output. Git uses an optimized Myers' algorithm internally (in `xdiff/`). |

## Implementation

::: info Note on algorithm
The implementation below uses a **greedy forward scan** — simple and clear for learning. Production systems like Git use [Myers' diff algorithm](https://blog.jcoglan.com/2017/02/12/the-myers-diff-algorithm-part-1/) which guarantees a minimum edit sequence. React uses a key-based approach optimized for UI list reconciliation, not general-purpose diffing.
:::

::: code-group

```typescript [TypeScript]
type Op<T> =
  | { type: 'keep'; value: T }
  | { type: 'insert'; value: T }
  | { type: 'delete'; value: T };

function diff<T>(oldList: T[], newList: T[], eq: (a: T, b: T) => boolean = (a, b) => a === b): Op<T>[] {
  const ops: Op<T>[] = [];
  let oldIdx = 0;
  let newIdx = 0;

  // Build a map of old items by value for O(1) lookup
  const oldMap = new Map<string, number>();
  oldList.forEach((item, i) => oldMap.set(String(item), i));

  while (oldIdx < oldList.length && newIdx < newList.length) {
    if (eq(oldList[oldIdx]!, newList[newIdx]!)) {
      ops.push({ type: 'keep', value: oldList[oldIdx]! });
      oldIdx++;
      newIdx++;
    } else if (!newList.some((n, ni) => ni >= newIdx && eq(n, oldList[oldIdx]!))) {
      ops.push({ type: 'delete', value: oldList[oldIdx]! });
      oldIdx++;
    } else {
      ops.push({ type: 'insert', value: newList[newIdx]! });
      newIdx++;
    }
  }

  while (oldIdx < oldList.length) {
    ops.push({ type: 'delete', value: oldList[oldIdx]! });
    oldIdx++;
  }

  while (newIdx < newList.length) {
    ops.push({ type: 'insert', value: newList[newIdx]! });
    newIdx++;
  }

  return ops;
}

function patch<T>(oldList: T[], ops: Op<T>[]): T[] {
  const result: T[] = [];
  for (const op of ops) {
    if (op.type === 'keep' || op.type === 'insert') result.push(op.value);
  }
  return result;
}
```

```rust [Rust]
#[derive(Debug, PartialEq)]
pub enum Op<T> {
    Keep(T),
    Insert(T),
    Delete(T),
}

pub fn diff<T: PartialEq + Clone>(old: &[T], new: &[T]) -> Vec<Op<T>> {
    let mut ops = Vec::new();
    let (mut oi, mut ni) = (0, 0);

    while oi < old.len() && ni < new.len() {
        if old[oi] == new[ni] {
            ops.push(Op::Keep(old[oi].clone()));
            oi += 1;
            ni += 1;
        } else if !new[ni..].contains(&old[oi]) {
            ops.push(Op::Delete(old[oi].clone()));
            oi += 1;
        } else {
            ops.push(Op::Insert(new[ni].clone()));
            ni += 1;
        }
    }

    while oi < old.len() { ops.push(Op::Delete(old[oi].clone())); oi += 1; }
    while ni < new.len() { ops.push(Op::Insert(new[ni].clone())); ni += 1; }

    ops
}

pub fn patch<T: Clone>(ops: &[Op<T>]) -> Vec<T> {
    ops.iter().filter_map(|op| match op {
        Op::Keep(v) | Op::Insert(v) => Some(v.clone()),
        Op::Delete(_) => None,
    }).collect()
}
```

```python [Python]
from typing import TypeVar, List, Tuple, Literal

T = TypeVar("T")
Op = Tuple[Literal["keep", "insert", "delete"], T]

def diff(old: List[T], new: List[T]) -> List[Op]:
    ops: List[Op] = []
    oi, ni = 0, 0

    while oi < len(old) and ni < len(new):
        if old[oi] == new[ni]:
            ops.append(("keep", old[oi]))
            oi += 1; ni += 1
        elif old[oi] not in new[ni:]:
            ops.append(("delete", old[oi]))
            oi += 1
        else:
            ops.append(("insert", new[ni]))
            ni += 1

    while oi < len(old): ops.append(("delete", old[oi])); oi += 1
    while ni < len(new): ops.append(("insert", new[ni])); ni += 1
    return ops

def patch(ops: List[Op]) -> List[T]:
    return [val for op_type, val in ops if op_type != "delete"]

# Usage
ops = diff(["a", "b", "c", "d"], ["a", "c", "e", "d"])
assert patch(ops) == ["a", "c", "e", "d"]
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a simple list diff that produces keep/insert/delete ops | `exercises/typescript/diff-patch/01-basic.test.ts` |
| Intermediate | Apply a patch to reconstruct the new list from the old | `exercises/typescript/diff-patch/02-patch-apply.test.ts` |

Run exercises: `pnpm test` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/diff_patch.rs` · Go `exercises/go/diff_patch_test.go` · Python `exercises/python/test_diff_patch.py`

## When to Use

- **UI reconciliation** — minimize DOM mutations by diffing virtual trees
- **Version control** — compute file changes between commits
- **Collaborative editing** — merge concurrent edits via operational transform or CRDT diffs
- **State synchronization** — send only deltas instead of full state over the network
- **Undo/redo** — store diffs as compact undo entries instead of full snapshots

## When NOT to Use

- **Completely different lists** — if > 80% of items changed, just replace the whole list
- **Unordered sets** — diff assumes order matters; for sets, use set intersection/difference
- **Real-time streaming** — if items arrive one at a time, an incremental approach is better than batch diffing
- **Large lists without keys** — without stable identifiers, diff degrades to O(n²)

## More Production Uses

- [VS Code](https://github.com/microsoft/vscode) — text buffer diff
- [jsdiff](https://github.com/kpdecker/jsdiff)
- [Vue 3](https://github.com/vuejs/core) — template diff
- [Git](https://github.com/git/git/blob/master/diff.c) — core diff engine for commits, merges, and patches

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Copy-on-Write (CoW)](/patterns/copy-on-write/) | Diff/patch computes what changed; CoW defers the actual copying until needed |
| [Merkle Tree](/patterns/merkle-tree/) | Merkle trees identify which subtrees changed, narrowing where to diff |
| [Double Buffering](/patterns/double-buffering/) | React diffs the current tree against the work-in-progress double buffer |

## Challenge Questions

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
