import { describe, it, expect } from 'vitest';

/**
 * Registry - Intermediate: Decorator-based auto-registration and validation.
 *
 * TODO: Extend the Registry with:
 * - A decorator method that returns a function to auto-register classes/functions
 * - validate(required): Verify all required names are registered, throw with missing list
 * - unregister(name): Remove a registration
 *
 * Real-world use: TensorFlow REGISTER_OP, pytest fixtures, plugin systems.
 */

type Factory<T> = (...args: any[]) => T;

class Registry<T> {
  private entries = new Map<string, Factory<T>>();

  register(name: string, factory: Factory<T>): void {
    if (this.entries.has(name)) {
      throw new Error(`"${name}" is already registered`);
    }
    this.entries.set(name, factory);
  }

  get(name: string): Factory<T> {
    const factory = this.entries.get(name);
    if (!factory) throw new Error(`"${name}" is not registered`);
    return factory;
  }

  create(name: string, ...args: any[]): T {
    return this.get(name)(...args);
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  list(): string[] {
    return [...this.entries.keys()];
  }

  /** Remove a registration. Returns true if it existed. */
  unregister(name: string): boolean {
    // TODO: implement
    return this.entries.delete(name);
  }

  /** Return a function that auto-registers the given factory under `name`. */
  decorator(name: string): (factory: Factory<T>) => Factory<T> {
    // TODO: implement
    return (factory: Factory<T>) => {
      this.register(name, factory);
      return factory;
    };
  }

  /** Verify all required names are registered. Throw with missing list if not. */
  validate(required: string[]): void {
    // TODO: implement
    const missing = required.filter((name) => !this.entries.has(name));
    if (missing.length > 0) {
      throw new Error(`Missing registrations: ${missing.join(', ')}`);
    }
  }
}

// --- Tests (do not modify below this line) ---

describe('Registry - Intermediate: Decorators & Validation', () => {
  it('should auto-register via decorator', () => {
    const registry = new Registry<string>();
    const greet = registry.decorator('greet')((name: string) => `Hi, ${name}`);

    expect(registry.has('greet')).toBe(true);
    expect(greet('Alice')).toBe('Hi, Alice');
    expect(registry.create('greet', 'Bob')).toBe('Hi, Bob');
  });

  it('should validate required registrations', () => {
    const registry = new Registry<string>();
    registry.register('json', () => '{}');
    registry.register('xml', () => '</>');

    // Should pass — both are registered
    expect(() => registry.validate(['json', 'xml'])).not.toThrow();

    // Should fail — csv is missing
    expect(() => registry.validate(['json', 'csv', 'yaml'])).toThrow(/csv/);
  });

  it('should unregister entries', () => {
    const registry = new Registry<string>();
    registry.register('temp', () => 'temporary');
    expect(registry.has('temp')).toBe(true);
    expect(registry.unregister('temp')).toBe(true);
    expect(registry.has('temp')).toBe(false);
    expect(registry.unregister('temp')).toBe(false); // already gone
  });

  it('should allow re-registration after unregister', () => {
    const registry = new Registry<number>();
    registry.register('counter', () => 1);
    registry.unregister('counter');
    registry.register('counter', () => 2);
    expect(registry.create('counter')).toBe(2);
  });

  it('should handle multiple decorators', () => {
    const registry = new Registry<number>();
    registry.decorator('add')((a: number, b: number) => a + b);
    registry.decorator('mul')((a: number, b: number) => a * b);
    registry.decorator('neg')((a: number) => -a);

    expect(registry.list().sort()).toEqual(['add', 'mul', 'neg']);
    expect(registry.create('add', 2, 3)).toBe(5);
    expect(registry.create('mul', 2, 3)).toBe(6);
    expect(registry.create('neg', 5)).toBe(-5);
  });
});
