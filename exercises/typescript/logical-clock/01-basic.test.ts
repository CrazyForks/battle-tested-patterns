import { describe, it, expect } from 'vitest';

/**
 * Logical Clock - Basic: Lamport Clock.
 *
 * TODO: Implement a Lamport clock that maintains a monotonically
 * increasing counter. tick() increments locally, send() returns
 * the current timestamp for messages, receive(ts) advances the
 * clock past the remote timestamp (max(local, remote) + 1).
 *
 * Real-world use: Distributed databases (DynamoDB), event ordering
 * in message queues, conflict detection in CRDTs.
 */

class LamportClock {
  private time: number;

  constructor() {
    // TODO: implement
    this.time = 0;
  }

  /** Increment the clock for a local event. */
  tick(): void {
    // TODO: implement
    this.time++;
  }

  /** Record a send event and return the timestamp to attach to the message. */
  send(): number {
    // TODO: implement
    this.time++;
    return this.time;
  }

  /** Receive a message with a remote timestamp and advance the clock. */
  receive(remoteTimestamp: number): void {
    // TODO: implement
    this.time = Math.max(this.time, remoteTimestamp) + 1;
  }

  /** Current clock value. */
  now(): number {
    return this.time;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Logical Clock - Basic: Lamport Clock', () => {
  it('should be monotonically increasing', () => {
    const clock = new LamportClock();
    const values: number[] = [];

    clock.tick();
    values.push(clock.now());
    clock.tick();
    values.push(clock.now());
    clock.tick();
    values.push(clock.now());

    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
  });

  it('should return current time on send', () => {
    const clock = new LamportClock();
    clock.tick(); // time = 1
    const ts = clock.send(); // time = 2, returns 2
    expect(ts).toBe(clock.now());
    expect(ts).toBeGreaterThan(0);
  });

  it('should advance past remote timestamp on receive', () => {
    const clock = new LamportClock();
    clock.tick(); // time = 1
    clock.receive(10); // time = max(1, 10) + 1 = 11
    expect(clock.now()).toBe(11);
  });

  it('should handle concurrent clocks that diverge then sync', () => {
    const clockA = new LamportClock();
    const clockB = new LamportClock();

    // Independent local events
    clockA.tick(); // A: 1
    clockA.tick(); // A: 2
    clockB.tick(); // B: 1

    // Clocks are diverged
    expect(clockA.now()).not.toBe(clockB.now());

    // A sends to B
    const tsFromA = clockA.send(); // A: 3
    clockB.receive(tsFromA); // B: max(1, 3) + 1 = 4

    // B is now ahead of A (causally after A's message)
    expect(clockB.now()).toBeGreaterThan(clockA.now());
  });

  it('should not go backward on receive with older timestamp', () => {
    const clock = new LamportClock();
    clock.tick(); // 1
    clock.tick(); // 2
    clock.tick(); // 3

    const before = clock.now();
    clock.receive(1); // remote is behind — should still advance
    expect(clock.now()).toBeGreaterThan(before);
  });
});
