import { describe, it, expect } from 'vitest';

/**
 * Min Heap - Basic: Implement push, pop, peek with sift operations.
 */

interface HeapNode {
  sortIndex: number;
  id: number;
}

class MinHeap {
  private heap: HeapNode[] = [];

  peek(): HeapNode | null {
    return this.heap[0] ?? null;
  }

  push(node: HeapNode): void {
    this.heap.push(node);
    this.siftUp(this.heap.length - 1);
  }

  pop(): HeapNode | null {
    if (this.heap.length === 0) return null;
    const first = this.heap[0]!;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return first;
  }

  get size(): number {
    return this.heap.length;
  }

  private siftUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >>> 1;
      if (this.compare(this.heap[i]!, this.heap[parent]!) < 0) {
        [this.heap[i], this.heap[parent]] = [this.heap[parent]!, this.heap[i]!];
        i = parent;
      } else break;
    }
  }

  private siftDown(i: number): void {
    const len = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < len && this.compare(this.heap[left]!, this.heap[smallest]!) < 0) smallest = left;
      if (right < len && this.compare(this.heap[right]!, this.heap[smallest]!) < 0) smallest = right;
      if (smallest !== i) {
        [this.heap[i], this.heap[smallest]] = [this.heap[smallest]!, this.heap[i]!];
        i = smallest;
      } else break;
    }
  }

  private compare(a: HeapNode, b: HeapNode): number {
    const diff = a.sortIndex - b.sortIndex;
    return diff !== 0 ? diff : a.id - b.id;
  }
}

describe('Min Heap - Basic: Core Operations', () => {
  it('should return null for empty heap', () => {
    const heap = new MinHeap();
    expect(heap.peek()).toBeNull();
    expect(heap.pop()).toBeNull();
    expect(heap.size).toBe(0);
  });

  it('should push and peek minimum', () => {
    const heap = new MinHeap();
    heap.push({ sortIndex: 5, id: 1 });
    heap.push({ sortIndex: 3, id: 2 });
    heap.push({ sortIndex: 7, id: 3 });
    expect(heap.peek()!.sortIndex).toBe(3);
  });

  it('should pop in sorted order', () => {
    const heap = new MinHeap();
    heap.push({ sortIndex: 5, id: 1 });
    heap.push({ sortIndex: 1, id: 2 });
    heap.push({ sortIndex: 3, id: 3 });
    heap.push({ sortIndex: 2, id: 4 });
    heap.push({ sortIndex: 4, id: 5 });

    const sorted = [];
    while (heap.size > 0) sorted.push(heap.pop()!.sortIndex);
    expect(sorted).toEqual([1, 2, 3, 4, 5]);
  });

  it('should break ties by id', () => {
    const heap = new MinHeap();
    heap.push({ sortIndex: 1, id: 99 });
    heap.push({ sortIndex: 1, id: 10 });
    heap.push({ sortIndex: 1, id: 50 });

    expect(heap.pop()!.id).toBe(10);
    expect(heap.pop()!.id).toBe(50);
    expect(heap.pop()!.id).toBe(99);
  });

  it('should handle single element', () => {
    const heap = new MinHeap();
    heap.push({ sortIndex: 42, id: 1 });
    expect(heap.size).toBe(1);
    expect(heap.pop()!.sortIndex).toBe(42);
    expect(heap.size).toBe(0);
  });

  it('should maintain heap property after mixed operations', () => {
    const heap = new MinHeap();
    heap.push({ sortIndex: 10, id: 1 });
    heap.push({ sortIndex: 5, id: 2 });
    heap.pop(); // remove 5
    heap.push({ sortIndex: 3, id: 3 });
    heap.push({ sortIndex: 8, id: 4 });
    heap.pop(); // remove 3

    expect(heap.peek()!.sortIndex).toBe(8);
  });
});
