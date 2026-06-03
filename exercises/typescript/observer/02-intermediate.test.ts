import { describe, it, expect } from 'vitest';

/**
 * Observer - Intermediate: Typed Event Bus.
 *
 * TODO: Implement a type-safe event bus where each event name maps to
 * a specific payload type. Support on(), once(), off(), and emit().
 */

interface EventMap {
  login: { userId: string; timestamp: number };
  logout: { userId: string };
  message: { from: string; body: string };
  error: { code: number; message: string };
}

type Handler<T> = (data: T) => void;

class TypedEventBus<E extends Record<string, any>> {
  private listeners = new Map<keyof E, Set<Handler<any>>>();
  private onceSet = new WeakSet<Handler<any>>();

  /** Subscribe to a typed event. Returns an unsubscribe function. */
  on<K extends keyof E>(event: K, handler: Handler<E[K]>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set()); // TODO: implement
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  /** Subscribe to an event, but fire handler only once */
  once<K extends keyof E>(event: K, handler: Handler<E[K]>): () => void {
    this.onceSet.add(handler); // TODO: implement
    return this.on(event, handler);
  }

  /** Remove a specific handler from an event */
  off<K extends keyof E>(event: K, handler: Handler<E[K]>): void {
    this.listeners.get(event)?.delete(handler); // TODO: implement
  }

  /** Emit a typed event to all registered handlers */
  emit<K extends keyof E>(event: K, data: E[K]): void {
    const handlers = this.listeners.get(event); // TODO: implement
    if (!handlers) return;
    for (const handler of [...handlers]) {
      handler(data);
      if (this.onceSet.has(handler)) {
        handlers.delete(handler);
        this.onceSet.delete(handler);
      }
    }
  }

  /** Return the number of listeners for a given event */
  listenerCount<K extends keyof E>(event: K): number {
    return this.listeners.get(event)?.size ?? 0; // TODO: implement
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Observer - Intermediate: Typed Event Bus', () => {
  it('should emit and receive typed events', () => {
    const bus = new TypedEventBus<EventMap>();
    const logins: EventMap['login'][] = [];
    bus.on('login', (data) => logins.push(data));

    bus.emit('login', { userId: 'alice', timestamp: 1000 });
    bus.emit('login', { userId: 'bob', timestamp: 2000 });

    expect(logins).toEqual([
      { userId: 'alice', timestamp: 1000 },
      { userId: 'bob', timestamp: 2000 },
    ]);
  });

  it('should fire once() handler only one time', () => {
    const bus = new TypedEventBus<EventMap>();
    const errors: EventMap['error'][] = [];
    bus.once('error', (data) => errors.push(data));

    bus.emit('error', { code: 500, message: 'Internal' });
    bus.emit('error', { code: 404, message: 'Not Found' });

    expect(errors).toEqual([{ code: 500, message: 'Internal' }]);
    expect(bus.listenerCount('error')).toBe(0);
  });

  it('should remove specific handler with off()', () => {
    const bus = new TypedEventBus<EventMap>();
    const received: string[] = [];
    const handler = (data: EventMap['message']) => received.push(data.body);

    bus.on('message', handler);
    bus.emit('message', { from: 'sys', body: 'hello' });
    bus.off('message', handler);
    bus.emit('message', { from: 'sys', body: 'world' });

    expect(received).toEqual(['hello']);
  });

  it('should isolate different event types', () => {
    const bus = new TypedEventBus<EventMap>();
    const logins: string[] = [];
    const logouts: string[] = [];

    bus.on('login', (d) => logins.push(d.userId));
    bus.on('logout', (d) => logouts.push(d.userId));

    bus.emit('login', { userId: 'alice', timestamp: 1 });
    bus.emit('logout', { userId: 'bob' });

    expect(logins).toEqual(['alice']);
    expect(logouts).toEqual(['bob']);
  });

  it('should call listeners in registration order', () => {
    const bus = new TypedEventBus<EventMap>();
    const order: number[] = [];

    bus.on('error', () => order.push(1));
    bus.on('error', () => order.push(2));
    bus.on('error', () => order.push(3));

    bus.emit('error', { code: 0, message: 'test' });

    expect(order).toEqual([1, 2, 3]);
  });
});
