import { describe, it, expect } from 'vitest';

/**
 * Retry with Backoff - Basic: Configurable retry with exponential delay.
 *
 * TODO: Implement retryWithBackoff that retries a function on failure
 * with exponentially increasing delays.
 */

interface BackoffConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: BackoffConfig,
): Promise<T> {
  let lastError: Error | undefined; // TODO: implement

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt === config.maxRetries) break;
      const delay = Math.min(config.baseDelay * Math.pow(2, attempt), config.maxDelay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Retry with Backoff - Basic', () => {
  it('should succeed on first try', async () => {
    const result = await retryWithBackoff(
      async () => 'ok',
      { maxRetries: 3, baseDelay: 10, maxDelay: 100 },
    );
    expect(result).toBe('ok');
  });

  it('should retry and eventually succeed', async () => {
    let attempts = 0;
    const result = await retryWithBackoff(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error('fail');
        return 'recovered';
      },
      { maxRetries: 5, baseDelay: 1, maxDelay: 10 },
    );
    expect(result).toBe('recovered');
    expect(attempts).toBe(3);
  });

  it('should throw after max retries exhausted', async () => {
    await expect(
      retryWithBackoff(
        async () => { throw new Error('permanent'); },
        { maxRetries: 2, baseDelay: 1, maxDelay: 10 },
      ),
    ).rejects.toThrow('permanent');
  });

  it('should cap delay at maxDelay', async () => {
    const delays: number[] = [];
    let attempts = 0;
    const start = Date.now();

    try {
      await retryWithBackoff(
        async () => {
          attempts++;
          if (attempts > 1) delays.push(Date.now() - start);
          throw new Error('fail');
        },
        { maxRetries: 3, baseDelay: 5, maxDelay: 15 },
      );
    } catch {
      // Expected: the operation always throws; we assert on attempt count below.
    }

    // All delays should be reasonable (not growing beyond maxDelay significantly)
    expect(attempts).toBe(4); // initial + 3 retries
  });
});
