import { describe, it, expect } from 'vitest';

/**
 * Retry with Backoff - Intermediate: Retry with Circuit Breaker.
 *
 * TODO: Implement a RetryWithCircuitBreaker that combines retry-with-backoff
 * and circuit breaker logic. After N consecutive failures the circuit opens
 * and all subsequent calls fail immediately until a cooldown period elapses.
 */

interface RetryCircuitConfig {
  maxRetries: number;
  baseDelay: number;
  failureThreshold: number; // consecutive failures before circuit opens
  cooldownMs: number;       // how long the circuit stays open
}

interface CallResult<T> {
  value: T;
  attempts: number;
}

class RetryWithCircuitBreaker {
  private consecutiveFailures = 0;
  private circuitOpenedAt: number | null = null;
  private config: RetryCircuitConfig;

  constructor(config: RetryCircuitConfig) {
    this.config = config; // TODO: implement
  }

  get isCircuitOpen(): boolean {
    if (this.circuitOpenedAt === null) return false; // TODO: implement
    if (Date.now() - this.circuitOpenedAt >= this.config.cooldownMs) {
      // Cooldown elapsed — half-open, allow next attempt
      return false;
    }
    return true;
  }

  /** Reset the circuit to closed state (used after successful call during half-open) */
  private resetCircuit(): void {
    this.consecutiveFailures = 0; // TODO: implement
    this.circuitOpenedAt = null;
  }

  /** Record a failure and possibly open the circuit */
  private recordFailure(): void {
    this.consecutiveFailures++; // TODO: implement
    if (this.consecutiveFailures >= this.config.failureThreshold) {
      this.circuitOpenedAt = Date.now();
    }
  }

  async call<T>(fn: () => Promise<T>): Promise<CallResult<T>> {
    if (this.isCircuitOpen) { // TODO: implement
      throw new Error('Circuit is open');
    }

    let lastError: Error | undefined;
    let attempts = 0;

    for (let i = 0; i <= this.config.maxRetries; i++) {
      attempts++;
      try {
        const value = await fn();
        this.resetCircuit();
        return { value, attempts };
      } catch (err) {
        lastError = err as Error;
        this.recordFailure();
        if (this.isCircuitOpen) {
          throw new Error('Circuit is open');
        }
        if (i < this.config.maxRetries) {
          const delay = this.config.baseDelay * Math.pow(2, i);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Retry with Backoff - Intermediate: Retry with Circuit Breaker', () => {
  it('should retry and succeed eventually', async () => {
    const breaker = new RetryWithCircuitBreaker({
      maxRetries: 5,
      baseDelay: 1,
      failureThreshold: 10,
      cooldownMs: 1000,
    });

    let calls = 0;
    const result = await breaker.call(async () => {
      calls++;
      if (calls < 3) throw new Error('transient');
      return 'ok';
    });

    expect(result.value).toBe('ok');
    expect(result.attempts).toBe(3);
  });

  it('should open circuit after failure threshold', async () => {
    const breaker = new RetryWithCircuitBreaker({
      maxRetries: 1,
      baseDelay: 1,
      failureThreshold: 3,
      cooldownMs: 5000,
    });

    // First call: 2 failures (initial + 1 retry) — circuit still closed
    await expect(
      breaker.call(async () => { throw new Error('fail'); }),
    ).rejects.toThrow('fail');

    // Second call: 1 more failure hits threshold (3 total) — circuit opens
    await expect(
      breaker.call(async () => { throw new Error('fail'); }),
    ).rejects.toThrow('Circuit is open');

    expect(breaker.isCircuitOpen).toBe(true);
  });

  it('should block calls while circuit is open', async () => {
    const breaker = new RetryWithCircuitBreaker({
      maxRetries: 0,
      baseDelay: 1,
      failureThreshold: 2,
      cooldownMs: 5000,
    });

    // 2 failures to open circuit
    await expect(breaker.call(async () => { throw new Error('f1'); })).rejects.toThrow();
    await expect(breaker.call(async () => { throw new Error('f2'); })).rejects.toThrow();

    // Even a function that would succeed gets blocked
    await expect(
      breaker.call(async () => 'should not run'),
    ).rejects.toThrow('Circuit is open');
  });

  it('should reset circuit after cooldown and successful call', async () => {
    const breaker = new RetryWithCircuitBreaker({
      maxRetries: 0,
      baseDelay: 1,
      failureThreshold: 2,
      cooldownMs: 50,
    });

    // Open the circuit
    await expect(breaker.call(async () => { throw new Error('f'); })).rejects.toThrow();
    await expect(breaker.call(async () => { throw new Error('f'); })).rejects.toThrow();
    expect(breaker.isCircuitOpen).toBe(true);

    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 60));
    expect(breaker.isCircuitOpen).toBe(false);

    // Successful call resets the circuit
    const result = await breaker.call(async () => 'recovered');
    expect(result.value).toBe('recovered');
    expect(breaker.isCircuitOpen).toBe(false);
  });

  it('should report attempt count on success', async () => {
    const breaker = new RetryWithCircuitBreaker({
      maxRetries: 5,
      baseDelay: 1,
      failureThreshold: 20,
      cooldownMs: 1000,
    });

    // Succeeds immediately
    const r1 = await breaker.call(async () => 'instant');
    expect(r1.attempts).toBe(1);

    // Succeeds on 4th attempt
    let count = 0;
    const r2 = await breaker.call(async () => {
      count++;
      if (count < 4) throw new Error('retry');
      return 'delayed';
    });
    expect(r2.attempts).toBe(4);
    expect(r2.value).toBe('delayed');
  });
});
