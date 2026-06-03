import { describe, it, expect } from 'vitest';

/**
 * Backpressure - Intermediate: Bounded Channel.
 *
 * TODO: Implement a bounded async channel with separate send/receive
 * ends. send() returns a promise that resolves when the item is
 * accepted (blocks when buffer is full). receive() returns a promise
 * that resolves when data is available (blocks when buffer is empty).
 *
 * Real-world use: Go channels, Rust mpsc, worker thread messaging.
 */

class BoundedChannel<T> {
  private buffer: T[] = [];
  private sendWaiters: Array<{ item: T; resolve: () => void }> = [];
  private receiveWaiters: Array<(value: T) => void> = [];

  constructor(private capacity: number) {} // TODO: implement

  /** Send an item. Resolves when item is accepted into the buffer. */
  async send(item: T): Promise<void> {
    // TODO: implement
    // If a receiver is waiting, hand off directly
    if (this.receiveWaiters.length > 0) {
      const resolve = this.receiveWaiters.shift()!;
      resolve(item);
      return;
    }

    // If buffer has space, add directly
    if (this.buffer.length < this.capacity) {
      this.buffer.push(item);
      return;
    }

    // Otherwise, block until space is available
    return new Promise<void>((resolve) => {
      this.sendWaiters.push({ item, resolve });
    });
  }

  /** Receive an item. Resolves when data is available. */
  async receive(): Promise<T> {
    // TODO: implement
    // If buffer has data, return it
    if (this.buffer.length > 0) {
      const item = this.buffer.shift()!;

      // If senders are waiting, accept the next one into the buffer
      if (this.sendWaiters.length > 0) {
        const waiter = this.sendWaiters.shift()!;
        this.buffer.push(waiter.item);
        waiter.resolve();
      }

      return item;
    }

    // If senders are waiting (buffer must be 0-capacity edge case)
    if (this.sendWaiters.length > 0) {
      const waiter = this.sendWaiters.shift()!;
      waiter.resolve();
      return waiter.item;
    }

    // Otherwise, block until data arrives
    return new Promise<T>((resolve) => {
      this.receiveWaiters.push(resolve);
    });
  }

  /** Number of items currently buffered. */
  get buffered(): number {
    return this.buffer.length;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Backpressure - Intermediate: Bounded Channel', () => {
  it('should send and receive items', async () => {
    const ch = new BoundedChannel<string>(3);
    await ch.send('hello');
    await ch.send('world');
    expect(await ch.receive()).toBe('hello');
    expect(await ch.receive()).toBe('world');
  });

  it('should block send when buffer is full', async () => {
    const ch = new BoundedChannel<number>(2);
    await ch.send(1);
    await ch.send(2);

    let sent = false;
    const sendPromise = ch.send(3).then(() => {
      sent = true;
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(sent).toBe(false);
    expect(ch.buffered).toBe(2);

    await ch.receive(); // free a slot
    await sendPromise;
    expect(sent).toBe(true);
  });

  it('should unblock sender when receiver drains', async () => {
    const ch = new BoundedChannel<number>(1);
    await ch.send(1); // fills buffer

    const events: string[] = [];
    const sendPromise = ch.send(2).then(() => events.push('sent-2'));

    await new Promise((r) => setTimeout(r, 10));
    expect(events).not.toContain('sent-2');

    const val = await ch.receive();
    expect(val).toBe(1);

    await sendPromise;
    expect(events).toContain('sent-2');
    expect(await ch.receive()).toBe(2);
  });

  it('should preserve FIFO order', async () => {
    const ch = new BoundedChannel<number>(3);
    await ch.send(10);
    await ch.send(20);
    await ch.send(30);

    expect(await ch.receive()).toBe(10);
    expect(await ch.receive()).toBe(20);
    expect(await ch.receive()).toBe(30);
  });

  it('should track buffered count accurately', async () => {
    const ch = new BoundedChannel<string>(5);
    expect(ch.buffered).toBe(0);

    await ch.send('a');
    await ch.send('b');
    expect(ch.buffered).toBe(2);

    await ch.receive();
    expect(ch.buffered).toBe(1);

    await ch.receive();
    expect(ch.buffered).toBe(0);
  });
});
