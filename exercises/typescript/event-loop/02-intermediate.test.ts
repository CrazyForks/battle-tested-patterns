import { describe, it, expect } from 'vitest';

/**
 * Event Loop - Intermediate: Timer + I/O Event Loop.
 *
 * TODO: Extend the event loop with timer support. Timers fire when
 * currentTime >= scheduledTime. tick(currentTime) processes both
 * I/O handlers and ready timers. Timers are one-shot: they fire once
 * and are removed. I/O handlers persist across ticks.
 *
 * Real-world use: libuv timer phase, Tokio time driver, browser
 * setTimeout integration with the microtask queue.
 */

type Handler = () => void;

interface Timer {
  id: number;
  fireAt: number;
  callback: Handler;
}

class TimerEventLoop {
  private ioHandlers = new Map<number, Handler>();
  private timers = new Map<number, Timer>();
  private nextTimerId = 1;

  /** Register a persistent I/O handler. */
  addHandler(fd: number, callback: Handler): void {
    // TODO: implement
    this.ioHandlers.set(fd, callback);
  }

  /** Remove an I/O handler. */
  removeHandler(fd: number): void {
    // TODO: implement
    this.ioHandlers.delete(fd);
  }

  /** Schedule a one-shot timer. Returns a timer ID for cancellation. */
  setTimeout(callback: Handler, delay: number, currentTime: number): number {
    // TODO: implement
    const id = this.nextTimerId++;
    this.timers.set(id, { id, fireAt: currentTime + delay, callback });
    return id;
  }

  /** Cancel a pending timer. Returns true if the timer existed. */
  clearTimeout(timerId: number): boolean {
    // TODO: implement
    return this.timers.delete(timerId);
  }

  /**
   * Execute one tick at the given time.
   * Fires all ready timers (sorted by fireAt), then all I/O handlers.
   * Returns the total number of callbacks invoked.
   */
  tick(currentTime: number): number {
    // TODO: implement
    let invoked = 0;

    // Collect and sort ready timers by scheduled time
    const readyTimers: Timer[] = [];
    for (const [, timer] of this.timers) {
      if (currentTime >= timer.fireAt) {
        readyTimers.push(timer);
      }
    }
    readyTimers.sort((a, b) => a.fireAt - b.fireAt || a.id - b.id);

    // Fire timers (one-shot: remove after firing)
    for (const timer of readyTimers) {
      this.timers.delete(timer.id);
      timer.callback();
      invoked++;
    }

    // Fire I/O handlers
    for (const [, handler] of this.ioHandlers) {
      handler();
      invoked++;
    }

    return invoked;
  }

  /** Number of pending timers. */
  get pendingTimers(): number {
    return this.timers.size;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Event Loop - Intermediate: Timer + I/O Event Loop', () => {
  it('should fire timer at the correct time', () => {
    const loop = new TimerEventLoop();
    let fired = false;

    loop.setTimeout(() => { fired = true; }, 100, 0); // fires at t=100

    loop.tick(50); // too early
    expect(fired).toBe(false);

    loop.tick(100); // exact time
    expect(fired).toBe(true);
  });

  it('should interleave I/O handlers and timers', () => {
    const loop = new TimerEventLoop();
    const order: string[] = [];

    loop.setTimeout(() => order.push('timer'), 0, 0); // ready immediately
    loop.addHandler(1, () => order.push('io'));

    loop.tick(0);
    // Timers fire before I/O in each tick
    expect(order).toEqual(['timer', 'io']);

    // Timer is one-shot; only I/O fires on next tick
    order.length = 0;
    loop.tick(1);
    expect(order).toEqual(['io']);
  });

  it('should support timer cancellation', () => {
    const loop = new TimerEventLoop();
    let fired = false;

    const id = loop.setTimeout(() => { fired = true; }, 50, 0);
    expect(loop.pendingTimers).toBe(1);

    const cancelled = loop.clearTimeout(id);
    expect(cancelled).toBe(true);
    expect(loop.pendingTimers).toBe(0);

    loop.tick(100);
    expect(fired).toBe(false);
  });

  it('should fire timers in scheduled order when multiple are ready', () => {
    const loop = new TimerEventLoop();
    const order: string[] = [];

    loop.setTimeout(() => order.push('late'), 200, 0); // fires at t=200
    loop.setTimeout(() => order.push('early'), 50, 0); // fires at t=50
    loop.setTimeout(() => order.push('mid'), 100, 0); // fires at t=100

    // All three are ready at t=300
    loop.tick(300);
    expect(order).toEqual(['early', 'mid', 'late']);
  });

  it('timers are one-shot and do not repeat', () => {
    const loop = new TimerEventLoop();
    let count = 0;

    loop.setTimeout(() => count++, 10, 0);

    loop.tick(10);
    expect(count).toBe(1);

    loop.tick(20);
    expect(count).toBe(1); // should not fire again

    loop.tick(100);
    expect(count).toBe(1);
  });
});
