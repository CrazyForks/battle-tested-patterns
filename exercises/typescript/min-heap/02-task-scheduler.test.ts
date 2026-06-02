import { describe, it, expect } from 'vitest';

/**
 * Min Heap - Intermediate: React-style task scheduler.
 *
 * Build a scheduler that uses a min heap to process
 * tasks by expiration time (lower = more urgent).
 */

interface Task {
  id: number;
  expirationTime: number;
  callback: () => string;
}

class TaskScheduler {
  private heap: Task[] = [];
  private idCounter = 0;

  schedule(expirationTime: number, callback: () => string): number {
    const id = ++this.idCounter;
    const task: Task = { id, expirationTime, callback };
    this.heap.push(task);
    this.siftUp(this.heap.length - 1);
    return id;
  }

  processNext(): string | null {
    if (this.heap.length === 0) return null;
    const task = this.heap[0]!;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return task.callback();
  }

  peekExpiration(): number | null {
    return this.heap[0]?.expirationTime ?? null;
  }

  get pending(): number {
    return this.heap.length;
  }

  private siftUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >>> 1;
      if (this.heap[i]!.expirationTime < this.heap[parent]!.expirationTime) {
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
      if (left < len && this.heap[left]!.expirationTime < this.heap[smallest]!.expirationTime) smallest = left;
      if (right < len && this.heap[right]!.expirationTime < this.heap[smallest]!.expirationTime) smallest = right;
      if (smallest !== i) {
        [this.heap[i], this.heap[smallest]] = [this.heap[smallest]!, this.heap[i]!];
        i = smallest;
      } else break;
    }
  }
}

describe('Min Heap - Intermediate: Task Scheduler', () => {
  it('should process most urgent task first', () => {
    const scheduler = new TaskScheduler();
    scheduler.schedule(100, () => 'low');
    scheduler.schedule(10, () => 'high');
    scheduler.schedule(50, () => 'medium');

    expect(scheduler.processNext()).toBe('high');
    expect(scheduler.processNext()).toBe('medium');
    expect(scheduler.processNext()).toBe('low');
  });

  it('should peek at next expiration without removing', () => {
    const scheduler = new TaskScheduler();
    scheduler.schedule(30, () => 'a');
    scheduler.schedule(10, () => 'b');

    expect(scheduler.peekExpiration()).toBe(10);
    expect(scheduler.pending).toBe(2);
  });

  it('should handle tasks added after processing', () => {
    const scheduler = new TaskScheduler();
    scheduler.schedule(50, () => 'first');
    scheduler.processNext();

    scheduler.schedule(20, () => 'second');
    scheduler.schedule(10, () => 'third');

    expect(scheduler.processNext()).toBe('third');
    expect(scheduler.processNext()).toBe('second');
  });

  it('should return null when no tasks pending', () => {
    const scheduler = new TaskScheduler();
    expect(scheduler.processNext()).toBeNull();
    expect(scheduler.peekExpiration()).toBeNull();
  });

  it('should process many tasks in correct order', () => {
    const scheduler = new TaskScheduler();
    const expirations = [50, 30, 70, 10, 90, 20, 60, 40, 80];
    expirations.forEach((exp) => scheduler.schedule(exp, () => `task-${exp}`));

    const results: string[] = [];
    while (scheduler.pending > 0) results.push(scheduler.processNext()!);

    expect(results).toEqual([
      'task-10', 'task-20', 'task-30', 'task-40', 'task-50',
      'task-60', 'task-70', 'task-80', 'task-90',
    ]);
  });
});
