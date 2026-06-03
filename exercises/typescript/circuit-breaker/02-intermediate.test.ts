import { describe, it, expect } from 'vitest';

/**
 * Circuit Breaker - Intermediate: Circuit Breaker with Metrics.
 *
 * TODO: Build a circuit breaker that tracks call metrics and uses
 * a failure *rate* (not consecutive failures) within a rolling time
 * window to decide when to open. This is how production circuit
 * breakers (Hystrix, resilience4j) actually work.
 *
 * - CLOSED: calls pass through. If failure rate > threshold within
 *   the window AND minimum call count is met, transition to OPEN.
 * - OPEN: calls fail immediately. After resetTimeout ms → HALF_OPEN.
 * - HALF_OPEN: allow one probe call. Success → CLOSED. Failure → OPEN.
 */

type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface Metrics {
  totalCalls: number;
  successes: number;
  failures: number;
  failureRate: number; // 0.0 to 1.0
}

class MetricsCircuitBreaker {
  private state: State = 'CLOSED';
  private callLog: { time: number; success: boolean }[] = [];
  private openedAt = 0;

  constructor(
    private failureRateThreshold: number, // e.g. 0.5 = 50%
    private windowMs: number, // rolling window in ms
    private minCalls: number, // minimum calls before evaluating rate
    private resetTimeout: number, // ms before transitioning to HALF_OPEN
  ) {} // TODO: implement

  getState(): State {
    // TODO: implement — check if OPEN should transition to HALF_OPEN
    if (this.state === 'OPEN' && Date.now() - this.openedAt >= this.resetTimeout) {
      this.state = 'HALF_OPEN';
    }
    return this.state;
  }

  getMetrics(): Metrics {
    // TODO: implement — compute metrics from calls within the window
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const recent = this.callLog.filter((c) => c.time >= windowStart);

    const totalCalls = recent.length;
    const successes = recent.filter((c) => c.success).length;
    const failures = totalCalls - successes;
    const failureRate = totalCalls === 0 ? 0 : failures / totalCalls;

    return { totalCalls, successes, failures, failureRate };
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    // TODO: implement
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      throw new Error('Circuit is OPEN');
    }

    try {
      const result = await fn();
      this.recordCall(true);

      if (currentState === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.callLog = [];
      }

      return result;
    } catch (err) {
      this.recordCall(false);

      if (currentState === 'HALF_OPEN') {
        this.state = 'OPEN';
        this.openedAt = Date.now();
      }

      throw err;
    }
  }

  private recordCall(success: boolean): void {
    this.callLog.push({ time: Date.now(), success });
    this.evaluateState();
  }

  private evaluateState(): void {
    if (this.state !== 'CLOSED') return;

    const metrics = this.getMetrics();
    if (
      metrics.totalCalls >= this.minCalls &&
      metrics.failureRate > this.failureRateThreshold
    ) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Circuit Breaker - Intermediate: Metrics-based', () => {
  const succeed = async () => 'ok';
  const fail = async () => { throw new Error('service down'); };

  it('should stay CLOSED when failure rate is under threshold', async () => {
    // threshold = 60%, min 5 calls. 2 failures out of 5 = 40% < 60%
    const cb = new MetricsCircuitBreaker(0.6, 5000, 5, 1000);

    await cb.call(succeed);
    await cb.call(succeed);
    await cb.call(succeed);
    await expect(cb.call(fail)).rejects.toThrow();
    await expect(cb.call(fail)).rejects.toThrow();

    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getMetrics().failureRate).toBeCloseTo(0.4, 1);
  });

  it('should OPEN when failure rate exceeds threshold with enough calls', async () => {
    // threshold = 50%, min 4 calls. 3 failures out of 4 = 75% > 50%
    const cb = new MetricsCircuitBreaker(0.5, 5000, 4, 1000);

    await cb.call(succeed);
    await expect(cb.call(fail)).rejects.toThrow();
    await expect(cb.call(fail)).rejects.toThrow();
    await expect(cb.call(fail)).rejects.toThrow();

    expect(cb.getState()).toBe('OPEN');
    await expect(cb.call(succeed)).rejects.toThrow('Circuit is OPEN');
  });

  it('should not OPEN before minimum call count is reached', async () => {
    // threshold = 50%, min 10 calls. Even with 100% failures, need 10+ calls.
    const cb = new MetricsCircuitBreaker(0.5, 5000, 10, 1000);

    for (let i = 0; i < 5; i++) {
      await expect(cb.call(fail)).rejects.toThrow('service down');
    }

    // 5 calls, all failures (100%), but minCalls = 10 → still CLOSED
    expect(cb.getState()).toBe('CLOSED');
  });

  it('should transition OPEN → HALF_OPEN → CLOSED on recovery', async () => {
    const cb = new MetricsCircuitBreaker(0.5, 5000, 2, 50);

    // Trip the breaker: 2 failures, 0 successes → 100% > 50%
    await expect(cb.call(fail)).rejects.toThrow();
    await expect(cb.call(fail)).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    // Wait for resetTimeout
    await new Promise((r) => setTimeout(r, 60));
    expect(cb.getState()).toBe('HALF_OPEN');

    // Successful probe → CLOSED
    const result = await cb.call(succeed);
    expect(result).toBe('ok');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('should report accurate metrics within the window', async () => {
    const cb = new MetricsCircuitBreaker(0.8, 5000, 10, 1000);

    // 7 successes, 3 failures
    for (let i = 0; i < 7; i++) await cb.call(succeed);
    for (let i = 0; i < 3; i++) await expect(cb.call(fail)).rejects.toThrow();

    const m = cb.getMetrics();
    expect(m.totalCalls).toBe(10);
    expect(m.successes).toBe(7);
    expect(m.failures).toBe(3);
    expect(m.failureRate).toBeCloseTo(0.3, 1);
  });
});
