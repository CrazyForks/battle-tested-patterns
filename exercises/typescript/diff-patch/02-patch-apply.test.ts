import { describe, it, expect } from 'vitest';

/**
 * Diff/Patch - Intermediate: Apply a patch to reconstruct the new list.
 */

type Op<T> =
  | { type: 'keep'; value: T }
  | { type: 'insert'; value: T }
  | { type: 'delete'; value: T };

function diff<T>(oldList: T[], newList: T[]): Op<T>[] {
  const ops: Op<T>[] = [];
  let oi = 0;
  let ni = 0;

  while (oi < oldList.length && ni < newList.length) {
    if (oldList[oi] === newList[ni]) {
      ops.push({ type: 'keep', value: oldList[oi]! });
      oi++;
      ni++;
    } else if (!newList.slice(ni).includes(oldList[oi]!)) {
      ops.push({ type: 'delete', value: oldList[oi]! });
      oi++;
    } else {
      ops.push({ type: 'insert', value: newList[ni]! });
      ni++;
    }
  }

  while (oi < oldList.length) { ops.push({ type: 'delete', value: oldList[oi]! }); oi++; }
  while (ni < newList.length) { ops.push({ type: 'insert', value: newList[ni]! }); ni++; }

  return ops;
}

function patch<T>(ops: Op<T>[]): T[] {
  return ops
    .filter((op): op is Extract<Op<T>, { type: 'keep' | 'insert' }> =>
      op.type === 'keep' || op.type === 'insert',
    )
    .map((op) => op.value);
}

function countOps<T>(ops: Op<T>[]): { keeps: number; inserts: number; deletes: number } {
  return {
    keeps: ops.filter((o) => o.type === 'keep').length,
    inserts: ops.filter((o) => o.type === 'insert').length,
    deletes: ops.filter((o) => o.type === 'delete').length,
  };
}

describe('Diff/Patch - Intermediate: Patch Apply', () => {
  it('should reconstruct new list from diff ops', () => {
    const oldList = ['a', 'b', 'c', 'd'];
    const newList = ['a', 'c', 'e', 'd'];
    const ops = diff(oldList, newList);
    expect(patch(ops)).toEqual(newList);
  });

  it('should handle insertion-only patch', () => {
    const ops = diff([1], [1, 2, 3]);
    expect(patch(ops)).toEqual([1, 2, 3]);
    expect(countOps(ops).inserts).toBe(2);
    expect(countOps(ops).deletes).toBe(0);
  });

  it('should handle deletion-only patch', () => {
    const ops = diff([1, 2, 3], [1]);
    expect(patch(ops)).toEqual([1]);
    expect(countOps(ops).deletes).toBe(2);
    expect(countOps(ops).inserts).toBe(0);
  });

  it('should roundtrip identical lists', () => {
    const list = ['x', 'y', 'z'];
    const ops = diff(list, list);
    expect(patch(ops)).toEqual(list);
    expect(countOps(ops)).toEqual({ keeps: 3, inserts: 0, deletes: 0 });
  });

  it('should roundtrip from empty to populated', () => {
    const ops = diff([], [1, 2, 3]);
    expect(patch(ops)).toEqual([1, 2, 3]);
  });

  it('should roundtrip from populated to empty', () => {
    const ops = diff([1, 2, 3], []);
    expect(patch(ops)).toEqual([]);
  });

  it('should produce minimal ops for small changes', () => {
    const ops = diff(['a', 'b', 'c', 'd', 'e'], ['a', 'b', 'x', 'd', 'e']);
    const counts = countOps(ops);
    // Only 1 deletion (c) and 1 insertion (x), rest kept
    expect(counts.keeps).toBe(4);
    expect(counts.inserts).toBe(1);
    expect(counts.deletes).toBe(1);
    expect(patch(ops)).toEqual(['a', 'b', 'x', 'd', 'e']);
  });
});
