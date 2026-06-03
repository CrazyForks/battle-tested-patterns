import { describe, it, expect } from 'vitest';

/**
 * Ring Buffer - Intermediate: Streaming Moving Average.
 *
 * TODO: Use a ring buffer to compute a moving average over the
 * last N values in a data stream. This is used in monitoring
 * dashboards, signal processing, and network throughput metrics.
 *
 * When fewer than N values have been added, the average is over
 * all values seen so far (partial window).
 */

class MovingAverage {
  private buffer: number[];
  private head = 0;
  private count = 0;
  private sum = 0;
  private windowSize: number;

  constructor(windowSize: number) {
    // TODO: implement
    this.windowSize = windowSize;
    this.buffer = new Array(windowSize).fill(0);
  }

  /** Add a value to the stream and return the updated moving average. */
  push(value: number): number {
    // TODO: implement — overwrite oldest, update sum, compute average
    if (this.count >= this.windowSize) {
      // Subtract the value being overwritten
      this.sum -= this.buffer[this.head]!;
    }

    this.buffer[this.head] = value;
    this.sum += value;
    this.head = (this.head + 1) % this.windowSize;

    if (this.count < this.windowSize) {
      this.count++;
    }

    return this.sum / this.count;
  }

  /** Return the current moving average without adding a value. */
  average(): number {
    // TODO: implement
    if (this.count === 0) return 0;
    return this.sum / this.count;
  }

  /** How many values are currently in the window. */
  get filled(): number {
    return this.count;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Ring Buffer - Intermediate: Streaming Moving Average', () => {
  it('should compute average during partial fill', () => {
    const ma = new MovingAverage(5);
    expect(ma.push(10)).toBeCloseTo(10);       // avg of [10]
    expect(ma.push(20)).toBeCloseTo(15);       // avg of [10, 20]
    expect(ma.push(30)).toBeCloseTo(20);       // avg of [10, 20, 30]
    expect(ma.filled).toBe(3);
  });

  it('should compute correct average when buffer is full', () => {
    const ma = new MovingAverage(3);
    ma.push(10); // [10]
    ma.push(20); // [10, 20]
    ma.push(30); // [10, 20, 30] → avg = 20
    expect(ma.average()).toBeCloseTo(20);

    ma.push(40); // overwrites 10 → [40, 20, 30] → avg = 30
    expect(ma.average()).toBeCloseTo(30);

    ma.push(50); // overwrites 20 → [40, 50, 30] → avg = 40
    expect(ma.average()).toBeCloseTo(40);
  });

  it('should handle a single-element window', () => {
    const ma = new MovingAverage(1);
    expect(ma.push(42)).toBeCloseTo(42);
    expect(ma.push(100)).toBeCloseTo(100);
    expect(ma.push(7)).toBeCloseTo(7);
  });

  it('should maintain accuracy over many overwrites', () => {
    const ma = new MovingAverage(4);
    // Push 1..8, final window should be [5, 6, 7, 8]
    for (let i = 1; i <= 8; i++) ma.push(i);
    expect(ma.average()).toBeCloseTo(6.5); // (5+6+7+8)/4
    expect(ma.filled).toBe(4);
  });

  it('should return 0 average when empty', () => {
    const ma = new MovingAverage(10);
    expect(ma.average()).toBe(0);
    expect(ma.filled).toBe(0);
  });
});
