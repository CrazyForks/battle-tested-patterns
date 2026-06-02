import { describe, it, expect } from 'vitest';

/**
 * Cooperative Scheduling - Intermediate: Priority scheduler with yielding.
 *
 * Build a scheduler that processes tasks by priority and yields
 * when the time slice is exceeded.
 */

interface ScheduledTask {
  id: string;
  priority: number; // lower = higher priority
  work: () => boolean; // returns true when done
}

class PriorityScheduler {
  private queue: ScheduledTask[] = [];
  private completed: string[] = [];

  schedule(task: ScheduledTask): void {
    this.queue.push(task);
    this.queue.sort((a, b) => a.priority - b.priority);
  }

  workLoop(shouldYield: () => boolean): { done: boolean; completedIds: string[] } {
    while (this.queue.length > 0) {
      if (shouldYield()) {
        return { done: false, completedIds: [...this.completed] };
      }

      const task = this.queue[0]!;
      const taskDone = task.work();

      if (taskDone) {
        this.completed.push(task.id);
        this.queue.shift();
      }
    }

    return { done: true, completedIds: [...this.completed] };
  }

  pending(): number {
    return this.queue.length;
  }
}

describe('Cooperative Scheduling - Intermediate: Priority Scheduler', () => {
  it('should process tasks in priority order', () => {
    const scheduler = new PriorityScheduler();
    const order: string[] = [];

    scheduler.schedule({
      id: 'low',
      priority: 3,
      work: () => { order.push('low'); return true; },
    });
    scheduler.schedule({
      id: 'high',
      priority: 1,
      work: () => { order.push('high'); return true; },
    });
    scheduler.schedule({
      id: 'medium',
      priority: 2,
      work: () => { order.push('medium'); return true; },
    });

    const result = scheduler.workLoop(() => false);

    expect(result.done).toBe(true);
    expect(order).toEqual(['high', 'medium', 'low']);
    expect(result.completedIds).toEqual(['high', 'medium', 'low']);
  });

  it('should yield between tasks', () => {
    const scheduler = new PriorityScheduler();
    let callCount = 0;

    scheduler.schedule({ id: 'a', priority: 1, work: () => true });
    scheduler.schedule({ id: 'b', priority: 2, work: () => true });
    scheduler.schedule({ id: 'c', priority: 3, work: () => true });

    // Yield after 2 tasks
    const result = scheduler.workLoop(() => ++callCount > 2);

    expect(result.done).toBe(false);
    expect(result.completedIds).toEqual(['a', 'b']);
    expect(scheduler.pending()).toBe(1);
  });

  it('should resume after yield and complete remaining', () => {
    const scheduler = new PriorityScheduler();
    let yieldCount = 0;

    scheduler.schedule({ id: 'x', priority: 1, work: () => true });
    scheduler.schedule({ id: 'y', priority: 2, work: () => true });
    scheduler.schedule({ id: 'z', priority: 3, work: () => true });

    // First pass: yield after 1
    scheduler.workLoop(() => ++yieldCount > 1);
    expect(scheduler.pending()).toBe(2);

    // Second pass: complete all
    yieldCount = 0;
    const result = scheduler.workLoop(() => false);
    expect(result.done).toBe(true);
    expect(result.completedIds).toEqual(['x', 'y', 'z']);
  });

  it('should handle multi-step tasks', () => {
    const scheduler = new PriorityScheduler();
    let steps = 0;

    scheduler.schedule({
      id: 'multi',
      priority: 1,
      work: () => {
        steps++;
        return steps >= 3; // takes 3 calls to complete
      },
    });

    const result = scheduler.workLoop(() => false);
    expect(result.done).toBe(true);
    expect(steps).toBe(3);
  });

  it('should handle empty queue', () => {
    const scheduler = new PriorityScheduler();
    const result = scheduler.workLoop(() => false);
    expect(result.done).toBe(true);
    expect(result.completedIds).toEqual([]);
  });
});
