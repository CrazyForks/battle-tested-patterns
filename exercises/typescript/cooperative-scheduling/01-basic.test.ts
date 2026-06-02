import { describe, it, expect } from 'vitest';

/**
 * Cooperative Scheduling - Basic: Time-sliced work loop.
 *
 * Implement a work loop that processes items but yields
 * when a time budget is exceeded.
 */

interface WorkResult {
  completed: number;
  yielded: boolean;
}

function workLoop(
  items: number[],
  processItem: (item: number) => void,
  shouldYield: () => boolean,
): WorkResult {
  let completed = 0;

  while (completed < items.length) {
    if (shouldYield()) {
      return { completed, yielded: true };
    }
    processItem(items[completed]!);
    completed++;
  }

  return { completed, yielded: false };
}

describe('Cooperative Scheduling - Basic: Work Loop', () => {
  it('should process all items when no yield is needed', () => {
    const processed: number[] = [];
    const result = workLoop(
      [1, 2, 3, 4, 5],
      (item) => processed.push(item),
      () => false,
    );

    expect(result.completed).toBe(5);
    expect(result.yielded).toBe(false);
    expect(processed).toEqual([1, 2, 3, 4, 5]);
  });

  it('should yield after processing some items', () => {
    const processed: number[] = [];
    let callCount = 0;

    const result = workLoop(
      [10, 20, 30, 40, 50],
      (item) => processed.push(item),
      () => {
        callCount++;
        return callCount > 3;
      },
    );

    expect(result.completed).toBe(3);
    expect(result.yielded).toBe(true);
    expect(processed).toEqual([10, 20, 30]);
  });

  it('should yield immediately if shouldYield returns true', () => {
    const processed: number[] = [];
    const result = workLoop(
      [1, 2, 3],
      (item) => processed.push(item),
      () => true,
    );

    expect(result.completed).toBe(0);
    expect(result.yielded).toBe(true);
    expect(processed).toEqual([]);
  });

  it('should handle empty work list', () => {
    const result = workLoop(
      [],
      () => {},
      () => false,
    );

    expect(result.completed).toBe(0);
    expect(result.yielded).toBe(false);
  });

  it('should support resumable processing', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const processed: number[] = [];
    let yieldAfter = 2;

    // First chunk
    let callCount = 0;
    const result1 = workLoop(
      items,
      (item) => processed.push(item),
      () => ++callCount > yieldAfter,
    );
    expect(result1.completed).toBe(2);
    expect(result1.yielded).toBe(true);

    // Resume with remaining items
    const remaining = items.slice(result1.completed);
    callCount = 0;
    yieldAfter = 10; // don't yield this time
    const result2 = workLoop(
      remaining,
      (item) => processed.push(item),
      () => ++callCount > yieldAfter,
    );

    expect(result2.completed).toBe(4);
    expect(result2.yielded).toBe(false);
    expect(processed).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
