import { describe, it, expect } from 'vitest';

/**
 * Diff/Patch - Basic: Simple list diff producing keep/insert/delete operations.
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

describe('Diff/Patch - Basic: List Diff', () => {
  it('should return empty ops for identical lists', () => {
    const ops = diff([1, 2, 3], [1, 2, 3]);
    expect(ops).toEqual([
      { type: 'keep', value: 1 },
      { type: 'keep', value: 2 },
      { type: 'keep', value: 3 },
    ]);
  });

  it('should detect insertions', () => {
    const ops = diff(['a', 'c'], ['a', 'b', 'c']);
    expect(ops).toEqual([
      { type: 'keep', value: 'a' },
      { type: 'insert', value: 'b' },
      { type: 'keep', value: 'c' },
    ]);
  });

  it('should detect deletions', () => {
    const ops = diff(['a', 'b', 'c'], ['a', 'c']);
    expect(ops).toEqual([
      { type: 'keep', value: 'a' },
      { type: 'delete', value: 'b' },
      { type: 'keep', value: 'c' },
    ]);
  });

  it('should handle append at end', () => {
    const ops = diff([1, 2], [1, 2, 3, 4]);
    expect(ops).toEqual([
      { type: 'keep', value: 1 },
      { type: 'keep', value: 2 },
      { type: 'insert', value: 3 },
      { type: 'insert', value: 4 },
    ]);
  });

  it('should handle removal from end', () => {
    const ops = diff([1, 2, 3, 4], [1, 2]);
    expect(ops).toEqual([
      { type: 'keep', value: 1 },
      { type: 'keep', value: 2 },
      { type: 'delete', value: 3 },
      { type: 'delete', value: 4 },
    ]);
  });

  it('should handle complete replacement', () => {
    const ops = diff(['a', 'b'], ['x', 'y']);
    const inserts = ops.filter((o) => o.type === 'insert');
    const deletes = ops.filter((o) => o.type === 'delete');
    expect(inserts.length).toBe(2);
    expect(deletes.length).toBe(2);
  });

  it('should handle empty old list', () => {
    const ops = diff([], [1, 2]);
    expect(ops).toEqual([
      { type: 'insert', value: 1 },
      { type: 'insert', value: 2 },
    ]);
  });

  it('should handle empty new list', () => {
    const ops = diff([1, 2], []);
    expect(ops).toEqual([
      { type: 'delete', value: 1 },
      { type: 'delete', value: 2 },
    ]);
  });
});
