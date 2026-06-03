import { describe, it, expect } from 'vitest';

/**
 * Event Loop - Basic: Mini Event Loop.
 *
 * TODO: Implement a minimal event loop (reactor pattern). File descriptors
 * (modeled as numeric IDs) can be registered with callbacks. tick() invokes
 * all registered handlers once. run(maxTicks) calls tick() repeatedly up
 * to a maximum number of iterations.
 *
 * Real-world use: Node.js libuv, Nginx event loop, Redis ae, Tokio reactor.
 */

type Handler = () => void;

class EventLoop {
  private handlers = new Map<number, Handler>();

  /** Register a handler for a file descriptor. */
  addHandler(fd: number, callback: Handler): void {
    // TODO: implement
    this.handlers.set(fd, callback);
  }

  /** Remove a handler for a file descriptor. */
  removeHandler(fd: number): void {
    // TODO: implement
    this.handlers.delete(fd);
  }

  /** Execute one tick: call all registered handlers once. Returns handler count. */
  tick(): number {
    // TODO: implement
    const count = this.handlers.size;
    for (const [, handler] of this.handlers) {
      handler();
    }
    return count;
  }

  /** Run the event loop for up to maxTicks iterations. Stops early if no handlers. */
  run(maxTicks: number): number {
    // TODO: implement
    let ticksRun = 0;
    for (let i = 0; i < maxTicks; i++) {
      if (this.handlers.size === 0) break;
      this.tick();
      ticksRun++;
    }
    return ticksRun;
  }

  /** Number of currently registered handlers. */
  get handlerCount(): number {
    return this.handlers.size;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Event Loop - Basic: Mini Event Loop', () => {
  it('should register and fire a handler on tick', () => {
    const loop = new EventLoop();
    let called = 0;
    loop.addHandler(1, () => called++);

    loop.tick();
    expect(called).toBe(1);

    loop.tick();
    expect(called).toBe(2);
  });

  it('should stop firing after handler is removed', () => {
    const loop = new EventLoop();
    let called = 0;
    loop.addHandler(1, () => called++);

    loop.tick();
    expect(called).toBe(1);

    loop.removeHandler(1);
    loop.tick();
    expect(called).toBe(1); // not called again
  });

  it('should handle multiple handlers independently', () => {
    const loop = new EventLoop();
    const counts = { a: 0, b: 0, c: 0 };

    loop.addHandler(1, () => counts.a++);
    loop.addHandler(2, () => counts.b++);
    loop.addHandler(3, () => counts.c++);

    loop.tick();
    expect(counts).toEqual({ a: 1, b: 1, c: 1 });

    loop.removeHandler(2);
    loop.tick();
    expect(counts).toEqual({ a: 2, b: 1, c: 2 });
  });

  it('should respect maxTicks limit in run()', () => {
    const loop = new EventLoop();
    let called = 0;
    loop.addHandler(1, () => called++);

    const ticksRun = loop.run(3);
    expect(ticksRun).toBe(3);
    expect(called).toBe(3);
  });

  it('should stop run() early when no handlers remain', () => {
    const loop = new EventLoop();
    let called = 0;
    loop.addHandler(1, () => {
      called++;
      if (called >= 2) loop.removeHandler(1);
    });

    const ticksRun = loop.run(10);
    expect(ticksRun).toBe(2); // stopped after handler removed itself
    expect(called).toBe(2);
  });
});
