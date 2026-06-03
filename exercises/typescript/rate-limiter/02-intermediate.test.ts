import { describe, it, expect } from 'vitest';

/**
 * Rate Limiter - Intermediate: Sliding Window Rate Limiter.
 *
 * TODO: Implement a sliding window counter rate limiter. Unlike
 * token bucket (refills at a fixed rate), this tracks individual
 * request timestamps and enforces "at most N requests per window."
 *
 * Real-world use: API gateways (Kong, Envoy), GitHub API rate
 * limits, Redis-based rate limiters (sliding window log algorithm).
 *
 * Each key (e.g. user ID, IP address) has its own independent limit.
 */

class SlidingWindowLimiter {
  private windows = new Map<string, number[]>();

  constructor(
    private maxRequests: number,
    private windowMs: number,
  ) {} // TODO: implement

  /**
   * Try to record a request for the given key.
   * Returns true if allowed, false if rate limit exceeded.
   */
  tryRequest(key: string, now?: number): boolean {
    // TODO: implement
    const currentTime = now ?? Date.now();

    if (!this.windows.has(key)) {
      this.windows.set(key, []);
    }

    const timestamps = this.windows.get(key)!;
    const windowStart = currentTime - this.windowMs;

    // Remove expired timestamps (before the window start)
    while (timestamps.length > 0 && timestamps[0]! <= windowStart) {
      timestamps.shift();
    }

    if (timestamps.length >= this.maxRequests) {
      return false;
    }

    timestamps.push(currentTime);
    return true;
  }

  /** How many requests remain for this key in the current window. */
  remaining(key: string, now?: number): number {
    // TODO: implement
    const currentTime = now ?? Date.now();
    const timestamps = this.windows.get(key);
    if (!timestamps) return this.maxRequests;

    const windowStart = currentTime - this.windowMs;
    const active = timestamps.filter((t) => t > windowStart).length;
    return Math.max(0, this.maxRequests - active);
  }

  /** When the next request will be allowed (ms from now), or 0 if allowed now. */
  retryAfter(key: string, now?: number): number {
    // TODO: implement
    const currentTime = now ?? Date.now();
    const timestamps = this.windows.get(key);
    if (!timestamps || timestamps.length < this.maxRequests) return 0;

    const windowStart = currentTime - this.windowMs;
    const active = timestamps.filter((t) => t > windowStart);
    if (active.length < this.maxRequests) return 0;

    // Earliest active timestamp + windowMs = when that slot expires
    return active[0]! + this.windowMs - currentTime;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Rate Limiter - Intermediate: Sliding Window', () => {
  it('should allow requests up to the limit', () => {
    const limiter = new SlidingWindowLimiter(3, 1000);
    const now = 1000;

    expect(limiter.tryRequest('user1', now)).toBe(true);
    expect(limiter.tryRequest('user1', now + 10)).toBe(true);
    expect(limiter.tryRequest('user1', now + 20)).toBe(true);
    expect(limiter.remaining('user1', now + 20)).toBe(0);
  });

  it('should reject requests over the limit', () => {
    const limiter = new SlidingWindowLimiter(2, 1000);
    const now = 1000;

    expect(limiter.tryRequest('api-key', now)).toBe(true);
    expect(limiter.tryRequest('api-key', now + 100)).toBe(true);
    expect(limiter.tryRequest('api-key', now + 200)).toBe(false);
    expect(limiter.tryRequest('api-key', now + 300)).toBe(false);
  });

  it('should allow requests again after the window slides', () => {
    const limiter = new SlidingWindowLimiter(2, 1000);
    const now = 1000;

    expect(limiter.tryRequest('ip', now)).toBe(true);       // t=1000
    expect(limiter.tryRequest('ip', now + 100)).toBe(true);  // t=1100
    expect(limiter.tryRequest('ip', now + 200)).toBe(false); // full

    // At t=2001, the request at t=1000 has left the window
    expect(limiter.tryRequest('ip', now + 1001)).toBe(true);
    expect(limiter.remaining('ip', now + 1001)).toBe(0); // 2 active: t=1100, t=2001
  });

  it('should isolate keys from each other', () => {
    const limiter = new SlidingWindowLimiter(1, 1000);
    const now = 1000;

    expect(limiter.tryRequest('alice', now)).toBe(true);
    expect(limiter.tryRequest('alice', now + 10)).toBe(false); // alice is limited

    expect(limiter.tryRequest('bob', now + 10)).toBe(true);    // bob is independent
    expect(limiter.tryRequest('bob', now + 20)).toBe(false);   // bob is now limited
  });

  it('should report correct retryAfter time', () => {
    const limiter = new SlidingWindowLimiter(2, 1000);
    const now = 5000;

    limiter.tryRequest('svc', now);        // t=5000
    limiter.tryRequest('svc', now + 200);  // t=5200

    // At t=5300, both requests are active, window full
    expect(limiter.retryAfter('svc', now + 300)).toBe(700);
    // The earliest request (t=5000) expires at t=6000, so wait 700ms from t=5300

    // At t=6001, the first request expired
    expect(limiter.retryAfter('svc', now + 1001)).toBe(0);
  });
});
