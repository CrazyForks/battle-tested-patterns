import { describe, it, expect } from 'vitest';

/**
 * Middleware / Pipeline Chain - Intermediate: Async Middleware with Error Handling.
 *
 * TODO: Implement an async middleware pipeline where each middleware is
 * an async function. If any middleware throws, subsequent middleware is
 * skipped and the error is captured in the result. This follows Koa's
 * "onion model" where middleware can run code before AND after next().
 *
 * Real-world use: Koa.js, Fetch API interceptors, gRPC interceptors,
 * AWS Lambda middleware (middy).
 */

type AsyncMiddleware<T> = (ctx: T, next: () => Promise<void>) => Promise<void>;

interface PipelineResult {
  success: boolean;
  error?: Error;
}

class AsyncPipeline<T> {
  private middlewares: AsyncMiddleware<T>[] = [];

  /** Add an async middleware to the end of the chain. */
  use(middleware: AsyncMiddleware<T>): void {
    // TODO: implement
    this.middlewares.push(middleware);
  }

  /** Execute the async middleware chain. Captures errors in result. */
  async execute(ctx: T): Promise<PipelineResult> {
    // TODO: implement
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const mw = this.middlewares[index]!;
        index++;
        await mw(ctx, next);
      }
    };

    try {
      await next();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

interface AsyncCtx {
  values: string[];
  user?: string;
  error?: string;
}

describe('Middleware / Pipeline Chain - Intermediate: Async Middleware', () => {
  it('should execute async middleware in order', async () => {
    const pipeline = new AsyncPipeline<AsyncCtx>();
    pipeline.use(async (ctx, next) => {
      ctx.values.push('a');
      await next();
    });
    pipeline.use(async (ctx, next) => {
      ctx.values.push('b');
      await next();
    });
    pipeline.use(async (ctx, next) => {
      ctx.values.push('c');
      await next();
    });

    const ctx: AsyncCtx = { values: [] };
    const result = await pipeline.execute(ctx);
    expect(result.success).toBe(true);
    expect(ctx.values).toEqual(['a', 'b', 'c']);
  });

  it('should stop chain and capture error when middleware throws', async () => {
    const pipeline = new AsyncPipeline<AsyncCtx>();
    pipeline.use(async (ctx, next) => {
      ctx.values.push('before');
      await next();
    });
    pipeline.use(async (_ctx, _next) => {
      throw new Error('auth failed');
    });
    pipeline.use(async (ctx, next) => {
      ctx.values.push('should-not-run');
      await next();
    });

    const ctx: AsyncCtx = { values: [] };
    const result = await pipeline.execute(ctx);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('auth failed');
    expect(ctx.values).toEqual(['before']);
    expect(ctx.values).not.toContain('should-not-run');
  });

  it('should return error object in result without throwing', async () => {
    const pipeline = new AsyncPipeline<AsyncCtx>();
    pipeline.use(async () => {
      throw new Error('something broke');
    });

    const ctx: AsyncCtx = { values: [] };
    // execute() should NOT throw — it captures the error in the result
    const result = await pipeline.execute(ctx);
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('something broke');
  });

  it('should support cleanup (finally) pattern via onion model', async () => {
    const pipeline = new AsyncPipeline<AsyncCtx>();
    const timeline: string[] = [];

    // Outer middleware: runs code before AND after inner middleware
    pipeline.use(async (ctx, next) => {
      timeline.push('setup-start');
      try {
        await next();
      } finally {
        timeline.push('cleanup');
      }
    });

    pipeline.use(async (_ctx, next) => {
      timeline.push('handler');
      await next();
    });

    const ctx: AsyncCtx = { values: [] };
    await pipeline.execute(ctx);
    expect(timeline).toEqual(['setup-start', 'handler', 'cleanup']);
  });

  it('should run cleanup even when inner middleware throws', async () => {
    const pipeline = new AsyncPipeline<AsyncCtx>();
    const timeline: string[] = [];

    pipeline.use(async (_ctx, next) => {
      timeline.push('open-connection');
      try {
        await next();
      } finally {
        timeline.push('close-connection');
      }
    });

    pipeline.use(async () => {
      timeline.push('before-crash');
      throw new Error('db error');
    });

    const ctx: AsyncCtx = { values: [] };
    const result = await pipeline.execute(ctx);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('db error');
    expect(timeline).toEqual(['open-connection', 'before-crash', 'close-connection']);
  });
});
