import { describe, it, expect } from 'vitest';

/**
 * Semaphore - Intermediate: Connection Pool.
 *
 * TODO: Implement a connection pool of N connections guarded by a semaphore.
 * acquire() returns an available connection (or waits if all are busy).
 * release(conn) returns the connection to the pool.
 *
 * Real-world use: Database connection pools, HTTP client pools,
 * worker thread pools.
 */

interface Connection {
  id: number;
}

class ConnectionPool {
  private available: Connection[] = [];
  private waitQueue: Array<(conn: Connection) => void> = [];
  private _inUse = 0;

  constructor(size: number) {
    // TODO: implement — create `size` connections
    for (let i = 0; i < size; i++) {
      this.available.push({ id: i + 1 });
    }
  }

  /** Acquire a connection. Resolves immediately if one is available, waits otherwise. */
  async acquire(): Promise<Connection> {
    // TODO: implement
    if (this.available.length > 0) {
      const conn = this.available.shift()!;
      this._inUse++;
      return conn;
    }
    return new Promise<Connection>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  /** Release a connection back to the pool. Unblocks the next waiter if any. */
  release(conn: Connection): void {
    // TODO: implement
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      next(conn);
    } else {
      this._inUse--;
      this.available.push(conn);
    }
  }

  get inUse(): number {
    return this._inUse;
  }

  get freeCount(): number {
    return this.available.length;
  }

  get waitingCount(): number {
    return this.waitQueue.length;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Semaphore - Intermediate: Connection Pool', () => {
  it('should allow up to N concurrent connections', async () => {
    const pool = new ConnectionPool(3);
    const c1 = await pool.acquire();
    const c2 = await pool.acquire();
    const c3 = await pool.acquire();

    expect(pool.inUse).toBe(3);
    expect(pool.freeCount).toBe(0);
    expect(c1.id).not.toBe(c2.id);
    expect(c2.id).not.toBe(c3.id);
  });

  it('should block at N+1 and unblock on release', async () => {
    const pool = new ConnectionPool(2);
    const c1 = await pool.acquire();
    await pool.acquire();

    let blocked = true;
    const pending = pool.acquire().then((conn) => {
      blocked = false;
      return conn;
    });

    // Still blocked
    await Promise.resolve();
    expect(blocked).toBe(true);
    expect(pool.waitingCount).toBe(1);

    pool.release(c1);
    const c3 = await pending;
    expect(blocked).toBe(false);
    expect(c3.id).toBe(c1.id); // got the released connection
  });

  it('should unblock waiters in FIFO order', async () => {
    const pool = new ConnectionPool(1);
    const c1 = await pool.acquire();

    const order: number[] = [];
    const p1 = pool.acquire().then((conn) => {
      order.push(1);
      return conn;
    });
    const p2 = pool.acquire().then((conn) => {
      order.push(2);
      return conn;
    });

    pool.release(c1);
    const conn1 = await p1;
    pool.release(conn1);
    await p2;

    expect(order).toEqual([1, 2]);
  });

  it('should release connection back to the pool', async () => {
    const pool = new ConnectionPool(2);
    const c1 = await pool.acquire();
    await pool.acquire();

    expect(pool.freeCount).toBe(0);
    pool.release(c1);
    expect(pool.freeCount).toBe(1);
    expect(pool.inUse).toBe(1);
  });

  it('should track pool size correctly through acquire/release cycles', async () => {
    const pool = new ConnectionPool(3);
    expect(pool.freeCount).toBe(3);
    expect(pool.inUse).toBe(0);

    const c1 = await pool.acquire();
    const c2 = await pool.acquire();
    expect(pool.freeCount).toBe(1);
    expect(pool.inUse).toBe(2);

    pool.release(c1);
    pool.release(c2);
    expect(pool.freeCount).toBe(3);
    expect(pool.inUse).toBe(0);
  });
});
