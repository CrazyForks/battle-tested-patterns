import { describe, it, expect } from 'vitest';

/**
 * Middleware / Pipeline Chain - Basic: Middleware Pipeline.
 *
 * TODO: Implement a Pipeline<T> that chains middleware functions.
 * Each middleware receives a context and a next() function. Calling
 * next() passes control to the next middleware. Not calling next()
 * short-circuits the chain. Context mutations are visible downstream.
 *
 * Real-world use: Express.js, Koa, Redux middleware, ASP.NET pipeline.
 */

type Middleware<T> = (ctx: T, next: () => void) => void;

class Pipeline<T> {
  private middlewares: Middleware<T>[] = [];

  /** Add a middleware to the end of the chain. */
  use(middleware: Middleware<T>): void {
    // TODO: implement
    this.middlewares.push(middleware);
  }

  /** Execute the middleware chain with the given context. */
  execute(ctx: T): void {
    // TODO: implement
    let index = 0;

    const next = (): void => {
      if (index < this.middlewares.length) {
        const mw = this.middlewares[index]!;
        index++;
        mw(ctx, next);
      }
    };

    next();
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

interface RequestCtx {
  path: string;
  headers: Record<string, string>;
  body: string;
  log: string[];
}

describe('Middleware / Pipeline Chain - Basic', () => {
  it('should execute a single middleware', () => {
    const pipeline = new Pipeline<RequestCtx>();
    pipeline.use((ctx, next) => {
      ctx.log.push('only');
      next();
    });

    const ctx: RequestCtx = { path: '/', headers: {}, body: '', log: [] };
    pipeline.execute(ctx);
    expect(ctx.log).toEqual(['only']);
  });

  it('should execute middleware in use() order', () => {
    const pipeline = new Pipeline<RequestCtx>();
    pipeline.use((ctx, next) => { ctx.log.push('first'); next(); });
    pipeline.use((ctx, next) => { ctx.log.push('second'); next(); });
    pipeline.use((ctx, next) => { ctx.log.push('third'); next(); });

    const ctx: RequestCtx = { path: '/', headers: {}, body: '', log: [] };
    pipeline.execute(ctx);
    expect(ctx.log).toEqual(['first', 'second', 'third']);
  });

  it('should short-circuit when next() is not called', () => {
    const pipeline = new Pipeline<RequestCtx>();
    pipeline.use((ctx, next) => { ctx.log.push('auth'); next(); });
    pipeline.use((ctx, _next) => {
      ctx.log.push('denied');
      // deliberately not calling next() — short circuit
    });
    pipeline.use((ctx, next) => { ctx.log.push('handler'); next(); });

    const ctx: RequestCtx = { path: '/', headers: {}, body: '', log: [] };
    pipeline.execute(ctx);
    expect(ctx.log).toEqual(['auth', 'denied']);
    expect(ctx.log).not.toContain('handler');
  });

  it('should pass context mutations through the chain', () => {
    const pipeline = new Pipeline<RequestCtx>();
    pipeline.use((ctx, next) => {
      ctx.headers['x-request-id'] = 'abc-123';
      next();
    });
    pipeline.use((ctx, next) => {
      ctx.body = `id=${ctx.headers['x-request-id'] ?? 'unknown'}`;
      next();
    });

    const ctx: RequestCtx = { path: '/', headers: {}, body: '', log: [] };
    pipeline.execute(ctx);
    expect(ctx.headers['x-request-id']).toBe('abc-123');
    expect(ctx.body).toBe('id=abc-123');
  });

  it('should handle empty pipeline gracefully', () => {
    const pipeline = new Pipeline<RequestCtx>();
    const ctx: RequestCtx = { path: '/', headers: {}, body: '', log: [] };
    pipeline.execute(ctx); // should not throw
    expect(ctx.log).toEqual([]);
  });
});
