import { describe, it, expect } from 'vitest';

/**
 * Work Stealing - Intermediate: Priority Work Stealing.
 *
 * TODO: Implement a work-stealing scheduler where tasks have priorities.
 * Workers process high-priority tasks first from their own queue, but
 * steal any available task when idle.
 */

interface PriorityTask {
  id: number;
  priority: number; // lower number = higher priority
}

class PriorityWorkStealingScheduler {
  private queues: PriorityTask[][];

  constructor(workerCount: number) {
    this.queues = Array.from({ length: workerCount }, () => []); // TODO: implement
  }

  /** Submit a task to a specific worker's queue, keeping it sorted by priority */
  submit(task: PriorityTask, workerIdx: number): void {
    this.queues[workerIdx]!.push(task); // TODO: implement
    this.queues[workerIdx]!.sort((a, b) => a.priority - b.priority);
  }

  /** Run all tasks. Workers process their own high-priority tasks first,
   *  steal from others when idle. Returns task IDs in processing order. */
  run(): number[] {
    const results: number[] = []; // TODO: implement
    let anyWork = true;

    while (anyWork) {
      anyWork = false;
      for (let w = 0; w < this.queues.length; w++) {
        if (this.queues[w]!.length > 0) {
          anyWork = true;
          // Take highest priority (first element due to sort)
          const task = this.queues[w]!.shift()!;
          results.push(task.id);
        } else {
          // Try to steal from another worker
          for (let other = 0; other < this.queues.length; other++) {
            if (other !== w && this.queues[other]!.length > 1) {
              anyWork = true;
              // Steal from the back (lowest priority from victim)
              const stolen = this.queues[other]!.pop()!;
              results.push(stolen.id);
              break;
            }
          }
        }
      }
    }
    return results;
  }

  /** Get the total number of pending tasks across all workers */
  totalPending(): number {
    return this.queues.reduce((sum, q) => sum + q.length, 0); // TODO: implement
  }

  /** Get the queue size for a specific worker */
  queueSize(workerIdx: number): number {
    return this.queues[workerIdx]!.length; // TODO: implement
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Work Stealing - Intermediate: Priority Work Stealing', () => {
  it('should process high-priority tasks first locally', () => {
    const scheduler = new PriorityWorkStealingScheduler(1);
    scheduler.submit({ id: 1, priority: 3 }, 0); // low priority
    scheduler.submit({ id: 2, priority: 1 }, 0); // high priority
    scheduler.submit({ id: 3, priority: 2 }, 0); // medium priority

    const results = scheduler.run();
    // Single worker, processes in priority order (1 < 2 < 3)
    expect(results).toEqual([2, 3, 1]);
  });

  it('should steal work when a worker is idle', () => {
    const scheduler = new PriorityWorkStealingScheduler(2);
    // All tasks go to worker 0
    scheduler.submit({ id: 1, priority: 1 }, 0);
    scheduler.submit({ id: 2, priority: 2 }, 0);
    scheduler.submit({ id: 3, priority: 3 }, 0);
    scheduler.submit({ id: 4, priority: 4 }, 0);

    const results = scheduler.run();
    // All tasks eventually complete (order depends on stealing)
    expect(results.sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    // Worker 1 should have stolen at least one task
    expect(results.length).toBe(4);
  });

  it('should complete all tasks regardless of distribution', () => {
    const scheduler = new PriorityWorkStealingScheduler(3);
    scheduler.submit({ id: 1, priority: 1 }, 0);
    scheduler.submit({ id: 2, priority: 2 }, 0);
    scheduler.submit({ id: 3, priority: 1 }, 1);
    scheduler.submit({ id: 4, priority: 3 }, 2);
    scheduler.submit({ id: 5, priority: 2 }, 2);

    const results = scheduler.run();
    expect(results.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('should balance load across workers', () => {
    const scheduler = new PriorityWorkStealingScheduler(3);
    // Overload worker 0 with 6 tasks, leave others empty
    for (let i = 1; i <= 6; i++) {
      scheduler.submit({ id: i, priority: i }, 0);
    }

    expect(scheduler.queueSize(0)).toBe(6);
    expect(scheduler.queueSize(1)).toBe(0);
    expect(scheduler.queueSize(2)).toBe(0);

    const results = scheduler.run();
    // All tasks processed
    expect(results.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
    // Idle workers should have stolen work — more than 1 worker contributed
    expect(results.length).toBe(6);
  });

  it('should handle empty scheduler gracefully', () => {
    const scheduler = new PriorityWorkStealingScheduler(4);
    expect(scheduler.totalPending()).toBe(0);
    const results = scheduler.run();
    expect(results).toEqual([]);
  });
});
