import { describe, it, expect } from 'vitest';

/**
 * Object Pool - Intermediate: Connection pool with max size.
 *
 * TODO: Implement a ConnectionPool that limits the maximum number
 * of connections and reuses idle ones.
 */

interface Connection {
  id: number;
  inUse: boolean;
}

class ConnectionPool {
  private idle: Connection[] = [];
  private active = new Set<Connection>();
  private maxSize: number;
  private nextId = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize; // TODO: implement
  }

  /** Acquire a connection — reuse idle or create new (up to maxSize) */
  acquire(): Connection | null {
    if (this.idle.length > 0) {
      // TODO: implement
      const conn = this.idle.pop()!;
      conn.inUse = true;
      this.active.add(conn);
      return conn;
    }
    if (this.active.size >= this.maxSize) return null;
    const conn: Connection = { id: ++this.nextId, inUse: true };
    this.active.add(conn);
    return conn;
  }

  /** Release a connection back to idle */
  release(conn: Connection): void {
    conn.inUse = false; // TODO: implement
    this.active.delete(conn);
    this.idle.push(conn);
  }

  get activeCount(): number {
    return this.active.size;
  }
  get idleCount(): number {
    return this.idle.length;
  }
  get totalCreated(): number {
    return this.nextId;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Object Pool - Intermediate: Connection Pool', () => {
  it('should create connections up to max size', () => {
    const pool = new ConnectionPool(3);
    const c1 = pool.acquire();
    const c2 = pool.acquire();
    const c3 = pool.acquire();
    expect(c1).not.toBeNull();
    expect(c2).not.toBeNull();
    expect(c3).not.toBeNull();
    expect(pool.acquire()).toBeNull();
    expect(pool.activeCount).toBe(3);
  });

  it('should reuse released connections', () => {
    const pool = new ConnectionPool(2);
    const c1 = pool.acquire()!;
    pool.release(c1);
    const c2 = pool.acquire()!;
    expect(c2).toBe(c1);
    expect(pool.totalCreated).toBe(1);
  });

  it('should track active and idle counts', () => {
    const pool = new ConnectionPool(5);
    const c1 = pool.acquire()!;
    pool.acquire();
    expect(pool.activeCount).toBe(2);
    expect(pool.idleCount).toBe(0);
    pool.release(c1);
    expect(pool.activeCount).toBe(1);
    expect(pool.idleCount).toBe(1);
  });

  it('should allow re-acquiring after release frees a slot', () => {
    const pool = new ConnectionPool(1);
    const c1 = pool.acquire()!;
    expect(pool.acquire()).toBeNull();
    pool.release(c1);
    const c2 = pool.acquire();
    expect(c2).not.toBeNull();
  });
});
