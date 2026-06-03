import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * Batch Processing - Intermediate: Timeout Flush.
 *
 * TODO: Implement a batch processor that flushes on EITHER:
 * 1. Batch size reaching maxSize, OR
 * 2. A timeout expiring since the first item was added.
 *
 * Whichever comes first triggers the flush. This prevents items
 * from sitting in the buffer forever during low-traffic periods.
 *
 * Real-world use: Kafka producer linger.ms, DataDog agent,
 * CloudWatch Logs batch sending.
 */

class TimeoutBatchProcessor<T> {
  private queue: T[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushResults: T[][] = [];

  constructor(
    private onFlush: (items: T[]) => void,
    private maxSize: number,
    private timeoutMs: number,
  ) {} // TODO: implement

  /** Add an item. May trigger immediate flush if maxSize reached. */
  add(item: T): void {
    // TODO: implement
    this.queue.push(item);

    if (this.queue.length === 1) {
      // First item — start the timeout
      this.timer = setTimeout(() => this.flush(), this.timeoutMs);
    }

    if (this.queue.length >= this.maxSize) {
      this.flush();
    }
  }

  /** Force flush all queued items. */
  flush(): void {
    // TODO: implement
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    this.flushResults.push(batch);
    this.onFlush(batch);
  }

  /** Destroy the processor, clearing any pending timer. */
  destroy(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  get pending(): number {
    return this.queue.length;
  }

  get flushCount(): number {
    return this.flushResults.length;
  }

  get allFlushed(): T[][] {
    return [...this.flushResults];
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Batch Processing - Intermediate: Timeout Flush', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should flush when maxSize is reached', () => {
    vi.useFakeTimers();
    const flushed: number[][] = [];
    const bp = new TimeoutBatchProcessor<number>(
      (items) => flushed.push([...items]),
      3,
      1000,
    );

    bp.add(1);
    bp.add(2);
    bp.add(3); // triggers size flush

    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toEqual([1, 2, 3]);
    expect(bp.pending).toBe(0);
    bp.destroy();
  });

  it('should flush on timeout when maxSize not reached', () => {
    vi.useFakeTimers();
    const flushed: number[][] = [];
    const bp = new TimeoutBatchProcessor<number>(
      (items) => flushed.push([...items]),
      10,
      100,
    );

    bp.add(1);
    bp.add(2);
    expect(flushed).toHaveLength(0);

    vi.advanceTimersByTime(100);
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toEqual([1, 2]);
    expect(bp.pending).toBe(0);
    bp.destroy();
  });

  it('should handle mixed triggers — size first, then timeout', () => {
    vi.useFakeTimers();
    const flushed: number[][] = [];
    const bp = new TimeoutBatchProcessor<number>(
      (items) => flushed.push([...items]),
      2,
      500,
    );

    // First batch: size trigger
    bp.add(1);
    bp.add(2); // flush by size

    // Second batch: timeout trigger
    bp.add(3);
    vi.advanceTimersByTime(500); // flush by timeout

    expect(flushed).toHaveLength(2);
    expect(flushed[0]).toEqual([1, 2]);
    expect(flushed[1]).toEqual([3]);
    bp.destroy();
  });

  it('should skip flush when queue is empty', () => {
    vi.useFakeTimers();
    const flushed: number[][] = [];
    const bp = new TimeoutBatchProcessor<number>(
      (items) => flushed.push([...items]),
      5,
      100,
    );

    bp.flush(); // explicit flush on empty queue
    expect(flushed).toHaveLength(0);
    expect(bp.flushCount).toBe(0);
    bp.destroy();
  });

  it('should handle concurrent adds within same timeout window', () => {
    vi.useFakeTimers();
    const flushed: string[][] = [];
    const bp = new TimeoutBatchProcessor<string>(
      (items) => flushed.push([...items]),
      10,
      200,
    );

    bp.add('a');
    vi.advanceTimersByTime(50);
    bp.add('b');
    vi.advanceTimersByTime(50);
    bp.add('c');

    // Timer was set when 'a' was added. 200ms total haven't passed yet (only 100ms).
    expect(flushed).toHaveLength(0);

    vi.advanceTimersByTime(100); // now 200ms from first add
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toEqual(['a', 'b', 'c']);
    bp.destroy();
  });
});
