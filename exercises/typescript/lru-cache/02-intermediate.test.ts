import { describe, it, expect } from 'vitest';

/**
 * LRU Cache - Intermediate: TTL-aware LRU Cache.
 *
 * TODO: Implement an LRU cache where each entry expires after a
 * configurable TTL (time-to-live) in milliseconds. Expired entries
 * are treated as missing: get() returns undefined. Capacity-based
 * eviction still removes the least recently used *non-expired* entry.
 *
 * Real-world use: DNS resolvers, session stores, CDN edge caches.
 */

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

class TTLCache<K, V> {
  private map = new Map<K, CacheEntry<V>>();

  constructor(
    private capacity: number,
    private defaultTTL: number, // milliseconds
  ) {} // TODO: implement

  /** Get a value. Returns undefined if missing or expired. */
  get(key: K): V | undefined {
    // TODO: implement
    const entry = this.map.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }

    // Refresh LRU position (re-insert at end of Map iteration order)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  /** Store a value with optional per-key TTL override. */
  put(key: K, value: V, ttl?: number): void {
    // TODO: implement
    const effectiveTTL = ttl ?? this.defaultTTL;
    const entry: CacheEntry<V> = {
      value,
      expiresAt: Date.now() + effectiveTTL,
    };

    if (this.map.has(key)) {
      this.map.delete(key);
    }

    this.map.set(key, entry);
    this.evictIfNeeded();
  }

  /** Remove expired entries, then evict LRU if still over capacity. */
  private evictIfNeeded(): void {
    // First pass: remove all expired entries
    const now = Date.now();
    for (const [k, e] of this.map) {
      if (now > e.expiresAt) this.map.delete(k);
    }

    // Second pass: evict LRU (oldest in iteration order) if over capacity
    while (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value!;
      this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('LRU Cache - Intermediate: TTL-aware Cache', () => {
  it('should expire entries after TTL', async () => {
    const cache = new TTLCache<string, number>(10, 50); // 50ms TTL
    cache.put('a', 1);
    expect(cache.get('a')).toBe(1);

    await new Promise((r) => setTimeout(r, 60));
    expect(cache.get('a')).toBeUndefined();
  });

  it('should support per-key TTL override', async () => {
    const cache = new TTLCache<string, number>(10, 200);
    cache.put('short', 1, 30); // expires in 30ms
    cache.put('long', 2, 500); // expires in 500ms

    await new Promise((r) => setTimeout(r, 50));
    expect(cache.get('short')).toBeUndefined();
    expect(cache.get('long')).toBe(2);
  });

  it('should refresh LRU position on get but NOT reset TTL', async () => {
    const cache = new TTLCache<string, number>(2, 80);
    cache.put('a', 1); // expires at t+80ms
    cache.put('b', 2);

    await new Promise((r) => setTimeout(r, 40));
    cache.get('a'); // refreshes LRU order, but TTL stays at original t+80ms

    cache.put('c', 3); // evicts 'b' (LRU), not 'a' (recently accessed)
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);

    // But 'a' still expires based on original insertion time
    await new Promise((r) => setTimeout(r, 50));
    expect(cache.get('a')).toBeUndefined();
  });

  it('should evict LRU entries when at capacity (ignoring expired)', async () => {
    const cache = new TTLCache<string, number>(2, 30);
    cache.put('x', 1); // will expire
    cache.put('y', 2); // will expire

    await new Promise((r) => setTimeout(r, 40));
    // Both expired — inserting 2 new items should work without hitting capacity
    cache.put('a', 10, 5000);
    cache.put('b', 20, 5000);
    expect(cache.get('a')).toBe(10);
    expect(cache.get('b')).toBe(20);
    expect(cache.size).toBe(2);
  });

  it('should handle mixed TTL-expired and LRU-evicted entries', async () => {
    const cache = new TTLCache<string, number>(3, 5000);
    cache.put('a', 1, 30); // short TTL
    cache.put('b', 2, 5000); // long TTL
    cache.put('c', 3, 5000); // long TTL

    await new Promise((r) => setTimeout(r, 40));
    // 'a' has expired. Adding 'd' should not evict 'b' or 'c'
    // because cleaning expired 'a' frees a slot.
    cache.put('d', 4, 5000);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });
});
