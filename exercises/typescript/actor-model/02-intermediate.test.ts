import { describe, it, expect } from 'vitest';

/**
 * Actor Model - Intermediate: Actor Supervision.
 *
 * TODO: Implement a supervised actor system where a parent actor
 * monitors its children. When a child crashes (throws during message
 * handling), the parent is notified and can restart the child with
 * its initial state. Other children are unaffected.
 *
 * Real-world use: Erlang/OTP supervisors, Akka supervision trees.
 */

type ChildHandler<S> = (state: S, msg: unknown) => S;

interface ChildRef {
  name: string;
  send(msg: unknown): void;
  getState(): unknown;
}

class SupervisedActor<S> {
  private children = new Map<
    string,
    {
      state: S;
      initialState: S;
      handler: ChildHandler<S>;
      mailbox: unknown[];
    }
  >();
  private restartLog: Array<{ name: string; error: string }> = [];

  // TODO: implement

  /** Spawn a named child actor with an initial state and handler. */
  spawn(name: string, initialState: S, handler: ChildHandler<S>): ChildRef {
    // TODO: implement
    this.children.set(name, {
      state: structuredClone(initialState),
      initialState: structuredClone(initialState),
      handler,
      mailbox: [],
    });

    return {
      name,
      send: (msg: unknown) => {
        const child = this.children.get(name);
        if (!child) return;
        try {
          child.state = child.handler(child.state, msg);
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          this.restartLog.push({ name, error });
          // Restart: reset to initial state
          child.state = structuredClone(child.initialState);
        }
      },
      getState: () => {
        return this.children.get(name)?.state;
      },
    };
  }

  /** Return the list of restart events recorded by this supervisor. */
  getRestartLog(): Array<{ name: string; error: string }> {
    return [...this.restartLog];
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Actor Model - Intermediate: Actor Supervision', () => {
  it('should process messages in a child actor', () => {
    const supervisor = new SupervisedActor<number>();
    const child = supervisor.spawn('counter', 0, (state, msg) => {
      if (msg === 'inc') return state + 1;
      return state;
    });

    child.send('inc');
    child.send('inc');
    child.send('inc');
    expect(child.getState()).toBe(3);
  });

  it('should notify parent and restart child on crash', () => {
    const supervisor = new SupervisedActor<number>();
    const child = supervisor.spawn('fragile', 0, (state, msg) => {
      if (msg === 'crash') throw new Error('boom');
      return state + 1;
    });

    child.send('work');
    expect(child.getState()).toBe(1);

    child.send('crash');
    // After crash, child is restarted with initial state
    expect(child.getState()).toBe(0);

    const log = supervisor.getRestartLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toEqual({ name: 'fragile', error: 'boom' });
  });

  it('should recover and continue processing after restart', () => {
    const supervisor = new SupervisedActor<number>();
    const child = supervisor.spawn('resilient', 10, (state, msg) => {
      if (msg === 'crash') throw new Error('oops');
      if (msg === 'inc') return state + 1;
      return state;
    });

    child.send('inc'); // 11
    child.send('crash'); // restart -> 10
    child.send('inc'); // 11
    child.send('inc'); // 12
    expect(child.getState()).toBe(12);
  });

  it('should keep children independent — crash in one does not affect another', () => {
    const supervisor = new SupervisedActor<number>();
    const a = supervisor.spawn('a', 0, (state, msg) => {
      if (msg === 'crash') throw new Error('a-crash');
      return state + 1;
    });
    const b = supervisor.spawn('b', 100, (state) => state + 1);

    a.send('work'); // a = 1
    b.send('work'); // b = 101
    a.send('crash'); // a restarted -> 0
    b.send('work'); // b = 102

    expect(a.getState()).toBe(0);
    expect(b.getState()).toBe(102);
  });

  it('should preserve message order after restart', () => {
    const supervisor = new SupervisedActor<string[]>();
    const child = supervisor.spawn('logger', [] as string[], (state, msg) => {
      const m = msg as string;
      if (m === 'crash') throw new Error('fail');
      state.push(m);
      return state;
    });

    child.send('first');
    child.send('crash'); // restart -> []
    child.send('after-restart');
    child.send('final');

    // After restart, state is reset, so only post-restart messages
    expect(child.getState()).toEqual(['after-restart', 'final']);
    expect(supervisor.getRestartLog()).toHaveLength(1);
  });
});
