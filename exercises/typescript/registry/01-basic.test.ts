import { describe, it, expect } from 'vitest';

/**
 * Registry - Basic: Implement a typed registry with register/get/list.
 *
 * TODO: Implement a Registry with:
 * - register(name, factory): Register a factory function by name (throw on duplicate)
 * - get(name): Return the factory (throw if not found)
 * - create(name, ...args): Call the factory and return the result
 * - has(name): Check if a name is registered
 * - list(): Return all registered names
 */

type Factory<T> = (...args: any[]) => T;

class Registry<T> {
  private entries = new Map<string, Factory<T>>();

  register(name: string, factory: Factory<T>): void {
    // TODO: implement
    if (this.entries.has(name)) {
      throw new Error(`"${name}" is already registered`);
    }
    this.entries.set(name, factory);
  }

  get(name: string): Factory<T> {
    // TODO: implement
    const factory = this.entries.get(name);
    if (!factory) {
      throw new Error(`"${name}" is not registered`);
    }
    return factory;
  }

  create(name: string, ...args: any[]): T {
    // TODO: implement
    return this.get(name)(...args);
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  list(): string[] {
    return [...this.entries.keys()];
  }
}

// --- Tests (do not modify below this line) ---

describe('Registry - Basic', () => {
  it('should register and retrieve a factory', () => {
    const registry = new Registry<string>();
    registry.register('greeting', (name: string) => `Hello, ${name}!`);
    const factory = registry.get('greeting');
    expect(factory('World')).toBe('Hello, World!');
  });

  it('should create instances via create()', () => {
    const registry = new Registry<number>();
    registry.register('add', (a: number, b: number) => a + b);
    expect(registry.create('add', 3, 4)).toBe(7);
  });

  it('should throw on duplicate registration', () => {
    const registry = new Registry<string>();
    registry.register('x', () => 'first');
    expect(() => registry.register('x', () => 'second')).toThrow();
  });

  it('should throw on missing key lookup', () => {
    const registry = new Registry<string>();
    expect(() => registry.get('missing')).toThrow();
  });

  it('should check existence with has()', () => {
    const registry = new Registry<string>();
    registry.register('a', () => 'A');
    expect(registry.has('a')).toBe(true);
    expect(registry.has('b')).toBe(false);
  });

  it('should list all registered names', () => {
    const registry = new Registry<string>();
    registry.register('json', () => 'json');
    registry.register('xml', () => 'xml');
    registry.register('csv', () => 'csv');
    expect(registry.list().sort()).toEqual(['csv', 'json', 'xml']);
  });
});
